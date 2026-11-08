import { connection } from "next/server";
import { requireUser } from "@/lib/api-user";
import { parseReminder } from "@/lib/records";
import { runReminderTick, startReminderScheduler } from "@/lib/reminder-scheduler";
import { countPushSubscriptions, deleteAllPushSubscriptions, deleteReminder, getReminder, upsertReminder } from "@/lib/server-db";

export async function GET() {
  await connection();
  startReminderScheduler();
  const { user, response } = await requireUser();
  if (!user) return response;
  const reminder = getReminder(user.id);
  return Response.json({
    reminderTime: reminder?.reminderTime ?? null,
    timeZone: reminder?.timeZone ?? null,
    devices: countPushSubscriptions(user.id),
  });
}

export async function PUT(req: Request) {
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
  const row = parseReminder(body);
  if (!row) return Response.json({ error: "Invalid reminder" }, { status: 400 });
  upsertReminder(user.id, row.reminderTime, row.timeZone);
  void runReminderTick();
  return Response.json({ ...row, devices: countPushSubscriptions(user.id) });
}

export async function DELETE() {
  await connection();
  startReminderScheduler();
  const { user, response } = await requireUser();
  if (!user) return response;
  deleteReminder(user.id);
  deleteAllPushSubscriptions(user.id);
  return Response.json({ ok: true });
}
