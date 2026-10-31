import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../server/app";
import { AiError } from "../shared/ai";
const good = {
  tasks: [{ title: "Write a heading", estimatedMinutes: 5 }],
  scopeNote: "",
};
const post = (app: ReturnType<typeof createApp>) =>
  request(app)
    .post("/api/ai/breakdown")
    .set("Host", "127.0.0.1:5173")
    .set("Origin", "http://127.0.0.1:5173")
    .set("X-Tiny-Wins", "1");
describe("AI helper", () => {
  it("reports unavailable without exposing configuration", async () => {
    const response = await request(createApp())
      .get("/api/ai/status")
      .set("Host", "127.0.0.1:5173");
    expect(response.body).toEqual({ available: false });
  });
  it("accepts valid goal and returns ordered structured tasks", async () => {
    const response = await post(
      createApp({
        provider: async (goal) => {
          expect(goal).toBe("Write report");
          return good;
        },
      }),
    ).send({ goal: " Write report " });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(good);
  });
  it("accepts localhost app origin as local loopback", async () => {
    const response = await request(createApp({ provider: async () => good }))
      .post("/api/ai/breakdown")
      .set("Host", "localhost:5173")
      .set("Origin", "http://localhost:5173")
      .set("X-Tiny-Wins", "1")
      .send({ goal: "Write report" });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(good);
  });
  it("rejects missing key", async () => {
    expect(
      (await post(createApp()).send({ goal: "Write report" })).status,
    ).toBe(503);
  });
  it("rejects foreign origins and missing custom header", async () => {
    const app = createApp({ provider: async () => good });
    expect(
      (
        await post(app)
          .set("Origin", "https://evil.example")
          .send({ goal: "Hi" })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/ai/breakdown")
          .set("Host", "127.0.0.1:5173")
          .send({ goal: "Hi" })
      ).status,
    ).toBe(403);
  });
  it("rejects blank goals and client model overrides", async () => {
    const app = createApp({ provider: async () => good });
    for (const body of [
      { goal: " " },
      { goal: "x".repeat(4001) },
      { goal: "Hi", model: "other" },
    ])
      expect((await post(app).send(body)).status).toBe(400);
  });
  it("rejects invalid model output atomically", async () => {
    const response = await post(
      createApp({ provider: async () => ({ ...good, tasks: [] }) }),
    ).send({ goal: "Hi" });
    expect(response.status).toBe(502);
  });
  it("sanitizes unknown provider errors", async () => {
    const response = await post(
      createApp({
        provider: async () => {
          throw Error("synthetic-secret");
        },
      }),
    ).send({ goal: "synthetic-private-prompt" });
    expect(JSON.stringify(response.body)).not.toContain("synthetic");
    expect(response.status).toBe(502);
  });
  it("retains safe known refusal messages", async () => {
    const response = await post(
      createApp({
        provider: async () => {
          throw new AiError("REFUSED", 422, "Try a different goal.");
        },
      }),
    ).send({ goal: "Hi" });
    expect(response.status).toBe(422);
  });
  it("limits attempts to five per minute", async () => {
    const app = createApp({ provider: async () => good });
    for (let i = 0; i < 5; i++)
      expect((await post(app).send({ goal: "Hi" })).status).toBe(200);
    expect((await post(app).send({ goal: "Hi" })).body.error.code).toBe(
      "RATE_LIMITED",
    );
  });
  it("rejects oversized payload", async () => {
    expect(
      (
        await post(createApp({ provider: async () => good })).send({
          goal: "x".repeat(20000),
        })
      ).status,
    ).toBe(400);
  });
});

it("allows only one active generation at a time", async () => {
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const app = createApp({
    provider: async () => {
      entered();
      await pending;
      return good;
    },
  });
  const first = post(app)
    .send({ goal: "First" })
    .then((response) => response);
  await started;
  const second = await post(app).send({ goal: "Second" });
  expect(second.status).toBe(429);
  expect(second.body.error.code).toBe("BUSY");
  release();
  expect((await first).status).toBe(200);
});

it("rejects foreign host and non-JSON content", async () => {
  const app = createApp({ provider: async () => good });
  expect(
    (await post(app).set("Host", "evil.example").send({ goal: "Hi" })).status,
  ).toBe(403);
  expect((await post(app).type("text").send("Hi")).status).toBe(415);
});
