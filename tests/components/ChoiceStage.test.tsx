import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChoiceStage } from "@/components/stages/ChoiceStage";

const choices = [
  { id: "k-strong", text: "Kids deserve a say in decisions that affect their future.", verdict: "strong", explanation: "Specific and contestable." },
  { id: "k-broad", text: "Voting is important.", verdict: "too-broad", explanation: "A theme, not a stance." },
  { id: "k-fact", text: "Kids are affected by laws.", verdict: "not-contestable", explanation: "Nobody disagrees." },
  { id: "k-wrong", text: "Kids are too young for politics.", verdict: "wrong-side", explanation: "That's the other side." },
];

function renderStage(onComplete = vi.fn()) {
  render(
    <ChoiceStage
      part="claim"
      eyebrow="Stage 1 · Claim"
      prompt="Which is the strongest claim for this motion?"
      motion="This House would let kids vote."
      side="for"
      choices={choices}
      seed="m-kids-vote:for:claim"
      continueLabel="Build the link →"
      onComplete={onComplete}
    />
  );
  return onComplete;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ kind: "choice", reaction: "Tempting, but it's a theme." }), { status: 200 }))
  );
});

describe("ChoiceStage", () => {
  it("lists every option as a radio and keeps Lock it in disabled until one is picked", () => {
    renderStage();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /lock it in/i })).toBeDisabled();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("does not always list the strong option first", () => {
    renderStage();
    expect(screen.getAllByRole("radio")[0]).not.toHaveTextContent(/deserve a say/i);
  });

  it("explains a wrong pick, offers a retry, and never advances", async () => {
    const onComplete = renderStage();
    await userEvent.click(screen.getByRole("radio", { name: /voting is important/i }));
    await userEvent.click(screen.getByRole("button", { name: /lock it in/i }));
    expect(screen.getByText(/too broad/i)).toBeInTheDocument();
    expect(screen.getByText(/a theme, not a stance/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /build the link/i })).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.queryByText(/a theme, not a stance/i)).toBeNull();
    expect(screen.getByRole("button", { name: /lock it in/i })).toBeDisabled();
  });

  it("asks the coach to talk a wrong pick through", async () => {
    renderStage();
    await userEvent.click(screen.getByRole("radio", { name: /voting is important/i }));
    await userEvent.click(screen.getByRole("button", { name: /lock it in/i }));
    await userEvent.click(screen.getByRole("button", { name: /talk this through/i }));
    expect(await screen.findByText(/tempting, but it's a theme/i)).toBeInTheDocument();
    const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.step).toBe("choice");
    expect(body.payload).toMatchObject({ part: "claim", side: "for", chosen: "Voting is important.", verdictLabel: "Too broad" });
    expect(body.payload.best).toMatch(/deserve a say/i);
  });

  it("confirms the strong pick and advances with it", async () => {
    const onComplete = renderStage();
    await userEvent.click(screen.getByRole("radio", { name: /deserve a say/i }));
    await userEvent.click(screen.getByRole("button", { name: /lock it in/i }));
    expect(screen.getByText(/strong claim/i)).toBeInTheDocument();
    expect(screen.getByText(/specific and contestable/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /build the link/i }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ id: "k-strong" }));
  });

  it("surfaces a coach outage without blocking the retry", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    renderStage();
    await userEvent.click(screen.getByRole("radio", { name: /too young/i }));
    await userEvent.click(screen.getByRole("button", { name: /lock it in/i }));
    await userEvent.click(screen.getByRole("button", { name: /talk this through/i }));
    expect(await screen.findByText(/coach unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeEnabled();
  });
});
