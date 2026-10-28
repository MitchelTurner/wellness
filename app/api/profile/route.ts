import { connection } from "next/server";
import { requireUser } from "@/lib/api-user";
import { parseProfile } from "@/lib/records";
import { deleteProfileRow, getProfileRow, saveProfileRow } from "@/lib/server-db";

export async function GET() {
  await connection();
  const { user, response } = await requireUser();
  if (!user) return response;
  return Response.json(getProfileRow(user.id));
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
  const row = parseProfile(body);
  if (!row) return Response.json({ error: "Invalid profile" }, { status: 400 });
  saveProfileRow(user.id, row);
  return Response.json(row);
}

export async function DELETE() {
  await connection();
  const { user, response } = await requireUser();
  if (!user) return response;
  deleteProfileRow(user.id);
  return Response.json({ ok: true });
}
