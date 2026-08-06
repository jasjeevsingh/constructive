import { describe, it, expect, vi } from "vitest";
import { runCoach } from "@/lib/ai/coach";
import type { ChatClient } from "@/lib/ai/claude";

function fakeClient(reply: string): ChatClient & { calls: { system: string; user: string }[] } {
  const calls: { system: string; user: string }[] = [];
  return {
    calls,
    async complete(args) {
      calls.push(args);
      return reply;
    },
  };
}

describe("runCoach", () => {
  it("uses the refine prompt and parses structured JSON", async () => {
    const reply = JSON.stringify({
      kind: "refine",
      verdicts: [{ argumentId: "for-0", verdict: "duplicate", question: "How is this different from for-1?" }],
      duplicateGroups: [["for-0", "for-1"]],
    });
    const client = fakeClient(reply);
    const res = await runCoach(
      { step: "refine", motion: "THW let kids vote.", payload: { argsFor: ["a", "a2", "c"], argsAgainst: ["d", "e", "f"] } },
      client
    );
    expect(res.kind).toBe("refine");
    // The refine prompt must have been used (mentions the ids).
    expect(client.calls[0].system).toContain("for-0");
  });

  it("parses a restate response", async () => {
    const reply = JSON.stringify({ kind: "restate", reaction: "Nice start!", capturedCore: true });
    const res = await runCoach(
      { step: "restate", motion: "THW ban homework.", payload: { restate: "no homework" } },
      fakeClient(reply)
    );
    expect(res).toMatchObject({ kind: "restate", capturedCore: true });
  });

  it("throws when the model returns non-JSON", async () => {
    await expect(
      runCoach({ step: "restate", motion: "m", payload: { restate: "x" } }, fakeClient("not json"))
    ).rejects.toThrow();
  });

  it("throws when JSON fails schema validation", async () => {
    const reply = JSON.stringify({ kind: "restate", reaction: "hi" }); // missing capturedCore
    await expect(
      runCoach({ step: "restate", motion: "m", payload: { restate: "x" } }, fakeClient(reply))
    ).rejects.toThrow();
  });
});
