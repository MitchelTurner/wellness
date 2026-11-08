const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function localTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function localDateKey(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function parseReminderMinutes(reminderTime: string) {
  const match = TIME.exec(reminderTime);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function localMinutes(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return (hour === 24 ? 0 : hour) * 60 + minute;
}

export function isPastReminderTime(now: Date, timeZone: string, reminderTime: string) {
  const target = parseReminderMinutes(reminderTime);
  if (target === null) return false;
  try {
    const current = localMinutes(now, timeZone);
    return current !== null && current >= target;
  } catch {
    return false;
  }
}

/** Whether a check-in reminder should fire for this local day. */
export function reminderDecision(input: {
  now: Date;
  timeZone: string;
  reminderTime: string;
  lastSentKey: string | null;
  checkedInToday: boolean;
}) {
  let dateKey = "";
  try {
    dateKey = localDateKey(input.now, input.timeZone);
  } catch {
    return { dateKey, notify: false, markSent: false };
  }
  if (!isPastReminderTime(input.now, input.timeZone, input.reminderTime)) return { dateKey, notify: false, markSent: false };
  if (input.lastSentKey === dateKey) return { dateKey, notify: false, markSent: false };
  if (input.checkedInToday) return { dateKey, notify: false, markSent: true };
  return { dateKey, notify: true, markSent: true };
}

export function isCheckInDue(nowMs: number, reminderTime: string | undefined, checkInTimestamps: number[], timeZone = localTimeZone()) {
  if (!reminderTime) return false;
  const now = new Date(nowMs);
  let today = "";
  try {
    today = localDateKey(now, timeZone);
  } catch {
    return false;
  }
  const checkedInToday = checkInTimestamps.some((ts) => {
    try {
      return localDateKey(new Date(ts), timeZone) === today;
    } catch {
      return false;
    }
  });
  return reminderDecision({ now, timeZone, reminderTime, lastSentKey: null, checkedInToday }).notify;
}

export function formatReminderTime(reminderTime: string) {
  const minutes = parseReminderMinutes(reminderTime);
  if (minutes === null) return reminderTime;
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
