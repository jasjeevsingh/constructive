import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UniverseGenerator } from "@/components/UniverseGenerator";
import type { FlowMotion } from "@/lib/schemas";

const solvable = {
  claim: "Kids deserve a say.", impact: "A fairer future.", candidates: [
    { text: "turnout", material: "evidence", verdict: "fits", explanation: "e" },
    { text: "represents", material: "reasoning", verdict: "fits", explanation: "e" },
    { text: "distractor", material: "evidence", verdict: "great-but-wrong", explanation: "e" },
  ],
};
const sides = { for: { claims: [solvable] }, against: { claims: [solvable] } };

beforeEach(() => localStorage.clear());

describe("UniverseGenerator", () => {
  it("generates motion cards and opens a scaffolded motion", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/api/generate/motions")) {
        return new Response(JSON.stringify({ refused: false, motions: [
          { motion: "This house believes the Hidden Villages do more harm than good.", keywords: [{ word: "Villages", hint: null }], hook: "Fun to argue." },
        ] }), { status: 200 });
      }
      return new Response(JSON.stringify({ refused: false, sides }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const onOpen = vi.fn();
    render(<UniverseGenerator onOpen={onOpen} />);
    await userEvent.type(screen.getByRole("textbox", { name: /universe/i }), "Naruto");
    await userEvent.click(screen.getByRole("button", { name: /generate/i }));

    const card = await screen.findByRole("button", { name: /hidden villages/i });
    await userEvent.click(card);

    const opened: FlowMotion = onOpen.mock.calls.at(-1)![0];
    expect(opened.id).toBe("gen:naruto:0");
    expect(opened.sides.for.claims[0].candidates[0].id).toBe("e1");
  });

  it("shows a friendly message on refusal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ refused: true, reason: "Let's pick a school-friendly universe." }), { status: 200 })));
    render(<UniverseGenerator onOpen={() => {}} />);
    await userEvent.type(screen.getByRole("textbox", { name: /universe/i }), "nope");
    await userEvent.click(screen.getByRole("button", { name: /generate/i }));
    expect(await screen.findByText(/school-friendly universe/i)).toBeInTheDocument();
  });
});
