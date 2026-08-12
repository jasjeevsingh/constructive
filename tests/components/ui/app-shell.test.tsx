import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "@/components/ui/app-shell";

describe("AppShell", () => {
  it("renders the wordmark header and its children", () => {
    render(<AppShell><p>page body</p></AppShell>);
    expect(screen.getByText("Constructive")).toBeInTheDocument();
    expect(screen.getByText("page body")).toBeInTheDocument();
  });
});
