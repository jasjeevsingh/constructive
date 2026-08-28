import { describe, it, expect } from "vitest";
import { getModeConfig, getCohortPromptModifiers } from "@/lib/avatar/cohortAdapter";

describe("getModeConfig", () => {
  it("returns shorter turns and higher scaffolding for Surat", () => {
    const config = getModeConfig("sparring", "surat");
    expect(config.wordLimit).toBe(80);
    expect(config.scaffoldingLevel).toBe("high");
    expect(config.turnDurationSec).toBe(60);
    expect(config.rounds).toBe(3);
  });

  it("returns longer turns and low scaffolding for Pyaas", () => {
    const config = getModeConfig("sparring", "pyaas");
    expect(config.wordLimit).toBe(150);
    expect(config.scaffoldingLevel).toBe("low");
  });

  it("returns medium scaffolding for Darshan", () => {
    const config = getModeConfig("pushback", "darshan");
    expect(config.scaffoldingLevel).toBe("medium");
  });

  it("uses shorter turns and fewer rounds for collaborative debate phase", () => {
    const config = getModeConfig("collaborative", "darshan");
    expect(config.turnDurationSec).toBe(45);
    expect(config.rounds).toBe(2);
  });
});

describe("getCohortPromptModifiers", () => {
  it("returns explicit signposting for Surat", () => {
    const mods = getCohortPromptModifiers("surat");
    expect(mods.signposting).toContain("explicit");
    expect(mods.pushbackIntensity).toContain("gentle");
  });

  it("returns sharp pushback for Pyaas", () => {
    const mods = getCohortPromptModifiers("pyaas");
    expect(mods.pushbackIntensity).toContain("sharp");
  });
});
