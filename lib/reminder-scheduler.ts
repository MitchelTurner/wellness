import { reminderDecision } from "./reminder-time";
import { sendCheckInPush } from "./push-server";
import { claimReminder, deletePushSubscription, hasCheckInOnDate, listPushSubscriptions, listReminders, releaseReminder } from "./server-db";

let ticking = false;

export async function runReminderTick(now = new Date()) {
  if (ticking) return;
  ticking = true;
  try {
    for (const reminder of listReminders()) {
      let checkedInToday = false;
      try {
        checkedInToday = hasCheckInOnDate(reminder.userId, reminder.timeZone, now);
      } catch {
        continue;
      }
      const decision = reminderDecision({
        now,
        timeZone: reminder.timeZone,
        reminderTime: reminder.reminderTime,
        lastSentKey: reminder.lastSentKey,
        checkedInToday,
      });
      if (!decision.dateKey) continue;
      if (!decision.notify) {
        if (decision.markSent) claimReminder(reminder.userId, decision.dateKey);
        continue;
      }
      const subs = listPushSubscriptions(reminder.userId);
      if (!subs.length) continue;
      if (!claimReminder(reminder.userId, decision.dateKey)) continue;
      const results = await Promise.all(subs.map(async (sub) => {
        const result = await sendCheckInPush(sub);
        if (result === "gone") deletePushSubscription(reminder.userId, sub.endpoint);
        return result;
      }));
      if (!results.some((result) => result === "ok")) releaseReminder(reminder.userId, decision.dateKey);
    }
  } finally {
    ticking = false;
  }
}

const STARTED = Symbol.for("clintrack.reminderScheduler");

export function startReminderScheduler() {
  const g = globalThis as typeof globalThis & { [STARTED]?: boolean };
  if (g[STARTED]) return;
  g[STARTED] = true;
  void runReminderTick();
  const timer = setInterval(() => void runReminderTick(), 30_000);
  if (typeof timer === "object" && timer && "unref" in timer) timer.unref();
}
