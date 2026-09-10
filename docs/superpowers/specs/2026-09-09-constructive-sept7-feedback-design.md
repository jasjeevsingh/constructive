# Sept 7 live-test feedback: design

Source: first live user test (Sept 7, 2026) with a Pyaas student new to debate,
plus Manmeet's simplified CLI definitions and the visual assets in
`feedback-and-visuals-feedback/` (bridge illustration, fallacy cards, and the
Gemini instructions for regenerating both).

## What the feedback said

- The three-part structure landed. The student could explain Claim, Link,
  Impact by the end of the homework example.
- Lesson is too text-heavy (highest priority). Fallacies should not appear
  during the lesson. The original two-column guide (teaching on the left,
  color-coded homework build on the right) was the better visual reference.
- "Read the Motion" confuses students who want to jump to their Claim.
- Link drills do not label which argument is being built.
- Practice drills read as guided reps, so they belong after Step 2, not
  after the Debate Avatar.
- Claim and Impact should be multiple choice first (pick the best of four),
  like Link already is, with open input reserved for generated topics.
- Keep the CLI definitions glanceable during Step 2 without inlining text.

Manmeet's definitions, used everywhere the framework is described:

| Part | Tag | Definition |
| --- | --- | --- |
| Claim | The "What" | The main point you want the audience to believe. |
| Link | The "How" | The step-by-step logic that connects your claim to the real world. |
| Impact | The "So What?" | The final consequence that shows why your argument actually matters. |

## Decisions

- Choice mode runs on the seeded motion bank. Generated-universe motions keep
  open input with coaching, because the generator does not author distractors.
- The fallacy cards stay purely contextual until Branch D lands. Whether the
  cheat sheet also gets a fallacy tab is decided after that.
- The bridge illustration ships as the JPEG with baked-in labels. The
  "See it in action" panel and the cheat-sheet thumbnail are built in CSS so
  they can animate later.

## Branch A: visual lesson

`components/Lesson.tsx` becomes a two-column stepper.

- Hero: the full bridge illustration (`public/lesson/cli-bridge.jpg`) above
  the title, with alt text carrying the three definitions.
- Four steps stay: Claim, Link/Reasoning, Link/Evidence, Impact. Each step's
  left column has the section crop as a banner, Manmeet's definition as the
  headline, and at most two short paragraphs plus one two-item checklist.
- Right column is "See it in action": four rows (Claim, Reasoning, Evidence,
  Impact) always visible. Rows at or before the current step show the homework
  text; later rows show "Coming next". Colors: Claim navy, Reasoning orange
  (`reasoning` token), Evidence gold (`evidence` token), Impact green
  (`success` token). Rows animate in with the existing `motion` transitions.
- All "Watch out" fallacy boxes are removed from the lesson.
- Columns stack on mobile, teaching first.
- `components/Landing.tsx` cards use Manmeet's tag and definition.

Images are copied into `public/lesson/` resized to 1600px wide and
recompressed. The originals stay outside the repo.

Tests: Lesson renders the hero, shows the right number of lit rows per step,
never renders the word "fallacy" or "Watch out", and the Landing shows the
three new definitions.

## Branch B: journey entry and on-screen reference

- `lib/state/flowMachine.ts`: stages become `claim | link | impact`.
  `ReadSubstep` and the restate/keyword substeps are removed.
- `lib/state/flowProgress.ts`: saved entries with `stage: "read"` load as
  `stage: "claim"`. `restate` and `readSubstep` fields are dropped on read.
- `RestateStep` is deleted. `KeywordStep` becomes `KeyTermsStrip`: a row of
  term chips above the Claim prompt, rendered only when the motion has at
  least one keyword with a hint. Tapping a chip reveals the hint and an
  optional define box that calls the existing keyword coach. Nothing blocks
  progression.
- `FlowRail` shows three steps. `FlowShell` drops `ReadRecap`.
- Cheat sheet: a `CliCheatSheet` component inside the rail (desktop) and as a
  disclosure under the mobile stepper. Contents: the three definitions with
  the current stage highlighted, and a small CSS bridge thumbnail. Open by
  default until the student has completed one stage anywhere
  (`constructive:cheatsheet:v1` in localStorage), collapsed after.
- Link drill label: `PracticeItem`'s link variant gains `motion`, and
  `PracticeShell` shows the motion and claim in the header for link drills.
- Home order in `FlowDeck`: Lesson, motion bank, Practice, Universe
  generator, Debate Avatar. Section eyebrows renumber accordingly.

Tests: flow migration from "read", rail step count, cheat sheet default
open/closed, key-terms strip hidden when no hints, link drill header shows
motion, home section order.

## Branch C: multiple-choice Claim and Impact

Content, in `content/flow-motions.json`:

- Per side: `claimChoices`, four entries `{ id, text, verdict, explanation }`
  with verdicts `strong | too-broad | not-contestable | wrong-side`. The strong
  entry references an authored claim id via `claimId`.
- Per authored claim: `impactChoices`, four entries with verdicts
  `strong | restates-claim | different-claim | no-scale`.
- Zod schemas make both optional so generated motions still validate.

UI:

- New `ChoiceStage` component, used for Claim and Impact. Shows the prompt,
  four option cards styled like Link planks, a "Lock it in" button. A wrong
  pick shows the explanation in a `CoachBubble`, offers "Talk this through"
  via the coach API, and lets the student pick again. A right pick shows the
  explanation and continues.
- `FlowShell` picks the mode: choice when the side has `claimChoices`,
  otherwise the existing open-input stage. Same rule for Impact per claim.
- Home page numbering: Step 1 lesson, Step 2 guided reps, Step 3 your own
  universe, Step 4 Debate Avatar.

Tests: schema round-trip, ChoiceStage wrong-then-right flow, FlowShell mode
selection for seeded vs generated motions.

## Branch D: contextual fallacy cards

- `LinkCandidate` gains optional `fallacy` from the eight-card set:
  `straw-man | slippery-slope | false-dilemma | false-cause |
  appeal-to-authority | hasty-generalization | ad-hominem | bandwagon`.
  Only distractors where the label is honest get tagged.
- `FallacyCard` component: CSS penalty card (yellow, red for ad hominem),
  whistle icon, name, definition, example, matching the reference images.
- In `Bridge`, when a tagged plank is placed and the bridge is tested, the
  card renders beside the plank feedback.
- Coach responses for open-input Claim and Impact gain an optional
  `fallacy` field; when present the same card renders under the coach bubble.
- Content pass: tag existing distractors in the four seeded motions and add
  fallacy tagging to the generator scaffold prompt as optional output.

Tests: card renders per fallacy id, Bridge shows a card only for tagged
placed planks after a test, coach schema accepts the optional field.

## Sequencing

A, then B, then C, then D. Each branch: tests, merge to main, push, confirm
the Vercel production deploy.
