import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlowShell } from "@/components/FlowShell";
import { FLOW_STORAGE_KEY, emptyFlowProgress } from "@/lib/state/flowProgress";
import type { FlowMotion } from "@/lib/schemas";
import type { FlowProgress } from "@/lib/state/flowProgress";
import type { Side } from "@/lib/state/flowMachine";

const motion: FlowMotion = {
  id: "m-kids-vote",
  motion: "This House would let kids vote.",
  keywords: [{ word: "kids", hint: null }],
  sides: {
    for: {
      claims: [
        { id: "c-stake", claim: "Kids deserve a say.", impact: "Better future.", candidates: [
          { id: "e1", text: "Studies tie voting to engagement.", material: "evidence", verdict: "fits", explanation: "x" },
          { id: "r1", text: "Politicians chase youth votes.", material: "reasoning", verdict: "fits", explanation: "x" },
          { id: "gbw", text: "A Nobel was won on voting theory.", material: "evidence", verdict: "great-but-wrong", explanation: "x" },
        ] },
      ],
    },
    against: {
      claims: [
        { id: "a-maturity", claim: "Kids lack the experience to weigh trade-offs.", impact: "Worse decisions.", candidates: [
          { id: "e1", text: "Judgment keeps developing.", material: "evidence", verdict: "fits", explanation: "x" },
          { id: "r1", text: "Trade-offs need context.", material: "reasoning", verdict: "fits", explanation: "x" },
          { id: "gbw", text: "A prize was won on voting math.", material: "evidence", verdict: "great-but-wrong", explanation: "x" },
        ] },
      ],
    },
  },
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify({ kind: "restate", reaction: "Good.", capturedCore: true }), { status: 200 })
  ));
});

function seedProgress(motionId: string, overrides: Partial<FlowProgress> & { side: Side }) {
  localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({
    [motionId]: { ...emptyFlowProgress(overrides.side), ...overrides },
  }));
}

describe("FlowShell", () => {
  it("pins the motion, starts on Claim, and locks AGAINST", () => {
    render(<FlowShell motion={motion} onExit={() => {}} />);
    expect(screen.getAllByText(/let kids vote/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/strongest claim for/i)).toBeInTheDocument();
    expect(screen.queryByText(/your own words/i)).toBeNull();
    // AGAINST shown locked.
    expect(screen.getByText(/against/i)).toBeInTheDocument();
    expect(screen.getByText(/🔒/)).toBeInTheDocument();
  });

  it("hides the key-terms strip when no keyword needs defining", () => {
    render(<FlowShell motion={motion} onExit={() => {}} />);
    expect(screen.queryByTestId("key-terms-strip")).toBeNull();
  });

  it("offers an optional key-terms strip above Claim when a keyword has a hint", async () => {
    const ambiguous: FlowMotion = { ...motion, keywords: [{ word: "kids", hint: "Age 5 or 17?" }] };
    render(<FlowShell motion={ambiguous} onExit={() => {}} />);
    expect(screen.getByTestId("key-terms-strip")).toBeInTheDocument();
    // The Claim input is available right away — defining a term never blocks it.
    expect(screen.getByText(/strongest claim for/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "kids" }));
    expect(screen.getByText(/age 5 or 17/i)).toBeInTheDocument();
  });

  it("shows the CLI quick reference in the rail, highlighting the current stage", () => {
    render(<FlowShell motion={motion} onExit={() => {}} />);
    const sheets = screen.getAllByTestId("cli-cheatsheet");
    expect(sheets.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("cheatsheet-current")[0]).toHaveTextContent(/^Claim/);
  });

  it("shows a completion state (not the Impact input) once the FOR side is complete", async () => {
    localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({
      [motion.id]: { side: "for", stage: "impact",         keywordAnswers: {}, mappedClaimId: "c-stake", impact: "y", forComplete: true, againstComplete: false },
    }));
    const onExit = vi.fn();
    render(<FlowShell motion={motion} onExit={onExit} />);
    expect(await screen.findByText(/built the for case/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /back to motions/i }));
    expect(onExit).toHaveBeenCalled();
  });

  it("offers a switch to the AGAINST side once FOR is complete, landing on the AGAINST Claim stage", async () => {
    localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({
      [motion.id]: { side: "for", stage: "impact",         keywordAnswers: {}, mappedClaimId: "c-stake", impact: "y", forComplete: true, againstComplete: false },
    }));
    render(<FlowShell motion={motion} onExit={() => {}} />);
    const switchBtn = await screen.findByRole("button", { name: /argue the other side/i });
    await userEvent.click(switchBtn);
    // Now on the AGAINST Claim stage — its prompt asks for a claim "against" the motion.
    expect(await screen.findByText(/against this motion/i)).toBeInTheDocument();
  });

  it("shows a both-sides-complete closure once AGAINST is also done", async () => {
    localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({
      [motion.id]: { side: "against", stage: "impact",         keywordAnswers: {}, mappedClaimId: "a-maturity", impact: "z", forComplete: true, againstComplete: true },
    }));
    const onExit = vi.fn();
    render(<FlowShell motion={motion} onExit={onExit} />);
    expect(await screen.findByText(/argued both sides/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /back to motions/i }));
    expect(onExit).toHaveBeenCalled();
  });

  it("carries a celebration in the both-sides-complete panel", async () => {
    localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({
      [motion.id]: { side: "against", stage: "impact",         keywordAnswers: {}, mappedClaimId: "a-maturity", impact: "z", forComplete: true, againstComplete: true },
    }));
    render(<FlowShell motion={motion} onExit={() => {}} />);
    expect(await screen.findByTestId("both-sides-celebration")).toBeInTheDocument();
  });

  it("does not show the both-sides celebration when only one side is complete", async () => {
    localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({
      [motion.id]: { side: "for", stage: "impact",         keywordAnswers: {}, mappedClaimId: "c-stake", impact: "y", forComplete: true, againstComplete: false },
    }));
    render(<FlowShell motion={motion} onExit={() => {}} />);
    await screen.findByText(/built the for case/i);
    expect(screen.queryByTestId("both-sides-celebration")).toBeNull();
  });

  it("keeps back-to-motions usable immediately alongside the both-sides celebration", async () => {
    localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({
      [motion.id]: { side: "against", stage: "impact",         keywordAnswers: {}, mappedClaimId: "a-maturity", impact: "z", forComplete: true, againstComplete: true },
    }));
    const onExit = vi.fn();
    render(<FlowShell motion={motion} onExit={onExit} />);
    await screen.findByTestId("both-sides-celebration");
    await userEvent.click(screen.getByRole("button", { name: /back to motions/i }));
    expect(onExit).toHaveBeenCalled();
  });

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

  it("offers the voice helper inside the journey", () => {
    render(<FlowShell motion={motion} onExit={() => {}} />);
    expect(screen.getByRole("button", { name: /talk it through/i })).toBeInTheDocument();
  });

  describe("revisiting a completed stage", () => {
    beforeEach(() => {
      seedProgress(motion.id, {
        side: "for",
        stage: "impact",
        mappedClaimId: "c-stake",
        impact: "y",
      });
    });

    it("shows a Claim recap without disturbing where you actually are", async () => {
      render(<FlowShell motion={motion} onExit={() => {}} />);
      const railButtons = await screen.findAllByRole("button", { name: /claim$/i });
      await userEvent.click(railButtons[0]);
      const back = await screen.findByRole("button", { name: /back to where you were/i });
      expect(screen.getByText(/revisiting a completed stage/i)).toBeInTheDocument();
      expect(screen.getAllByText("Kids deserve a say.").length).toBeGreaterThanOrEqual(1);

      await userEvent.click(back);
      expect(await screen.findByText(/say or type the impact/i)).toBeInTheDocument();

      const saved = JSON.parse(localStorage.getItem(FLOW_STORAGE_KEY)!)[motion.id];
      expect(saved.stage).toBe("impact");
    });

    it("shows a static recap of the mapped claim, not a live coach chat", async () => {
      render(<FlowShell motion={motion} onExit={() => {}} />);
      const railButtons = await screen.findAllByRole("button", { name: /claim$/i });
      await userEvent.click(railButtons[0]);
      expect(await screen.findByText("Kids deserve a say.")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    });

    it("reuses the interactive Link card, since its bridge state is already saved", async () => {
      render(<FlowShell motion={motion} onExit={() => {}} />);
      const railButtons = await screen.findAllByRole("button", { name: /link$/i });
      await userEvent.click(railButtons[0]);
      expect(await screen.findByRole("button", { name: /test the bridge/i })).toBeInTheDocument();
    });
  });

  describe("choice mode (seeded motions ship pick-the-best options)", () => {
    const seeded: FlowMotion = {
      ...motion,
      sides: {
        for: {
          ...motion.sides.for,
          claimChoices: [
            { id: "k-strong", text: "Kids deserve a say.", verdict: "strong", explanation: "Specific and contestable.", claimId: "c-stake" },
            { id: "k-broad", text: "Voting is important.", verdict: "too-broad", explanation: "A theme." },
            { id: "k-fact", text: "Kids are affected by laws.", verdict: "not-contestable", explanation: "A fact." },
            { id: "k-wrong", text: "Kids are too young.", verdict: "wrong-side", explanation: "Other side." },
          ],
          claims: [
            {
              ...motion.sides.for.claims[0],
              impactChoices: [
                { id: "i-strong", text: "Better future.", verdict: "strong", explanation: "Says what changes." },
                { id: "i-restate", text: "So kids get a say.", verdict: "restates-claim", explanation: "Repeats the claim." },
                { id: "i-other", text: "Teens practise civics.", verdict: "different-claim", explanation: "Different claim." },
                { id: "i-small", text: "A few kids feel included.", verdict: "no-scale", explanation: "Too small." },
              ],
            },
          ],
        },
        against: motion.sides.against,
      },
    };

    it("offers four claim options instead of a text box", () => {
      render(<FlowShell motion={seeded} onExit={() => {}} />);
      expect(screen.getAllByRole("radio")).toHaveLength(4);
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.getByText(/which is the strongest claim for/i)).toBeInTheDocument();
    });

    it("carries the strong claim into the Link stage", async () => {
      render(<FlowShell motion={seeded} onExit={() => {}} />);
      await userEvent.click(screen.getByRole("radio", { name: /deserve a say/i }));
      await userEvent.click(screen.getByRole("button", { name: /lock it in/i }));
      await userEvent.click(screen.getByRole("button", { name: /build the link/i }));
      expect(await screen.findByRole("button", { name: /test the bridge/i })).toBeInTheDocument();
      const saved = JSON.parse(localStorage.getItem(FLOW_STORAGE_KEY)!)[seeded.id];
      expect(saved).toMatchObject({ stage: "link", mappedClaimId: "c-stake" });
    });

    it("offers impact options for the strong claim and finishes the side with the chosen text", async () => {
      seedProgress(seeded.id, { side: "for", stage: "impact", mappedClaimId: "c-stake" });
      render(<FlowShell motion={seeded} onExit={() => {}} />);
      expect(await screen.findByText(/which impact shows why/i)).toBeInTheDocument();
      expect(screen.queryByRole("textbox")).toBeNull();
      await userEvent.click(screen.getByRole("radio", { name: /better future/i }));
      await userEvent.click(screen.getByRole("button", { name: /lock it in/i }));
      await userEvent.click(screen.getByRole("button", { name: /finish this side/i }));
      expect(await screen.findByText(/built the for case/i)).toBeInTheDocument();
      const saved = JSON.parse(localStorage.getItem(FLOW_STORAGE_KEY)!)[seeded.id];
      expect(saved).toMatchObject({ forComplete: true, impact: "Better future." });
    });

    it("falls back to open input on a side without choices (the AGAINST side here)", async () => {
      seedProgress(seeded.id, { side: "against", stage: "claim", forComplete: true });
      render(<FlowShell motion={seeded} onExit={() => {}} />);
      expect(await screen.findByText(/strongest claim against/i)).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.queryAllByRole("radio")).toHaveLength(0);
    });
  });
});
