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

  it("disables Send while the textarea is empty or whitespace-only", async () => {
    render(<FeedbackPanelView open status="idle" onOpen={noop} onClose={noop} onSubmit={noop} />);
    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox"), "   ");
    expect(sendButton).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox"), "now real text");
    expect(sendButton).not.toBeDisabled();
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

  it("mounts the open panel inside an animated (spring) entrance wrapper", () => {
    render(<FeedbackPanelView open status="idle" onOpen={noop} onClose={noop} onSubmit={noop} />);
    const panel = screen.getByTestId("feedback-panel");
    // Framer Motion applies `initial` variant values synchronously as inline
    // style on mount, before the animation frame runs — a plain <div> would
    // carry no such style. This is our signal that entrance motion is wired.
    const style = panel.getAttribute("style") ?? "";
    expect(style).toContain("opacity");
  });

  it("keeps the mobile top offset that stops it covering the helper sheet", () => {
    render(<FeedbackPanelView open status="idle" onOpen={noop} onClose={noop} onSubmit={noop} />);
    const panel = screen.getByTestId("feedback-panel");
    expect(panel.className).toContain("top-4");
    expect(panel.className).toContain("sm:top-auto");
  });
});
