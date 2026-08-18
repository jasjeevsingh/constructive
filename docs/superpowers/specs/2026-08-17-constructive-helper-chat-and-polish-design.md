# Constructive — Helper Chat + Interaction Polish Design

**Date:** 2026-08-17
**Status:** Approved for planning
**Scope:** Two related pieces of work. (1) Make the side helper a **text chat first**, with the live
voice call as an escalation inside it — correcting a miss in the voice-helper branch. (2) A broad
interaction-polish pass so the app feels alive to students aged 10-18, starting with button hover,
which today has none.

## Background

### The helper was built voice-only, and shouldn't have been

The original beta feedback asked for two distinct modes: hold-to-talk as pure transcription, and a
"**conversational chatbot**: a side helper the user can actively engage with to talk through and
refine their thinking." The voice-helper branch delivered a live Deepgram voice agent and nothing
else — opening the panel immediately requests a microphone and opens a billed audio socket.

The user's correction: *"the helper isn't just a voice call, it's a chatbot too that the student can
go back and forth with, and then if they want to do a voice call they can."* Text is the default
interaction; voice is an option the student chooses.

This is also better on its own terms: text costs a fraction of live audio, needs no microphone
permission, works in a quiet classroom, and leaves a readable thread. Voice should be the thing you
escalate *to*, not the toll you pay to say hello.

### Buttons have no hover motion

`components/ui/button.tsx` declares only `transition-colors`. `Pressable`
(`components/ui/motion.tsx`) does have `whileHover={{ scale: 1.02 }}`, but it is used on deck
*cards* and never on buttons. So the most-clicked element in the app is its least responsive one.

`app/layout.tsx` already wraps everything in `<MotionConfig reducedMotion="user">`, so every
framer-motion animation honours the OS setting globally. Only CSS-only work needs explicit
`motion-reduce:` guards.

## Decisions (from brainstorming)

- **Polish scope:** broad — buttons everywhere, the helper and feedback panels, deck card hover,
  cross-fade between stages, and real celebratory beats at the two moments that earn them.
- **Visual register:** middle, serving the whole 10-18 range. Keep the existing Fraunces/DM Sans
  character; add warmth and life. Nothing a 17-year-old would be embarrassed to use.

## Goals

- A student can type to the helper and get a reply, without touching a microphone.
- Starting a voice call continues the *same* conversation rather than beginning a new one.
- Every interactive element gives immediate, proportionate feedback on hover and press.
- The app's two genuine achievement moments feel like achievements.

## Non-goals

- No change to the on-page stage coaches, `/api/coach`, or the claim rubric.
- No change to hold-to-talk transcription (`VoiceOrTextInput`).
- No new colour palette, type scale, or illustration — the register decision was "middle", not
  "refresh".
- No persistence of helper conversations across reloads.
- No change to the Deepgram transport, the token route, or the barge-in mechanics.

---

## Part 1 — Helper text chat

### 1.1 `helperPrompt` gains a mode and prior turns

`lib/helper/helperPrompt.ts` is written for a spoken agent — "This is speech, not writing." That is
wrong for a text thread, and it is the only line that differs. Parameterize rather than fork, so the
rubric, the never-write-their-argument rule, the on-task carve-out, and the distress guidance stay
in exactly one place:

```
helperPrompt(ctx: HelperContext, mode: "voice" | "text" = "voice", priorTurns: HelperReplyTurn[] = []): string
```

- `mode: "voice"` — unchanged from today ("This is speech, not writing. Keep every turn short…").
- `mode: "text"` — "Keep replies short: two or three sentences. Write plain sentences, no headings,
  bullet lists, or markdown."
- `priorTurns` — rendered into the prompt when non-empty. This is what makes a voice call continue
  the text conversation: the Deepgram Agent API has no way to preload history other than the system
  prompt, so the transcript goes in there at `configure()` time.

### 1.2 Text route — `app/api/helper/route.ts`

`POST { messages: HelperReplyTurn[], context: HelperContext }` → `{ reply: string }`.

- Uses `getChatClient()` and `helperPrompt(ctx, "text")` as the system prompt.
- The prior turns become `history` and the newest student message becomes `user`, using the
  multi-turn `ChatClient.complete({ system, user, history })` built in the claim-coaching branch.
- The helper replies in **plain prose**, not JSON — unlike `/api/coach`, which demands a JSON
  envelope. No parsing, no schema on the reply.
- Bounded: at most 40 turns, each at most 2000 characters, matching the caps pattern already used
  by `lib/feedback/limits.ts` and `lib/ai/limits.ts`.
- `400` on invalid input, `503` when no AI key is configured, so the panel degrades with a message
  instead of hanging.

### 1.3 One transcript across both modes

`lib/helper/agentMachine.ts`'s `initialHelperState()` gains an optional starting transcript:

```
initialHelperState(turns: HelperReplyTurn[] = []): HelperState
```

and `createAgentSession` accepts `initialTurns`, seeding its reducer. So when a student starts a
voice call mid-conversation, the session's state *begins* with what they already typed, the panel
keeps rendering one continuous thread, and no merge logic is needed anywhere.

Spoken turns arrive as `ConversationText` and append to that same list, so ending a call leaves the
whole exchange readable in the panel.

### 1.4 Panel shape

`HelperPanel` becomes text-first:

- **Collapsed:** `💬 Talk it through` (was `🎙`).
- **Open, no call:** the message thread, a textarea, **Send**, and a **Start voice call** button.
  Nothing touches the microphone or opens a socket until that button is pressed.
- **During a call:** the same thread, plus the live phase indicator (Connecting/Listening/Thinking/
  Speaking) and **End call**. The text box is hidden while the call is live — two simultaneous input
  channels into one agent is confusing, and the mic is already open.
- **Ending a call** returns to the text composer with the full transcript intact.

`HelperPanelView` stays pure and gains the text-mode props; all socket, `AudioContext`, and
microphone wiring stays in `HelperPanel`, exactly as before.

---

## Part 2 — Interaction polish

### 2.1 Buttons (the headline fix)

`Button` is rendered inside server components across the app. Converting it to a framer-motion
component would force `"use client"` app-wide for a hover effect, so this is **CSS on the primitive**:

- Base: a 1px lift and a softening shadow on hover, pressing flat on `:active`, ~150ms.
- Guarded with `motion-reduce:transform-none motion-reduce:transition-none`.
- `disabled:pointer-events-none` already prevents a disabled button from reacting.

Because it lands on the shared primitive, every button in the app improves at once.

`Pressable`'s hover scale is retuned to sit in the same family as the button lift, so cards and
buttons read as one system rather than two.

### 2.2 Deck cards

Motion cards already stagger in via `Pressable`. Add a hover border-and-shadow lift so a card
telegraphs that it is clickable before the cursor lands.

### 2.3 Stage transitions

`FlowShell` currently swaps stage components instantly. Wrap the active stage in `AnimatePresence`
with a short cross-fade so moving Read → Claim → Link → Impact feels like progress rather than a
page replacement. **The existing `FlowShell` tests must pass untouched** — if a test needs `findBy*`
where it used `getBy*`, that is acceptable; if a test's meaning has to change, the animation is
wrong.

### 2.4 Celebration beats

Two moments earn one: the bridge holding, and finishing both sides of a motion. Today both are a
line of text. Give each a brief, tasteful beat — a spring entrance and a short flourish — that does
not block the student from continuing. Nothing that a 17-year-old would find childish, and nothing
that fires more than once per achievement.

### 2.5 Panel and message entrances

The helper and feedback panels slide up on a spring instead of appearing. Helper messages rise in as
they arrive, and a typing indicator shows while the helper is composing — which matters more in text
than in voice, where the phase label already covers it.

---

## Error handling

- No AI key → `/api/helper` 503 → the panel shows a plain "helper unavailable" and keeps the thread.
- Network failure on send → error state, **the student's typed text is preserved** (the same rule the
  feedback panel already follows).
- Voice call failure → unchanged from the voice-helper branch; the text thread remains usable, so a
  broken microphone no longer costs the student the whole helper.
- Reduced motion → every animation degrades to an instant state change, via `MotionConfig` for
  framer and `motion-reduce:` for CSS.

## Testing

Baseline to preserve: **334 tests / 70 files green**, `npx tsc --noEmit` clean, `npm run build`
succeeds.

- `helperPrompt` — text mode drops the speech instruction and forbids markdown; voice mode is
  unchanged; prior turns are rendered when supplied and omitted when empty; both modes still carry
  all four rubric criteria, the never-write-it rule, the on-task carve-out, and the distress guidance.
- `/api/helper` — replies on a valid request; 400 on an empty message, too many turns, or an
  over-long turn; 503 with no key configured; the system prompt sent to the client contains the
  page context.
- `initialHelperState(turns)` — seeds the transcript; `createAgentSession({initialTurns})` starts
  from it, so a voice call continues the text thread.
- `HelperPanelView` — text composer renders when open and not in a call; Send is disabled while
  empty or sending; a failed send preserves the text; the call controls replace the composer during
  a call and the thread stays visible; the collapsed trigger reads "Talk it through".
- `Button` — the hover classes are present on the primitive (a rendering assertion, since jsdom
  cannot evaluate `:hover`).
- `FlowShell`, `PracticeShell`, `FlowDeck`, `LinkCard` — all existing tests pass, proving the
  polish is additive.

**Not covered by tests:** how any of it actually *feels*. Hover, spring timing, and the celebration
beats need a human looking at a screen; the suite can only prove the classes and components are
wired. The live voice loop remains untested for the reasons given in the voice-helper spec.

## Architecture / files

**Create:** `app/api/helper/route.ts` · `lib/helper/limits.ts` · tests for each.

**Modify:** `lib/helper/helperPrompt.ts` (mode + prior turns) · `lib/helper/agentMachine.ts`
(seeded transcript) · `lib/helper/agentSession.ts` (`initialTurns`, text-aware prompt) ·
`components/helper/HelperPanel.tsx` (text-first) · `components/ui/button.tsx` (hover) ·
`components/ui/motion.tsx` (harmonized hover) · `components/FlowDeck.tsx` (card hover) ·
`components/FlowShell.tsx` (stage cross-fade, completion beat) · `components/LinkCard.tsx`
(bridge-holds beat) · `components/feedback/FeedbackPanel.tsx` (entrance).

**Untouched:** `components/VoiceOrTextInput.tsx`, `lib/voice/**`, `app/api/speak/**`,
`app/api/transcribe/**`, `app/api/coach/**`, `app/api/feedback/**`, `lib/ai/**` (consumed, not
changed), `lib/claimRubric.ts`, `content/**`, `lib/state/**`, `middleware.ts`,
`app/api/deepgram/token/**`.

## Open questions

None blocking. Persisting helper threads across reloads, and letting the student type *during* a
voice call, are deliberate follow-ups this design leaves room for.
