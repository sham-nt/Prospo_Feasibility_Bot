import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import OpenAI from "openai";
import { config } from "./config";

type ChatMsg = { role: string; content?: unknown };
type ReplyOpts = { messages: ChatMsg[]; signal: AbortSignal; onComplete?: (assistantText: string) => void };

const toText = (c: unknown) => (typeof c === "string" ? c : JSON.stringify(c ?? ""));

function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}

/**
 * Spike-level MRI behaviour. Phase 2 replaces this with the full system prompt
 * assembled from the business-mri-chat skill.
 */
const MRI_INSTRUCTIONS =
  "You are 12C's AI assistant on the website. In one short sentence, say you can help work out whether AI would help with a business problem, then ask the visitor to describe one thing in their business that takes too much time or money. Render your reply as a Card with a CardHeader and short TextContent. Plain English, short, no exclamation marks.";

/** The base OpenUI Lang prompt generated from the chat library (see web/ `npm run gen:prompt`). */
let basePromptCache: string | null = null;
function baseOpenUIPrompt(): string {
  if (basePromptCache === null) {
    basePromptCache = readFileSync(resolve(process.cwd(), "prompts/openui-chat.system.txt"), "utf8");
  }
  return basePromptCache;
}

/** Stream an OpenAI-compatible chat.completions stream back to the client as SSE. */
async function streamChat(opts: {
  client: OpenAI;
  model: string;
  messages: { role: string; content: string }[];
  signal: AbortSignal;
  onComplete?: (text: string) => void;
}): Promise<Response> {
  // Throws here on auth/billing/model errors, before streaming — caller may fall back.
  const upstream = await opts.client.chat.completions.create(
    { model: opts.model, messages: opts.messages as never, stream: true },
    { signal: opts.signal },
  );

  const enc = new TextEncoder();
  let full = "";
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of upstream) {
          const piece = part.choices?.[0]?.delta?.content ?? "";
          if (piece) full += piece;
          controller.enqueue(enc.encode(`data: ${JSON.stringify(part)}\n\n`));
        }
        controller.enqueue(enc.encode("data: [DONE]\n\n"));
        controller.close();
        opts.onComplete?.(full);
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return sseResponse(stream);
}

/**
 * DIRECT: your own OpenAI-compatible provider (OpenRouter, OpenAI, …) with the
 * OpenUI Lang prompt generated locally. The LLM is fully external — your key,
 * your provider, no hosted gateway. The model emits OpenUI Lang; the frontend
 * renders it locally.
 */
export function directReply(opts: ReplyOpts): Promise<Response> {
  const client = new OpenAI({ apiKey: config.llm.apiKey, baseURL: config.llm.baseUrl });
  const system = `${MRI_INSTRUCTIONS}\n\n${baseOpenUIPrompt()}`;
  const messages = [
    { role: "system", content: system },
    ...opts.messages.map((m) => ({ role: m.role, content: toText(m.content) })),
  ];
  return streamChat({ client, model: config.llm.model, messages, signal: opts.signal, onComplete: opts.onComplete });
}

// ---- mock ----
function forLang(text: string): string {
  return text.replace(/[\\"\r\n]+/g, " ").trim().slice(0, 300);
}
function mockChunk(delta: Record<string, unknown>, finish: string | null): string {
  const payload = {
    id: "mock-mri",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "mock",
    choices: [{ index: 0, delta, finish_reason: finish }],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/** MOCK: canned OpenUI Lang as an OpenAI SSE stream. No network; used with no key or as a fallback. */
export function mockReply(userText: string): { assistantText: string; response: Response } {
  const said = userText ? `You said: ${forLang(userText)}` : "Tell me what is taking too much time or money.";
  const lang = [
    "root = Card([header, intro, said])",
    'header = CardHeader("12C AI assistant", "Phase 0 · mock")',
    'intro = TextContent("I am 12C\'s AI assistant. A few questions and I will tell you whether AI would actually help.")',
    `said = TextContent("${forLang(said)}")`,
  ].join("\n");

  const pieces: string[] = [];
  for (let i = 0; i < lang.length; i += 48) pieces.push(lang.slice(i, i + 48));

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode(mockChunk({ role: "assistant" }, null)));
      for (const piece of pieces) controller.enqueue(enc.encode(mockChunk({ content: piece }, null)));
      controller.enqueue(enc.encode(mockChunk({}, "stop")));
      controller.enqueue(enc.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return { assistantText: lang, response: sseResponse(stream) };
}

export const llmMode = () => config.mode;
