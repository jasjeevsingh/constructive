import { describe, it, expect } from "vitest";
import { helperPrompt } from "@/lib/helper/helperPrompt";
import { emptyHelperContext } from "@/lib/helper/context";

const ctx = { ...emptyHelperContext(), motion: "This House would ban homework.", side: "for" as const, stage: "claim" };

describe("helperPrompt", () => {
  it("carries the shared claim rubric", () => {
    const p = helperPrompt(ctx);
    for (const name of ["One idea", "Takes a side", "Concrete", "Contestable"]) {
      expect(p).toContain(name);
    }
  });

  it("forbids writing the student's argument for them", () => {
    expect(helperPrompt(ctx).toLowerCase()).toContain("never write");
  });

  it("keeps the helper on the debate task", () => {
    expect(helperPrompt(ctx).toLowerCase()).toContain("politely decline");
  });

  it("tells it to keep spoken turns short and ask one question", () => {
    const p = helperPrompt(ctx).toLowerCase();
    expect(p).toContain("one question");
    expect(p).toContain("short");
  });

  it("includes the page context", () => {
    expect(helperPrompt(ctx)).toContain("This House would ban homework.");
  });

  it("carves out on-task learning questions from the stay-on-task rule", () => {
    const p = helperPrompt(ctx).toLowerCase();
    expect(p).toContain("what a term means");
    expect(p).toContain("on task");
  });

  it("tells the helper how to respond if a student seems upset or unsafe", () => {
    const p = helperPrompt(ctx).toLowerCase();
    expect(p).toContain("trusted adult");
  });

  it("tells the helper never to solicit personal or identifying information", () => {
    const p = helperPrompt(ctx).toLowerCase();
    expect(p).toContain("personal");
    expect(p).toContain("name");
    expect(p).toContain("do not record");
  });

  it("keeps the speech instruction in voice mode", () => {
    expect(helperPrompt(ctx, "voice").toLowerCase()).toContain("speech");
  });

  it("drops the speech instruction in text mode and forbids markdown", () => {
    const p = helperPrompt(ctx, "text").toLowerCase();
    expect(p).not.toContain("this is speech");
    expect(p).toContain("plain sentences");
  });

  it("still carries every hard rule in text mode", () => {
    const p = helperPrompt(ctx, "text");
    for (const name of ["One idea", "Takes a side", "Concrete", "Contestable"]) expect(p).toContain(name);
    expect(p.toLowerCase()).toContain("never write");
    expect(p.toLowerCase()).toContain("politely decline");
    expect(p.toLowerCase()).toContain("trusted adult");
  });

  it("renders prior turns so a voice call continues the text thread", () => {
    const p = helperPrompt(ctx, "voice", [
      { role: "student", text: "i think phones are bad" },
      { role: "helper", text: "what happens because of that?" },
    ]);
    expect(p).toContain("i think phones are bad");
    expect(p).toContain("what happens because of that?");
  });

  it("omits the transcript section when there are no prior turns", () => {
    expect(helperPrompt(ctx, "text")).not.toMatch(/so far in this conversation/i);
  });

  it("defaults to voice mode with no prior turns", () => {
    expect(helperPrompt(ctx)).toBe(helperPrompt(ctx, "voice", []));
  });
});
