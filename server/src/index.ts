import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config";
import { directReply, llmMode, mockReply, noticeReply } from "./llm";
import { getState, initHarness, recordTurn } from "./harness";
import { capture, isSubmission } from "./capture";
import { finalizeSession, getSession, initStore, listSessions, listStaleOpen, touchSession } from "./store";

await initHarness();
initStore();

type ChatMessage = { role: string; content?: unknown };

/** Build the output-schema payload for a session and persist it. Runs off the hot path. */
async function finalize(
  sessionId: string,
  messages: ChatMessage[],
  startedAt: string,
  status: "completed" | "abandoned",
): Promise<void> {
  try {
    const payload = await capture(messages, { sessionId, startedAt, completed: status === "completed" });
    finalizeSession(sessionId, payload, status);
    const fit = (payload.fit as { verdict?: string } | null)?.verdict ?? "-";
    console.log(`[capture] finalized ${sessionId} (${status}, fit=${fit})`);
  } catch (err) {
    console.error(`[capture] finalize ${sessionId} failed: ${(err as Error).message}`);
  }
}

/** On startup, finalize sessions left open past the idle window as abandoned (still a lead). */
async function sweepAbandoned(): Promise<void> {
  const stale = listStaleOpen(config.abandonAfterMs);
  for (const row of stale) {
    const msgs = JSON.parse(row.draft ?? "[]") as ChatMessage[];
    await finalize(row.session_id, msgs, row.created_at, "abandoned");
  }
  if (stale.length) console.log(`[sweep] finalized ${stale.length} abandoned session(s)`);
}
await sweepAbandoned();

const app = new Hono();

app.use("/api/*", cors({ origin: config.corsOrigin, allowMethods: ["GET", "POST", "OPTIONS"] }));

app.get("/health", (c) => c.json({ ok: true, gateway: llmMode() }));

app.get("/api/debug/state", async (c) => c.json(await getState()));

app.get("/api/debug/sessions", (c) => c.json({ sessions: listSessions() }));

app.get("/api/debug/sessions/:id", (c) => {
  const row = getSession(c.req.param("id"));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({ ...row, payload: row.payload ? JSON.parse(row.payload) : null, draft: undefined });
});

/** In-memory per-client/day cap on NEW sessions. Resets on restart; a Postgres or
 *  Redis counter would replace it in production. Returns true when the client is over. */
const dailyHits = new Map<string, { day: string; count: number }>();
function overDailyCap(clientKey: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const rec = dailyHits.get(clientKey);
  if (!rec || rec.day !== day) {
    dailyHits.set(clientKey, { day, count: 1 });
    return false;
  }
  rec.count += 1;
  return rec.count > config.sessionsPerIpPerDay;
}

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
  const body = (await c.req.json().catch(() => ({}))) as { messages?: ChatMessage[]; threadId?: string };
  const messages = body.messages ?? [];
  const sessionId = body.threadId?.trim() || "anonymous";
  const userText = lastUserText(messages);

  // Abuse cap: only count the first turn of a genuinely new session.
  const existing = getSession(sessionId);
  if (!existing) {
    const clientKey = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (overDailyCap(clientKey)) {
      return noticeReply(
        "Daily limit reached",
        "You have started a lot of sessions today. Please come back tomorrow, or email the 12C team to carry on.",
      );
    }
  }

  await recordTurn("user", userText);
  // Persist the running transcript so an abandoned chat still has something to extract.
  touchSession(sessionId, messages);
  const startedAt = existing?.created_at ?? new Date().toISOString();

  // A contact-form submission ends the session: capture + persist in the background so it
  // does not delay the assistant's confirmation reply.
  if (isSubmission(messages)) void finalize(sessionId, messages, startedAt, "completed");

  if (config.mode === "direct") {
    try {
      return await directReply({
        messages,
        signal: c.req.raw.signal,
        nudge: turnNudge(messages),
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

// Abandon beacon / explicit end. The frontend can POST here on unload; the startup sweep
// is the backstop for sessions that never send it.
app.post("/api/mri-chat/finalize", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { threadId?: string; completed?: boolean };
  const sessionId = body.threadId?.trim();
  if (!sessionId) return c.json({ error: "threadId required" }, 400);
  const row = getSession(sessionId);
  if (!row || row.status !== "open") return c.json({ ok: true, already: row?.status ?? "unknown" });
  const msgs = JSON.parse(row.draft ?? "[]") as ChatMessage[];
  await finalize(sessionId, msgs, row.created_at, body.completed ? "completed" : "abandoned");
  return c.json({ ok: true });
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[server] http://localhost:${info.port}  (llm: ${llmMode()})`);
});
