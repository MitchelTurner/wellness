import { connection } from "next/server";
import { requireUser } from "@/lib/api-user";
import { parseEpisode } from "@/lib/records";
import { deleteAllEpisodeRows, listEpisodeRows, saveEpisodeRow } from "@/lib/server-db";

export async function GET() {
  await connection();
  const { user, response } = await requireUser();
  if (!user) return response;
  return Response.json(listEpisodeRows(user.id));
}

export async function POST(req: Request) {
  await connection();
  const { user, response } = await requireUser();
  if (!user) return response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const row = parseEpisode(body);
  if (!row) return Response.json({ error: "Invalid episode" }, { status: 400 });
  if (!saveEpisodeRow(user.id, row)) return Response.json({ error: "Not allowed" }, { status: 403 });
  return Response.json(row);
}

export async function DELETE() {
  await connection();
  const { user, response } = await requireUser();
  if (!user) return response;
  deleteAllEpisodeRows(user.id);
  return Response.json({ ok: true });
}
