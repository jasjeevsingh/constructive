import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Lesson } from "@/components/Lesson";

const next = () => userEvent.click(screen.getByRole("button", { name: /^next/i }));
const panel = () => screen.getByTestId("see-it-in-action");
const litRows = () => within(panel()).queryAllByTestId("action-row-lit");
const dimRows = () => within(panel()).queryAllByTestId("action-row-dim");

describe("Lesson", () => {
  it("opens with the bridge illustration and the Claim step", () => {
    render(<Lesson onBack={() => {}} />);
    expect(screen.getByRole("img", { name: /^the bridge/i })).toHaveAttribute(
      "src",
      "/lesson/cli-bridge.jpg"
    );
    expect(screen.getByRole("heading", { name: /claim.*link.*impact/i })).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^claim/i })).toHaveAttribute("src", "/lesson/claim.jpg");
  });

  it("builds the homework example one row at a time in the See-it-in-action panel", async () => {
    render(<Lesson onBack={() => {}} />);
    expect(litRows()).toHaveLength(1);
    expect(dimRows()).toHaveLength(3);
    expect(within(panel()).getByText(/homework takes up too much student free time/i)).toBeInTheDocument();
    expect(within(panel()).getAllByText(/coming next/i)).toHaveLength(3);

    await next(); // Link · Reasoning
    expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
    expect(litRows()).toHaveLength(2);
    expect(within(panel()).getByText(/lose time for sleep/i)).toBeInTheDocument();

    await next(); // Link · Evidence
    expect(screen.getByText(/step 3 of 4/i)).toBeInTheDocument();
    expect(litRows()).toHaveLength(3);
    expect(within(panel()).getByText(/4,300/i)).toBeInTheDocument();

    await next(); // Impact
    expect(screen.getByText(/step 4 of 4/i)).toBeInTheDocument();
    expect(litRows()).toHaveLength(4);
    expect(dimRows()).toHaveLength(0);
    expect(within(panel()).getByText(/millions of students/i)).toBeInTheDocument();
  });

  it("swaps the section banner as you advance", async () => {
    render(<Lesson onBack={() => {}} />);
    await next();
    expect(screen.getByRole("img", { name: /link.*reasoning/i })).toHaveAttribute("src", "/lesson/link-reasoning.jpg");
    await next();
    expect(screen.getByRole("img", { name: /link.*evidence/i })).toHaveAttribute("src", "/lesson/link-evidence.jpg");
    await next();
    expect(screen.getByRole("img", { name: /^impact/i })).toHaveAttribute("src", "/lesson/impact.jpg");
  });

  it("never teaches fallacies inside the lesson", async () => {
    render(<Lesson onBack={() => {}} />);
    for (let i = 0; i < 4; i++) {
      expect(document.body.textContent).not.toMatch(/watch out|fallac|slippery slope|appeal to authority/i);
      if (i < 3) await next();
    }
  });

  it("lets you go back to a previous step and disables Previous on the first", async () => {
    render(<Lesson onBack={() => {}} />);
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    await next();
    expect(screen.getByText(/step 2 of 4/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /previous/i }));
    expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
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
    await next();
    await next();
    await next();
    await userEvent.click(screen.getByRole("button", { name: /pick a motion/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
