import Retell from "retell-sdk";
import type { AgentCreateParams, AgentUpdateParams } from "retell-sdk/resources/agent";
import type { LlmCreateParams, LlmUpdateParams } from "retell-sdk/resources/llm";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const apiKey = required("RETELL_API_KEY");
const voiceId = required("RETELL_VOICE_ID");
const baseUrl = required("APP_BASE_URL").replace(/\/$/, "");

if (!baseUrl.startsWith("https://")) {
  throw new Error("APP_BASE_URL must be a public HTTPS URL so Retell can reach the tools and webhook.");
}

const parameters = {
  type: "object" as const,
  properties: {
    reason: { type: "string", description: "A concise operational reason supported by the dispatcher." },
  },
  required: ["reason"],
};

const llmConfig: LlmCreateParams | LlmUpdateParams = {
  model: "gpt-5-nano",
  model_temperature: 0,
  start_speaker: "agent",
  begin_message:
    "Hi, this is Maya with FreightGuard calling about load {{tracking_code}}. Am I speaking with the dispatcher handling this load?",
  default_dynamic_variables: {
    tracking_code: "FG-DEMO",
    carrier_name: "Demo Carrier",
    origin: "Origin",
    destination: "Destination",
    exception_type: "shipment exception",
    promised_eta: "unknown",
  },
  general_prompt: `You are Maya, a concise freight exception operator for FreightGuard AI.

You are calling {{carrier_name}} about load {{tracking_code}}, moving from {{origin}} to {{destination}}. Its exception is {{exception_type}} and its promised arrival is {{promised_eta}}.

Your goal is to verify the load, understand the exception, and complete exactly one safe resolution. First confirm that the user is the dispatcher for this load. Use get_shipment before proposing or recording any action.

Rules:
- Never invent shipment facts, dates, ticket IDs, or actions. Use tool results as the source of truth.
- Only reschedule when the dispatcher clearly provides and confirms a new arrival time. Read the time back before calling reschedule_delivery.
- Damage risk must be escalated. Do not reschedule it.
- Create an escalation when there is damage risk, the load cannot be found, safety is involved, or the dispatcher cannot provide a reliable ETA.
- If a tool fails, explain that the update was not recorded and offer the safe escalation path. Never claim success without a successful tool response.
- Keep replies to one or two short sentences. Ask one question at a time.
- End by summarizing the recorded action and its reference from the tool response.`,
  general_tools: [
    {
      type: "custom",
      name: "get_shipment",
      url: `${baseUrl}/api/retell/functions/get-shipment`,
      description: "Fetch the authoritative shipment, current status, exception, and allowed actions before taking action.",
      method: "POST",
      parameter_type: "json",
      parameters: { type: "object", properties: {} },
      timeout_ms: 6000,
      max_retry: 1,
      speak_during_execution: true,
      speak_after_execution: true,
      execution_message_type: "static_text",
      execution_message_description: "Let me pull up the latest load record.",
    },
    {
      type: "custom",
      name: "reschedule_delivery",
      url: `${baseUrl}/api/retell/functions/reschedule-delivery`,
      description: "Record a dispatcher-confirmed delivery ETA. Only use if get_shipment says reschedule is allowed.",
      method: "POST",
      parameter_type: "json",
      parameters: {
        type: "object",
        properties: {
          proposed_eta: { type: "string", description: "Confirmed arrival timestamp in ISO 8601 format with timezone." },
          reason: parameters.properties.reason,
        },
        required: ["proposed_eta", "reason"],
      },
      timeout_ms: 6000,
      max_retry: 2,
      speak_during_execution: true,
      speak_after_execution: true,
      execution_message_description: "Tell the dispatcher you are recording the confirmed ETA.",
    },
    {
      type: "custom",
      name: "create_escalation",
      url: `${baseUrl}/api/retell/functions/create-escalation`,
      description: "Create an exception-desk escalation for safety, damage, missing loads, or an unreliable ETA.",
      method: "POST",
      parameter_type: "json",
      parameters: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["medium", "high", "critical"], description: "Operational severity." },
          reason: parameters.properties.reason,
          notes: { type: "string", description: "Brief facts supplied by the dispatcher." },
        },
        required: ["severity", "reason", "notes"],
      },
      timeout_ms: 6000,
      max_retry: 2,
      speak_during_execution: true,
      speak_after_execution: true,
      execution_message_description: "Tell the dispatcher you are opening an exception-desk escalation.",
    },
  ],
};

const client = new Retell({ apiKey });
const existingLlmId = process.env.RETELL_LLM_ID?.trim();

function llmMatches(current: Awaited<ReturnType<typeof client.llm.retrieve>>) {
  const expectedTools = (llmConfig.general_tools ?? []).map((tool) => ({ name: tool.name, url: "url" in tool ? tool.url : null }));
  const currentTools = (current.general_tools ?? []).map((tool) => ({ name: tool.name, url: "url" in tool ? tool.url : null }));
  return current.general_prompt === llmConfig.general_prompt && JSON.stringify(currentTools) === JSON.stringify(expectedTools);
}

let llm;
if (!existingLlmId) {
  llm = await client.llm.create(llmConfig as LlmCreateParams);
} else {
  const current = await client.llm.retrieve(existingLlmId);
  if (!current.is_published) llm = await client.llm.update(existingLlmId, llmConfig as LlmUpdateParams);
  else if (llmMatches(current)) llm = current;
  else llm = await client.llm.create(llmConfig as LlmCreateParams);
}

const agentConfig: AgentCreateParams & AgentUpdateParams = {
  response_engine: { type: "retell-llm" as const, llm_id: llm.llm_id },
  voice_id: voiceId,
  agent_name: "FreightGuard Maya",
  language: "en-US" as const,
  max_call_duration_ms: 180_000,
  end_call_after_silence_ms: 30_000,
  responsiveness: 0.9,
  interruption_sensitivity: 0.85,
  opt_in_signed_url: true,
  webhook_url: `${baseUrl}/api/retell/webhook`,
  webhook_events: ["call_started", "call_ended", "call_analyzed"],
  post_call_analysis_model: "gpt-5-nano" as const,
  post_call_analysis_data: [
    { type: "enum" as const, name: "disposition", description: "The final operational result.", choices: ["rescheduled", "escalated", "no_change", "failed"], required: true },
    { type: "string" as const, name: "dispatcher_summary", description: "One-sentence summary of facts confirmed by the dispatcher.", required: true },
    { type: "boolean" as const, name: "action_confirmed", description: "Whether a tool successfully recorded an action.", required: true },
  ],
};

const existingAgentId = process.env.RETELL_AGENT_ID?.trim();
let agent;
let needsPublish = true;
if (!existingAgentId) {
  agent = await client.agent.create(agentConfig);
} else {
  const current = await client.agent.retrieve(existingAgentId);
  const versions = await client.agent.listVersions(existingAgentId);
  const currentVersion = versions.items.find((item) => item.version === current.version);
  const responseEngine = current.response_engine;
  const matches = responseEngine.type === "retell-llm" && responseEngine.llm_id === llm.llm_id
    && current.voice_id === voiceId && current.webhook_url === agentConfig.webhook_url;

  if (matches) {
    agent = current;
    needsPublish = !currentVersion?.is_published;
  } else if (currentVersion?.is_published) {
    const draft = await client.agent.createVersion(existingAgentId, { base_version: current.version });
    agent = await client.agent.update(existingAgentId, { ...agentConfig, version: draft.version });
  } else {
    agent = await client.agent.update(existingAgentId, agentConfig);
  }
}

if (needsPublish) {
  try {
    await client.agent.publish(agent.agent_id, { version: agent.version });
  } catch (error) {
    // Retell currently returns an empty 2xx body here while SDK 6.0.1 still
    // attempts JSON parsing. The publish has succeeded by the time this fires.
    const emptySuccessBody = error instanceof SyntaxError && error.message.includes("Unexpected end of JSON input");
    if (!emptySuccessBody) throw error;
  }
}

console.log(`RETELL_LLM_ID=${llm.llm_id}`);
console.log(`RETELL_AGENT_ID=${agent.agent_id}`);
console.log(`NEXT_PUBLIC_RETELL_AGENT_ID=${agent.agent_id}`);
console.log(`NEXT_PUBLIC_RETELL_AGENT_VERSION=${agent.version}`);
console.log("Provisioned and published FreightGuard Maya. Copy these IDs into your environment file.");
