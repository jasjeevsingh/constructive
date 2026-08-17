import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LinkCard } from "@/components/LinkCard";
import type { LinkScenario } from "@/lib/schemas";
import { LINK_STORAGE_KEY } from "@/lib/state/linkProgress";

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

  it("names the missing material when only evidence is built", async () => {
    render(<LinkCard scenario={scenario} onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /build .*stress/i }));
    await userEvent.click(screen.getByRole("button", { name: /test the bridge/i }));
    expect(screen.queryByText(/bridge holds/i)).toBeNull();
    const summary = await screen.findByTestId("bridge-summary");
    expect(summary.textContent).toMatch(/reasoning/i);
  });

  it("changes its wording on a repeated failed attempt", async () => {
    render(<LinkCard scenario={scenario} onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /build .*stress/i }));
    await userEvent.click(screen.getByRole("button", { name: /test the bridge/i }));
    const first = screen.getByTestId("bridge-summary").textContent;
    await userEvent.click(screen.getByRole("button", { name: /test the bridge/i }));
    expect(screen.getByTestId("bridge-summary").textContent).not.toBe(first);
  });

  it("surfaces a coach reaction from 'talk this through' after testing", async () => {
    render(<LinkCard scenario={scenario} onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /build .*harvard/i }));
    await userEvent.click(screen.getByRole("button", { name: /test the bridge/i }));
    await userEvent.click(screen.getAllByRole("button", { name: /talk this through/i })[0]);
    expect(await screen.findByText(/tempting, but it argues the other way/i)).toBeInTheDocument();
  });

  it("restores a previously placed plank from localStorage on mount", async () => {
    localStorage.setItem(LINK_STORAGE_KEY, JSON.stringify({ [scenario.id]: { placedIds: ["e1"], held: false } }));
    render(<LinkCard scenario={scenario} onExit={() => {}} />);
    // e1 was placed → its toggle should now read "Set aside", found via aria-label.
    expect(await screen.findByRole("button", { name: /set aside .*stress/i })).toBeInTheDocument();
  });
});
