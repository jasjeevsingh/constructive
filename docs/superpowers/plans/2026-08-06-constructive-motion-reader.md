# Constructive — Layer 1 (Motion Reader) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Motion Reader — a Quizlet-style deck of debate motions where a student works one evolving card through three steps (restate the claim → explore keywords → generate 3 arguments for/against), with voice-first input and an AI coach that nudges but never rewrites.

**Architecture:** Next.js (App Router, TypeScript) on Vercel. React frontend for the deck and evolving card; Next Route Handlers under `app/api/*` proxy to Claude (coaching) and Deepgram (transcription) so secrets stay server-side. Progress persists in `localStorage`. Pure logic (schemas, state machine, prompts, coach parsing) is isolated from React and from network I/O so it is unit-testable without live keys.

**Tech Stack:** Next.js 14, React 18, TypeScript (strict), Zod (validation), `@anthropic-ai/sdk`, `@deepgram/sdk`, Vitest + React Testing Library + jsdom.

## Global Constraints

- Runtime: Node 22; package manager npm 10.
- TypeScript `strict: true`; App Router only (no `pages/`).
- Secrets are server-side only: `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`, `APP_PASSWORD` are read only inside `app/api/*` / `middleware.ts` / `lib/**`, never in a client component.
- No database. Per-device persistence is `localStorage` only, under key `constructive:progress:v1`.
- Every text input is **voice-first with a text fallback**; the text path must always work even when voice is unavailable.
- The refine step reviews **all six arguments at once** (never as-you-go).
- The AI coach **nudges only — it must never rewrite the student's argument.** Prompt templates enforce this in their instructions.
- All AI/transcription responses cross the wire as **structured JSON**, validated with Zod; a raw chat stream is never surfaced to the UI.
- Coach model id: `claude-sonnet-5` (override via env `COACH_MODEL`). Deepgram model: `nova-2`.
- Import alias: `@/` resolves to repo root.
- Brand tokens (from existing repo HTML): navy `#0A1628`, navy-mid `#112240`, navy-light `#1B3461`, gold `#C8962E`, orange `#F4732A`, orange-light `#FF9A5C`, paper `#F7F6F2`, ink `#111E2B`, dim `#9AA5B4`. Fonts: Playfair Display (display), DM Sans (body), Bebas Neue (accents).

---

## File Structure

```
constructive/
  package.json                     # deps + scripts (Task 1)
  next.config.mjs                  # Next config (Task 1)
  tsconfig.json                    # TS strict + @/ alias (Task 1)
  vitest.config.ts                 # jsdom + alias + react plugin (Task 1)
  vitest.setup.ts                  # jest-dom matchers (Task 1)
  .env.example                     # documents required env vars (Task 1)
  app/
    layout.tsx                     # root layout + fonts (Task 2)
    globals.css                    # brand tokens + base styles (Task 2)
    page.tsx                       # gated deck home (Task 12)
    api/
      auth/route.ts                # password check → cookie (Task 10)
      coach/route.ts               # coaching endpoint (Task 8)
      transcribe/route.ts          # Deepgram endpoint (Task 9)
  middleware.ts                    # gate non-public routes (Task 10)
  content/
    motions.json                   # starter motion bank (Task 3)
  lib/
    schemas.ts                     # Zod schemas + inferred types (Task 3)
    motions.ts                     # load + validate motions.json (Task 3)
    auth.ts                        # checkPassword helper (Task 10)
    state/
      cardMachine.ts               # pure step transitions (Task 4)
      progressStore.ts             # pure localStorage read/write (Task 5)
      useMotionProgress.ts         # thin React hook over the store (Task 5)
    prompts/
      restate.ts                   # restate prompt builder (Task 6)
      keyword.ts                   # keyword prompt builder (Task 6)
      refine.ts                    # refine prompt builder (Task 6)
    ai/
      claude.ts                    # ChatClient interface + real client (Task 7)
      coach.ts                     # runCoach: pick prompt, call, parse (Task 7)
      deepgram.ts                  # transcribeAudio wrapper (Task 9)
  components/
    Gate.tsx                       # password entry (Task 11)
    VoiceOrTextInput.tsx           # voice-first input w/ text fallback (Task 11)
    steps/
      RestateStep.tsx              # step 1 UI (Task 12)
      KeywordStep.tsx              # step 2 UI (Task 12)
      ArgumentsStep.tsx            # step 3 UI (Task 12)
    MotionCard.tsx                 # evolving card container (Task 12)
    Deck.tsx                       # motion picker grid (Task 12)
  tests/                           # mirrors source paths
```

---

### Task 1: Project scaffold + test harness

**Files:**
- Create: `package.json`, `next.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `vitest.setup.ts`, `.env.example`, `.gitignore` (append)
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` (Vitest), `npm run dev/build`, and the `@/` import alias — every later task relies on these.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "constructive",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zod": "^3.23.8",
    "@anthropic-ai/sdk": "^0.27.3",
    "@deepgram/sdk": "^3.6.0"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "@types/node": "^22.5.0",
    "@types/react": "^18.3.4",
    "@types/react-dom": "^18.3.0",
    "vitest": "^2.0.5",
    "jsdom": "^24.1.1",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/user-event": "^14.5.2",
    "@vitejs/plugin-react": "^4.3.1",
    "vite-tsconfig-paths": "^5.0.1"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

- [ ] **Step 5: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Create `.env.example`**

```bash
# Server-side only. Copy to .env.local and fill in.
ANTHROPIC_API_KEY=
DEEPGRAM_API_KEY=
APP_PASSWORD=
# Optional overrides
COACH_MODEL=claude-sonnet-5
```

- [ ] **Step 7: Append Node/Next ignores to `.gitignore`**

```
node_modules/
.next/
.env.local
next-env.d.ts
```

- [ ] **Step 8: Write the smoke test** — `tests/smoke.test.ts`

```ts
import { describe, it, expect } from "vitest";

describe("harness", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 9: Install and run the smoke test**

Run: `npm install && npm test`
Expected: install succeeds; Vitest reports `1 passed` for `tests/smoke.test.ts`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app + Vitest harness"
```

---

### Task 2: App shell + brand tokens

**Files:**
- Create: `app/layout.tsx`, `app/globals.css`
- Test: `tests/app/layout.test.tsx`

**Interfaces:**
- Consumes: Task 1 harness.
- Produces: root layout rendering children; CSS custom properties (`--navy`, `--gold`, `--orange`, etc.) available app-wide.

- [ ] **Step 1: Write the failing test** — `tests/app/layout.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  it("renders its children", () => {
    // RootLayout renders <html>/<body>; render only the body subtree it returns.
    render(<RootLayout>{<p>hello deck</p>}</RootLayout>);
    expect(screen.getByText("hello deck")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/app/layout.test.tsx`
Expected: FAIL — cannot resolve `@/app/layout`.

- [ ] **Step 3: Create `app/globals.css`**

```css
:root {
  --navy: #0A1628;
  --navy-mid: #112240;
  --navy-light: #1B3461;
  --gold: #C8962E;
  --orange: #F4732A;
  --orange-light: #FF9A5C;
  --paper: #F7F6F2;
  --ink: #111E2B;
  --dim: #9AA5B4;
  --text: #E8E8E0;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--navy);
  color: var(--text);
  font-family: "DM Sans", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.serif { font-family: "Playfair Display", Georgia, serif; }
.accent { font-family: "Bebas Neue", sans-serif; letter-spacing: 1px; }
```

- [ ] **Step 4: Create `app/layout.tsx`**

```tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Constructive — Motion Reader",
  description: "Learn to read a debate motion, one card at a time.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:wght@400;700&family=Bebas+Neue&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/app/layout.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/globals.css tests/app/layout.test.tsx
git commit -m "feat: app shell with brand tokens"
```

---

### Task 3: Content model — schemas, motion bank, loader

**Files:**
- Create: `lib/schemas.ts`, `lib/motions.ts`, `content/motions.json`
- Test: `tests/lib/schemas.test.ts`, `tests/lib/motions.test.ts`

**Interfaces:**
- Consumes: Task 1 harness (Zod).
- Produces:
  - Types `Keyword`, `Motion`, `CoachStep`, `CoachRequest`, `CoachResponse` and schemas `MotionSchema`, `MotionsFileSchema`, `CoachRequestSchema`, `CoachResponseSchema`.
  - `getMotions(): Motion[]` and `getMotion(id: string): Motion | undefined`.

- [ ] **Step 1: Write the failing schema test** — `tests/lib/schemas.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { MotionSchema, MotionsFileSchema, CoachResponseSchema } from "@/lib/schemas";

describe("MotionSchema", () => {
  it("accepts a well-formed motion", () => {
    const ok = {
      id: "m1",
      motion: "This House would let kids vote.",
      keywords: [{ word: "kids", hint: "Scope is the fight." }, { word: "vote", hint: null }],
      theme: "general",
    };
    expect(MotionSchema.parse(ok)).toEqual(ok);
  });

  it("rejects a motion missing keywords", () => {
    const bad = { id: "m1", motion: "x", theme: "general" };
    expect(() => MotionSchema.parse(bad)).toThrow();
  });

  it("validates an array of motions", () => {
    expect(() => MotionsFileSchema.parse([])).not.toThrow();
  });
});

describe("CoachResponseSchema", () => {
  it("accepts a refine response", () => {
    const r = {
      kind: "refine",
      verdicts: [{ argumentId: "for-0", verdict: "distinct", question: null }],
      duplicateGroups: [["for-0", "for-1"]],
    };
    expect(CoachResponseSchema.parse(r)).toEqual(r);
  });

  it("rejects an unknown kind", () => {
    expect(() => CoachResponseSchema.parse({ kind: "nope" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/schemas.test.ts`
Expected: FAIL — cannot resolve `@/lib/schemas`.

- [ ] **Step 3: Create `lib/schemas.ts`**

```ts
import { z } from "zod";

export const KeywordSchema = z.object({
  word: z.string().min(1),
  hint: z.string().min(1).nullable(),
});
export type Keyword = z.infer<typeof KeywordSchema>;

export const MotionSchema = z.object({
  id: z.string().min(1),
  motion: z.string().min(1),
  keywords: z.array(KeywordSchema),
  theme: z.string().min(1),
});
export type Motion = z.infer<typeof MotionSchema>;

export const MotionsFileSchema = z.array(MotionSchema);

export const CoachStepSchema = z.enum(["restate", "keyword", "refine"]);
export type CoachStep = z.infer<typeof CoachStepSchema>;

export const CoachRequestSchema = z.object({
  step: CoachStepSchema,
  motion: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});
export type CoachRequest = z.infer<typeof CoachRequestSchema>;

export const RestateResponseSchema = z.object({
  kind: z.literal("restate"),
  reaction: z.string(),
  capturedCore: z.boolean(),
});
export const KeywordResponseSchema = z.object({
  kind: z.literal("keyword"),
  reaction: z.string(),
});
export const RefineVerdictSchema = z.object({
  argumentId: z.string(),
  verdict: z.enum(["distinct", "weak", "duplicate"]),
  question: z.string().nullable(),
});
export const RefineResponseSchema = z.object({
  kind: z.literal("refine"),
  verdicts: z.array(RefineVerdictSchema),
  duplicateGroups: z.array(z.array(z.string())),
});
export const CoachResponseSchema = z.discriminatedUnion("kind", [
  RestateResponseSchema,
  KeywordResponseSchema,
  RefineResponseSchema,
]);
export type CoachResponse = z.infer<typeof CoachResponseSchema>;
export type RefineVerdict = z.infer<typeof RefineVerdictSchema>;
```

- [ ] **Step 4: Create `content/motions.json`** (starter bank — 3 shown; add more later, all `theme: "general"`)

```json
[
  {
    "id": "m-homework",
    "motion": "This House would ban homework.",
    "keywords": [
      { "word": "ban", "hint": "Total ban or limits? The strength of the wording matters." },
      { "word": "homework", "hint": "What counts — reading? projects? What's the scope?" }
    ],
    "theme": "general"
  },
  {
    "id": "m-kids-vote",
    "motion": "This House would let kids vote.",
    "keywords": [
      { "word": "House", "hint": null },
      { "word": "kids", "hint": "Age 5 or 17? Scope is the real fight here." },
      { "word": "vote", "hint": "In every election, or only some?" }
    ],
    "theme": "general"
  },
  {
    "id": "m-social-media",
    "motion": "This House would ban social media for under-16s.",
    "keywords": [
      { "word": "ban", "hint": null },
      { "word": "social media", "hint": "Does this include messaging apps and YouTube?" },
      { "word": "under-16s", "hint": "How would this even be enforced?" }
    ],
    "theme": "general"
  }
]
```

- [ ] **Step 5: Write the failing loader test** — `tests/lib/motions.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { getMotions, getMotion } from "@/lib/motions";

describe("motions loader", () => {
  it("loads and validates the bank", () => {
    const motions = getMotions();
    expect(motions.length).toBeGreaterThanOrEqual(3);
    expect(motions[0]).toHaveProperty("motion");
  });

  it("finds a motion by id", () => {
    expect(getMotion("m-kids-vote")?.motion).toBe("This House would let kids vote.");
  });

  it("returns undefined for an unknown id", () => {
    expect(getMotion("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 6: Create `lib/motions.ts`**

```ts
import raw from "@/content/motions.json";
import { MotionsFileSchema, type Motion } from "@/lib/schemas";

// Validated once at module load; a malformed bank throws loudly here.
const motions: Motion[] = MotionsFileSchema.parse(raw);

export function getMotions(): Motion[] {
  return motions;
}

export function getMotion(id: string): Motion | undefined {
  return motions.find((m) => m.id === id);
}
```

- [ ] **Step 7: Run both tests to verify they pass**

Run: `npm test -- tests/lib/schemas.test.ts tests/lib/motions.test.ts`
Expected: PASS (all cases).

- [ ] **Step 8: Commit**

```bash
git add lib/schemas.ts lib/motions.ts content/motions.json tests/lib/schemas.test.ts tests/lib/motions.test.ts
git commit -m "feat: content schemas + starter motion bank + loader"
```

---

### Task 4: Card state machine

**Files:**
- Create: `lib/state/cardMachine.ts`
- Test: `tests/lib/state/cardMachine.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type Step = "restate" | "keyword" | "arguments"`; `STEPS: Step[]`; `nextStep(s)`, `prevStep(s)`, `stepIndex(s)`, `isLastStep(s)`.

- [ ] **Step 1: Write the failing test** — `tests/lib/state/cardMachine.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { STEPS, nextStep, prevStep, stepIndex, isLastStep } from "@/lib/state/cardMachine";

describe("cardMachine", () => {
  it("has the three steps in order", () => {
    expect(STEPS).toEqual(["restate", "keyword", "arguments"]);
  });
  it("advances forward and clamps at the end", () => {
    expect(nextStep("restate")).toBe("keyword");
    expect(nextStep("keyword")).toBe("arguments");
    expect(nextStep("arguments")).toBe("arguments");
  });
  it("goes back and clamps at the start", () => {
    expect(prevStep("arguments")).toBe("keyword");
    expect(prevStep("restate")).toBe("restate");
  });
  it("reports index and last-step", () => {
    expect(stepIndex("keyword")).toBe(1);
    expect(isLastStep("arguments")).toBe(true);
    expect(isLastStep("restate")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/state/cardMachine.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Create `lib/state/cardMachine.ts`**

```ts
export type Step = "restate" | "keyword" | "arguments";

export const STEPS: Step[] = ["restate", "keyword", "arguments"];

export function stepIndex(s: Step): number {
  return STEPS.indexOf(s);
}

export function nextStep(s: Step): Step {
  const i = stepIndex(s);
  return STEPS[Math.min(i + 1, STEPS.length - 1)];
}

export function prevStep(s: Step): Step {
  const i = stepIndex(s);
  return STEPS[Math.max(i - 1, 0)];
}

export function isLastStep(s: Step): boolean {
  return stepIndex(s) === STEPS.length - 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/state/cardMachine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/state/cardMachine.ts tests/lib/state/cardMachine.test.ts
git commit -m "feat: motion card step state machine"
```

---

### Task 5: Progress persistence (store + hook)

**Files:**
- Create: `lib/state/progressStore.ts`, `lib/state/useMotionProgress.ts`
- Test: `tests/lib/state/progressStore.test.ts`

**Interfaces:**
- Consumes: `Step` from Task 4.
- Produces:
  - `interface MotionProgress { step: Step; restate: string; keywordAnswers: Record<string,string>; argsFor: string[]; argsAgainst: string[]; completed: boolean }`
  - `emptyProgress(): MotionProgress`
  - `loadProgress(storage: Storage, motionId: string): MotionProgress`
  - `saveProgress(storage: Storage, motionId: string, p: MotionProgress): void`
  - `loadAll(storage: Storage): Record<string, MotionProgress>`
  - Hook `useMotionProgress(motionId): [MotionProgress, (patch: Partial<MotionProgress>) => void]`

- [ ] **Step 1: Write the failing test** — `tests/lib/state/progressStore.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  emptyProgress,
  loadProgress,
  saveProgress,
  STORAGE_KEY,
} from "@/lib/state/progressStore";

describe("progressStore", () => {
  beforeEach(() => localStorage.clear());

  it("returns empty progress when nothing is stored", () => {
    const p = loadProgress(localStorage, "m1");
    expect(p).toEqual(emptyProgress());
    expect(p.step).toBe("restate");
  });

  it("round-trips a saved motion under the versioned key", () => {
    const p = { ...emptyProgress(), restate: "kids get a say", step: "keyword" as const };
    saveProgress(localStorage, "m1", p);
    expect(loadProgress(localStorage, "m1").restate).toBe("kids get a say");
    expect(localStorage.getItem(STORAGE_KEY)).toContain("m1");
  });

  it("keeps motions independent", () => {
    saveProgress(localStorage, "m1", { ...emptyProgress(), restate: "a" });
    saveProgress(localStorage, "m2", { ...emptyProgress(), restate: "b" });
    expect(loadProgress(localStorage, "m1").restate).toBe("a");
    expect(loadProgress(localStorage, "m2").restate).toBe("b");
  });

  it("tolerates corrupt storage by falling back to empty", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadProgress(localStorage, "m1")).toEqual(emptyProgress());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/state/progressStore.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Create `lib/state/progressStore.ts`**

```ts
import type { Step } from "@/lib/state/cardMachine";

export const STORAGE_KEY = "constructive:progress:v1";

export interface MotionProgress {
  step: Step;
  restate: string;
  keywordAnswers: Record<string, string>;
  argsFor: string[];
  argsAgainst: string[];
  completed: boolean;
}

export function emptyProgress(): MotionProgress {
  return {
    step: "restate",
    restate: "",
    keywordAnswers: {},
    argsFor: [],
    argsAgainst: [],
    completed: false,
  };
}

function readAll(storage: Storage): Record<string, MotionProgress> {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadAll(storage: Storage): Record<string, MotionProgress> {
  return readAll(storage);
}

export function loadProgress(storage: Storage, motionId: string): MotionProgress {
  const all = readAll(storage);
  return all[motionId] ?? emptyProgress();
}

export function saveProgress(storage: Storage, motionId: string, p: MotionProgress): void {
  const all = readAll(storage);
  all[motionId] = p;
  storage.setItem(STORAGE_KEY, JSON.stringify(all));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/state/progressStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the hook `lib/state/useMotionProgress.ts`** (thin wrapper; no separate unit test — exercised via component tests in Task 12)

```ts
"use client";
import { useCallback, useEffect, useState } from "react";
import {
  emptyProgress,
  loadProgress,
  saveProgress,
  type MotionProgress,
} from "@/lib/state/progressStore";

export function useMotionProgress(
  motionId: string
): [MotionProgress, (patch: Partial<MotionProgress>) => void] {
  const [progress, setProgress] = useState<MotionProgress>(emptyProgress());

  // Hydrate from localStorage on mount (client only).
  useEffect(() => {
    setProgress(loadProgress(window.localStorage, motionId));
  }, [motionId]);

  const update = useCallback(
    (patch: Partial<MotionProgress>) => {
      setProgress((prev) => {
        const next = { ...prev, ...patch };
        saveProgress(window.localStorage, motionId, next);
        return next;
      });
    },
    [motionId]
  );

  return [progress, update];
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/state/progressStore.ts lib/state/useMotionProgress.ts tests/lib/state/progressStore.test.ts
git commit -m "feat: localStorage progress store + hook"
```

---

### Task 6: Prompt builders

**Files:**
- Create: `lib/prompts/restate.ts`, `lib/prompts/keyword.ts`, `lib/prompts/refine.ts`
- Test: `tests/lib/prompts.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (each returns `{ system: string; user: string }`):
  - `restatePrompt(input: { motion: string; restate: string })`
  - `keywordPrompt(input: { motion: string; word: string; hint: string | null; answer: string })`
  - `refinePrompt(input: { motion: string; argsFor: string[]; argsAgainst: string[] })`

- [ ] **Step 1: Write the failing test** — `tests/lib/prompts.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { restatePrompt } from "@/lib/prompts/restate";
import { keywordPrompt } from "@/lib/prompts/keyword";
import { refinePrompt } from "@/lib/prompts/refine";

describe("prompt builders", () => {
  it("restate prompt embeds motion + answer and asks for JSON", () => {
    const p = restatePrompt({ motion: "THW ban homework.", restate: "no more homework" });
    expect(p.user).toContain("THW ban homework.");
    expect(p.user).toContain("no more homework");
    expect(p.system.toLowerCase()).toContain("json");
  });

  it("keyword prompt includes the coach hint when present", () => {
    const p = keywordPrompt({ motion: "THW let kids vote.", word: "kids", hint: "scope!", answer: "ages 10+" });
    expect(p.user).toContain("kids");
    expect(p.user).toContain("scope!");
    expect(p.user).toContain("ages 10+");
  });

  it("refine prompt lists all six arguments and forbids rewriting", () => {
    const p = refinePrompt({
      motion: "THW let kids vote.",
      argsFor: ["a", "b", "c"],
      argsAgainst: ["d", "e", "f"],
    });
    ["a", "b", "c", "d", "e", "f"].forEach((x) => expect(p.user).toContain(x));
    expect(p.system.toLowerCase()).toContain("do not rewrite");
    expect(p.system).toContain("for-0");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/prompts.test.ts`
Expected: FAIL — cannot resolve modules.

- [ ] **Step 3: Create `lib/prompts/restate.ts`**

```ts
export function restatePrompt(input: { motion: string; restate: string }): {
  system: string;
  user: string;
} {
  const system = [
    "You are a warm debate coach for a student aged 10-18.",
    "The student is restating a debate motion in their own words.",
    "Encourage them, then note gently if they missed or misread the core claim.",
    "You are a helper, not a grader. Keep it to 2-3 sentences.",
    'Respond ONLY as JSON: {"kind":"restate","reaction":string,"capturedCore":boolean}.',
  ].join(" ");
  const user = [
    `Motion: "${input.motion}"`,
    `Student's restatement: "${input.restate}"`,
    "Did they capture the core claim? Give your reaction.",
  ].join("\n");
  return { system, user };
}
```

- [ ] **Step 4: Create `lib/prompts/keyword.ts`**

```ts
export function keywordPrompt(input: {
  motion: string;
  word: string;
  hint: string | null;
  answer: string;
}): { system: string; user: string } {
  const system = [
    "You are a warm debate coach for a student aged 10-18.",
    "The student is thinking about the scope/meaning of one keyword in a motion.",
    "React to their thinking and push once on scope or an edge case. Keep it to 2-3 sentences.",
    'Respond ONLY as JSON: {"kind":"keyword","reaction":string}.',
  ].join(" ");
  const user = [
    `Motion: "${input.motion}"`,
    `Keyword under discussion: "${input.word}"`,
    input.hint ? `Coach note about this word: "${input.hint}"` : "No coach note for this word.",
    `Student's thinking: "${input.answer}"`,
  ].join("\n");
  return { system, user };
}
```

- [ ] **Step 5: Create `lib/prompts/refine.ts`**

```ts
export function refinePrompt(input: {
  motion: string;
  argsFor: string[];
  argsAgainst: string[];
}): { system: string; user: string } {
  const system = [
    "You are a warm debate coach for a student aged 10-18.",
    "The student wrote three arguments FOR and three AGAINST a motion.",
    "Review ALL SIX together. Flag any two that make the same underlying point as 'duplicate',",
    "flag thin ones as 'weak', and mark strong distinct ones as 'distinct'.",
    "For each weak/duplicate argument ask ONE sharpening question. DO NOT rewrite their arguments for them.",
    "Argument ids are 'for-0','for-1','for-2','against-0','against-1','against-2'.",
    'Respond ONLY as JSON: {"kind":"refine","verdicts":[{"argumentId":string,"verdict":"distinct"|"weak"|"duplicate","question":string|null}],"duplicateGroups":[[string,...]]}.',
  ].join(" ");
  const forList = input.argsFor.map((a, i) => `for-${i}: ${a}`).join("\n");
  const againstList = input.argsAgainst.map((a, i) => `against-${i}: ${a}`).join("\n");
  const user = [`Motion: "${input.motion}"`, "FOR:", forList, "AGAINST:", againstList].join("\n");
  return { system, user };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/lib/prompts.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/prompts tests/lib/prompts.test.ts
git commit -m "feat: coach prompt builders (restate/keyword/refine)"
```

---

### Task 7: Coach core — client interface + runCoach

**Files:**
- Create: `lib/ai/claude.ts`, `lib/ai/coach.ts`
- Test: `tests/lib/ai/coach.test.ts`

**Interfaces:**
- Consumes: prompt builders (Task 6), `CoachRequest`/`CoachResponse`/`CoachResponseSchema` (Task 3).
- Produces:
  - `interface ChatClient { complete(args: { system: string; user: string }): Promise<string> }`
  - `getChatClient(): ChatClient` (reads `ANTHROPIC_API_KEY`, `COACH_MODEL`)
  - `runCoach(req: CoachRequest, client: ChatClient): Promise<CoachResponse>`

- [ ] **Step 1: Write the failing test** — `tests/lib/ai/coach.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { runCoach } from "@/lib/ai/coach";
import type { ChatClient } from "@/lib/ai/claude";

function fakeClient(reply: string): ChatClient & { calls: { system: string; user: string }[] } {
  const calls: { system: string; user: string }[] = [];
  return {
    calls,
    async complete(args) {
      calls.push(args);
      return reply;
    },
  };
}

describe("runCoach", () => {
  it("uses the refine prompt and parses structured JSON", async () => {
    const reply = JSON.stringify({
      kind: "refine",
      verdicts: [{ argumentId: "for-0", verdict: "duplicate", question: "How is this different from for-1?" }],
      duplicateGroups: [["for-0", "for-1"]],
    });
    const client = fakeClient(reply);
    const res = await runCoach(
      { step: "refine", motion: "THW let kids vote.", payload: { argsFor: ["a", "a2", "c"], argsAgainst: ["d", "e", "f"] } },
      client
    );
    expect(res.kind).toBe("refine");
    // The refine prompt must have been used (mentions the ids).
    expect(client.calls[0].system).toContain("for-0");
  });

  it("parses a restate response", async () => {
    const reply = JSON.stringify({ kind: "restate", reaction: "Nice start!", capturedCore: true });
    const res = await runCoach(
      { step: "restate", motion: "THW ban homework.", payload: { restate: "no homework" } },
      fakeClient(reply)
    );
    expect(res).toMatchObject({ kind: "restate", capturedCore: true });
  });

  it("throws when the model returns non-JSON", async () => {
    await expect(
      runCoach({ step: "restate", motion: "m", payload: { restate: "x" } }, fakeClient("not json"))
    ).rejects.toThrow();
  });

  it("throws when JSON fails schema validation", async () => {
    const reply = JSON.stringify({ kind: "restate", reaction: "hi" }); // missing capturedCore
    await expect(
      runCoach({ step: "restate", motion: "m", payload: { restate: "x" } }, fakeClient(reply))
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/ai/coach.test.ts`
Expected: FAIL — cannot resolve `@/lib/ai/coach`.

- [ ] **Step 3: Create `lib/ai/claude.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";

export interface ChatClient {
  complete(args: { system: string; user: string }): Promise<string>;
}

const MODEL = process.env.COACH_MODEL ?? "claude-sonnet-5";

export function getChatClient(): ChatClient {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const anthropic = new Anthropic({ apiKey });
  return {
    async complete({ system, user }) {
      const msg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: user }],
      });
      return msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
    },
  };
}
```

- [ ] **Step 4: Create `lib/ai/coach.ts`**

```ts
import { restatePrompt } from "@/lib/prompts/restate";
import { keywordPrompt } from "@/lib/prompts/keyword";
import { refinePrompt } from "@/lib/prompts/refine";
import { CoachResponseSchema, type CoachRequest, type CoachResponse } from "@/lib/schemas";
import type { ChatClient } from "@/lib/ai/claude";

function buildPrompt(req: CoachRequest): { system: string; user: string } {
  const p = req.payload as Record<string, unknown>;
  switch (req.step) {
    case "restate":
      return restatePrompt({ motion: req.motion, restate: String(p.restate ?? "") });
    case "keyword":
      return keywordPrompt({
        motion: req.motion,
        word: String(p.word ?? ""),
        hint: (p.hint as string | null) ?? null,
        answer: String(p.answer ?? ""),
      });
    case "refine":
      return refinePrompt({
        motion: req.motion,
        argsFor: (p.argsFor as string[]) ?? [],
        argsAgainst: (p.argsAgainst as string[]) ?? [],
      });
  }
}

export async function runCoach(req: CoachRequest, client: ChatClient): Promise<CoachResponse> {
  const { system, user } = buildPrompt(req);
  const raw = await client.complete({ system, user });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Coach returned non-JSON output");
  }
  return CoachResponseSchema.parse(parsed);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/lib/ai/coach.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 6: Commit**

```bash
git add lib/ai/claude.ts lib/ai/coach.ts tests/lib/ai/coach.test.ts
git commit -m "feat: coach core (ChatClient + runCoach with schema validation)"
```

---

### Task 8: `/api/coach` route

**Files:**
- Create: `app/api/coach/route.ts`
- Test: `tests/app/api/coach.test.ts`

**Interfaces:**
- Consumes: `runCoach` (Task 7), `getChatClient` (Task 7), `CoachRequestSchema` (Task 3).
- Produces: `POST` handler returning `200` with a `CoachResponse` JSON body, `400` on invalid input, `500` on coach failure.

- [ ] **Step 1: Write the failing test** — `tests/app/api/coach.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Claude client factory so the route never hits the network.
vi.mock("@/lib/ai/claude", () => ({
  getChatClient: () => ({
    complete: async () =>
      JSON.stringify({ kind: "restate", reaction: "Good start", capturedCore: true }),
  }),
}));

import { POST } from "@/app/api/coach/route";

function post(body: unknown): Request {
  return new Request("http://test/api/coach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/coach", () => {
  it("returns a coach response for a valid request", async () => {
    const res = await POST(post({ step: "restate", motion: "THW ban homework.", payload: { restate: "no homework" } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ kind: "restate", capturedCore: true });
  });

  it("returns 400 for an invalid request", async () => {
    const res = await POST(post({ step: "bogus", motion: "" }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/app/api/coach.test.ts`
Expected: FAIL — cannot resolve `@/app/api/coach/route`.

- [ ] **Step 3: Create `app/api/coach/route.ts`**

```ts
import { CoachRequestSchema } from "@/lib/schemas";
import { getChatClient } from "@/lib/ai/claude";
import { runCoach } from "@/lib/ai/coach";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = CoachRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await runCoach(parsed.data, getChatClient());
    return Response.json(result, { status: 200 });
  } catch (err) {
    return Response.json({ error: "coach failed" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/app/api/coach.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/coach/route.ts tests/app/api/coach.test.ts
git commit -m "feat: /api/coach route with request validation"
```

---

### Task 9: Deepgram wrapper + `/api/transcribe` route

**Files:**
- Create: `lib/ai/deepgram.ts`, `app/api/transcribe/route.ts`
- Test: `tests/app/api/transcribe.test.ts`

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces:
  - `transcribeAudio(buffer: Buffer, mimetype: string): Promise<string>`
  - `POST` handler: reads audio from the request body, returns `{ text }` (200), `400` on empty body, `500` on transcription failure.

- [ ] **Step 1: Write the failing test** — `tests/app/api/transcribe.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/ai/deepgram", () => ({
  transcribeAudio: async (buf: Buffer) =>
    buf.length > 0 ? "kids should be able to vote" : "",
}));

import { POST } from "@/app/api/transcribe/route";

function post(bytes: Uint8Array): Request {
  return new Request("http://test/api/transcribe", {
    method: "POST",
    headers: { "content-type": "audio/webm" },
    body: bytes,
  });
}

describe("POST /api/transcribe", () => {
  it("returns transcribed text for audio", async () => {
    const res = await POST(post(new Uint8Array([1, 2, 3, 4])));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "kids should be able to vote" });
  });

  it("returns 400 for an empty body", async () => {
    const res = await POST(post(new Uint8Array([])));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/app/api/transcribe.test.ts`
Expected: FAIL — cannot resolve route module.

- [ ] **Step 3: Create `lib/ai/deepgram.ts`**

```ts
import { createClient } from "@deepgram/sdk";

export async function transcribeAudio(buffer: Buffer, mimetype: string): Promise<string> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY is not set");
  const dg = createClient(apiKey);
  const { result, error } = await dg.listen.prerecorded.transcribeFile(buffer, {
    model: "nova-2",
    smart_format: true,
    mimetype,
  });
  if (error) throw error;
  return result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
}
```

- [ ] **Step 4: Create `app/api/transcribe/route.ts`**

```ts
import { transcribeAudio } from "@/lib/ai/deepgram";

export async function POST(req: Request): Promise<Response> {
  const arrayBuf = await req.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  if (buffer.length === 0) {
    return Response.json({ error: "empty audio" }, { status: 400 });
  }
  const mimetype = req.headers.get("content-type") ?? "audio/webm";
  try {
    const text = await transcribeAudio(buffer, mimetype);
    return Response.json({ text }, { status: 200 });
  } catch {
    return Response.json({ error: "transcription failed" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/app/api/transcribe.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/deepgram.ts app/api/transcribe/route.ts tests/app/api/transcribe.test.ts
git commit -m "feat: Deepgram transcription wrapper + /api/transcribe route"
```

---

### Task 10: Auth — password helper, route, middleware gate

**Files:**
- Create: `lib/auth.ts`, `app/api/auth/route.ts`, `middleware.ts`
- Test: `tests/lib/auth.test.ts`, `tests/app/api/auth.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `AUTH_COOKIE = "constructive_auth"`, `checkPassword(input: string, expected: string | undefined): boolean`
  - `POST /api/auth`: `{ password }` → 200 + `Set-Cookie` on match, 401 on mismatch.
  - `middleware.ts`: redirects unauthenticated requests (except `/gate`, `/api/auth`, static assets) — verified manually, not unit-tested.

- [ ] **Step 1: Write the failing helper test** — `tests/lib/auth.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { checkPassword } from "@/lib/auth";

describe("checkPassword", () => {
  it("matches the configured password", () => {
    expect(checkPassword("letmein", "letmein")).toBe(true);
  });
  it("rejects a wrong password", () => {
    expect(checkPassword("nope", "letmein")).toBe(false);
  });
  it("rejects when no password is configured", () => {
    expect(checkPassword("anything", undefined)).toBe(false);
  });
  it("rejects an empty attempt", () => {
    expect(checkPassword("", "letmein")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/auth.test.ts`
Expected: FAIL — cannot resolve `@/lib/auth`.

- [ ] **Step 3: Create `lib/auth.ts`**

```ts
export const AUTH_COOKIE = "constructive_auth";

export function checkPassword(input: string, expected: string | undefined): boolean {
  if (!expected) return false;
  if (!input) return false;
  return input === expected;
}
```

- [ ] **Step 4: Run helper test to verify it passes**

Run: `npm test -- tests/lib/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing route test** — `tests/app/api/auth.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/route";

beforeEach(() => {
  process.env.APP_PASSWORD = "letmein";
});

function post(body: unknown): Request {
  return new Request("http://test/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth", () => {
  it("sets a cookie on the right password", async () => {
    const res = await POST(post({ password: "letmein" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie") ?? "").toContain("constructive_auth=");
  });

  it("401s on a wrong password", async () => {
    const res = await POST(post({ password: "wrong" }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 6: Run route test to verify it fails**

Run: `npm test -- tests/app/api/auth.test.ts`
Expected: FAIL — cannot resolve `@/app/api/auth/route`.

- [ ] **Step 7: Create `app/api/auth/route.ts`**

```ts
import { AUTH_COOKIE, checkPassword } from "@/lib/auth";

export async function POST(req: Request): Promise<Response> {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (!checkPassword(body.password ?? "", process.env.APP_PASSWORD)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const headers = new Headers();
  headers.append("content-type", "application/json");
  headers.append(
    "set-cookie",
    `${AUTH_COOKIE}=ok; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
  );
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
```

- [ ] **Step 8: Run route test to verify it passes**

Run: `npm test -- tests/app/api/auth.test.ts`
Expected: PASS.

- [ ] **Step 9: Create `middleware.ts`** (gate; manual/integration verification)

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

const PUBLIC_PATHS = ["/gate", "/api/auth"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const authed = req.cookies.get(AUTH_COOKIE)?.value === "ok";

  if (!isPublic && !authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/gate";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Skip Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 10: Commit**

```bash
git add lib/auth.ts app/api/auth/route.ts middleware.ts tests/lib/auth.test.ts tests/app/api/auth.test.ts
git commit -m "feat: cohort password gate (helper + route + middleware)"
```

---

### Task 11: Input + gate components

**Files:**
- Create: `components/VoiceOrTextInput.tsx`, `components/Gate.tsx`
- Test: `tests/components/VoiceOrTextInput.test.tsx`

**Interfaces:**
- Consumes: `/api/transcribe` (via fetch, mocked in tests), `/api/auth` (Gate).
- Produces:
  - `VoiceOrTextInput({ label, onSubmit }: { label: string; onSubmit: (text: string) => void })` — always renders a textarea + submit (fallback); renders a mic button only when `navigator.mediaDevices?.getUserMedia` exists.
  - `Gate()` — password form that POSTs to `/api/auth` and reloads on success.

- [ ] **Step 1: Write the failing test** — `tests/components/VoiceOrTextInput.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";

describe("VoiceOrTextInput", () => {
  beforeEach(() => {
    // No media support in jsdom → text-only fallback path.
    // @ts-expect-error force undefined for the test
    global.navigator.mediaDevices = undefined;
  });

  it("submits typed text via the fallback", async () => {
    const onSubmit = vi.fn();
    render(<VoiceOrTextInput label="Restate the motion" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole("textbox"), "kids should vote");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith("kids should vote");
  });

  it("hides the mic button when voice is unsupported", () => {
    render(<VoiceOrTextInput label="Restate the motion" onSubmit={() => {}} />);
    expect(screen.queryByRole("button", { name: /talk/i })).toBeNull();
  });

  it("shows the label", () => {
    render(<VoiceOrTextInput label="Restate the motion" onSubmit={() => {}} />);
    expect(screen.getByText("Restate the motion")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/VoiceOrTextInput.test.tsx`
Expected: FAIL — cannot resolve `@/components/VoiceOrTextInput`.

- [ ] **Step 3: Create `components/VoiceOrTextInput.tsx`**

```tsx
"use client";
import { useState } from "react";

function voiceSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function VoiceOrTextInput({
  label,
  onSubmit,
}: {
  label: string;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);

  async function record() {
    // Minimal batch capture: record one clip, POST to /api/transcribe, fill the textarea.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks: BlobPart[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: "audio/webm" });
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "content-type": "audio/webm" },
        body: blob,
      });
      if (res.ok) {
        const { text: t } = await res.json();
        setText((prev) => (prev ? `${prev} ${t}` : t));
      }
      setRecording(false);
    };
    rec.start();
    setRecording(true);
    // Stop after a short window; a fuller UI would use press-and-hold.
    setTimeout(() => rec.stop(), 6000);
  }

  return (
    <div>
      <label style={{ display: "block", marginBottom: 8, color: "var(--dim)" }}>{label}</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        style={{ width: "100%", background: "var(--navy-mid)", color: "var(--text)", border: "1px solid #24344f", borderRadius: 10, padding: 10 }}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        {voiceSupported() && (
          <button type="button" onClick={record} disabled={recording}>
            {recording ? "Listening…" : "🎤 Hold to talk"}
          </button>
        )}
        <button type="button" onClick={() => onSubmit(text)}>
          Submit
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/VoiceOrTextInput.test.tsx`
Expected: PASS (all three cases).

- [ ] **Step 5: Create `components/Gate.tsx`** (no separate unit test — the auth route is already covered; this is thin UI verified manually)

```tsx
"use client";
import { useState } from "react";

export function Gate() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  async function submit() {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.href = "/";
    } else {
      setError(true);
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: "18vh auto", textAlign: "center" }}>
      <h1 className="serif">Constructive</h1>
      <p style={{ color: "var(--dim)" }}>Enter the password from your retreat packet.</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={{ width: "100%", padding: 10, borderRadius: 10, marginTop: 12 }}
      />
      {error && <p style={{ color: "var(--orange)" }}>That password didn&apos;t work.</p>}
      <button type="button" onClick={submit} style={{ marginTop: 12 }}>
        Enter
      </button>
    </main>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/VoiceOrTextInput.tsx components/Gate.tsx tests/components/VoiceOrTextInput.test.tsx
git commit -m "feat: voice-or-text input + password gate UI"
```

---

### Task 12: Step components, evolving card, deck, pages

**Files:**
- Create: `components/steps/RestateStep.tsx`, `components/steps/KeywordStep.tsx`, `components/steps/ArgumentsStep.tsx`, `components/MotionCard.tsx`, `components/Deck.tsx`, `app/page.tsx`, `app/gate/page.tsx`
- Test: `tests/components/ArgumentsStep.test.tsx`, `tests/components/MotionCard.test.tsx`

**Interfaces:**
- Consumes: `VoiceOrTextInput` (Task 11), `useMotionProgress` (Task 5), `cardMachine` (Task 4), `getMotions`/`getMotion` (Task 3), `CoachResponse` types (Task 3), `/api/coach` (fetch, mocked in tests).
- Produces: the full gated Motion Reader UI at `/`.

- [ ] **Step 1: Write the failing ArgumentsStep test** — `tests/components/ArgumentsStep.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArgumentsStep } from "@/components/steps/ArgumentsStep";

const refineReply = {
  kind: "refine",
  verdicts: [
    { argumentId: "for-0", verdict: "duplicate", question: "How does this differ from for-1?" },
    { argumentId: "for-1", verdict: "duplicate", question: "Can you make this a different kind of impact?" },
    { argumentId: "for-2", verdict: "distinct", question: null },
    { argumentId: "against-0", verdict: "distinct", question: null },
    { argumentId: "against-1", verdict: "weak", question: "Why would that happen?" },
    { argumentId: "against-2", verdict: "distinct", question: null },
  ],
  duplicateGroups: [["for-0", "for-1"]],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(refineReply), { status: 200 }))
  );
});

describe("ArgumentsStep", () => {
  it("keeps Refine disabled until all six arguments are filled", async () => {
    render(<ArgumentsStep motion="THW let kids vote." onDone={() => {}} />);
    const refine = screen.getByRole("button", { name: /refine/i });
    expect(refine).toBeDisabled();
  });

  it("shows the AI's sharpening question after refining six arguments", async () => {
    render(<ArgumentsStep motion="THW let kids vote." onDone={() => {}} />);
    const boxes = screen.getAllByRole("textbox");
    const values = ["a", "b", "c", "d", "e", "f"];
    for (let i = 0; i < 6; i++) await userEvent.type(boxes[i], values[i]);
    await userEvent.click(screen.getByRole("button", { name: /refine/i }));
    expect(await screen.findByText(/How does this differ from for-1/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/ArgumentsStep.test.tsx`
Expected: FAIL — cannot resolve `@/components/steps/ArgumentsStep`.

- [ ] **Step 3: Create `components/steps/ArgumentsStep.tsx`**

```tsx
"use client";
import { useState } from "react";
import type { CoachResponse, RefineVerdict } from "@/lib/schemas";

const EMPTY = ["", "", ""];

export function ArgumentsStep({
  motion,
  onDone,
}: {
  motion: string;
  onDone: (args: { argsFor: string[]; argsAgainst: string[] }) => void;
}) {
  const [argsFor, setFor] = useState<string[]>([...EMPTY]);
  const [argsAgainst, setAgainst] = useState<string[]>([...EMPTY]);
  const [verdicts, setVerdicts] = useState<RefineVerdict[]>([]);
  const [loading, setLoading] = useState(false);

  const allFilled = [...argsFor, ...argsAgainst].every((a) => a.trim().length > 0);

  function verdictFor(id: string) {
    return verdicts.find((v) => v.argumentId === id);
  }

  async function refine() {
    setLoading(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: "refine", motion, payload: { argsFor, argsAgainst } }),
      });
      const data: CoachResponse = await res.json();
      if (data.kind === "refine") setVerdicts(data.verdicts);
    } finally {
      setLoading(false);
    }
  }

  function column(side: "for" | "against", values: string[], set: (v: string[]) => void) {
    return (
      <div>
        <h3 className="accent">{side === "for" ? "FOR" : "AGAINST"}</h3>
        {values.map((val, i) => {
          const v = verdictFor(`${side}-${i}`);
          return (
            <div key={i} style={{ marginBottom: 10 }}>
              <textarea
                aria-label={`${side} argument ${i + 1}`}
                value={val}
                rows={2}
                onChange={(e) => {
                  const copy = [...values];
                  copy[i] = e.target.value;
                  set(copy);
                }}
                style={{ width: "100%" }}
              />
              {v && v.verdict !== "distinct" && v.question && (
                <p style={{ color: "var(--orange-light)", fontSize: 13 }}>💬 {v.question}</p>
              )}
              {v && v.verdict === "distinct" && (
                <p style={{ color: "#4fd08a", fontSize: 12 }}>✓ Distinct.</p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {column("for", argsFor, setFor)}
        {column("against", argsAgainst, setAgainst)}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button type="button" onClick={refine} disabled={!allFilled || loading}>
          {loading ? "Refining…" : "Refine all six"}
        </button>
        {verdicts.length > 0 && (
          <button type="button" onClick={() => onDone({ argsFor, argsAgainst })}>
            Done
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/ArgumentsStep.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Create `components/steps/RestateStep.tsx`**

```tsx
"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
import type { CoachResponse } from "@/lib/schemas";

export function RestateStep({
  motion,
  initial,
  onNext,
}: {
  motion: string;
  initial: string;
  onNext: (restate: string) => void;
}) {
  const [reaction, setReaction] = useState<string | null>(null);
  const [saved, setSaved] = useState(initial);

  async function submit(text: string) {
    setSaved(text);
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ step: "restate", motion, payload: { restate: text } }),
    });
    const data: CoachResponse = await res.json();
    if (data.kind === "restate") setReaction(data.reaction);
  }

  return (
    <div>
      <VoiceOrTextInput label="Say the motion in your own words — what's the core claim?" onSubmit={submit} />
      {reaction && <p style={{ color: "var(--orange-light)", marginTop: 10 }}>💬 {reaction}</p>}
      {reaction && (
        <button type="button" style={{ marginTop: 10 }} onClick={() => onNext(saved)}>
          Next: keywords →
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create `components/steps/KeywordStep.tsx`**

```tsx
"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
import type { Motion, CoachResponse } from "@/lib/schemas";

export function KeywordStep({
  motion,
  onNext,
}: {
  motion: Motion;
  onNext: () => void;
}) {
  const [active, setActive] = useState<Motion["keywords"][number] | null>(null);
  const [reaction, setReaction] = useState<string | null>(null);

  const keywordSet = new Set(motion.keywords.map((k) => k.word.toLowerCase()));

  async function submit(answer: string) {
    if (!active) return;
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        step: "keyword",
        motion: motion.motion,
        payload: { word: active.word, hint: active.hint, answer },
      }),
    });
    const data: CoachResponse = await res.json();
    if (data.kind === "keyword") setReaction(data.reaction);
  }

  return (
    <div>
      <p className="serif" style={{ fontSize: 22 }}>
        {motion.motion.split(/(\s+)/).map((tok, i) => {
          const clean = tok.trim().replace(/[.,]/g, "").toLowerCase();
          const kw = motion.keywords.find((k) => k.word.toLowerCase() === clean);
          if (kw && keywordSet.has(clean)) {
            return (
              <span
                key={i}
                onClick={() => { setActive(kw); setReaction(null); }}
                style={{ cursor: "pointer", color: "var(--gold)", borderBottom: "2px dashed var(--gold)" }}
              >
                {tok}
              </span>
            );
          }
          return <span key={i}>{tok}</span>;
        })}
      </p>
      {active && (
        <div style={{ marginTop: 12 }}>
          <VoiceOrTextInput label={`What's the scope of "${active.word}" here — and why?`} onSubmit={submit} />
          {reaction && <p style={{ color: "var(--orange-light)", marginTop: 10 }}>💬 {reaction}</p>}
        </div>
      )}
      <button type="button" style={{ marginTop: 14 }} onClick={onNext}>
        Next: arguments →
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Write the failing MotionCard test** — `tests/components/MotionCard.test.tsx`

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MotionCard } from "@/components/MotionCard";
import { getMotion } from "@/lib/motions";

beforeEach(() => localStorage.clear());

describe("MotionCard", () => {
  it("pins the motion text and starts on the restate step", () => {
    const motion = getMotion("m-kids-vote")!;
    render(<MotionCard motion={motion} onExit={() => {}} />);
    // Motion appears pinned in the header.
    expect(screen.getAllByText(/let kids vote/i).length).toBeGreaterThanOrEqual(1);
    // Restate step's prompt is visible first.
    expect(screen.getByText(/your own words/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npm test -- tests/components/MotionCard.test.tsx`
Expected: FAIL — cannot resolve `@/components/MotionCard`.

- [ ] **Step 9: Create `components/MotionCard.tsx`**

```tsx
"use client";
import { useMotionProgress } from "@/lib/state/useMotionProgress";
import { nextStep, STEPS, stepIndex } from "@/lib/state/cardMachine";
import { RestateStep } from "@/components/steps/RestateStep";
import { KeywordStep } from "@/components/steps/KeywordStep";
import { ArgumentsStep } from "@/components/steps/ArgumentsStep";
import type { Motion } from "@/lib/schemas";

export function MotionCard({ motion, onExit }: { motion: Motion; onExit: () => void }) {
  const [progress, update] = useMotionProgress(motion.id);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", background: "var(--navy)", border: "1px solid #22324c", borderRadius: 18, padding: 24 }}>
      <button type="button" onClick={onExit} style={{ marginBottom: 12 }}>← deck</button>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {STEPS.map((s, i) => (
          <div key={s} className="accent" style={{ flex: 1, textAlign: "center", color: i === stepIndex(progress.step) ? "var(--gold)" : "var(--dim)", borderBottom: `2px solid ${i === stepIndex(progress.step) ? "var(--gold)" : "#22324c"}`, paddingBottom: 6, fontSize: 12 }}>
            {i + 1}
          </div>
        ))}
      </div>
      <h2 className="serif" style={{ borderBottom: "1px solid #22324c", paddingBottom: 12 }}>{motion.motion}</h2>

      {progress.step === "restate" && (
        <RestateStep
          motion={motion.motion}
          initial={progress.restate}
          onNext={(restate) => update({ restate, step: nextStep("restate") })}
        />
      )}
      {progress.step === "keyword" && (
        <KeywordStep motion={motion} onNext={() => update({ step: nextStep("keyword") })} />
      )}
      {progress.step === "arguments" && (
        <ArgumentsStep
          motion={motion.motion}
          onDone={({ argsFor, argsAgainst }) => update({ argsFor, argsAgainst, completed: true })}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npm test -- tests/components/MotionCard.test.tsx`
Expected: PASS.

- [ ] **Step 11: Create `components/Deck.tsx`**

```tsx
"use client";
import { useState } from "react";
import { getMotions } from "@/lib/motions";
import { MotionCard } from "@/components/MotionCard";

export function Deck() {
  const motions = getMotions();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = motions.find((m) => m.id === activeId);

  if (active) return <MotionCard motion={active} onExit={() => setActiveId(null)} />;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 className="serif">Motion Reader</h1>
      <p style={{ color: "var(--dim)" }}>Pick a motion to work through.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 18 }}>
        {motions.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setActiveId(m.id)}
            style={{ width: 200, textAlign: "left", background: "var(--navy-mid)", color: "var(--text)", border: "1px solid #24344f", borderRadius: 12, padding: 16 }}
          >
            <span className="accent" style={{ color: "var(--gold)", fontSize: 12 }}>{m.id}</span>
            <div style={{ marginTop: 6 }}>{m.motion}</div>
          </button>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 12: Create `app/page.tsx`**

```tsx
import { Deck } from "@/components/Deck";

export default function Home() {
  return <Deck />;
}
```

- [ ] **Step 13: Create `app/gate/page.tsx`**

```tsx
import { Gate } from "@/components/Gate";

export default function GatePage() {
  return <Gate />;
}
```

- [ ] **Step 14: Run the full suite + build**

Run: `npm test && npm run build`
Expected: all tests PASS; `next build` completes without type errors.

- [ ] **Step 15: Commit**

```bash
git add components app/page.tsx app/gate/page.tsx tests/components/ArgumentsStep.test.tsx tests/components/MotionCard.test.tsx
git commit -m "feat: motion reader steps, evolving card, deck, pages"
```

---

## Manual verification (after Task 12)

Not automated — do these once before calling Layer 1 done:

1. `cp .env.example .env.local`, fill in real `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`, set `APP_PASSWORD=<something>`.
2. `npm run dev` → visit `/`; confirm you're redirected to `/gate`.
3. Enter the wrong password (rejected), then the right one (lands on the deck).
4. Open a motion → restate by typing → confirm a coach reaction appears → Next.
5. Click a gold keyword → answer → confirm a coach reaction → Next.
6. Fill all six arguments → confirm Refine is disabled until the sixth → click Refine → confirm duplicate/weak flags and questions render, distinct ones get ✓.
7. In a browser with mic permission, confirm the 🎤 button appears and a spoken clip fills the textarea.
8. Reload mid-motion → confirm progress restored from `localStorage`.

---

## Self-Review

**Spec coverage:**
- Next.js/Vercel/API-routes architecture → Tasks 1, 8, 9, 10. ✓
- Deepgram voice + text fallback → Tasks 9, 11. ✓
- Evolving single card, motion pinned, 3 steps → Tasks 4, 12. ✓
- Step 1 restate w/ AI reaction → Task 12 (RestateStep) + Tasks 6/7. ✓
- Step 2 clickable keywords → Task 12 (KeywordStep). ✓
- Step 3 generate six + refine-after-six + duplicate catch + never-rewrite → Tasks 6 (refine prompt), 12 (ArgumentsStep). ✓
- `motions.json` editable bank + schema + optional hints + theme tag → Task 3. ✓
- Versioned prompt templates in repo → Task 6. ✓
- `/api/coach` structured JSON, `/api/transcribe` → Tasks 8, 9. ✓
- Single shared password + localStorage persistence → Tasks 10, 5. ✓
- Error handling (voice→text fallback, AI failure, empty input, bad password) → Tasks 8/9 (500/400), 11 (fallback), 10 (401). ✓
- Testing with mocked Claude/Deepgram → Tasks 7, 8, 9. ✓
- Non-goals (no refutation/POI/weighing/dashboard/handout/DB/accounts) → nothing implements them. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases" — every code step shows complete code. ✓

**Type consistency:** `MotionProgress`, `Step`, `ChatClient`, `CoachRequest/CoachResponse`, `RefineVerdict`, argument ids (`for-0…against-2`), `AUTH_COOKIE`, `STORAGE_KEY` are defined once and referenced consistently across tasks. ✓
