# Output schema

The chat posts this once, at the end of the session. Field names match the captured-fields table.

## Rules for the developer
- **Every answer carries its own `mri` tag.** Do not derive tags later; the model assigns them as it captures.
- **`completed: false` when the visitor abandons. Post it anyway** — an abandoned session with three
  answers is still a lead and still tells us something.
- **Store the transcript.** It is how we improve the prompt, and it is the raw material for the real MRI.
  Do not store anything sensitive the visitor pasted.

## Shape

```json
{
  "session_id": "uuid",
  "started_at": "2026-10-05T09:14:22Z",
  "ended_at": "2026-10-05T09:19:40Z",
  "turns": 8,
  "completed": true,
  "source": "hero_chat",
  "answers": {
    "p0.problem": { "value": "…", "mri": { "layer": "opportunity", "sub": "Pain Points" } },
    "p0.process": { "value": "Procure to Pay", "mri": { "layer": "business", "sub": "Procure to Pay" } }
  },
  "fit": {
    "verdict": "good",
    "signals": {
      "repetition": "yes",
      "describable_judgement": "yes",
      "available_input": "yes",
      "tolerable_error": "unknown",
      "number_attached": "yes"
    }
  },
  "solution": {
    "pattern": "document_extraction",
    "summary": "…",
    "caveat": "…"
  },
  "contact": {
    "name": "…", "email": "…", "company": "…", "phone": null, "consent": true
  },
  "transcript": [
    { "role": "assistant", "text": "…" },
    { "role": "user", "text": "…" }
  ]
}
```

## Field notes

- `answers` is a map of `id` → `{ value, mri }`. Only include fields that were actually captured;
  a field the visitor never answered can be omitted or set to `null`.
- `fit.verdict` is one of `good` / `partial` / `poor`; each signal is `yes` / `no` / `unknown`.
- `solution.pattern` is a snake_case key from the solution pattern library (or `null` when fit is poor
  and no pattern applies). `summary` is the plain-language proposal; `caveat` is what we would need to check.
- `contact.phone` is optional (`null` when not given). `contact.consent` must be an explicit boolean.
- `transcript` is the ordered list of turns. Omit any sensitive content the visitor pasted.
