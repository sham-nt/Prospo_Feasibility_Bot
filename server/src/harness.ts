import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { createRegistry, defineDoc, Harness } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "./config";

// Pi Durable owns the durable, resumable conversation: every turn is appended to a
// SQLite-backed transcript that survives a server restart (see `harness.resume()`),
// which is the durability guarantee this layer exists to demonstrate. The structured
// capture that becomes a lead lives separately in the sessions store (see store.ts);
// the two are intentionally distinct — one is the raw conversation, one is the payload.

/** Chord context used for every durable call. BACKGROUND_CONTEXT never cancels. */
export const ctx = BACKGROUND_CONTEXT;

/** A running count of recorded turns, committed alongside the durable transcript. */
const Stats = defineDoc<{ messages: number }>({
  kind: "app.stats",
  version: 1,
  scope: "conversation",
  history: "latest",
  fork: "initial",
  initial: () => ({ messages: 0 }),
});

type Conversation = Awaited<ReturnType<Harness["root"]>>;

let harness: Harness;
let root: Conversation;

export async function initHarness(): Promise<void> {
  const dbPath = resolve(process.cwd(), config.dbPath);
  mkdirSync(dirname(dbPath), { recursive: true });

  const models = createModels(); // no provider: this layer records turns, the LLM call lives in llm.ts
  const registry = createRegistry();
  const storage = await openNodeSqliteStorage(dbPath);

  harness = await Harness.open(storage, { models, registry }, ctx);
  root = await harness.root(ctx); // same root conversation across restarts
  harness.resume(); // pick up anything a previous process left unfinished

  console.log(`[harness] opened ${dbPath}`);
}

/** Append one message to the durable transcript and bump the turn counter. */
export async function recordTurn(role: "user" | "assistant", text: string): Promise<void> {
  await root.submit({ type: "write", entry: { kind: "app.msg", data: { role, text } } }, ctx);
  await root.commit(async (tx) => {
    (await tx.doc(Stats, root.id)).messages += 1;
  }, ctx);
}

export async function getState(): Promise<{ messages: number; usage: unknown }> {
  const stats = await harness.snapshot(Stats, root.id, ctx);
  const usage = await harness.usage(ctx);
  return { messages: stats?.messages ?? 0, usage };
}

export async function closeHarness(): Promise<void> {
  await harness?.close(ctx);
}
