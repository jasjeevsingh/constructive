import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClaimStage } from "@/components/stages/ClaimStage";

const claims = [{ id: "c-stake", claim: "Kids deserve a say." }, { id: "c-habit", claim: "Voting builds a habit." }];

describe("ClaimStage", () => {
  beforeEach(() => localStorage.clear());

  it("maps a spoken claim to an authored claim and lets the student continue", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ kind: "claim", reaction: "Good instinct!", mappedClaimId: "c-stake" }), { status: 200 })
    ));
    const onComplete = vi.fn();
    render(<ClaimStage motion="THW let kids vote." side="for" claims={claims} onComplete={onComplete} />);
    await userEvent.type(screen.getByRole("textbox"), "kids live with laws longest");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByText(/good instinct/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /build the link/i }));
    expect(onComplete).toHaveBeenCalledWith("c-stake");
  });

  it("falls back to manual pick when the coach call fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("err", { status: 500 })));
    const onComplete = vi.fn();
    render(<ClaimStage motion="THW let kids vote." side="for" claims={claims} onComplete={onComplete} />);
    await userEvent.type(screen.getByRole("textbox"), "something");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    // On failure, the authored claims are offered as pick buttons.
    await userEvent.click(await screen.findByRole("button", { name: /kids deserve a say/i }));
    expect(onComplete).toHaveBeenCalledWith("c-stake");
  });
});
