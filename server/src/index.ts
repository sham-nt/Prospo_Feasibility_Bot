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

/**
 * Turn-discipline backstop to the prompt: a short chat is the goal. The skill says
 * propose by the 8th exchange and never run past 10. We nudge in code so a chatty model
 * cannot interrogate the visitor forever. Returns a system instruction, or "".
 */
function turnNudge(messages: ChatMessage[]): string {
  const userTurns = messages.filter((m) => m?.role === "user").length;
  if (userTurns >= 10) {
    return "This is the final exchange. Do not ask another question. Give your fit verdict and either the plain-language solution with the human-in-the-loop gate, or an honest 'AI is not the first fix here', then render the contact Form now.";
  }
  if (userTurns >= 8) {
    return "You are at the eighth exchange. Stop gathering detail and move to your proposal now: give the fit verdict and name the candidate solution (or say honestly that AI does not fit), then capture contact details. Do not ask another discovery question.";
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
        nudge: turnNudge(body.messages ?? []),
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
