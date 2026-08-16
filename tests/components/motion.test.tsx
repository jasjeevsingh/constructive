import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Rise, Pressable } from "@/components/ui/motion";

describe("motion primitives", () => {
  it("Rise renders its children", () => {
    render(<Rise>hello rise</Rise>);
    expect(screen.getByText("hello rise")).toBeInTheDocument();
  });

  it("Pressable renders a button that fires onClick", async () => {
    const onClick = vi.fn();
    render(<Pressable onClick={onClick}>press me</Pressable>);
    await userEvent.click(screen.getByRole("button", { name: /press me/i }));
    expect(onClick).toHaveBeenCalled();
  });
});
