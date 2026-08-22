import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Lesson } from "@/components/Lesson";

describe("Lesson", () => {
  it("walks through Claim, Link, and Impact using the homework example", () => {
    render(<Lesson onBack={() => {}} />);
    expect(screen.getByRole("heading", { name: /claim.*link.*impact/i })).toBeInTheDocument();
    expect(
      screen.getAllByText(/homework takes up too much student free time/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/reasoning/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/evidence/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/impact without a bridge/i)).toBeInTheDocument();
  });

  it("returns to the deck via the back control", async () => {
    const onBack = vi.fn();
    render(<Lesson onBack={onBack} />);
    await userEvent.click(screen.getByRole("button", { name: /back to motions/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("offers a CTA back into practice at the end", async () => {
    const onBack = vi.fn();
    render(<Lesson onBack={onBack} />);
    await userEvent.click(screen.getByRole("button", { name: /pick a motion/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
