import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArgumentsStep } from "@/components/steps/ArgumentsStep";

const refineReply = {
  kind: "refine",
  verdicts: [
    { argumentId: "for-0", verdict: "duplicate", question: "How does this differ from for-1?" },
    { argumentId: "for-1", verdict: "duplicate", question: "Can you make this a different kind of impact?" },
    { argumentId: "for-2", verdict: "distinct", question: null },
    { argumentId: "against-0", verdict: "distinct", question: null },
    { argumentId: "against-1", verdict: "weak", question: "Why would that happen?" },
    { argumentId: "against-2", verdict: "distinct", question: null },
  ],
  duplicateGroups: [["for-0", "for-1"]],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(refineReply), { status: 200 }))
  );
});

describe("ArgumentsStep", () => {
  it("keeps Refine disabled until all six arguments are filled", async () => {
    render(<ArgumentsStep motion="THW let kids vote." onDone={() => {}} />);
    const refine = screen.getByRole("button", { name: /refine/i });
    expect(refine).toBeDisabled();
  });

  it("shows the AI's sharpening question after refining six arguments", async () => {
    render(<ArgumentsStep motion="THW let kids vote." onDone={() => {}} />);
    const boxes = screen.getAllByRole("textbox");
    const values = ["a", "b", "c", "d", "e", "f"];
    for (let i = 0; i < 6; i++) await userEvent.type(boxes[i], values[i]);
    await userEvent.click(screen.getByRole("button", { name: /refine/i }));
    expect(await screen.findByText(/How does this differ from for-1/i)).toBeInTheDocument();
  });
});
