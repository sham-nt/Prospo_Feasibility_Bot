/**
 * A tiny built-in observability view for the collected sessions — a plain, dark,
 * server-rendered set of pages at /admin. No build step, no auth (local dev only):
 *   GET /admin                 -> summary stats + a table of every session
 *   GET /admin/sessions/:id     -> one session in full (fit, signals, answers, transcript)
 *
 * It reads straight from the sessions store, so it reflects exactly what would land
 * in 12C's enquiries table. Keep it dependency-free: it returns HTML strings.
 */
import type { SessionRow } from "./store";

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const trunc = (s: unknown, n: number): string => {
  const t = String(s ?? "");
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

type Payload = {
  turns?: number;
  answers?: Record<string, { value?: unknown; mri?: { layer?: string; sub?: string } }>;
  fit?: { verdict?: string; signals?: Record<string, string> } | null;
  solution?: { pattern?: string; summary?: string; caveat?: string } | null;
  contact?: { name?: string; email?: string; company?: string; phone?: string; consent?: boolean };
  transcript?: { role?: string; text?: string }[];
};

const parsePayload = (row: SessionRow): Payload => {
  try {
    return row.payload ? (JSON.parse(row.payload) as Payload) : {};
  } catch {
    return {};
  }
};

const STYLE = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #050505; color: #f5f5f0;
    font-family: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    background-image: radial-gradient(1200px 500px at 50% -200px, rgba(16,163,127,0.16), transparent 70%);
    background-repeat: no-repeat; }
  a { color: #2ee6b0; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .wrap { max-width: 1200px; margin: 0 auto; padding: 32px 24px 64px; }
  h1 { font-size: 22px; font-weight: 650; letter-spacing: -0.01em; margin: 0; }
  .sub { color: #b3b3ad; font-size: 13px; margin: 4px 0 0; }
  .mark { width: 18px; height: 18px; border-radius: 50%; display: inline-block; vertical-align: -3px; margin-right: 8px;
    background: radial-gradient(circle at 32% 30%, #5ef0c4, #10a37f 45%, #0a5f4a); box-shadow: 0 0 10px rgba(16,163,127,0.6); }
  .cards { display: flex; flex-wrap: wrap; gap: 12px; margin: 22px 0 26px; }
  .card { background: #0e100f; border: 1px solid rgba(245,245,240,0.1); border-radius: 14px; padding: 14px 18px; min-width: 120px; }
  .card .n { font-size: 24px; font-weight: 650; }
  .card .l { font-size: 12px; color: #b3b3ad; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid rgba(245,245,240,0.08); vertical-align: middle; white-space: nowrap; }
  .prob-txt { display: inline-block; max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; color: #b3b3ad; }
  th { color: #b3b3ad; font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }
  tr:hover td { background: rgba(245,245,240,0.02); }
  .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; border: 1px solid; }
  .b-completed { color: #2ee6b0; border-color: rgba(46,230,176,0.4); background: rgba(16,163,127,0.12); }
  .b-abandoned { color: #f0b24a; border-color: rgba(240,178,74,0.4); background: rgba(240,178,74,0.1); }
  .b-open { color: #b3b3ad; border-color: rgba(245,245,240,0.2); }
  .fit-good { color: #2ee6b0; } .fit-partial { color: #f0b24a; } .fit-poor { color: #f06a5a; }
  .muted { color: #7a7a73; }
  .panel { background: #0e100f; border: 1px solid rgba(245,245,240,0.1); border-radius: 14px; padding: 18px 20px; margin: 16px 0; }
  .panel h2 { font-size: 14px; margin: 0 0 12px; color: #f5f5f0; }
  .kv { display: grid; grid-template-columns: 160px 1fr; gap: 6px 16px; font-size: 13px; }
  .kv dt { color: #b3b3ad; } .kv dd { margin: 0; }
  .sig { display: inline-block; font-size: 12px; padding: 2px 9px; border-radius: 999px; margin: 0 6px 6px 0; border: 1px solid rgba(245,245,240,0.12); }
  .sig-yes { color: #2ee6b0; border-color: rgba(46,230,176,0.4); } .sig-no { color: #f06a5a; } .sig-unknown { color: #7a7a73; }
  .msg { padding: 8px 0; border-bottom: 1px solid rgba(245,245,240,0.06); font-size: 13px; line-height: 1.5; }
  .msg .role { color: #7a7a73; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .msg.user .role { color: #2ee6b0; }
  code { background: rgba(245,245,240,0.06); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
`;

const page = (title: string, body: string): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title><style>${STYLE}</style></head><body><div class="wrap">${body}</div></body></html>`;

const fitClass = (v?: string): string => (v === "good" ? "fit-good" : v === "partial" ? "fit-partial" : v === "poor" ? "fit-poor" : "muted");
const timeShort = (iso?: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(+d) ? esc(iso) : d.toLocaleString("en-GB", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/** The index: summary stat cards + a table of every session. */
export function renderSessionsPage(rows: SessionRow[]): string {
  const total = rows.length;
  const by = (s: string) => rows.filter((r) => r.status === s).length;
  const fitCount = (v: string) => rows.filter((r) => parsePayload(r).fit?.verdict === v).length;
  const completed = by("completed");

  const cards = [
    { n: total, l: "Sessions" },
    { n: completed, l: "Completed" },
    { n: by("abandoned"), l: "Abandoned" },
    { n: by("open"), l: "Open" },
    { n: total ? Math.round((completed / total) * 100) + "%" : "–", l: "Completion" },
    { n: fitCount("good"), l: "Good fit" },
    { n: fitCount("partial"), l: "Partial" },
    { n: fitCount("poor"), l: "Poor" },
  ]
    .map((c) => `<div class="card"><div class="n">${esc(c.n)}</div><div class="l">${esc(c.l)}</div></div>`)
    .join("");

  const body = rows.length
    ? rows
        .map((r) => {
          const p = parsePayload(r);
          const statusClass = r.status === "completed" ? "b-completed" : r.status === "abandoned" ? "b-abandoned" : "b-open";
          return `<tr>
            <td class="muted">${timeShort(r.updated_at)}</td>
            <td><span class="badge ${statusClass}">${esc(r.status)}</span></td>
            <td>${esc(r.name) || '<span class="muted">—</span>'}</td>
            <td>${esc(r.company) || '<span class="muted">—</span>'}</td>
            <td>${esc(r.email) || '<span class="muted">—</span>'}</td>
            <td class="${fitClass(p.fit?.verdict)}">${esc(p.fit?.verdict ?? "–")}</td>
            <td>${esc(p.solution?.pattern ?? "–")}</td>
            <td>${esc(p.turns ?? "")}</td>
            <td>${r.message ? `<span class="prob-txt" title="${esc(r.message)}">${esc(trunc(r.message, 120))}</span>` : '<span class="muted">—</span>'}</td>
            <td><a href="/admin/sessions/${encodeURIComponent(r.session_id)}">view</a></td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="10" class="muted">No sessions yet. Start a chat at the app and submit or abandon it.</td></tr>`;

  return page(
    "Prospo sessions",
    `<h1><span class="mark"></span>Prospo — collected sessions</h1>
     <p class="sub">What visitors told the agent, and how it scored them. Reads from the local sessions store.</p>
     <div class="cards">${cards}</div>
     <table>
       <thead><tr><th>Updated</th><th>Status</th><th>Name</th><th>Company</th><th>Email</th><th>Fit</th><th>Pattern</th><th>Turns</th><th>Problem</th><th></th></tr></thead>
       <tbody>${body}</tbody>
     </table>`,
  );
}

/** One session in full. */
export function renderSessionDetail(row: SessionRow): string {
  const p = parsePayload(row);
  const c = p.contact ?? {};
  const signals = p.fit?.signals ?? {};

  const sigRow = Object.keys(signals).length
    ? Object.entries(signals)
        .map(([k, v]) => `<span class="sig sig-${esc(v)}">${esc(k)}: ${esc(v)}</span>`)
        .join("")
    : '<span class="muted">no signals captured</span>';

  const answers = p.answers ?? {};
  const answerRows = Object.keys(answers).length
    ? Object.entries(answers)
        .map(
          ([id, a]) =>
            `<tr><td><code>${esc(id)}</code></td><td>${esc(a?.value)}</td><td class="muted">${esc(a?.mri?.layer ?? "")}${a?.mri?.sub ? " · " + esc(a.mri.sub) : ""}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="muted">no structured answers</td></tr>`;

  const transcript = (p.transcript ?? [])
    .map((m) => `<div class="msg ${m.role === "user" ? "user" : ""}"><div class="role">${esc(m.role)}</div>${esc(m.text)}</div>`)
    .join("");

  return page(
    `Session ${trunc(row.session_id, 8)}`,
    `<p class="sub"><a href="/admin">← all sessions</a></p>
     <h1><span class="mark"></span>${esc(c.name) || "Session"} ${c.company ? '<span class="muted">· ' + esc(c.company) + "</span>" : ""}</h1>
     <p class="sub">${esc(row.status)} · ${esc(p.turns ?? 0)} turns · <code>${esc(row.session_id)}</code></p>

     <div class="panel"><h2>Contact</h2><dl class="kv">
       <dt>Name</dt><dd>${esc(c.name) || '<span class="muted">—</span>'}</dd>
       <dt>Email</dt><dd>${esc(c.email) || '<span class="muted">—</span>'}</dd>
       <dt>Company</dt><dd>${esc(c.company) || '<span class="muted">—</span>'}</dd>
       <dt>Phone</dt><dd>${esc(c.phone) || '<span class="muted">—</span>'}</dd>
       <dt>Consent</dt><dd>${c.consent ? "yes" : '<span class="muted">no</span>'}</dd>
     </dl></div>

     <div class="panel"><h2>AI-fit</h2>
       <p>Verdict: <strong class="${fitClass(p.fit?.verdict)}">${esc(p.fit?.verdict ?? "–")}</strong></p>
       <div>${sigRow}</div>
     </div>

     <div class="panel"><h2>Proposed solution</h2><dl class="kv">
       <dt>Pattern</dt><dd>${esc(p.solution?.pattern ?? '<span class="muted">—</span>')}</dd>
       <dt>Summary</dt><dd>${esc(p.solution?.summary) || '<span class="muted">—</span>'}</dd>
       <dt>Caveat</dt><dd>${esc(p.solution?.caveat) || '<span class="muted">—</span>'}</dd>
     </dl></div>

     <div class="panel"><h2>Captured answers</h2>
       <table><thead><tr><th>Field</th><th>Value</th><th>MRI layer · sub</th></tr></thead><tbody>${answerRows}</tbody></table>
     </div>

     <div class="panel"><h2>Transcript</h2>${transcript || '<span class="muted">no transcript</span>'}</div>`,
  );
}
