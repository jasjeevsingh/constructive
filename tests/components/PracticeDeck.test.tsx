import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PracticeDeck } from "@/components/PracticeDeck";

beforeEach(() => localStorage.clear());

describe("PracticeDeck", () => {
  it("renders the three drill cards", () => {
    render(<PracticeDeck onPick={() => {}} />);
    expect(screen.getByRole("button", { name: /practice claims/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /practice the link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /practice impacts/i })).toBeInTheDocument();
  });

  it("calls onPick with the chosen part", async () => {
    const onPick = vi.fn();
    render(<PracticeDeck onPick={onPick} />);
    await userEvent.click(screen.getByRole("button", { name: /practice the link/i }));
    expect(onPick).toHaveBeenCalledWith("link");
  });
});
