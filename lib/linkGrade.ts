import type { LinkScenario } from "@/lib/schemas";

export type PlankStatus = "correct" | "wrong" | "missing" | "correct-omit";

export interface PlankResult {
  id: string;
  placed: boolean;
  status: PlankStatus;
}

export interface BridgeGrade {
  perPlank: PlankResult[];
  hasEvidence: boolean;
  hasReasoning: boolean;
  held: boolean;
}

export function gradeBridge(scenario: LinkScenario, placedIds: string[]): BridgeGrade {
  const placed = new Set(placedIds);

  const perPlank: PlankResult[] = scenario.candidates.map((c) => {
    const isPlaced = placed.has(c.id);
    const fits = c.verdict === "fits";
    let status: PlankStatus;
    if (fits && isPlaced) status = "correct";
    else if (!fits && isPlaced) status = "wrong";
    else if (fits && !isPlaced) status = "missing";
    else status = "correct-omit";
    return { id: c.id, placed: isPlaced, status };
  });

  const placedFitting = scenario.candidates.filter((c) => placed.has(c.id) && c.verdict === "fits");
  const hasEvidence = placedFitting.some((c) => c.material === "evidence");
  const hasReasoning = placedFitting.some((c) => c.material === "reasoning");

  const allFitsPlaced = scenario.candidates
    .filter((c) => c.verdict === "fits")
    .every((c) => placed.has(c.id));
  const noWrongPlaced = scenario.candidates
    .filter((c) => c.verdict !== "fits")
    .every((c) => !placed.has(c.id));

  const held = allFitsPlaced && noWrongPlaced && hasEvidence && hasReasoning;

  return { perPlank, hasEvidence, hasReasoning, held };
}
