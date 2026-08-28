import type { AvatarSession, TurnResult, Cohort } from "@/lib/avatar/types";
import { getModeConfig } from "@/lib/avatar/cohortAdapter";

export function initPushback(
  motion: string,
  motionId: string,
  cohort: Cohort,
  studentSide: "for" | "against",
): AvatarSession {
  const config = getModeConfig("pushback", cohort);
  return {
    id: "",
    mode: "pushback",
    motionId,
    motionText: motion,
    cohort,
    studentSide,
    avatarSide: studentSide === "for" ? "against" : "for",
    transcript: [],
    inlineScores: [],
    roundScores: [],
    phase: "debate",
    currentRound: 1,
    totalRounds: config.rounds,
    startedAt: 0,
    endedAt: null,
  };
}

// Pushback is a single continuous round with no round/phase boundaries and no
// automatic end: the student exits manually. Every time the student has just
// spoken, the avatar challenges them and that student turn is scored on
// argumentation alone (pushback drills claim/link/impact under pressure, not
// engagement breadth). When the avatar just spoke (or the transcript is
// empty), it's the student's turn to respond — nothing to trigger yet.
export function pushbackNextTurn(session: AvatarSession): TurnResult {
  const lastTurn = session.transcript[session.transcript.length - 1];
  const studentJustSpoke = lastTurn?.speaker === "student";

  if (!studentJustSpoke) {
    return { avatarShouldRespond: false, shouldScore: false };
  }

  return {
    avatarShouldRespond: true,
    shouldScore: true,
    scoreCriteria: ["argumentation"],
    scoreSlice: [Math.max(0, session.transcript.length - 3), session.transcript.length],
  };
}
