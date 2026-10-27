import { connection } from "next/server";
import { parseCheckIn } from "@/lib/records";
import { deleteAllCheckInRows, listCheckInRows, saveCheckInRow } from "@/lib/server-db";

export async function GET() {
  await connection();
  return Response.json(listCheckInRows());
}

export async function POST(req: Request) {
  await connection();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const row = parseCheckIn(body);
  if (!row) return Response.json({ error: "Invalid check-in" }, { status: 400 });
  saveCheckInRow(row);
  return Response.json(row);
}

export async function DELETE() {
  await connection();
  deleteAllCheckInRows();
  return Response.json({ ok: true });
}
