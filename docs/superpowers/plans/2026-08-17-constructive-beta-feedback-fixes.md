# Beta Feedback Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the seven verified beta-user issues that do not depend on a claim-quality rubric, plus two related bugs found during verification.

**Architecture:** Nine independent tasks, each touching a disjoint set of files so they can be executed in parallel without merge conflicts. Every task is TDD: failing test first, minimal implementation, green, commit. No new files are created outside of tests; every change lands in an existing module.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, React 18, Tailwind + owned shadcn primitives, Vitest + React Testing Library, Zod.

**Spec:** `docs/superpowers/specs/2026-08-17-constructive-beta-feedback-fixes-design.md`

## Global Constraints

- Baseline to preserve: **190 tests / 57 files green**. Never finish a task with a red suite.
- `npx tsc --noEmit` must stay clean; `npm run build` must succeed.
- Run tests with `npx vitest run <path>` for a single file, `npm test` for the suite.
- Import via the `@/` path alias (e.g. `@/lib/practice`), matching every existing file.
- Test style: flat `describe`/`it` with `expect(...)`, `render`/`screen` from `@testing-library/react`, `userEvent` for interaction. No new test framework, no snapshot tests.
- The locked-side pill label is exactly `Part 2` — never `soon`, never `Step 2`.
- The feedback link label is exactly `User feedback` — never "support" or "customer support".
- `normalizeMotionText` must preserve the verb's existing case: `This House would`, not `This House Would`.
- Do **not** delete `lib/voice/playSpeech.ts`, `app/api/speak/route.ts`, or anything under `lib/ai/` or `app/api/transcribe/` — Branch 3 depends on them.
- Do **not** change `lib/linkGrade.ts`. Its algebra is correct and fully tested.
- Do **not** change `lib/practice.ts`. The reported key collision was a false positive (see spec §7a).
- Commit messages use the existing convention: `feat:` / `fix:` prefix, imperative mood.

---

## Task 1: Capitalize "House" in generated motions

**Files:**
- Modify: `lib/prompts/generateMotions.ts:9`
- Modify: `lib/generatedNormalize.ts` (add export; call inside `assembleFlowMotion`)
- Modify: `components/UniverseGenerator.tsx:51-57`
- Test: `tests/lib/generatedNormalize.test.ts`, `tests/lib/prompts.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `normalizeMotionText(motion: string): string`, exported from `@/lib/generatedNormalize`. No other task consumes it.

- [ ] **Step 1: Write the failing tests**

Append to `tests/lib/generatedNormalize.test.ts`. Add `normalizeMotionText` to the existing import from `@/lib/generatedNormalize` at the top of the file.

```ts
describe("normalizeMotionText", () => {
  it("capitalizes a lowercase 'this house'", () => {
    expect(normalizeMotionText("this house would ban homework.")).toBe(
      "This House would ban homework."
    );
  });

  it("preserves the verb's existing case", () => {
    expect(normalizeMotionText("This house believes the Hidden Villages harm.")).toBe(
      "This House believes the Hidden Villages harm."
    );
  });

  it("leaves already-correct text untouched", () => {
    expect(normalizeMotionText("This House would ban homework.")).toBe(
      "This House would ban homework."
    );
  });

  it("is idempotent", () => {
    const once = normalizeMotionText("THIS HOUSE would act.");
    expect(normalizeMotionText(once)).toBe(once);
  });

  it("does not touch unrelated words containing 'house'", () => {
    expect(normalizeMotionText("This House would fund household repairs.")).toBe(
      "This House would fund household repairs."
    );
  });
});
```

Append to `tests/lib/prompts.test.ts`, inside the existing `describe("prompt builders")`. Add `generateMotionsPrompt` to the imports at the top (the file currently imports only restate/keyword/refine builders).

```ts
it("tells the motion generator to capitalize House", () => {
  const p = generateMotionsPrompt("Naruto");
  expect(p.system).toContain("This House");
  expect(p.system).not.toContain("This house");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/generatedNormalize.test.ts tests/lib/prompts.test.ts`
Expected: FAIL — `normalizeMotionText is not a function`, and the prompt assertion fails because line 9 currently reads `"This house believes the Hidden Villages do more harm than good"`.

- [ ] **Step 3: Add the normalizer**

In `lib/generatedNormalize.ts`, add after `motionCardId`:

```ts
/**
 * Motions must read "This House ..." — the generator sometimes lowercases it.
 * Only the two words are rewritten; the following verb keeps its own case so
 * the seeded convention ("This House would") is preserved. Idempotent.
 */
export function normalizeMotionText(motion: string): string {
  return motion.replace(/\bthis\s+house\b/gi, "This House");
}
```

- [ ] **Step 4: Apply it in `assembleFlowMotion`**

In `lib/generatedNormalize.ts`, change the returned object (currently `motion,` on line 64):

```ts
  return {
    id: motionId,
    motion: normalizeMotionText(motion),
    keywords,
    sides: { for: { claims: build(sides.for.claims) }, against: { claims: build(sides.against.claims) } },
  };
```

- [ ] **Step 5: Apply it on the persist path**

In `components/UniverseGenerator.tsx`, add `normalizeMotionText` to the existing import from `@/lib/generatedNormalize` (line 14), then change the `motions` mapping so the stored card is already correct:

```ts
      const motions: StoredMotionCard[] = data.motions.map((m: { motion: string; keywords: unknown; hook: string }, i: number) => ({
        id: motionCardId(universe, i),
        motion: normalizeMotionText(m.motion),
        keywords: m.keywords as StoredMotionCard["keywords"],
        hook: m.hook,
        sides: null,
      }));
```

- [ ] **Step 6: Fix the prompt**

In `lib/prompts/generateMotions.ts`, replace line 9 and add a rule immediately after it:

```
- Each "motion" is a debatable statement grounded in the universe's characters, factions, or conflicts (e.g. "This House believes the Hidden Villages do more harm than good"). It must have real arguments on both sides.
- Every motion must begin "This House believes ..." or "This House would ..." with "House" capitalized.
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/generatedNormalize.test.ts tests/lib/prompts.test.ts tests/components/UniverseGenerator.test.tsx`
Expected: PASS. Note `tests/components/UniverseGenerator.test.tsx:23` uses the fixture `"This house believes..."` — it must still pass. If it asserts on the rendered card text it will now see `"This House believes..."`; update that assertion to the corrected casing, which is the point of the fix.

- [ ] **Step 8: Commit**

```bash
git add lib/prompts/generateMotions.ts lib/generatedNormalize.ts components/UniverseGenerator.tsx tests/lib/generatedNormalize.test.ts tests/lib/prompts.test.ts tests/components/UniverseGenerator.test.tsx
git commit -m "fix: always capitalize House in generated motions"
```

---

## Task 2: Internal feedback link in the app footer

**Files:**
- Modify: `components/ui/app-shell.tsx`
- Modify: `.env.example`
- Test: `tests/components/ui/app-shell.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks depend on. Reads `process.env.NEXT_PUBLIC_FEEDBACK_URL`.

**Important:** `NEXT_PUBLIC_*` variables are inlined by Next at build time, so `process.env.NEXT_PUBLIC_FEEDBACK_URL` must be referenced as a **full static expression** — never destructured, never accessed via a computed key, or the inlining breaks. In Vitest the value is read at render time from `process.env`, so `vi.stubEnv` works.

- [ ] **Step 1: Write the failing test**

Replace the contents of `tests/components/ui/app-shell.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "@/components/ui/app-shell";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AppShell", () => {
  it("renders the wordmark header and its children", () => {
    render(<AppShell><p>page body</p></AppShell>);
    expect(screen.getByText("Constructive")).toBeInTheDocument();
    expect(screen.getByText("page body")).toBeInTheDocument();
  });

  it("renders the feedback link when the url is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_URL", "https://example.com/feedback");
    render(<AppShell><p>page body</p></AppShell>);
    const link = screen.getByRole("link", { name: /user feedback/i });
    expect(link).toHaveAttribute("href", "https://example.com/feedback");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders no feedback link when the url is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_URL", "");
    render(<AppShell><p>page body</p></AppShell>);
    expect(screen.queryByRole("link", { name: /user feedback/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/ui/app-shell.test.tsx`
Expected: FAIL — no link with an accessible name matching `/user feedback/i` exists.

- [ ] **Step 3: Add the footer**

Replace `components/ui/app-shell.tsx` entirely:

```tsx
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  // Inlined at build time — must stay a full static expression.
  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL;

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3 sm:px-6">
          <span className="font-display text-xl font-semibold text-foreground">Constructive</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      {feedbackUrl && (
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-6 text-xs text-muted-foreground sm:px-6">
            <span>Something off, or an idea to share?</span>
            <a
              href={feedbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-primary"
            >
              User feedback →
            </a>
          </div>
        </footer>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/ui/app-shell.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Document the variable**

Append to `.env.example`, under the optional overrides section:

```
# Internal beta feedback link. When unset, no feedback link renders anywhere.
# Client-exposed by design (NEXT_PUBLIC_) — it is only a form URL.
NEXT_PUBLIC_FEEDBACK_URL=
```

- [ ] **Step 6: Commit**

```bash
git add components/ui/app-shell.tsx .env.example tests/components/ui/app-shell.test.tsx
git commit -m "feat: internal user-feedback link in the app footer"
```

---

## Task 3: Show the claim in ImpactStage

**Files:**
- Modify: `components/stages/ImpactStage.tsx`
- Test: `tests/components/ImpactStage.test.tsx`

**Interfaces:**
- Consumes: nothing. `ImpactStage`'s props are unchanged — `motion`, `claim`, `authoredImpact`, `onComplete` — only the render body changes.
- Produces: nothing other tasks depend on.

**Context:** `ImpactStage` already receives `claim` and sends it to `/api/coach` (line 32) but never renders it, while its prompt asks "Why does this claim matter". Fixing it here fixes both the journey and the Impacts drill.

- [ ] **Step 1: Write the failing test**

Add to `tests/components/ImpactStage.test.tsx`, inside the existing `describe`:

```tsx
it("shows the claim it is asking for an impact on", () => {
  render(
    <ImpactStage
      motion="This House would ban homework."
      claim="Homework crowds out family time."
      authoredImpact="Families eat dinner together."
      onComplete={() => {}}
    />
  );
  expect(screen.getByText("Homework crowds out family time.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/ImpactStage.test.tsx`
Expected: FAIL — "Unable to find an element with the text: Homework crowds out family time."

- [ ] **Step 3: Render the claim**

In `components/stages/ImpactStage.tsx`, insert a context block between the `StageHeader` and the `VoiceOrTextInput` (currently lines 44-45). It mirrors the "We'll carry this forward as" card in `ClaimStage.tsx:60-64`:

```tsx
      <StageHeader eyebrow="Stage 4 · Impact" prompt="So what? Why does this claim matter — what's the bigger consequence?" />
      <div className="mb-4 rounded-lg border border-evidence bg-evidence/10 p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your claim
        </div>
        <p className="mt-0.5 font-medium text-foreground">{claim}</p>
      </div>
      <VoiceOrTextInput label="Say or type the impact" onSubmit={submit} />
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/ImpactStage.test.tsx tests/components/PracticeShell.test.tsx tests/components/FlowShell.test.tsx`
Expected: PASS. All three exercise `ImpactStage`.

- [ ] **Step 5: Commit**

```bash
git add components/stages/ImpactStage.tsx tests/components/ImpactStage.test.tsx
git commit -m "fix: show the claim on the Impact stage"
```

---

## Task 4: Show the drawn motion in the practice header

**Files:**
- Modify: `components/PracticeShell.tsx`
- Test: `tests/components/PracticeShell.test.tsx`

**Interfaces:**
- Consumes: `PracticeItem` from `@/lib/practice` — a discriminated union on `part`. The `claim` and `impact` variants carry `motion: string`; the `link` variant does **not** (it carries only `scenario`). Narrow before reading `motion`.
- Produces: nothing other tasks depend on.

**Context:** `PracticeShell` renders only `TITLES[part]`, so the Claims drill never states which motion is being argued. The Link drill already shows claim and impact through `Bridge`, so it needs nothing.

- [ ] **Step 1: Write the failing test**

Add to `tests/components/PracticeShell.test.tsx`:

```tsx
it("shows the drawn motion in the header for a claim drill", () => {
  render(<PracticeShell part="claim" onExit={() => {}} />);
  // Every seeded motion begins with "This House" — the header must name one.
  expect(screen.getByText(/^This House/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/PracticeShell.test.tsx`
Expected: FAIL — the header renders only "Practice: Claims".

- [ ] **Step 3: Render the motion**

In `components/PracticeShell.tsx`, add a derived value just after the `nextRep` function:

```tsx
  const drilledMotion = item.part === "link" ? null : item.motion;
```

Then, inside the header `<div>`, immediately after the `TITLES[part]` element:

```tsx
            <div className="font-display text-lg font-semibold leading-snug text-foreground sm:text-xl">
              {TITLES[part]}
            </div>
            {drilledMotion && (
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{drilledMotion}</p>
            )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/PracticeShell.test.tsx tests/components/PracticeDeck.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/PracticeShell.tsx tests/components/PracticeShell.test.tsx
git commit -m "fix: name the drawn motion in the practice drill header"
```

---

## Task 5: Hold-to-talk becomes transcription only

**Files:**
- Modify: `components/VoiceOrTextInput.tsx` (remove the `autoSubmit` prop entirely)
- Modify: `components/steps/RestateStep.tsx` (remove `speakCoach` call + import)
- Modify: `components/steps/KeywordStep.tsx` (remove `speakCoach` call + import)
- Modify: `components/LinkCard.tsx` (remove `speakCoach` call + import)
- Test: `tests/components/VoiceOrTextInput.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `VoiceOrTextInput` props narrow to `{ label: string; onSubmit: (text: string) => void }`. No call site passes `autoSubmit` today, so no call site changes.

**Do not** delete `lib/voice/playSpeech.ts` or `app/api/speak/route.ts` — Branch 3 needs them. This task only removes the *callers*.

**Note on Task 9 overlap:** Task 9 also edits `components/LinkCard.tsx`. Run Task 5 and Task 9 sequentially, not in parallel, or resolve the trivial conflict in the import block.

- [ ] **Step 1: Write the failing test**

`tests/components/VoiceOrTextInput.test.tsx` currently forces the text-only fallback in `beforeEach`, so the mic path has zero coverage. Add a new `describe` block that stubs enough of the media API to exercise a hold-and-release. Append to the file:

```tsx
describe("VoiceOrTextInput hold-to-talk", () => {
  function stubMedia() {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    // @ts-expect-error partial stub is enough for this component
    global.navigator.mediaDevices = { getUserMedia: vi.fn(async () => stream) };

    class FakeRecorder {
      state = "recording";
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {}
      stop() {
        this.state = "inactive";
        this.onstop?.();
      }
    }
    // @ts-expect-error partial stub
    global.MediaRecorder = FakeRecorder;
    // @ts-expect-error static helper used by pickRecorderMimeType
    global.MediaRecorder.isTypeSupported = () => true;
  }

  beforeEach(() => {
    stubMedia();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("action=stop")
          ? new Response(JSON.stringify({ text: "kids should vote" }), { status: 200 })
          : new Response(JSON.stringify({ sessionId: "s1", text: "" }), { status: 200 })
      )
    );
  });

  it("fills the box on release without submitting", async () => {
    const onSubmit = vi.fn();
    render(<VoiceOrTextInput label="Say your claim" onSubmit={onSubmit} />);
    const mic = screen.getByRole("button", { name: /talk/i });

    fireEvent.pointerDown(mic, { pointerId: 1 });
    fireEvent.pointerUp(mic, { pointerId: 1 });

    await waitFor(() =>
      expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("kids should vote")
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

Extend the file's imports to `import { describe, it, expect, vi, beforeEach } from "vitest";` and `import { render, screen, fireEvent, waitFor } from "@testing-library/react";`.

`setPointerCapture` does not exist in jsdom. Add this to the new `beforeEach` so the `onPointerDown` handler does not throw:

```tsx
    // jsdom has no pointer capture
    // @ts-expect-error test shim
    Element.prototype.setPointerCapture = vi.fn();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/VoiceOrTextInput.test.tsx`
Expected: FAIL on `expect(onSubmit).not.toHaveBeenCalled()` — `autoSubmit` defaults to `true`, so release fires `onSubmit`.

- [ ] **Step 3: Remove the `autoSubmit` prop**

In `components/VoiceOrTextInput.tsx`, change the signature (lines 12-21) to:

```tsx
export function VoiceOrTextInput({
  label,
  onSubmit,
}: {
  label: string;
  onSubmit: (text: string) => void;
}) {
```

Then change the release branch (lines 220-225) so it only fills the box:

```tsx
    if (finalText) {
      setText(finalText);
      setStatus("idle");
      return;
    }
```

- [ ] **Step 4: Remove the three speakCoach callers**

In `components/steps/RestateStep.tsx`: delete the import on line 5 and change lines 37-40 to:

```tsx
      if (data.kind === "restate") {
        setReaction(data.reaction);
      }
```

In `components/steps/KeywordStep.tsx`: delete the import on line 5 and change lines 40-43 to:

```tsx
      if (data.kind === "keyword") {
        setReaction(data.reaction);
      }
```

In `components/LinkCard.tsx`: delete the import on line 5 and change lines 51-54 to:

```tsx
      if (data.kind === "link") {
        setReactions((r) => ({ ...r, [c.id]: data.reaction }));
      }
```

- [ ] **Step 5: Verify no caller remains**

Run: `grep -rn "speakCoach" components app lib --include=*.tsx --include=*.ts`
Expected: exactly one hit — the definition in `lib/voice/playSpeech.ts`. No callers.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/components/VoiceOrTextInput.test.tsx tests/components/RestateStep.test.tsx tests/components/KeywordStep.test.tsx tests/components/LinkCard.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/VoiceOrTextInput.tsx components/steps/RestateStep.tsx components/steps/KeywordStep.tsx components/LinkCard.tsx tests/components/VoiceOrTextInput.test.tsx
git commit -m "fix: hold-to-talk transcribes only, never auto-submits or speaks"
```

---

## Task 6: Side-agnostic progress model

**Files:**
- Modify: `lib/state/flowProgress.ts`
- Modify: `lib/state/useFlowProgress.ts`
- Modify: `lib/state/flowMachine.ts`
- Test: `tests/lib/state/flowProgress.test.ts`, `tests/lib/state/flowStatus.test.ts`, `tests/lib/state/flowMachine.test.ts`

**Interfaces:**
- Consumes: `Side` from `@/lib/state/flowMachine`.
- Produces — Tasks 7 and 8 depend on these **exact** signatures:
  - `emptyFlowProgress(startSide?: Side): FlowProgress` — defaults to `"for"`.
  - `loadFlowProgress(storage: Storage, motionId: string, startSide?: Side): FlowProgress`
  - `useFlowProgress(motionId: string, startSide?: Side): [FlowProgress, (patch: Partial<FlowProgress>) => void]`
  - `hasFlowProgress(storage: Storage, motionId: string): boolean`
  - `clearFlowProgressForPrefix(storage: Storage, prefix: string): void`
  - `type MotionStatus = "not-started" | "in-progress" | "one-side-done" | "complete"`
  - `otherSideUnlocked(p: { forComplete: boolean; againstComplete: boolean }): boolean`

**This task must complete before Tasks 7 and 8 start.**

- [ ] **Step 1: Write the failing tests**

In `tests/lib/state/flowProgress.test.ts`, add:

```ts
it("starts on the requested side", () => {
  expect(emptyFlowProgress("against").side).toBe("against");
  expect(emptyFlowProgress().side).toBe("for");
});

it("reports whether a motion has saved progress", () => {
  const s = new MockStorage();
  expect(hasFlowProgress(s, "m1")).toBe(false);
  saveFlowProgress(s, "m1", emptyFlowProgress("against"));
  expect(hasFlowProgress(s, "m1")).toBe(true);
});

it("loads a fresh entry on the requested side", () => {
  const s = new MockStorage();
  expect(loadFlowProgress(s, "m1", "against").side).toBe("against");
});

it("clears only the entries matching a prefix", () => {
  const s = new MockStorage();
  saveFlowProgress(s, "gen:naruto:0", emptyFlowProgress());
  saveFlowProgress(s, "gen:naruto:1", emptyFlowProgress());
  saveFlowProgress(s, "gen:potter:0", emptyFlowProgress());
  saveFlowProgress(s, "m1", emptyFlowProgress());
  clearFlowProgressForPrefix(s, "gen:naruto:");
  const all = loadAllFlowProgress(s);
  expect(Object.keys(all).sort()).toEqual(["gen:potter:0", "m1"]);
});
```

Use whatever storage double the file already uses; if it uses the real `localStorage`, follow that instead of `MockStorage` and clear it in `beforeEach`.

In `tests/lib/state/flowStatus.test.ts`, replace the `"for-done"` expectations:

```ts
it("reports one-side-done regardless of which side was finished", () => {
  expect(motionStatus({ ...emptyFlowProgress(), forComplete: true })).toBe("one-side-done");
  expect(motionStatus({ ...emptyFlowProgress("against"), againstComplete: true })).toBe(
    "one-side-done"
  );
});
```

In `tests/lib/state/flowMachine.test.ts`, replace the `againstUnlocked` tests:

```ts
it("unlocks the other side once either side is complete", () => {
  expect(otherSideUnlocked({ forComplete: false, againstComplete: false })).toBe(false);
  expect(otherSideUnlocked({ forComplete: true, againstComplete: false })).toBe(true);
  expect(otherSideUnlocked({ forComplete: false, againstComplete: true })).toBe(true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/state/`
Expected: FAIL — `hasFlowProgress`, `clearFlowProgressForPrefix`, `otherSideUnlocked` undefined; `motionStatus` still returns `"for-done"`.

- [ ] **Step 3: Update `lib/state/flowProgress.ts`**

Change `emptyFlowProgress`, `loadFlowProgress`, `motionStatus`, and add the two new helpers:

```ts
export function emptyFlowProgress(startSide: Side = "for"): FlowProgress {
  return {
    side: startSide,
    stage: "read",
    readSubstep: "restate",
    restate: "",
    keywordAnswers: {},
    mappedClaimId: null,
    impact: "",
    forComplete: false,
    againstComplete: false,
  };
}

export function loadFlowProgress(
  storage: Storage,
  motionId: string,
  startSide: Side = "for"
): FlowProgress {
  return readAll(storage)[motionId] ?? emptyFlowProgress(startSide);
}

export function hasFlowProgress(storage: Storage, motionId: string): boolean {
  return readAll(storage)[motionId] !== undefined;
}

/** Drops every entry whose motion id starts with `prefix` (used when a generated universe is rebuilt, since its ids are reused). */
export function clearFlowProgressForPrefix(storage: Storage, prefix: string): void {
  const all = readAll(storage);
  let changed = false;
  for (const key of Object.keys(all)) {
    if (key.startsWith(prefix)) {
      delete all[key];
      changed = true;
    }
  }
  if (changed) storage.setItem(FLOW_STORAGE_KEY, JSON.stringify(all));
}
```

Change the status type and function:

```ts
export type MotionStatus = "not-started" | "in-progress" | "one-side-done" | "complete";

export function motionStatus(entry: FlowProgress | undefined): MotionStatus {
  if (!entry) return "not-started";
  if (entry.forComplete && entry.againstComplete) return "complete";
  if (entry.forComplete || entry.againstComplete) return "one-side-done";
  return "in-progress";
}
```

- [ ] **Step 4: Update `lib/state/useFlowProgress.ts`**

```ts
export function useFlowProgress(
  motionId: string,
  startSide: Side = "for"
): [FlowProgress, (patch: Partial<FlowProgress>) => void] {
  const [progress, setProgress] = useState<FlowProgress>(() => emptyFlowProgress(startSide));

  useEffect(() => {
    setProgress(loadFlowProgress(window.localStorage, motionId, startSide));
  }, [motionId, startSide]);
```

Add `import type { Side } from "@/lib/state/flowMachine";` and leave `update` unchanged.

- [ ] **Step 5: Update `lib/state/flowMachine.ts`**

Replace `againstUnlocked` (lines 21-23):

```ts
export function otherSideUnlocked(p: { forComplete: boolean; againstComplete: boolean }): boolean {
  return p.forComplete || p.againstComplete;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/state/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/state/flowProgress.ts lib/state/useFlowProgress.ts lib/state/flowMachine.ts tests/lib/state/
git commit -m "feat: side-agnostic flow progress with start-side and prefix clearing"
```

---

## Task 7: Generalize FlowShell for either starting side

**Files:**
- Modify: `components/FlowShell.tsx`
- Test: `tests/components/FlowShell.test.tsx`

**Interfaces:**
- Consumes (from Task 6): `useFlowProgress(motionId, startSide)`, `type Side`.
- Produces (for Task 8): `FlowShell` props become `{ motion: FlowMotion; startSide?: Side; onExit: () => void }`. `startSide` defaults to `"for"`.

**Depends on Task 6.**

- [ ] **Step 1: Write the failing tests**

Add to `tests/components/FlowShell.test.tsx`:

```tsx
it("labels the locked side Part 2, not soon", () => {
  render(<FlowShell motion={motion} onExit={() => {}} />);
  expect(screen.getByText(/Part 2/)).toBeInTheDocument();
  expect(screen.queryByText(/soon/i)).toBeNull();
});

it("starts on AGAINST when asked and locks FOR as Part 2", () => {
  render(<FlowShell motion={motion} startSide="against" onExit={() => {}} />);
  expect(screen.getByText(/🔒 FOR · Part 2/)).toBeInTheDocument();
});

it("offers the other side after finishing AGAINST first", async () => {
  seedProgress(motion.id, {
    side: "against",
    stage: "impact",
    againstComplete: true,
    forComplete: false,
  });
  render(<FlowShell motion={motion} startSide="against" onExit={() => {}} />);
  expect(await screen.findByText(/AGAINST side complete/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /other side/i }));
  expect(await screen.findByText(/strongest claim for/i)).toBeInTheDocument();
});

it("recovers to the claim stage when the mapped claim is missing", async () => {
  seedProgress(motion.id, { side: "for", stage: "link", mappedClaimId: "gone" });
  render(<FlowShell motion={motion} onExit={() => {}} />);
  expect(await screen.findByText(/strongest claim/i)).toBeInTheDocument();
});
```

Reuse the file's existing helper for seeding `constructive:flow:v1`; if it seeds inline, follow that pattern and spread `emptyFlowProgress()` under the overrides so every required field is present.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/FlowShell.test.tsx`
Expected: FAIL — the pill still reads `soon`, `startSide` is not a prop, and a stale `mappedClaimId` renders nothing.

- [ ] **Step 3: Generalize the component**

In `components/FlowShell.tsx`, change the signature and derive side-agnostic values:

```tsx
export function FlowShell({
  motion,
  startSide = "for",
  onExit,
}: {
  motion: FlowMotion;
  startSide?: Side;
  onExit: () => void;
}) {
  const [progress, update] = useFlowProgress(motion.id, startSide);
  const sideClaims = motion.sides[progress.side].claims;
  const mappedClaim = sideClaims.find((c) => c.id === progress.mappedClaimId) ?? null;

  const otherSide: Side = progress.side === "for" ? "against" : "for";
  const isComplete = (s: Side) => (s === "for" ? progress.forComplete : progress.againstComplete);
  const label = (s: Side) => (s === "for" ? "FOR" : "AGAINST");

  function pill(s: Side) {
    if (isComplete(s)) return <Badge key={s} variant="success">✓ {label(s)}</Badge>;
    if (progress.side === s) return <Badge key={s} variant="default">{label(s)}</Badge>;
    if (otherSideUnlocked(progress)) return <Badge key={s} variant="secondary">{label(s)}</Badge>;
    return <Badge key={s} variant="outline">🔒 {label(s)} · Part 2</Badge>;
  }

  const bothComplete = progress.forComplete && progress.againstComplete;
  const currentSideDone = isComplete(progress.side) && !bothComplete;
```

Add `import { otherSideUnlocked, type Side } from "@/lib/state/flowMachine";`.

Replace the two pill expressions in the header with `{pill("for")}{pill("against")}`.

Replace the `forDone` panel body (lines 71-85) with the side-agnostic version:

```tsx
            ) : currentSideDone ? (
              <div className="mx-auto max-w-md py-8 text-center">
                <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {label(progress.side)} side complete
                </div>
                <p className="mt-2 text-lg text-foreground">
                  Nice — you built the {label(progress.side)} case: claim, link, and impact. Now flip
                  it and argue the other side.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button
                    onClick={() =>
                      update({ side: otherSide, stage: "claim", mappedClaimId: null, impact: "" })
                    }
                  >
                    Now argue the other side →
                  </Button>
                  <Button variant="ghost" onClick={onExit}>
                    ← back to motions
                  </Button>
                </div>
              </div>
            ) : (
```

- [ ] **Step 4: Add the stale-claim recovery**

A stale `mappedClaimId` (from a rebuilt generated universe reusing ids) currently renders an empty panel, because both the link and impact branches require `mappedClaim`. Add a guard immediately before the `progress.stage === "link"` branch:

```tsx
                {(progress.stage === "link" || progress.stage === "impact") && !mappedClaim && (
                  <ClaimStage
                    motion={motion.motion}
                    side={progress.side}
                    claims={sideClaims.map((c) => ({ id: c.id, claim: c.claim }))}
                    onComplete={(mappedClaimId) => update({ mappedClaimId, stage: "link" })}
                  />
                )}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/components/FlowShell.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/FlowShell.tsx tests/components/FlowShell.test.tsx
git commit -m "feat: FlowShell works from either starting side; Part 2 label; stale-claim recovery"
```

---

## Task 8: Starting-side choice on the deck

**Files:**
- Modify: `components/FlowDeck.tsx`
- Modify: `components/UniverseGenerator.tsx` (call `clearFlowProgressForPrefix` on regenerate/remove)
- Test: `tests/components/FlowDeck.test.tsx`, `tests/components/UniverseGenerator.test.tsx`

**Interfaces:**
- Consumes (Task 6): `hasFlowProgress`, `clearFlowProgressForPrefix`, `MotionStatus` with `"one-side-done"`, `slug` from `@/lib/generatedNormalize`.
- Consumes (Task 7): `FlowShell` accepts `startSide`.
- Produces: `UniverseGenerator`'s `onOpen` prop becomes `(motion: FlowMotion, startSide: Side) => void`.

**Depends on Tasks 6 and 7.** Also touches `components/UniverseGenerator.tsx`, which Task 1 edits — run after Task 1 or resolve the import-line conflict.

- [ ] **Step 1: Write the failing tests**

Add to `tests/components/FlowDeck.test.tsx`:

```tsx
it("asks which side to argue first, then opens that side", async () => {
  render(<FlowDeck />);
  await userEvent.click(screen.getAllByRole("button", { name: /This House/ })[0]);
  expect(await screen.findByText(/which side/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /argue against first/i }));
  expect(await screen.findByText(/🔒 FOR · Part 2/)).toBeInTheDocument();
});

it("resumes a motion with saved progress without asking for a side", async () => {
  const motions = getFlowMotions();
  localStorage.setItem(
    "constructive:flow:v1",
    JSON.stringify({ [motions[0].id]: { ...emptyFlowProgress("against"), stage: "claim" } })
  );
  render(<FlowDeck />);
  await userEvent.click(screen.getAllByRole("button", { name: new RegExp(motions[0].motion.slice(0, 20)) })[0]);
  expect(screen.queryByText(/which side/i)).toBeNull();
});
```

Add to `tests/components/UniverseGenerator.test.tsx`:

```tsx
it("clears stale flow progress for a universe when it is removed", async () => {
  // seeded by the file's existing store fixture; ids are gen:<slug>:<index>
  localStorage.setItem(
    "constructive:flow:v1",
    JSON.stringify({ "gen:naruto:0": emptyFlowProgress(), keep: emptyFlowProgress() })
  );
  render(<UniverseGenerator onOpen={() => {}} />);
  await userEvent.click(await screen.findByRole("button", { name: /remove/i }));
  const all = JSON.parse(localStorage.getItem("constructive:flow:v1") ?? "{}");
  expect(all["gen:naruto:0"]).toBeUndefined();
  expect(all.keep).toBeDefined();
});
```

Match the universe slug to whatever the file's existing fixture uses.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/FlowDeck.test.tsx tests/components/UniverseGenerator.test.tsx`
Expected: FAIL — clicking a card opens the journey immediately, and removing a universe leaves flow progress behind.

- [ ] **Step 3: Add the side-choice state to FlowDeck**

In `components/FlowDeck.tsx`, replace the `active` state and the early returns:

```tsx
type Opened = { motion: FlowMotion; side: Side };

export function FlowDeck() {
  const motions = getFlowMotions();
  const [active, setActive] = useState<Opened | null>(null);
  const [choosing, setChoosing] = useState<FlowMotion | null>(null);
  const [practicePart, setPracticePart] = useState<PracticePart | null>(null);
  const [progress, setProgress] = useState<Record<string, FlowProgress>>({});

  useEffect(() => {
    setProgress(loadAllFlowProgress(window.localStorage));
  }, []);

  /** Resume in place if the motion is already started; otherwise ask which side first. */
  function open(m: FlowMotion) {
    if (hasFlowProgress(window.localStorage, m.id)) {
      setActive({ motion: m, side: "for" }); // ignored — saved progress wins
      return;
    }
    setChoosing(m);
  }

  if (active) {
    return (
      <FlowShell motion={active.motion} startSide={active.side} onExit={() => setActive(null)} />
    );
  }
  if (practicePart) return <PracticeShell part={practicePart} onExit={() => setPracticePart(null)} />;
```

Update `STATUS_META` for the renamed status:

```tsx
  "one-side-done": { label: "One side done", badge: "1 side done", variant: "default", cta: "Resume" },
```

Change the card handler to `onClick={() => open(m)}` and the generator to
`<UniverseGenerator onOpen={(m, side) => setActive({ motion: m, side })} />`.

- [ ] **Step 4: Render the side-choice panel**

Immediately after the `practicePart` early return, add:

```tsx
  if (choosing) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg py-10 text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">
            Pick your starting side
          </div>
          <h2 className="mt-2 font-display text-2xl font-semibold leading-snug text-foreground">
            {choosing.motion}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Which side do you want to argue first? You&apos;ll argue the other side as Part 2.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => { setActive({ motion: choosing, side: "for" }); setChoosing(null); }}>
              Argue FOR first
            </Button>
            <Button onClick={() => { setActive({ motion: choosing, side: "against" }); setChoosing(null); }}>
              Argue AGAINST first
            </Button>
          </div>
          <Button variant="ghost" className="mt-4 text-muted-foreground" onClick={() => setChoosing(null)}>
            ← back to motions
          </Button>
        </div>
      </AppShell>
    );
  }
```

Add the imports this needs: `Button` from `@/components/ui/button`, `hasFlowProgress` from `@/lib/state/flowProgress`, and `type Side` from `@/lib/state/flowMachine`.

- [ ] **Step 5: Purge stale progress in UniverseGenerator**

In `components/UniverseGenerator.tsx`, import `clearFlowProgressForPrefix` from `@/lib/state/flowProgress` and `slug` from `@/lib/generatedNormalize`, then:

In `generate()`, immediately before `persist({ ...store, [key]: ... })` — regenerating reuses `gen:<slug>:<index>` ids, so old progress would attach to new motions:

```ts
      clearFlowProgressForPrefix(window.localStorage, `gen:${slug(universe)}:`);
```

In `removeUniverse(key)`:

```ts
  function removeUniverse(key: string) {
    const universe = store[key]?.universe;
    if (universe) clearFlowProgressForPrefix(window.localStorage, `gen:${slug(universe)}:`);
    const next = { ...store };
    delete next[key];
    persist(next);
  }
```

Change the `onOpen` prop type to `(motion: FlowMotion, startSide: Side) => void` and pass a side at both call sites (lines 70 and 94): `onOpen(assembleFlowMotion(...), "for")`. The generated cards keep the FOR-first default; the chooser is for the seeded deck.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/components/FlowDeck.test.tsx tests/components/UniverseGenerator.test.tsx tests/components/FlowShell.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/FlowDeck.tsx components/UniverseGenerator.tsx tests/components/FlowDeck.test.tsx tests/components/UniverseGenerator.test.tsx
git commit -m "feat: choose which side to argue first; purge stale generated-universe progress"
```

---

## Task 9: Vary the bridge feedback

**Files:**
- Modify: `components/LinkCard.tsx`
- Modify: `components/stages/Bridge.tsx`
- Test: `tests/components/LinkCard.test.tsx`, `tests/components/Bridge.test.tsx`

**Interfaces:**
- Consumes: `gradeBridge`, `BridgeGrade` from `@/lib/linkGrade` (unchanged).
- Produces: `Bridge` gains an optional `shuffleSeed?: number` prop used to order the materials tray deterministically in tests.

**Do not change `lib/linkGrade.ts`.** All 24 authored claims share one candidate shape in identical order, so the correct answer is always "the first two planks" — shuffling is what fixes that, not new grading.

**Task 5 also edits `components/LinkCard.tsx`.** Run Task 5 first.

- [ ] **Step 1: Write the failing tests**

Replace the two literal-copy assertions in `tests/components/LinkCard.test.tsx` (lines 46-52) with a behavioral one, and add an attempt-variation test:

```tsx
  it("names the missing material when only evidence is built", async () => {
    render(<LinkCard scenario={scenario} onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /build .*stress/i }));
    await userEvent.click(screen.getByRole("button", { name: /test the bridge/i }));
    expect(screen.queryByText(/bridge holds/i)).toBeNull();
    expect(await screen.findByText(/reasoning/i)).toBeInTheDocument();
  });

  it("changes its wording on a repeated failed attempt", async () => {
    render(<LinkCard scenario={scenario} onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /build .*stress/i }));
    await userEvent.click(screen.getByRole("button", { name: /test the bridge/i }));
    const first = screen.getByTestId("bridge-summary").textContent;
    await userEvent.click(screen.getByRole("button", { name: /test the bridge/i }));
    expect(screen.getByTestId("bridge-summary").textContent).not.toBe(first);
  });
```

Add to `tests/components/Bridge.test.tsx`:

```tsx
it("orders the materials tray by the shuffle seed", () => {
  const { container: a } = render(<Bridge {...baseProps} shuffleSeed={1} />);
  const { container: b } = render(<Bridge {...baseProps} shuffleSeed={7} />);
  const text = (c: HTMLElement) =>
    Array.from(c.querySelectorAll("[data-plank-id]")).map((n) => n.getAttribute("data-plank-id")).join(",");
  expect(text(a)).not.toBe(text(b));
});
```

Use the file's existing props fixture for `baseProps`; it needs at least three candidates for an order change to be observable.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/LinkCard.test.tsx tests/components/Bridge.test.tsx`
Expected: FAIL — no `bridge-summary` test id, no `data-plank-id`, no `shuffleSeed` prop, and the summary is identical on every attempt.

- [ ] **Step 3: Make the summary specific and attempt-aware**

In `components/LinkCard.tsx`, add an attempt counter and a summary builder. Add `attempts` state next to the existing `grade` state:

```tsx
  const [attempts, setAttempts] = useState(0);
```

Change `test()` to count attempts and reset on a hold:

```tsx
  function test() {
    const g = gradeBridge(scenario, placed);
    setGrade(g);
    setAttempts((n) => (g.held ? 0 : n + 1));
    update({ held: g.held });
  }
```

Add the builder above the return. It names the actual problem instead of collapsing everything into two sentences, and varies across repeated failures:

```tsx
  function summary(g: BridgeGrade): string {
    if (g.held) return "✓ The bridge holds!";

    const wrong = g.perPlank.filter((p) => p.status === "wrong");
    const missing = g.perPlank.filter((p) => p.status === "missing");
    const textFor = (id: string) => scenario.candidates.find((c) => c.id === id)?.text ?? "";
    const shorten = (s: string) => (s.length > 48 ? `${s.slice(0, 48).trimEnd()}…` : s);

    const problems: string[] = [];
    if (!g.hasEvidence) problems.push("it has no evidence holding it up");
    if (!g.hasReasoning) problems.push("nothing explains why the evidence matters — that's the reasoning");
    for (const p of wrong) problems.push(`"${shorten(textFor(p.id))}" doesn't carry the weight`);
    for (const p of missing) problems.push(`you left out "${shorten(textFor(p.id))}"`);

    const openers =
      attempts >= 2
        ? ["Still not holding —", "Close. The gap is that", "Nearly — but"]
        : ["Not yet —", "That span won't hold —", "Almost —"];
    const opener = openers[attempts % openers.length];
    return `${opener} ${problems[attempts % Math.max(problems.length, 1)] ?? "check the flagged planks"}.`;
  }
```

Replace the summary JSX (lines 85-95) with:

```tsx
        {grade && (
          <span
            data-testid="bridge-summary"
            className={grade.held ? "font-semibold text-success" : "text-reasoning"}
          >
            {summary(grade)}
          </span>
        )}
```

- [ ] **Step 4: Shuffle the materials tray**

In `components/stages/Bridge.tsx`, add `shuffleSeed` to the props type as `shuffleSeed?: number`, then order the unplaced list deterministically from it. Replace the `unplaced` derivation (line 33):

```tsx
  const unplaced = orderBySeed(
    candidates.filter((c) => !placedSet.has(c.id)),
    shuffleSeed
  );
```

Add above the component:

```tsx
/**
 * Every authored claim in the bank lists its candidates in the same order
 * (fitting reasoning, fitting evidence, then distractors), so an unshuffled
 * tray makes "build the first two" the universal answer. A seeded rotation
 * keeps it deterministic for tests.
 */
function orderBySeed<T>(items: T[], seed?: number): T[] {
  if (seed === undefined || items.length < 2) return items;
  const offset = Math.abs(Math.floor(seed)) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}
```

Add `data-plank-id={c.id}` to the wrapper `<div>` in `plankRow` (line 71) so ordering is assertable.

- [ ] **Step 5: Feed a per-rep seed from LinkCard**

In `components/LinkCard.tsx`, derive a stable seed from the scenario id so each drill rep gets a different tray order but a given scenario is stable across re-renders:

```tsx
  const shuffleSeed = scenario.id.split("").reduce((n, ch) => n + ch.charCodeAt(0), 0);
```

Pass it: `<Bridge ... shuffleSeed={shuffleSeed} />`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/components/LinkCard.test.tsx tests/components/Bridge.test.tsx tests/components/LinkCard.onComplete.test.tsx tests/lib/linkGrade.test.ts`
Expected: PASS. `linkGrade` tests must be untouched and green — the algebra did not change.

- [ ] **Step 7: Commit**

```bash
git add components/LinkCard.tsx components/stages/Bridge.tsx tests/components/LinkCard.test.tsx tests/components/Bridge.test.tsx
git commit -m "fix: bridge feedback names the real problem and varies across attempts"
```

---

## Task 10: Full verification

**Files:** none modified unless a gate fails.

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: all tests pass, count ≥ 190 plus the new tests. Any red test is a real regression — fix it, do not delete the assertion.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Confirm the removed behaviors are actually gone**

```bash
grep -rn "speakCoach" components app lib --include=*.tsx --include=*.ts
grep -rn "autoSubmit" components --include=*.tsx
grep -rn "· soon" components --include=*.tsx
grep -rn "for-done" lib components --include=*.ts --include=*.tsx
```

Expected: the first prints only the definition in `lib/voice/playSpeech.ts`; the other three print nothing.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: verification pass for the beta feedback branch"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §1 House capitalization | 1 |
| §2 Feedback link | 2 |
| §3 Missing claim / motion context | 3 (ImpactStage), 4 (PracticeShell) |
| §4 Starting side + "Part 2" label | 6 (model), 7 (shell), 8 (deck) |
| §5 Voice mode split | 5 |
| §6 Bridge feedback repetition | 9 |
| §7a Practice key collision | none — false positive, documented in the spec |
| §7b Generated id reuse | 8 (purge) + 7 (stale-claim recovery) |
| §7c FOR-biased status | 6 (`one-side-done`) + 8 (`STATUS_META`) |
| §Testing gates | 10 |

No spec requirement is unassigned.

**Type consistency:** `emptyFlowProgress(startSide?)`, `loadFlowProgress(storage, motionId, startSide?)`, `useFlowProgress(motionId, startSide?)`, `hasFlowProgress`, `clearFlowProgressForPrefix`, `otherSideUnlocked`, and `MotionStatus`'s `"one-side-done"` are defined in Task 6 and consumed with identical names and signatures in Tasks 7 and 8. `FlowShell`'s `startSide` is produced in Task 7 and consumed in Task 8. `Bridge`'s `shuffleSeed` is produced and consumed within Task 9.

**Execution order.** Tasks 1, 2, 3, 4, 5 are fully independent and can run in parallel. Task 6 → 7 → 8 is a strict chain. Task 9 must follow Task 5 (both edit `LinkCard.tsx`). Task 8 must follow Task 1 (both edit `UniverseGenerator.tsx`). Task 10 runs last.
