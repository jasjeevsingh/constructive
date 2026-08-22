import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Landing } from "@/components/Landing";

describe("Landing", () => {
  it("renders the hero and the Claim → Link → Impact strip", () => {
    render(<Landing onOpenLesson={() => {}} />);
    expect(screen.getByRole("heading", { name: /build an argument/i })).toBeInTheDocument();
    expect(screen.getByText("Claim")).toBeInTheDocument();
    expect(screen.getByText("Link")).toBeInTheDocument();
    expect(screen.getByText("Impact")).toBeInTheDocument();
    expect(screen.getByText("evidence")).toBeInTheDocument();
    expect(screen.getByText("reasoning")).toBeInTheDocument();
  });

  it("offers a way into the Claim/Link/Impact lesson before practice", async () => {
    const onOpenLesson = vi.fn();
    render(<Landing onOpenLesson={onOpenLesson} />);
    await userEvent.click(screen.getByRole("button", { name: /read the lesson/i }));
    expect(onOpenLesson).toHaveBeenCalled();
  });
});
