import { connection } from "next/server";
import { requireUser } from "@/lib/api-user";
import { parsePushEndpoint, parsePushSubscription } from "@/lib/records";
import { runReminderTick, startReminderScheduler } from "@/lib/reminder-scheduler";
import { deleteAllPushSubscriptions, deletePushSubscription, savePushSubscription } from "@/lib/server-db";

export async function POST(req: Request) {
  await connection();
  startReminderScheduler();
  const { user, response } = await requireUser();
  if (!user) return response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const sub = parsePushSubscription(body);
  if (!sub) return Response.json({ error: "Invalid subscription" }, { status: 400 });
  savePushSubscription(user.id, sub);
  void runReminderTick();
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  await connection();
  startReminderScheduler();
  const { user, response } = await requireUser();
  if (!user) return response;
  const url = new URL(req.url);
  if (url.searchParams.get("all") === "1") {
    deleteAllPushSubscriptions(user.id);
    return Response.json({ ok: true });
  }
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const endpoint = parsePushEndpoint(body);
  if (!endpoint) return Response.json({ error: "Invalid subscription" }, { status: 400 });
  deletePushSubscription(user.id, endpoint);
  return Response.json({ ok: true });
}
