import { db } from "./db";
import type { CheckInRecord, EpisodeRecord, ProfileRecord, ScreeningRecord } from "./records";
import type { CheckIn, Episode, Screening } from "./types";

function withoutId<T extends { id?: number }>(row: T): Omit<T, "id"> {
  const { id, ...rest } = row;
  void id;
  return rest;
}

async function postJson(url: string, body: unknown) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function upsertLocalCheckIn(row: CheckInRecord) {
  const existing = await db.checkIns.where("clientId").equals(row.clientId).first();
  if (existing?.id !== undefined) await db.checkIns.update(existing.id, row);
  else await db.checkIns.add(row);
}

async function upsertLocalEpisode(row: EpisodeRecord) {
  const existing = await db.episodes.where("clientId").equals(row.clientId).first();
  if (existing?.id !== undefined) await db.episodes.update(existing.id, row);
  else await db.episodes.add(row);
}

async function upsertLocalScreening(row: ScreeningRecord) {
  const existing = await db.screenings.where("clientId").equals(row.clientId).first();
  if (existing?.id !== undefined) await db.screenings.update(existing.id, row);
  else await db.screenings.add(row);
}

export async function saveCheckIn(input: Omit<CheckIn, "id" | "clientId"> & { clientId?: string }) {
  const record: CheckInRecord = { ...input, clientId: input.clientId || crypto.randomUUID() };
  await upsertLocalCheckIn(record);
  return postJson("/api/check-ins", record);
}

export async function saveEpisode(input: Omit<Episode, "id" | "clientId">) {
  const record: EpisodeRecord = { ...input, clientId: crypto.randomUUID() };
  await db.episodes.add({ ...record });
  return postJson("/api/episodes", record);
}

export async function saveScreening(input: Omit<Screening, "id" | "clientId">) {
  const record: ScreeningRecord = { ...input, clientId: crypto.randomUUID() };
  await upsertLocalScreening(record);
  return postJson("/api/screenings", record);
}

export async function saveProfile(profile: ProfileRecord) {
  await db.settings.put({ key: "profile", patientName: profile.patientName, medications: profile.medications });
  return postJson("/api/profile", profile);
}

export async function deleteStoredCheckIn(row: CheckIn) {
  if (row.id !== undefined) await db.checkIns.delete(row.id);
  if (!row.clientId) return true;
  try {
    const res = await fetch(`/api/check-ins/${row.clientId}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteStoredEpisode(row: Episode) {
  if (row.id !== undefined) await db.episodes.delete(row.id);
  if (!row.clientId) return true;
  try {
    const res = await fetch(`/api/episodes/${row.clientId}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteStoredScreening(row: Screening) {
  if (row.id !== undefined) await db.screenings.delete(row.id);
  if (!row.clientId) return true;
  try {
    const res = await fetch(`/api/screenings/${row.clientId}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pullServerRecords() {
  const [checkRes, episodeRes, screeningRes, profileRes] = await Promise.all([
    fetch("/api/check-ins"),
    fetch("/api/episodes"),
    fetch("/api/screenings"),
    fetch("/api/profile"),
  ]);
  if (!checkRes.ok || !episodeRes.ok || !screeningRes.ok || !profileRes.ok) return;
  const checkIns = (await checkRes.json()) as CheckInRecord[];
  const episodes = (await episodeRes.json()) as EpisodeRecord[];
  const screenings = (await screeningRes.json()) as ScreeningRecord[];
  const profile = (await profileRes.json()) as ProfileRecord | null;
  await db.transaction("rw", [db.checkIns, db.episodes, db.screenings, db.settings], async () => {
    for (const row of checkIns) await upsertLocalCheckIn(row);
    for (const row of episodes) await upsertLocalEpisode(row);
    for (const row of screenings) await upsertLocalScreening(row);
    if (profile && typeof profile.patientName === "string" && Array.isArray(profile.medications)) {
      await db.settings.put({ key: "profile", patientName: profile.patientName, medications: profile.medications });
    }
  });
}

async function screeningsReadyToPush() {
  const rows = await db.screenings.toArray();
  for (const row of rows) {
    if (!row.clientId && row.id !== undefined) {
      row.clientId = crypto.randomUUID();
      await db.screenings.update(row.id, { clientId: row.clientId });
    }
  }
  return rows.filter((row) => !!row.clientId);
}

export async function pushOwnedRecords() {
  const [checkIns, episodes, screenings, profile] = await Promise.all([
    db.checkIns.filter((row) => !!row.clientId).toArray(),
    db.episodes.filter((row) => !!row.clientId).toArray(),
    screeningsReadyToPush(),
    db.settings.get("profile"),
  ]);
  const results = await Promise.all([
    ...checkIns.map((row) => postJson("/api/check-ins", withoutId(row))),
    ...episodes.map((row) => postJson("/api/episodes", withoutId(row))),
    ...screenings.map((row) => postJson("/api/screenings", withoutId(row))),
    profile ? postJson("/api/profile", { patientName: profile.patientName ?? "", medications: profile.medications ?? [] }) : Promise.resolve(true),
  ]);
  return results.every(Boolean);
}

export async function signOut() {
  const pushed = await pushOwnedRecords();
  await fetch("/api/auth/logout", { method: "POST" });
  if (pushed) {
    await db.checkIns.clear();
    await db.episodes.clear();
    await db.screenings.clear();
    await db.settings.delete("profile");
  }
  // Full load so the signed-out document is requested with the cleared cookie.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/login";
}

export async function clearServerRecords() {
  await Promise.all([
    fetch("/api/check-ins", { method: "DELETE" }),
    fetch("/api/episodes", { method: "DELETE" }),
    fetch("/api/screenings", { method: "DELETE" }),
    fetch("/api/profile", { method: "DELETE" }),
  ]);
}
