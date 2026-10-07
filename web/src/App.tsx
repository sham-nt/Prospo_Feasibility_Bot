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

// Dark theme in the aesthetic of ogha.ai: near-black canvas with an emerald/teal
// aurora, off-white text, one emerald accent, Bricolage Grotesque headings over
// Geist body, generous radii. Surfaces/backgrounds are driven in index.css.
const brandTheme = createTheme({
  fontBody: '"Geist", system-ui, sans-serif',
  fontHeading: '"Bricolage Grotesque", "Geist", system-ui, sans-serif',
  fontLabel: '"Geist", system-ui, sans-serif',
  fontNumbers: '"Geist", system-ui, sans-serif',

  // The accent is emerald; white pill CTAs are handled in index.css.
  interactiveAccentDefault: "#10a37f",
  interactiveAccentHover: "#13b88f",
  interactiveAccentPressed: "#0d8a6b",
  interactiveAccentDisabled: "#2a2f2c",
  textBrand: "#f5f5f0",
  textAccentPrimary: "#2ee6b0",
  textNeutralLink: "#2ee6b0",
  borderAccent: "#10a37f",
  borderAccentEmphasis: "#10a37f",
  borderAccentSelected: "#10a37f",

  textNeutralPrimary: "#f5f5f0",
  textNeutralSecondary: "#b3b3ad",
  textNeutralTertiary: "#7a7a73",
  borderDefault: "rgba(245, 245, 240, 0.12)",

  // User turn: an off-white pill, echoing ogha's white CTAs.
  chatUserResponseBg: "#f5f5f0",
  chatUserResponseText: "#050505",

  radiusM: "10px",
  radiusL: "14px",
  radiusXl: "18px",
});

export function App() {
  return (
    <div className="mri-app">
      <header className="mri-topbar">
        <div className="mri-brand">
          <span className="mri-logo-mark" aria-hidden="true" />
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
            <span className="mri-hero-badge">
              <span className="mri-hero-badge-dot" />
              AI readiness check
            </span>
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
            theme={{ mode: "dark", darkTheme: brandTheme }}
          />
        </div>
      </main>
    </div>
  );
}
