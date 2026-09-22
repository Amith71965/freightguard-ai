"use client";

import { Headphones, Mic, MicOff, PhoneCall, PhoneOff, ShieldCheck, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LiveCallUtterance, SessionStatus, WebCallSession } from "retell-client-js-sdk";
import { RetellClient } from "retell-client-js-sdk";
import type { ShipmentDetail } from "./control-room";
import styles from "./voice-operator.module.css";

declare global {
  interface Window {
    grecaptcha?: { ready(callback: () => void): void; execute(siteKey: string, options: { action: string }): Promise<string> };
  }
}

type Props = {
  detail: ShipmentDetail | null;
  sessionId: string;
  onRefresh: () => Promise<void>;
};

const publicKey = process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY ?? "";
const agentId = process.env.NEXT_PUBLIC_RETELL_AGENT_ID ?? "";
const agentVersion = Number(process.env.NEXT_PUBLIC_RETELL_AGENT_VERSION || 0) || undefined;
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "";

function utteranceText(item: LiveCallUtterance) {
  if (item.role === "agent" || item.role === "user" || item.role === "transfer_target" || item.role === "injected") return item.content;
  if (item.role === "tool_call_invocation") return `Running ${item.name.replaceAll("_", " ")}`;
  if (item.role === "tool_call_result") return item.successful ? "Action recorded" : "Action failed";
  return "";
}

export function VoiceOperator({ detail, sessionId, onRefresh }: Props) {
  const sessionRef = useRef<WebCallSession | null>(null);
  const refreshRef = useRef(onRefresh);
  const [status, setStatus] = useState<SessionStatus | "idle">("idle");
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState<LiveCallUtterance[]>([]);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => { refreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    if (!recaptchaSiteKey || document.querySelector('script[data-freightguard-recaptcha]')) return;
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
    script.async = true;
    script.dataset.freightguardRecaptcha = "true";
    document.head.appendChild(script);
  }, []);

  useEffect(() => () => { if (sessionRef.current) void sessionRef.current.end(); }, []);

  async function recaptchaToken() {
    if (!recaptchaSiteKey) return undefined;
    if (!window.grecaptcha) throw new Error("reCAPTCHA is still loading. Try again in a moment.");
    return new Promise<string>((resolve, reject) => {
      window.grecaptcha?.ready(() => window.grecaptcha?.execute(recaptchaSiteKey, { action: "start_dispatch_call" }).then(resolve, reject));
    });
  }

  async function startCall() {
    if (!detail || !sessionId || !publicKey || !agentId) return;
    setError(""); setTranscript([]); setMuted(false); setStatus("connecting");
    try {
      const token = await recaptchaToken();
      const client = new RetellClient({ key: publicKey });
      const session = client.createWebCall({
        agent_id: agentId,
        agent_version: agentVersion,
        metadata: { session_id: sessionId, shipment_id: detail.id, source: "freightguard_browser_demo" },
        retell_llm_dynamic_variables: {
          session_id: sessionId,
          shipment_id: detail.id,
          tracking_code: detail.trackingCode,
          carrier_name: detail.carrierName,
          origin: detail.origin,
          destination: detail.destination,
          exception_type: detail.exceptionType.replaceAll("_", " "),
          promised_eta: detail.promisedEta,
        },
        recaptchaToken: token,
        transcript: true,
        hooks: {
          onStatus: setStatus,
          onTranscript: setTranscript,
          onAudio: (samples) => {
            const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / Math.max(samples.length, 1));
            setLevel(Math.min(1, rms * 5));
          },
          onEnd: () => {
            sessionRef.current = null; setLevel(0); setStatus("ended");
            void refreshAfterAnalysis();
          },
          onError: (reason) => { setError(reason.message); setStatus("ended"); },
        },
      });
      sessionRef.current = session;
    } catch (reason) {
      setStatus("idle");
      setError(reason instanceof Error ? reason.message : "Could not start the call.");
    }
  }

  async function refreshAfterAnalysis() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 500 : 2000));
      await refreshRef.current();
    }
  }

  function toggleMute() {
    const session = sessionRef.current;
    if (!session) return;
    if (muted) session.unmute(); else session.mute();
    setMuted(!muted);
  }

  async function endCall() {
    await sessionRef.current?.end();
    sessionRef.current = null; setStatus("ended"); setLevel(0);
  }

  const configured = Boolean(publicKey && agentId);
  const active = status === "connecting" || status === "live";
  const statusLabel = status === "idle" ? "Ready" : status === "live" ? "Live" : status === "connecting" ? "Connecting" : status === "ended" ? "Complete" : status;

  return <aside className={styles.panel}>
    <div className={styles.top}><div><span>Voice operator</span><strong>Maya · Retell AI</strong></div><span className={active ? styles.live : styles.ready}>{statusLabel}</span></div>
    <div className={styles.operator}>
      <div className={`${styles.orb} ${active ? styles.orbActive : ""}`} style={{ "--audio-level": level } as React.CSSProperties}><Headphones size={30} /></div>
      <strong>Carrier dispatch call</strong>
      <p>You play the carrier dispatcher. Maya verifies the exception and records the safe next action.</p>
    </div>
    <div className={styles.brief}><span>Call brief</span><dl><div><dt>Load</dt><dd>{detail?.trackingCode ?? "—"}</dd></div><div><dt>Carrier</dt><dd>{detail?.carrierName ?? "—"}</dd></div><div><dt>Objective</dt><dd>{detail?.exceptionType.replaceAll("_", " ") ?? "—"}</dd></div></dl></div>
    {transcript.length ? <div className={styles.transcript} aria-live="polite">{transcript.slice(-5).map((item) => {
      const content = utteranceText(item); if (!content) return null;
      const tool = item.role.startsWith("tool_call");
      return <div key={item.id} className={tool ? styles.toolLine : item.role === "agent" ? styles.agentLine : styles.userLine}>{tool ? <Wrench size={12} /> : <b>{item.role === "agent" ? "Maya" : "You"}</b>}<span>{content}</span></div>;
    })}</div> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {active ? <div className={styles.controls}><button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>{muted ? <MicOff size={18} /> : <Mic size={18} />}</button><button className={styles.endButton} onClick={() => void endCall()}><PhoneOff size={18} />End call</button></div> : <button className={styles.callButton} onClick={() => void startCall()} disabled={!configured || !detail || !sessionId}><PhoneCall size={19} />Start dispatch call</button>}
    {!configured ? <p className={styles.setup}><ShieldCheck size={13} />Add Retell public credentials to enable calls.</p> : <p className={styles.note}>Browser audio · 3 minute limit · synthetic data</p>}
    <div className={styles.powered}>Powered by <strong>Retell AI</strong></div>
  </aside>;
}
