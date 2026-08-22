import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlowDeck } from "@/components/FlowDeck";
import { FLOW_STORAGE_KEY, emptyFlowProgress } from "@/lib/state/flowProgress";
import { getFlowMotions } from "@/lib/flowMotions";

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
    // Fresh motion → side picker first.
    await userEvent.click(screen.getByRole("button", { name: /argue for first/i }));
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

  it("gives motion cards a hover border and shadow lift", () => {
    render(<FlowDeck />);
    const card = screen.getByRole("button", { name: /let kids vote/i });
    expect(card.className).toContain("hover:border-primary");
    expect(card.className).toContain("hover:shadow-md");
  });

  it("opens the Claim/Link/Impact lesson from the home page and returns to the deck", async () => {
    render(<FlowDeck />);
    await userEvent.click(screen.getByRole("button", { name: /read the lesson/i }));
    expect(await screen.findByRole("heading", { name: /claim.*link.*impact/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /back to motions/i }));
    expect(await screen.findByRole("heading", { name: /pick a motion/i })).toBeInTheDocument();
  });

  it("refreshes the deck badge after returning from a motion completed during the journey", async () => {
    const motions = getFlowMotions();
    const motionId = motions[0].id;
    // Start out "in progress" so the deck shows a distinct initial badge.
    localStorage.setItem(
      FLOW_STORAGE_KEY,
      JSON.stringify({ [motionId]: { ...emptyFlowProgress("against"), stage: "claim" } })
    );
    render(<FlowDeck />);
    expect(await screen.findByText("In progress")).toBeInTheDocument();

    await userEvent.click(
      screen.getAllByRole("button", { name: new RegExp(motions[0].motion.slice(0, 20)) })[0]
    );
    // Now inside the journey (FlowShell). Simulate the journey completing the AGAINST side —
    // this is what useFlowProgress/saveFlowProgress would write as the student finishes.
    localStorage.setItem(
      FLOW_STORAGE_KEY,
      JSON.stringify({
        [motionId]: { ...emptyFlowProgress("against"), stage: "claim", againstComplete: true },
      })
    );
    // Exit back to the deck without a remount.
    await userEvent.click(screen.getByRole("button", { name: /Motions/ }));

    expect(await screen.findByText("1 side done")).toBeInTheDocument();
    expect(screen.queryByText("In progress")).toBeNull();
  });
});
