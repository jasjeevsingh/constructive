import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelperPanelView } from "@/components/helper/HelperPanel";
import { initialHelperState } from "@/lib/helper/agentMachine";

const base = initialHelperState();

describe("HelperPanelView", () => {
  it("shows a collapsed affordance when closed", () => {
    render(<HelperPanelView state={base} open={false} onOpen={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /talk it through/i })).toBeInTheDocument();
  });

  it("opens on click", async () => {
    const onOpen = vi.fn();
    render(<HelperPanelView state={base} open={false} onOpen={onOpen} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /talk it through/i }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("names each phase while open", () => {
    for (const [phase, label] of [
      ["listening", /listening/i],
      ["thinking", /thinking/i],
      ["speaking", /speaking/i],
      ["connecting", /connecting/i],
    ] as const) {
      const { unmount } = render(
        <HelperPanelView state={{ ...base, phase }} open onOpen={() => {}} onClose={() => {}} />
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders the conversation", () => {
    render(
      <HelperPanelView
        state={{ ...base, phase: "listening", turns: [
          { role: "student", text: "what makes a claim good" },
          { role: "helper", text: "what do you think it needs?" },
        ] }}
        open
        onOpen={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("what makes a claim good")).toBeInTheDocument();
    expect(screen.getByText("what do you think it needs?")).toBeInTheDocument();
  });

  it("explains itself instead of failing when the helper is unavailable", () => {
    render(
      <HelperPanelView
        state={{ ...base, phase: "error", error: "Voice helper is unavailable right now." }}
        open
        onOpen={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });

  it("offers a stop control while open", async () => {
    const onClose = vi.fn();
    render(<HelperPanelView state={{ ...base, phase: "listening" }} open onOpen={() => {}} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /stop|close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
