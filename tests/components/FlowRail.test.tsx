import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlowRail } from "@/components/FlowRail";

describe("FlowRail", () => {
  it("renders the three stage labels and a progress bar, with no Read stage", () => {
    render(<FlowRail stage="link" />);
    // Labels appear (once each in the visible variant, but both variants render in DOM).
    expect(screen.getAllByText("Claim").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Link").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Impact").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/read the motion/i)).toBeNull();
    expect(screen.getAllByRole("progressbar").length).toBeGreaterThanOrEqual(1);
  });

  it("marks completed stages with a check", () => {
    render(<FlowRail stage="link" />);
    // "Claim" is before "link" → done → shows a check glyph.
    expect(screen.getAllByText("✓").length).toBeGreaterThanOrEqual(1);
  });

  it("lets you click a completed stage to revisit it", async () => {
    const onSelect = vi.fn();
    render(<FlowRail stage="link" onSelect={onSelect} />);
    const buttons = screen.getAllByRole("button", { name: /claim$/i });
    await userEvent.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledWith("claim");
  });

  it("does not make the current or an upcoming stage clickable", () => {
    render(<FlowRail stage="claim" onSelect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /claim$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /link$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /impact$/i })).toBeNull();
  });

  it("renders extra content under the steps", () => {
    render(
      <FlowRail stage="claim">
        <div data-testid="rail-extra">cheat sheet</div>
      </FlowRail>
    );
    expect(screen.getAllByTestId("rail-extra").length).toBeGreaterThanOrEqual(1);
  });
});
