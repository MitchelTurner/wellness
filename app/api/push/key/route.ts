import { connection } from "next/server";
import { requireUser } from "@/lib/api-user";
import { pushPublicKey } from "@/lib/push-server";

export async function GET() {
  await connection();
  const { user, response } = await requireUser();
  if (!user) return response;
  return Response.json({ publicKey: pushPublicKey() });
}
