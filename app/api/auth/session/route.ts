import { connection } from "next/server";
import { currentUser, needsSetup } from "@/lib/auth";

export async function GET() {
  await connection();
  const user = await currentUser();
  return Response.json({ user: user ? { username: user.username } : null, needsSetup: needsSetup() });
}
