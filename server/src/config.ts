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

  mode: resolveMode(),

  // The external LLM: any OpenAI-compatible endpoint (OpenRouter by default).
  llm: {
    baseUrl: env("LLM_BASE_URL", "https://openrouter.ai/api/v1"),
    apiKey: llmApiKey,
    model: env("LLM_MODEL", "openai/gpt-4o-mini"),
  },
};
