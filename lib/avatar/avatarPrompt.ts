import type { AvatarTurnRequest } from "@/lib/avatar/types";
import { getCohortPromptModifiers, getModeConfig } from "@/lib/avatar/cohortAdapter";

const MODE_INSTRUCTIONS: Record<string, string> = {
  sparring: [
    "This is a structured debate. You and the student take alternating turns.",
    "Make real arguments using the Claim → Link → Impact framework. Model good argument structure.",
    "Do not deliberately lose or weaken your arguments.",
    "Reference and rebut the student's previous points when possible.",
  ].join("\n"),
  pushback: [
    "You are a Socratic coach stress-testing the student's argument.",
    "Challenge the weakest part of their Claim, Link, or Impact.",
    "Name which CLI step you are probing (e.g., 'Your claim is clear, but the link is missing').",
    "If they strengthen it, acknowledge the improvement and move to the next weak point.",
    "If they don't, escalate with a sharper question.",
  ].join("\n"),
  "collaborative:collaborative": [
    "You and the student are on the same side, brainstorming arguments together.",
    "Guide them through building complete arguments: strongest claim → supporting evidence → link → impact.",
    "Be warm and collaborative. Build on their ideas rather than replacing them.",
    "Help them develop 2-3 complete Claim → Link → Impact arguments before transitioning to the debate phase.",
  ].join("\n"),
  "collaborative:debate": [
    "You now argue against the student. Switch to the opposing side.",
    "Use your knowledge of their case from the brainstorm phase to mount targeted counter-arguments.",
    "Target the specific weaknesses you noticed during collaboration.",
  ].join("\n"),
};

function getModeKey(mode: string, phase: string): string {
  if (mode === "collaborative") return `collaborative:${phase}`;
  return mode;
}

export function buildAvatarPrompt(req: AvatarTurnRequest): { system: string; user: string } {
  const mods = getCohortPromptModifiers(req.cohort);
  const config = getModeConfig(req.mode, req.cohort);
  const modeKey = getModeKey(req.mode, req.phase);
  const instructions = MODE_INSTRUCTIONS[modeKey] ?? MODE_INSTRUCTIONS[req.mode];

  const systemLines: string[] = [
    `You are a debate training partner for youth debaters.`,
    `The motion is: "${req.motion}"`,
    `You are arguing ${req.avatarSide.toUpperCase()}.`,
    `The student is arguing ${req.studentSide.toUpperCase()}.`,
    "",
    instructions,
    "",
    `Keep your responses under ${config.wordLimit} words.`,
    "",
    mods.vocabulary,
    mods.signposting,
    req.mode === "pushback" ? mods.pushbackIntensity : "",
    req.mode === "collaborative" && req.phase === "collaborative" ? mods.scaffolding : "",
    "",
    "Framework: arguments follow Claim → Link → Impact.",
    "- Claim: an argument in favor of your side",
    "- Link: evidence + reasoning connecting claim to impact",
    "- Impact: why the argument matters beyond the debate",
  ];

  if (req.mode === "collaborative" && req.phase === "debate" && req.collaborativeArgs?.length) {
    systemLines.push(
      "",
      "Arguments the student built during collaboration (target these weaknesses):",
      ...req.collaborativeArgs.map((a, i) => `${i + 1}. ${a}`),
    );
  }

  const userLines: string[] = [];
  if (req.transcript.length > 0) {
    const last = req.transcript[req.transcript.length - 1];
    userLines.push(`The student said: "${last.text}"`);
    userLines.push("");
    userLines.push("Respond in character. Do not include any JSON or metadata — just your spoken response.");
  } else {
    userLines.push("You are opening the debate. Make your first argument.");
    userLines.push("");
    userLines.push("Respond in character. Do not include any JSON or metadata — just your spoken response.");
  }

  return {
    system: systemLines.filter((l) => l !== undefined).join("\n"),
    user: userLines.join("\n"),
  };
}
