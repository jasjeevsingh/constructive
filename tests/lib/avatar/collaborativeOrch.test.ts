import { describe, it, expect } from "vitest";
import {
  initCollaborative,
  collaborativeNextTurn,
  collaborativeTransition,
  getCollaborativeArgs,
} from "@/lib/avatar/orchestrators/collaborativeOrch";

describe("initCollaborative", () => {
  it("starts in the collaborative phase", () => {
    const session = initCollaborative("Ban homework", "m-homework", "darshan", "for");
    expect(session.mode).toBe("collaborative");
    expect(session.phase).toBe("collaborative");
    expect(session.avatarSide).toBe("for");
  });
});

describe("collaborativeNextTurn — Phase 1", () => {
  it("avatar responds but does not score in collaborative phase", () => {
    const session = initCollaborative("Ban homework", "m-homework", "darshan", "for");
    session.transcript.push(
      { speaker: "student", text: "Kids need rest.", timestampMs: 0, durationMs: 4000 },
    );
    const result = collaborativeNextTurn(session);
    expect(result.avatarShouldRespond).toBe(true);
    expect(result.shouldScore).toBe(false);
  });
});

describe("collaborativeTransition", () => {
  it("switches to debate phase and flips avatar side", () => {
    const session = initCollaborative("Ban homework", "m-homework", "darshan", "for");
    session.transcript.push(
      { speaker: "student", text: "Kids need rest.", timestampMs: 0, durationMs: 4000 },
      { speaker: "avatar", text: "Great claim! What evidence?", timestampMs: 4000, durationMs: 3000 },
    );
    const transitioned = collaborativeTransition(session);
    expect(transitioned.phase).toBe("debate");
    expect(transitioned.avatarSide).toBe("against");
    expect(transitioned.currentRound).toBe(1);
  });
});

describe("collaborativeNextTurn — Phase 2 (debate)", () => {
  it("scores engagement after each exchange in debate phase", () => {
    const session = initCollaborative("Ban homework", "m-homework", "darshan", "for");
    const debateSession = collaborativeTransition(session);
    debateSession.transcript.push(
      { speaker: "student", text: "Kids need rest.", timestampMs: 0, durationMs: 4000 },
      { speaker: "avatar", text: "But practice matters.", timestampMs: 4000, durationMs: 3000 },
      { speaker: "student", text: "Studies show burnout.", timestampMs: 7000, durationMs: 5000 },
    );
    const result = collaborativeNextTurn(debateSession);
    expect(result.shouldScore).toBe(true);
    expect(result.scoreCriteria).toContain("engagement");
  });

  it("signals session complete after 2 rounds of debate", () => {
    const session = initCollaborative("Ban homework", "m-homework", "darshan", "for");
    const debateSession = collaborativeTransition(session);
    debateSession.currentRound = 2;
    for (let i = 0; i < 4; i++) {
      debateSession.transcript.push({
        speaker: i % 2 === 0 ? "student" : "avatar",
        text: `Turn ${i}`,
        timestampMs: i * 4000,
        durationMs: 4000,
      });
    }
    const result = collaborativeNextTurn(debateSession);
    expect(result.roundComplete).toBe(true);
    expect(result.sessionComplete).toBe(true);
  });
});

describe("getCollaborativeArgs", () => {
  it("extracts student turns from Phase 1 as argument summaries", () => {
    const session = initCollaborative("Ban homework", "m-homework", "darshan", "for");
    session.transcript.push(
      { speaker: "student", text: "Kids need rest.", timestampMs: 0, durationMs: 4000 },
      { speaker: "avatar", text: "Good! Evidence?", timestampMs: 4000, durationMs: 3000 },
      { speaker: "student", text: "Studies show burnout after 2 hours.", timestampMs: 7000, durationMs: 5000 },
    );
    const args = getCollaborativeArgs(session);
    expect(args).toContain("Kids need rest.");
    expect(args).toContain("Studies show burnout after 2 hours.");
  });
});
