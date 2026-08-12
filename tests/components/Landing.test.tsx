import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Landing } from "@/components/Landing";

describe("Landing", () => {
  it("renders the hero and the Claim → Link → Impact strip", () => {
    render(<Landing />);
    expect(screen.getByRole("heading", { name: /build an argument/i })).toBeInTheDocument();
    expect(screen.getByText("Claim")).toBeInTheDocument();
    expect(screen.getByText("Link")).toBeInTheDocument();
    expect(screen.getByText("Impact")).toBeInTheDocument();
    expect(screen.getByText("evidence")).toBeInTheDocument();
    expect(screen.getByText("reasoning")).toBeInTheDocument();
  });
});
