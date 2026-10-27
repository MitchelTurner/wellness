import { connection } from "next/server";
import { isClientId } from "@/lib/records";
import { deleteEpisodeRow } from "@/lib/server-db";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  if (!isClientId(id)) return Response.json({ error: "Invalid id" }, { status: 400 });
  deleteEpisodeRow(id);
  return Response.json({ ok: true });
}
