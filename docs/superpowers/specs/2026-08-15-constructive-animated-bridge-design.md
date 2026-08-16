# Constructive — Animated Bridge Design

**Date:** 2026-08-15
**Status:** Approved for planning
**Scope:** Sub-project 2 of the playful overhaul (the flagship). Turn the Link stage's Bridge from a static piers+span+tray layout into a real bridge the student physically builds and tests — an animated **bridge scene** (planks drop into the deck; a traveler crosses when it holds, or it cracks when it doesn't) sitting above the existing, unchanged readable/accessible plank controls. Built on the shipped motion foundation. No grading/state/coach/contract change; the test suite stays green.

## Background

The Link stage renders `components/stages/Bridge.tsx`, a presentational component driven by `LinkCard` (the stateful orchestrator: `useLinkProgress`, `toggle`/`test`/`talkThrough`; grading via `lib/linkGrade.ts` — `held` requires ≥1 fitting evidence + ≥1 fitting reasoning and no wrong planks). Today `Bridge` shows a Claim pier card, a dashed span holding placed-plank rows (or "No planks yet…"), an Impact pier card, and a Materials tray of unplaced-plank rows; each row is a real `<button>` with `Build`/`Set aside` labels, per-plank feedback, and a coach bubble.

The motion foundation (sub-project 1) shipped: `motion` (`motion/react`), tokens in `lib/motion.ts` (`transitions.gentle/snappy/spring`, `riseIn`), `Rise`/`Pressable` primitives, and app-wide `<MotionConfig reducedMotion="user">`.

## Decisions (from brainstorming)

- **Two registers:** a decorative, `aria-hidden` **animated bridge scene** on top + the existing **readable/accessible controls** below (kept intact). The scene is the "wow"; the controls carry all meaning, interaction, and the test contract.
- **DOM + Framer Motion** (not SVG) for the scene, so planks stay real buttons in the controls and the scene is just decorative DOM.
- **Traveler is a minimal, swappable inline placeholder** — the real mascot/illustration system is a later sub-project.

## Goals

- A bridge the student visibly builds: each Build drops a colored beam into the deck (gold = evidence, orange = reasoning); "Test the bridge" sends a traveler across when it holds, or cracks/wobbles when it doesn't.
- Delightful for a 5th grader, not childish for a high schooler.
- Preserve ALL behavior, grading, and every asserted string/role/aria-label; keep it fully accessible and reduced-motion-safe.

## Non-goals

- Not the illustration/mascot system (traveler is a minimal inline placeholder, clearly swappable later).
- Not gamification (no confetti/XP/streaks; only a small in-scene arrival hop).
- No change to `LinkCard`, `lib/linkGrade.ts`, `useLinkProgress`, the coach, or the `Bridge` props contract.

## Preserved contract & assertions (hard constraints)

`Bridge`'s props are unchanged: `{ claim, impact, candidates, placedIds, grade, reactions, coachError, onToggle, onTalkThrough }`.

The **controls register keeps every currently-asserted string/role/label** (from `tests/components/Bridge.test.tsx`, `LinkCard.test.tsx`, `LinkCard.onComplete.test.tsx`), verbatim:
- The Claim card renders the label **`Claim`** + the claim text; the Impact card renders **`Impact`** + the impact text (each must remain a **unique** `getByText` match — see below).
- The empty span message **`No planks yet — build the span from the materials below.`**
- Each plank row is a real `<button>` with `aria-label` exactly `Build ${c.text}` / `Set aside ${c.text}`.
- Per-plank feedback verbatim: `✓ Holds — good plank.` / `This one actually fits — you left it out. ` + explanation / (`🪤 Great but wrong — ` | `Doesn't fit — `) + explanation; the `💬 Talk this through` button; `Coach unavailable — keep going.`; reactions in `CoachBubble`.
- LinkCard's own strings (`Test the bridge`, `✓ The bridge holds!`, the not-held verdicts, `Continue →`) are outside `Bridge` and untouched.

**Uniqueness rule:** the scene must NOT render the literal texts `Claim`, `Impact`, or `No planks yet…`, or any plank text as a queryable node — otherwise `getByText` would match twice and break. The scene is `aria-hidden` decorative DOM with no colliding text.

## Architecture / components

- **`components/stages/BridgeScene.tsx`** (new, presentational, `"use client"`, `aria-hidden`): the animated bridge. Props derived by `Bridge` (no new state):
  - `placed: { id: string; material: "evidence" | "reasoning" }[]` — the placed planks, in order.
  - `testResult: "held" | "failed" | null` — `null` before test; from `grade`: `grade.held → "held"`, `grade && !grade.held → "failed"`.
  Renders two abstract pier towers, a **deck** of colored beams (one per `placed`, gold/orange), and a **traveler**. Uses `AnimatePresence` keyed by plank id for beam drop-in/out, and a `useReducedMotion()`-guarded timeline for the test sequence. Carries a `data-testid="bridge-scene"` for its render test; beams carry `data-testid="bridge-beam"`.
- **`components/stages/Bridge.tsx`** (modify): unchanged props/contract. Renders `<BridgeScene placed={placed.map(c => ({id:c.id, material:c.material}))} testResult={testResult} />` at the top, then the **existing controls markup unchanged** (Claim card, span with placed rows / empty message, Impact card, Materials tray, `plankRow`/`feedback`). `testResult = grade == null ? null : grade.held ? "held" : "failed"`.

`BridgeScene` is split into its own file so `Bridge` stays focused and the scene is independently testable.

## Scene behavior (maps to existing state only)

- **Deck beams:** for each placed plank, a beam colored by material (`bg-evidence` gold / `bg-reasoning` orange). Built → beam animates in (drop from above + spring settle via `transitions.spring`); Set aside → beam animates out. Empty deck → a dashed gap (no queryable text).
- **Idle** (`testResult === null`): traveler parked at the Claim pier; deck shows current beams. Because `toggle` clears `grade` in `LinkCard`, changing planks resets the scene to idle automatically.
- **Holds** (`"held"`): deck gets a soft success glow; the traveler crosses left→right to the Impact pier (~0.9s ease) with a small arrival hop.
- **Doesn't hold** (`"failed"`): the traveler steps partway; the deck shudders (x-keyframe wobble) and a beam tilts; the traveler stops and returns. The reason stays in the controls' verdict + per-plank feedback (unchanged).

## Traveler

A minimal inline SVG figure (e.g. a small cart/character), `aria-hidden`, no external asset — a clearly swappable placeholder for the later mascot system. Keep it a single small self-contained component or inline element within `BridgeScene`.

## Accessibility & reduced motion

- The entire `BridgeScene` is `aria-hidden="true"` — screen readers and keyboard users rely solely on the controls (real buttons, unchanged labels/feedback), so the decorative animation adds nothing to parse and removes nothing.
- `useReducedMotion()` branch in `BridgeScene`: beams render at their final position instantly (no drop), and a `testResult` change jumps straight to the end-state — traveler shown at the Impact pier for `"held"`, a static "cracked"/stopped indicator for `"failed"` — with no timeline. `MotionConfig reducedMotion="user"` already neutralizes the transform-based motions globally; the hook covers the JS-orchestrated cross sequence.

## Performance

Transform/opacity only, a small fixed node count (piers + a few beams + traveler), springs from the tokens. No layout thrash; smooth on low-end classroom devices.

## Error handling

No new data or network paths. The scene is derived purely from props already present; with no placed planks it shows the empty deck; with a corrupt/absent grade it stays idle. Coach failures remain handled in the controls (unchanged).

## Testing

- **`tests/components/BridgeScene.test.tsx`** (new): renders `N` beams for `N` placed planks (query `data-testid="bridge-beam"`), renders without crashing for `testResult` of `null` / `"held"` / `"failed"`, and the scene root is `aria-hidden`. (jsdom doesn't animate — assert end-state/presence.)
- **Regression:** `tests/components/Bridge.test.tsx`, `LinkCard.test.tsx`, `LinkCard.onComplete.test.tsx` stay green **unchanged** — the controls register is untouched, and the `aria-hidden` scene introduces no colliding queryable text. Add one assertion to `Bridge.test.tsx` that the scene (`data-testid="bridge-scene"`) is present.
- **Gates:** full suite green, `npx tsc --noEmit` clean, `npm run build` succeeds; accessible names preserved; reduced-motion verified manually.

## Architecture / files

- Create: `components/stages/BridgeScene.tsx`, `tests/components/BridgeScene.test.tsx`.
- Modify: `components/stages/Bridge.tsx` (render the scene above the unchanged controls; derive `placed`/`testResult`), `tests/components/Bridge.test.tsx` (one added scene-present assertion).
- Untouched: `LinkCard`, `lib/linkGrade.ts`, `useLinkProgress`, coach, `lib/motion.ts` (consumed as-is), all other stages.

## Open questions

None blocking. Richer per-plank status mapping in the scene (a specific beam cracking for the exact wrong plank; a visible gap for the missing material) and a designed mascot replacing the placeholder traveler are deferred — the derived-props design leaves room to add them without changing the contract.
