import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Bridge } from "@/components/stages/Bridge";
import type { LinkCandidate } from "@/lib/schemas";

const candidates: LinkCandidate[] = [
  { id: "e1", text: "Studies tie homework to stress.", material: "evidence", verdict: "fits", explanation: "x" },
  { id: "r1", text: "Frees evenings for family.", material: "reasoning", verdict: "fits", explanation: "y" },
  { id: "gbw", text: "A Harvard study raised test scores.", material: "evidence", verdict: "great-but-wrong", explanation: "z" },
];

const baseProps = {
  claim: "Ban homework.",
  impact: "More family time.",
  candidates,
  placedIds: [] as string[],
  grade: null,
  reactions: {},
  coachError: {},
  onToggle: () => {},
  onTalkThrough: () => {},
};

function renderBridge(placedIds: string[]) {
  render(<Bridge {...baseProps} placedIds={placedIds} />);
}

describe("Bridge", () => {
  it("renders the claim and impact piers", () => {
    renderBridge([]);
    expect(screen.getByText("Ban homework.")).toBeInTheDocument();
    expect(screen.getByText("More family time.")).toBeInTheDocument();
    expect(screen.getByText("Claim")).toBeInTheDocument();
    expect(screen.getByText("Impact")).toBeInTheDocument();
    expect(screen.getByTestId("bridge-scene")).toBeInTheDocument();
  });

  it("puts unplaced planks in the materials tray with a Build control", () => {
    renderBridge([]);
    expect(screen.getByRole("button", { name: /build .*stress/i })).toBeInTheDocument();
    expect(screen.getByText(/no planks yet/i)).toBeInTheDocument();
  });

  it("shows a placed plank in the span with a Set aside control", () => {
    renderBridge(["e1"]);
    expect(screen.getByRole("button", { name: /set aside .*stress/i })).toBeInTheDocument();
  });

  it("orders the materials tray by the shuffle seed", () => {
    const { container: a } = render(<Bridge {...baseProps} shuffleSeed={1} />);
    const { container: b } = render(<Bridge {...baseProps} shuffleSeed={2} />);
    const text = (c: HTMLElement) =>
      Array.from(c.querySelectorAll("[data-plank-id]")).map((n) => n.getAttribute("data-plank-id")).join(",");
    expect(text(a)).not.toBe(text(b));
  });

  it("keeps the remaining tray planks in stable relative order after a placement", async () => {
    // 5 candidates + seed 3 is chosen so that placing the plank that lands third in the
    // shuffled tray (not the first) re-derives a different rotation under the old
    // "shuffle the already-filtered list" logic — proving the order isn't stable.
    const fiveCandidates: LinkCandidate[] = [
      { id: "a", text: "Plank Alpha", material: "evidence", verdict: "fits", explanation: "x" },
      { id: "b", text: "Plank Bravo", material: "evidence", verdict: "fits", explanation: "x" },
      { id: "c", text: "Plank Charlie", material: "reasoning", verdict: "fits", explanation: "x" },
      { id: "d", text: "Plank Delta", material: "reasoning", verdict: "fits", explanation: "x" },
      { id: "e", text: "Plank Echo", material: "evidence", verdict: "fits", explanation: "x" },
    ];

    function ControlledBridge() {
      const [placedIds, setPlacedIds] = useState<string[]>([]);
      return (
        <Bridge
          {...baseProps}
          candidates={fiveCandidates}
          placedIds={placedIds}
          shuffleSeed={3}
          onToggle={(id) =>
            setPlacedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
          }
        />
      );
    }

    render(<ControlledBridge />);
    const orderIds = () =>
      Array.from(screen.getByTestId("materials-tray").querySelectorAll("[data-plank-id]")).map(
        (n) => n.getAttribute("data-plank-id")!
      );

    const before = orderIds();
    expect(before).toHaveLength(5);
    const targetId = before[2];
    const targetCandidate = fiveCandidates.find((c) => c.id === targetId)!;

    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^Build ${targetCandidate.text}$`) }));

    const after = orderIds();
    expect(after).toEqual(before.filter((id) => id !== targetId));
  });
});
