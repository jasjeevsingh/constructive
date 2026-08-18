import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
  it("pins the motion, starts on Read/Restate, and locks AGAINST", () => {
    render(<FlowShell motion={motion} onExit={() => {}} />);
    expect(screen.getAllByText(/let kids vote/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/your own words/i)).toBeInTheDocument();
    // AGAINST shown locked.
    expect(screen.getByText(/against/i)).toBeInTheDocument();
    expect(screen.getByText(/🔒/)).toBeInTheDocument();
  });

  it("advances Restate → Keywords within the Read stage", async () => {
    render(<FlowShell motion={motion} onExit={() => {}} />);
    await userEvent.type(screen.getByRole("textbox"), "kids should get a say");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    await userEvent.click(await screen.findByRole("button", { name: /next: keywords/i }));
    // Keyword stage renders the clickable motion (the gold keyword "kids").
    expect(await screen.findByText("kids")).toBeInTheDocument();
  });

  it("shows a completion state (not the Impact input) once the FOR side is complete", async () => {
    localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({
      [motion.id]: { side: "for", stage: "impact", readSubstep: "restate", restate: "x",
        keywordAnswers: {}, mappedClaimId: "c-stake", impact: "y", forComplete: true, againstComplete: false },
    }));
    const onExit = vi.fn();
    render(<FlowShell motion={motion} onExit={onExit} />);
    expect(await screen.findByText(/built the for case/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /back to motions/i }));
    expect(onExit).toHaveBeenCalled();
  });

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
});
