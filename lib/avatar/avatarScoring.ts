import { InlineScoreSchema, RoundScoreSchema } from "@/lib/avatar/types";
import type { AvatarScoreRequest, InlineScore, RoundScore, AvatarTurn } from "@/lib/avatar/types";
import type { ChatClient } from "@/lib/ai/claude";

function renderTranscript(transcript: AvatarTurn[]): string {
  return transcript
    .map((t) => `${t.speaker === "student" ? "Student" : "Avatar"}: ${t.text}`)
    .join("\n");
}

const ROUND_SYSTEM = [
  "You are a debate scoring system. Score the STUDENT's performance only (not the avatar's).",
  "",
  "Argumentation sub-criteria (each /3):",
  "- claim: Is the argument clear, specific, and arguable?",
  "- link: Does evidence + reasoning connect claim to impact?",
  "- impact: Does the argument explain why it matters beyond the debate?",
  "- weighing: Does the student paint a picture of what the world looks like if their side wins?",
  "",
  "Engagement sub-criteria (each /3):",
  "- breadth: Does the student address multiple angles?",
  "- depth: Does the student develop points beyond surface level?",
  "- responsive: Does the student engage with the opponent's arguments?",
  "- crystallizing: Does the student synthesize and clarify the core clash?",
  "",
  "Scoring guide: 0 = absent, 1 = attempted, 2 = competent, 3 = strong.",
  "",
  "Respond ONLY as JSON matching this structure:",
  '{"argumentation":{"claim":N,"link":N,"impact":N,"weighing":N},',
  '"engagement":{"breadth":N,"depth":N,"responsive":N,"crystallizing":N},',
  '"rationales":{"claim":"...","link":"...","impact":"...","weighing":"...","breadth":"...","depth":"...","responsive":"...","crystallizing":"..."},',
  '"focusArea":"<key of lowest score>",',
  '"focusTip":"<one concrete sentence of advice>"}',
].join("\n");

const INLINE_SYSTEM = [
  "You are a debate scoring system. Evaluate the student's most recent response.",
  "Identify the single most relevant Argumentation criterion (claim, link, impact, or weighing) and score it /3.",
  "Scoring guide: 0 = absent, 1 = attempted, 2 = competent, 3 = strong.",
  "",
  'Respond ONLY as JSON: {"criterion":"<name>","score":N,"rationale":"<one sentence>"}',
].join("\n");

export async function scoreRound(req: AvatarScoreRequest, client: ChatClient): Promise<RoundScore> {
  const user = `Score this student's debate performance:\n\n${renderTranscript(req.transcript)}`;
  const raw = await client.complete({ system: ROUND_SYSTEM, user });
  const parsed = JSON.parse(raw);
  const validated = RoundScoreSchema.parse(parsed);
  // RoundScoreSchema does not validate `round` (it's assigned by the caller,
  // e.g. the /api/avatar/score route in Task 4, which tracks the session's
  // current round). Default to 0 here so the return type is satisfied.
  return { round: 0, ...validated };
}

export async function scoreInline(req: AvatarScoreRequest, client: ChatClient): Promise<InlineScore> {
  const user = `Score the student's response in this exchange:\n\n${renderTranscript(req.transcript)}`;
  const raw = await client.complete({ system: INLINE_SYSTEM, user });
  const parsed = JSON.parse(raw);
  const validated = InlineScoreSchema.parse(parsed);
  return { ...validated, turnIndex: req.transcript.length - 1 };
}

export function pickFocusArea(score: RoundScore): { focusArea: string; focusTip: string } {
  const all: [string, number][] = [
    ...Object.entries(score.argumentation),
    ...Object.entries(score.engagement),
  ];
  all.sort((a, b) => a[1] - b[1]);
  const focusArea = all[0][0];
  return { focusArea, focusTip: score.focusTip ?? "" };
}
