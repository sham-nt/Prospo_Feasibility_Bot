import { generateSystemPrompt } from "@openuidev/lang-core";
import OpenAI from "openai";
import { config } from "./config";

/** Strip characters that would break a double-quoted OpenUI Lang string literal. */
function forLang(text: string): string {
  return text.replace(/[\\"\r\n]+/g, " ").trim().slice(0, 300);
}

/** One OpenAI Chat Completions streaming chunk, as the frontend openAIAdapter() expects. */
function chunk(delta: Record<string, unknown>, finish: string | null): string {
  const payload = {
    id: "mock-mri",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: "mock",
    choices: [{ index: 0, delta, finish_reason: finish }],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

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
 * MOCK gateway: emit canned OpenUI Lang as an OpenAI Chat Completions SSE stream.
 * Used when there is no key, or as a fallback when the real gateway errors, so the
 * UI stays usable for demos. The assistant text is known up front.
 */
export function mockReply(userText: string): { assistantText: string; response: Response } {
  const said = userText ? `You said: ${forLang(userText)}` : "Tell me what is taking too much time or money.";
  // Chat library root is Card([...]); Stack is not in this subset.
  const lang = [
    "root = Card([header, intro, said])",
    'header = CardHeader("12C AI assistant", "Phase 0 · mock gateway")',
    'intro = TextContent("I am 12C\'s AI assistant. A few questions and I will tell you whether AI would actually help.")',
    `said = TextContent("${forLang(said)}")`,
  ].join("\n");

  const pieces: string[] = [];
  for (let i = 0; i < lang.length; i += 48) pieces.push(lang.slice(i, i + 48));

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode(chunk({ role: "assistant" }, null)));
      for (const piece of pieces) controller.enqueue(enc.encode(chunk({ content: piece }, null)));
      controller.enqueue(enc.encode(chunk({}, "stop")));
      controller.enqueue(enc.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return { assistantText: lang, response: sseResponse(stream) };
}

type ChatMsg = { role: string; content?: unknown };

/**
 * Minimal instructions for the real-gateway smoke test. Phase 2 replaces this
 * with the full MRI system prompt assembled from the business-mri-chat skill.
 */
const SPIKE_INSTRUCTIONS =
  "You are 12C's AI assistant. In one short sentence, say you can help work out whether AI would help with a business problem, then ask the visitor to describe one thing in their business that takes too much time or money. Plain English, short, no exclamation marks.";

/**
 * REAL gateway: call the Thesys gateway (OpenAI-compatible) with the Cloud chat
 * library system prompt and stream the OpenUI Lang back as OpenAI SSE. The gateway
 * generates and repairs the OpenUI Lang. Errors (e.g. billing) throw from the
 * create() call before streaming, so the caller can fall back to mock.
 */
export async function realReply(opts: {
  messages: ChatMsg[];
  signal: AbortSignal;
  onComplete?: (assistantText: string) => void;
}): Promise<Response> {
  const client = new OpenAI({ apiKey: config.thesysApiKey, baseURL: config.thesysBaseUrl });

  const system = String(generateSystemPrompt({ cloud: true, instructions: SPIKE_INSTRUCTIONS }));
  const messages = [
    { role: "system", content: system },
    ...opts.messages.map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? ""),
    })),
  ];

  // Throws here on auth/billing/model errors — caught by the caller.
  const upstream = await client.chat.completions.create(
    { model: config.model, messages: messages as never, stream: true },
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

export const gatewayMode = () => (config.mockGateway ? "mock" : "real");
