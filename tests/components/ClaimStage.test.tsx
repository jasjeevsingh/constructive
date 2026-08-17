import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClaimStage } from "@/components/stages/ClaimStage";

function coachReply(body: Record<string, unknown>) {
  return new Response(JSON.stringify({ kind: "claim", ...body }), { status: 200 });
}

const claims = [{ id: "c-stake", claim: "Kids deserve a say." }];

describe("ClaimStage", () => {
  beforeEach(() => localStorage.clear());

  it("asks a guiding question and does not let the student advance yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        coachReply({
          reaction: "Good start.",
          verdict: "keep-going",
          question: "Can you ground that in a situation?",
          mappedClaimId: null,
        })
      )
    );
    render(<ClaimStage motion="m" side="for" claims={claims} onComplete={() => {}} />);
    await userEvent.type(screen.getByRole("textbox"), "kids matter");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText(/ground that in a situation/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /build the link/i })).toBeNull();
  });

  it("advances once the coach says the claim is good enough", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        coachReply({
          reaction: "That's sharp.",
          verdict: "good-enough",
          question: null,
          mappedClaimId: "c-stake",
        })
      )
    );
    const onComplete = vi.fn();
    render(<ClaimStage motion="m" side="for" claims={claims} onComplete={onComplete} />);
    await userEvent.type(screen.getByRole("textbox"), "16-year-olds pay tax but cannot vote");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    await userEvent.click(await screen.findByRole("button", { name: /build the link/i }));
    expect(onComplete).toHaveBeenCalledWith("c-stake");
  });

  it("shows the student's own last claim alongside the mapped authored claim", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        coachReply({
          reaction: "That's sharp.",
          verdict: "good-enough",
          question: null,
          mappedClaimId: "c-stake",
        })
      )
    );
    render(<ClaimStage motion="m" side="for" claims={claims} onComplete={() => {}} />);
    await userEvent.type(screen.getByRole("textbox"), "16-year-olds pay tax but cannot vote");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    await screen.findByRole("button", { name: /build the link/i });
    expect(screen.getByText(/your claim/i)).toBeInTheDocument();
    // The student's own words are shown, not silently replaced.
    expect(screen.getAllByText(/16-year-olds pay tax but cannot vote/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/kids deserve a say/i)).toBeInTheDocument();
  });

  it("lets the student through at the turn cap even while still keep-going", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        coachReply({
          reaction: "Getting closer.",
          verdict: "keep-going",
          question: "What changes if that is true?",
          mappedClaimId: "c-stake",
        })
      )
    );
    render(<ClaimStage motion="m" side="for" claims={claims} onComplete={() => {}} />);
    for (let i = 0; i < 3; i++) {
      await userEvent.type(screen.getByRole("textbox"), `try ${i}`);
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));
      // The mocked reply text repeats every turn, so multiple bubbles share it —
      // use findAllByText (tolerates multiple matches) rather than findByText.
      await waitFor(() => expect(screen.getAllByText(/getting closer/i)).toHaveLength(i + 1));
    }
    expect(await screen.findByRole("button", { name: /build the link/i })).toBeInTheDocument();
  });

  it("sends the running transcript back to the coach", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      coachReply({ reaction: "Hm.", verdict: "keep-going", question: "Why?", mappedClaimId: null })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<ClaimStage motion="m" side="for" claims={claims} onComplete={() => {}} />);
    await userEvent.type(screen.getByRole("textbox"), "first");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    await screen.findByText(/why\?/i);
    await userEvent.type(screen.getByRole("textbox"), "second");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(secondBody.history).toEqual([
      { role: "student", text: "first" },
      { role: "coach", text: "Hm. Why?" },
    ]);
  });

  it("clears the input between turns so the second submit is exactly the second thing typed", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      coachReply({ reaction: "Hm.", verdict: "keep-going", question: "Why?", mappedClaimId: null })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<ClaimStage motion="m" side="for" claims={claims} onComplete={() => {}} />);
    await userEvent.type(screen.getByRole("textbox"), "Phones are bad");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    await screen.findByText(/why\?/i);

    // A fresh textarea for turn two — if it weren't remounted, this would append
    // onto the leftover "Phones are bad" from turn one.
    expect(screen.getByRole("textbox")).toHaveValue("");

    await userEvent.type(screen.getByRole("textbox"), "they cheat on tests");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(2));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(secondBody.payload.studentClaim).toBe("they cheat on tests");
    expect(secondBody.payload.studentClaim).not.toContain("Phones are bad");
  });

  it("ignores a second submit while the first request is still in flight", async () => {
    let resolveFetch!: (res: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<ClaimStage motion="m" side="for" claims={claims} onComplete={() => {}} />);
    await userEvent.type(screen.getByRole("textbox"), "first");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByText(/thinking/i)).toBeInTheDocument();

    // A second click while the first call is still pending should not fire another POST.
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(coachReply({ reaction: "Hm.", verdict: "keep-going", question: "Why?", mappedClaimId: null }));
    await screen.findByText(/why\?/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("clears the fallback banner after a retry succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("err", { status: 500 }))
      .mockResolvedValueOnce(
        coachReply({ reaction: "Better.", verdict: "keep-going", question: "Why?", mappedClaimId: null })
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<ClaimStage motion="m" side="for" claims={claims} onComplete={() => {}} />);
    await userEvent.type(screen.getByRole("textbox"), "first");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByText(/coach unavailable/i)).toBeInTheDocument();

    // Same textarea instance (no successful turn yet, so no remount) — the
    // failed attempt's text is still there; retry by submitting again.
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    await screen.findByText(/why\?/i);
    expect(screen.queryByText(/coach unavailable/i)).toBeNull();
  });

  it("falls back to manual pick when the coach call fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("err", { status: 500 })));
    const onComplete = vi.fn();
    render(<ClaimStage motion="THW let kids vote." side="for" claims={claims} onComplete={onComplete} />);
    await userEvent.type(screen.getByRole("textbox"), "something");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    // On a hard failure the copy says the coach is unavailable, not that things are going well.
    expect(await screen.findByText(/coach unavailable/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /kids deserve a say/i }));
    expect(onComplete).toHaveBeenCalledWith("c-stake");
  });

  it("falls back to manual pick, with the failure copy, when the coach returns an unexpected kind", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ kind: "keyword", reaction: "huh" }), { status: 200 }))
    );
    const onComplete = vi.fn();
    render(<ClaimStage motion="m" side="for" claims={claims} onComplete={onComplete} />);
    await userEvent.type(screen.getByRole("textbox"), "something");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText(/coach unavailable/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /kids deserve a say/i }));
    expect(onComplete).toHaveBeenCalledWith("c-stake");
  });

  it("shows warm, non-alarming copy when the turn cap is hit without a mapped claim", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        coachReply({
          reaction: "Getting closer.",
          verdict: "keep-going",
          question: "What changes if that is true?",
          mappedClaimId: null,
        })
      )
    );
    const onComplete = vi.fn();
    render(<ClaimStage motion="m" side="for" claims={claims} onComplete={onComplete} />);
    for (let i = 0; i < 3; i++) {
      await userEvent.type(screen.getByRole("textbox"), `try ${i}`);
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));
      await waitFor(() => expect(screen.getAllByText(/getting closer/i)).toHaveLength(i + 1));
    }

    expect(await screen.findByText(/good work/i)).toBeInTheDocument();
    expect(screen.queryByText(/coach unavailable/i)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /kids deserve a say/i }));
    expect(onComplete).toHaveBeenCalledWith("c-stake");
  });
});
