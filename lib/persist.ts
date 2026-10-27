import { db } from "./db";
import type { CheckInRecord, EpisodeRecord } from "./records";
import type { CheckIn, Episode } from "./types";

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

export async function saveCheckIn(input: Omit<CheckIn, "id" | "clientId">) {
  const record: CheckInRecord = { ...input, clientId: crypto.randomUUID() };
  await db.checkIns.add({ ...record });
  return postJson("/api/check-ins", record);
}

export async function saveEpisode(input: Omit<Episode, "id" | "clientId">) {
  const record: EpisodeRecord = { ...input, clientId: crypto.randomUUID() };
  await db.episodes.add({ ...record });
  return postJson("/api/episodes", record);
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

export async function pullServerRecords() {
  const [checkRes, episodeRes] = await Promise.all([fetch("/api/check-ins"), fetch("/api/episodes")]);
  if (!checkRes.ok || !episodeRes.ok) return;
  const checkIns = (await checkRes.json()) as CheckInRecord[];
  const episodes = (await episodeRes.json()) as EpisodeRecord[];
  await db.transaction("rw", [db.checkIns, db.episodes], async () => {
    for (const row of checkIns) await upsertLocalCheckIn(row);
    for (const row of episodes) await upsertLocalEpisode(row);
  });
}

export async function pushOwnedRecords() {
  const [checkIns, episodes] = await Promise.all([
    db.checkIns.filter((row) => !!row.clientId).toArray(),
    db.episodes.filter((row) => !!row.clientId).toArray(),
  ]);
  await Promise.all([
    ...checkIns.map((row) => postJson("/api/check-ins", withoutId(row))),
    ...episodes.map((row) => postJson("/api/episodes", withoutId(row))),
  ]);
}

export async function clearServerRecords() {
  await Promise.all([
    fetch("/api/check-ins", { method: "DELETE" }),
    fetch("/api/episodes", { method: "DELETE" }),
  ]);
}
