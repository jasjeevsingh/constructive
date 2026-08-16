import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PracticeShell } from "@/components/PracticeShell";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ kind: "impact", reaction: "Strong impact." }), { status: 200 }))
  );
});

describe("PracticeShell", () => {
  it("renders the claim stage for the claim part", () => {
    render(<PracticeShell part="claim" onExit={() => {}} />);
    expect(screen.getByText(/strongest claim/i)).toBeInTheDocument();
  });

  it("renders the link bridge for the link part", () => {
    render(<PracticeShell part="link" onExit={() => {}} />);
    expect(screen.getByRole("button", { name: /test the bridge/i })).toBeInTheDocument();
  });

  it("completes an impact rep, increments the count, and serves a fresh rep", async () => {
    render(<PracticeShell part="impact" onExit={() => {}} />);
    expect(screen.getByText(/so what\? why does this claim matter/i)).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "kids get more sleep");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    await userEvent.click(await screen.findByRole("button", { name: /finish this side/i }));
    expect(await screen.findByRole("button", { name: /next rep/i })).toBeInTheDocument();
    expect(screen.getByText("1 done")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /next rep/i }));
    expect(screen.getByText(/so what\? why does this claim matter/i)).toBeInTheDocument();
  });
});
