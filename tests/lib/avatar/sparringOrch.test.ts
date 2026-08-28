import { describe, it, expect } from "vitest";
import { initSparring, sparringNextTurn, sparringAdvanceRound } from "@/lib/avatar/orchestrators/sparringOrch";

describe("initSparring", () => {
  it("creates a session with correct initial state", () => {
    const session = initSparring("Ban homework", "m-homework", "darshan", "for");
    expect(session.mode).toBe("sparring");
    expect(session.studentSide).toBe("for");
    expect(session.avatarSide).toBe("against");
    expect(session.currentRound).toBe(1);
    expect(session.totalRounds).toBe(3);
    expect(session.phase).toBe("debate");
    expect(session.transcript).toHaveLength(0);
  });
});

describe("sparringNextTurn", () => {
  it("avatar responds after the first student turn", () => {
    const session = initSparring("Ban homework", "m-homework", "darshan", "for");
    session.transcript.push(
      { speaker: "student", text: "Homework causes stress.", timestampMs: 0, durationMs: 5000 },
    );
    const result = sparringNextTurn(session);
    expect(result.avatarShouldRespond).toBe(true);
    expect(result.shouldScore).toBe(false);
  });

  it("triggers round scoring after 3 exchange pairs", () => {
    const session = initSparring("Ban homework", "m-homework", "darshan", "for");
    for (let i = 0; i < 6; i++) {
      session.transcript.push({
        speaker: i % 2 === 0 ? "student" : "avatar",
        text: `Turn ${i + 1}`,
        timestampMs: i * 5000,
        durationMs: 5000,
      });
    }
    const result = sparringNextTurn(session);
    expect(result.roundComplete).toBe(true);
    expect(result.shouldScore).toBe(true);
    expect(result.scoreCriteria).toContain("argumentation");
    expect(result.scoreCriteria).toContain("engagement");
  });

  it("signals session complete after final round", () => {
    const session = initSparring("Ban homework", "m-homework", "darshan", "for");
    session.currentRound = 3;
    for (let i = 0; i < 6; i++) {
      session.transcript.push({
        speaker: i % 2 === 0 ? "student" : "avatar",
        text: `Turn ${i + 1}`,
        timestampMs: i * 5000,
        durationMs: 5000,
      });
    }
    const result = sparringNextTurn(session);
    expect(result.roundComplete).toBe(true);
    expect(result.sessionComplete).toBe(true);
  });
});

describe("sparringAdvanceRound", () => {
  it("increments the round counter", () => {
    const session = initSparring("Ban homework", "m-homework", "darshan", "for");
    const advanced = sparringAdvanceRound(session);
    expect(advanced.currentRound).toBe(2);
  });
});
