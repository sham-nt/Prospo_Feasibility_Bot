import { AgentInterface, createTheme, fetchLLM, openAIAdapter, openAIMessageFormat } from "@openuidev/react-ui";
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";
import "@openuidev/react-ui/styles/index.css";
import "./index.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

// Visitor-facing product name. The internal methodology ("Business MRI", "Phase 0")
// is never shown to the visitor — only the product name and the company. Change the
// product name here in one place. The company stays for the AI's required disclosure.
const PRODUCT = "Prospo";
const COMPANY = "12C";

// POSTs { threadId, runId, messages, tools, context } and parses the OpenAI
// Chat Completions stream the backend returns (OpenUI Lang).
const llm = fetchLLM({
  url: `${API_BASE_URL}/api/mri-chat`,
  streamAdapter: openAIAdapter(),
  messageFormat: openAIMessageFormat,
});

// Neutral-first theme in the spirit of shadcn/ui, Linear and Geist: a single
// zinc grey scale, near-black as the one "accent", hairline borders, modest radii.
// No decorative colour — semantic tones live only in callouts, muted.
const brandTheme = createTheme({
  fontBody: '"Inter", system-ui, sans-serif',
  fontHeading: '"Inter", system-ui, sans-serif',
  fontLabel: '"Inter", system-ui, sans-serif',
  fontNumbers: '"Inter", system-ui, sans-serif',

  // The primary/interactive colour is near-black, not a hue.
  interactiveAccentDefault: "#18181b",
  interactiveAccentHover: "#27272a",
  interactiveAccentPressed: "#09090b",
  interactiveAccentDisabled: "#d4d4d8",
  textBrand: "#18181b",
  textAccentPrimary: "#18181b",
  textNeutralLink: "#18181b",
  borderAccent: "#18181b",
  borderAccentEmphasis: "#18181b",
  borderAccentSelected: "#18181b",

  textNeutralPrimary: "#18181b",
  textNeutralSecondary: "#52525b",
  textNeutralTertiary: "#a1a1aa",
  borderDefault: "#e4e4e7",

  // User turn: a solid near-black bubble, the one dark element.
  chatUserResponseBg: "#18181b",
  chatUserResponseText: "#fafafa",

  radiusM: "8px",
  radiusL: "10px",
  radiusXl: "12px",
});

export function App() {
  return (
    <div className="mri-app">
      <header className="mri-topbar">
        <div className="mri-brand">
          <span className="mri-logo">{PRODUCT}</span>
          <span className="mri-brand-sub">by {COMPANY} Studios</span>
        </div>
        <div className="mri-status">
          <span className="mri-status-dot" />
          Online
        </div>
      </header>

      <main className="mri-stage">
        {/* Landing hero. Collapses once the first message is sent (see index.css :has()). */}
        <section className="mri-hero" aria-hidden="false">
          <div className="mri-hero-inner">
            <div className="mri-hero-mark" aria-hidden="true">
              <svg viewBox="0 0 48 48" width="40" height="40" fill="none">
                <rect x="1" y="1" width="46" height="46" rx="12" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
                <path d="M15 30c3-10 7-15 9-15s3 4 3 9c0 4 1 6 2 6s2-2 4-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="33" cy="17" r="2.2" fill="currentColor" />
              </svg>
            </div>
            <span className="mri-hero-badge">AI readiness check</span>
            <h1 className="mri-hero-title">See where AI actually fits in your business</h1>
            <p className="mri-hero-sub">
              Describe one task that eats time or money. In a few short questions {PRODUCT} tells you,
              honestly, whether AI would help and what {COMPANY} would build if it would.
            </p>
          </div>
        </section>

        <div className="mri-chat">
          {/* No starter chips: for this use case the visitor states their own problem; the
              hero copy and the agent's opening message do the nudging. */}
          <AgentInterface
            llm={llm}
            componentLibrary={openuiChatLibrary}
            agentName={PRODUCT}
            theme={{ mode: "light", lightTheme: brandTheme }}
          />
        </div>
      </main>
    </div>
  );
}
