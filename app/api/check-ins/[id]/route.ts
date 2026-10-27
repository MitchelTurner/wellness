import { connection } from "next/server";
import { requireUser } from "@/lib/api-user";
import { isClientId } from "@/lib/records";
import { deleteCheckInRow } from "@/lib/server-db";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { user, response } = await requireUser();
  if (!user) return response;
  const { id } = await ctx.params;
  if (!isClientId(id)) return Response.json({ error: "Invalid id" }, { status: 400 });
  deleteCheckInRow(user.id, id);
  return Response.json({ ok: true });
}
