import "dotenv/config";

const env = (k: string, d = "") => process.env[k]?.trim() ?? d;

const llmApiKey = env("LLM_API_KEY");
const thesysApiKey = env("THESYS_API_KEY");

export type GatewayMode = "direct" | "thesys" | "mock";

/**
 * - direct: your own OpenAI-compatible provider (OpenRouter, OpenAI, …) with a
 *   locally generated OpenUI Lang prompt. No Thesys, no hosted gateway.
 * - thesys: the Thesys hosted gateway (cloud-assembled prompt).
 * - mock: canned OpenUI Lang, no network.
 * "auto" picks direct if an LLM key is set, else thesys if a Thesys key is set, else mock.
 */
function resolveMode(): GatewayMode {
  const explicit = env("LLM_MODE", "auto").toLowerCase();
  if (explicit === "direct" || explicit === "thesys" || explicit === "mock") return explicit;
  if (llmApiKey) return "direct";
  if (thesysApiKey) return "thesys";
  return "mock";
}

export const config = {
  port: Number(env("PORT", "8787")),
  corsOrigin: env("CORS_ORIGIN", "http://localhost:5173"),
  dbPath: env("DB_PATH", "./data/mri.sqlite"),

  mode: resolveMode(),

  // direct provider: any OpenAI-compatible endpoint (OpenRouter default)
  llm: {
    baseUrl: env("LLM_BASE_URL", "https://openrouter.ai/api/v1"),
    apiKey: llmApiKey,
    model: env("LLM_MODEL", "openai/gpt-4o-mini"),
  },

  // Thesys hosted gateway (alternative)
  thesys: {
    apiKey: thesysApiKey,
    baseUrl: env("THESYS_BASE_URL", "https://api.thesys.dev/v1/embed"),
    model: env("THESYS_MODEL", env("MRI_MODEL", "openai/gpt-5")),
  },
};
