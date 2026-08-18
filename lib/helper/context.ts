export type HelperTurn = { role: "student" | "coach"; text: string };

export type HelperContext = {
  activity: "journey" | "practice";
  motion: string;
  side: "for" | "against" | null;
  stage: string;
  claimDraft: string | null;
  transcript: HelperTurn[];
};

export function emptyHelperContext(): HelperContext {
  return { activity: "journey", motion: "", side: null, stage: "", claimDraft: null, transcript: [] };
}

/** The page-context block spliced into the helper's system prompt. Empty
 *  sections are omitted so the model is never handed blank headings. */
export function renderHelperContext(ctx: HelperContext): string {
  const lines: string[] = ["What the student is working on right now:"];
  if (ctx.motion) lines.push(`- Motion: "${ctx.motion}"`);
  if (ctx.side) lines.push(`- They are arguing: ${ctx.side}`);
  if (ctx.stage) lines.push(`- Current step: ${ctx.stage}`);
  lines.push(`- Activity: ${ctx.activity === "journey" ? "the full motion journey" : "a practice drill"}`);
  if (ctx.claimDraft) lines.push(`- Their claim so far: "${ctx.claimDraft}"`);
  if (ctx.transcript.length > 0) {
    lines.push("- Recent exchange with the on-page coach:");
    for (const t of ctx.transcript) {
      lines.push(`  ${t.role === "student" ? "Student" : "Coach said"}: ${t.text}`);
    }
  }
  return lines.join("\n");
}
