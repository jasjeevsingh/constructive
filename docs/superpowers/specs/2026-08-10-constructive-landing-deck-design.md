# Constructive — Landing + Motion Deck Design

**Date:** 2026-08-10
**Status:** Approved for planning
**Scope:** UI overhaul sub-project 2 — re-skin the app entry (`/`): a welcoming landing (hero + a mini Claim→Link→Impact strip) and the motion picker as polished responsive cards with per-motion progress, plus the reusable AppShell/header deferred from the foundation. The flow shell and stage screens keep their current styling (later sub-projects).

## Background

The design-system foundation shipped (Tailwind + shadcn/ui, light-first Fraunces/DM Sans
theme, base primitives, the Gate re-skinned). But `/` still renders the prototype
`FlowDeck`: inline-styled dark, no landing, a bare grid of motion buttons. `FlowDeck`
currently does `getFlowMotions()` → a grid of buttons; selecting one sets local state and
renders `FlowShell` for that motion. Each motion carries only its text + id; per-motion
progress (`forComplete`/`againstComplete`) lives in `localStorage` (`constructive:flow:v1`).

This sub-project re-skins the entry on the new design system and adds a real landing, while
preserving the exact select→journey behavior.

## Goals

- A warm, on-brand landing for 5th–12th graders that introduces Constructive and the
  Claim→Link→Impact idea at a glance, then leads into picking a motion.
- Re-skin the motion picker as accessible, responsive cards that surface the student's
  progress and offer Start/Resume.
- Build the reusable `AppShell` (header + page container) used here and by later screens.
- Preserve behavior, content, routing, and tests.

## Non-goals

- No re-skin of the flow shell, progress rail, or stage/bridge UIs (later sub-projects).
- No content/schema changes (no new motion fields like category/difficulty).
- No coach/voice/state/routing/API changes; no dark mode.
- No new persistence; progress is read from the existing `localStorage` store.

## AppShell

`components/ui/app-shell.tsx` — reusable page chrome:
- A slim, `sticky top-0` **header**: the "Constructive" wordmark (Fraunces) on a warm
  `bg-background/80` backdrop with a subtle bottom `border-border`. No nav (single-section
  app for now).
- A centered **`max-w-5xl` main container** with responsive padding (`px-4 sm:px-6`,
  vertical spacing).
- Renders `children`. Used by the landing/deck view now; later screens adopt it.

## Landing

`components/Landing.tsx` (presentational, no state):
- **Hero:** a Fraunces display headline ("Build an argument, one idea at a time.") and one
  friendly subline that frames debate as learning to think clearly, not to win.
- **Mini CLI strip:** three compact `Card`-like tiles in a responsive row —
  **Claim** ("Your position"), **Link** ("The bridge — built from evidence and reasoning"),
  **Impact** ("So what? The bigger consequence") — with a connector (arrow/›) between them,
  using the brand accents (a gold dot for evidence, orange for reasoning on the Link tile).
  Teaches the framework at a glance; stacks vertically on mobile.

## Motion deck

- A "Pick a motion" section heading, then a **responsive grid** (`grid-cols-1
  sm:grid-cols-2 lg:grid-cols-3`, gap) of shadcn `Card`s — one per `getFlowMotions()`.
- Each card is a **single `<button>`** (styled with the `Card` classes) containing only
  non-interactive content — the **motion text** (prominent), a small **status `Badge`**
  (a `div`), and a **Start / Resume** text label — so there are no nested interactive
  elements. Its accessible name is the motion text plus status; activating it opens the
  journey — the exact current behavior (`setActiveId(m.id)` → render `FlowShell`).
- **Status → Badge** (variant/label):
  - `not-started` → "Start" (secondary/outline).
  - `in-progress` → "In progress" (default/brand).
  - `for-done` → "FOR done" (default/brand).
  - `complete` → "✓ Both sides" (success variant).
- Completed cards read as done (e.g. a subtle ring/check); the Start/Resume label follows
  status ("Start" when not-started, else "Resume").

## Progress data

- Add to `lib/state/flowProgress.ts`:
  - `loadAllFlowProgress(storage: Storage): Record<string, FlowProgress>` — exports the
    existing `readAll` behavior (validated, corrupt/malformed-tolerant) so the deck can
    read every motion's progress at once.
  - `motionStatus(entry: FlowProgress | undefined): "not-started" | "in-progress" |
    "for-done" | "complete"` — pure: `undefined` → `not-started`; both flags →
    `complete`; `forComplete` only → `for-done`; otherwise (entry exists) →
    `in-progress`.
- The deck reads status **hydration-safely**: initial render shows every card as
  `not-started` (matching SSR), then a `useEffect` loads `loadAllFlowProgress(window.localStorage)`
  and updates the badges — no SSR/client mismatch (mirrors the existing `useFlowProgress`
  hydration pattern).

## Architecture / files

- Create: `components/ui/app-shell.tsx`, `components/Landing.tsx`.
- Modify: `lib/state/flowProgress.ts` (add `loadAllFlowProgress` + `motionStatus`).
- Modify: `components/FlowDeck.tsx` — when a motion is active, render `FlowShell` (as
  today); otherwise render `AppShell` wrapping `Landing` + the motion Card grid with
  progress. The select→FlowShell behavior is unchanged.
- No other files change; the flow shell and stages keep their current look.

## Error handling

- `loadAllFlowProgress` inherits the store's corrupt/malformed tolerance (returns `{}` /
  drops bad entries), so a corrupt `localStorage` simply yields all-`not-started` badges —
  never blocks the deck.
- No network on this screen.

## Testing

- Pure: `motionStatus` — each of the four states (undefined→not-started; both→complete;
  for-only→for-done; started-but-not-for→in-progress); `loadAllFlowProgress` round-trips
  and tolerates corrupt storage.
- `AppShell`: renders its children and the "Constructive" wordmark/header.
- `FlowDeck` (deck view): renders the hero headline, the Claim/Link/Impact strip labels, a
  "Pick a motion" heading, and one accessible card-button per motion (name contains the
  motion text); clicking a card opens `FlowShell` (behavior preserved — e.g. the journey's
  restate prompt appears). With `localStorage` pre-seeded so a motion is
  `forComplete && againstComplete`, that card's badge shows "✓ Both sides".
- Gates: full suite green, `npx tsc --noEmit` clean, `npm run build` succeeds; accessible
  names preserved.

## Open questions

None blocking. A dedicated `MotionCard` component could be extracted if the card grows;
kept inline in `FlowDeck` for now unless the implementation finds it unwieldy.
