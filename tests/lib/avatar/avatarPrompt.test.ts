import { describe, it, expect } from "vitest";
import { buildAvatarPrompt } from "@/lib/avatar/avatarPrompt";
import type { AvatarTurnRequest } from "@/lib/avatar/types";

const BASE_REQ: AvatarTurnRequest = {
  mode: "sparring",
  phase: "debate",
  motion: "This House would ban homework",
  cohort: "darshan",
  avatarSide: "against",
  studentSide: "for",
  transcript: [],
};

describe("buildAvatarPrompt", () => {
  it("includes the motion and side assignment in the system prompt", () => {
    const { system } = buildAvatarPrompt(BASE_REQ);
    expect(system).toContain("This House would ban homework");
    expect(system).toContain("AGAINST");
  });

  it("includes CLI framework reminder", () => {
    const { system } = buildAvatarPrompt(BASE_REQ);
    expect(system).toContain("Claim");
    expect(system).toContain("Link");
    expect(system).toContain("Impact");
  });

  it("includes cohort-appropriate vocabulary guidance", () => {
    const { system } = buildAvatarPrompt({ ...BASE_REQ, cohort: "surat" });
    expect(system).toContain("simple, concrete");
  });

  it("uses sparring-specific instructions for Mode A", () => {
    const { system } = buildAvatarPrompt(BASE_REQ);
    expect(system).toContain("structured debate");
    expect(system).not.toContain("Socratic");
  });

  it("uses pushback-specific instructions for Mode B", () => {
    const { system } = buildAvatarPrompt({ ...BASE_REQ, mode: "pushback" });
    expect(system).toContain("Socratic");
  });

  it("uses collaborative instructions for Mode C Phase 1", () => {
    const { system } = buildAvatarPrompt({
      ...BASE_REQ,
      mode: "collaborative",
      phase: "collaborative",
    });
    expect(system).toContain("same side");
    expect(system).toContain("brainstorm");
  });

  it("uses adversarial instructions for Mode C Phase 2", () => {
    const { system } = buildAvatarPrompt({
      ...BASE_REQ,
      mode: "collaborative",
      phase: "debate",
      collaborativeArgs: ["Homework causes stress"],
    });
    expect(system).toContain("argue against");
    expect(system).toContain("Homework causes stress");
  });

  it("includes transcript in user prompt", () => {
    const req: AvatarTurnRequest = {
      ...BASE_REQ,
      transcript: [
        { speaker: "student", text: "Homework builds discipline.", timestampMs: 0, durationMs: 5000 },
      ],
    };
    const { user } = buildAvatarPrompt(req);
    expect(user).toContain("Homework builds discipline.");
  });

  it("includes word limit from cohort config", () => {
    const { system } = buildAvatarPrompt({ ...BASE_REQ, cohort: "pyaas" });
    expect(system).toContain("150");
  });
});
