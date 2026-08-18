import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  HelperContextProvider,
  usePublishHelperContext,
  useHelperContext,
} from "@/components/helper/HelperContextProvider";

function Publisher({ motion }: { motion: string }) {
  usePublishHelperContext({ motion, stage: "claim" });
  return null;
}
function Reader() {
  const ctx = useHelperContext();
  return <div data-testid="ctx">{`${ctx.motion}|${ctx.stage}`}</div>;
}

describe("HelperContextProvider", () => {
  it("makes a child's published context visible to a reader", async () => {
    render(
      <HelperContextProvider>
        <Publisher motion="This House would ban homework." />
        <Reader />
      </HelperContextProvider>
    );
    expect(await screen.findByTestId("ctx")).toHaveTextContent(
      "This House would ban homework.|claim"
    );
  });

  it("merges patches from more than one publisher", async () => {
    function Second() {
      usePublishHelperContext({ side: "against" });
      return null;
    }
    function SideReader() {
      return <div data-testid="side">{String(useHelperContext().side)}</div>;
    }
    render(
      <HelperContextProvider>
        <Publisher motion="m" />
        <Second />
        <SideReader />
      </HelperContextProvider>
    );
    expect(await screen.findByTestId("side")).toHaveTextContent("against");
  });

  it("returns an empty context outside a provider rather than throwing", () => {
    render(<Reader />);
    expect(screen.getByTestId("ctx")).toHaveTextContent("|");
  });
});
