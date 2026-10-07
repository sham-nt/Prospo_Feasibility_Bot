# Captured fields and MRI tags

Each row is one captured field. `id` is the key in the output JSON; `mri` is where it lands
in the full MRI workbook. The model assigns the `mri` tag as it captures the answer — never
derive tags in a later pass.

`<process>` means the process name assigned to `p0.process` (e.g. "Procure to Pay"). Fields
tagged `business / <process>` all share whatever process was located in Stage 1.

## Stage 0–1 — the problem and where it lives

| id | What it captures | mri |
|---|---|---|
| `p0.problem` | The problem in the visitor's own words | opportunity / Pain Points |
| `p0.process` | Which process from the map (model-assigned, not asked) | business / `<process>` |
| `p0.function` | The parent function (derived) | business / `<process>` |
| `p0.trigger` | What starts this work, if it emerges | business / `<process>` |

## Stage 2 — size

| id | What it captures | mri |
|---|---|---|
| `p0.volume` | How many, how often — a rough number is fine | business / `<process>` |
| `p0.effort` | Time it takes, or how many people | opportunity / Bottlenecks |
| `p0.cost` | Cost or value at stake, if offered | opportunity / Bottlenecks |
| `p0.pain` | What goes wrong — errors, delays, rework | opportunity / Bottlenecks |

**Ask for one of volume or effort, not all four.** Take whichever the visitor can answer.

## Stage 3 — current handling

| id | What it captures | mri |
|---|---|---|
| `p0.who` | Who does the work today | business / `<process>` |
| `p0.systems` | Systems, spreadsheets, email, paper, WhatsApp | enterprise / Systems |
| `p0.data` | Where the information lives and whether it is reliable | enterprise / Data |
| `p0.judgement` | Whether a person must decide, and on what basis | opportunity / Constraints |
| `p0.tried` | Anything already tried, including AI | opportunity / Readiness |

## Stage 5–6 — outcome

| id | What it captures | mri |
|---|---|---|
| `p0.fit` | `good` · `partial` · `poor` — see the AI fit test | opportunity / AI Opportunities |
| `p0.solution` | The candidate solution, in plain language | opportunity / AI Opportunities |
| `p0.caveat` | What we would need to check | opportunity / Readiness |
| `p0.name` `p0.email` `p0.company` `p0.phone` | Contact (phone optional) | not MRI-tagged |
| `p0.consent` | Explicit consent to be contacted | not MRI-tagged |
