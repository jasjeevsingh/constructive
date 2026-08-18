import { describe, it, expect } from "vitest";
import { initialHelperState, reduceHelper } from "@/lib/helper/agentMachine";

const s0 = initialHelperState();
const run = (events: Parameters<typeof reduceHelper>[1][]) =>
  events.reduce((acc, e) => reduceHelper(acc, e).state, s0);

describe("reduceHelper", () => {
  it("starts idle with no turns", () => {
    expect(s0.phase).toBe("idle");
    expect(s0.turns).toEqual([]);
  });

  it("moves to listening once the agent is ready", () => {
    expect(run([{ type: "connecting" }, { type: "open" }, { type: "ready" }]).phase).toBe("listening");
  });

  it("records both student and helper turns", () => {
    const s = run([
      { type: "ready" },
      { type: "conversationText", role: "user", content: "what is a claim" },
      { type: "conversationText", role: "assistant", content: "what do you think it means?" },
    ]);
    expect(s.turns).toEqual([
      { role: "student", text: "what is a claim" },
      { role: "helper", text: "what do you think it means?" },
    ]);
  });

  it("tracks thinking and speaking", () => {
    expect(run([{ type: "ready" }, { type: "thinking" }]).phase).toBe("thinking");
    expect(run([{ type: "ready" }, { type: "audio" }]).phase).toBe("speaking");
    expect(run([{ type: "ready" }, { type: "audio" }, { type: "audioDone" }]).phase).toBe("listening");
  });

  it("drops queued audio the moment the student interrupts", () => {
    const speaking = run([{ type: "ready" }, { type: "audio" }]);
    const { state, effect } = reduceHelper(speaking, { type: "userStartedSpeaking" });
    expect(effect).toBe("dropAudio");
    expect(state.phase).toBe("listening");
  });

  it("keeps the transcript when the socket closes", () => {
    const s = run([
      { type: "ready" },
      { type: "conversationText", role: "user", content: "hi" },
      { type: "closed" },
    ]);
    expect(s.phase).toBe("idle");
    expect(s.turns).toHaveLength(1);
  });

  it("surfaces errors", () => {
    const s = reduceHelper(s0, { type: "error", message: "socket died" }).state;
    expect(s.phase).toBe("error");
    expect(s.error).toBe("socket died");
  });
});
