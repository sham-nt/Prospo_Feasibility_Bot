import { AgentInterface, fetchLLM, openAIAdapter, openAIMessageFormat } from "@openuidev/react-ui";
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";
import "@openuidev/react-ui/styles/index.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

// POSTs { threadId, runId, messages, tools, context } and parses the OpenAI
// Chat Completions stream the backend returns (mock OpenUI Lang for now).
const llm = fetchLLM({
  url: `${API_BASE_URL}/api/mri-chat`,
  streamAdapter: openAIAdapter(),
  messageFormat: openAIMessageFormat,
});

export function App() {
  return (
    <div style={{ height: "100vh" }}>
      <AgentInterface
        llm={llm}
        componentLibrary={openuiChatLibrary}
        agentName="12C AI assistant"
        theme={{ mode: "light" }}
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
    </div>
  );
}
