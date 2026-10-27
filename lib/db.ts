import Dexie, { type Table } from "dexie";
import type { CheckIn, Episode, Screening, Settings } from "./types";
import { buildSeed } from "./seed";

class ClinTrackDB extends Dexie {
  checkIns!: Table<CheckIn, number>;
  episodes!: Table<Episode, number>;
  screenings!: Table<Screening, number>;
  settings!: Table<Settings, string>;

  constructor() {
    super("clintrack");
    this.version(1).stores({
      checkIns: "++id, timestamp",
      episodes: "++id, timestamp",
      screenings: "++id, timestamp, kind",
      settings: "key",
    });
    this.version(2).stores({
      checkIns: "++id, timestamp, clientId",
      episodes: "++id, timestamp, clientId",
      screenings: "++id, timestamp, kind",
      settings: "key",
    });
  }
}

export const db = new ClinTrackDB();

export async function seedIfFirstLaunch() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("clintrack-seeded")) return;
  localStorage.setItem("clintrack-seeded", "1");
  const count = await db.checkIns.count();
  if (count > 0) return;
  const s = buildSeed();
  await db.transaction("rw", [db.checkIns, db.episodes, db.screenings, db.settings], async () => {
    await db.checkIns.bulkAdd(s.checkIns);
    await db.episodes.bulkAdd(s.episodes);
    await db.screenings.bulkAdd(s.screenings);
    await db.settings.put({ key: "profile", patientName: "Alex Doe" });
  });
}

export async function getPatientName(): Promise<string> {
  return (await db.settings.get("profile"))?.patientName ?? "";
}

export async function exportAll() {
  return {
    app: "ClinTrack",
    version: 1,
    exportedAt: new Date().toISOString(),
    checkIns: await db.checkIns.toArray(),
    episodes: await db.episodes.toArray(),
    screenings: await db.screenings.toArray(),
    settings: await db.settings.toArray(),
  };
}

export async function importAll(data: unknown) {
  const d = data as Record<string, unknown>;
  if (!d || d.app !== "ClinTrack" || !Array.isArray(d.checkIns) || !Array.isArray(d.episodes) || !Array.isArray(d.screenings)) {
    throw new Error("Not a valid ClinTrack backup file");
  }
  await db.transaction("rw", [db.checkIns, db.episodes, db.screenings, db.settings], async () => {
    await Promise.all([db.checkIns.clear(), db.episodes.clear(), db.screenings.clear(), db.settings.clear()]);
    await db.checkIns.bulkAdd(d.checkIns as CheckIn[]);
    await db.episodes.bulkAdd(d.episodes as Episode[]);
    await db.screenings.bulkAdd(d.screenings as Screening[]);
    if (Array.isArray(d.settings)) await db.settings.bulkAdd(d.settings as Settings[]);
  });
  localStorage.setItem("clintrack-seeded", "1");
}

export async function clearAll() {
  await Promise.all([db.checkIns.clear(), db.episodes.clear(), db.screenings.clear(), db.settings.clear()]);
  localStorage.setItem("clintrack-seeded", "1");
}
