import { connection } from "next/server";
import { logoutAccount } from "@/lib/auth";

export async function POST() {
  await connection();
  await logoutAccount();
  return Response.json({ ok: true });
}
