import { describe, it, expect } from "vitest";
import { initPushback, pushbackNextTurn } from "@/lib/avatar/orchestrators/pushbackOrch";

describe("initPushback", () => {
  it("creates a pushback session", () => {
    const session = initPushback("Ban homework", "m-homework", "darshan", "for");
    expect(session.mode).toBe("pushback");
    expect(session.phase).toBe("debate");
    expect(session.totalRounds).toBe(1);
  });

  it("sets avatarSide opposite the student's side", () => {
    const session = initPushback("Ban homework", "m-homework", "darshan", "for");
    expect(session.studentSide).toBe("for");
    expect(session.avatarSide).toBe("against");
  });

  it("starts with an empty transcript and no scores", () => {
    const session = initPushback("Ban homework", "m-homework", "darshan", "against");
    expect(session.transcript).toHaveLength(0);
    expect(session.inlineScores).toHaveLength(0);
    expect(session.roundScores).toHaveLength(0);
    expect(session.currentRound).toBe(1);
  });
});

describe("pushbackNextTurn", () => {
  it("avatar responds and scores after first student turn", () => {
    const session = initPushback("Ban homework", "m-homework", "darshan", "for");
    session.transcript.push(
      { speaker: "student", text: "Homework causes stress.", timestampMs: 0, durationMs: 5000 },
    );
    const result = pushbackNextTurn(session);
    expect(result.avatarShouldRespond).toBe(true);
    expect(result.shouldScore).toBe(true);
    expect(result.scoreCriteria).toContain("argumentation");
    expect(result.scoreCriteria).not.toContain("engagement");
  });

  it("scores after each student response to a challenge", () => {
    const session = initPushback("Ban homework", "m-homework", "darshan", "for");
    session.transcript.push(
      { speaker: "student", text: "Homework causes stress.", timestampMs: 0, durationMs: 5000 },
      { speaker: "avatar", text: "What evidence?", timestampMs: 5000, durationMs: 3000 },
      { speaker: "student", text: "A study found 56% report stress.", timestampMs: 8000, durationMs: 6000 },
    );
    const result = pushbackNextTurn(session);
    expect(result.shouldScore).toBe(true);
    expect(result.avatarShouldRespond).toBe(true);
    expect(result.scoreCriteria).toEqual(["argumentation"]);
  });

  it("does not signal avatar response or scoring when the avatar just spoke", () => {
    const session = initPushback("Ban homework", "m-homework", "darshan", "for");
    session.transcript.push(
      { speaker: "student", text: "Homework causes stress.", timestampMs: 0, durationMs: 5000 },
      { speaker: "avatar", text: "What evidence?", timestampMs: 5000, durationMs: 3000 },
    );
    const result = pushbackNextTurn(session);
    expect(result.avatarShouldRespond).toBe(false);
    expect(result.shouldScore).toBe(false);
  });

  it("does not signal anything on an empty transcript", () => {
    const session = initPushback("Ban homework", "m-homework", "darshan", "for");
    const result = pushbackNextTurn(session);
    expect(result.avatarShouldRespond).toBe(false);
    expect(result.shouldScore).toBe(false);
  });

  it("never signals round complete or phase transition — pushback has no rounds", () => {
    const session = initPushback("Ban homework", "m-homework", "darshan", "for");
    session.transcript.push(
      { speaker: "student", text: "Homework causes stress.", timestampMs: 0, durationMs: 5000 },
    );
    const result = pushbackNextTurn(session);
    expect(result.roundComplete).toBeUndefined();
    expect(result.phaseTransition).toBeUndefined();
  });

  it("never signals session complete on its own — student exits manually", () => {
    const session = initPushback("Ban homework", "m-homework", "darshan", "for");
    for (let i = 0; i < 20; i++) {
      session.transcript.push({
        speaker: i % 2 === 0 ? "student" : "avatar",
        text: `Turn ${i}`,
        timestampMs: i * 3000,
        durationMs: 3000,
      });
    }
    const result = pushbackNextTurn(session);
    expect(result.sessionComplete).toBeUndefined();
  });
});
