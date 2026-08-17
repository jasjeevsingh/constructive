import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BridgeScene } from "@/components/stages/BridgeScene";

const placed = [
  { id: "e1", material: "evidence" as const },
  { id: "r1", material: "reasoning" as const },
];

describe("BridgeScene", () => {
  it("renders one beam per placed plank", () => {
    render(<BridgeScene placed={placed} testResult={null} />);
    expect(screen.getAllByTestId("bridge-beam")).toHaveLength(2);
  });

  it("is decorative (aria-hidden) and shows no beams when empty", () => {
    render(<BridgeScene placed={[]} testResult={null} />);
    expect(screen.getByTestId("bridge-scene")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryAllByTestId("bridge-beam")).toHaveLength(0);
  });

  it("renders for held and failed results without crashing", () => {
    const { rerender } = render(<BridgeScene placed={placed} testResult="held" />);
    expect(screen.getByTestId("bridge-scene")).toBeInTheDocument();
    rerender(<BridgeScene placed={placed} testResult="failed" />);
    expect(screen.getByTestId("bridge-scene")).toBeInTheDocument();
    expect(screen.getAllByTestId("bridge-beam")).toHaveLength(2);
  });
});
