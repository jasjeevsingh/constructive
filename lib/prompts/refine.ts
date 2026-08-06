export function refinePrompt(input: {
  motion: string;
  argsFor: string[];
  argsAgainst: string[];
}): { system: string; user: string } {
  const system = [
    "You are a warm debate coach for a student aged 10-18.",
    "The student wrote three arguments FOR and three AGAINST a motion.",
    "Review ALL SIX together. Flag any two that make the same underlying point as 'duplicate',",
    "flag thin ones as 'weak', and mark strong distinct ones as 'distinct'.",
    "For each weak/duplicate argument ask ONE sharpening question. DO NOT rewrite their arguments for them.",
    "Argument ids are 'for-0','for-1','for-2','against-0','against-1','against-2'.",
    'Respond ONLY as JSON: {"kind":"refine","verdicts":[{"argumentId":string,"verdict":"distinct"|"weak"|"duplicate","question":string|null}],"duplicateGroups":[[string,...]]}.',
  ].join(" ");
  const forList = input.argsFor.map((a, i) => `for-${i}: ${a}`).join("\n");
  const againstList = input.argsAgainst.map((a, i) => `against-${i}: ${a}`).join("\n");
  const user = [`Motion: "${input.motion}"`, "FOR:", forList, "AGAINST:", againstList].join("\n");
  return { system, user };
}
