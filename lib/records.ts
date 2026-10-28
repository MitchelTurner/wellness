import { EPISODE_TYPES, INTERVENTIONS, RESPONSES, type CheckIn, type Episode, type Intervention, type Medication, type Response, type Screening, type SleepQuality } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CheckInRecord = Omit<CheckIn, "id"> & { clientId: string };
export type EpisodeRecord = Omit<Episode, "id"> & { clientId: string };
export type ScreeningRecord = Omit<Screening, "id"> & { clientId: string };
export type ProfileRecord = { patientName: string; medications: Medication[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function isStringList(v: unknown, max: number): v is string[] {
  return Array.isArray(v) && v.length <= max && v.every((item) => typeof item === "string" && item.length > 0 && item.length <= 80);
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

function inRange(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

export function parseCheckIn(body: unknown): CheckInRecord | null {
  if (!isRecord(body) || !isUuid(body.clientId) || !inRange(body.timestamp, 0, 4e12)) return null;
  if (!inRange(body.mood, -5, 5) || !inRange(body.anxiety, 1, 10) || !inRange(body.sleepHours, 0, 14)) return null;
  if (body.sleepQuality !== "Poor" && body.sleepQuality !== "Fair" && body.sleepQuality !== "Good") return null;
  if (!isStringList(body.affect, 40) || !isStringList(body.somatic, 40) || !isStringList(body.functional, 40)) return null;
  if (typeof body.note !== "string" || body.note.length > 160) return null;
  const sleepQuality: SleepQuality = body.sleepQuality;
  return {
    clientId: body.clientId,
    timestamp: body.timestamp,
    mood: body.mood,
    anxiety: body.anxiety,
    sleepHours: body.sleepHours,
    sleepQuality,
    affect: body.affect,
    somatic: body.somatic,
    functional: body.functional,
    note: body.note,
  };
}

export function parseEpisode(body: unknown): EpisodeRecord | null {
  if (!isRecord(body) || !isUuid(body.clientId) || !inRange(body.timestamp, 0, 4e12)) return null;
  if (!inRange(body.durationMin, 1, 10080) || !inRange(body.peak, 1, 10)) return null;
  if (typeof body.type !== "string" || !EPISODE_TYPES.includes(body.type)) return null;
  if (!isStringList(body.somatic, 40) || typeof body.note !== "string" || body.note.length > 160) return null;
  if (!Array.isArray(body.interventions) || body.interventions.length > INTERVENTIONS.length) return null;
  const interventions: EpisodeRecord["interventions"] = [];
  for (const item of body.interventions) {
    if (!isRecord(item) || typeof item.name !== "string" || typeof item.response !== "string") return null;
    if (!INTERVENTIONS.includes(item.name as Intervention) || !RESPONSES.includes(item.response as Response)) return null;
    let detail: string | undefined;
    if (item.detail !== undefined && item.detail !== null && item.detail !== "") {
      if (typeof item.detail !== "string" || item.detail.trim().length > 80) return null;
      detail = item.detail.trim();
    }
    interventions.push({ name: item.name as Intervention, response: item.response as Response, ...(detail ? { detail } : {}) });
  }
  return {
    clientId: body.clientId,
    timestamp: body.timestamp,
    durationMin: body.durationMin,
    peak: body.peak,
    type: body.type,
    somatic: body.somatic,
    interventions,
    note: body.note,
  };
}

export function isClientId(id: string) {
  return UUID.test(id);
}

export function parseScreening(body: unknown): ScreeningRecord | null {
  if (!isRecord(body) || !isUuid(body.clientId) || !inRange(body.timestamp, 0, 4e12)) return null;
  if (body.kind !== "PHQ-9" && body.kind !== "GAD-7") return null;
  const expected = body.kind === "PHQ-9" ? 9 : 7;
  if (!Array.isArray(body.answers) || body.answers.length !== expected) return null;
  if (!body.answers.every((item) => typeof item === "number" && Number.isInteger(item) && item >= 0 && item <= 3)) return null;
  if (!inRange(body.total, 0, body.kind === "PHQ-9" ? 27 : 21)) return null;
  if (typeof body.note !== "string" || body.note.length > 160) return null;
  return {
    clientId: body.clientId,
    timestamp: body.timestamp,
    kind: body.kind,
    answers: body.answers as number[],
    total: body.total,
    note: body.note,
  };
}

export function parseProfile(body: unknown): ProfileRecord | null {
  if (!isRecord(body) || typeof body.patientName !== "string" || body.patientName.length > 80) return null;
  if (!Array.isArray(body.medications) || body.medications.length > 30) return null;
  const medications: Medication[] = [];
  for (const item of body.medications) {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string" || typeof item.dose !== "string") return null;
    if (!item.id || item.id.length > 80 || !item.name.trim() || item.name.length > 80 || item.dose.length > 40) return null;
    medications.push({ id: item.id, name: item.name.trim(), dose: item.dose.trim() });
  }
  return { patientName: body.patientName.trim(), medications };
}
