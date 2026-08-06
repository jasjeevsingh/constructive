import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
