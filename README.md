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
web/  (Vite + React 19, OpenUI)                 server/  (Node + TS, long-lived)
  AgentInterface  ──POST /api/mri-chat (SSE)──▶    Hono HTTP + Pi Durable harness
  renders OpenUI Lang via the chat library          ├─ records turns to SQLite (durable, resumable)
  (100% local, no external service)                 ├─ calls your external LLM (OpenAI-compatible)
                                                     └─ streams OpenUI Lang back as OpenAI SSE
                                                          │
                                       OpenRouter (api/v1, OpenAI-compatible) ──▶ your chosen model
```

- **OpenUI** (the open-source `@openuidev/*` libraries) owns the generative UI: the frontend's
  `AgentInterface` renders the OpenUI Lang the model emits. Rendering is **entirely local** — it needs
  no external service. The Lang prompt that teaches the model the format is generated locally too.
- **Pi Durable** owns durable, resumable session state in local SQLite (and, in later phases, the
  captured-field documents, usage/cost, and abandon finalization). It records turns; it does **not**
  make the model call.
- **The LLM is fully external** — one outbound HTTPS call from the server to OpenRouter (or any
  OpenAI-compatible endpoint) with your own key. No hosted gateway sits in between.

### Model access — two modes (`LLM_MODE`, auto-selected)

| Mode | How the model is reached | What you need |
|---|---|---|
| **direct** | Your own OpenAI-compatible provider (OpenRouter, OpenAI, …). The OpenUI Lang prompt is generated **locally** from the chat library (`server/prompts/openui-chat.system.txt`). | `LLM_API_KEY` (+ `LLM_BASE_URL`, `LLM_MODEL`) |
| **mock** | Canned OpenUI Lang, no network. | nothing |

`LLM_MODE=auto` picks `direct` if `LLM_API_KEY` is set, else `mock`. Direct mode falls back to `mock`
if the provider call errors, so the UI never breaks.

The base OpenUI Lang prompt is a generated artifact — regenerate it after a react-ui upgrade with
`npm run gen:prompt` in `web/`.

## Prerequisites

- Node.js 20+ (developed on Node 25)
- An OpenRouter (or other OpenAI-compatible) API key — only needed to leave mock mode; see below.

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

### Picking a mode

- **Direct:** put an OpenRouter (or other OpenAI-compatible) key in `LLM_API_KEY` in `server/.env`,
  set `LLM_MODEL` to a model that provider offers, and restart. `GET /health` reports
  `"gateway":"direct"`.
- **Mock:** leave `LLM_API_KEY` empty.

## Current status

- **Phase 1 (integration spike): done.** End-to-end round-trip proven — `AgentInterface` → backend
  SSE of OpenUI Lang → rendered chat-library components; turns persisted to SQLite and resumed across
  a server restart; mock mode runs with no key.
- **Phase 2 (the MRI agent): done.** The full behavioural prompt is assembled from the
  [`business-mri-chat` skill](.claude/skills/business-mri-chat/SKILL.md) in
  [`server/src/mri-prompt.ts`](server/src/mri-prompt.ts): seven stages, one-question discipline,
  the five-signal AI-fit test, the solution-pattern library with the human-in-the-loop gate, tone,
  and guardrails — plus per-stage OpenUI rendering (a `Callout` verdict, a `Steps` next-steps card,
  a contact `Form` with consent, `FollowUpBlock` suggestions). A code backstop in
  [`server/src/index.ts`](server/src/index.ts) forces the proposal by turn 8 and the contact form by
  turn 10. Verified live: the high-volume happy path reaches a **good** fit and renders the contact
  form; a rare/organisational problem reaches an honest **poor** fit ("AI is not the first fix here");
  a prompt-injection attempt is ignored.
- Next (Phase 3): structured capture to the spec's output schema (`{layer, sub}` tags, fit signals,
  solution pattern, contact) into a `sessions` table, completion + abandon finalisation, and caps.
  Then the full eight acceptance tests (Phase 4).

### A note on the model

Reasoning models on OpenRouter's **free** pool can exhaust their token budget on hidden reasoning and
return an empty reply, which renders nothing. Two mitigations are in place: `LLM_MAX_TOKENS` (default
1500) leaves room for the UI Lang after reasoning, and the default free model
(`apodex/apodex-1.1-mini:free`) returns content reliably on multi-turn. For a live demo, set
`LLM_MODEL` to a cheap paid model (e.g. `google/gemini-2.5-flash`) on your own key — the shared free
pool also rate-limits (429) under load.

## Layout

```
.claude/skills/business-mri-chat/   the agent's behavioural spec (the MRI Phase 0 skill)
server/                             Pi Durable agent service
  src/config.ts                     env + direct/mock mode switch, model + max-tokens
  src/harness.ts                    Pi Durable harness, SQLite, turn recording
  src/mri-prompt.ts                 the MRI agent system prompt (from the skill) + UI mapping
  src/llm.ts                        external LLM call (direct) + mock OpenUI Lang stream
  src/index.ts                      Hono HTTP: /api/mri-chat, /health, /api/debug/state; turn backstop
  prompts/openui-chat.system.txt    generated OpenUI Lang prompt (artifact; see web/ gen:prompt)
web/                                OpenUI generative-UI frontend
  src/App.tsx                       AgentInterface wired to the backend
```

## Useful checks

```bash
curl -s http://localhost:8787/health              # { ok, gateway: "direct" | "mock" }
curl -s http://localhost:8787/api/debug/state     # { messages, usage } from the durable store
```
