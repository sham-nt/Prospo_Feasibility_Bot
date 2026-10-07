import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import OpenAI from "openai";
import { config } from "./config";
import { MRI_SYSTEM } from "./mri-prompt";

type ChatMsg = { role: string; content?: unknown };
type ReplyOpts = {
  messages: ChatMsg[];
  signal: AbortSignal;
  onComplete?: (assistantText: string) => void;
  /** A turn-discipline instruction injected as a final system message (see index.ts). */
  nudge?: string;
};

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
  // max_tokens must leave room for the UI Lang AFTER any reasoning tokens: reasoning
  // models that run out of budget mid-think return empty content and render nothing.
  // `reasoning` is an OpenRouter extension, not in the OpenAI SDK types.
  const params: OpenAI.Chat.ChatCompletionCreateParamsStreaming & { reasoning?: { enabled: boolean } } = {
    model: opts.model,
    messages: opts.messages as never,
    stream: true,
    max_tokens: config.llm.maxTokens,
    stream_options: { include_usage: true }, // final chunk carries token usage for cost logging
  };
  if (config.llm.disableReasoning) params.reasoning = { enabled: false };
  const upstream = await opts.client.chat.completions.create(params, { signal: opts.signal });

  const enc = new TextEncoder();
  let full = "";
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of upstream) {
          const piece = part.choices?.[0]?.delta?.content ?? "";
          if (piece) full += piece;
          if (part.usage) console.log(`[llm] turn tokens: ${part.usage.total_tokens} (prompt ${part.usage.prompt_tokens})`);
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
  // Base OpenUI prompt first (format + component signatures), MRI spec last so the
  // task rules are the freshest context the model sees.
  const system = `${baseOpenUIPrompt()}\n\n${MRI_SYSTEM}`;
  const messages = [
    { role: "system", content: system },
    ...opts.messages.map((m) => ({ role: m.role, content: toText(m.content) })),
    ...(opts.nudge ? [{ role: "system", content: opts.nudge }] : []),
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
    "root = Card([header, note, said])",
    'header = CardHeader("12C AI assistant", "Business MRI · Phase 0")',
    'note = Callout("neutral", "Offline mode", "The live agent is unavailable right now. Add an OpenRouter key or credits to start a real session.")',
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

/** A single-card notice streamed as an OpenAI SSE stream (e.g. a rate-limit message). */
export function noticeReply(title: string, body: string): Response {
  const lang = [
    "root = Card([header, note])",
    `header = CardHeader("${forLang(title)}")`,
    `note = Callout("neutral", "${forLang(title)}", "${forLang(body)}")`,
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
  return sseResponse(stream);
}

export const llmMode = () => config.mode;
