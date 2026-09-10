import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvatarShell } from "@/components/avatar/AvatarShell";

let streamCallCount = 0;

vi.mock("@/lib/voice/playSpeech", () => ({
  speakCoachStreaming: vi.fn(async () => {
    streamCallCount++;
    return `Avatar response ${streamCallCount}.`;
  }),
  speakCoach: vi.fn(async () => {}),
  stopSpeech: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  streamCallCount = 0;

  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
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

async function navigateToSession(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /sparring/i }));
  const motionButtons = screen.getAllByRole("button", { name: /This House/ });
  await user.click(motionButtons[0]);
  await user.click(screen.getByRole("button", { name: /argue for/i }));
}

async function sendText(user: ReturnType<typeof userEvent.setup>, text: string) {
  let input = screen.queryByPlaceholderText(/type your argument/i);
  if (!input) {
    await user.click(screen.getByRole("button", { name: /toggle text input/i }));
    input = screen.getByPlaceholderText(/type your argument/i);
  }
  await user.clear(input);
  await user.type(input, text);
  await user.click(screen.getByRole("button", { name: /send/i }));
}

describe("Avatar sparring integration", () => {
  it("navigates from mode selection to a debate session", async () => {
    const user = userEvent.setup();
    render(<AvatarShell onExit={() => {}} />);
    await navigateToSession(user);
    expect(screen.getByText(/hold mic or press/i)).toBeInTheDocument();
  });

  it("runs a full student turn: transcript update, avatar reply via streaming, and TTS", async () => {
    const user = userEvent.setup();
    render(<AvatarShell onExit={() => {}} />);
    await navigateToSession(user);
    await sendText(user, "My first speech.");

    const matches = await screen.findAllByText(/Avatar response 1\./, {}, { timeout: 5000 });
    expect(matches.length).toBeGreaterThan(0);
  });

  it("shows ScoreCard after 3 exchanges (6 turns) complete a sparring round", async () => {
    const user = userEvent.setup();
    render(<AvatarShell onExit={() => {}} />);
    await navigateToSession(user);

    for (let i = 0; i < 2; i++) {
      await sendText(user, `Speech ${i + 1}`);
      const matches = await screen.findAllByText(new RegExp(`Avatar response ${i + 1}\\.`), {}, { timeout: 5000 });
      expect(matches.length).toBeGreaterThan(0);
    }

    await sendText(user, "Speech 3");

    expect(await screen.findByText(/round.*score/i, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next round/i })).toBeInTheDocument();
  });
});
