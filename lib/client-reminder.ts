import { db } from "./db";
import { localDateKey, localTimeZone } from "./reminder-time";

const PUSH_FLAG = "clintrack-push";

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64: string) {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function hasCheckedInToday() {
  const timeZone = localTimeZone();
  const today = localDateKey(new Date(), timeZone);
  const since = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const rows = await db.checkIns.where("timestamp").above(since).toArray();
  return rows.some((row) => localDateKey(new Date(row.timestamp), timeZone) === today);
}

async function subscribeForReminders() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  const registration = await registerServiceWorker();
  if (!registration) return false;
  let keyRes: Response;
  try {
    keyRes = await fetch("/api/push/key");
  } catch {
    return false;
  }
  if (!keyRes.ok) return false;
  const { publicKey } = (await keyRes.json()) as { publicKey?: string };
  if (!publicKey) return false;
  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  try {
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  } catch {
    await subscription?.unsubscribe().catch(() => {});
    try {
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    } catch {
      return false;
    }
  }
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false;
  try {
    const saved = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }),
    });
    return saved.ok;
  } catch {
    return false;
  }
}

export async function syncReminder(reminderTime: string) {
  const timeZone = localTimeZone();
  try {
    const res = await fetch("/api/reminder", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reminderTime, timeZone }),
    });
    if (!res.ok) return { saved: false, push: false };
  } catch {
    return { saved: false, push: false };
  }
  const push = await subscribeForReminders();
  if (push) localStorage.setItem(PUSH_FLAG, "1");
  else localStorage.removeItem(PUSH_FLAG);
  return { saved: true, push };
}

export async function unsubscribeThisDevice() {
  localStorage.removeItem(PUSH_FLAG);
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch {
    // The browser subscription is still removed below.
  }
  await subscription.unsubscribe().catch(() => {});
}

export async function clearReminder() {
  await unsubscribeThisDevice();
  try {
    await fetch("/api/reminder", { method: "DELETE" });
  } catch {
    // The on-device reminder is already off.
  }
}

let ensured = false;

export async function ensureReminderPush() {
  if (ensured) return;
  ensured = true;
  const local = await db.settings.get("reminder");
  if (!local?.reminderTime) {
    try {
      const res = await fetch("/api/reminder");
      if (res.ok) {
        const data = (await res.json()) as { reminderTime?: string | null };
        if (data.reminderTime) await db.settings.put({ key: "reminder", reminderTime: data.reminderTime });
      }
    } catch {
      // The reminder still works on this device once it is saved here.
    }
  }
  const row = await db.settings.get("reminder");
  if (!row?.reminderTime || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  await syncReminder(row.reminderTime);
}

export async function syncStoredReminder() {
  const row = await db.settings.get("reminder");
  if (!row?.reminderTime) return;
  await syncReminder(row.reminderTime);
}

export function pushAlertsEnabled() {
  return localStorage.getItem(PUSH_FLAG) === "1";
}
