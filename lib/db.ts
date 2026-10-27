import Dexie, { type Table } from "dexie";
import type { CheckIn, Episode, Screening, Settings } from "./types";

const DEMO_REMOVED = "clintrack-demo-removed";
const DEMO_SCREENS: { kind: Screening["kind"]; answers: string; note: string }[] = [
  { kind: "PHQ-9", answers: "2,2,3,2,1,2,2,1,0", note: "Baseline" },
  { kind: "GAD-7", answers: "3,2,3,2,1,2,1", note: "Baseline" },
  { kind: "PHQ-9", answers: "2,2,2,2,1,1,2,1,0", note: "After dose adjustment" },
  { kind: "GAD-7", answers: "2,2,2,2,1,1,1", note: "After dose adjustment" },
  { kind: "PHQ-9", answers: "1,1,2,1,1,1,1,0,0", note: "" },
  { kind: "GAD-7", answers: "2,1,1,1,1,1,1", note: "" },
];

function isDemoScreen(row: Screening) {
  const answers = row.answers.join(",");
  return DEMO_SCREENS.some((sample) => sample.kind === row.kind && sample.answers === answers && sample.note === row.note);
}

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

export async function dropDemoRecords() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(DEMO_REMOVED) === "1") return;
  await db.transaction("rw", [db.checkIns, db.episodes, db.screenings, db.settings], async () => {
    const checkInIds = await db.checkIns.filter((row) => !row.clientId).primaryKeys();
    const episodeIds = await db.episodes.filter((row) => !row.clientId).primaryKeys();
    await db.checkIns.bulkDelete(checkInIds);
    await db.episodes.bulkDelete(episodeIds);
    const screens = await db.screenings.toArray();
    if (screens.some((row) => row.note === "Baseline")) {
      const ids = screens.flatMap((row) => (row.id !== undefined && isDemoScreen(row) ? [row.id] : []));
      await db.screenings.bulkDelete(ids);
    }
    if (checkInIds.length || episodeIds.length) {
      const profile = await db.settings.get("profile");
      if (profile?.patientName === "Alex Doe") await db.settings.delete("profile");
    }
  });
  localStorage.setItem(DEMO_REMOVED, "1");
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
}

export async function clearAll() {
  await Promise.all([db.checkIns.clear(), db.episodes.clear(), db.screenings.clear(), db.settings.clear()]);
}
