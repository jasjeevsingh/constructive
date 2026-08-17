import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "@/components/ui/app-shell";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AppShell", () => {
  it("renders the wordmark header and its children", () => {
    render(<AppShell><p>page body</p></AppShell>);
    expect(screen.getByText("Constructive")).toBeInTheDocument();
    expect(screen.getByText("page body")).toBeInTheDocument();
  });

  it("renders the feedback link when the url is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_URL", "https://example.com/feedback");
    render(<AppShell><p>page body</p></AppShell>);
    const link = screen.getByRole("link", { name: /user feedback/i });
    expect(link).toHaveAttribute("href", "https://example.com/feedback");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders no feedback link when the url is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_URL", "");
    render(<AppShell><p>page body</p></AppShell>);
    expect(screen.queryByRole("link", { name: /user feedback/i })).toBeNull();
  });
});
