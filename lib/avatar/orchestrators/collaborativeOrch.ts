import type { AvatarSession, TurnResult, Cohort } from "@/lib/avatar/types";
import { getModeConfig } from "@/lib/avatar/cohortAdapter";

const DEBATE_EXCHANGES_PER_ROUND = 2;
const TURNS_PER_ROUND = DEBATE_EXCHANGES_PER_ROUND * 2;

// Mode C runs two phases in the same session: Phase 1 ("collaborative") has
// the avatar and student brainstorming on the SAME side, then
// collaborativeTransition flips the avatar to the opposite side and the
// session moves into Phase 2 ("debate"), where the two argue it out.
export function initCollaborative(
  motion: string,
  motionId: string,
  cohort: Cohort,
  studentSide: "for" | "against",
): AvatarSession {
  const config = getModeConfig("collaborative", cohort);
  return {
    id: "",
    mode: "collaborative",
    motionId,
    motionText: motion,
    cohort,
    studentSide,
    avatarSide: studentSide,
    transcript: [],
    inlineScores: [],
    roundScores: [],
    phase: "collaborative",
    currentRound: 1,
    totalRounds: config.rounds,
    startedAt: 0,
    endedAt: null,
  };
}

export function collaborativeTransition(session: AvatarSession): AvatarSession {
  return {
    ...session,
    phase: "debate",
    avatarSide: session.studentSide === "for" ? "against" : "for",
    currentRound: 1,
  };
}

export function getCollaborativeArgs(session: AvatarSession): string[] {
  return session.transcript
    .filter((t) => t.speaker === "student")
    .map((t) => t.text);
}

// Phase 1 never scores — it's pure brainstorming, the avatar just keeps
// responding to build out the case together. Phase 2 scores engagement
// after every student turn (immediate feedback on that exchange), and a
// round completes once TURNS_PER_ROUND turns have accumulated since the
// last boundary, matching the len % TURNS_PER_ROUND === 0 pattern used by
// the other orchestrators — that boundary is checked first so it fires
// even when the transcript's last turn is the avatar's closing reply.
export function collaborativeNextTurn(session: AvatarSession): TurnResult {
  if (session.phase === "collaborative") {
    return { avatarShouldRespond: true, shouldScore: false };
  }

  const len = session.transcript.length;

  if (len > 0 && len % TURNS_PER_ROUND === 0) {
    return {
      avatarShouldRespond: false,
      shouldScore: true,
      scoreCriteria: ["engagement"],
      scoreSlice: [len - TURNS_PER_ROUND, len],
      roundComplete: true,
      sessionComplete: session.currentRound >= session.totalRounds,
    };
  }

  const lastTurn = session.transcript[len - 1];
  if (lastTurn?.speaker === "student") {
    return {
      avatarShouldRespond: true,
      shouldScore: true,
      scoreCriteria: ["engagement"],
      scoreSlice: [Math.max(0, len - 2), len],
    };
  }

  return { avatarShouldRespond: false, shouldScore: false };
}
