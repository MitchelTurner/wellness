import { connection } from "next/server";
import { loginAccount } from "@/lib/auth";

export async function POST(req: Request) {
  await connection();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const record = body as { username?: unknown; password?: unknown };
  if (typeof record.username !== "string" || typeof record.password !== "string") {
    return Response.json({ error: "Enter a username and password." }, { status: 400 });
  }
  const result = await loginAccount(record.username.trim(), record.password);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result);
}
