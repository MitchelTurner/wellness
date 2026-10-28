import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import type { CheckInRecord, EpisodeRecord, ProfileRecord, ScreeningRecord } from "./records";

let database: DatabaseSync | null = null;

function db() {
  if (!database) {
    const dir = path.join(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    database = new DatabaseSync(path.join(dir, "clintrack.sqlite"));
    database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
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
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS screenings (
        client_id TEXT PRIMARY KEY,
        user_id INTEGER,
        timestamp INTEGER NOT NULL,
        kind TEXT NOT NULL,
        answers TEXT NOT NULL,
        total INTEGER NOT NULL,
        note TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS profiles (
        user_id INTEGER PRIMARY KEY,
        patient_name TEXT NOT NULL,
        medications TEXT NOT NULL
      );
    `);
    ensureColumn("check_ins", "user_id", "ALTER TABLE check_ins ADD COLUMN user_id INTEGER");
    ensureColumn("episodes", "user_id", "ALTER TABLE episodes ADD COLUMN user_id INTEGER");
    ensureColumn("screenings", "user_id", "ALTER TABLE screenings ADD COLUMN user_id INTEGER");
  }
  return database;
}

function ensureColumn(table: string, column: string, ddl: string) {
  const info = db().prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!info.some((col) => col.name === column)) db().exec(ddl);
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

export type Account = { id: number; username: string; passwordHash: string };

export function countUsers() {
  const row = db().prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  return Number(row.n);
}

export function createFirstUser(username: string, passwordHash: string): number | null {
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    const existing = database.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
    if (Number(existing.n) !== 0) {
      database.exec("ROLLBACK");
      return null;
    }
    const result = database.prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)").run(username, passwordHash, Date.now());
    const id = Number(result.lastInsertRowid);
    database.prepare("UPDATE check_ins SET user_id = ? WHERE user_id IS NULL").run(id);
    database.prepare("UPDATE episodes SET user_id = ? WHERE user_id IS NULL").run(id);
    database.prepare("UPDATE screenings SET user_id = ? WHERE user_id IS NULL").run(id);
    database.exec("COMMIT");
    return id;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function updatePassword(userId: number, passwordHash: string) {
  db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
}

export function findUserByUsername(username: string): Account | null {
  const row = db().prepare("SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE").get(username) as { id: number; username: string; password_hash: string } | undefined;
  if (!row) return null;
  return { id: Number(row.id), username: String(row.username), passwordHash: String(row.password_hash) };
}

export function createSession(tokenHash: string, userId: number, expiresAt: number) {
  db().prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(tokenHash, userId, expiresAt);
}

export function deleteSession(tokenHash: string) {
  db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export function userForSession(tokenHash: string): { id: number; username: string } | null {
  const now = Date.now();
  db().prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  const row = db().prepare(`
    SELECT users.id AS id, users.username AS username
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at >= ?
  `).get(tokenHash, now) as { id: number; username: string } | undefined;
  if (!row) return null;
  return { id: Number(row.id), username: String(row.username) };
}

export function saveCheckInRow(userId: number, row: CheckInRecord) {
  const result = db().prepare(`
    INSERT INTO check_ins (client_id, timestamp, mood, anxiety, sleep_hours, sleep_quality, affect, somatic, functional, note, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    WHERE check_ins.user_id = excluded.user_id
  `).run(row.clientId, row.timestamp, row.mood, row.anxiety, row.sleepHours, row.sleepQuality, json(row.affect), json(row.somatic), json(row.functional), row.note, userId);
  return result.changes > 0;
}

export function saveEpisodeRow(userId: number, row: EpisodeRecord) {
  const result = db().prepare(`
    INSERT INTO episodes (client_id, timestamp, duration_min, peak, type, somatic, interventions, note, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(client_id) DO UPDATE SET
      timestamp = excluded.timestamp,
      duration_min = excluded.duration_min,
      peak = excluded.peak,
      type = excluded.type,
      somatic = excluded.somatic,
      interventions = excluded.interventions,
      note = excluded.note
    WHERE episodes.user_id = excluded.user_id
  `).run(row.clientId, row.timestamp, row.durationMin, row.peak, row.type, json(row.somatic), json(row.interventions), row.note, userId);
  return result.changes > 0;
}

export function listCheckInRows(userId: number): CheckInRecord[] {
  const rows = db().prepare("SELECT * FROM check_ins WHERE user_id = ? ORDER BY timestamp DESC").all(userId) as Record<string, unknown>[];
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

export function listEpisodeRows(userId: number): EpisodeRecord[] {
  const rows = db().prepare("SELECT * FROM episodes WHERE user_id = ? ORDER BY timestamp DESC").all(userId) as Record<string, unknown>[];
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

export function deleteCheckInRow(userId: number, clientId: string) {
  db().prepare("DELETE FROM check_ins WHERE client_id = ? AND user_id = ?").run(clientId, userId);
}

export function deleteEpisodeRow(userId: number, clientId: string) {
  db().prepare("DELETE FROM episodes WHERE client_id = ? AND user_id = ?").run(clientId, userId);
}

export function deleteAllCheckInRows(userId: number) {
  db().prepare("DELETE FROM check_ins WHERE user_id = ?").run(userId);
}

export function deleteAllEpisodeRows(userId: number) {
  db().prepare("DELETE FROM episodes WHERE user_id = ?").run(userId);
}

export function saveScreeningRow(userId: number, row: ScreeningRecord) {
  const result = db().prepare(`
    INSERT INTO screenings (client_id, user_id, timestamp, kind, answers, total, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(client_id) DO UPDATE SET
      timestamp = excluded.timestamp,
      kind = excluded.kind,
      answers = excluded.answers,
      total = excluded.total,
      note = excluded.note
    WHERE screenings.user_id = excluded.user_id
  `).run(row.clientId, userId, row.timestamp, row.kind, json(row.answers), row.total, row.note);
  return result.changes > 0;
}

export function listScreeningRows(userId: number): ScreeningRecord[] {
  const rows = db().prepare("SELECT * FROM screenings WHERE user_id = ? ORDER BY timestamp DESC").all(userId) as Record<string, unknown>[];
  return rows.map((row) => ({
    clientId: String(row.client_id),
    timestamp: Number(row.timestamp),
    kind: row.kind as ScreeningRecord["kind"],
    answers: parseJson<number[]>(row.answers, []),
    total: Number(row.total),
    note: String(row.note ?? ""),
  }));
}

export function deleteScreeningRow(userId: number, clientId: string) {
  db().prepare("DELETE FROM screenings WHERE client_id = ? AND user_id = ?").run(clientId, userId);
}

export function deleteAllScreeningRows(userId: number) {
  db().prepare("DELETE FROM screenings WHERE user_id = ?").run(userId);
}

export function saveProfileRow(userId: number, row: ProfileRecord) {
  db().prepare(`
    INSERT INTO profiles (user_id, patient_name, medications) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      patient_name = excluded.patient_name,
      medications = excluded.medications
  `).run(userId, row.patientName, json(row.medications));
}

export function getProfileRow(userId: number): ProfileRecord | null {
  const row = db().prepare("SELECT patient_name, medications FROM profiles WHERE user_id = ?").get(userId) as { patient_name: string; medications: string } | undefined;
  if (!row) return null;
  return { patientName: String(row.patient_name), medications: parseJson(row.medications, []) };
}

export function deleteProfileRow(userId: number) {
  db().prepare("DELETE FROM profiles WHERE user_id = ?").run(userId);
}
