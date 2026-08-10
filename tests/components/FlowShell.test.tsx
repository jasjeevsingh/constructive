import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlowShell } from "@/components/FlowShell";
import type { FlowMotion } from "@/lib/schemas";

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
    against: { claims: [] },
  },
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify({ kind: "restate", reaction: "Good.", capturedCore: true }), { status: 200 })
  ));
});

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
});
