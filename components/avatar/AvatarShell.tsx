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
import { ScoreCard } from "@/components/avatar/ScoreCard";
import { speakCoach } from "@/lib/voice/playSpeech";

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

  async function handleStudentTurn(studentText: string) {
    if (!session) return;

    const studentTurn: AvatarTurn = {
      speaker: "student",
      text: studentText,
      timestampMs: Date.now() - session.startedAt,
      durationMs: 0,
    };

    const updated: AvatarSession = { ...session, transcript: [...session.transcript, studentTurn] };
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

    // Avatar responds
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
      const res = await fetch("/api/avatar/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(turnReq),
      });
      if (res.ok) {
        const { text: avatarText } = await res.json();
        const avatarTurn: AvatarTurn = {
          speaker: "avatar",
          text: avatarText,
          timestampMs: Date.now() - session.startedAt,
          durationMs: 0,
        };
        updated.transcript = [...updated.transcript, avatarTurn];
        setSession({ ...updated });
        saveAvatarSession(window.localStorage, { ...updated });
        void speakCoach(avatarText);
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
      const res = await fetch("/api/avatar/score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(scoreReq),
      });
      if (res.ok) {
        const scoreData = await res.json();
        if (scoreType === "round") {
          updated.roundScores = [...updated.roundScores, { ...scoreData, round: updated.currentRound }];
        } else {
          updated.inlineScores = [...updated.inlineScores, { ...scoreData, turnIndex: updated.transcript.length - 1 }];
        }
        setSession({ ...updated });
        saveAvatarSession(window.localStorage, { ...updated });
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
      updated.endedAt = Date.now();
      setSession({ ...updated });
      saveAvatarSession(window.localStorage, { ...updated });
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
    return (
      <AppShell>
        <div className="flex items-center justify-between border-b border-border pb-3">
          <Button variant="ghost" size="sm" onClick={() => { setSession(null); setStep("mode"); }}>← Exit</Button>
          <div className="text-sm font-medium text-foreground">
            {MODES.find((m) => m.mode === session.mode)?.title}
            {session.mode === "sparring" && ` · R${session.currentRound}/${session.totalRounds}`}
            {session.mode === "collaborative" && ` · ${session.phase === "collaborative" ? "Building" : "Debating"}`}
          </div>
          <div />
        </div>
        <TranscriptPane transcript={session.transcript} inlineScores={session.inlineScores} />
        <AvatarVoiceBar session={session} onStudentTurn={handleStudentTurn} />
      </AppShell>
    );
  }

  return null;
}
