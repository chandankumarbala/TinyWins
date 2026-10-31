import "dotenv/config";
import { createApp } from "./app.ts";
import { createProvider } from "./provider.ts";
const production = process.env.NODE_ENV === "production";
const key = process.env.OPENAI_API_KEY?.trim();
createApp({
  production,
  provider: key
    ? createProvider(key, process.env.OPENAI_MODEL || "gpt-5-mini")
    : undefined,
}).listen(production ? 5173 : 8788, "127.0.0.1", () =>
  console.log("Tiny Wins local helper ready."),
);
