import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RestateStep } from "@/components/steps/RestateStep";

describe("RestateStep", () => {
  it("shows the motion and the restate prompt", () => {
    render(<RestateStep motion="This House would ban homework." initial="" onNext={() => {}} />);
    expect(screen.getByText("This House would ban homework.")).toBeInTheDocument();
    expect(screen.getByText(/say the motion in your own words/i)).toBeInTheDocument();
  });
});
