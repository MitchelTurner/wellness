import { connection } from "next/server";
import { changePassword } from "@/lib/auth";

export async function POST(req: Request) {
  await connection();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const record = body as { current?: unknown; next?: unknown };
  if (typeof record.current !== "string" || typeof record.next !== "string") {
    return Response.json({ error: "Enter the current password and a new one." }, { status: 400 });
  }
  const result = await changePassword(record.current, record.next);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result);
}
