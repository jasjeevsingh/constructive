# Constructive — Design-System Foundation Design

**Date:** 2026-08-10
**Status:** Approved for planning
**Scope:** Sub-project 1 of the production UI overhaul: adopt a real styling stack and brand theme, build reusable base primitives and a layout shell, and prove the system by re-skinning one screen (the Gate). Re-skinning the landing/deck, flow shell/rail, and stage/bridge UIs are later sub-projects.

## Background

Constructive's behavior is complete and well-tested (the per-motion CLI flow — Read →
Claim → Link → Impact, both sides — plus the coach, voice, gate, and localStorage state).
Its **presentation is prototype-grade**: ~90 inline `style={{…}}` blocks across 10
components, a minimal `globals.css` with a handful of CSS variables, fonts via a Google
`<link>`, no layout system, no landing page, not responsive, not production-polished. The
product is meant for 5th–12th graders everywhere and to deploy on Vercel, so the UI must
become a formal, accessible, responsive, delightful-but-age-appropriate website.

This is a **re-skin, not a behavior rewrite**: the shipped state machine, coach, content,
routing, and tests stay intact; only the presentation changes, screen by screen, keeping
the suite green throughout.

## Goals

- Establish the production styling stack and a real brand theme every screen builds on.
- Provide reusable, accessible base UI primitives so later re-skins are fast and consistent.
- Prove the system end-to-end by fully re-skinning one screen (the Gate).
- Keep the app working and all tests green — migration is incremental.

## Non-goals

- No re-skin of the landing/deck, flow shell/rail, or the stage/bridge UIs (later cycles).
- No behavior, state, coach, content, routing, or API changes.
- No dark mode yet (light-first; dark is a possible later enhancement).
- No new pages or features; the Gate keeps its exact behavior (password → `/api/auth` → redirect).

## Visual direction

- **Light-first, warm and credible.** Warm off-white paper background (`#FAF9F6`), deep
  navy ink text (`#0F1E2E`). Modern, welcoming, high-contrast, projector-friendly. The
  navy/gold identity survives as **accents**, not the whole canvas.
- **Type:** **Fraunces** (warm characterful serif) for display/headings; **DM Sans** for
  body/UI. Both via `next/font/google`. Bebas Neue is dropped.
- **Palette (semantic, brand-derived):**
  - `background` `#FAF9F6`, `foreground` `#0F1E2E`, `card` `#FFFFFF`.
  - `primary` a confident brand blue `#1E5AA8` (white foreground) for main actions.
  - **`evidence` gold `#C8962E`** and **`reasoning` orange `#F4732A`** — kept as the Link
    activity's established semantic mapping, exposed as first-class theme colors.
  - `success` `#2E9E5B`, `destructive` `#DC2626`.
  - Warm neutrals: `muted` `#F1EEE8`, `muted-foreground` `#6B6156`, `border`/`input`
    `#E7E3DA`, `ring` = primary.
  - `radius` `0.75rem` (rounded, friendly). Soft shadows, generous spacing, big tappable
    controls, strong visible focus rings.
- **Feel:** "smart classroom," not cartoonish — confident and colorful in the accents,
  clean and spacious overall. Mobile-first and accessible.

## Architecture

- **Tailwind CSS** (v3) + **shadcn/ui**. Tailwind for utility styling; shadcn/ui gives
  accessible, Radix-based components we **own** under `components/ui/`. This is the standard
  Next.js/Vercel production stack.
- **Config files:** `tailwind.config.ts` (content globs, theme extension mapping CSS
  variables to Tailwind colors/fonts/radius), `postcss.config.mjs` (tailwind +
  autoprefixer), `components.json` (shadcn config), `lib/utils.ts` (`cn()` — clsx +
  tailwind-merge).
- **Theme via CSS variables:** shadcn semantic tokens (`--background`, `--foreground`,
  `--primary`, `--card`, `--muted`, `--border`, `--ring`, `--radius`, …) plus the brand
  extras (`--evidence`, `--reasoning`, `--success`) defined in `app/globals.css`'s
  `@layer base :root`. Tailwind's `theme.extend.colors` reads them so classes like
  `bg-primary`, `text-evidence`, `border-border` work.
- **Fonts:** `next/font/google` for Fraunces and DM Sans in `app/layout.tsx`, exposed as
  `--font-display` / `--font-sans` and mapped to Tailwind `fontFamily.display` /
  `fontFamily.sans` (sans is the default body font).
- **Legacy compatibility (critical):** the existing brand CSS variables (`--navy`,
  `--navy-mid`, `--gold`, `--orange`, `--orange-light`, `--dim`, `--text`, `--paper`,
  `--ink`) and the `.serif`/`.accent` helper classes **remain in `globals.css`** so the
  not-yet-migrated inline-styled components keep rendering unchanged. They are removed only
  as each screen is migrated in later sub-projects. The `body` background flips to the new
  light `--background`; un-migrated dark components set their own backgrounds inline
  (they already do), so they remain self-contained and legible during the transition.

## Base primitives (`components/ui/`)

Standard shadcn/ui components, themed by the tokens above:

- `button.tsx` — `Button` with variants (`default`/primary, `secondary`, `outline`,
  `ghost`, `destructive`) and sizes (`sm`/`default`/`lg`/`icon`); accessible focus ring.
- `card.tsx` — `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`,
  `CardFooter`.
- `input.tsx` — `Input`. `label.tsx` — `Label` (Radix).
- `badge.tsx` — `Badge` with variants (incl. `evidence`/`reasoning` accent variants for
  later Link use).
- `progress.tsx` — `Progress` (Radix) for the later flow rail.

These are owned source files (not an external dependency), so later sub-projects extend
them freely.

## Layout shell

- `app/layout.tsx` wires the fonts and applies the base body classes
  (`font-sans`, `bg-background`, `text-foreground`, antialiased). This sub-project keeps
  the shell minimal — just the themed `<body>` — and defers a dedicated `AppShell`
  (header, max-width page container, nav) to the landing/deck sub-project, where the real
  header and landing are designed.

## Proof-of-system deliverable: re-skin the Gate

Re-skin `components/Gate.tsx` fully on the new stack as the demonstrable end-to-end proof:

- A centered, responsive card (`Card`) with a **Fraunces** display heading ("Constructive"),
  a short subtitle, a labelled password `Input` (`Label` + `Input`, `type="password"`),
  an error message, and a primary `Button` ("Enter").
- **Behavior unchanged:** Enter/click POSTs `{ password }` to `/api/auth`, redirects to `/`
  on success, shows an inline error on failure; wrapped in try/catch (network failure →
  error). Keyboard: Enter submits; the input is properly labelled; visible focus states.
- No other screen changes this cycle.

## Testing

- Vitest doesn't process Tailwind (classes are inert strings), so existing component tests
  keep working unchanged.
- Add a small render test for a primitive (`Button` renders its children and is a real
  `button` with an accessible name) to prove the primitives + `cn()` compile and render.
- Add a `Gate` render test: renders the "Constructive" heading, a password input, and an
  "Enter" button (accessible name), and typing + Enter triggers the POST (stub `fetch`) —
  locking the preserved behavior on the new markup.
- Gates for the task: full suite green, `npx tsc --noEmit` clean, `npm run build` succeeds
  (Tailwind builds; the new theme applies; legacy components still render).

## Open questions

None blocking. Dark mode, a full landing header, and richer motion/animation are
explicitly deferred to later sub-projects.
