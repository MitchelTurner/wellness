import type { CheckIn, Episode, Screening } from "./types";
import { AFFECT_TAGS, SOMATIC_TAGS, FUNCTIONAL_TAGS, STEADY_AFFECT, STEADY_FUNCTION } from "./types";
import { sumAnswers } from "./scoring";

const DAY = 86400000;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function buildSeed() {
  const r = rng(42);
  const pick = (arr: string[], n: number) => [...arr].sort(() => r() - 0.5).slice(0, n);
  const now = new Date();
  now.setHours(20, 0, 0, 0);
  const checkIns: CheckIn[] = [];
  for (let i = 29; i >= 0; i--) {
    if (r() < 0.1) continue; // missed days
    const sleepHours = Math.round((5 + r() * 4 + (i < 10 ? 0.5 : 0)) * 2) / 2;
    const mood = Math.max(-5, Math.min(5, Math.round((sleepHours - 6.5) * 1.6 + (r() - 0.5) * 3 + (30 - i) * 0.05)));
    const anxiety = Math.max(1, Math.min(10, Math.round(6 - mood * 0.4 + (r() - 0.5) * 3)));
    const low = mood < 0;
    checkIns.push({
      timestamp: now.getTime() - i * DAY,
      mood,
      anxiety,
      sleepHours,
      sleepQuality: sleepHours < 6 ? "Poor" : sleepHours < 7.5 ? "Fair" : "Good",
      affect: low ? pick(AFFECT_TAGS.filter((tag) => !STEADY_AFFECT.has(tag)), 1 + Math.floor(r() * 2)) : pick(["Calm", "Elevated", "Content", "Anxious"], 1),
      somatic: low ? pick(SOMATIC_TAGS, 1 + Math.floor(r() * 3)) : r() < 0.3 ? pick(SOMATIC_TAGS, 1) : [],
      functional: low ? pick(FUNCTIONAL_TAGS.filter((tag) => !STEADY_FUNCTION.has(tag)), 1 + Math.floor(r() * 2)) : pick([...STEADY_FUNCTION], 1),
      note: low ? "Rough day." : "",
    });
  }
  const episodes: Episode[] = [
    { d: 24, type: "Panic attack", peak: 8, dur: 20, som: ["Palpitations", "Sweating", "Shortness of breath"], iv: [["PRN Medication", "Relieved"], ["Breathing/Grounding", "Partial"]] },
    { d: 17, type: "Depressive crash", peak: 7, dur: 180, som: [], iv: [["Rest", "Partial"]] },
    { d: 11, type: "Panic attack", peak: 9, dur: 25, som: ["Palpitations", "Tremor", "Derealization"], iv: [["PRN Medication", "Relieved"]] },
    { d: 6, type: "Sudden anger", peak: 6, dur: 15, som: ["Tremor"], iv: [["Breathing/Grounding", "Relieved"]] },
    { d: 2, type: "Panic attack", peak: 7, dur: 15, som: ["Palpitations", "Sweating"], iv: [["PRN Medication", "Partial"], ["Social Support", "Partial"]] },
  ].map((e) => ({
    timestamp: now.getTime() - e.d * DAY - 3 * 3600000,
    durationMin: e.dur,
    peak: e.peak,
    type: e.type,
    somatic: e.som,
    interventions: e.iv.map(([name, response]) => ({ name, response })) as Episode["interventions"],
    note: "",
  }));
  const mk = (kind: Screening["kind"], d: number, answers: number[]): Screening => ({
    timestamp: now.getTime() - d * DAY,
    kind,
    answers,
    total: sumAnswers(answers),
    note: d > 20 ? "Baseline" : d > 7 ? "After dose adjustment" : "",
  });
  const screenings = [
    mk("PHQ-9", 28, [2, 2, 3, 2, 1, 2, 2, 1, 0]),
    mk("GAD-7", 28, [3, 2, 3, 2, 1, 2, 1]),
    mk("PHQ-9", 14, [2, 2, 2, 2, 1, 1, 2, 1, 0]),
    mk("GAD-7", 14, [2, 2, 2, 2, 1, 1, 1]),
    mk("PHQ-9", 0, [1, 1, 2, 1, 1, 1, 1, 0, 0]),
    mk("GAD-7", 0, [2, 1, 1, 1, 1, 1, 1]),
  ];
  return { checkIns, episodes, screenings };
}
