import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyTermsStrip } from "@/components/steps/KeyTermsStrip";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ kind: "keyword", reaction: "Sharp definition." }), { status: 200 }))
  );
});

describe("KeyTermsStrip", () => {
  it("renders nothing when no keyword carries a hint", () => {
    render(<KeyTermsStrip motion="This House would let kids vote." keywords={[{ word: "kids", hint: null }]} />);
    expect(screen.queryByTestId("key-terms-strip")).toBeNull();
  });

  it("offers only the ambiguous terms as optional chips", () => {
    render(
      <KeyTermsStrip
        motion="This House would let kids vote."
        keywords={[{ word: "kids", hint: "Age 5 or 17?" }, { word: "vote", hint: null }]}
      />
    );
    expect(screen.getByText(/any key terms to define/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "kids" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "vote" })).toBeNull();
    expect(screen.getByText(/optional/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("reveals the hint and a define box when a chip is tapped, and the coach reacts", async () => {
    render(
      <KeyTermsStrip motion="This House would let kids vote." keywords={[{ word: "kids", hint: "Age 5 or 17?" }]} />
    );
    await userEvent.click(screen.getByRole("button", { name: "kids" }));
    expect(screen.getByText(/age 5 or 17/i)).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "anyone under 18");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByText(/sharp definition/i)).toBeInTheDocument();
  });

  it("tapping the chip again collapses it", async () => {
    render(
      <KeyTermsStrip motion="This House would let kids vote." keywords={[{ word: "kids", hint: "Age 5 or 17?" }]} />
    );
    await userEvent.click(screen.getByRole("button", { name: "kids" }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "kids" }));
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
