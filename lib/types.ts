export type SleepQuality = "Poor" | "Fair" | "Good";

export interface CheckIn {
  id?: number;
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
  timestamp: number;
  durationMin: number;
  peak: number; // 1..10
  type: string;
  somatic: string[];
  interventions: { name: Intervention; response: Response }[];
  note: string;
}

export interface Screening {
  id?: number;
  timestamp: number;
  kind: "PHQ-9" | "GAD-7";
  answers: number[];
  total: number;
  note: string;
}

export interface Settings {
  key: "profile";
  patientName: string;
}

export const AFFECT_TAGS = ["Depressed", "Anxious", "Flat/Numb", "Irritable", "Elevated", "Overwhelmed", "Calm"];
export const SOMATIC_TAGS = ["Headache", "GI Distress", "Muscle Tension", "Racing Heart", "Fatigue", "Brain Fog", "Insomnia"];
export const FUNCTIONAL_TAGS = ["Work missed/impaired", "Avoided social contact", "Missed meals", "Normal activity", "High productivity"];
export const EPISODE_TYPES = ["Panic attack", "Depressive crash", "Sudden anger"];
export const EPISODE_SOMATIC = ["Sweating", "Palpitations", "Derealization", "Tremor", "Shortness of breath"];
export const INTERVENTIONS: Intervention[] = ["PRN Medication", "Breathing/Grounding", "Rest", "Social Support", "None"];
export const RESPONSES: Response[] = ["Relieved", "Partial", "No change"];
