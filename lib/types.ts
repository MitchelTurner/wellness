export type SleepQuality = "Poor" | "Fair" | "Good";

export interface CheckIn {
  id?: number;
  clientId?: string;
  timestamp: number;
  mood: number; // -5..+5
  anxiety: number; // 1..10
  sleepHours: number;
  sleepQuality: SleepQuality;
  affect: string[];
  somatic: string[];
  functional: string[];
  note: string;
}

export type Intervention =
  | "PRN Medication"
  | "Breathing/Grounding"
  | "Rest"
  | "Social Support"
  | "None";
export type Response = "Relieved" | "Partial" | "No change";

export interface Episode {
  id?: number;
  clientId?: string;
  timestamp: number;
  durationMin: number;
  peak: number; // 1..10
  type: string;
  somatic: string[];
  interventions: { name: Intervention; response: Response; detail?: string }[];
  note: string;
}

export interface Screening {
  id?: number;
  clientId?: string;
  timestamp: number;
  kind: "PHQ-9" | "GAD-7";
  answers: number[];
  total: number;
  note: string;
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
}

export interface Settings {
  key: "profile" | "reminder";
  patientName?: string;
  medications?: Medication[];
  reminderTime?: string;
}

export const AFFECT_TAGS = [
  "Depressed",
  "Anxious",
  "Flat/Numb",
  "Irritable",
  "Hopeless",
  "Guilty",
  "Tearful",
  "Angry",
  "Restless",
  "Fearful",
  "Withdrawn",
  "Loss of interest",
  "Overwhelmed",
  "Elevated",
  "Calm",
  "Content",
  "Hopeful",
];
export const SOMATIC_TAGS = [
  "Headache",
  "Body aches",
  "Muscle Tension",
  "Jaw clenching",
  "GI Distress",
  "Nausea",
  "Appetite loss",
  "Appetite increase",
  "Racing Heart",
  "Palpitations",
  "Chest tightness",
  "Shortness of breath",
  "Sweating",
  "Tremor",
  "Dizziness",
  "Numbness or tingling",
  "Fatigue",
  "Brain Fog",
  "Derealization",
  "Insomnia",
  "Early waking",
  "Nightmares",
  "Light sensitivity",
  "Sound sensitivity",
  "Hot flashes",
  "Chills",
];
export const FUNCTIONAL_TAGS = [
  "Work missed/impaired",
  "Avoided social contact",
  "Missed meals",
  "Could not concentrate",
  "Stayed in bed",
  "Cancelled plans",
  "Conflict with others",
  "Needed help with tasks",
  "Hard to leave home",
  "Normal activity",
  "High productivity",
  "Exercised",
  "Kept a routine",
];
export const STEADY_FUNCTION = new Set(["Normal activity", "High productivity", "Exercised", "Kept a routine"]);
export const EPISODE_TYPES = ["Panic attack", "Anxiety surge", "Depressive crash", "Crying spell", "Sudden anger", "Dissociation", "Shutdown"];
export const EPISODE_SOMATIC = [
  "Sweating",
  "Palpitations",
  "Derealization",
  "Tremor",
  "Shortness of breath",
  "Chest tightness",
  "Nausea",
  "Dizziness",
  "Numbness or tingling",
  "Choking sensation",
  "Hot flashes",
  "Chills",
  "Detachment",
  "Blurred vision",
  "Crying",
];
export const INTERVENTIONS: Intervention[] = ["PRN Medication", "Breathing/Grounding", "Rest", "Social Support", "None"];
export const RESPONSES: Response[] = ["Relieved", "Partial", "No change"];
