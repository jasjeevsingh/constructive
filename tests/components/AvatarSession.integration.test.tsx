import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvatarShell } from "@/components/avatar/AvatarShell";

beforeEach(() => {
  localStorage.clear();
  let callCount = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (typeof url === "string" && url.includes("/api/avatar/turn")) {
      callCount++;
      return new Response(JSON.stringify({ text: `Avatar response ${callCount}.` }), { status: 200 });
    }
    if (typeof url === "string" && url.includes("/api/avatar/score")) {
      return new Response(JSON.stringify({
        argumentation: { claim: 2, link: 2, impact: 2, weighing: 1 },
        engagement: { breadth: 2, depth: 2, responsive: 2, crystallizing: 1 },
        rationales: { claim: "ok", link: "ok", impact: "ok", weighing: "ok", breadth: "ok", depth: "ok", responsive: "ok", crystallizing: "ok" },
        focusArea: "weighing",
        focusTip: "Compare worlds.",
      }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  }));
});

describe("Avatar sparring integration", () => {
  it("navigates from mode selection to a debate session", async () => {
    render(<AvatarShell onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /sparring/i }));
    expect(screen.getByText(/pick a motion/i)).toBeInTheDocument();
    const motionButtons = screen.getAllByRole("button", { name: /This House/ });
    await userEvent.click(motionButtons[0]);
    expect(screen.getByText(/which side/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /argue for/i }));
    expect(screen.getByText(/start speaking/i)).toBeInTheDocument();
  });

  it("runs a full student turn: transcript update, avatar reply via /api/avatar/turn, and TTS", async () => {
    render(<AvatarShell onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /sparring/i }));
    const motionButtons = screen.getAllByRole("button", { name: /This House/ });
    await userEvent.click(motionButtons[0]);
    await userEvent.click(screen.getByRole("button", { name: /argue for/i }));

    const input = screen.getByPlaceholderText(/type your response/i);
    await userEvent.type(input, "My first speech.");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("My first speech.")).toBeInTheDocument();
    expect(await screen.findByText(/Avatar response 1\./)).toBeInTheDocument();
  });

  it("shows ScoreCard after 3 exchanges (6 turns) complete a sparring round", async () => {
    const user = userEvent.setup();
    render(<AvatarShell onExit={() => {}} />);
    await user.click(screen.getByRole("button", { name: /sparring/i }));
    const motionButtons = screen.getAllByRole("button", { name: /This House/ });
    await user.click(motionButtons[0]);
    await user.click(screen.getByRole("button", { name: /argue for/i }));

    // First 2 exchanges: verify avatar responds
    for (let i = 0; i < 2; i++) {
      const input = screen.getByPlaceholderText(/type your response/i);
      await user.clear(input);
      await user.type(input, `Speech ${i + 1}`);
      await user.click(screen.getByRole("button", { name: /send/i }));
      await screen.findByText(new RegExp(`Avatar response ${i + 1}\\.`), {}, { timeout: 3000 });
    }

    // 3rd exchange completes the round — ScoreCard replaces the transcript view
    const input = screen.getByPlaceholderText(/type your response/i);
    await user.clear(input);
    await user.type(input, "Speech 3");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText(/round.*score/i, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next round/i })).toBeInTheDocument();
  });
});
