import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Bridge } from "@/components/stages/Bridge";
import { gradeBridge } from "@/lib/linkGrade";
import type { LinkCandidate, LinkScenario } from "@/lib/schemas";

const candidates: LinkCandidate[] = [
  { id: "e1", text: "Turnout studies show early voters keep voting.", material: "evidence", verdict: "fits", explanation: "fits" },
  { id: "r1", text: "A first vote in school becomes a routine.", material: "reasoning", verdict: "fits", explanation: "fits" },
  { id: "gbw", text: "A Nobel Prize was awarded for research on voting systems.", material: "evidence", verdict: "great-but-wrong", explanation: "Impressive, irrelevant.", fallacy: "appeal-to-authority" },
  { id: "dnf", text: "Kids can already hold part-time jobs.", material: "reasoning", verdict: "doesnt-fit", explanation: "Different impact." },
];
const scenario: LinkScenario = { id: "s", claim: "Kids deserve a say.", impact: "Better future.", candidates };

function renderGraded(placedIds: string[], graded: boolean) {
  render(
    <Bridge
      claim={scenario.claim}
      impact={scenario.impact}
      candidates={candidates}
      placedIds={placedIds}
      grade={graded ? gradeBridge(scenario, placedIds) : null}
      reactions={{}}
      coachError={{}}
      onToggle={() => {}}
      onTalkThrough={() => {}}
    />
  );
}

describe("Bridge fallacy cards", () => {
  it("shows the card for a tagged distractor once the bridge is tested", () => {
    renderGraded(["e1", "r1", "gbw"], true);
    expect(screen.getByTestId("fallacy-card")).toHaveAttribute("data-fallacy", "appeal-to-authority");
  });
  it("shows nothing before the bridge is tested", () => {
    renderGraded(["e1", "r1", "gbw"], false);
    expect(screen.queryByTestId("fallacy-card")).toBeNull();
  });
  it("shows no card for an untagged distractor or an unplaced tagged one", () => {
    renderGraded(["e1", "r1", "dnf"], true);
    expect(screen.queryByTestId("fallacy-card")).toBeNull();
  });
});
