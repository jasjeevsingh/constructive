"use client";
import { useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/button";
import { ModeCard } from "@/components/avatar/ModeCard";
import { getFlowMotions } from "@/lib/flowMotions";
import { initSparring, sparringNextTurn, sparringAdvanceRound } from "@/lib/avatar/orchestrators/sparringOrch";
import { initPushback, pushbackNextTurn } from "@/lib/avatar/orchestrators/pushbackOrch";
import {
  initCollaborative,
  collaborativeTransition,
  collaborativeNextTurn,
  getCollaborativeArgs,
} from "@/lib/avatar/orchestrators/collaborativeOrch";
import { saveAvatarSession } from "@/lib/state/avatarSession";
import type { AvatarMode, AvatarSession, AvatarTurn, AvatarTurnRequest, TurnResult } from "@/lib/avatar/types";
import type { FlowMotion } from "@/lib/schemas";
import type { Side } from "@/lib/state/flowMachine";
import { TranscriptPane } from "@/components/avatar/TranscriptPane";
import { AvatarVoiceBar } from "@/components/avatar/AvatarVoiceBar";
import { cn } from "@/lib/utils";
import { ScoreCard } from "@/components/avatar/ScoreCard";
import { speakCoachStreaming } from "@/lib/voice/playSpeech";

const MODES: { mode: AvatarMode; title: string; description: string }[] = [
  { mode: "sparring", title: "Sparring", description: "Debate an opponent. Get scored after each round." },
  { mode: "pushback", title: "Pushback Coach", description: "Stress-test your argument claim by claim." },
  { mode: "collaborative", title: "Build + Debate", description: "Brainstorm together, then face off." },
];

type Step = "mode" | "motion" | "side" | "session" | "transition" | "review";

export function AvatarShell({ onExit }: { onExit: () => void }) {
  const motions = getFlowMotions();
  const [step, setStep] = useState<Step>("mode");
  const [selectedMode, setSelectedMode] = useState<AvatarMode | null>(null);
  const [selectedMotion, setSelectedMotion] = useState<FlowMotion | null>(null);
  const [session, setSession] = useState<AvatarSession | null>(null);
  const [barStatus, setBarStatus] = useState<"idle" | "listening" | "transcribing" | "avatar-speaking">("idle");

  async function handleStudentTurn(studentText: string) {
    if (!session) return;

    const studentTurn: AvatarTurn = {
      speaker: "student",
      text: studentText,
      timestampMs: Date.now() - session.startedAt,
      durationMs: 0,
    };

    let updated: AvatarSession = { ...session, transcript: [...session.transcript, studentTurn] };
    setSession(updated);
    saveAvatarSession(window.localStorage, updated);

    // Get orchestrator decision
    let result: TurnResult;
    switch (session.mode) {
      case "sparring":
        result = sparringNextTurn(updated);
        break;
      case "pushback":
        result = pushbackNextTurn(updated);
        break;
      case "collaborative":
        result = collaborativeNextTurn(updated);
        break;
    }

    // Avatar responds — stream LLM + sentence-chunked TTS for low latency
    if (result.avatarShouldRespond) {
      const turnReq: AvatarTurnRequest = {
        mode: updated.mode,
        phase: updated.phase,
        motion: updated.motionText,
        cohort: updated.cohort,
        avatarSide: updated.avatarSide,
        studentSide: updated.studentSide,
        transcript: updated.transcript,
        collaborativeArgs: updated.mode === "collaborative" ? getCollaborativeArgs(updated) : undefined,
      };
      try {
        const avatarText = await speakCoachStreaming(turnReq);
        if (avatarText) {
          const avatarTurn: AvatarTurn = {
            speaker: "avatar",
            text: avatarText,
            timestampMs: Date.now() - session.startedAt,
            durationMs: 0,
          };
          updated = { ...updated, transcript: [...updated.transcript, avatarTurn] };
          setSession(updated);
          saveAvatarSession(window.localStorage, updated);

          // Re-check orchestrator now that both turns are counted — round
          // completion fires at even transcript lengths (e.g. 6) which the
          // pre-avatar check (odd length) can never reach.
          let postAvatarResult: TurnResult;
          switch (updated.mode) {
            case "sparring": postAvatarResult = sparringNextTurn(updated); break;
            case "pushback": postAvatarResult = pushbackNextTurn(updated); break;
            case "collaborative": postAvatarResult = collaborativeNextTurn(updated); break;
          }
          if (postAvatarResult.roundComplete || postAvatarResult.sessionComplete) {
            result = postAvatarResult;
          }
        }
      } catch {
        // Network failure — the student turn is already saved, so just skip the avatar reply.
      }
    }

    // Score
    if (result.shouldScore && result.scoreSlice) {
      const scoreType: "round" | "inline" =
        updated.mode === "pushback" ? "inline" : result.roundComplete ? "round" : "inline";
      const scoreReq = {
        scoreType,
        mode: updated.mode,
        transcript: updated.transcript.slice(result.scoreSlice[0], result.scoreSlice[1]),
        criteria: result.scoreCriteria ?? [],
        cohort: updated.cohort,
      };
      try {
        const res = await fetch("/api/avatar/score", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(scoreReq),
        });
        if (res.ok) {
          const scoreData = await res.json();
          if (scoreType === "round") {
            updated = { ...updated, roundScores: [...updated.roundScores, { ...scoreData, round: updated.currentRound }] };
          } else {
            updated = {
              ...updated,
              inlineScores: [...updated.inlineScores, { ...scoreData, turnIndex: updated.transcript.length - 1 }],
            };
          }
          setSession(updated);
          saveAvatarSession(window.localStorage, updated);
        }
      } catch {
        // Network failure — skip scoring, the transcript itself is unaffected.
      }
    }

    // State transitions
    if (result.phaseTransition) {
      setStep("transition");
    }
    if (result.roundComplete) {
      setStep("review");
    }
    if (result.sessionComplete) {
      updated = { ...updated, endedAt: Date.now() };
      setSession(updated);
      saveAvatarSession(window.localStorage, updated);
    }
  }

  function selectMode(mode: AvatarMode) {
    setSelectedMode(mode);
    setStep("motion");
  }

  function selectMotion(m: FlowMotion) {
    setSelectedMotion(m);
    if (selectedMode === "collaborative") {
      startSession(m, "for");
    } else {
      setStep("side");
    }
  }

  function startSession(m: FlowMotion, side: Side) {
    const cohort = "darshan"; // TODO: read from user settings
    const id = crypto.randomUUID();
    let sess: AvatarSession;
    switch (selectedMode) {
      case "sparring":
        sess = initSparring(m.motion, m.id, cohort, side);
        break;
      case "pushback":
        sess = initPushback(m.motion, m.id, cohort, side);
        break;
      case "collaborative":
        sess = initCollaborative(m.motion, m.id, cohort, side);
        break;
      default:
        return;
    }
    sess.id = id;
    sess.startedAt = Date.now();
    saveAvatarSession(window.localStorage, sess);
    setSession(sess);
    setStep("session");
  }

  if (step === "mode") {
    return (
      <AppShell>
        <Button variant="ghost" className="mb-4 text-muted-foreground" onClick={onExit}>← Back</Button>
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">Debate Avatar</div>
        <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">Choose your mode</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {MODES.map((m, i) => (
            <ModeCard key={m.mode} title={m.title} description={m.description} index={i} onClick={() => selectMode(m.mode)} />
          ))}
        </div>
      </AppShell>
    );
  }

  if (step === "motion") {
    return (
      <AppShell>
        <Button variant="ghost" className="mb-4 text-muted-foreground" onClick={() => setStep("mode")}>← Back</Button>
        <h2 className="font-display text-2xl font-semibold text-foreground">Pick a motion</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {motions.map((m) => (
            <Button key={m.id} variant="outline" className="h-auto whitespace-normal p-4 text-left" onClick={() => selectMotion(m)}>
              {m.motion}
            </Button>
          ))}
        </div>
      </AppShell>
    );
  }

  if (step === "side" && selectedMotion) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg py-10 text-center">
          <h2 className="font-display text-2xl font-semibold text-foreground">{selectedMotion.motion}</h2>
          <p className="mt-3 text-sm text-muted-foreground">Which side do you want to argue?</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => startSession(selectedMotion, "for")}>Argue FOR</Button>
            <Button onClick={() => startSession(selectedMotion, "against")}>Argue AGAINST</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (step === "transition" && session?.mode === "collaborative") {
    // Mode C phase transition interstitial
    return (
      <AppShell>
        <div className="mx-auto max-w-lg py-16 text-center">
          <h2 className="font-display text-2xl font-semibold text-foreground">Ready to debate?</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            The avatar will now argue against you using what you built together.
          </p>
          <Button className="mt-6" onClick={() => {
            const transitioned = collaborativeTransition(session);
            setSession(transitioned);
            saveAvatarSession(window.localStorage, transitioned);
            setStep("session");
          }}>
            Let's go →
          </Button>
        </div>
      </AppShell>
    );
  }

  if (step === "review" && session) {
    return (
      <AppShell>
        <ScoreCard
          mode={session.mode}
          roundScores={session.roundScores}
          onContinue={() => {
            const advanced = sparringAdvanceRound(session);
            setSession(advanced);
            saveAvatarSession(window.localStorage, advanced);
            setStep("session");
          }}
          onEnd={() => {
            setSession(null);
            setStep("mode");
          }}
        />
      </AppShell>
    );
  }

  if (step === "session" && session) {
    const modeLabel = MODES.find((m) => m.mode === session.mode)?.title ?? "";
    const roundLabel =
      session.mode === "sparring"
        ? `Round ${session.currentRound} of ${session.totalRounds}`
        : session.mode === "collaborative"
        ? session.phase === "collaborative" ? "Building" : "Debating"
        : "";
    const lastAvatarText = [...session.transcript].reverse().find((t) => t.speaker === "avatar")?.text;

    return (
      <div className="fixed inset-0 z-30 flex flex-col bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-medium text-white/60">
            {modeLabel}
            {roundLabel && <span className="ml-2 text-white/40">{roundLabel}</span>}
          </div>
          <TranscriptPane transcript={session.transcript} inlineScores={session.inlineScores} />
        </div>

        {/* Center — avatar circles + status */}
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
          {/* Motion */}
          <p className="max-w-lg text-center text-sm font-medium leading-relaxed text-white/50">
            {session.motionText}
          </p>

          <div className="flex items-center gap-12">
            {/* You */}
            <div className="flex flex-col items-center gap-3">
              <div
                className={cn(
                  "flex h-24 w-24 items-center justify-center rounded-full border-2 text-3xl font-bold transition-all duration-300",
                  barStatus === "listening"
                    ? "border-green-400 bg-green-500/20 shadow-[0_0_32px_rgba(74,222,128,0.35)]"
                    : "border-white/20 bg-white/5",
                )}
              >
                <span className="text-white/80">You</span>
              </div>
              <span className="text-xs text-white/40">
                {barStatus === "listening" ? "Speaking…" : barStatus === "transcribing" ? "Processing…" : ""}
              </span>
            </div>

            <div className="text-2xl font-light text-white/20">vs</div>

            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div
                className={cn(
                  "flex h-24 w-24 items-center justify-center rounded-full border-2 text-lg font-semibold transition-all duration-300",
                  barStatus === "avatar-speaking"
                    ? "border-blue-400 bg-blue-500/20 shadow-[0_0_32px_rgba(96,165,250,0.35)]"
                    : "border-white/20 bg-white/5",
                )}
              >
                <svg className="h-10 w-10 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                </svg>
              </div>
              <span className="text-xs text-white/40">
                {barStatus === "avatar-speaking" ? "Speaking…" : ""}
              </span>
            </div>
          </div>

          {/* Last avatar response preview */}
          {lastAvatarText && (
            <p className="max-w-md text-center text-sm leading-relaxed text-white/30">
              &ldquo;{lastAvatarText.length > 120 ? lastAvatarText.slice(0, 120) + "…" : lastAvatarText}&rdquo;
            </p>
          )}
        </div>

        {/* Bottom call bar */}
        <AvatarVoiceBar
          session={session}
          onStudentTurn={handleStudentTurn}
          onEnd={() => { setSession(null); setStep("mode"); }}
          onStatusChange={setBarStatus}
        />
      </div>
    );
  }

  return null;
}
