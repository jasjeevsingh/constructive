# Constructive — Flow Shell + Rail Re-skin Design

**Date:** 2026-08-12
**Status:** Approved for planning
**Scope:** UI overhaul sub-project 3 — re-skin the per-motion journey chrome (`FlowShell` + `FlowRail`, side pills, completion panels) on the light design system, plus a minimal legibility pass on the stage components so nothing is invisible on the light theme. The full stage/bridge redesign is the next sub-project.

## Background

The design system + landing/deck are re-skinned, but opening a motion still renders the
prototype `FlowShell`: a dark card (`background: var(--navy)`) with a header (motion +
FOR/AGAINST pills), a left `FlowRail` (Read→Claim→Link→Impact dots + a progress bar), a
main panel that renders the active stage, and completion panels. On the new light theme
this reads as a dark card floating on empty light space. The stage components
(RestateStep, KeywordStep, ClaimStage, ImpactStage, LinkCard, VoiceOrTextInput) use
hardcoded white/light text, which would be invisible on a light panel.

## Goals

- Turn the journey into a proper light, on-brand, responsive, full-height layout using
  AppShell + shadcn primitives (Progress, Badge, Button, Card) and the light theme.
- Make the rail collapse gracefully on mobile (horizontal stepper).
- Ensure the stage area is legible on light (minimal color-only pass), without redesigning
  the stages.
- Preserve ALL behavior, state, routing, coach wiring, and every visible text string the
  tests assert.

## Non-goals

- No stage/bridge redesign (RestateStep/KeywordStep/ClaimStage/LinkCard/ImpactStage inner
  layouts and the LinkCard "bridge" visual) — that's the next sub-project. Only color-token
  legibility edits here.
- No behavior/state/coach/voice/routing/schema/content changes.
- No dark mode.

## Layout

- **Wrap the journey in `AppShell`** (the Constructive header) for consistency. `FlowDeck`
  already renders `<FlowShell motion onExit=… />` for the active motion; `FlowShell` itself
  adopts `AppShell` internally (so both deck and journey share the header).
- The journey renders as a light **`Card`** that fills the content area (`min-h` so it
  isn't a small floating chip), with two regions:
  - **Journey header** (top): a ghost **"← Motions"** `Button` (calls `onExit`), the
    **motion title** (Fraunces, `font-display`), and the **FOR / AGAINST side pills**.
  - **Body:** on `md+`, a two-column layout — the **`FlowRail`** as a left sidebar
    (`w-56 border-r border-border`) + the **stage panel** (`flex-1`, padded). On mobile
    (`<md`), the sidebar is hidden and `FlowRail` renders a **compact horizontal stepper**
    above the panel.
- **Completion panels** (unchanged conditions and copy): centered, Fraunces heading +
  `Button`s — both-sides closure ("You've argued both sides of this motion — FOR and
  AGAINST. 🎉" + "← back to motions"); FOR-done ("Nice — you built the FOR case: claim,
  link, and impact. Now flip it and argue the other side." + primary "Now argue the other
  side →" + ghost "← back to motions").

## Side pills

Re-skinned as shadcn `Badge`s driven by `progress.side`/`forComplete`/`againstComplete`:
- FOR pill: active side → brand (`default`); when `forComplete` → `success` with "✓ FOR".
- AGAINST pill: active side → brand; `againstComplete` → `success` "✓ AGAINST";
  `forComplete && !active` → "AGAINST" (unlocked, `secondary`/muted); otherwise
  **"🔒 AGAINST · soon"** (locked, muted outline). The literal text must still contain
  "🔒" and "AGAINST" while locked (a test asserts `/🔒/` and `/against/i`).

## FlowRail

- Uses the **`Progress`** primitive for the bar (`value = (stageIndex / (STAGES.length-1)) *
  100`). The step list is themed with tokens: done step → `success` dot + check; current →
  `primary` ring + number; upcoming → muted. Labels unchanged
  (`Read the motion`/`Claim`/`Link`/`Impact`).
- Responsive within the one component: a vertical sidebar layout on `md+`
  (`hidden md:flex …`) and a compact horizontal stepper on mobile (`md:hidden …`), both
  driven by the same `stage` prop. Signature unchanged: `FlowRail({ stage }: { stage:
  FlowStage })`.

## Legibility pass (minimal, color-only)

In the six stage/input components, replace hardcoded light/dark literals with theme tokens
so everything is readable on the light panel — **no layout, structure, or behavior
changes**:

- `components/steps/RestateStep.tsx`, `components/steps/KeywordStep.tsx`,
  `components/stages/ClaimStage.tsx`, `components/stages/ImpactStage.tsx`,
  `components/LinkCard.tsx`, `components/VoiceOrTextInput.tsx`.
- Swap: prompt/heading `#fff`/`var(--text)` → `text-foreground`; secondary text
  `var(--dim)` → `text-muted-foreground`; dark input surfaces (`var(--navy-mid)`) →
  `bg-background border border-input text-foreground`; keep the semantic accents
  (evidence gold, reasoning orange) and coach/error accent colors as tokens
  (`text-primary`/`text-destructive`/etc.).
- Keep every visible text string (prompts like "Say the motion in your own words — what's
  the core claim?", "against this motion", coach copy, button labels) exactly as-is —
  tests assert them.

## Behavior & data

- `FlowShell`'s render conditionals, `update(...)` calls, the FOR→AGAINST switch
  (`update({ side: "against", stage: "claim", mappedClaimId: null, impact: "" })`),
  `useFlowProgress`, and every stage prop/onComplete are **identical**. Only markup/classes
  change. `FlowShell({ motion, onExit })` and `FlowRail({ stage })` signatures unchanged.

## Testing

- `FlowRail`: a render test — renders the four step labels and reflects the current stage
  (e.g. a done step shows a check / the current step is marked), using the new structure.
- `FlowShell`: the existing behavior tests must still pass unchanged (pins the motion;
  starts on Read/Restate; AGAINST shows 🔒 on a fresh motion; Restate→Keywords; FOR-done →
  "Now argue the other side" → AGAINST Claim stage; both-sides closure → "back to
  motions"). Update only structural queries if needed, never the asserted copy.
- Legibility pass: covered by the existing stage/component tests (ClaimStage, LinkCard,
  VoiceOrTextInput, FlowShell) which assert roles/text — they must stay green (color-only
  edits don't change roles/text).
- Gates: full suite green, `npx tsc --noEmit` clean, `npm run build` succeeds; a11y names
  preserved; responsive (rail ↔ stepper) verified manually.

## Open questions

None blocking. If the legibility pass on `LinkCard` proves entangled with its bridge
layout, keep it strictly to color tokens (leave structure for the next sub-project) and
note anything deferred.
