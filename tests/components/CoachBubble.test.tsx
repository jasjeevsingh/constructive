import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoachBubble } from "@/components/CoachBubble";

describe("CoachBubble", () => {
  it("renders its children text", () => {
    render(<CoachBubble>Nice restate.</CoachBubble>);
    expect(screen.getByText("Nice restate.")).toBeInTheDocument();
  });
});
