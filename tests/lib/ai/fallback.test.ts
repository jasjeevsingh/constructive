import { describe, it, expect } from "vitest";
import { createFallbackClient, type ChatClient } from "@/lib/ai/claude";

function stub(label: string, behavior: "ok" | "fail"): ChatClient & { calls: number } {
  const client = {
    calls: 0,
    async complete() {
      client.calls += 1;
      if (behavior === "fail") throw new Error(`${label} failed`);
      return `${label} ok`;
    },
  };
  return client;
}

describe("createFallbackClient", () => {
  it("uses Anthropic (primary) when it succeeds", async () => {
    const primary = stub("anthropic", "ok");
    const fallback = stub("openai", "ok");
    const client = createFallbackClient(primary, fallback);
    await expect(client.complete({ system: "s", user: "u" })).resolves.toBe("anthropic ok");
    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(0);
  });

  it("falls back to OpenAI when Anthropic fails", async () => {
    const primary = stub("anthropic", "fail");
    const fallback = stub("openai", "ok");
    const client = createFallbackClient(primary, fallback);
    await expect(client.complete({ system: "s", user: "u" })).resolves.toBe("openai ok");
    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(1);
  });

  it("uses OpenAI when Anthropic key is missing", async () => {
    const fallback = stub("openai", "ok");
    const client = createFallbackClient(null, fallback);
    await expect(client.complete({ system: "s", user: "u" })).resolves.toBe("openai ok");
    expect(fallback.calls).toBe(1);
  });

  it("rethrows Anthropic error when OpenAI is not configured", async () => {
    const primary = stub("anthropic", "fail");
    const client = createFallbackClient(primary, null);
    await expect(client.complete({ system: "s", user: "u" })).rejects.toThrow("anthropic failed");
  });

  it("throws when neither provider is configured", () => {
    expect(() => createFallbackClient(null, null)).toThrow(/No AI API key/);
  });
});
