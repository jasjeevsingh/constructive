import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FallacyCard } from "@/components/FallacyCard";
import { FALLACY_IDS, FALLACIES, isFallacyId, renderFallacyList } from "@/lib/fallacies";

describe("fallacies", () => {
  it("ships the eight retreat cards with ad hominem as the only red card", () => {
    expect(FALLACY_IDS).toHaveLength(8);
    expect(FALLACY_IDS.filter((id) => FALLACIES[id].card === "red")).toEqual(["ad-hominem"]);
  });
  it("recognises only known ids", () => {
    expect(isFallacyId("straw-man")).toBe(true);
    expect(isFallacyId("red-herring")).toBe(false);
    expect(isFallacyId(null)).toBe(false);
  });
  it("renders one line per fallacy for prompts", () => {
    const list = renderFallacyList();
    for (const id of FALLACY_IDS) expect(list).toContain(`- ${id}:`);
  });
});

describe("FallacyCard", () => {
  it("renders the name, definition, and example of a yellow card", () => {
    render(<FallacyCard id="straw-man" />);
    const card = screen.getByTestId("fallacy-card");
    expect(card).toHaveAttribute("data-fallacy", "straw-man");
    expect(screen.getByText("Straw Man")).toBeInTheDocument();
    expect(screen.getByText(/changed what they said/i)).toBeInTheDocument();
    expect(screen.getByText(/sit around doing nothing/i)).toBeInTheDocument();
    expect(screen.getByText(/yellow card/i)).toBeInTheDocument();
  });
  it("renders ad hominem as a red card", () => {
    render(<FallacyCard id="ad-hominem" />);
    expect(screen.getByText(/red card/i)).toBeInTheDocument();
    expect(screen.getByRole("note", { name: /ad hominem fallacy card/i })).toBeInTheDocument();
  });
  it("renders nothing for an unknown id", () => {
    render(<FallacyCard id="made-up" />);
    expect(screen.queryByTestId("fallacy-card")).toBeNull();
  });
});
