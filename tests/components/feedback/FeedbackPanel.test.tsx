import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackPanelView } from "@/components/feedback/FeedbackPanel";

const noop = () => {};

describe("FeedbackPanelView", () => {
  it("shows a collapsed trigger when closed", () => {
    render(<FeedbackPanelView open={false} status="idle" onOpen={noop} onClose={noop} onSubmit={noop} />);
    expect(screen.getByRole("button", { name: /user feedback/i })).toBeInTheDocument();
  });

  it("opens on click", async () => {
    const onOpen = vi.fn();
    render(<FeedbackPanelView open={false} status="idle" onOpen={onOpen} onClose={noop} onSubmit={noop} />);
    await userEvent.click(screen.getByRole("button", { name: /user feedback/i }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("cannot submit an empty report", async () => {
    const onSubmit = vi.fn();
    render(<FeedbackPanelView open status="idle" onOpen={noop} onClose={noop} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits what was typed", async () => {
    const onSubmit = vi.fn();
    render(<FeedbackPanelView open status="idle" onOpen={noop} onClose={noop} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole("textbox"), "the bridge never held");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSubmit).toHaveBeenCalledWith("the bridge never held");
  });

  it("tells the tester their screen is attached", () => {
    render(<FeedbackPanelView open status="idle" onOpen={noop} onClose={noop} onSubmit={noop} />);
    expect(screen.getByText(/screen/i)).toBeInTheDocument();
  });

  it("shows each status", () => {
    for (const [status, pattern] of [
      ["sending", /sending/i],
      ["sent", /thank/i],
      ["error", /couldn't send/i],
    ] as const) {
      const { unmount } = render(
        <FeedbackPanelView open status={status} onOpen={noop} onClose={noop} onSubmit={noop} />
      );
      expect(screen.getByText(pattern)).toBeInTheDocument();
      unmount();
    }
  });

  it("keeps the typed text when sending failed", async () => {
    render(<FeedbackPanelView open status="error" onOpen={noop} onClose={noop} onSubmit={noop} />);
    await userEvent.type(screen.getByRole("textbox"), "still here");
    expect(screen.getByRole("textbox")).toHaveValue("still here");
  });
});
