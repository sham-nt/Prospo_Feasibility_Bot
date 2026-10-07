import "dotenv/config";

const thesysApiKey = process.env.THESYS_API_KEY?.trim() ?? "";

export const config = {
  port: Number(process.env.PORT ?? 8787),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  dbPath: process.env.DB_PATH ?? "./data/mri.sqlite",

  thesysApiKey,
  thesysBaseUrl: process.env.THESYS_BASE_URL ?? "https://api.thesys.dev/v1/embed",
  model: process.env.MRI_MODEL ?? "openai/gpt-5",

  /**
   * Mock the gateway when there is no key, or when explicitly forced. In mock
   * mode the server streams canned OpenUI Lang so the frontend, transport and
   * Pi Durable persistence can be exercised before a real THESYS_API_KEY exists.
   */
  get mockGateway(): boolean {
    return thesysApiKey === "" || process.env.MOCK_GATEWAY === "1";
  },
};
