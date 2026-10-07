import { AgentInterface, createTheme, fetchLLM, openAIAdapter, openAIMessageFormat } from "@openuidev/react-ui";
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";
import "@openuidev/react-ui/styles/index.css";
import "./index.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

// POSTs { threadId, runId, messages, tools, context } and parses the OpenAI
// Chat Completions stream the backend returns (OpenUI Lang).
const llm = fetchLLM({
  url: `${API_BASE_URL}/api/mri-chat`,
  streamAdapter: openAIAdapter(),
  messageFormat: openAIMessageFormat,
});

// 12C brand theme: a confident indigo accent, ink-dark user bubbles, Inter type,
// and a little more radius than the default for a sharper, modern feel.
const brandTheme = createTheme({
  fontBody: '"Inter", system-ui, sans-serif',
  fontHeading: '"Inter", system-ui, sans-serif',
  fontLabel: '"Inter", system-ui, sans-serif',
  fontNumbers: '"Inter", system-ui, sans-serif',

  interactiveAccentDefault: "oklch(0.52 0.20 274)",
  interactiveAccentHover: "oklch(0.47 0.20 274)",
  interactiveAccentPressed: "oklch(0.43 0.19 274)",
  borderAccent: "oklch(0.52 0.20 274 / 0.45)",
  borderAccentEmphasis: "oklch(0.52 0.20 274 / 0.85)",
  borderAccentSelected: "oklch(0.52 0.20 274 / 0.85)",
  textBrand: "oklch(0.50 0.20 274)",
  textAccentPrimary: "oklch(0.50 0.20 274)",
  textNeutralLink: "oklch(0.50 0.20 274)",

  textNeutralPrimary: "oklch(0.24 0.02 271)",
  textNeutralSecondary: "oklch(0.45 0.015 271)",
  textNeutralTertiary: "oklch(0.60 0.012 271)",
  borderDefault: "oklch(0.24 0.03 271 / 0.09)",

  // User turn: a dark ink bubble with light text — crisp and modern.
  chatUserResponseBg: "oklch(0.26 0.02 271)",
  chatUserResponseText: "oklch(0.98 0.003 271)",

  radiusM: "10px",
  radiusL: "14px",
  radiusXl: "18px",
});

export function App() {
  return (
    <div className="mri-app">
      <header className="mri-topbar">
        <div className="mri-brand">
          <span className="mri-logo">12C</span>
          <span className="mri-brand-divider" />
          <span className="mri-brand-sub">
            Business MRI <span className="mri-brand-phase">Phase 0</span>
          </span>
        </div>
        <div className="mri-status">
          <span className="mri-status-dot" />
          AI assistant
        </div>
      </header>

      <main className="mri-stage">
        <AgentInterface
          llm={llm}
          componentLibrary={openuiChatLibrary}
          agentName="12C AI assistant"
          theme={{ mode: "light", lightTheme: brandTheme }}
          starters={[
            {
              displayText: "We key in 400 supplier invoices a month by hand",
              prompt: "We key in about 400 supplier invoices a month by hand",
            },
            {
              displayText: "We want to use AI but are not sure where",
              prompt: "We want to use AI but are not sure where to start",
            },
          ]}
        />
      </main>
    </div>
  );
}
