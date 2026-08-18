import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelperPanelView } from "@/components/helper/HelperPanel";
import { initialHelperState } from "@/lib/helper/agentMachine";

const base = initialHelperState();

const noop = () => {};

function renderView(overrides: Partial<React.ComponentProps<typeof HelperPanelView>> = {}) {
  return render(
    <HelperPanelView
      state={base}
      open={false}
      onOpen={noop}
      onClose={noop}
      inCall={false}
      sending={false}
      onSend={noop}
      onStartCall={noop}
      {...overrides}
    />
  );
}

describe("HelperPanelView — collapsed", () => {
  it("shows a collapsed affordance reading 'Talk it through' when closed", () => {
    renderView();
    expect(screen.getByText("💬 Talk it through")).toBeInTheDocument();
  });

  it("opens on click", async () => {
    const onOpen = vi.fn();
    renderView({ onOpen });
    await userEvent.click(screen.getByRole("button", { name: /talk it through/i }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("renders a disabled affordance with an explanation when closed and unavailable", () => {
    renderView({ state: { ...base, phase: "error", error: "Voice helper is unavailable right now." } });
    const button = screen.getByRole("button", { name: /talk it through/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });

  it("still shows the enabled affordance when closed with no error", () => {
    renderView();
    expect(screen.getByRole("button", { name: /talk it through/i })).toBeEnabled();
  });
});

describe("HelperPanelView — text chat (open, not in call)", () => {
  it("shows a textbox and both Send and Start voice call", () => {
    renderView({ open: true });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^send$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start voice call/i })).toBeInTheDocument();
  });

  it("disables Send when the textbox is empty", () => {
    renderView({ open: true });
    expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();
  });

  it("disables Send while whitespace-only", async () => {
    renderView({ open: true });
    await userEvent.type(screen.getByRole("textbox"), "   ");
    expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();
  });

  it("disables Send while sending", async () => {
    renderView({ open: true, sending: true });
    await userEvent.type(screen.getByRole("textbox"), "what makes a claim good");
    expect(screen.getByRole("button", { name: /^send$/i })).toBeDisabled();
  });

  it("shows a typing indicator while sending", () => {
    renderView({ open: true, sending: true });
    expect(screen.getByText(/sending/i)).toBeInTheDocument();
  });

  it("does not show a typing indicator when idle", () => {
    renderView({ open: true, sending: false });
    expect(screen.queryByText(/sending/i)).not.toBeInTheDocument();
  });

  it("calls onSend with the typed text", async () => {
    const onSend = vi.fn();
    renderView({ open: true, onSend });
    await userEvent.type(screen.getByRole("textbox"), "what makes a claim good");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));
    expect(onSend).toHaveBeenCalledWith("what makes a claim good");
  });

  it("calls onStartCall when Start voice call is pressed", async () => {
    const onStartCall = vi.fn();
    renderView({ open: true, onStartCall });
    await userEvent.click(screen.getByRole("button", { name: /start voice call/i }));
    expect(onStartCall).toHaveBeenCalled();
  });

  it("renders a thread with student and helper turns", () => {
    renderView({
      open: true,
      state: {
        ...base,
        turns: [
          { role: "student", text: "what makes a claim good" },
          { role: "helper", text: "what do you think it needs?" },
        ],
      },
    });
    expect(screen.getByText("what makes a claim good")).toBeInTheDocument();
    expect(screen.getByText("what do you think it needs?")).toBeInTheDocument();
  });

  it("preserves the typed text when a send fails", async () => {
    const onSend = vi.fn();
    const { rerender } = render(
      <HelperPanelView
        state={base}
        open
        onOpen={noop}
        onClose={noop}
        inCall={false}
        sending={false}
        onSend={onSend}
        onStartCall={noop}
      />
    );
    const textbox = screen.getByRole("textbox");
    await userEvent.type(textbox, "a paragraph I do not want to lose");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    // Simulate the wiring: a send begins...
    rerender(
      <HelperPanelView
        state={base}
        open
        onOpen={noop}
        onClose={noop}
        inCall={false}
        sending
        onSend={onSend}
        onStartCall={noop}
      />
    );
    // ...and then fails.
    rerender(
      <HelperPanelView
        state={{ ...base, error: "Couldn't reach the helper. Try again." }}
        open
        onOpen={noop}
        onClose={noop}
        inCall={false}
        sending={false}
        onSend={onSend}
        onStartCall={noop}
      />
    );

    expect(screen.getByRole("textbox")).toHaveValue("a paragraph I do not want to lose");
  });

  it("clears the typed text after a send succeeds", async () => {
    const onSend = vi.fn();
    const { rerender } = render(
      <HelperPanelView
        state={base}
        open
        onOpen={noop}
        onClose={noop}
        inCall={false}
        sending={false}
        onSend={onSend}
        onStartCall={noop}
      />
    );
    const textbox = screen.getByRole("textbox");
    await userEvent.type(textbox, "hello there");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    rerender(
      <HelperPanelView
        state={base}
        open
        onOpen={noop}
        onClose={noop}
        inCall={false}
        sending
        onSend={onSend}
        onStartCall={noop}
      />
    );
    rerender(
      <HelperPanelView
        state={{ ...base, turns: [{ role: "student", text: "hello there" }] }}
        open
        onOpen={noop}
        onClose={noop}
        inCall={false}
        sending={false}
        onSend={onSend}
        onStartCall={noop}
      />
    );

    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("offers a way to close the chat", async () => {
    const onClose = vi.fn();
    renderView({ open: true, onClose });
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("HelperPanelView — in a live call", () => {
  it("hides the composer but keeps the thread and offers End call", () => {
    renderView({
      open: true,
      inCall: true,
      state: {
        ...base,
        phase: "listening",
        turns: [
          { role: "student", text: "what makes a claim good" },
          { role: "helper", text: "what do you think it needs?" },
        ],
      },
    });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^send$/i })).not.toBeInTheDocument();
    expect(screen.getByText("what makes a claim good")).toBeInTheDocument();
    expect(screen.getByText("what do you think it needs?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /end call/i })).toBeInTheDocument();
  });

  it("ends the call on click", async () => {
    const onClose = vi.fn();
    renderView({ open: true, inCall: true, state: { ...base, phase: "listening" }, onClose });
    await userEvent.click(screen.getByRole("button", { name: /end call/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("names each phase while in a call", () => {
    for (const [phase, label] of [
      ["listening", /listening/i],
      ["thinking", /thinking/i],
      ["speaking", /speaking/i],
      ["connecting", /connecting/i],
    ] as const) {
      const { unmount } = renderView({ open: true, inCall: true, state: { ...base, phase } });
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("explains itself instead of failing when the helper is unavailable", () => {
    renderView({
      open: true,
      inCall: true,
      state: { ...base, phase: "error", error: "Voice helper is unavailable right now." },
    });
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });

  it("offers a retry control in the error phase", async () => {
    const onStartCall = vi.fn();
    renderView({
      open: true,
      inCall: true,
      state: { ...base, phase: "error", error: "The voice helper hit a problem." },
      onStartCall,
    });
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onStartCall).toHaveBeenCalled();
  });

  it("does not offer a retry control outside the error phase", () => {
    renderView({ open: true, inCall: true, state: { ...base, phase: "listening" } });
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("shows a paused state with a resume control after the idle guard closes the session", () => {
    renderView({ open: true, inCall: true, state: { ...base, phase: "idle" } });
    expect(screen.getByText(/paused/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resume/i })).toBeInTheDocument();
  });

  it("resumes on click", async () => {
    const onStartCall = vi.fn();
    renderView({ open: true, inCall: true, state: { ...base, phase: "idle" }, onStartCall });
    await userEvent.click(screen.getByRole("button", { name: /resume/i }));
    expect(onStartCall).toHaveBeenCalled();
  });

  it("does not show live phase text while paused", () => {
    renderView({ open: true, inCall: true, state: { ...base, phase: "idle" } });
    expect(screen.queryByText(/listening/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/connecting/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/speaking/i)).not.toBeInTheDocument();
  });

  it("offers a close control while paused", async () => {
    const onClose = vi.fn();
    renderView({ open: true, inCall: true, state: { ...base, phase: "idle" }, onClose });
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
