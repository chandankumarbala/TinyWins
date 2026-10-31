import { beforeEach, describe, expect, it, vi } from "vitest";
const { create, constructor } = vi.hoisted(() => ({
  create: vi.fn(),
  constructor: vi.fn(),
}));
vi.mock("openai", () => {
  class FakeTimeout extends Error {}
  class FakeOpenAI {
    static APIConnectionTimeoutError = FakeTimeout;
    responses = { create };
    constructor(options: unknown) {
      constructor(options);
    }
  }
  return { default: FakeOpenAI };
});
import OpenAI from "openai";
import { createProvider } from "../server/provider";
const result = {
  tasks: [{ title: "Write the heading", estimatedMinutes: 5 }],
  scopeNote: "",
};
const signal = () => new AbortController().signal;
beforeEach(() => vi.clearAllMocks());
describe("OpenAI adapter", () => {
  it("uses bounded server-only configuration and parses output", async () => {
    create.mockResolvedValue({
      status: "completed",
      output: [],
      output_text: JSON.stringify(result),
    });
    const provider = createProvider("synthetic-key");
    expect(await provider("Write a report", signal())).toEqual(result);
    expect(constructor).toHaveBeenCalledWith({
      apiKey: "synthetic-key",
      maxRetries: 0,
      timeout: 45000,
    });
    expect(create.mock.calls[0][0]).toMatchObject({
      model: "gpt-5-mini",
      store: false,
      max_output_tokens: 4000,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", strict: true } },
    });
  });
  it("supports a server model override", async () => {
    create.mockResolvedValue({
      status: "completed",
      output: [],
      output_text: JSON.stringify(result),
    });
    await createProvider("synthetic-key", "configured-model")("Goal", signal());
    expect(create.mock.calls[0][0].model).toBe("configured-model");
  });
  it("rejects refusal", async () => {
    create.mockResolvedValue({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "refusal", refusal: "private details" }],
        },
      ],
    });
    await expect(
      createProvider("synthetic-key")("Goal", signal()),
    ).rejects.toMatchObject({ code: "REFUSED" });
  });
  it("rejects incomplete output", async () => {
    create.mockResolvedValue({ status: "incomplete", output: [] });
    await expect(
      createProvider("synthetic-key")("Goal", signal()),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it.each(["bad", JSON.stringify({ tasks: [], scopeNote: "" })])(
    "rejects malformed output %s",
    async (output) => {
      create.mockResolvedValue({
        status: "completed",
        output: [],
        output_text: output,
      });
      await expect(
        createProvider("synthetic-key")("Goal", signal()),
      ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    },
  );
  it("maps SDK timeout", async () => {
    create.mockRejectedValue(new OpenAI.APIConnectionTimeoutError());
    await expect(
      createProvider("synthetic-key")("Goal", signal()),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
  it("sanitizes upstream failures", async () => {
    create.mockRejectedValue(Error("synthetic-secret upstream payload"));
    await expect(
      createProvider("synthetic-key")("Goal", signal()),
    ).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
      message:
        "AI generation is unavailable. Check the server configuration and try again.",
    });
  });
});
