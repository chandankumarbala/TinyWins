import express from "express";
import { resolve } from "node:path";
import {
  AiError,
  breakdownRequestSchema,
  breakdownSchema,
} from "../shared/ai.ts";
import type { Provider } from "./provider.ts";
export function createApp({
  provider,
  production = false,
  now = Date.now,
}: { provider?: Provider; production?: boolean; now?: () => number } = {}) {
  const app = express();
  app.disable("x-powered-by");
  let busy = false;
  let attempts: number[] = [];
  const hosts = new Set([
    "127.0.0.1:5173",
    "localhost:5173",
    ...(production ? [] : ["127.0.0.1:8788"]),
  ]);
  const origins = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);
  app.use("/api", (req, res, next) => {
    if (
      !hosts.has(req.get("host") ?? "") ||
      (req.get("origin") && !origins.has(req.get("origin") ?? "")) ||
      req.get("sec-fetch-site") === "cross-site"
    )
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only the local Tiny Wins app may use this endpoint.",
        },
      });
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  app.get("/api/ai/status", (_req, res) => {
    res.set("Cache-Control", "no-store").json({ available: !!provider });
  });
  app.post("/api/ai/breakdown", async (req, res, next) => {
    let acquired = false;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (req.get("x-tiny-wins") !== "1")
        throw new AiError(
          "FORBIDDEN",
          403,
          "Use the local Tiny Wins app to generate tasks.",
        );
      if (!req.is("application/json"))
        throw new AiError("INVALID_INPUT", 415, "Send a JSON goal.");
      const input = breakdownRequestSchema.safeParse(req.body);
      if (!input.success)
        throw new AiError(
          "INVALID_INPUT",
          400,
          "Enter a goal between 1 and 4,000 characters.",
        );
      if (!provider)
        throw new AiError(
          "UNAVAILABLE",
          503,
          "Configure OPENAI_API_KEY on the local server to enable AI.",
        );
      if (busy)
        throw new AiError(
          "BUSY",
          429,
          "Another breakdown is in progress. Try again shortly.",
        );
      attempts = attempts.filter((time) => now() - time < 60000);
      if (attempts.length >= 5)
        throw new AiError(
          "RATE_LIMITED",
          429,
          "Too many requests. Wait a minute and try again.",
        );
      attempts.push(now());
      busy = true;
      acquired = true;
      timer = setTimeout(() => controller.abort(), 45000);
      res.on("close", () => {
        if (!res.writableEnded) controller.abort();
      });
      const result = await Promise.race([
        provider(input.data.goal, controller.signal),
        new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener(
            "abort",
            () =>
              reject(
                new AiError(
                  "TIMEOUT",
                  504,
                  "Generation timed out. Please try again.",
                ),
              ),
            { once: true },
          );
        }),
      ]);
      const parsed = breakdownSchema.safeParse(result);
      if (!parsed.success)
        throw new AiError(
          "INVALID_RESPONSE",
          502,
          "The breakdown was invalid. Please try again.",
        );
      if (!controller.signal.aborted)
        res.set("Cache-Control", "no-store").json(parsed.data);
      else
        throw new AiError(
          "TIMEOUT",
          504,
          "Generation timed out. Please try again.",
        );
    } catch (error) {
      next(
        acquired && !(error instanceof AiError)
          ? new AiError(
              "PROVIDER_ERROR",
              502,
              "AI generation is unavailable. Try again.",
            )
          : error,
      );
    } finally {
      if (timer) clearTimeout(timer);
      if (acquired) busy = false;
    }
  });
  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: { code: "INVALID_INPUT", message: "Unknown API endpoint." },
    });
  });
  if (production) app.use(express.static(resolve("dist")));
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      void _next;
      const safe =
        error instanceof AiError
          ? error
          : new AiError(
              "INVALID_INPUT",
              400,
              "Request could not be processed.",
            );
      if (!res.headersSent && !res.destroyed)
        res
          .status(safe.status)
          .json({ error: { code: safe.code, message: safe.message } });
    },
  );
  return app;
}
