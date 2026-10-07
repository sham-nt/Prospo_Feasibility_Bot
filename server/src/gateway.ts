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

/**
 * MOCK gateway: emit canned OpenUI Lang as an OpenAI Chat Completions SSE stream.
 * This proves the frontend + transport + Pi persistence path before a real
 * THESYS_API_KEY exists. The assistant text is known up front, so the caller
 * can persist it without tee-ing the stream.
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

  // Break the OpenUI Lang into a few deltas to exercise streaming parse.
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

  return {
    assistantText: lang,
    response: new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
    }),
  };
}

/**
 * REAL gateway path (Phase 1 completion, once THESYS_API_KEY is set): call the
 * Thesys gateway with the OpenAI SDK and wrap it with @openuidev/server Autofix,
 * returning autofix.completions.stream(...).toResponse(). Left unimplemented
 * until a key is available so the spike stays runnable offline.
 */
export function realReplyUnavailable(): never {
  throw new Error(
    "Real gateway path not wired yet: set THESYS_API_KEY and implement the Autofix-wrapped call. Running in mock mode.",
  );
}

export const gatewayMode = () => (config.mockGateway ? "mock" : "real");
