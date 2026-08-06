# Constructive — Layer 2 (Link Builder) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Link Builder — a discovery activity where the student sorts a curated bank of reasoning/evidence "planks" to bridge a claim to an impact, tests the bridge (free retry), and learns from curated explanations including "great but wrong" traps; with an optional "talk this through" Claude coach.

**Architecture:** Extends the shipped Layer 1 Next.js (App Router, TS) app. New pure logic (link schemas, `gradeBridge`, link progress store) isolated from React and I/O and unit-tested; a home hub replaces the direct-to-deck root; the Motion Reader deck moves to `/motions`; Link Builder lives at `/link`. The AI coach is extended with one new `link` step on the existing `/api/coach` — no new endpoint. Deterministic grading is the source of truth; the coach is a non-blocking stuck-student affordance.

**Tech Stack:** Next.js 14, React 18, TypeScript (strict), Zod, `@anthropic-ai/sdk`, Vitest + React Testing Library + jsdom (all already installed and configured).

## Global Constraints

- Reuse Layer 1 infrastructure; do not duplicate the coach endpoint, content-loader pattern, progress-store pattern, brand tokens, or gated shell.
- TypeScript `strict`; App Router only; `@/` resolves to repo root. Keep the project **type-clean and build-clean**: before each commit run `npx tsc --noEmit` (0 errors) and, for tasks touching pages/routes, `npm run build` must succeed.
- No database; new persistence is `localStorage` only, under key exactly `constructive:link:v1`.
- No voice input in this layer; no scoring/stars/win-lose framing.
- **Grading is deterministic** via `gradeBridge` — the single source of truth for reveal and completion. The AI coach never grades.
- **Win condition ("bridge holds"):** all `fits` planks placed, no non-`fits` planks placed, AND at least one placed `fits` plank of `material:"evidence"` and one of `material:"reasoning"`.
- `verdict` ∈ `fits | doesnt-fit | great-but-wrong`; only `fits` holds; `great-but-wrong` is graded as not-fitting but flagged distinctly on reveal.
- The coach `link` request reuses the existing `CoachRequest` shape: `motion` carries the claim; `payload` carries `{ impact, candidateText, verdict }`. Do NOT change `CoachRequestSchema`'s object shape — only add `"link"` to `CoachStepSchema` and `LinkResponseSchema` to the response union.
- Coach failure must never block the activity (inline message only); the deterministic reveal stands alone.
- Brand tokens (CSS vars already in `app/globals.css`): evidence = gold `--gold`, reasoning = orange `--orange`; `--navy`, `--navy-mid`, `--dim`, `--text` as in Layer 1.

## File Structure

```
constructive/
  app/
    page.tsx                       # MODIFY → home hub (Task 1)
    motions/page.tsx               # Create → renders <Deck/> (Task 1)
    link/page.tsx                  # Create → renders <LinkDeck/> (Task 6)
  content/
    link-scenarios.json            # Create → starter bank (Task 2)
  lib/
    schemas.ts                     # MODIFY → link scenario schemas (Task 2) + coach link step (Task 5)
    linkScenarios.ts               # Create → load + validate bank (Task 2)
    linkGrade.ts                   # Create → gradeBridge (Task 3)
    prompts/link.ts                # Create → linkPrompt builder (Task 5)
    ai/coach.ts                    # MODIFY → add "link" case to buildPrompt (Task 5)
    state/linkProgress.ts          # Create → pure store (Task 4)
    state/useLinkProgress.ts       # Create → thin hook (Task 4)
  components/
    LinkDeck.tsx                   # Create → scenario picker (Task 6)
    LinkCard.tsx                   # Create → bridge card: sort→test→reveal (Task 6)
  tests/                           # mirrors source paths
```

---

### Task 1: Home hub + move Motion Reader to /motions

**Files:**
- Modify: `app/page.tsx`
- Create: `app/motions/page.tsx`
- Test: `tests/app/home.test.tsx`

**Interfaces:**
- Consumes: existing `components/Deck.tsx` (`Deck`), unchanged.
- Produces: a home hub at `/` linking to `/motions` and `/link`; `/motions` renders the Motion Reader deck.

- [ ] **Step 1: Write the failing test** — `tests/app/home.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home hub", () => {
  it("links to both live activities", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: /motion reader/i })).toHaveAttribute("href", "/motions");
    expect(screen.getByRole("link", { name: /link builder/i })).toHaveAttribute("href", "/link");
  });

  it("shows the Avatar as coming soon (not a link)", () => {
    render(<Home />);
    expect(screen.queryByRole("link", { name: /avatar/i })).toBeNull();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/app/home.test.tsx`
Expected: FAIL — current `app/page.tsx` renders `<Deck/>`, so there are no activity links.

- [ ] **Step 3: Replace `app/page.tsx` with the hub**

```tsx
import type { CSSProperties } from "react";

const card: CSSProperties = {
  width: 220,
  textAlign: "left",
  display: "block",
  textDecoration: "none",
  background: "var(--navy-mid)",
  color: "var(--text)",
  border: "1px solid #24344f",
  borderRadius: 12,
  padding: 16,
};

export default function Home() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
      <h1 className="serif">Constructive</h1>
      <p style={{ color: "var(--dim)" }}>Pick an activity.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 18 }}>
        <a href="/motions" style={card}>
          <span className="accent" style={{ color: "var(--gold)", fontSize: 12 }}>ACTIVITY 01</span>
          <div style={{ marginTop: 6, fontWeight: 700 }}>Motion Reader</div>
          <div style={{ color: "var(--dim)", fontSize: 13 }}>Learn to read a debate motion.</div>
        </a>
        <a href="/link" style={card}>
          <span className="accent" style={{ color: "var(--gold)", fontSize: 12 }}>ACTIVITY 02</span>
          <div style={{ marginTop: 6, fontWeight: 700 }}>Link Builder</div>
          <div style={{ color: "var(--dim)", fontSize: 13 }}>Build the bridge from claim to impact.</div>
        </a>
        <div style={{ ...card, opacity: 0.5 }} aria-disabled="true">
          <span className="accent" style={{ color: "var(--dim)", fontSize: 12 }}>ACTIVITY 03</span>
          <div style={{ marginTop: 6, fontWeight: 700 }}>Debate Avatar</div>
          <div style={{ color: "var(--dim)", fontSize: 13 }}>Coming soon.</div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Create `app/motions/page.tsx`**

```tsx
import { Deck } from "@/components/Deck";

export default function MotionsPage() {
  return <Deck />;
}
```

- [ ] **Step 5: Run test + build to verify**

Run: `npm test -- tests/app/home.test.tsx && npx tsc --noEmit && npm run build`
Expected: test PASSES; tsc clean; build succeeds with routes `/`, `/motions`, `/gate` (and the api routes).

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/motions/page.tsx tests/app/home.test.tsx
git commit -m "feat: home hub; move Motion Reader deck to /motions"
```

---

### Task 2: Link content model — schemas, bank, loader

**Files:**
- Modify: `lib/schemas.ts` (append link-scenario schemas; do not touch existing exports)
- Create: `content/link-scenarios.json`, `lib/linkScenarios.ts`
- Test: `tests/lib/linkSchemas.test.ts`, `tests/lib/linkScenarios.test.ts`

**Interfaces:**
- Consumes: `zod` (already used in `lib/schemas.ts`).
- Produces:
  - Schemas/types `LinkMaterialSchema`/`LinkMaterial`, `LinkVerdictSchema`/`LinkVerdict`, `LinkCandidateSchema`/`LinkCandidate`, `LinkScenarioSchema`/`LinkScenario`, `LinkScenariosFileSchema`.
  - `getScenarios(): LinkScenario[]`, `getScenario(id: string): LinkScenario | undefined`.

- [ ] **Step 1: Write the failing schema test** — `tests/lib/linkSchemas.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { LinkScenarioSchema, LinkScenariosFileSchema } from "@/lib/schemas";

const good = {
  id: "ls-x",
  claim: "This House would ban homework.",
  impact: "Kids get more time for family.",
  candidates: [
    { id: "c1", text: "Frees evenings for family.", material: "reasoning", verdict: "fits", explanation: "Bridges directly." },
    { id: "c2", text: "Studies tie homework to stress.", material: "evidence", verdict: "fits", explanation: "Evidence for wellbeing." },
  ],
};

describe("LinkScenarioSchema", () => {
  it("accepts a well-formed scenario", () => {
    expect(LinkScenarioSchema.parse(good)).toEqual(good);
  });
  it("rejects an unknown verdict", () => {
    const bad = { ...good, candidates: [{ ...good.candidates[0], verdict: "maybe" }] };
    expect(() => LinkScenarioSchema.parse(bad)).toThrow();
  });
  it("rejects an unknown material", () => {
    const bad = { ...good, candidates: [{ ...good.candidates[0], material: "vibes" }] };
    expect(() => LinkScenarioSchema.parse(bad)).toThrow();
  });
  it("validates an array file", () => {
    expect(() => LinkScenariosFileSchema.parse([good])).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/linkSchemas.test.ts`
Expected: FAIL — `LinkScenarioSchema` not exported.

- [ ] **Step 3: Append link schemas to `lib/schemas.ts`** (add at end of file; leave existing content untouched)

```ts
export const LinkMaterialSchema = z.enum(["evidence", "reasoning"]);
export type LinkMaterial = z.infer<typeof LinkMaterialSchema>;

export const LinkVerdictSchema = z.enum(["fits", "doesnt-fit", "great-but-wrong"]);
export type LinkVerdict = z.infer<typeof LinkVerdictSchema>;

export const LinkCandidateSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  material: LinkMaterialSchema,
  verdict: LinkVerdictSchema,
  explanation: z.string().min(1),
});
export type LinkCandidate = z.infer<typeof LinkCandidateSchema>;

export const LinkScenarioSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  impact: z.string().min(1),
  candidates: z.array(LinkCandidateSchema).min(2),
});
export type LinkScenario = z.infer<typeof LinkScenarioSchema>;

export const LinkScenariosFileSchema = z.array(LinkScenarioSchema);
```

- [ ] **Step 4: Create `content/link-scenarios.json`** (starter bank — every scenario has ≥1 fitting evidence AND ≥1 fitting reasoning, and at least one `great-but-wrong` trap; 3 shown, author 3 more of the same shape)

```json
[
  {
    "id": "ls-homework",
    "claim": "This House would ban homework.",
    "impact": "Kids get more time for family, sleep, and play.",
    "candidates": [
      { "id": "c1", "text": "Without homework, evenings are freed for rest and family.", "material": "reasoning", "verdict": "fits", "explanation": "Directly connects banning homework to the extra family time." },
      { "id": "c2", "text": "Research links heavy homework loads to student stress and lost sleep.", "material": "evidence", "verdict": "fits", "explanation": "Evidence that removing homework supports sleep and wellbeing." },
      { "id": "c3", "text": "A Harvard study found homework raises standardized-test scores.", "material": "evidence", "verdict": "great-but-wrong", "explanation": "Impressive and real, but it argues FOR homework — it does not bridge to this impact." },
      { "id": "c4", "text": "Homework teaches time-management skills.", "material": "reasoning", "verdict": "doesnt-fit", "explanation": "A point about a different impact; it does not connect to family/sleep/play time." }
    ]
  },
  {
    "id": "ls-phones",
    "claim": "This House would ban phones in classrooms.",
    "impact": "Students focus better and learn more.",
    "candidates": [
      { "id": "c1", "text": "Without phones, students aren't pulled away by notifications mid-lesson.", "material": "reasoning", "verdict": "fits", "explanation": "Links the ban to sustained attention, which supports learning." },
      { "id": "c2", "text": "Schools that restricted phones reported higher test results the next year.", "material": "evidence", "verdict": "fits", "explanation": "Evidence tying the ban to improved learning outcomes." },
      { "id": "c3", "text": "Smartphones are the best-selling consumer electronic of all time.", "material": "evidence", "verdict": "great-but-wrong", "explanation": "A strong-sounding fact that has nothing to do with classroom focus." },
      { "id": "c4", "text": "Phones can be used as calculators.", "material": "reasoning", "verdict": "doesnt-fit", "explanation": "Argues the other way and doesn't connect to the focus impact." }
    ]
  },
  {
    "id": "ls-voting-age",
    "claim": "This House would lower the voting age to 16.",
    "impact": "Young people become lifelong, engaged voters.",
    "candidates": [
      { "id": "c1", "text": "Voting while still in school builds a habit that carries into adulthood.", "material": "reasoning", "verdict": "fits", "explanation": "Connects early voting to lifelong engagement." },
      { "id": "c2", "text": "Turnout studies show first voting at 16-17 predicts higher lifelong turnout.", "material": "evidence", "verdict": "fits", "explanation": "Evidence directly supporting the lifelong-engagement impact." },
      { "id": "c3", "text": "A famous economist won a Nobel Prize for work on voting systems.", "material": "evidence", "verdict": "great-but-wrong", "explanation": "Authoritative but irrelevant to whether 16-year-olds become engaged voters." },
      { "id": "c4", "text": "16-year-olds can already drive in some places.", "material": "reasoning", "verdict": "doesnt-fit", "explanation": "An analogy about maturity, not a bridge to lifelong voting engagement." }
    ]
  }
]
```

- [ ] **Step 5: Write the failing loader test** — `tests/lib/linkScenarios.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { getScenarios, getScenario } from "@/lib/linkScenarios";

describe("link scenarios bank", () => {
  it("loads and validates the bank", () => {
    const s = getScenarios();
    expect(s.length).toBeGreaterThanOrEqual(3);
  });

  it("finds a scenario by id", () => {
    expect(getScenario("ls-homework")?.claim).toContain("ban homework");
  });

  it("every scenario has a fitting evidence AND a fitting reasoning plank (win condition is achievable)", () => {
    for (const s of getScenarios()) {
      const fits = s.candidates.filter((c) => c.verdict === "fits");
      expect(fits.some((c) => c.material === "evidence")).toBe(true);
      expect(fits.some((c) => c.material === "reasoning")).toBe(true);
    }
  });

  it("every scenario includes at least one great-but-wrong trap", () => {
    for (const s of getScenarios()) {
      expect(s.candidates.some((c) => c.verdict === "great-but-wrong")).toBe(true);
    }
  });
});
```

- [ ] **Step 6: Create `lib/linkScenarios.ts`**

```ts
import raw from "@/content/link-scenarios.json";
import { LinkScenariosFileSchema, type LinkScenario } from "@/lib/schemas";

// Validated once at import; a malformed bank throws loudly here.
const scenarios: LinkScenario[] = LinkScenariosFileSchema.parse(raw);

export function getScenarios(): LinkScenario[] {
  return scenarios;
}

export function getScenario(id: string): LinkScenario | undefined {
  return scenarios.find((s) => s.id === id);
}
```

- [ ] **Step 7: Run both tests to verify they pass**

Run: `npm test -- tests/lib/linkSchemas.test.ts tests/lib/linkScenarios.test.ts`
Expected: PASS (all cases, including the bank-invariant checks).

- [ ] **Step 8: Commit**

```bash
git add lib/schemas.ts lib/linkScenarios.ts content/link-scenarios.json tests/lib/linkSchemas.test.ts tests/lib/linkScenarios.test.ts
git commit -m "feat: link scenario schemas + starter bank + loader"
```

---

### Task 3: Grading logic — gradeBridge

**Files:**
- Create: `lib/linkGrade.ts`
- Test: `tests/lib/linkGrade.test.ts`

**Interfaces:**
- Consumes: `LinkScenario` type (Task 2).
- Produces:
  - `type PlankStatus = "correct" | "wrong" | "missing" | "correct-omit"`
  - `interface PlankResult { id: string; placed: boolean; status: PlankStatus }`
  - `interface BridgeGrade { perPlank: PlankResult[]; hasEvidence: boolean; hasReasoning: boolean; held: boolean }`
  - `gradeBridge(scenario: LinkScenario, placedIds: string[]): BridgeGrade`

- [ ] **Step 1: Write the failing test** — `tests/lib/linkGrade.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { gradeBridge } from "@/lib/linkGrade";
import type { LinkScenario } from "@/lib/schemas";

const scenario: LinkScenario = {
  id: "s",
  claim: "c",
  impact: "i",
  candidates: [
    { id: "e1", text: "ev fits", material: "evidence", verdict: "fits", explanation: "x" },
    { id: "r1", text: "re fits", material: "reasoning", verdict: "fits", explanation: "x" },
    { id: "gbw", text: "great but wrong", material: "evidence", verdict: "great-but-wrong", explanation: "x" },
    { id: "no", text: "doesnt fit", material: "reasoning", verdict: "doesnt-fit", explanation: "x" },
  ],
};

describe("gradeBridge", () => {
  it("holds when both fitting planks are placed and no wrong ones", () => {
    const g = gradeBridge(scenario, ["e1", "r1"]);
    expect(g.held).toBe(true);
    expect(g.hasEvidence).toBe(true);
    expect(g.hasReasoning).toBe(true);
    expect(g.perPlank.find((p) => p.id === "e1")?.status).toBe("correct");
  });

  it("does not hold when a fitting plank is missing", () => {
    const g = gradeBridge(scenario, ["e1"]);
    expect(g.held).toBe(false);
    expect(g.perPlank.find((p) => p.id === "r1")?.status).toBe("missing");
  });

  it("does not hold when a great-but-wrong plank is placed (flagged wrong)", () => {
    const g = gradeBridge(scenario, ["e1", "r1", "gbw"]);
    expect(g.held).toBe(false);
    expect(g.perPlank.find((p) => p.id === "gbw")?.status).toBe("wrong");
  });

  it("does not hold when a doesnt-fit plank is placed", () => {
    const g = gradeBridge(scenario, ["e1", "r1", "no"]);
    expect(g.held).toBe(false);
    expect(g.perPlank.find((p) => p.id === "no")?.status).toBe("wrong");
  });

  it("does not hold with only evidence even if it is the only fitting evidence (both-materials rule)", () => {
    const evOnly: LinkScenario = {
      ...scenario,
      candidates: [
        { id: "e1", text: "ev", material: "evidence", verdict: "fits", explanation: "x" },
        { id: "e2", text: "ev2", material: "evidence", verdict: "fits", explanation: "x" },
      ],
    };
    const g = gradeBridge(evOnly, ["e1", "e2"]);
    expect(g.hasReasoning).toBe(false);
    expect(g.held).toBe(false);
  });

  it("marks an unplaced non-fitting plank correct-omit", () => {
    const g = gradeBridge(scenario, ["e1", "r1"]);
    expect(g.perPlank.find((p) => p.id === "gbw")?.status).toBe("correct-omit");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/linkGrade.test.ts`
Expected: FAIL — `@/lib/linkGrade` not found.

- [ ] **Step 3: Create `lib/linkGrade.ts`**

```ts
import type { LinkScenario } from "@/lib/schemas";

export type PlankStatus = "correct" | "wrong" | "missing" | "correct-omit";

export interface PlankResult {
  id: string;
  placed: boolean;
  status: PlankStatus;
}

export interface BridgeGrade {
  perPlank: PlankResult[];
  hasEvidence: boolean;
  hasReasoning: boolean;
  held: boolean;
}

export function gradeBridge(scenario: LinkScenario, placedIds: string[]): BridgeGrade {
  const placed = new Set(placedIds);

  const perPlank: PlankResult[] = scenario.candidates.map((c) => {
    const isPlaced = placed.has(c.id);
    const fits = c.verdict === "fits";
    let status: PlankStatus;
    if (fits && isPlaced) status = "correct";
    else if (!fits && isPlaced) status = "wrong";
    else if (fits && !isPlaced) status = "missing";
    else status = "correct-omit";
    return { id: c.id, placed: isPlaced, status };
  });

  const placedFitting = scenario.candidates.filter((c) => placed.has(c.id) && c.verdict === "fits");
  const hasEvidence = placedFitting.some((c) => c.material === "evidence");
  const hasReasoning = placedFitting.some((c) => c.material === "reasoning");

  const allFitsPlaced = scenario.candidates
    .filter((c) => c.verdict === "fits")
    .every((c) => placed.has(c.id));
  const noWrongPlaced = scenario.candidates
    .filter((c) => c.verdict !== "fits")
    .every((c) => !placed.has(c.id));

  const held = allFitsPlaced && noWrongPlaced && hasEvidence && hasReasoning;

  return { perPlank, hasEvidence, hasReasoning, held };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/linkGrade.test.ts`
Expected: PASS (all six cases).

- [ ] **Step 5: Commit**

```bash
git add lib/linkGrade.ts tests/lib/linkGrade.test.ts
git commit -m "feat: gradeBridge deterministic grading for the link builder"
```

---

### Task 4: Link progress store + hook

**Files:**
- Create: `lib/state/linkProgress.ts`, `lib/state/useLinkProgress.ts`
- Test: `tests/lib/state/linkProgress.test.ts`

**Interfaces:**
- Consumes: nothing from prior Layer 2 tasks.
- Produces:
  - `LINK_STORAGE_KEY = "constructive:link:v1"`
  - `interface LinkProgress { placedIds: string[]; held: boolean }`
  - `emptyLinkProgress()`, `loadLinkProgress(storage, scenarioId)`, `saveLinkProgress(storage, scenarioId, p)`
  - Hook `useLinkProgress(scenarioId): [LinkProgress, (patch: Partial<LinkProgress>) => void]`

- [ ] **Step 1: Write the failing test** — `tests/lib/state/linkProgress.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  emptyLinkProgress,
  loadLinkProgress,
  saveLinkProgress,
  LINK_STORAGE_KEY,
} from "@/lib/state/linkProgress";

describe("linkProgress store", () => {
  beforeEach(() => localStorage.clear());

  it("returns empty progress when nothing stored", () => {
    expect(loadLinkProgress(localStorage, "s1")).toEqual(emptyLinkProgress());
  });

  it("round-trips under the versioned key", () => {
    saveLinkProgress(localStorage, "s1", { placedIds: ["c1", "c2"], held: true });
    expect(loadLinkProgress(localStorage, "s1")).toEqual({ placedIds: ["c1", "c2"], held: true });
    expect(localStorage.getItem(LINK_STORAGE_KEY)).toContain("s1");
  });

  it("keeps scenarios independent", () => {
    saveLinkProgress(localStorage, "s1", { placedIds: ["a"], held: false });
    saveLinkProgress(localStorage, "s2", { placedIds: ["b"], held: true });
    expect(loadLinkProgress(localStorage, "s1").placedIds).toEqual(["a"]);
    expect(loadLinkProgress(localStorage, "s2").held).toBe(true);
  });

  it("falls back to empty on corrupt storage", () => {
    localStorage.setItem(LINK_STORAGE_KEY, "{nope");
    expect(loadLinkProgress(localStorage, "s1")).toEqual(emptyLinkProgress());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/state/linkProgress.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/state/linkProgress.ts`**

```ts
export const LINK_STORAGE_KEY = "constructive:link:v1";

export interface LinkProgress {
  placedIds: string[];
  held: boolean;
}

export function emptyLinkProgress(): LinkProgress {
  return { placedIds: [], held: false };
}

function readAll(storage: Storage): Record<string, LinkProgress> {
  const raw = storage.getItem(LINK_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function loadLinkProgress(storage: Storage, scenarioId: string): LinkProgress {
  return readAll(storage)[scenarioId] ?? emptyLinkProgress();
}

export function saveLinkProgress(storage: Storage, scenarioId: string, p: LinkProgress): void {
  const all = readAll(storage);
  all[scenarioId] = p;
  storage.setItem(LINK_STORAGE_KEY, JSON.stringify(all));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/state/linkProgress.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the hook `lib/state/useLinkProgress.ts`** (thin wrapper; exercised via component tests in Task 6)

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import {
  emptyLinkProgress,
  loadLinkProgress,
  saveLinkProgress,
  type LinkProgress,
} from "@/lib/state/linkProgress";

export function useLinkProgress(
  scenarioId: string
): [LinkProgress, (patch: Partial<LinkProgress>) => void] {
  const [progress, setProgress] = useState<LinkProgress>(emptyLinkProgress());

  useEffect(() => {
    setProgress(loadLinkProgress(window.localStorage, scenarioId));
  }, [scenarioId]);

  const update = useCallback(
    (patch: Partial<LinkProgress>) => {
      setProgress((prev) => {
        const next = { ...prev, ...patch };
        saveLinkProgress(window.localStorage, scenarioId, next);
        return next;
      });
    },
    [scenarioId]
  );

  return [progress, update];
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/state/linkProgress.ts lib/state/useLinkProgress.ts tests/lib/state/linkProgress.test.ts
git commit -m "feat: link progress store + hook (localStorage)"
```

---

### Task 5: Coach `link` step

**Files:**
- Modify: `lib/schemas.ts` (add `"link"` to `CoachStepSchema`; add `LinkResponseSchema` to the response union)
- Create: `lib/prompts/link.ts`
- Modify: `lib/ai/coach.ts` (add `case "link"` to `buildPrompt`)
- Test: `tests/lib/prompts.link.test.ts`, `tests/lib/ai/coach.link.test.ts`

**Interfaces:**
- Consumes: `CoachResponseSchema`/`CoachRequest`/`CoachResponse` (Task nothing-new — existing), `ChatClient`, `runCoach`.
- Produces:
  - `linkPrompt(input: { claim: string; impact: string; candidateText: string; verdict: string }): { system: string; user: string }`
  - `runCoach` handles `step: "link"`, returning a `{ kind: "link", reaction }` `CoachResponse`.

- [ ] **Step 1: Write the failing prompt test** — `tests/lib/prompts.link.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { linkPrompt } from "@/lib/prompts/link";

describe("linkPrompt", () => {
  it("embeds claim, impact, candidate and asks for link JSON", () => {
    const p = linkPrompt({
      claim: "THW ban homework.",
      impact: "More family time.",
      candidateText: "A Harvard study raised test scores.",
      verdict: "great-but-wrong",
    });
    expect(p.user).toContain("THW ban homework.");
    expect(p.user).toContain("More family time.");
    expect(p.user).toContain("A Harvard study raised test scores.");
    expect(p.system.toLowerCase()).toContain("json");
    expect(p.system).toContain('"kind":"link"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/prompts.link.test.ts`
Expected: FAIL — `@/lib/prompts/link` not found.

- [ ] **Step 3: Create `lib/prompts/link.ts`**

```ts
export function linkPrompt(input: {
  claim: string;
  impact: string;
  candidateText: string;
  verdict: string;
}): { system: string; user: string } {
  const system = [
    "You are a warm debate coach for a student aged 10-18.",
    "The student is deciding whether one sentence is a good 'bridge' from a claim to an impact.",
    "Explain briefly whether it connects the claim to THIS impact, and why.",
    "If it sounds authoritative but does not fit (a 'great but wrong' trap), acknowledge why it's tempting, then show why it doesn't bridge.",
    "Keep it to 2-3 sentences; do not just give the answer away, help them see it.",
    'Respond ONLY as JSON: {"kind":"link","reaction":string}.',
  ].join(" ");
  const user = [
    `Claim: "${input.claim}"`,
    `Impact: "${input.impact}"`,
    `Candidate sentence: "${input.candidateText}"`,
    `(Author's verdict for your reference, do not quote it verbatim: ${input.verdict})`,
  ].join("\n");
  return { system, user };
}
```

- [ ] **Step 4: Update `lib/schemas.ts`** — two edits, leave everything else unchanged.

Replace the `CoachStepSchema` line:

```ts
export const CoachStepSchema = z.enum(["restate", "keyword", "refine", "link"]);
```

Add `LinkResponseSchema` immediately before `CoachResponseSchema`, and include it in the union:

```ts
export const LinkResponseSchema = z.object({
  kind: z.literal("link"),
  reaction: z.string(),
});
export const CoachResponseSchema = z.discriminatedUnion("kind", [
  RestateResponseSchema,
  KeywordResponseSchema,
  RefineResponseSchema,
  LinkResponseSchema,
]);
```

- [ ] **Step 5: Update `lib/ai/coach.ts`** — add the import and the `case "link"` to `buildPrompt` (add to the existing switch; do not remove other cases).

Add the import near the other prompt imports:

```ts
import { linkPrompt } from "@/lib/prompts/link";
```

Add this case inside `buildPrompt`'s `switch (req.step)`:

```ts
    case "link":
      return linkPrompt({
        claim: req.motion,
        impact: String(p.impact ?? ""),
        candidateText: String(p.candidateText ?? ""),
        verdict: String(p.verdict ?? ""),
      });
```

- [ ] **Step 6: Write the failing coach test** — `tests/lib/ai/coach.link.test.ts`

```ts
import { describe, it, expect } from "vitest";
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

describe("runCoach link step", () => {
  it("uses the link prompt and parses a link response", async () => {
    const client = fakeClient(JSON.stringify({ kind: "link", reaction: "Tempting, but it argues the other way." }));
    const res = await runCoach(
      {
        step: "link",
        motion: "THW ban homework.",
        payload: { impact: "More family time.", candidateText: "A Harvard study raised test scores.", verdict: "great-but-wrong" },
      },
      client
    );
    expect(res).toMatchObject({ kind: "link" });
    // The claim (passed via `motion`) and impact must reach the prompt.
    expect(client.calls[0].user).toContain("THW ban homework.");
    expect(client.calls[0].user).toContain("More family time.");
  });
});
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- tests/lib/prompts.link.test.ts tests/lib/ai/coach.link.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean. (The existing `/api/coach` route needs no change — it validates with `CoachRequestSchema` and calls `runCoach` generically.)

- [ ] **Step 8: Commit**

```bash
git add lib/schemas.ts lib/prompts/link.ts lib/ai/coach.ts tests/lib/prompts.link.test.ts tests/lib/ai/coach.link.test.ts
git commit -m "feat: add link coach step (schema + prompt + runCoach case)"
```

---

### Task 6: Link Builder UI — LinkCard, LinkDeck, /link page

**Files:**
- Create: `components/LinkCard.tsx`, `components/LinkDeck.tsx`, `app/link/page.tsx`
- Test: `tests/components/LinkCard.test.tsx`

**Interfaces:**
- Consumes: `gradeBridge`/`BridgeGrade` (Task 3), `useLinkProgress` (Task 4), `getScenarios`/`getScenario` (Task 2), `LinkScenario`/`LinkCandidate`/`CoachResponse` types, `/api/coach` (fetch, stubbed in tests).
- Produces: the Link Builder UI at `/link`.

- [ ] **Step 1: Write the failing test** — `tests/components/LinkCard.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LinkCard } from "@/components/LinkCard";
import type { LinkScenario } from "@/lib/schemas";

const scenario: LinkScenario = {
  id: "s",
  claim: "This House would ban homework.",
  impact: "More family time.",
  candidates: [
    { id: "e1", text: "Studies tie homework to stress.", material: "evidence", verdict: "fits", explanation: "Evidence for wellbeing." },
    { id: "r1", text: "Frees evenings for family.", material: "reasoning", verdict: "fits", explanation: "Bridges directly." },
    { id: "gbw", text: "A Harvard study raised test scores.", material: "evidence", verdict: "great-but-wrong", explanation: "Argues the other way." },
  ],
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ kind: "link", reaction: "Tempting, but it argues the other way." }), { status: 200 }))
  );
});

describe("LinkCard", () => {
  it("shows the bridge holding when the two fitting planks are built and no wrong ones", async () => {
    render(<LinkCard scenario={scenario} onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /build .*stress/i }));
    await userEvent.click(screen.getByRole("button", { name: /build .*frees evenings/i }));
    await userEvent.click(screen.getByRole("button", { name: /test the bridge/i }));
    expect(await screen.findByText(/bridge holds/i)).toBeInTheDocument();
  });

  it("does not hold and reveals the great-but-wrong explanation when that plank is built", async () => {
    render(<LinkCard scenario={scenario} onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /build .*stress/i }));
    await userEvent.click(screen.getByRole("button", { name: /build .*frees evenings/i }));
    await userEvent.click(screen.getByRole("button", { name: /build .*harvard/i }));
    await userEvent.click(screen.getByRole("button", { name: /test the bridge/i }));
    expect(screen.queryByText(/bridge holds/i)).toBeNull();
    expect(await screen.findByText(/argues the other way/i)).toBeInTheDocument();
  });

  it("does not hold with evidence only (needs both materials)", async () => {
    render(<LinkCard scenario={scenario} onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /build .*stress/i }));
    await userEvent.click(screen.getByRole("button", { name: /test the bridge/i }));
    expect(screen.queryByText(/bridge holds/i)).toBeNull();
    expect(await screen.findByText(/both/i)).toBeInTheDocument();
  });

  it("surfaces a coach reaction from 'talk this through' after testing", async () => {
    render(<LinkCard scenario={scenario} onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /build .*harvard/i }));
    await userEvent.click(screen.getByRole("button", { name: /test the bridge/i }));
    await userEvent.click(screen.getAllByRole("button", { name: /talk this through/i })[0]);
    expect(await screen.findByText(/tempting, but it argues the other way/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/LinkCard.test.tsx`
Expected: FAIL — `@/components/LinkCard` not found.

- [ ] **Step 3: Create `components/LinkCard.tsx`**

```tsx
"use client";
import { useState } from "react";
import { gradeBridge, type BridgeGrade } from "@/lib/linkGrade";
import { useLinkProgress } from "@/lib/state/useLinkProgress";
import type { LinkScenario, LinkCandidate, CoachResponse } from "@/lib/schemas";

export function LinkCard({ scenario, onExit }: { scenario: LinkScenario; onExit: () => void }) {
  const [progress, update] = useLinkProgress(scenario.id);
  const [placed, setPlaced] = useState<string[]>(progress.placedIds);
  const [grade, setGrade] = useState<BridgeGrade | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [coachError, setCoachError] = useState<Record<string, boolean>>({});

  const placedSet = new Set(placed);

  function toggle(id: string) {
    setGrade(null); // re-sorting invalidates the last test
    setPlaced((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function test() {
    const g = gradeBridge(scenario, placed);
    setGrade(g);
    update({ placedIds: placed, held: g.held });
  }

  async function talkThrough(c: LinkCandidate) {
    setCoachError((e) => ({ ...e, [c.id]: false }));
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "link",
          motion: scenario.claim,
          payload: { impact: scenario.impact, candidateText: c.text, verdict: c.verdict },
        }),
      });
      if (!res.ok) throw new Error("coach failed");
      const data: CoachResponse = await res.json();
      if (data.kind === "link") setReactions((r) => ({ ...r, [c.id]: data.reaction }));
    } catch {
      setCoachError((e) => ({ ...e, [c.id]: true }));
    }
  }

  function statusOf(id: string) {
    return grade?.perPlank.find((p) => p.id === id)?.status;
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", background: "var(--navy)", border: "1px solid #22324c", borderRadius: 18, padding: 24, color: "var(--text)" }}>
      <button type="button" onClick={onExit} style={{ marginBottom: 12 }}>← activities</button>

      <div style={{ display: "flex", gap: 12, alignItems: "stretch", margin: "6px 0 16px" }}>
        <div style={{ flex: 1, background: "var(--navy-light)", border: "1px solid #2a4a7a", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--dim)" }}>Claim</div>
          <div className="serif">{scenario.claim}</div>
        </div>
        <div style={{ flex: 1, background: "rgba(200,150,46,.16)", border: "1px solid var(--gold)", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--gold)" }}>Impact</div>
          <div className="serif">{scenario.impact}</div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 8 }}>
        Build the bridge: choose the planks that connect the claim to the impact. Good bridges use both
        <span style={{ color: "var(--gold)" }}> evidence</span> and <span style={{ color: "var(--orange)" }}>reasoning</span>.
      </div>

      {scenario.candidates.map((c) => {
        const isPlaced = placedSet.has(c.id);
        const status = statusOf(c.id);
        const matColor = c.material === "evidence" ? "var(--gold)" : "var(--orange-light)";
        return (
          <div key={c.id} style={{ background: "var(--navy-mid)", border: `1px solid ${status === "wrong" ? "var(--orange)" : status === "correct" ? "#3fae6b" : "#24344f"}`, borderRadius: 10, padding: 10, marginBottom: 9 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase", color: matColor, marginTop: 3, whiteSpace: "nowrap" }}>{c.material}</span>
              <div style={{ flex: 1, fontSize: 14, lineHeight: 1.4 }}>{c.text}</div>
              <button
                type="button"
                aria-label={`${isPlaced ? "Set aside" : "Build"}: ${c.text}`}
                onClick={() => toggle(c.id)}
              >
                {isPlaced ? "Set aside" : "Build"}
              </button>
            </div>
            {grade && status !== "correct-omit" && (
              <div style={{ marginTop: 8, fontSize: 13, color: status === "correct" ? "#4fd08a" : "var(--orange-light)" }}>
                {status === "correct" && "✓ Holds — good plank."}
                {status === "missing" && "This one actually fits — you left it out."}
                {status === "wrong" && (c.verdict === "great-but-wrong" ? "🪤 Great but wrong — " : "Doesn't fit — ") + c.explanation}
                {status === "missing" && ` ${c.explanation}`}
                <div style={{ marginTop: 6 }}>
                  <button type="button" onClick={() => talkThrough(c)}>💬 Talk this through</button>
                  {coachError[c.id] && <span style={{ color: "var(--orange-light)", marginLeft: 8 }}>Coach unavailable — keep going.</span>}
                </div>
                {reactions[c.id] && <p style={{ color: "var(--orange-light)", marginTop: 6 }}>💬 {reactions[c.id]}</p>}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
        <button type="button" onClick={test}>Test the bridge</button>
        {grade && (grade.held
          ? <span style={{ color: "#4fd08a", fontWeight: 700 }}>✓ The bridge holds!</span>
          : <span style={{ color: "var(--orange-light)" }}>
              Not yet{!(grade.hasEvidence && grade.hasReasoning) ? " — a strong bridge needs both evidence and reasoning." : " — check the flagged planks."}
            </span>)}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/LinkCard.test.tsx`
Expected: PASS (all four cases).

- [ ] **Step 5: Create `components/LinkDeck.tsx`**

```tsx
"use client";
import { useState } from "react";
import { getScenarios } from "@/lib/linkScenarios";
import { LinkCard } from "@/components/LinkCard";

export function LinkDeck() {
  const scenarios = getScenarios();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = scenarios.find((s) => s.id === activeId);

  if (active) return <LinkCard scenario={active} onExit={() => setActiveId(null)} />;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 className="serif">Link Builder</h1>
      <p style={{ color: "var(--dim)" }}>Pick a scenario and build the bridge from claim to impact.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 18 }}>
        {scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveId(s.id)}
            style={{ width: 220, textAlign: "left", background: "var(--navy-mid)", color: "var(--text)", border: "1px solid #24344f", borderRadius: 12, padding: 16 }}
          >
            <span className="accent" style={{ color: "var(--gold)", fontSize: 12 }}>{s.id}</span>
            <div style={{ marginTop: 6 }}>{s.claim}</div>
          </button>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Create `app/link/page.tsx`**

```tsx
import { LinkDeck } from "@/components/LinkDeck";

export default function LinkPage() {
  return <LinkDeck />;
}
```

- [ ] **Step 7: Run the full suite + build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all tests PASS; tsc clean; `next build` succeeds with the new `/link` route (and `/`, `/motions`).

- [ ] **Step 8: Commit**

```bash
git add components/LinkCard.tsx components/LinkDeck.tsx app/link/page.tsx tests/components/LinkCard.test.tsx
git commit -m "feat: link builder UI (bridge card, deck, /link page)"
```

---

## Manual verification (after Task 6)

Not automated — do once with the app running (`npm run dev`, authed via the gate):

1. From `/`, confirm the hub shows Motion Reader, Link Builder, and a disabled Avatar card; the first two navigate to `/motions` and `/link`.
2. Open a Link Builder scenario. Build the two fitting planks only → **Test** → "the bridge holds."
3. Add the "great but wrong" plank → **Test** → bridge no longer holds; that plank is flagged with the 🪤 explanation.
4. Build only an evidence plank → **Test** → "needs both evidence and reasoning."
5. Click **Talk this through** on a flagged plank → a coach reaction appears (needs a real `ANTHROPIC_API_KEY`); with the key unset, confirm the inline "Coach unavailable — keep going." message instead of a blocked UI.
6. Reload mid-scenario → placements restored from `localStorage`.

---

## Self-Review

**Spec coverage:**
- Home hub + `/motions` move + `/link` → Task 1, Task 6. ✓
- Discovery bank (claim/impact/candidates, material, verdict, explanation), editable JSON, import-time validation → Task 2. ✓
- Bank invariant (≥1 fitting evidence + ≥1 fitting reasoning; a great-but-wrong trap) → Task 2 tests. ✓
- Sort-then-test, reveal + free retry, per-plank status, great-but-wrong distinct callout → Tasks 3 (grade) + 6 (UI). ✓
- Win condition incl. both-materials rule → `gradeBridge` (Task 3) + reveal messaging (Task 6). ✓
- Deterministic grading as source of truth → Task 3. ✓
- Optional non-blocking coach `link` step on existing `/api/coach` → Task 5 (+ Task 6 button, error path). ✓
- localStorage-only persistence under `constructive:link:v1` → Task 4. ✓
- No voice, no scoring → nothing implements them. ✓
- Non-goals (no fallacies, no generation, no new endpoint, no auth/db change) → respected. ✓
- Testing: pure logic (grade, store, schema, prompt) unit-tested; coach link step with mocked client; component flow with stubbed fetch → Tasks 2–6. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. The starter bank ships 3 fully-formed scenarios and instructs authoring 3 more of the identical, validated shape (the invariant test guards them). ✓

**Type consistency:** `LinkScenario`/`LinkCandidate`/`LinkMaterial`/`LinkVerdict`, `BridgeGrade`/`PlankResult`/`PlankStatus`, `LinkProgress`/`LINK_STORAGE_KEY`, the `link` coach step (claim via `motion`, `payload{impact,candidateText,verdict}`), and `LinkResponseSchema { kind:"link", reaction }` are defined once and referenced consistently across tasks. `gradeBridge` signature matches its consumer in `LinkCard`. ✓
