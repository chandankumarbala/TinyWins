import "dotenv/config";
import { createProvider } from "../server/provider.ts";
if (process.env.RUN_LIVE_AI !== "1") {
  console.error(
    "Live evaluation disabled. Set RUN_LIVE_AI=1 to intentionally make paid OpenAI requests.",
  );
  process.exitCode = 1;
} else if (!process.env.OPENAI_API_KEY) {
  console.error(
    "Configure OPENAI_API_KEY on the server before live evaluation.",
  );
  process.exitCode = 1;
} else {
  const provider = createProvider(
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_MODEL || "gpt-5-mini",
  );
  const goals = [
    ["household", "Clean a cluttered desk"],
    ["writing", "Draft a short project update"],
    ["administration", "Organize receipts for this month"],
    ["small", "Put one book back on its shelf"],
    ["broad", "Prepare to move to a new home"],
  ];
  for (const [name, goal] of goals) {
    try {
      const result = await provider(goal, AbortSignal.timeout(45000));
      console.log(
        `${name}: valid schema; ${result.tasks.length} tasks; ${result.tasks.reduce((n, t) => n + t.estimatedMinutes, 0)} estimated minutes; scope note ${result.scopeNote ? "present" : "absent"}`,
      );
    } catch {
      console.error(`${name}: failed; no request or response content logged`);
      process.exitCode = 1;
    }
  }
  console.log(
    "Structural results do not establish task quality. Review single outcomes, granularity, order, estimates, and scope in the app separately.",
  );
}
