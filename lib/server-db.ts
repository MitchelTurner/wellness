import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import type { CheckInRecord, EpisodeRecord } from "./records";

let database: DatabaseSync | null = null;

function db() {
  if (!database) {
    const dir = path.join(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    database = new DatabaseSync(path.join(dir, "clintrack.sqlite"));
    database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS check_ins (
        client_id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        mood REAL NOT NULL,
        anxiety REAL NOT NULL,
        sleep_hours REAL NOT NULL,
        sleep_quality TEXT NOT NULL,
        affect TEXT NOT NULL,
        somatic TEXT NOT NULL,
        functional TEXT NOT NULL,
        note TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS episodes (
        client_id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        duration_min REAL NOT NULL,
        peak REAL NOT NULL,
        type TEXT NOT NULL,
        somatic TEXT NOT NULL,
        interventions TEXT NOT NULL,
        note TEXT NOT NULL
      );
    `);
  }
  return database;
}

function json(value: unknown) {
  return JSON.stringify(value);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const upsertCheckInSql = () => db().prepare(`
  INSERT INTO check_ins (client_id, timestamp, mood, anxiety, sleep_hours, sleep_quality, affect, somatic, functional, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(client_id) DO UPDATE SET
    timestamp = excluded.timestamp,
    mood = excluded.mood,
    anxiety = excluded.anxiety,
    sleep_hours = excluded.sleep_hours,
    sleep_quality = excluded.sleep_quality,
    affect = excluded.affect,
    somatic = excluded.somatic,
    functional = excluded.functional,
    note = excluded.note
`);

const upsertEpisodeSql = () => db().prepare(`
  INSERT INTO episodes (client_id, timestamp, duration_min, peak, type, somatic, interventions, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(client_id) DO UPDATE SET
    timestamp = excluded.timestamp,
    duration_min = excluded.duration_min,
    peak = excluded.peak,
    type = excluded.type,
    somatic = excluded.somatic,
    interventions = excluded.interventions,
    note = excluded.note
`);

export function saveCheckInRow(row: CheckInRecord) {
  upsertCheckInSql().run(row.clientId, row.timestamp, row.mood, row.anxiety, row.sleepHours, row.sleepQuality, json(row.affect), json(row.somatic), json(row.functional), row.note);
}

export function saveEpisodeRow(row: EpisodeRecord) {
  upsertEpisodeSql().run(row.clientId, row.timestamp, row.durationMin, row.peak, row.type, json(row.somatic), json(row.interventions), row.note);
}

export function listCheckInRows(): CheckInRecord[] {
  const rows = db().prepare("SELECT * FROM check_ins ORDER BY timestamp DESC").all() as Record<string, unknown>[];
  return rows.map((row) => ({
    clientId: String(row.client_id),
    timestamp: Number(row.timestamp),
    mood: Number(row.mood),
    anxiety: Number(row.anxiety),
    sleepHours: Number(row.sleep_hours),
    sleepQuality: row.sleep_quality as CheckInRecord["sleepQuality"],
    affect: parseJson<string[]>(row.affect, []),
    somatic: parseJson<string[]>(row.somatic, []),
    functional: parseJson<string[]>(row.functional, []),
    note: String(row.note ?? ""),
  }));
}

export function listEpisodeRows(): EpisodeRecord[] {
  const rows = db().prepare("SELECT * FROM episodes ORDER BY timestamp DESC").all() as Record<string, unknown>[];
  return rows.map((row) => ({
    clientId: String(row.client_id),
    timestamp: Number(row.timestamp),
    durationMin: Number(row.duration_min),
    peak: Number(row.peak),
    type: String(row.type),
    somatic: parseJson<string[]>(row.somatic, []),
    interventions: parseJson<EpisodeRecord["interventions"]>(row.interventions, []),
    note: String(row.note ?? ""),
  }));
}

export function deleteCheckInRow(clientId: string) {
  db().prepare("DELETE FROM check_ins WHERE client_id = ?").run(clientId);
}

export function deleteEpisodeRow(clientId: string) {
  db().prepare("DELETE FROM episodes WHERE client_id = ?").run(clientId);
}

export function deleteAllCheckInRows() {
  db().exec("DELETE FROM check_ins;");
}

export function deleteAllEpisodeRows() {
  db().exec("DELETE FROM episodes;");
}
