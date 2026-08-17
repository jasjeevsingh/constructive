import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImpactStage } from "@/components/stages/ImpactStage";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ kind: "impact", reaction: "Strong impact." }), { status: 200 }))
  );
});

describe("ImpactStage", () => {
  it("shows the prompt and reveals Finish after a coach reaction", async () => {
    const onComplete = vi.fn();
    render(<ImpactStage motion="m" claim="c" authoredImpact="a" onComplete={onComplete} />);
    expect(screen.getByText(/so what\? why does this claim matter/i)).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "kids get more sleep");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByText(/strong impact/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /finish this side/i }));
    expect(onComplete).toHaveBeenCalledWith("kids get more sleep");
  });

  it("shows the claim it is asking for an impact on", () => {
    render(
      <ImpactStage
        motion="This House would ban homework."
        claim="Homework crowds out family time."
        authoredImpact="Families eat dinner together."
        onComplete={() => {}}
      />
    );
    expect(screen.getByText("Homework crowds out family time.")).toBeInTheDocument();
  });
});
