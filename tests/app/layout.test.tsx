import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  it("renders its children", () => {
    // RootLayout renders <html>/<body>; render only the body subtree it returns.
    render(<RootLayout>{<p>hello deck</p>}</RootLayout>);
    expect(screen.getByText("hello deck")).toBeInTheDocument();
  });
});
