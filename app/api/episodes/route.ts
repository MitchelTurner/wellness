import { connection } from "next/server";
import { parseEpisode } from "@/lib/records";
import { deleteAllEpisodeRows, listEpisodeRows, saveEpisodeRow } from "@/lib/server-db";

export async function GET() {
  await connection();
  return Response.json(listEpisodeRows());
}

export async function POST(req: Request) {
  await connection();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const row = parseEpisode(body);
  if (!row) return Response.json({ error: "Invalid episode" }, { status: 400 });
  saveEpisodeRow(row);
  return Response.json(row);
}

export async function DELETE() {
  await connection();
  deleteAllEpisodeRows();
  return Response.json({ ok: true });
}
