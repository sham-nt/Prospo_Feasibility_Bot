import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config";
import { directReply, llmMode, mockReply } from "./llm";
import { getState, initHarness, recordTurn } from "./harness";

await initHarness();

const app = new Hono();

app.use("/api/*", cors({ origin: config.corsOrigin, allowMethods: ["GET", "POST", "OPTIONS"] }));

app.get("/health", (c) => c.json({ ok: true, gateway: llmMode() }));

app.get("/api/debug/state", async (c) => c.json(await getState()));

type ChatMessage = { role: string; content?: unknown };

function lastUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user") return typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
  }
  return "";
}

app.post("/api/mri-chat", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { messages?: ChatMessage[] };
  const userText = lastUserText(body.messages ?? []);

  await recordTurn("user", userText);

  if (config.mode === "direct") {
    try {
      return await directReply({
        messages: body.messages ?? [],
        signal: c.req.raw.signal,
        onComplete: (text: string) => void recordTurn("assistant", text).catch(() => {}),
      });
    } catch (err) {
      console.error(`[llm] direct call failed, falling back to mock: ${(err as Error).message}`);
      // fall through to mock below
    }
  }

  const { assistantText, response } = mockReply(userText);
  await recordTurn("assistant", assistantText);
  return response;
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[server] http://localhost:${info.port}  (llm: ${llmMode()})`);
});
