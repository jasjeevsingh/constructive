import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Bridge } from "@/components/stages/Bridge";
import type { LinkCandidate } from "@/lib/schemas";

const candidates: LinkCandidate[] = [
  { id: "e1", text: "Studies tie homework to stress.", material: "evidence", verdict: "fits", explanation: "x" },
  { id: "r1", text: "Frees evenings for family.", material: "reasoning", verdict: "fits", explanation: "y" },
];

function renderBridge(placedIds: string[]) {
  render(
    <Bridge
      claim="Ban homework."
      impact="More family time."
      candidates={candidates}
      placedIds={placedIds}
      grade={null}
      reactions={{}}
      coachError={{}}
      onToggle={() => {}}
      onTalkThrough={() => {}}
    />
  );
}

describe("Bridge", () => {
  it("renders the claim and impact piers", () => {
    renderBridge([]);
    expect(screen.getByText("Ban homework.")).toBeInTheDocument();
    expect(screen.getByText("More family time.")).toBeInTheDocument();
    expect(screen.getByText("Claim")).toBeInTheDocument();
    expect(screen.getByText("Impact")).toBeInTheDocument();
  });

  it("puts unplaced planks in the materials tray with a Build control", () => {
    renderBridge([]);
    expect(screen.getByRole("button", { name: /build .*stress/i })).toBeInTheDocument();
    expect(screen.getByText(/no planks yet/i)).toBeInTheDocument();
  });

  it("shows a placed plank in the span with a Set aside control", () => {
    renderBridge(["e1"]);
    expect(screen.getByRole("button", { name: /set aside .*stress/i })).toBeInTheDocument();
  });
});
