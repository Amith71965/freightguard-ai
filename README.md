# FreightGuard AI

**Live demo:** [freightguard-ai.vercel.app](https://freightguard-ai.vercel.app) · **Architecture:** [docs/architecture.md](docs/architecture.md)

FreightGuard is a voice-first freight exception control room built with Retell AI. A dispatcher speaks with Maya, an AI operator that verifies a delayed or at-risk load, reads back the proposed action, and safely updates the operational record while the browser shows the call and tool activity live.

The project is deliberately narrow enough to understand in a few minutes and deep enough to exercise production concerns: Retell agent provisioning, browser WebRTC, dynamic call context, custom functions, signed webhooks, idempotent retries, session isolation, post-call analysis, and a real Postgres workflow.

## What to try

| Load | Scenario | Expected behavior |
| --- | --- | --- |
| FG-28471 | Weather delay | Confirm and record a later ETA |
| FG-39204 | Damage risk | Create a high-priority escalation |
| FG-51788 | Missed window | Reschedule after explicit confirmation |
| FG-61033 | Load not located | Demonstrate a transient failure and safe retry |

See the [demo script](docs/demo-script.md) for a three-minute walkthrough and [architecture notes](docs/architecture.md) for the trust boundaries.

## Local setup

Requirements: Node.js 22+, Docker through OrbStack or Docker Desktop, and a Retell account for live voice calls. The dashboard and database run without a paid service.

```bash
cp .env.example .env.local
npm install
npm run db:up
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`. Every browser gets its own synthetic data set. `npm run db:down` stops this project's container without deleting its named volume.

## Retell setup

1. Create a Retell API key, public key, and choose a voice in the Retell dashboard.
2. Expose the local app through an HTTPS tunnel or deploy it. Set `APP_BASE_URL` to that public origin.
3. Put `RETELL_API_KEY` and `RETELL_VOICE_ID` in `.env.local`, then run `npm run retell:provision`.
4. Copy the printed LLM, agent, and version IDs into `.env.local`. Add the Retell public key as `NEXT_PUBLIC_RETELL_PUBLIC_KEY`.
5. Create a Google reCAPTCHA v3 key, restrict it to the demo domain, add `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, and enable reCAPTCHA for the key in Retell's Public Keys settings.
6. Restart the app. The call button becomes active when the public key and agent ID are present.

The provisioning script updates resources when `RETELL_LLM_ID` and `RETELL_AGENT_ID` are present, so prompt and tool changes do not create duplicates.

## Verification

```bash
npm run check       # lint, types, unit tests, production build
npm run test:e2e    # Chromium workflow tests
```

## Deploy for free-tier use

1. Create a free Neon Postgres database and set its pooled connection string as `DATABASE_URL`.
2. Run `DATABASE_URL='...' npm run db:migrate` once against that database.
3. Import the repository into Vercel and add every value from `.env.example`.
4. Set `APP_BASE_URL` and `ALLOWED_HOSTS` to the final Vercel domain, redeploy, then rerun `npm run retell:provision` so Retell receives the production tool and webhook URLs.
5. Add the final domain to the Google reCAPTCHA key and enable reCAPTCHA on the Retell public key.

`RETELL_API_KEY` stays server-side. Tool routes and webhooks reject unsigned requests; shipment actions are scoped to the call's demo session and validated again outside the model.

## Stack

Next.js 16, React 19, TypeScript, Retell Web SDK and Node SDK, Postgres 17, Drizzle ORM, Zod, Vitest, and Playwright.
