import { describe, it, expect } from "vitest";
import { gradeBridge } from "@/lib/linkGrade";
import type { LinkScenario } from "@/lib/schemas";

const scenario: LinkScenario = {
  id: "s",
  claim: "c",
  impact: "i",
  candidates: [
    { id: "e1", text: "ev fits", material: "evidence", verdict: "fits", explanation: "x" },
    { id: "r1", text: "re fits", material: "reasoning", verdict: "fits", explanation: "x" },
    { id: "gbw", text: "great but wrong", material: "evidence", verdict: "great-but-wrong", explanation: "x" },
    { id: "no", text: "doesnt fit", material: "reasoning", verdict: "doesnt-fit", explanation: "x" },
  ],
};

describe("gradeBridge", () => {
  it("holds when both fitting planks are placed and no wrong ones", () => {
    const g = gradeBridge(scenario, ["e1", "r1"]);
    expect(g.held).toBe(true);
    expect(g.hasEvidence).toBe(true);
    expect(g.hasReasoning).toBe(true);
    expect(g.perPlank.find((p) => p.id === "e1")?.status).toBe("correct");
  });

  it("does not hold when a fitting plank is missing", () => {
    const g = gradeBridge(scenario, ["e1"]);
    expect(g.held).toBe(false);
    expect(g.perPlank.find((p) => p.id === "r1")?.status).toBe("missing");
  });

  it("does not hold when a great-but-wrong plank is placed (flagged wrong)", () => {
    const g = gradeBridge(scenario, ["e1", "r1", "gbw"]);
    expect(g.held).toBe(false);
    expect(g.perPlank.find((p) => p.id === "gbw")?.status).toBe("wrong");
  });

  it("does not hold when a doesnt-fit plank is placed", () => {
    const g = gradeBridge(scenario, ["e1", "r1", "no"]);
    expect(g.held).toBe(false);
    expect(g.perPlank.find((p) => p.id === "no")?.status).toBe("wrong");
  });

  it("does not hold with only evidence even if it is the only fitting evidence (both-materials rule)", () => {
    const evOnly: LinkScenario = {
      ...scenario,
      candidates: [
        { id: "e1", text: "ev", material: "evidence", verdict: "fits", explanation: "x" },
        { id: "e2", text: "ev2", material: "evidence", verdict: "fits", explanation: "x" },
      ],
    };
    const g = gradeBridge(evOnly, ["e1", "e2"]);
    expect(g.hasReasoning).toBe(false);
    expect(g.held).toBe(false);
  });

  it("marks an unplaced non-fitting plank correct-omit", () => {
    const g = gradeBridge(scenario, ["e1", "r1"]);
    expect(g.perPlank.find((p) => p.id === "gbw")?.status).toBe("correct-omit");
  });
});
