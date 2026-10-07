import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { config } from "./config";

/**
 * The sessions store. A dedicated SQLite file, isolated from Pi Durable's own database,
 * shaped so a later port to 12C's Postgres `enquiries` table + `payload jsonb` column is
 * a rename, not a rewrite: name, company, email, message, source, status, created_at,
 * plus the full output-schema JSON in `payload`.
 */

export type SessionRow = {
  session_id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  message: string | null;
  source: string;
  status: "open" | "completed" | "abandoned";
  completed: number;
  created_at: string;
  updated_at: string;
  payload: string | null; // JSON (output schema) once finalized
  draft: string | null; // JSON transcript while the session is still open
};

let db: DatabaseSync;

export function initStore(): void {
  const sessionsPath = join(dirname(resolve(process.cwd(), config.dbPath)), "sessions.sqlite");
  mkdirSync(dirname(sessionsPath), { recursive: true });
  db = new DatabaseSync(sessionsPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      name       TEXT,
      company    TEXT,
      email      TEXT,
      message    TEXT,
      source     TEXT NOT NULL DEFAULT 'hero_chat',
      status     TEXT NOT NULL DEFAULT 'open',
      completed  INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload    TEXT,
      draft      TEXT
    );
  `);
  console.log(`[store] opened ${sessionsPath}`);
}

/** Upsert the running transcript for a session so an abandoned chat still has data to extract. */
export function touchSession(sessionId: string, draftMessages: unknown): void {
  const now = new Date().toISOString();
  const draft = JSON.stringify(draftMessages ?? []);
  db.prepare(
    `INSERT INTO sessions (session_id, created_at, updated_at, draft)
       VALUES (?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET updated_at = excluded.updated_at, draft = excluded.draft
       WHERE sessions.status = 'open'`,
  ).run(sessionId, now, now, draft);
}

/** Write the finalized output-schema payload and lift the contact fields into columns. */
export function finalizeSession(
  sessionId: string,
  payload: Record<string, unknown>,
  status: "completed" | "abandoned",
): void {
  const now = new Date().toISOString();
  const contact = (payload.contact ?? {}) as Record<string, unknown>;
  const answers = (payload.answers ?? {}) as Record<string, { value?: unknown }>;
  const message = (answers["p0.problem"]?.value as string) ?? null;
  db.prepare(
    `INSERT INTO sessions (session_id, name, company, email, message, source, status, completed, created_at, updated_at, payload)
       VALUES (?, ?, ?, ?, ?, 'hero_chat', ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       name = excluded.name, company = excluded.company, email = excluded.email,
       message = excluded.message, status = excluded.status, completed = excluded.completed,
       updated_at = excluded.updated_at, payload = excluded.payload`,
  ).run(
    sessionId,
    (contact.name as string) ?? null,
    (contact.company as string) ?? null,
    (contact.email as string) ?? null,
    message,
    status,
    status === "completed" ? 1 : 0,
    now,
    now,
    JSON.stringify(payload),
  );
}

export function getSession(sessionId: string): SessionRow | undefined {
  return db.prepare(`SELECT * FROM sessions WHERE session_id = ?`).get(sessionId) as SessionRow | undefined;
}

export function listSessions(limit = 50): SessionRow[] {
  return db
    .prepare(`SELECT session_id, name, company, email, message, status, completed, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT ?`)
    .all(limit) as SessionRow[];
}

/** Like listSessions but includes the payload JSON — used by the admin/observability view. */
export function listSessionsFull(limit = 200): SessionRow[] {
  return db
    .prepare(`SELECT session_id, name, company, email, message, source, status, completed, created_at, updated_at, payload FROM sessions ORDER BY updated_at DESC LIMIT ?`)
    .all(limit) as SessionRow[];
}

/** Open sessions idle longer than `olderThanMs` — candidates for abandon finalization. */
export function listStaleOpen(olderThanMs: number): SessionRow[] {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  return db
    .prepare(`SELECT * FROM sessions WHERE status = 'open' AND updated_at < ?`)
    .all(cutoff) as SessionRow[];
}

export function closeStore(): void {
  db?.close();
}
