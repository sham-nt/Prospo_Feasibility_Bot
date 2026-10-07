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
          <span className="mri-logo">12C</span>
          <span className="mri-brand-sep">/</span>
          <span className="mri-brand-sub">Business MRI</span>
          <span className="mri-brand-phase">Phase&nbsp;0</span>
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
