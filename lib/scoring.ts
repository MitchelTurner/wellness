export const ANSWER_OPTIONS = ["Not at all", "Several days", "More than half the days", "Nearly every day"];

export const PHQ9_ITEMS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
  "Trouble concentrating on things, such as reading or watching television",
  "Moving or speaking so slowly that other people could have noticed — or being fidgety or restless",
  "Thoughts that you would be better off dead, or of hurting yourself in some way",
];

export const GAD7_ITEMS = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid as if something awful might happen",
];

export function sumAnswers(answers: number[]): number {
  return answers.reduce((a, b) => a + b, 0);
}

export function severity(kind: "PHQ-9" | "GAD-7", total: number): string {
  if (kind === "PHQ-9") {
    if (total <= 4) return "Minimal";
    if (total <= 9) return "Mild";
    if (total <= 14) return "Moderate";
    if (total <= 19) return "Moderately Severe";
    return "Severe";
  }
  if (total <= 4) return "Minimal";
  if (total <= 9) return "Mild";
  if (total <= 14) return "Moderate";
  return "Severe";
}

export const MAX_SCORE = { "PHQ-9": 27, "GAD-7": 21 } as const;
