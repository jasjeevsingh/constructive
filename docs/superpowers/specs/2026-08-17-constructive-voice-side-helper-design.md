# Constructive — Voice Side Helper Design

**Date:** 2026-08-17
**Status:** Approved for planning
**Scope:** Branch 3 of 3 in the beta-feedback series. Adds a live, interruptible voice helper the
student can talk to alongside an activity, aware of what is on the page. Completes the second half
of beta feedback item 1 — the mode split (hold-to-talk = transcription only) shipped in branch 1.

## Background

A beta user reported that voice mode "transcribes speech into text, feeds that into the same
submission interface, then reads feedback back aloud — designed for accessibility/preference, not
true back-and-forth conversation. The agent speaks immediately after input, which blocks the user
from speaking again right away." They asked for two distinct modes:

1. **Hold to talk** — pure speech-to-text. **Shipped in branch 1**: `autoSubmit` was removed from
   `VoiceOrTextInput` and all three unconditional `speakCoach(...)` calls were deleted.
2. **Conversational side helper** — "a side helper the user can actively engage with to talk through
   and refine their thinking, separate from the main activity flow." It "should also of course have
   full context of what's on the page." This branch.

Branch 1 deliberately preserved `lib/voice/playSpeech.ts`, `app/api/speak/route.ts`, and
`app/api/transcribe/**` for this work. `speakCoach` and `/api/speak` currently have **no product
callers** — referenced only by `tests/app/api/speak.test.ts`.

### What the installed SDK gives us (verified against `@deepgram/sdk@3.13.0`)

- **`AgentLiveClient`** (`deepgram.agent()`, marked `@beta`) runs STT + LLM + TTS over one WebSocket
  to `wss://agent.deepgram.com`. Config (`AgentLiveSchema`) takes
  `agent.listen.provider` (Deepgram STT model), `agent.think.provider` — **`"anthropic"` is a
  first-class provider type** — with `agent.think.prompt` as the system prompt, and
  `agent.speak.provider` (Aura). Methods include `configure()`, `updatePrompt()`,
  `injectAgentMessage()`, `keepAlive()`.
- **Events** (`AgentEvents`): `Open`, `Close`, `Error`, `Audio`, `Welcome`, `SettingsApplied`,
  `ConversationText` (`{role, content}` — carries **both** user and agent turns, so we get a
  transcript for free), `UserStartedSpeaking`, `AgentThinking`, `AgentAudioDone`,
  `FunctionCallRequest`, `InjectionRefused`.
- **Barge-in is half-solved for us.** Deepgram detects interruption server-side and stops
  generating, emitting `UserStartedSpeaking`. There is **no `clear()`** on `AgentLiveClient` (unlike
  `SpeakLiveClient`), so dropping already-queued and playing audio is our client's job. This is the
  specific work that stops the agent talking over the student.
- **Browser auth**: `deepgram.auth.grantToken()` → `{ access_token, expires_in }` (~30s TTL). The
  SDK authenticates sockets via the `["token", key]` WebSocket subprotocol.

### The obstacle: the helper cannot see the page today

- `components/ui/app-shell.tsx` is a **server component** holding no app state.
- `motion`, `side`, and `stage` live in `FlowShell` local state via
  `useFlowProgress(motion.id, startSide)`; persisted under `constructive:flow:v1`.
- The student's working claim and the coach transcript live **deeper still**, in `ClaimStage` local
  state (`turns`, `lastStudentClaim`), and are **never persisted**. `onComplete(mappedClaimId)` is
  the only thing that escapes.
- `ClaimStage` is mounted from **two** hosts (`FlowShell` and `PracticeShell`), so any solution must
  work for both.

Reading localStorage alone therefore yields motion/side/stage but **not** the live claim or coach
transcript. A publish mechanism is required.

## Decisions (from brainstorming)

- **Transport:** Deepgram Voice Agent API, browser connects directly with an ephemeral token.
- **Thinking model:** Claude, via `agent.think.provider.type: "anthropic"`.
- **Mic:** live while the panel is open (barge-in is meaningless otherwise), with a ~90s idle
  auto-disconnect as a **cost** guard and one-tap resume. The app is for individual student use, so
  the idle guard is about billing, not privacy.
- **Posture:** the helper coaches and never hands over a finished claim, link, or impact — the same
  line branch 2 drew — and stays scoped to the debate task.
- **Availability:** inside activities only (`FlowShell` and `PracticeShell`), not the deck.

## Goals

- A student can hold a real spoken conversation to think out loud, and can interrupt the helper.
- The helper knows the motion, the side, the stage, and what the student has said so far.
- Nothing about the existing hold-to-talk transcription changes.
- The API key never reaches the browser.

## Non-goals

- No change to `VoiceOrTextInput`, to any stage's own coach call, or to `/api/coach`.
- No helper on the landing/deck views.
- No function-calling tools (the SDK supports them; page context goes in the prompt instead).
- No persistence of helper conversations across reloads.
- No replacement of `speakCoach`/`/api/speak` — left as-is, still callerless.
- Not an accessibility replacement for hold-to-talk; the two modes coexist by design.

## Architecture

### 1. Ephemeral token — `app/api/deepgram/token/route.ts`

Fills the pre-carved empty directory. Server-only: reads `DEEPGRAM_API_KEY`, calls
`deepgram.auth.grantToken()`, returns `{ access_token, expires_in }`. Returns 503 when the key is
unset so the UI can degrade gracefully rather than crash. The key itself is never sent to the client.

### 2. Page context — `lib/helper/context.ts` + `components/helper/HelperContextProvider.tsx`

A narrow, serializable shape:

```
HelperContext = {
  activity: "journey" | "practice";
  motion: string;
  side: "for" | "against" | null;
  stage: string;             // "read" | "claim" | "link" | "impact", or the drill part
  claimDraft: string | null; // the student's latest claim attempt
  transcript: { role: "student" | "coach"; text: string }[];  // the stage coach exchange
}
```

- `HelperContextProvider` is a client component holding this state, exposing
  `usePublishHelperContext(partial)` (an effect-based publisher) and `useHelperContext()` (reader).
- `FlowShell` publishes `activity`/`motion`/`side`/`stage`. `PracticeShell` publishes
  `activity`/`stage` and the drawn item's motion. `ClaimStage` publishes `claimDraft` and
  `transcript` — **via the hook, so its props are unchanged** and both hosts keep working untouched.
- `renderHelperContext(ctx): string` turns it into the prompt block. Pure and unit-testable.

### 3. The agent session — `lib/helper/agentSession.ts` + `lib/helper/helperPrompt.ts`

`helperPrompt(ctx)` builds `agent.think.prompt` from three parts: the coaching posture (reusing
`renderRubric()` from `@/lib/claimRubric`, so the helper holds the same standard as the stage coach
and the generator), the scope/refusal rules, and `renderHelperContext(ctx)`.

The posture rules, mirroring `lib/prompts/refine.ts` and the branch-2 claim prompt:
- Ask questions and reflect back; **never** write the student's claim, link, or impact for them.
- One question at a time; keep turns short — this is speech, not an essay.
- Stay on the debate task; decline other topics warmly and redirect.
- Never read the rubric aloud as a list.

`agentSession.ts` owns the socket lifecycle: fetch token → `configure()` → stream mic audio → handle
events. It is written as a thin imperative wrapper around an **injectable** socket factory so tests
can drive it with a fake.

### 4. Agent event handling — `lib/helper/agentMachine.ts` (pure)

A pure reducer mapping events to UI state, so the logic is testable without a socket:

```
HelperState = { phase: "idle"|"connecting"|"listening"|"thinking"|"speaking"|"error";
                turns: {role:"student"|"helper"; text:string}[];
                error: string | null }
```

- `Welcome`/`SettingsApplied` → `listening`
- `ConversationText` → append a turn (role mapped from the event)
- `AgentThinking` → `thinking`; `Audio` → `speaking`; `AgentAudioDone` → `listening`
- **`UserStartedSpeaking` → `listening` AND emit a `dropAudio` effect** — the reducer returns the
  effect; the session performs it. This keeps barge-in testable as pure logic.
- `Error`/`Close` → `error`/`idle`

### 5. Audio playback — `lib/helper/audioQueue.ts`

Queues PCM chunks from `Audio` events through Web Audio and exposes `drop()` to stop and clear
everything immediately. `drop()` is what `UserStartedSpeaking` triggers. Deliberately separate from
`lib/voice/playSpeech.ts`, whose module-global singleton is the wrong shape here and which branch 1
preserved untouched.

### 6. UI — `components/helper/HelperPanel.tsx`

Rendered inside `FlowShell` and `PracticeShell` (not `AppShell`, which is a server component and
also wraps the deck). Collapsed by default as a small "Talk it through" affordance; expanded it
shows the live transcript, a phase indicator (listening / thinking / speaking), and a stop control.
Opening connects; closing disconnects. Idle ≥90s with no speech auto-disconnects with a one-tap
resume. When the token route returns 503, the affordance renders disabled with a plain explanation
rather than failing on click.

## Error handling

- No `DEEPGRAM_API_KEY` → token route 503 → panel disabled with an explanation. No crash.
- Token fetch or socket failure → `error` phase with a retry; the activity is entirely unaffected.
- Mic permission denied → explanatory message, panel stays closed.
- Socket close mid-conversation → `idle` with the transcript preserved on screen.
- Idle auto-disconnect → clearly labelled, one tap to resume.
- The helper is strictly additive: every failure path leaves the student able to finish the activity.

## Testing

Baseline to preserve: **247 tests / 59 files green**, `npx tsc --noEmit` clean, `npm run build`
succeeds.

**Honest limitation:** a live WebSocket carrying audio cannot be meaningfully unit-tested in this
repo's Vitest/jsdom setup. Everything around it is testable, and is tested:

- `renderHelperContext` — includes motion, side, stage, claim draft, transcript; omits empty fields
  cleanly.
- `helperPrompt` — contains all four rubric criterion names, the never-write-it-for-them rule, and
  the rendered context.
- `agentMachine` — every event transition; `ConversationText` appends both roles;
  **`UserStartedSpeaking` returns the `dropAudio` effect** (the barge-in guarantee, as pure logic).
- `audioQueue` — `drop()` clears queued chunks and stops playback (driven with a stubbed
  `AudioContext`).
- Token route — 200 shape with a key set, 503 with it unset, and the raw key never in the response.
- `HelperContextProvider` — publishing from a child updates the reader; `ClaimStage`'s props are
  unchanged and `FlowShell`/`PracticeShell` tests pass without edits.
- `HelperPanel` — renders each phase, disabled state on 503, transcript rendering, stop control.

**What only a human can verify** (to be reported as unverified, never claimed as tested): the actual
spoken loop, latency, and that interrupting the helper mid-sentence really cuts its audio.

## Architecture / files

**Create:** `app/api/deepgram/token/route.ts` · `lib/helper/context.ts` ·
`lib/helper/helperPrompt.ts` · `lib/helper/agentMachine.ts` · `lib/helper/audioQueue.ts` ·
`lib/helper/agentSession.ts` · `components/helper/HelperContextProvider.tsx` ·
`components/helper/HelperPanel.tsx` · plus tests.

**Modify:** `components/FlowShell.tsx` and `components/PracticeShell.tsx` (mount provider + panel,
publish context) · `components/stages/ClaimStage.tsx` (publish claim draft + transcript via the
hook; **props unchanged**).

**Untouched:** `components/VoiceOrTextInput.tsx`, `lib/voice/**`, `app/api/speak/route.ts`,
`app/api/transcribe/**`, `lib/ai/**`, `/api/coach`, `lib/claimRubric.ts` (consumed, not changed),
`content/**`, `components/FlowDeck.tsx`, `components/ui/app-shell.tsx`.

## Open questions

None blocking. Function-calling tools for richer context, persisting helper conversations, and
offering the helper on the deck are deliberate follow-ups this design leaves room for.
