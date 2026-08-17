import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";

describe("VoiceOrTextInput", () => {
  beforeEach(() => {
    // No media support in jsdom → text-only fallback path.
    // @ts-expect-error force undefined for the test
    global.navigator.mediaDevices = undefined;
  });

  it("submits typed text via the fallback", async () => {
    const onSubmit = vi.fn();
    render(<VoiceOrTextInput label="Restate the motion" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole("textbox"), "kids should vote");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith("kids should vote");
  });

  it("hides the mic button when voice is unsupported", () => {
    render(<VoiceOrTextInput label="Restate the motion" onSubmit={() => {}} />);
    expect(screen.queryByRole("button", { name: /talk/i })).toBeNull();
  });

  it("shows the label", () => {
    render(<VoiceOrTextInput label="Restate the motion" onSubmit={() => {}} />);
    expect(screen.getByText("Restate the motion")).toBeInTheDocument();
  });
});

describe("VoiceOrTextInput hold-to-talk", () => {
  function stubMedia() {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    // @ts-expect-error partial stub is enough for this component
    global.navigator.mediaDevices = { getUserMedia: vi.fn(async () => stream) };

    class FakeRecorder {
      state = "recording";
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {}
      stop() {
        this.state = "inactive";
        this.onstop?.();
      }
    }
    // @ts-expect-error partial stub
    global.MediaRecorder = FakeRecorder;
    global.MediaRecorder.isTypeSupported = () => true;
  }

  beforeEach(() => {
    stubMedia();
    // jsdom has no pointer capture
    Element.prototype.setPointerCapture = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("action=stop")
          ? new Response(JSON.stringify({ text: "kids should vote" }), { status: 200 })
          : new Response(JSON.stringify({ sessionId: "s1", text: "" }), { status: 200 })
      )
    );
  });

  it("fills the box on release without submitting", async () => {
    const onSubmit = vi.fn();
    render(<VoiceOrTextInput label="Say your claim" onSubmit={onSubmit} />);
    const mic = screen.getByRole("button", { name: /talk/i });

    fireEvent.pointerDown(mic, { pointerId: 1 });
    fireEvent.pointerUp(mic, { pointerId: 1 });

    await waitFor(() =>
      expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("kids should vote")
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
