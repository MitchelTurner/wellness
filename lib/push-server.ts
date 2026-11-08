import fs from "fs";
import path from "path";
import { generateVAPIDKeys, sendNotification, setVapidDetails, WebPushError } from "web-push";

type Keys = { publicKey: string; privateKey: string };

function vapidKeys(): Keys {
  const file = path.join(process.cwd(), "data", "vapid.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<Keys>;
    if (parsed.publicKey && parsed.privateKey) return { publicKey: parsed.publicKey, privateKey: parsed.privateKey };
  } catch {
    // Create a key on first use. It stays in data/, which is not part of the backup.
  }
  const keys = generateVAPIDKeys();
  fs.writeFileSync(file, JSON.stringify(keys), { mode: 0o600 });
  return keys;
}

export function pushPublicKey() {
  return vapidKeys().publicKey;
}

function statusOf(error: unknown) {
  if (error instanceof WebPushError) return error.statusCode;
  if (typeof error === "object" && error && "statusCode" in error && typeof (error as { statusCode: unknown }).statusCode === "number") {
    return (error as { statusCode: number }).statusCode;
  }
  return 0;
}

export async function sendCheckInPush(sub: { endpoint: string; p256dh: string; auth: string }) {
  const keys = vapidKeys();
  setVapidDetails("mailto:clintrack@example.com", keys.publicKey, keys.privateKey);
  try {
    await sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({
        title: "Time to check in",
        body: "You have not checked in today. A minute for mood, sleep, and how the day went.",
      }),
      { TTL: 2 * 60 * 60, urgency: "high", topic: "clintrack-checkin" },
    );
    return "ok" as const;
  } catch (error) {
    const status = statusOf(error);
    if (status === 404 || status === 410) return "gone" as const;
    return "error" as const;
  }
}
