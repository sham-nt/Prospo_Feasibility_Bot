import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config";
import { gatewayMode, mockReply } from "./gateway";
import { getState, initHarness, recordTurn } from "./harness";

await initHarness();

const app = new Hono();

app.use("/api/*", cors({ origin: config.corsOrigin, allowMethods: ["GET", "POST", "OPTIONS"] }));

app.get("/health", (c) => c.json({ ok: true, gateway: gatewayMode() }));

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

  // Mock mode until THESYS_API_KEY is set (see gateway.ts realReply path).
  const { assistantText, response } = mockReply(userText);
  await recordTurn("assistant", assistantText);

  return response;
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[server] http://localhost:${info.port}  (gateway: ${gatewayMode()})`);
});
