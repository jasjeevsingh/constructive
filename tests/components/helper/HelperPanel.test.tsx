import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelperPanel, HelperPanelView } from "@/components/helper/HelperPanel";
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

  it("mounts the open panel inside an animated (spring) entrance wrapper", () => {
    renderView({ open: true });
    const panel = screen.getByTestId("helper-panel");
    // Framer Motion applies `initial` variant values synchronously as inline
    // style on mount, before the animation frame runs — a plain <div> would
    // carry no such style. This is our signal that entrance motion is wired.
    const style = panel.getAttribute("style") ?? "";
    expect(style).toContain("opacity");
    expect(panel).toContainElement(screen.getByRole("textbox"));
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

  it("mounts the live-call panel inside an animated (spring) entrance wrapper", () => {
    renderView({ open: true, inCall: true, state: { ...base, phase: "listening" } });
    const panel = screen.getByTestId("helper-panel");
    const style = panel.getAttribute("style") ?? "";
    expect(style).toContain("opacity");
  });

  it("renders a helper turn inside its own rise-in wrapper as it arrives", () => {
    renderView({
      open: true,
      inCall: true,
      state: {
        ...base,
        phase: "listening",
        turns: [{ role: "helper", text: "what do you think it needs?" }],
      },
    });
    const bubble = screen.getByText("what do you think it needs?");
    // CoachBubble wraps helper turns in the Rise entrance primitive — the
    // ancestor carrying the animated `style` attribute is that wrapper, not
    // the panel's own spring wrapper (both apply, but this checks the inner one).
    const animatedAncestor = bubble.closest("[style]");
    expect(animatedAncestor).not.toBeNull();
    expect(animatedAncestor?.getAttribute("style") ?? "").toContain("opacity");
  });
});

// The two tests below drive the real wired `HelperPanel`, not the pure
// view — they exist to guard the exact guarantees the view can't see: that
// opening never touches the mic/socket, and that a send racing a call start
// can't lose a message.
describe("HelperPanel — wiring", () => {
  let getUserMediaMock: ReturnType<typeof vi.fn>;
  let audioContextMock: ReturnType<typeof vi.fn>;
  let originalMediaDevices: PropertyDescriptor | undefined;
  let originalAudioContext: unknown;

  beforeEach(() => {
    originalMediaDevices = Object.getOwnPropertyDescriptor(window.navigator, "mediaDevices");
    originalAudioContext = (window as unknown as { AudioContext?: unknown }).AudioContext;

    getUserMediaMock = vi.fn().mockResolvedValue({ getTracks: () => [] } as unknown as MediaStream);
    Object.defineProperty(window.navigator, "mediaDevices", {
      value: { getUserMedia: getUserMediaMock },
      configurable: true,
    });

    // A minimal stand-in — just enough that connect() (if it runs) doesn't
    // throw. Real Web Audio isn't available in jsdom.
    audioContextMock = vi.fn(() => ({
      createMediaStreamSource: () => ({ connect: () => {} }),
      createScriptProcessor: () => ({ connect: () => {}, disconnect: () => {}, onaudioprocess: null }),
      close: () => Promise.resolve(),
    }));
    (window as unknown as { AudioContext: unknown }).AudioContext = audioContextMock;
  });

  afterEach(() => {
    if (originalMediaDevices) {
      Object.defineProperty(window.navigator, "mediaDevices", originalMediaDevices);
    } else {
      delete (window.navigator as unknown as { mediaDevices?: unknown }).mediaDevices;
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = originalAudioContext;
    vi.unstubAllGlobals();
  });

  it("never touches the mic, a socket, or fetch just by opening", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/deepgram/token") return { ok: true, json: async () => ({}) } as Response;
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HelperPanel />);
    // Let the mount-time availability probe (a plain GET, no token minted)
    // settle before measuring what opening itself does.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fetchMock.mockClear();

    await userEvent.click(screen.getByRole("button", { name: /talk it through/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getUserMediaMock).not.toHaveBeenCalled();
    expect(audioContextMock).not.toHaveBeenCalled();
  });

  it("does not lose a message whose reply resolves while a call is starting", async () => {
    let resolveHelperFetch: (value: unknown) => void = () => {};
    const helperFetchPromise = new Promise((resolve) => {
      resolveHelperFetch = resolve;
    });

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/deepgram/token") {
        if (init?.method === "POST") {
          // No token minted — a real connect attempt fails fast and
          // harmlessly, without needing a fake socket.
          return { ok: false, json: async () => ({}) } as Response;
        }
        return { ok: true, json: async () => ({}) } as Response;
      }
      if (url === "/api/helper") return helperFetchPromise as Promise<Response>;
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HelperPanel />);
    await userEvent.click(screen.getByRole("button", { name: /talk it through/i }));
    await userEvent.type(screen.getByRole("textbox"), "what makes a claim good");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    // The send is now in flight (sending === true). Attempt to escalate
    // before it resolves — this is the race: Start voice call must be
    // inert right now, not snapshot a stale `turns`.
    await userEvent.click(screen.getByRole("button", { name: /start voice call/i }));

    resolveHelperFetch({ ok: true, json: async () => ({ reply: "what do you think it needs?" }) });

    // If the race had been lost, a call would now be live on a stale
    // snapshot and this reply — appended to `turns`, not the session's
    // state — would never reach the screen.
    await waitFor(() => expect(screen.getByText("what do you think it needs?")).toBeInTheDocument());
    expect(screen.getByText("what makes a claim good")).toBeInTheDocument();

    // Now actually start a call (no send in flight) and end it, to prove
    // the end-of-call merge itself doesn't drop turns that are legitimately
    // part of the up-to-date snapshot.
    await userEvent.click(screen.getByRole("button", { name: /start voice call/i }));
    await userEvent.click(await screen.findByRole("button", { name: /end call/i }));

    expect(screen.getByText("what makes a claim good")).toBeInTheDocument();
    expect(screen.getByText("what do you think it needs?")).toBeInTheDocument();
  });
});
