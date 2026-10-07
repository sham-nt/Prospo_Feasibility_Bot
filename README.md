# 12C Business MRI — conversational Phase 0 (POC)

A proof-of-concept of the **Business MRI "Phase 0" hero chat**: a visitor describes one
business problem, an AI agent runs a disciplined 6–10 turn conversation, scores an AI-fit
test honestly, proposes a named solution (or says plainly that AI does not fit), captures a
contact, and stores the session. The chat is **generative UI** — the agent decides *what to
render* each turn (a number field, a contact form, a fit-verdict card, next-steps), not just
what to say.

The conversation behaviour is specified in the
[`business-mri-chat` skill](.claude/skills/business-mri-chat/SKILL.md).

## Architecture

```
web/  (Vite + React 19, Thesys OpenUI)          server/  (Node + TS, long-lived)
  AgentInterface  ──POST /api/mri-chat (SSE)──▶    Hono HTTP + Pi Durable harness
  renders OpenUI Lang via the chat library          ├─ records turns to SQLite (durable, resumable)
                                                     ├─ calls the Thesys gateway (OpenAI-compatible)
                                                     └─ streams OpenUI Lang back as OpenAI SSE
                                                          │
                                           Thesys gateway (api.thesys.dev) ──▶ the LLM (managed)
```

- **Thesys OpenUI** owns the model call and the generative UI: the frontend's `AgentInterface`
  POSTs to the backend, which proxies the Thesys gateway and streams back OpenUI Lang that the
  `Renderer` turns into live components.
- **Pi Durable** owns durable, resumable session state in local SQLite (and, in later phases, the
  captured-field documents, usage/cost, and abandon finalization).
- **Model access:** Managed free tier — the server holds only `THESYS_API_KEY`; the gateway calls
  the model. No local LLM, no provider key on the machine. (The free tier may use request data for
  training, so only feed it synthetic/test problems; switch to BYOK in the Thesys console for real use.)

## Prerequisites

- Node.js 20+ (developed on Node 25)
- A Thesys account + `THESYS_API_KEY` (free tier) — only needed to leave mock mode; see below.

## Setup

```bash
# from the repo root
cd server && npm install && cp -n .env.example .env
cd ../web  && npm install && cp -n .env.example .env
```

## Run (two terminals)

```bash
# terminal 1 — the agent service (owns server/data/*.sqlite)
cd server && npm run dev
```

```bash
# terminal 2 — the frontend
cd web && npm run dev
```

Open http://localhost:5173.

### Mock vs real gateway

- **Mock mode (default when `THESYS_API_KEY` is empty):** the server streams canned OpenUI Lang, so
  the frontend, transport, rendering and Pi Durable persistence all work offline, with no key and no
  network. `GET /health` reports `"gateway":"mock"`.
- **Real gateway:** put a real `THESYS_API_KEY` in `server/.env`. (The real Autofix-wrapped gateway
  call is wired in a later step; see `server/src/gateway.ts`.)

## Current status

- **Phase 1 (integration spike): done.** End-to-end round-trip proven — `AgentInterface` → backend
  SSE of OpenUI Lang → rendered chat-library components; turns persisted to SQLite and resumed across
  a server restart; mock mode runs with no key.
- Next: real gateway call behind the key, then the full 7-stage MRI agent, structured capture to the
  spec's output schema, and the 8 acceptance tests.

## Layout

```
.claude/skills/business-mri-chat/   the agent's behavioural spec (the MRI Phase 0 skill)
server/                             Pi Durable agent service
  src/config.ts                     env + mock/real gateway switch
  src/harness.ts                    Pi Durable harness, SQLite, turn recording
  src/gateway.ts                    mock OpenUI Lang stream (real gateway: TODO behind key)
  src/index.ts                      Hono HTTP: /api/mri-chat, /health, /api/debug/state
web/                                Thesys generative-UI frontend
  src/App.tsx                       AgentInterface wired to the backend
```

## Useful checks

```bash
curl -s http://localhost:8787/health              # { ok, gateway: "mock" | "real" }
curl -s http://localhost:8787/api/debug/state     # { messages, usage } from the durable store
```
