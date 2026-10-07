import OpenAI from "openai";
import { config } from "./config";

/**
 * End-of-session capture: turn a transcript into the Business MRI Phase 0 output schema
 * (see .claude/skills/business-mri-chat/references/output-schema.md).
 *
 * Contact details are parsed deterministically from the OpenUI form-submit context (no LLM).
 * The rest — problem, process, size, handling, the five fit signals, the solution pattern —
 * come from one cheap extraction call over the transcript. One post per session, at the end.
 */

type Msg = { role: string; content?: unknown };
const toStr = (c: unknown) => (typeof c === "string" ? c : JSON.stringify(c ?? ""));

// OpenUI wraps messages with these markers: `content` holds the visible text/Lang,
// `context` holds a JSON blob (form values, clicked-button details).
const MARK_CONTENT = "]]>openui:content";
const MARK_CONTEXT = "]]>openui:context";

export function splitOpenUI(raw: unknown): { text: string; context: unknown } {
  const content = toStr(raw);
  const ci = content.indexOf(MARK_CONTEXT);
  if (ci < 0) return { text: content.replace(MARK_CONTENT, "").trim(), context: null };
  const before = content.slice(0, ci).replace(MARK_CONTENT, "").trim();
  let context: unknown = null;
  try {
    context = JSON.parse(content.slice(ci + MARK_CONTEXT.length).trim());
  } catch {
    /* leave null */
  }
  return { text: before, context };
}

/** Recursively look for a `{ contact: {...} }` object anywhere in a parsed context blob. */
function findContact(node: unknown): Record<string, { value?: unknown }> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findContact(item);
      if (hit) return hit;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  if (obj.contact && typeof obj.contact === "object") return obj.contact as Record<string, { value?: unknown }>;
  for (const v of Object.values(obj)) {
    const hit = findContact(v);
    if (hit) return hit;
  }
  return null;
}

export type Contact = { name: string | null; email: string | null; company: string | null; phone: string | null; consent: boolean };

/** Pull contact details out of the most recent form submission, if any. */
export function extractContact(messages: Msg[]): Contact | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const { context } = splitOpenUI(messages[i]?.content);
    const c = findContact(context);
    if (!c) continue;
    const val = (k: string) => {
      const v = c[k]?.value;
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };
    const consentVal = c.consent?.value as Record<string, boolean> | boolean | undefined;
    const consent = typeof consentVal === "object" ? Object.values(consentVal).some(Boolean) : Boolean(consentVal);
    return { name: val("name"), email: val("email"), company: val("company"), phone: val("phone"), consent };
  }
  return null;
}

/** True when the latest user turn is a contact-form submission (session completed). */
export function isSubmission(messages: Msg[]): boolean {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return false;
  return findContact(splitOpenUI(lastUser.content).context) !== null;
}

/** A compact, human-readable transcript: user text as typed; assistant copy pulled from the Lang. */
export function readableTranscript(messages: Msg[]): { role: string; text: string }[] {
  return messages
    .map((m) => {
      const { text } = splitOpenUI(m.content);
      if (m.role === "assistant") {
        // Keep only the visible strings the Lang renders, not the component scaffolding.
        const quoted = text.match(/"([^"\\]{2,})"/g)?.map((s) => s.slice(1, -1)) ?? [];
        return { role: "assistant", text: quoted.join(" · ") };
      }
      return { role: m.role, text };
    })
    .filter((t) => t.text);
}

const EXTRACT_PROMPT = `You extract structured data from a finished sales-discovery chat. Return ONLY a JSON object, no prose, no code fences.

The visitor described one business problem and an assistant judged whether AI fits. Produce:

{
  "answers": {
    // include ONLY fields actually established in the transcript; omit the rest.
    // each value is { "value": <string>, "mri": { "layer": <layer>, "sub": <sub> } }
    "p0.problem":  // the problem in the visitor's words        -> layer "opportunity", sub "Pain Points"
    "p0.process":  // best-fit process, you assign it           -> layer "business",    sub "<process>"
    "p0.function": // parent function of that process            -> layer "business",    sub "<process>"
    "p0.volume":   // how many / how often                       -> layer "business",    sub "<process>"
    "p0.effort":   // time taken or people involved              -> layer "opportunity", sub "Bottlenecks"
    "p0.cost":     // cost or value at stake                     -> layer "opportunity", sub "Bottlenecks"
    "p0.pain":     // errors, delays, rework                     -> layer "opportunity", sub "Bottlenecks"
    "p0.who":      // who does it today                          -> layer "business",    sub "<process>"
    "p0.systems":  // systems/spreadsheets/email/paper           -> layer "enterprise",  sub "Systems"
    "p0.data":     // where info lives, how reliable             -> layer "enterprise",  sub "Data"
    "p0.judgement":// whether a person must decide, on what basis-> layer "opportunity", sub "Constraints"
    "p0.tried":    // anything already tried, incl. AI           -> layer "opportunity", sub "Readiness"
  },
  "fit": {
    "verdict": "good" | "partial" | "poor",
    "signals": {
      "repetition": "yes"|"no"|"unknown",
      "describable_judgement": "yes"|"no"|"unknown",
      "available_input": "yes"|"no"|"unknown",
      "tolerable_error": "yes"|"no"|"unknown",
      "number_attached": "yes"|"no"|"unknown"
    }
  },
  "solution": {
    "pattern": one of ["document_extraction","triage_and_routing","drafting","qa_over_documents","reconciliation_and_matching","exception_monitoring","planning_support"] or null when fit is poor,
    "summary": plain-language proposal with the human-in-the-loop gate, or null,
    "caveat": what 12C would need to check, or null
  }
}

Fit rule: 4-5 signals "yes" => good; 2-3 => partial; 0-1 => poor. Be honest; poor is a valid answer.
<process> is the process name you assigned (e.g. "Procure to Pay"). Use null for a field you cannot fill.`;

type Extracted = { answers?: Record<string, unknown>; fit?: unknown; solution?: unknown };

async function runExtraction(transcript: { role: string; text: string }[]): Promise<Extracted> {
  if (config.mode !== "direct") return {};
  const client = new OpenAI({ apiKey: config.llm.apiKey, baseURL: config.llm.baseUrl });
  const convo = transcript.map((t) => `${t.role.toUpperCase()}: ${t.text}`).join("\n");
  // Reasoning off: this is a JSON extraction task where reasoning models otherwise spend
  // the whole budget thinking and return no content. `reasoning` is an OpenRouter extension.
  const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & { reasoning?: { enabled: boolean } } = {
    model: config.llm.model,
    max_tokens: 900,
    messages: [
      { role: "system", content: EXTRACT_PROMPT },
      { role: "user", content: `Transcript:\n${convo}\n\nReturn the JSON now.` },
    ],
  };
  if (config.llm.disableReasoning) params.reasoning = { enabled: false };
  const res = await client.chat.completions.create(params);
  const usage = res.usage;
  if (usage) console.log(`[capture] extraction tokens: ${usage.total_tokens} (prompt ${usage.prompt_tokens})`);
  const raw = res.choices?.[0]?.message?.content ?? "";
  const json = raw.replace(/```json\s*|\s*```/g, "").trim();
  const start = json.indexOf("{");
  const end = json.lastIndexOf("}");
  if (start < 0 || end < 0) return {};
  try {
    return JSON.parse(json.slice(start, end + 1)) as Extracted;
  } catch {
    return {};
  }
}

export type CaptureOpts = { sessionId: string; startedAt: string; completed: boolean };

/** Build the full output-schema payload for a session. */
export async function capture(messages: Msg[], opts: CaptureOpts): Promise<Record<string, unknown>> {
  const transcript = readableTranscript(messages);
  const contact = extractContact(messages);
  let extracted: Extracted = {};
  try {
    extracted = await runExtraction(transcript);
  } catch (err) {
    console.error(`[capture] extraction failed: ${(err as Error).message}`);
  }

  // Deterministic floor: even if extraction returns nothing, keep the problem (first user turn).
  const answers = (extracted.answers as Record<string, unknown>) ?? {};
  if (!answers["p0.problem"]) {
    const firstUser = transcript.find((t) => t.role === "user");
    if (firstUser) answers["p0.problem"] = { value: firstUser.text, mri: { layer: "opportunity", sub: "Pain Points" } };
  }

  const turns = messages.filter((m) => m.role === "user").length;
  return {
    session_id: opts.sessionId,
    started_at: opts.startedAt,
    ended_at: new Date().toISOString(),
    turns,
    completed: opts.completed,
    source: "hero_chat",
    answers,
    fit: extracted.fit ?? null,
    solution: extracted.solution ?? null,
    contact: contact ?? { name: null, email: null, company: null, phone: null, consent: false },
    transcript,
  };
}
