# Solution pattern library

Map the problem shape to a named capability. These are the patterns 12C builds; the chat picks
the closest and describes it in the visitor's language. The `pattern` value in the output JSON is
the snake_case key.

**Always pair the pattern with the gate: a person stays in the loop where the risk is.** That is the
12C position and it should appear in the proposal sentence.

| Pattern (`pattern`) | Problem shape | How to describe it |
|---|---|---|
| `document_extraction` | Information arrives as PDFs, scans, emails and has to be keyed in | "Read the documents as they arrive and put the data where it needs to go, flagging the ones it is unsure about" |
| `triage_and_routing` | Things arrive in a shared inbox or queue and someone decides where each goes | "Sort what comes in, decide what each one is, and route it with a reason attached" |
| `drafting` | Someone writes the same kind of document repeatedly from known inputs | "Draft it from the information you already hold, for a person to check and send" |
| `qa_over_documents` | Answers exist in contracts, manuals or policies and people hunt for them | "Answer questions from your own documents, with a citation for every answer" |
| `reconciliation_and_matching` | Two records should agree and someone checks them line by line | "Match the two sides, settle the ones that agree, and show only the exceptions" |
| `exception_monitoring` | Problems are found late, by someone noticing | "Watch the data continuously and raise the exception early, with the evidence" |
| `planning_support` | Someone builds a schedule or forecast in a spreadsheet by feel | "Produce the first version of the plan for a planner to adjust, with the assumptions visible" |

## Using a pattern in the proposal

The proposal sentence combines three things: the named capability in the visitor's own words, plus
the human-in-the-loop gate. For example, for a high-volume invoice-keying problem:

> You get a few hundred supplier invoices a month and someone keys them in by hand. The pattern here
> is to read each invoice as it arrives and put the figures where they need to go, flagging anything it
> is unsure about so a person checks those rather than all of them.

The gate ("flagging anything it is unsure about so a person checks those") is not optional decoration —
it is the position. Never describe a pattern as fully autonomous.
