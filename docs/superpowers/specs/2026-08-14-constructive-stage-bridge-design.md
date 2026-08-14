# Constructive — Stage UIs + Link Bridge Redesign

**Date:** 2026-08-14
**Status:** Approved for planning
**Scope:** UI overhaul sub-project 4 (the final UI piece) — redesign the per-motion stage inner UIs (RestateStep, KeywordStep, ClaimStage, ImpactStage) and the LinkCard "bridge" centerpiece on the light design system. These render inside the already-re-skinned FlowShell light Card + rail. Presentation only: all behavior, state, coach, and voice wiring, and every test-asserted string, are preserved.

## Background

Sub-projects 1–3 shipped the design system, landing/deck, and the flow shell/rail. The stage components inside the journey got only a color-token legibility pass in sub-project 3 — they're readable on light but not truly designed. `LinkCard`, the Link-stage centerpiece, is still a self-contained **dark** card (`background: var(--navy)`) with inline styles: a Claim tile + Impact tile, a flat list of candidate "planks" (gold=evidence / orange=reasoning) toggled Build/Set-aside, a "Test the bridge" grader, and per-plank coach feedback. On the light panel it reads as a dark island. This sub-project makes each stage a polished, on-brand, age-appropriate (grades 5–12) learning UI and rebuilds the Link "bridge" as a light structural visual.

## Goals

- A consistent, polished visual frame for the four flow stages, with a unified coach-reaction treatment.
- Rebuild the Link stage as a **structural bridge**: Claim and Impact as two piers, planks placed into a span/deck as labeled beams (gold=evidence, orange=reasoning), with a "Test the bridge" hold/gap result.
- Keep everything readable, responsive, and accessible on the light theme.
- Preserve ALL behavior, state, coach/voice wiring, routing, and every visible string the tests assert.

## Non-goals

- No behavior/state/coach/voice/schema/routing/content changes.
- No dark mode.
- No changes to `VoiceOrTextInput` internals (already re-skinned in sub-project 3; consumed as-is).
- No changes to `useLinkProgress`, `useFlowProgress`, `lib/linkGrade`, the coach API, or `lib/voice/*`.

## Shared building blocks (new, small, presentational)

### `components/stages/StageHeader.tsx`
- Renders a brand-blue eyebrow (`text-primary text-xs font-semibold uppercase tracking-wide`) and an optional Fraunces (`font-display`) prompt beneath it.
- Signature: `StageHeader({ eyebrow, prompt }: { eyebrow: string; prompt?: string })`.
- Used by all four stages: `Stage 1 · Read` (Restate + Keyword substeps), `Stage 2 · Claim`, `Stage 3 · Link`, `Stage 4 · Impact`. Reinforces the FlowRail position.
- The eyebrow strings are NOT test-asserted (tests assert prompts/reactions/roles), so they can be introduced freely; existing prompts stay verbatim.

### `components/CoachBubble.tsx`
- One reusable soft, rounded coach-reaction bubble: a muted rounded card (`rounded-lg bg-muted p-3 text-foreground`) with a coach glyph, replacing the bare `💬 {reaction}` paragraphs.
- Signature: `CoachBubble({ children }: { children: React.ReactNode })` — renders the coach glyph + `children`.
- The reaction **text is passed through verbatim** (tests match on reaction substrings like `/good instinct/`, `/argues the other way/`, `/tempting, but it argues the other way/`), so the wrapper change is transparent to tests.
- Used by Restate, Keyword, Claim, Impact, and LinkCard (the per-plank "Talk this through" reaction).

## The four flow stages

All four adopt `StageHeader`, `CoachBubble`, and shadcn `Button` (already present). Only markup/classes change; all state, `fetch` calls, `speakCoach` calls, handlers, and props are identical.

### RestateStep (`components/steps/RestateStep.tsx`)
- Add a quiet "The motion" quote block above the input showing `motion` (currently `motion` is only used in the coach call, never displayed).
- `StageHeader` eyebrow `Stage 1 · Read`.
- Keep: `VoiceOrTextInput` with label **"Say the motion in your own words — what's the core claim?"**; coach reaction (now in `CoachBubble`); the coach-unavailable message; the `Next: keywords →` `Button` that appears once a reaction or error exists and calls `onNext(saved)`.

### KeywordStep (`components/steps/KeywordStep.tsx`)
- `StageHeader` eyebrow `Stage 1 · Read`.
- Keep the `segmentMotion(...)` mapping and the clickable keyword spans, restyled to read as tappable (dashed evidence underline + hover), still setting `active`/clearing reaction on click.
- When `active`: the scope panel with `VoiceOrTextInput` label **`What's the scope of "${active.word}" here — and why?`** (verbatim), plus the `active.hint` shown when present, and the coach reaction in `CoachBubble`.
- Keep the `Next: claim →` `Button` calling `onNext`.

### ClaimStage (`components/stages/ClaimStage.tsx`)
- `StageHeader` eyebrow `Stage 2 · Claim` + prompt **"What's your strongest claim {for|against} this motion?"** (verbatim, side-driven).
- Keep `VoiceOrTextInput` label **"Say or type your claim"**.
- On coach success (`reaction && mapped`): CoachBubble reaction + a highlighted evidence-accent confirmation card reading **"We'll carry this forward as: {mapped.claim}"** + a `Build the link →` `Button` calling `onComplete(mapped.id)`.
- Fallback (`fallback` true): **"Coach unavailable — pick the claim closest to yours:"** then the claims as selectable outline `Button` cards, each calling `onComplete(c.id)` with the claim text as its accessible name (test clicks `/kids deserve a say/`).

### ImpactStage (`components/stages/ImpactStage.tsx`)
- `StageHeader` eyebrow `Stage 4 · Impact` + prompt **"So what? Why does this claim matter — what's the bigger consequence?"** (verbatim).
- Keep `VoiceOrTextInput` label **"Say or type the impact"**; CoachBubble reaction; the **"Coach unavailable — keep going."** message; the `Finish this side ✓` `Button` (appears on reaction or error) calling `onComplete(saved)`.

## LinkCard — the structural bridge (centerpiece)

`components/LinkCard.tsx` stays the **stateful orchestrator** (all of `useLinkProgress`, `placedIds`, `grade`, `reactions`, `coachError`, `toggle`, `test`, `talkThrough`, `statusOf` unchanged). A new presentational `components/stages/Bridge.tsx` renders the piers/span/beams and materials tray from props; LinkCard passes state + handlers into it.

### Layout
- Sheds the dark inline styles; becomes part of the light panel (no `var(--navy)` background). `StageHeader` eyebrow `Stage 3 · Link`.
- **Instruction line** (verbatim intent, kept as tokens): "Build the bridge: choose the planks that connect the claim to the impact. Strong bridges use **evidence** and **reasoning** together." — "evidence" in `text-evidence` (gold), "reasoning" in `text-reasoning` (orange).
- **Piers:** a **Claim pier** (labeled `CLAIM`, shows `scenario.claim`) and an **Impact pier** (labeled `IMPACT`, shows `scenario.impact`, evidence-gold accent). Desktop: left and right, with the span/deck between them; mobile (`<md`): stacked Claim → deck → Impact vertically.
- **Span/deck:** holds the planks the student has **placed** (`placedSet`), each a labeled **beam** — `material === "evidence"` → gold accent, `reasoning` → orange accent — with the plank text and a **Set aside** `Button` (`aria-label={`Set aside ${c.text}`}`). Empty span → a dashed-border "no planks yet" gap.
- **Materials tray:** the **unplaced** candidates, each a card with a material `Badge`, the text, and a **Build** `Button` (`aria-label={`Build ${c.text}`}`).
  - The Build/Set-aside `aria-label`s MUST remain exactly `Build ${c.text}` / `Set aside ${c.text}` — the tests match `/build .*stress/i`, `/set aside .*stress/i`, `/build .*frees evenings/i`, `/build .*harvard/i`.

### Grading & feedback
- **Test the bridge** `Button` (accessible name contains "Test the bridge") calls `test()`.
- On a **hold** (`grade.held`): the span visually connects (piers joined / success accent) + **"✓ The bridge holds!"**.
- On a **miss**: gap/crack treatment + the existing verdict — **"Not yet — a strong bridge needs both evidence and reasoning."** when `!(hasEvidence && hasReasoning)`, else **"Not yet — check the flagged planks."** (preserve the "Not yet" text and both branches; the test asserts the "not held" state via absence of `/bridge holds/i`).
- **Per-plank feedback** (when `grade` and `status !== "correct-omit"`), preserved verbatim on the beam/tray item:
  - `correct` → "✓ Holds — good plank."
  - `missing` → "This one actually fits — you left it out." + ` ${c.explanation}`
  - `wrong` → (`c.verdict === "great-but-wrong"` ? "🪤 Great but wrong — " : "Doesn't fit — ") + `c.explanation` (this yields the test's `/argues the other way/` and `/tempting, but it argues the other way/` from the explanation text).
  - A **"💬 Talk this through"** `Button` calling `talkThrough(c)`; on `coachError[c.id]` the **"Coach unavailable — keep going."** message; the returned reaction rendered in a `CoachBubble`.
- **Continue →** `Button` appears only when `onComplete && grade?.held`, calling `onComplete` (LinkCard.onComplete test relies on this).

### Deliberate cleanup
- Remove the legacy in-card **"← activities"** back button (redundant now that the FlowShell header provides "← Motions"). Confirmed safe: no test asserts it — `onExit` is only passed as a no-op in `LinkCard.test.tsx` / `LinkCard.onComplete.test.tsx`. Keep `onExit` in the prop type for interface compatibility (FlowShell still passes it); it is not destructured/rendered.

## Architecture / files

- **Create:** `components/stages/StageHeader.tsx`, `components/CoachBubble.tsx`, `components/stages/Bridge.tsx`.
- **Modify:** `components/steps/RestateStep.tsx`, `components/steps/KeywordStep.tsx`, `components/stages/ClaimStage.tsx`, `components/stages/ImpactStage.tsx`, `components/LinkCard.tsx`.
- **Untouched:** `components/VoiceOrTextInput.tsx`, `lib/state/useLinkProgress.ts`, `lib/state/useFlowProgress.ts`, `lib/linkGrade.ts`, `app/api/coach/*`, `lib/voice/*`, `lib/schemas.ts`, content, routing.

## Error handling

- No new network or error paths. Coach failures keep their existing per-component fallbacks (Restate/Keyword/Impact "coach unavailable" messages; ClaimStage claim-picker fallback; LinkCard per-plank `coachError`). The redesign only restyles these existing states.

## Testing

- All existing tests stay green — they assert behavior/strings/roles that this redesign preserves (RestateStep prompt + "Next: keywords →"; KeywordStep scope label + "Next: claim →"; ClaimStage prompt/`/good instinct/`/"Build the link"/`/kids deserve a say/`; ImpactStage prompt/"Finish this side ✓"; VoiceOrTextInput textbox + "Submit"; LinkCard Build/Set-aside/`/test the bridge/`/`/bridge holds/`/`/argues the other way/`/`/both/`/`/talk this through/`; LinkCard.onComplete "Continue →").
- Add focused render tests (TDD):
  - `StageHeader`: renders the eyebrow and, when given, the prompt.
  - `CoachBubble`: renders its children text.
  - `Bridge`/LinkCard structure: the Claim and Impact piers render (labels "CLAIM"/"IMPACT" and the scenario text); a placed plank appears with a "Set aside" control; an unplaced plank appears in the tray with a "Build" control. (Structure only — grading behavior is already covered by the existing LinkCard tests.)
- Gates each task: full suite green, `npx tsc --noEmit` clean, `npm run build` succeeds; accessible names preserved; responsive (piers ↔ stacked) verified manually.

## Manual verification (after the last task)

Not automated — do once with the app running (`npm run dev`, authed):
1. Open a motion → Restate shows the motion quote + `Stage 1 · Read`; coach reactions render in a coach bubble; `Next: keywords →`.
2. Keywords are visibly tappable; picking one shows the scope question (+ hint) and a coach bubble; `Next: claim →`.
3. Claim → `Stage 2 · Claim`, prompt, input; coach maps it to a highlighted "carry forward" card; `Build the link →`.
4. Link → the bridge: Claim and Impact piers, an empty dashed span; Build planks → beams drop into the span (gold/orange); Test the bridge → holds (span connects, "✓ The bridge holds!") or gap + the flagged-plank / both-materials messages; "Talk this through" shows a coach bubble; Continue → advances.
5. Impact → `Stage 4 · Impact`, prompt, input, coach bubble, `Finish this side ✓`.
6. Resize to mobile → the bridge stacks Claim → deck → Impact; all stages remain readable and usable.

## Open questions

None. (The "← activities" back-button removal was verified safe against the existing tests during spec review.)
