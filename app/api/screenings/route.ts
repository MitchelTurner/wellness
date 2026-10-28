import { connection } from "next/server";
import { requireUser } from "@/lib/api-user";
import { parseScreening } from "@/lib/records";
import { deleteAllScreeningRows, listScreeningRows, saveScreeningRow } from "@/lib/server-db";

export async function GET() {
  await connection();
  const { user, response } = await requireUser();
  if (!user) return response;
  return Response.json(listScreeningRows(user.id));
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
  const row = parseScreening(body);
  if (!row) return Response.json({ error: "Invalid screening" }, { status: 400 });
  if (!saveScreeningRow(user.id, row)) return Response.json({ error: "Not allowed" }, { status: 403 });
  return Response.json(row);
}

export async function DELETE() {
  await connection();
  const { user, response } = await requireUser();
  if (!user) return response;
  deleteAllScreeningRows(user.id);
  return Response.json({ ok: true });
}
