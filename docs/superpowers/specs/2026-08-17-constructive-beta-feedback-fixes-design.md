# Constructive — Beta Feedback Pass Design

**Date:** 2026-08-17
**Status:** Approved for planning
**Scope:** The first of three branches addressing beta-user feedback. Covers the bounded fixes:
motion capitalization, an internal feedback link, missing stage context, starting-side choice,
the voice mode split (transcription only), the mechanical half of the bridge-feedback
repetition bug, and three related bugs found during verification. The claim coaching loop +
rubric (Branch 2) and the Deepgram conversational side helper (Branch 3) are **not** in scope.

## Background

Four beta users tested the app and reported seven issues. Each was verified against the code
before this spec was written; all seven reproduce. Verification also surfaced three additional
bugs that produce symptoms the testers described. This branch fixes everything that does not
depend on a claim-quality rubric.

The app is a Next.js 14 App Router debate-coaching tool. A student picks a motion from
`content/flow-motions.json` (or generates a fictional-universe one), then works
**Read → Claim → Link → Impact** for one side, then the other. `FlowShell` drives the journey;
`PracticeShell` drills a single stage as reps. Both render through `AppShell`. Coach feedback
goes through a single stateless `/api/coach` route.

## Goals

- Stop the app speaking over the user: hold-to-talk becomes pure transcription.
- Let a student choose which side to argue first, and stop calling the locked side "soon".
- Show the student the claim and motion they are being asked to reason about.
- Make bridge feedback stop repeating itself, as far as is possible without a rubric.
- Give beta testers a one-click way to report problems, removable without a code change.
- Fix three verified bugs that produce reported symptoms: the practice Link key collision,
  generated-universe id reuse, and the FOR-biased deck status.

## Non-goals

- No multi-turn claim coaching and no rubric (Branch 2).
- No conversational side helper, no Deepgram Agent API, no streaming TTS (Branch 3).
- No removal of `lib/voice/playSpeech.ts` or `/api/speak` — Branch 3 needs both.
- No change to `gradeBridge`'s deterministic algebra — only to how its result is presented.
- No rewrite of the authored candidate bank (deferred to Branch 2's quality work).
- No feedback link on `/gate` (pre-auth, deliberately excluded).

---

## 1. "House" capitalization

**Verified:** `lib/prompts/generateMotions.ts:9` contains no capitalization rule, and its one
worked example is lowercase — `(e.g. "This house believes the Hidden Villages do more harm
than good")` — actively teaching the model the wrong casing. Seed content in
`content/motions.json` and `content/flow-motions.json` is clean (all 7 motions use
`This House would`). No post-processing of motion text exists anywhere:
`lib/ai/generate.ts:63-67` returns `data.motions` untouched and `lib/generatedNormalize.ts`
never inspects motion text.

**Fix — both prompt and deterministic normalization.** The prompt fix is mandatory (few-shot
casing in an example outweighs an abstract instruction, and leaving it means the normalizer
fights the prompt on every request), but a prompt alone cannot be regression-tested. The
normalizer gives a real test and also repairs universes already in localStorage.

- `lib/prompts/generateMotions.ts:9` — capitalize the example; add a rule bullet:
  `Motions must begin "This House believes/would ..." with "House" capitalized.`
- `lib/generatedNormalize.ts` — new exported
  `normalizeMotionText(motion: string): string`, replacing `/\bthis house\b/gi` with
  `"This House"`. It must **not** touch the following verb, preserving the seed convention
  `This House would` (capital House, lowercase verb). Idempotent.
- Apply at two sites: `components/UniverseGenerator.tsx:53` (the persist path) and inside
  `assembleFlowMotion` (`lib/generatedNormalize.ts:64`), so already-persisted cards are
  corrected when opened. Applying at both is cheap and idempotent.

## 2. Internal feedback link

**Verified:** no feedback or support link exists anywhere. `components/ui/app-shell.tsx:11` is
the single insertion point covering every activity surface — `app/page.tsx` → `FlowDeck`
(deck, generator, practice deck), `FlowDeck.tsx:42` → `FlowShell` (journey), and
`FlowDeck.tsx:43` → `PracticeShell` (drills) all render through it. The repo has **zero**
`NEXT_PUBLIC_*` variables today; all env access is server-side per `.env.example:1`.

**Fix.** A footer rendered inside `AppShell`, after `<main>`, from a new
`NEXT_PUBLIC_FEEDBACK_URL`:

- Renders **nothing** when the variable is unset. Removing the link at retreat time is then a
  config change, not a code change.
- Label is **"User feedback"** (explicitly not "customer support"), with a short muted hint.
- `target="_blank"` + `rel="noopener noreferrer"`.
- Styling follows existing conventions: `border-t border-border` mirroring the header's
  `border-b` (`app-shell.tsx:6`), container `mx-auto max-w-5xl px-4 py-8 sm:px-6` matching
  `<main>`, and muted text matching `Landing.tsx:30`
  (`inline-flex items-center gap-1.5 text-xs text-muted-foreground`). The codebase uses
  `underline` nowhere, so the link should not introduce it.
- The app is already password-gated for every path except `/gate` and `/api/auth`
  (`middleware.ts:5-17`), so anyone who can see the footer is already a tester. No additional
  internal-only gating is needed.

**Operational note:** the link is inert until the user creates a form and sets the variable.

## 3. Missing claim / motion context

**Verified:** this is a render gap, not a data gap. `drawItem` supplies a real non-empty claim
(`lib/practice.ts:45-50`) and `PracticeShell.tsx:69-74` passes it through, but
`ImpactStage.tsx:42-53` never references `claim` or `motion` in its render body — both are
used only in the `/api/coach` request at line 32 — while its own prompt (line 44) asks
"Why does this **claim** matter". `ClaimStage.tsx:49-55` likewise never renders `motion`.
The seeded bank is healthy: 4 motions × 3 claims per side, every claim non-empty.

**Fix.**

- `components/stages/ImpactStage.tsx` — render a context block above the input showing the
  claim, styled like the existing "We'll carry this forward as" card
  (`ClaimStage.tsx:60-64`). This fixes the journey as well as the drill: during Impact the
  claim was chosen two stages earlier and is equally invisible there.
- `components/PracticeShell.tsx` — show the drawn motion in the shell header (which currently
  shows only `TITLES[part]`). This restores context for the Claims drill **without** making
  the motion redundant in the journey, where `FlowShell.tsx:48-50` already shows it in the
  card header. Shown for the claim and impact drills; the Link drill already renders claim and
  impact through `Bridge`.
- `ClaimStage` itself is left alone — the motion reaches it via whichever shell wraps it.

## 4. Starting-side choice + "soon" label

**Verified:** `lib/state/flowProgress.ts:19` hardcodes `side: "for"` in `emptyFlowProgress()`.
The only writer of `side: "against"` is `components/FlowShell.tsx:78`, inside the
FOR-complete branch (`:38`), so AGAINST is reachable only after finishing FOR. The side pills
(`FlowShell.tsx:21-35`) are inert `Badge`s with no click handlers, and `FlowDeck.tsx:59` opens
a motion with no side argument. The `soon` string is a single site: `FlowShell.tsx:34`.
`lib/state/flowMachine.ts:21-23`'s `againstUnlocked` is dead in the app (tests only).

**Fix.**

- `lib/state/flowProgress.ts` — `emptyFlowProgress(startSide: Side = "for")`. The default
  keeps every existing caller and test valid. `isValidEntry` is unchanged, so all persisted
  progress survives; the storage key stays `constructive:flow:v1`.
- `lib/state/useFlowProgress.ts` — thread `startSide` through to `loadFlowProgress`.
- `components/FlowDeck.tsx` — `active` becomes `{ motion, side } | null`. Clicking a motion
  **with no saved progress** shows a compact side-choice panel ("Which side do you want to
  argue first?") with two buttons and a cancel; a motion **already in progress** opens
  directly at its saved side with no prompt. This is a plain panel rendered in place of the
  deck, not a modal — no focus trap, no portal, keeping accessibility simple.
  `UniverseGenerator`'s `onOpen` signature changes to match.
- `components/FlowShell.tsx` — accept the chosen `startSide`; generalize `forDone` into
  `currentSideDone`; generalize the two pills so the lock lands on whichever side has not been
  started; generalize the completion copy to name the actual side rather than hardcoding
  "FOR side complete" / `side: "against"`.
- The locked pill reads **`🔒 AGAINST · Part 2`** (or `🔒 FOR · Part 2` when the student
  started against). `tests/components/FlowShell.test.tsx:48` asserts only `/🔒/`, so it
  survives.
- `lib/state/flowMachine.ts` — replace `againstUnlocked(forComplete)` with a symmetric
  `otherSideUnlocked(progress)`.
- `lib/state/flowProgress.ts:71,77-82` + `components/FlowDeck.tsx:22-30` — `MotionStatus`
  `"for-done"` becomes `"one-side-done"`, with the deck label changing from "FOR side done"
  to a side-agnostic "One side done". Without this, a student who argues AGAINST first and
  finishes it still reads "in progress" on the deck.

## 5. Voice mode split — hold-to-talk is transcription only

**Verified:** `components/VoiceOrTextInput.tsx:15` declares `autoSubmit = true` as a default
prop, and **no call site overrides it** (`RestateStep.tsx:53`, `KeywordStep.tsx:74`,
`ClaimStage.tsx:55`, `ImpactStage.tsx:45`), so line 223's `if (autoSubmit) onSubmit(finalText)`
fires the coach the instant the mic is released. Three components then call
`void speakCoach(...)` unconditionally — `RestateStep.tsx:39`, `KeywordStep.tsx:42`,
`LinkCard.tsx:53` — with no enable flag, no mute, and no barge-in
(`playSpeech.ts:5-42` plays a whole MP3 blob and only cancels when a *new* `speakCoach`
starts). A repo-wide grep for `mute|volume|ttsEnabled|voiceEnabled` returns zero product hits.
`ClaimStage` and `ImpactStage` set a reaction but do not speak, so the behavior is also
inconsistent.

**Fix.**

- Delete the three `speakCoach(...)` calls and their imports.
- **Remove the `autoSubmit` prop entirely** rather than flipping its default. Releasing the
  mic now only ever fills the textarea; the student reviews and presses submit. One behavior,
  no flag, and all five call sites stay unchanged. (YAGNI — a per-site override has no
  current caller.)
- `lib/voice/playSpeech.ts`, `app/api/speak/route.ts`, and the Deepgram live-session
  infrastructure are **retained untouched** for Branch 3.

This is the "break the hardcoded voice response behavior" item; the conversational helper that
replaces it is Branch 3.

## 6. Bridge feedback repetition — mechanical half

**Verified.** The exercise is the Link "build the bridge" activity (confirmed with the user).
Its grading is **100% deterministic and rule-based, not AI**: `lib/linkGrade.ts:18-45` maps
placed ids × authored verdicts to a fixed status enum, and every rendered string is a hardcoded
template plus the authored `explanation` (`components/LinkCard.tsx:86-93`,
`components/stages/Bridge.tsx:50-53`). The summary has exactly **two** failure branches —
"Not yet — a strong bridge needs both evidence and reasoning." and "Not yet — check the
flagged planks." — which is the reported "same two feedback points". Caching and temperature
are ruled out: no `revalidate`, no `unstable_cache`, no prompt caching, and the only AI in the
exercise is the optional "Talk this through" reaction.

Two structural amplifiers: every one of the 24 authored claims has the identical candidate
shape (`reasoning/fits`, `evidence/fits`, `evidence/great-but-wrong`, `reasoning/doesnt-fit`),
and candidates are never shuffled (`Bridge.tsx:32-33` preserves authored order).

**Fix (this branch — everything not requiring a rubric).**

- Shuffle candidate order per rep so the answer is not always "the first two". The shuffle must
  be injectable for deterministic tests, matching the `rand` pattern already established in
  `lib/practice.ts:23-27`.
- Make the summary name **which** plank failed and vary with attempt count, instead of
  collapsing every failure into one of two sentences. This requires an attempt counter in
  `LinkCard` state.
- `gradeBridge` is **not** changed — only the presentation layer above it. This keeps
  `tests/lib/linkGrade.test.ts:17-60` fully valid.

**Test impact:** `tests/components/LinkCard.test.tsx:33,51` assert the literal copy
`/bridge holds/i` and `/both/i`. These must be rewritten to assert behavior (a failure is
reported, the specific plank is named) rather than exact strings. Line 62-67 locks in
localStorage restore-on-mount and must keep passing — resume-in-place is deliberately
preserved.

Varying the authored candidate bank, and routing feedback through the coach with an attempt
counter, are deferred to Branch 2 where the rubric defines what good looks like.

## 7. Three additional verified bugs

These were not reported as separate items but each produces a symptom the testers described.

**7a — Practice Link key collision.** `lib/practice.ts:48` builds the drill scenario id as
`practice:${motion.id}`, dropping the claim id (the journey uses `${motionId}:${claim.id}` per
`lib/flowMotions.ts:32-33`). Since every claim reuses ids `c1..c4`, all claims of one motion
collide on a single `useLinkProgress` key (`lib/state/linkProgress.ts:39-41`), so a new rep
**restores the previous rep's plank placements** and pressing Test reproduces the previous
result. This is a second driver of item 6's reported symptom.
Fix: `practice:${motion.id}:${claim.id}`. `tests/lib/practice.test.ts` id assertions update.

**7b — Generated-universe id reuse → blank stage.** `motionCardId` is
`gen:<slug>:<index>` (`lib/generatedNormalize.ts:15-17`). Regenerating the same universe
overwrites the store key with new motions **reusing the same ids**, while flow progress under
`constructive:flow:v1` is keyed by those ids and never cleared — not on regenerate, and not by
`removeUniverse` (`UniverseGenerator.tsx:102-106`). The stale `mappedClaimId` then fails the
lookup at `FlowShell.tsx:19`, and because both the link and impact stages are gated on
`mappedClaim` being non-null (`FlowShell.tsx:106,112`), the student sees a **blank panel**.
This is the "stale / non-updating content" theory the testers raised, confirmed.
Fix, both ends: purge `constructive:flow:v1` entries whose key is prefixed `gen:<slug>:` when a
universe is regenerated or removed (a new function in `flowProgress.ts`, called from
`UniverseGenerator`), **and** give `FlowShell` a fallback that returns to the Claim stage when
`mappedClaim` is null, so no future id bug can produce a dead end.

**7c — FOR-biased deck status.** Covered in item 4 (`motionStatus` → `"one-side-done"`).

---

## Architecture / files

**Create:** none. Every change lands in an existing file, plus new test files as needed.

**Modify:**
`lib/prompts/generateMotions.ts` · `lib/generatedNormalize.ts` · `components/UniverseGenerator.tsx` ·
`components/ui/app-shell.tsx` · `.env.example` · `components/stages/ImpactStage.tsx` ·
`components/PracticeShell.tsx` · `lib/state/flowProgress.ts` · `lib/state/useFlowProgress.ts` ·
`lib/state/flowMachine.ts` · `components/FlowDeck.tsx` · `components/FlowShell.tsx` ·
`components/VoiceOrTextInput.tsx` · `components/steps/RestateStep.tsx` ·
`components/steps/KeywordStep.tsx` · `components/LinkCard.tsx` · `components/stages/Bridge.tsx` ·
`lib/practice.ts`

**Untouched:** `lib/linkGrade.ts` (algebra unchanged), `lib/voice/*`, `app/api/speak/route.ts`,
`app/api/transcribe/*`, `lib/ai/*`, `lib/prompts/claim.ts` (Branch 2), `content/*.json`,
`middleware.ts`, `lib/auth.ts`.

## Error handling

- Feedback URL unset → footer renders nothing; no error, no empty link.
- `normalizeMotionText` on already-correct text → no-op (idempotent).
- Side-choice panel cancelled → returns to the deck, no progress written.
- `mappedClaim` null in the journey → falls back to the Claim stage rather than a blank panel
  (7b).
- Corrupt or absent flow progress → unchanged; `isValidEntry` still drops bad entries and
  `emptyFlowProgress()` still supplies a valid default.
- Coach failures at every stage keep their existing non-blocking fallbacks.

## Testing

Baseline to preserve: **190 tests / 57 files green**, `npx tsc --noEmit` clean,
`npm run build` succeeds.

New or updated coverage:

- `normalizeMotionText` — lowercase → `This House`, verb case preserved, idempotent,
  already-correct text untouched. Style matches the `describe("slug", …)` blocks in
  `tests/lib/generatedNormalize.test.ts:25-33`.
- `generateMotionsPrompt` contains `"This House"` (the import list in
  `tests/lib/prompts.test.ts:2-4` needs extending).
- `AppShell` footer — link present with correct href when `NEXT_PUBLIC_FEEDBACK_URL` is set,
  absent when unset. Belongs in `tests/components/ui/app-shell.test.tsx`, which already
  asserts wordmark + children.
- `ImpactStage` renders its claim; `PracticeShell` renders the drawn motion.
- Side choice — picking AGAINST first opens the AGAINST claim stage and persists
  `side: "against"`; a motion with saved progress skips the prompt and resumes at its saved
  side; `motionStatus` returns `"one-side-done"` for an against-first completion.
- Hold-to-talk — releasing the mic fills the textarea **without** calling `onSubmit` and
  **without** calling `speakCoach`. Note that all three existing tests in
  `tests/components/VoiceOrTextInput.test.tsx` run the text-only fallback path
  (`navigator.mediaDevices = undefined`), so the mic path currently has **zero** coverage and
  needs a new harness.
- Bridge — candidates shuffle under an injected `rand`; the failure summary names the specific
  plank; `LinkCard.test.tsx:33,51` rewritten off literal copy.
- Practice Link scenario id is `practice:{motionId}:{claimId}`.
- Regenerating a universe purges that slug's flow progress; `FlowShell` with a stale
  `mappedClaimId` renders the Claim stage rather than nothing.

## Open questions

None blocking. `NEXT_PUBLIC_FEEDBACK_URL` must be set by the user before the link appears —
this is deliberate, and is the mechanism by which the link disappears again before the retreat.
