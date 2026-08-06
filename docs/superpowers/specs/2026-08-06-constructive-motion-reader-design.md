# Constructive — Layer 1 (Motion Reader) Design

**Date:** 2026-08-06
**Status:** Approved for planning
**Scope:** Layer 1 (Motion Reader) only. Layers 2 (Link Builder) and 3 (Impact + Debate Avatar), and the adjacent Debate Organizer, are explicitly out of scope and will each get their own spec/plan/build cycle.

## Background

Constructive is an interactive web app that replaces static HTML/PDF skills-guide
materials for a youth debate retreat (5th–12th graders, Miri-Piri Leadership Retreat
2026). It teaches the **Claim → Link → Impact (CLI)** framework through structured,
activity-based modules rather than a chatbot Q&A.

**Design north star:** the tool is a *helper that trains a skill*, not a *teacher that
introduces a concept from scratch*. A coach-led orientation Zoom happens before students
use the tool independently, so the first-run experience can assume a coach has already
explained CLI conceptually. Success is measured by how closely the digital experience
recreates what works in live, in-person coaching.

**Explicitly rejected pattern:** generic chatbot back-and-forth. All AI interaction is
wrapped in a structured activity; the AI nudges, it does not do the work for the student.

## Goals

- Teach a student who has never read a debate motion how to parse one.
- Deliver the three-step Motion Reader activity: restate → explore keywords → generate
  3 arguments for / 3 against.
- Voice-first input with a text fallback on every prompt.
- Ship a working prototype quickly; keep content editable by coaches without code changes.

## Non-goals

- No refutation, POI, or world-visualization modules (reserved for live coaching).
- No weighing / impact-calculus engine.
- No coach-facing dashboard or admin UI.
- No companion handout.
- No Layer 2 / Layer 3 / Debate Organizer functionality.
- No user accounts or server-side database.

## Architecture

- **Framework:** Next.js (App Router) deployed on Vercel.
- **Frontend:** React components for the deck and the evolving Motion Reader card.
- **Backend:** Next.js Route Handlers under `app/api/*` — no separately hosted backend.
- **Secrets (Vercel env vars):** `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`, `APP_PASSWORD`.
- **AI model:** Claude (latest capable model at build time).
- **Transcription:** Deepgram (server-side; key never reaches the browser).

```
Browser (React)
  │  audio blob ─────────────▶  POST /api/transcribe  ──▶ Deepgram  ──▶ text
  │  {step,motion,payload} ──▶  POST /api/coach       ──▶ Claude    ──▶ structured JSON
  │  reads/writes progress ──▶  localStorage (per device)
  └─ password gate (checks APP_PASSWORD via a small auth route)
```

## The Motion Reader interaction

A **deck** of motion "flashcards" (Quizlet-style). Each card shows a motion; progress dots
mark done / current / to-do. Selecting a card opens a **single evolving card** for that
motion: the motion text stays pinned at the top, and the activity area below morphs through
three steps. The student never "leaves" the card (validated design decision — chosen over a
stepped wizard).

### Step 1 — Restate the claim
- Prompt: "Say the motion in your own words — what's the core claim?"
- Input: voice (default) or text.
- AI response: a brief reaction confirming the student captured the core, or gently noting a
  missing/ misread element. Not a grade.

### Step 2 — Explore keywords
- Pre-designated **key words** in the motion are gold-underlined and clickable. (Not every
  word — only the ones that carry scope/meaning weight, designated in the content bank.)
- Clicking a keyword opens a mini-activity: a definition-in-context plus a thinking question
  about scope, meaning, or edge cases (e.g. clicking "kids" → "what age range should this
  mean, and why?").
- Student answers by voice or text; AI responds in the coaching style.

### Step 3 — Generate 3 for / 3 against
- Student generates **all six** arguments themselves (voice or text). They never select from
  a list — open-ended generation is a core pedagogical requirement.
- After all six are entered, the student triggers **Refine**. The AI reviews the whole set at
  once (validated timing decision — chosen over refine-as-you-go, because seeing all six is
  what enables the near-duplicate catch).
- AI behavior:
  - Flags **near-duplicate** arguments (two arguments making the same underlying point) and
    asks the student to differentiate or drop one.
  - Flags weak links and asks **one sharpening question** per flagged argument.
  - Gives a quiet acknowledgement for distinct/strong arguments.
  - **Never rewrites the argument for the student.** It nudges only.

### Modality
- **Voice-first** on the reflective single-answer steps (restate, keyword), via Deepgram, with a quiet "type instead" fallback.
- **Carve-out:** Step 3's six-box argument grid is text-only for the prototype — a deliberate exception to voice-first, since the rapid brainstorm grid would be cluttered by six separate mic affordances. Voice on the argument boxes is a possible fast-follow.
- Interactive/clickable elements are core to step 2.

## Content model

- **`content/motions.json`** — a starter bank of ~10–15 curated motions, editable by coaches
  without touching code. Schema per entry:

  ```json
  {
    "id": "motion-02",
    "motion": "This House would let kids vote.",
    "keywords": [
      { "word": "House", "hint": null },
      { "word": "kids", "hint": "Scope is the fight here — age 5 vs 17 changes everything." },
      { "word": "vote", "hint": null }
    ],
    "theme": "general"
  }
  ```

  - `keywords[].word` designates which words are clickable.
  - `keywords[].hint` is an optional coach-authored steer; when `null`, the AI generates the
    keyword prompt dynamically.
  - `theme` tags the motion for optional theme packs (e.g. fictional-universe motions). The
    deck can filter by theme. Ships general-only; themed content is added later as data, not
    code.

- **Prompt templates** live as versioned files in the repo (one per AI touchpoint: restate
  check, keyword coaching, argument refinement) so tone can be tuned without hunting through
  component code.

## API surface

- `POST /api/transcribe`
  - Input: audio blob.
  - Action: forward to Deepgram, return `{ text }`.
- `POST /api/coach`
  - Input: `{ step: "restate" | "keyword" | "refine", motion, payload }`.
  - Action: select the step-appropriate prompt template, call Claude, return **structured
    JSON** (e.g. for `refine`: an array of `{ argumentId, verdict, flag?, question? }` plus a
    set-level `duplicateGroups`).
  - Structured output keeps the UI in control of rendering — no raw chat stream.
- Auth route: validates a submitted password against `APP_PASSWORD`; on success sets a
  session cookie gating the app.

## Auth & persistence

- **Auth:** a single shared cohort password (env var `APP_PASSWORD`), entered on a gate
  screen. Matches the "password-protected link" delivery model; no accounts.
- **Persistence:** `localStorage` per device — progress dots and prior answers survive
  refresh. No database in the prototype.

## Error handling

- **Transcription failure / no mic permission:** fall back to the text input automatically and
  surface a short, kid-friendly message.
- **AI call failure/timeout:** show a retry affordance; never block the student from advancing
  the activity manually.
- **Empty/very short input:** the coach prompt handles it conversationally (asks for more)
  rather than the UI hard-validating.
- **Missing/invalid password:** gate stays closed with a simple retry.

## Testing

- Component tests for the evolving-card **state machine** (step transitions, progress) and the
  **voice→text fallback** logic.
- `/api/coach` tested against a **mocked Claude client** — assert the correct prompt template
  is selected per step and that structured output is parsed/validated — so tests don't consume
  API calls or require live keys.
- `/api/transcribe` tested with a mocked Deepgram client.
- `motions.json` validated against its schema in a test so malformed coach edits fail loudly.

## Open questions (deferred, do not block Layer 1)

- Whether Deepgram runs batch (record → send → transcribe) or streaming — start with batch;
  revisit if latency hurts the experience.
- Exact wording/tone of prompt templates — will be tuned against J's finalized CLI curriculum
  draft when it lands. The starter bank unblocks building in the meantime.
- Layer 2's generative-vs-discovery balance and Layer 3's scoring rubric are out of scope here.
