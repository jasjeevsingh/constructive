import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlowDeck } from "@/components/FlowDeck";
import { FLOW_STORAGE_KEY } from "@/lib/state/flowProgress";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ kind: "restate", reaction: "ok", capturedCore: true }), { status: 200 })));
});

describe("FlowDeck", () => {
  it("renders the landing, the CLI strip, and a card per motion", () => {
    render(<FlowDeck />);
    expect(screen.getByRole("heading", { name: /build an argument/i })).toBeInTheDocument();
    expect(screen.getByText("Claim")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /pick a motion/i })).toBeInTheDocument();
    // The kids-vote motion is in the real bank; its card is an accessible button.
    expect(screen.getByRole("button", { name: /let kids vote/i })).toBeInTheDocument();
  });

  it("opens the journey when a motion card is clicked", async () => {
    render(<FlowDeck />);
    await userEvent.click(screen.getByRole("button", { name: /let kids vote/i }));
    // FlowShell → RestateStep prompt.
    expect(await screen.findByText(/your own words/i)).toBeInTheDocument();
  });

  it("shows the completed badge for a finished motion (hydrated from localStorage)", async () => {
    localStorage.setItem(
      FLOW_STORAGE_KEY,
      JSON.stringify({
        "m-kids-vote": {
          side: "against", stage: "impact", readSubstep: "restate", restate: "x",
          keywordAnswers: {}, mappedClaimId: "a-maturity", impact: "y",
          forComplete: true, againstComplete: true,
        },
      })
    );
    render(<FlowDeck />);
    expect(await screen.findByText(/both sides/i)).toBeInTheDocument();
  });

  it("opens a practice drill when a Practice card is clicked", async () => {
    render(<FlowDeck />);
    await userEvent.click(screen.getByRole("button", { name: /practice impacts/i }));
    expect(screen.getByText(/so what\? why does this claim matter/i)).toBeInTheDocument();
  });
});
