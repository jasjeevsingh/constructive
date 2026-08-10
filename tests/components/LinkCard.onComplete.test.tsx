import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LinkCard } from "@/components/LinkCard";
import type { LinkScenario } from "@/lib/schemas";

const scenario: LinkScenario = {
  id: "s",
  claim: "Kids deserve a say.",
  impact: "Better future.",
  candidates: [
    { id: "e1", text: "Studies tie voting to engagement.", material: "evidence", verdict: "fits", explanation: "x" },
    { id: "r1", text: "Politicians chase youth votes.", material: "reasoning", verdict: "fits", explanation: "x" },
    { id: "gbw", text: "A Nobel was won on voting theory.", material: "evidence", verdict: "great-but-wrong", explanation: "x" },
  ],
};

beforeEach(() => localStorage.clear());

describe("LinkCard onComplete", () => {
  it("shows a Continue button that fires onComplete once the bridge holds", async () => {
    const onComplete = vi.fn();
    render(<LinkCard scenario={scenario} onExit={() => {}} onComplete={onComplete} />);
    await userEvent.click(screen.getByRole("button", { name: /build .*studies tie voting/i }));
    await userEvent.click(screen.getByRole("button", { name: /build .*politicians chase/i }));
    await userEvent.click(screen.getByRole("button", { name: /test the bridge/i }));
    const cont = await screen.findByRole("button", { name: /continue/i });
    await userEvent.click(cont);
    expect(onComplete).toHaveBeenCalled();
  });

  it("does not render Continue when onComplete is omitted", async () => {
    render(<LinkCard scenario={scenario} onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /build .*studies tie voting/i }));
    await userEvent.click(screen.getByRole("button", { name: /build .*politicians chase/i }));
    await userEvent.click(screen.getByRole("button", { name: /test the bridge/i }));
    expect(screen.queryByRole("button", { name: /continue/i })).toBeNull();
  });
});
