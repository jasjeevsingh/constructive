# Debate Avatar — Design Spec

**Date:** 2026-08-27
**Status:** Draft

## Summary

An AI sparring partner with three interaction modes, targeting all three age cohorts (Surat/Darshan/Pyaas), using content-only evaluation against EJ's revised rubric. Voice interaction via hold-to-talk + TTS (existing Deepgram infrastructure); text fallback always available.

## Modes

### Mode A — Structured Sparring

Replicates a formal debate. Student and avatar argue opposite sides of a motion in alternating timed turns.

**Flow:**

1. Student picks a motion and side (For/Against). Avatar takes the other side.
2. Random coin-flip decides who opens (50/50, determined client-side at session start).
3. Each round: 60-second turns, alternating. 3 rounds default.
4. 15-second prep pause between rounds.
5. Post-round: scoring AI analyzes the full round transcript against Argumentation and Engagement sub-criteria, renders a ScoreCard.
6. After all rounds: summary scorecard with per-round breakdown and one "focus for next time" recommendation.

**Avatar behavior:** argues earnestly — makes real claims, links, and impacts. Adjusts argument complexity to cohort. Never deliberately loses.

**Scoring:** post-round only. Argumentation (Claim, Link, Impact, Weighing) + Engagement (Breadth, Depth, Responsive, Crystallizing), each /3. One-line rationale per sub-criterion. Focus area = lowest sub-criterion + concrete tip.

### Mode B — Pushback Coach

Stress-tests the student's argument one claim at a time. Socratic sparring — the avatar finds the weakest link and pushes on it.

**Flow:**

1. Student states their claim on the motion.
2. Avatar challenges — asks for evidence, probes the link, questions the impact. Targets whichever CLI step is weakest.
3. Student responds. Avatar escalates or acknowledges and moves to the next weak point.
4. Cycle repeats until the argument is solid or the student moves on.
5. Inline feedback after each exchange pair — a badge showing which sub-criterion was strengthened or remains weak.

**Avatar behavior:** devil's advocate, not hostile. Explicitly names the CLI framework when coaching. Calibrated per cohort (Surat: gentle with hints; Pyaas: sharp, expects evidence).

**Scoring:** real-time inline. After each exchange pair, score only the Argumentation sub-criteria touched. End of session: brief summary of improvements.

### Mode C — Collaborative Build + Debate

Follows EJ's session model: build the argument together, then the avatar switches sides and they debate.

**Phase 1 — Collaborative (~5 min):**

1. Student picks a motion. Both on the same side.
2. Avatar guides brainstorming through the CLI framework: strongest claim → evidence → link → impact.
3. Together they build 2-3 complete CLI arguments.
4. Avatar signals transition.

**Phase 2 — Debate (~5 min):**

5. Avatar switches to opposing side, using knowledge from Phase 1 to target weaknesses.
6. 45-second turns, 2 rounds.
7. Real-time inline feedback focused on Engagement sub-criteria (Responsive, Depth, Crystallizing).

**Avatar behavior:** warm and collaborative in Phase 1, competitive in Phase 2. Cohort adaptation is strongest here — Surat gets heavily scaffolded fill-in-the-blank prompts in Phase 1; Pyaas gets peer-level brainstorming.

**Scoring:** no scoring in Phase 1. Real-time inline Engagement badges in Phase 2. End of session: combined view showing arguments built vs. how they held up.

## Architecture

### File Structure

```
lib/avatar/
  types.ts              — AvatarMode, AvatarTurn, Round, Transcript, ScoreCard types
  avatarPrompt.ts       — prompt builders per mode, cohort-aware
  avatarScoring.ts      — post-turn/post-round scoring via ChatClient
  cohortAdapter.ts      — language complexity tuning per cohort
  orchestrators/
    sparringOrch.ts     — Mode A: structured rounds with turn alternation
    pushbackOrch.ts     — Mode B: claim-by-claim challenge cycle
    collaborativeOrch.ts — Mode C: brainstorm phase → debate phase

components/avatar/
  AvatarShell.tsx       — top-level wrapper: mode picker → orchestrator → scorecard
  AvatarVoiceBar.tsx    — hold-to-talk + TTS playback (shared across modes)
  TranscriptPane.tsx    — scrolling transcript of the debate
  ScoreCard.tsx         — post-round rubric breakdown (A) or inline badges (B/C)
  ModeCard.tsx          — mode selection cards on the entry screen
```

### Orchestrators

Each orchestrator is a pure-logic module: receives student input + session state, returns the next avatar response instruction + any scoring triggers. The shell handles all I/O.

- **sparringOrch:** manages round counter, turn alternation, timer enforcement, post-round scoring trigger.
- **pushbackOrch:** manages the challenge cycle — analyzes student's latest input, identifies weakest CLI step, generates targeted challenge prompt, triggers inline scoring after each exchange.
- **collaborativeOrch:** manages the two-phase flow. Phase 1: guides brainstorming, tracks arguments built. Phase 2: switches to adversarial, uses Phase 1 knowledge, triggers inline scoring.

### Prompt Architecture

All prompts use the `(input) => { system, user }` builder pattern from `lib/ai/coach.ts`.

**System prompt skeleton (shared):**

```
You are a debate training partner for {cohortDescription}.
The motion is: "{motion}"
You are arguing {FOR/AGAINST}.
The student is arguing {AGAINST/FOR}.

{modeSpecificInstructions}

{cohortAdaptation}

Framework: arguments follow Claim → Link → Impact.
- Claim: an argument in favor of your side
- Link: evidence + reasoning connecting claim to impact
- Impact: why the argument matters beyond the debate
```

**Mode-specific inserts:**

- **A:** "Structured debate. Make real CLI arguments. Do not deliberately lose. Keep turns under {wordLimit} words. Reference the student's previous points."
- **B:** "Socratic coach. Challenge the weakest CLI step. Name which step you're probing. Escalate or acknowledge."
- **C Phase 1:** "Collaborative. Guide brainstorming through claims, evidence, links, impacts. Be warm."
- **C Phase 2:** "Adversarial. Target weaknesses you noticed during collaboration."

**Cohort adaptation:**

| | Surat (5th-7th) | Darshan (8th-10th) | Pyaas (11th-12th) |
|---|---|---|---|
| Vocabulary | Simple, concrete | Standard | Advanced, nuanced |
| Turn word limit | ~80 words | ~120 words | ~150 words |
| Signposting | Explicit | Moderate | Minimal |
| Pushback intensity | Gentle with hints | Direct | Sharp |
| Scaffolding (Mode C) | Fill-in-the-blank | Guided questions | Peer brainstorming |

**Scoring prompt:** separate AI call with fresh context (no conversation history). Receives transcript segment + relevant rubric sub-criteria. Returns Zod-validated score object.

**History management:** each mode maintains a conversation history array (same shape as coach.ts). Mode C carries Phase 1 history into Phase 2 so the avatar remembers what was built.

## Data Model

```typescript
type AvatarMode = "sparring" | "pushback" | "collaborative";
type Cohort = "surat" | "darshan" | "pyaas";
type Side = "for" | "against";
type Speaker = "student" | "avatar";

interface AvatarTurn {
  speaker: Speaker;
  text: string;
  timestamp: number;
  durationMs: number;
}

interface InlineScore {
  criterion: string;
  score: number;          // 0-3
  rationale: string;
  turnIndex: number;
}

interface RoundScore {
  round: number;
  argumentation: { claim: number; link: number; impact: number; weighing: number };
  engagement: { breadth: number; depth: number; responsive: number; crystallizing: number };
  rationales: Record<string, string>;
  focusArea: string;
  focusTip: string;
}

interface AvatarSession {
  id: string;
  mode: AvatarMode;
  motionId: string;
  motionText: string;
  cohort: Cohort;
  studentSide: Side;
  transcript: AvatarTurn[];
  inlineScores: InlineScore[];
  roundScores: RoundScore[];
  phase: "prep" | "collaborative" | "debate" | "review";
  currentRound: number;
  startedAt: number;
  endedAt: number | null;
}

interface ModeConfig {
  turnDurationSec: number;
  wordLimit: number;
  rounds: number;
  prepPauseSec: number;
  scaffoldingLevel: "high" | "medium" | "low";
}
```

## Scoring Rubric

Based on EJ's revised rubric (Style 20% / Argumentation 40% / Engagement 40%). The avatar evaluates content only — no delivery signals.

**Sub-criteria used for avatar scoring:**

Argumentation (40%):
- Claim [/3] — is the argument clear, specific, and arguable?
- Link [/3] — does evidence + reasoning connect claim to impact?
- Impact [/3] — does the argument explain why it matters beyond the debate?
- World Visualization / Weighing [/3] — does the student paint a picture of what the world looks like if their side wins?

Engagement (40%):
- Breadth [/3] — does the student address multiple angles?
- Depth [/3] — does the student develop points beyond surface level?
- Responsive [/3] — does the student engage with the avatar's arguments?
- Crystallizing [/3] — does the student synthesize and clarify the core clash?

Style (20%) is excluded — content-only evaluation means no SPATE, POI, Listening, or Decorum scoring.

## UI/UX

### Entry Point

New "Debate Avatar" card on the home page alongside existing motion cards and practice drills.

### Mode Selection

Three ModeCard components: Sparring, Pushback Coach, Build + Debate. Below: motion picker (reuses existing motion bank) + side picker (Modes A/B only).

### Session Layout

```
┌──────────────────────────────────────┐
│  ← Exit    Mode A: Sparring   R1/3  │
├──────────────────────────────────────┤
│  TranscriptPane                      │
│  ┌─────────────────────────────┐     │
│  │ Avatar: "Homework builds    │     │
│  │ discipline because..."      │     │
│  ├─────────────────────────────┤     │
│  │ You: "But the evidence      │     │
│  │ shows that..."              │     │
│  └─────────────────────────────┘     │
│  [Link strengthened ✓]               │
├──────────────────────────────────────┤
│  🎤 Hold to speak  (0:42)           │
│  or type your response...            │
└──────────────────────────────────────┘
```

### ScoreCard

- **Post-round (Mode A):** full-screen overlay, rubric grid scored /3 per sub-criterion, focus area highlighted, "Next round" / "End session" buttons.
- **Inline (Modes B/C):** small pill badges below relevant exchanges. Tap to expand rationale.

### Session Summary (all modes)

Full transcript (collapsible) + score breakdown + "focus for next time" + "Try again" / "Pick another mode" buttons.

### Phase Transition (Mode C)

Interstitial screen: "Ready to debate? The avatar will now argue against you." + "Let's go" button.

### Responsive

Mobile-friendly — transcript full-width, voice bar sticky bottom. Follows existing Tailwind responsive patterns.

## Integration Points

| System | Change | Risk |
|---|---|---|
| `lib/flowMotions.ts` | Import motion bank (read-only) | None |
| `lib/ai/claude.ts` | Used as-is | None |
| `lib/ai/deepgramLiveSession.ts` | Imported for STT | None |
| `lib/voice/playSpeech.ts` | Imported for TTS | None |
| `app/api/deepgram/token/route.ts` | Reused for token minting | None |
| `app/api/speak/route.ts` | Reused for TTS | None |
| `components/FlowDeck.tsx` | Add Avatar entry card | Minimal |
| `lib/state/` | New avatarSession.ts | None |

### New API Routes

- `app/api/avatar/turn/route.ts` — avatar response generation. Receives transcript + mode config, returns response text.
- `app/api/avatar/score/route.ts` — scoring. Receives transcript segment + rubric config, returns Zod-validated score.

### Storage

`AvatarSession` persists to localStorage under `constructive:avatar:v1`. Same pattern as flow progress storage.

### Dependencies

No new external dependencies. Builds on existing Anthropic Claude + Deepgram integrations.

## Testing Strategy

- **Orchestrator unit tests:** pure logic — test turn sequencing, phase transitions (Mode C), round counting (Mode A), termination conditions. No voice/UI mocking.
- **Prompt builder tests:** verify each mode/cohort combination produces expected prompt structure.
- **Scoring tests:** mock ChatClient, verify Zod validation catches malformed scores, verify focus-area selection picks lowest sub-criterion.
- **Component tests:** AvatarShell renders mode picker; selecting mode + motion mounts correct orchestrator. TranscriptPane renders turns. ScoreCard renders rubric grid.
- **Integration tests:** one per mode with mocked AI responses — student input → avatar response → scoring → UI update.
