import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Lesson } from "@/components/Lesson";

describe("Lesson", () => {
  it("starts on the Claim step, using the homework example, without showing later steps yet", () => {
    render(<Lesson onBack={() => {}} />);
    expect(screen.getByRole("heading", { name: /claim.*link.*impact/i })).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/homework takes up too much student free time/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/impact without a bridge/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^next/i })).toBeInTheDocument();
  });

  it("reveals each step's content only after advancing to it", async () => {
    render(<Lesson onBack={() => {}} />);
    const next = () => userEvent.click(screen.getByRole("button", { name: /^next/i }));

    await next(); // -> Link, Reasoning
    expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
    expect(screen.getAllByText(/reasoning/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/appeal to authority/i)).not.toBeInTheDocument();

    await next(); // -> Link, Evidence
    expect(screen.getByText(/step 3 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/appeal to authority/i)).toBeInTheDocument();

    await next(); // -> Impact
    expect(screen.getByText(/step 4 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/impact without a bridge/i)).toBeInTheDocument();
  });

  it("lets you go back to a previous step", async () => {
    render(<Lesson onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /^next/i }));
    expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /previous/i }));
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
  });

  it("disables Previous on the first step", () => {
    render(<Lesson onBack={() => {}} />);
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  it("returns to the deck via the exit control from any step", async () => {
    const onBack = vi.fn();
    render(<Lesson onBack={onBack} />);
    await userEvent.click(screen.getByRole("button", { name: /back to motions/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("offers a CTA back into practice only at the end", async () => {
    const onBack = vi.fn();
    render(<Lesson onBack={onBack} />);
    expect(screen.queryByRole("button", { name: /pick a motion/i })).not.toBeInTheDocument();

    const next = () => userEvent.click(screen.getByRole("button", { name: /^next/i }));
    await next();
    await next();
    await next();

    await userEvent.click(screen.getByRole("button", { name: /pick a motion/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
