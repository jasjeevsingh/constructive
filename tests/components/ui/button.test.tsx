import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders a real button with its accessible name", () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.className).toContain("bg-primary");
  });
  it("supports asChild to render a link styled as a button", () => {
    render(
      <Button asChild>
        <a href="/x">Go</a>
      </Button>
    );
    expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute("href", "/x");
  });

  it("gives every button a hover lift that respects reduced motion", () => {
    render(<Button>Go</Button>);
    const cls = screen.getByRole("button").className;
    // jsdom can't evaluate :hover; assert the primitive carries the classes.
    expect(cls).toContain("hover:-translate-y-px");
    expect(cls).toContain("active:translate-y-0");
    expect(cls).toContain("motion-reduce:transform-none");
  });
});
