import type { AvatarSession, TurnResult, Cohort } from "@/lib/avatar/types";
import { getModeConfig } from "@/lib/avatar/cohortAdapter";

const EXCHANGES_PER_ROUND = 3;

export function initSparring(
  motion: string,
  motionId: string,
  cohort: Cohort,
  studentSide: "for" | "against",
): AvatarSession & { avatarOpens: boolean } {
  const config = getModeConfig("sparring", cohort);
  return {
    id: "",
    mode: "sparring",
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
    avatarOpens: Math.random() < 0.5,
  };
}

const TURNS_PER_ROUND = EXCHANGES_PER_ROUND * 2;

// Round completion is detected from a trailing window of the transcript
// (its length is a positive multiple of TURNS_PER_ROUND) rather than from an
// offset derived from `currentRound`. Deriving the boundary from
// `currentRound` breaks whenever currentRound and transcript length are not
// in lockstep (e.g. a caller advances currentRound without the transcript
// having accumulated the prior rounds' turns), since slicing from an offset
// past the end of the transcript yields an empty slice and round completion
// never fires.
function roundDone(session: AvatarSession): boolean {
  const len = session.transcript.length;
  return len > 0 && len % TURNS_PER_ROUND === 0;
}

export function sparringNextTurn(session: AvatarSession): TurnResult {
  if (roundDone(session)) {
    const start = session.transcript.length - TURNS_PER_ROUND;
    return {
      avatarShouldRespond: false,
      shouldScore: true,
      scoreCriteria: ["argumentation", "engagement"],
      scoreSlice: [start, session.transcript.length],
      roundComplete: true,
      sessionComplete: session.currentRound >= session.totalRounds,
    };
  }

  return {
    avatarShouldRespond: true,
    shouldScore: false,
  };
}

export function sparringAdvanceRound(session: AvatarSession): AvatarSession {
  return { ...session, currentRound: session.currentRound + 1 };
}
