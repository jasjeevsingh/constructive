# Constructive — AGAINST Second Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the integrated per-motion flow's second side — author 3 AGAINST claims per motion and wire the FOR→AGAINST switch so a student can argue both sides, with a final closure when both are done.

**Architecture:** Content-only change to `content/flow-motions.json` (fills `sides.against.claims`) plus a focused `components/FlowShell.tsx` change (three completion states + a side-switch button + side-aware pills). Reuses the existing `flowMachine`, `useFlowProgress` (`constructive:flow:v1`), the side-agnostic `ClaimStage`/`LinkCard`/`ImpactStage`, and the `claim`/`impact` coach steps — no schema, coach, or storage-key changes.

**Tech Stack:** Next.js 14 (App Router, TS strict), React 18, Zod, Vitest + React Testing Library + jsdom. All already installed.

## Global Constraints

- No new content schema, coach step, or persistence key. `FlowMotionSchema` already validates `sides.against`.
- Author **exactly 3 AGAINST claims per motion** for all 4 motions; each claim's candidate set has ≥1 `{material:"evidence",verdict:"fits"}`, ≥1 `{material:"reasoning",verdict:"fits"}`, and ≥1 `{verdict:"great-but-wrong"}` (winnability invariant), matching the FOR pattern.
- The AGAINST pass **jumps straight to Claim** (Read not repeated). The switch is exactly: `update({ side: "against", stage: "claim", mappedClaimId: null, impact: "" })`.
- Switch trigger: a **"Now argue the other side →"** button on the FOR-complete panel. The AGAINST pill unlocks (drops `🔒 · soon`) once `forComplete`.
- Three completion states in `FlowShell`, evaluated before the active stage: (1) `forComplete && againstComplete` → final "both sides" closure; (2) `side === "for" && forComplete` (AGAINST not done) → FOR-done panel + switch button; (3) otherwise → active stage.
- Completion is tracked by the existing `forComplete`/`againstComplete` flags; the working fields (`mappedClaimId`, `impact`) reset on switch. No per-side history.
- TypeScript `strict`, App Router, `@/` alias. Keep type-clean (`npx tsc --noEmit`) and build-clean (`npm run build`) — verify both in Task 2.
- Brand tokens (CSS vars in `app/globals.css`): `--gold`, `--dim`, `--navy-mid`, `--text`. Active pill = gold; inactive = muted.

## File Structure

```
content/flow-motions.json          # Modify — fill sides.against.claims (3 each) for all 4 motions (Task 1)
tests/lib/flowMotions.test.ts      # Modify — invariant now checks BOTH sides (Task 1)
components/FlowShell.tsx           # Modify — completion states + switch + side-aware pills (Task 2)
tests/components/FlowShell.test.tsx# Modify — switch + final-closure tests; fixture gains AGAINST claims (Task 2)
```

---

### Task 1: Author AGAINST content + extend the bank invariant to both sides

**Files:**
- Modify: `content/flow-motions.json` (fill each motion's `sides.against.claims`)
- Modify: `tests/lib/flowMotions.test.ts` (extend two invariant tests to both sides)

**Interfaces:**
- Consumes: existing `FlowMotionSchema`/`getFlowMotions` (unchanged).
- Produces: every motion now has `sides.against.claims` with exactly 3 winnable claims.

- [ ] **Step 1: Extend the invariant tests to require BOTH sides** — edit `tests/lib/flowMotions.test.ts`.

Replace the existing `"every authored FOR side has exactly 3 claims"` test with one that checks both sides and requires AGAINST to be authored:

```ts
  it("every motion has exactly 3 claims on BOTH sides", () => {
    for (const m of getFlowMotions()) {
      expect(m.sides.for.claims.length).toBe(3);
      expect(m.sides.against.claims.length).toBe(3);
    }
  });
```

Replace the existing `"every claim's bank is winnable and has a great-but-wrong trap"` test with one that iterates both sides:

```ts
  it("every claim on both sides is winnable and has a great-but-wrong trap", () => {
    for (const m of getFlowMotions()) {
      for (const side of ["for", "against"] as const) {
        for (const c of m.sides[side].claims) {
          const fits = c.candidates.filter((x) => x.verdict === "fits");
          expect(fits.some((x) => x.material === "evidence")).toBe(true);
          expect(fits.some((x) => x.material === "reasoning")).toBe(true);
          expect(c.candidates.some((x) => x.verdict === "great-but-wrong")).toBe(true);
        }
      }
    }
  });
```

- [ ] **Step 2: Run the tests to verify they FAIL**

Run: `npm test -- tests/lib/flowMotions.test.ts`
Expected: FAIL — `sides.against.claims.length` is 0 for every motion (AGAINST not yet authored), so the "exactly 3 on both sides" test fails.

- [ ] **Step 3: Author the AGAINST claims in `content/flow-motions.json`**

For each of the 4 motions (`m-kids-vote`, `m-homework`, `m-school-uniforms`, `m-phones-in-school`), replace `"against": { "claims": [] }` with `"against": { "claims": [ ...3 claims... ] }`. Each claim mirrors the FOR shape: `id` (unique within the motion, distinct from the FOR ids), `claim`, `impact`, and 4 `candidates` (c1 reasoning/fits, c2 evidence/fits, c3 evidence/great-but-wrong, c4 reasoning/doesnt-fit). Make the `great-but-wrong` genuinely tempting (authoritative-sounding but wrong direction or off-target). Author real, age-appropriate AGAINST cases — the two shown below are the exact content for `m-kids-vote` and `m-homework`; author the same shape for `m-school-uniforms` (AGAINST: uniforms) and `m-phones-in-school` (AGAINST: allowing phones).

`m-kids-vote` → `sides.against`:

```json
{
  "claims": [
    {
      "id": "a-maturity",
      "claim": "Most young kids don't yet have the experience to weigh complex trade-offs.",
      "impact": "Rushed votes from unprepared voters lead to worse collective decisions.",
      "candidates": [
        { "id": "c1", "text": "Big policy choices involve trade-offs that take years of context to judge.", "material": "reasoning", "verdict": "fits", "explanation": "Links limited experience to weaker decisions." },
        { "id": "c2", "text": "Studies show reasoning about long-term trade-offs keeps developing through the teen years.", "material": "evidence", "verdict": "fits", "explanation": "Evidence that the capacity is still forming." },
        { "id": "c3", "text": "A famous economist won a prize for work on voting paradoxes.", "material": "evidence", "verdict": "great-but-wrong", "explanation": "Authoritative but about voting math, not kids' readiness." },
        { "id": "c4", "text": "Kids can already use social media.", "material": "reasoning", "verdict": "doesnt-fit", "explanation": "Unrelated to weighing policy trade-offs." }
      ]
    },
    {
      "id": "a-manipulation",
      "claim": "Younger voters are easier to sway with slogans and pressure.",
      "impact": "Elections get decided by manipulation rather than reasoning.",
      "candidates": [
        { "id": "c1", "text": "Simple, emotional messaging lands harder when someone has less practice spotting spin.", "material": "reasoning", "verdict": "fits", "explanation": "Links persuadability to manipulated outcomes." },
        { "id": "c2", "text": "Media-literacy research finds younger teens are more influenced by viral claims.", "material": "evidence", "verdict": "fits", "explanation": "Evidence for the manipulation risk." },
        { "id": "c3", "text": "Voter turnout hit record highs in a recent election.", "material": "evidence", "verdict": "great-but-wrong", "explanation": "Impressive turnout stat, but says nothing about manipulation." },
        { "id": "c4", "text": "Adults are sometimes swayed by ads too.", "material": "reasoning", "verdict": "doesnt-fit", "explanation": "About adults; doesn't bridge to kids specifically." }
      ]
    },
    {
      "id": "a-burden",
      "claim": "Voting is a serious responsibility that shouldn't be forced on children.",
      "impact": "Pushing adult duties onto kids robs them of childhood.",
      "candidates": [
        { "id": "c1", "text": "Loading civic obligations onto kids crowds out the freedom to just be a kid.", "material": "reasoning", "verdict": "fits", "explanation": "Links the duty to lost childhood." },
        { "id": "c2", "text": "Child-development guidance warns against overloading kids with adult responsibilities.", "material": "evidence", "verdict": "fits", "explanation": "Evidence for the childhood-burden impact." },
        { "id": "c3", "text": "Some countries have compulsory voting with heavy fines.", "material": "evidence", "verdict": "great-but-wrong", "explanation": "Real fact about adults' compulsory voting — not about burdening kids." },
        { "id": "c4", "text": "Kids get pocket money.", "material": "reasoning", "verdict": "doesnt-fit", "explanation": "Irrelevant to the responsibility burden." }
      ]
    }
  ]
}
```

`m-homework` → `sides.against`:

```json
{
  "claims": [
    {
      "id": "a-practice",
      "claim": "Practice at home is how skills actually stick.",
      "impact": "Without homework, students master less and fall behind.",
      "candidates": [
        { "id": "c1", "text": "Repeating a skill on your own is what moves it into long-term memory.", "material": "reasoning", "verdict": "fits", "explanation": "Links home practice to mastery." },
        { "id": "c2", "text": "Studies link regular spaced practice to stronger retention.", "material": "evidence", "verdict": "fits", "explanation": "Evidence for the mastery impact." },
        { "id": "c3", "text": "A Harvard study found homework raises standardized-test scores.", "material": "evidence", "verdict": "great-but-wrong", "explanation": "Strong and on-topic-sounding, but it measures test scores, not the mastery mechanism claimed here." },
        { "id": "c4", "text": "Some students dislike homework.", "material": "reasoning", "verdict": "doesnt-fit", "explanation": "A preference, not a bridge to mastery." }
      ]
    },
    {
      "id": "a-discipline",
      "claim": "Homework builds time-management and self-discipline.",
      "impact": "Students grow into organized, independent adults.",
      "candidates": [
        { "id": "c1", "text": "Planning and finishing work without a teacher watching builds self-management.", "material": "reasoning", "verdict": "fits", "explanation": "Links homework to independence." },
        { "id": "c2", "text": "Longitudinal studies tie homework routines to later self-regulation.", "material": "evidence", "verdict": "fits", "explanation": "Evidence for the independence impact." },
        { "id": "c3", "text": "The average backpack weighs several pounds.", "material": "evidence", "verdict": "great-but-wrong", "explanation": "A concrete-sounding fact with no link to self-discipline." },
        { "id": "c4", "text": "Homework can be done on a laptop.", "material": "reasoning", "verdict": "doesnt-fit", "explanation": "About tools, not discipline." }
      ]
    },
    {
      "id": "a-signal",
      "claim": "Homework lets teachers and parents see where a student is struggling.",
      "impact": "Problems get caught and fixed earlier.",
      "candidates": [
        { "id": "c1", "text": "Work done alone reveals gaps that in-class group work can hide.", "material": "reasoning", "verdict": "fits", "explanation": "Links homework to early detection." },
        { "id": "c2", "text": "Teachers report using homework patterns to flag students who need help.", "material": "evidence", "verdict": "fits", "explanation": "Evidence for the early-intervention impact." },
        { "id": "c3", "text": "Report cards are usually issued four times a year.", "material": "evidence", "verdict": "great-but-wrong", "explanation": "A real fact about grading cadence, not about homework as a signal." },
        { "id": "c4", "text": "Homework is often graded for points.", "material": "reasoning", "verdict": "doesnt-fit", "explanation": "About grading, not about spotting struggles." }
      ]
    }
  ]
}
```

For `m-school-uniforms` AGAINST (arguing against uniforms) and `m-phones-in-school` AGAINST (arguing for allowing phones), author 3 claims each of the identical structure (ids like `a-expression`/`a-cost`/`a-ineffective` and `a-learning`/`a-safety`/`a-responsibility` respectively — your wording), each with the 4-candidate c1..c4 pattern and satisfying the invariant. Keep `great-but-wrong` traps genuinely tempting.

- [ ] **Step 4: Run the tests to verify they PASS**

Run: `npm test -- tests/lib/flowMotions.test.ts && npx tsc --noEmit`
Expected: PASS — both invariant tests green across all 4 motions × both sides; the JSON is valid so the import-time `FlowMotionsFileSchema.parse` doesn't throw; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add content/flow-motions.json tests/lib/flowMotions.test.ts
git commit -m "content: author AGAINST claims for all motions; invariant covers both sides"
```

---

### Task 2: FlowShell — completion states, side-switch, side-aware pills

**Files:**
- Modify: `components/FlowShell.tsx`
- Modify: `tests/components/FlowShell.test.tsx`

**Interfaces:**
- Consumes: `useFlowProgress`, `motion.sides[progress.side].claims`, the reused stages, `FLOW_STORAGE_KEY` (in the test).
- Produces: a `FlowShell` that renders the FOR pass, a FOR-done panel with a switch button, the AGAINST pass (starting at Claim), and a both-sides-complete final panel.

- [ ] **Step 1: Add the failing tests** — edit `tests/components/FlowShell.test.tsx`.

First, ensure the test fixture `motion` has AGAINST claims (add a `sides.against.claims` array with at least one claim if it's currently `[]`). Use this AGAINST block for the fixture's `against` (mirrors the fixture's FOR claim shape):

```ts
against: {
  claims: [
    { id: "a-maturity", claim: "Kids lack the experience to weigh trade-offs.", impact: "Worse decisions.", candidates: [
      { id: "e1", text: "Judgment keeps developing.", material: "evidence", verdict: "fits", explanation: "x" },
      { id: "r1", text: "Trade-offs need context.", material: "reasoning", verdict: "fits", explanation: "x" },
      { id: "gbw", text: "A prize was won on voting math.", material: "evidence", verdict: "great-but-wrong", explanation: "x" },
    ] },
  ],
},
```

Add these two tests (import `FLOW_STORAGE_KEY` from `@/lib/state/flowProgress` at the top if not already imported):

```tsx
it("offers a switch to the AGAINST side once FOR is complete, landing on the AGAINST Claim stage", async () => {
  localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({
    [motion.id]: { side: "for", stage: "impact", readSubstep: "restate", restate: "x",
      keywordAnswers: {}, mappedClaimId: "c-stake", impact: "y", forComplete: true, againstComplete: false },
  }));
  render(<FlowShell motion={motion} onExit={() => {}} />);
  const switchBtn = await screen.findByRole("button", { name: /argue the other side/i });
  await userEvent.click(switchBtn);
  // Now on the AGAINST Claim stage — its prompt asks for a claim "against" the motion.
  expect(await screen.findByText(/against this motion/i)).toBeInTheDocument();
});

it("shows a both-sides-complete closure once AGAINST is also done", async () => {
  localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({
    [motion.id]: { side: "against", stage: "impact", readSubstep: "restate", restate: "x",
      keywordAnswers: {}, mappedClaimId: "a-maturity", impact: "z", forComplete: true, againstComplete: true },
  }));
  const onExit = vi.fn();
  render(<FlowShell motion={motion} onExit={onExit} />);
  expect(await screen.findByText(/argued both sides/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /back to motions/i }));
  expect(onExit).toHaveBeenCalled();
});
```

(The fixture's FOR claim id must be `c-stake` to match the first test's pre-seed; if the existing fixture uses a different FOR id, use that id in the pre-seed instead — the switch resets `mappedClaimId` to null anyway, so it only needs to be a valid FOR claim for the pre-seed to pass `isValidEntry`.)

- [ ] **Step 2: Run the tests to verify they FAIL**

Run: `npm test -- tests/components/FlowShell.test.tsx`
Expected: FAIL — there is no "argue the other side" button (the current FOR-complete panel only has "back to motions"), and no "argued both sides" closure.

- [ ] **Step 3: Rewrite the completion/pills logic in `components/FlowShell.tsx`**

Replace the pills block (the two `<span>`s inside the header `<div style={{ display: "flex", gap: 6 }}>`) with side-aware pills:

```tsx
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 11, padding: "5px 12px", borderRadius: 999,
              background: progress.side === "for" ? "rgba(200,150,46,.16)" : "transparent",
              border: `1px solid ${progress.side === "for" ? "var(--gold)" : "#24344f"}`,
              color: progress.side === "for" ? "var(--gold)" : "#4a5a6f", fontWeight: 700 }}>
              {progress.forComplete ? "✓ FOR" : "FOR"}
            </span>
            <span style={{ fontSize: 11, padding: "5px 12px", borderRadius: 999,
              background: progress.side === "against" ? "rgba(200,150,46,.16)" : "transparent",
              border: `1px solid ${progress.side === "against" ? "var(--gold)" : "#24344f"}`,
              color: progress.side === "against" ? "var(--gold)" : "#4a5a6f", fontWeight: 700 }}>
              {progress.againstComplete ? "✓ AGAINST" : progress.forComplete ? "AGAINST" : "🔒 AGAINST · soon"}
            </span>
          </div>
```

Replace the completion short-circuit (the `{progress.side === "for" && progress.forComplete ? ( ... ) : ( <> ...stages... </> )}` block) with a three-way version. Keep the `<>...stages...</>` else-branch exactly as it is today:

```tsx
            {progress.forComplete && progress.againstComplete ? (
              <div>
                <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "var(--gold)" }}>Complete</div>
                <p style={{ fontSize: 17, color: "#fff", margin: "6px 0 14px" }}>
                  You&apos;ve argued both sides of this motion — FOR and AGAINST. 🎉
                </p>
                <button type="button" onClick={onExit}>← back to motions</button>
              </div>
            ) : progress.side === "for" && progress.forComplete ? (
              <div>
                <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "var(--gold)" }}>FOR side complete</div>
                <p style={{ fontSize: 17, color: "#fff", margin: "6px 0 14px" }}>
                  Nice — you built the FOR case: claim, link, and impact. Now flip it and argue the other side.
                </p>
                <button type="button" onClick={() => update({ side: "against", stage: "claim", mappedClaimId: null, impact: "" })}>
                  Now argue the other side →
                </button>
                <button type="button" onClick={onExit} style={{ marginLeft: 10 }}>← back to motions</button>
              </div>
            ) : (
              <>
                {/* the existing stage conditionals (read/restate, read/keyword, claim, link, impact) — UNCHANGED */}
              </>
            )}
```

Leave the five stage-conditional blocks inside the `<>...</>` exactly as they are (including the existing `impact` `onComplete` that sets `forComplete`/`againstComplete` per side). No other change to `FlowShell`.

- [ ] **Step 4: Run the tests to verify they PASS**

Run: `npm test -- tests/components/FlowShell.test.tsx`
Expected: PASS — the switch button appears on the FOR-complete panel and clicking it lands on the AGAINST Claim stage (prompt contains "against this motion"); the both-complete state shows the "argued both sides" closure and back-to-motions calls `onExit`. The pre-existing tests (pins motion, AGAINST `🔒` on a fresh motion, Restate→Keywords) still pass — a fresh motion has `forComplete:false`, so the AGAINST pill still shows `🔒 AGAINST · soon`.

- [ ] **Step 5: Run the full suite, tsc, and build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: full suite PASS; tsc clean; `next build` succeeds (routes unchanged: `/`, `/motions` redirect, `/link` redirect, `/gate`, api routes).

- [ ] **Step 6: Commit**

```bash
git add components/FlowShell.tsx tests/components/FlowShell.test.tsx
git commit -m "feat: FOR->AGAINST side switch, both-sides closure, side-aware pills"
```

---

## Manual verification (after Task 2)

Not automated — do once with the app running (`npm run dev`, authed, real coach key):

1. Open a motion, complete the FOR side (Read → Claim → Link → Impact). The FOR-done panel shows "Now argue the other side →"; the AGAINST pill has unlocked (no `🔒`).
2. Click it → land on the AGAINST **Claim** stage (Read is not repeated; the rail shows Read complete); the claim prompt says "against this motion" and the coach maps to an AGAINST claim.
3. Complete AGAINST Link + Impact → the "argued both sides 🎉" closure shows; "← back to motions" returns to the deck.
4. Reload mid-AGAINST → resumes on the AGAINST side at the saved stage.
5. Confirm the FOR/AGAINST pills track the active side (gold) and show ✓ for a completed side.

---

## Self-Review

**Spec coverage:**
- 3 AGAINST claims per motion, same winnability invariant → Task 1. ✓
- Invariant test extended to both sides → Task 1 (Steps 1–4). ✓
- Switch = `update({side:"against",stage:"claim",mappedClaimId:null,impact:""})`; AGAINST jumps to Claim → Task 2 (Step 3 button). ✓
- Switch trigger = FOR-complete panel button; AGAINST pill unlocks on `forComplete` → Task 2. ✓
- Three completion states (both-done closure / FOR-done+switch / active stage) → Task 2 (Step 3). ✓
- Side-aware pills (active gold + ✓ on completion) → Task 2 (Step 3). ✓
- Reuse stages/coach/progress, no schema/key/coach change → confirmed: only content + FlowShell touched. ✓
- Testing (invariant both sides; FlowShell switch + closure) → Tasks 1, 2. ✓
- Non-goals (no per-side history, no other sub-projects) → respected. ✓

**Placeholder scan:** No TBD/TODO. Task 1 gives the exact AGAINST content for 2 of 4 motions and instructs authoring the other 2 to the identical, invariant-guarded shape (the Task-1 test enforces it). Every code step shows complete code. ✓

**Type consistency:** `side`/`stage`/`mappedClaimId`/`impact`/`forComplete`/`againstComplete` match the existing `FlowProgress`; the switch update and completion predicates use those exact fields; `FLOW_STORAGE_KEY` and the reused stage props match the shipped signatures; AGAINST claim/candidate shape matches `FlowClaim`/`LinkCandidate`. ✓
