import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeywordStep } from "@/components/steps/KeywordStep";
import type { Motion } from "@/lib/schemas";

const motion: Motion = {
  id: "m",
  theme: "school",
  motion: "Schools should ban homework.",
  keywords: [{ word: "homework", hint: "assigned after-school work" }],
};

describe("KeywordStep", () => {
  it("shows a keyword's hint after tapping it", async () => {
    render(<KeywordStep motion={motion} onNext={() => {}} />);
    await userEvent.click(screen.getByText("homework"));
    expect(screen.getByText(/assigned after-school work/i)).toBeInTheDocument();
  });
});
