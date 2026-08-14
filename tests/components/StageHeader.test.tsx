import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageHeader } from "@/components/stages/StageHeader";

describe("StageHeader", () => {
  it("renders the eyebrow", () => {
    render(<StageHeader eyebrow="Stage 3 · Link" />);
    expect(screen.getByText("Stage 3 · Link")).toBeInTheDocument();
  });

  it("renders the optional prompt when given", () => {
    render(<StageHeader eyebrow="Stage 2 · Claim" prompt="What is your claim?" />);
    expect(screen.getByText("What is your claim?")).toBeInTheDocument();
  });
});
