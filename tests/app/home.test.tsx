import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home hub", () => {
  it("links to both live activities", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: /motion reader/i })).toHaveAttribute("href", "/motions");
    expect(screen.getByRole("link", { name: /link builder/i })).toHaveAttribute("href", "/link");
  });

  it("shows the Avatar as coming soon (not a link)", () => {
    render(<Home />);
    expect(screen.queryByRole("link", { name: /avatar/i })).toBeNull();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });
});
