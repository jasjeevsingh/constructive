# Constructive — Motion Foundation Design

**Date:** 2026-08-15
**Status:** Approved for planning
**Scope:** Sub-project 1 of the "playful, animated, gamified" overhaul. Add the animation toolkit and conventions the rest of the effort builds on — the `motion` library, motion tokens, a reusable motion primitive, and a baked-in `prefers-reduced-motion` policy — and prove the system on one screen (the deck). No behavior, state, coach, grading, content, or copy changes; the test suite stays green.

## Background

Constructive's UI is a polished but essentially static light design system. The next arc makes it playful and gamified for grades 5–12 — flagship being an animated bridge for the Link stage — but that arc is large and decomposes into sub-projects:

1. **Motion foundation** (this spec) — library, tokens, reduced-motion + testing conventions; prove on the deck.
2. **Animated bridge** — rebuild `Bridge.tsx` as a real bridge with plank-drop / span-build / cross-the-bridge animation, driven by the unchanged `linkGrade`.
3. **Illustration + mascot system.**
4. **Gamification layer** (celebration, streaks tying into practice reps, XP/badges).

Sequenced 1 → 2 → 3 → 4. This sub-project is deliberately thin: it exists so sub-projects 2–4 share one animation vocabulary and one accessibility guarantee.

## Decisions (from brainstorming)

- **Library:** `motion` (Framer Motion's current package; `import … from "motion/react"`).
- **Reduced motion:** honored automatically from day one via `<MotionConfig reducedMotion="user">`.
- **Proof screen:** the deck (motion-cards + the reused `CoachBubble`).

## Goals

- One animation library wired in, with named motion tokens so animation is consistent and magic-number-free.
- A small reusable motion primitive (`Rise`, `Pressable`) that keeps feature code declarative.
- `prefers-reduced-motion` respected app-wide, established before any feature animation exists.
- A visible, safe proof on the deck; the suite stays green (with a `matchMedia` test stub).

## Non-goals

- No bridge changes (sub-project 2), illustrations/mascot (3), or gamification (4).
- No scroll-triggered (`whileInView`) or route-transition animation yet.
- No behavior/state/coach/grading/content/copy changes. No stage-specific, bridge, journey-shell, or Gate motion work this cycle. (The one exception is the shared `CoachBubble` primitive gaining an entrance — because it is a reused building block, that entrance intentionally applies wherever the bubble renders, including inside journey stages; that is part of proving the reusable primitive, not stage-specific animation work.)

## Library & dependency

- Add `motion` to `package.json` dependencies (latest stable). Components import from `motion/react`.

## Motion tokens — `lib/motion.ts`

A small named set (plain objects/consts, no React):
- **`transitions`** — `{ gentle, snappy, spring }` presets (tuned `duration`/`ease`, and a spring for `spring`). Example intent: `gentle` ≈ `{ duration: 0.4, ease: "easeOut" }`, `snappy` ≈ `{ duration: 0.18, ease: "easeOut" }`, `spring` ≈ `{ type: "spring", stiffness: 320, damping: 26 }`.
- **`variants`** — `riseIn` (`{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }`) and a `staggerContainer` (`{ show: { transition: { staggerChildren: 0.05 } } }`) for list/grid entrances.

These are the single source of motion values; components reference them rather than inlining numbers.

## Reduced motion (accessibility, from the start)

- Wrap the app in **`<MotionConfig reducedMotion="user">`** in `app/layout.tsx` (rendered inside `<body>`, wrapping `{children}`). `MotionConfig` is a client component rendered from the server layout (standard provider pattern); server-rendered children pass through unchanged. This makes every `motion` element collapse animation to its end-state when the OS requests reduced motion — a global guarantee, not a per-component opt-in.
- Re-export/expose `useReducedMotion` (from `motion/react`) for any component that needs to branch its own logic (e.g. skip a multi-step sequence in sub-project 2).

## Motion primitive — `components/ui/motion.tsx`

Thin, `"use client"` wrappers over `motion` + the tokens, kept minimal (extend in later cycles):
- **`Rise({ children, index?, className?, as? })`** — a fade+rise entrance using `variants.riseIn` and `transitions.gentle`; `index` applies a small stagger delay (`index * 0.05`) for grids/lists. Renders a `motion.div` (or `as`) with `initial="hidden" animate="show"`.
- **`Pressable({ children, className?, onClick?, … })`** — a `motion` wrapper adding a subtle `whileHover`/`whileTap` scale (via `transitions.snappy`) for cards/buttons; forwards standard props/handlers.

Both must forward `className` and children faithfully so wrapping an existing element changes only its motion, not its layout or accessibility.

## Proof-of-system deliverable: the deck

Apply the foundation to the **deck screen only** (the three card grids live together there, so they animate consistently), plus the shared coach bubble:
- **Deck cards** — the seeded motion cards (`FlowDeck`), the generated-motion cards (`UniverseGenerator`), and the practice cards (`PracticeDeck`) get a **staggered rise-in** on mount (`Rise` with `index`) and a **press/hover scale** (`Pressable`). Each card's markup, `onClick`, `aria-label`, and copy are unchanged — only wrapped for motion.
- **`CoachBubble`** — a soft `Rise` entrance so coach reactions ease in wherever they appear.

Nothing else changes. This is the demonstrable end-to-end proof that the library, tokens, primitive, and reduced-motion config all work together.

## Testing

- **`matchMedia` stub:** `motion`'s reduced-motion detection calls `window.matchMedia`, which jsdom lacks. Add a stub to `vitest.setup.ts` (returns `{ matches: false, addEventListener/removeEventListener/addListener/removeListener: noop, media: query }`) so `MotionConfig`/`useReducedMotion` work in tests and the existing 185 tests keep passing.
- **`motion` in jsdom:** `motion` elements render as their DOM node with children present, so React Testing Library queries (text/role/label) still resolve — tests assert **end-state/presence**, never tween frames.
- **New test:** `components/ui/motion.tsx` — `Rise` renders its children (and `Pressable` renders children + fires `onClick`).
- **Regression:** the existing deck-related suites (`FlowDeck`, `UniverseGenerator`, `PracticeDeck`, `PracticeShell`, `CoachBubble`, and everything else) must stay green unchanged — the motion wrappers preserve text/roles/handlers.
- **Gates:** full suite green, `npx tsc --noEmit` clean, `npm run build` succeeds; accessible names preserved.

## Architecture / files

- Modify: `package.json` (add `motion`), `app/layout.tsx` (`MotionConfig`), `vitest.setup.ts` (`matchMedia` stub).
- Create: `lib/motion.ts` (tokens), `components/ui/motion.tsx` (`Rise`, `Pressable`), `tests/components/motion.test.tsx`.
- Modify (proof): `components/FlowDeck.tsx`, `components/UniverseGenerator.tsx`, `components/PracticeDeck.tsx`, `components/CoachBubble.tsx` — motion wrappers only.
- Untouched: all stage components' internals, `LinkCard`/`Bridge`, `FlowShell`, `PracticeShell`, state stores, coach, grading, routing, content.

## Error handling / performance

- No new runtime error paths; motion is presentational. If reduced motion is on, entrances are instant.
- Keep entrances short (≤ ~0.4s) and use transform/opacity only (GPU-friendly), so there's no layout thrash or jank on low-end classroom devices.

## Open questions

None blocking. An in-app "reduce motion" toggle (beyond the OS setting), route/page transitions, and scroll-reveal are deferred to later sub-projects; this foundation does not preclude them.
