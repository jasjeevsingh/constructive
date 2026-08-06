import { describe, it, expect } from "vitest";
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

describe("runCoach link step", () => {
  it("uses the link prompt and parses a link response", async () => {
    const client = fakeClient(JSON.stringify({ kind: "link", reaction: "Tempting, but it argues the other way." }));
    const res = await runCoach(
      {
        step: "link",
        motion: "THW ban homework.",
        payload: { impact: "More family time.", candidateText: "A Harvard study raised test scores.", verdict: "great-but-wrong" },
      },
      client
    );
    expect(res).toMatchObject({ kind: "link" });
    // The claim (passed via `motion`) and impact must reach the prompt.
    expect(client.calls[0].user).toContain("THW ban homework.");
    expect(client.calls[0].user).toContain("More family time.");
  });
});
