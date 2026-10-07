import "dotenv/config";

const env = (k: string, d = "") => process.env[k]?.trim() ?? d;

const llmApiKey = env("LLM_API_KEY");

export type LlmMode = "direct" | "mock";

/**
 * - direct: your own OpenAI-compatible provider (OpenRouter, OpenAI, …) with a
 *   locally generated OpenUI Lang prompt. The LLM is fully external; nothing is
 *   hosted by Thesys.
 * - mock: canned OpenUI Lang, no network.
 * "auto" picks direct if an LLM key is set, else mock.
 */
function resolveMode(): LlmMode {
  const explicit = env("LLM_MODE", "auto").toLowerCase();
  if (explicit === "direct" || explicit === "mock") return explicit;
  return llmApiKey ? "direct" : "mock";
}

export const config = {
  port: Number(env("PORT", "8787")),
  corsOrigin: env("CORS_ORIGIN", "http://localhost:5173"),
  dbPath: env("DB_PATH", "./data/mri.sqlite"),

  // An open session idle longer than this is finalized as abandoned on the next sweep.
  abandonAfterMs: Number(env("ABANDON_AFTER_MINUTES", "30")) * 60_000,
  // Abuse cap: new sessions allowed per client per day (in-memory; resets on restart).
  sessionsPerIpPerDay: Number(env("SESSIONS_PER_IP_PER_DAY", "50")),

  mode: resolveMode(),

  // The external LLM: any OpenAI-compatible endpoint (OpenRouter by default).
  llm: {
    baseUrl: env("LLM_BASE_URL", "https://openrouter.ai/api/v1"),
    apiKey: llmApiKey,
    model: env("LLM_MODEL", "openai/gpt-4o-mini"),
    // Cap per reply. Must cover reasoning tokens + the UI Lang, or reasoning models
    // can finish before emitting any content. A contact-form turn needs ~600 Lang tokens.
    maxTokens: Number(env("LLM_MAX_TOKENS", "1500")),
    // Many free models reason first; on some tasks they spend the whole budget thinking
    // and emit nothing. OpenRouter's `reasoning: { enabled: false }` makes them answer
    // directly — faster and more reliable for both the UI Lang and the JSON extraction.
    disableReasoning: env("LLM_DISABLE_REASONING", "true") !== "false",
    // The end-of-session JSON extraction can use a different (more reliable) model than the
    // chat. Defaults to the chat model. Set e.g. google/gemini-2.5-flash for clean JSON.
    extractModel: env("LLM_EXTRACT_MODEL") || env("LLM_MODEL", "openai/gpt-4o-mini"),
  },
};
