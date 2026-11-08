import { db } from "./db";
import type { ActivityKind } from "./types";

type IdleScreen = "locked" | "unlocked";
type IdleUser = "active" | "idle";

interface IdleDetectorLike {
  screenState: IdleScreen;
  userState: IdleUser;
  start: (options: { threshold: number; signal?: AbortSignal }) => Promise<void>;
  addEventListener: (type: "change", listener: () => void) => void;
}

type IdleDetectorCtor = {
  new (): IdleDetectorLike;
  requestPermission?: () => Promise<PermissionState>;
};

type SleepPermission = "granted" | "denied" | "unsupported";

let stopCurrent: (() => void) | null = null;

function idleCtor() {
  return (window as Window & { IdleDetector?: IdleDetectorCtor }).IdleDetector;
}

function motionCtor() {
  return DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<PermissionState> };
}

export function requestSleepPermissions() {
  const idleApi = idleCtor();
  const idle = idleApi?.requestPermission
    ? idleApi.requestPermission().then((state) => (state === "granted" ? "granted" : "denied") as SleepPermission).catch(() => "denied" as const)
    : Promise.resolve(idleApi ? "granted" as const : "unsupported" as const);
  const motionApi = typeof DeviceMotionEvent === "undefined" ? null : motionCtor();
  const motion = motionApi?.requestPermission
    ? motionApi.requestPermission().then((state) => (state === "granted" ? "granted" : "denied") as SleepPermission).catch(() => "denied" as const)
    : Promise.resolve(motionApi ? "granted" as const : "unsupported" as const);
  return Promise.all([idle, motion]).then(([screen, movement]) => ({ screen, movement }));
}

async function mark(kind: ActivityKind) {
  const now = Date.now();
  const last = await db.activity.orderBy("timestamp").last();
  if (last && last.kind === kind && now - last.timestamp < 4 * 60 * 1000) return;
  await db.activity.add({ timestamp: now, kind });
}

async function prune() {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const old = await db.activity.where("timestamp").below(cutoff).primaryKeys();
  if (old.length) await db.activity.bulkDelete(old);
}

export function startSleepWatch() {
  if (stopCurrent || typeof window === "undefined") return;
  const abort = new AbortController();
  const { signal } = abort;
  let heartbeat = 0;
  stopCurrent = () => {
    stopCurrent = null;
    window.clearInterval(heartbeat);
    abort.abort();
  };
  let screenLocked: boolean | null = null;
  let motionQuiet: boolean | null = null;
  const magnitudes: number[] = [];
  let lastMotion = 0;

  heartbeat = window.setInterval(() => {
    if (screenLocked === true) void mark("locked");
    else if (document.visibilityState === "visible") void mark("active");
    else if (motionQuiet === true) void mark("still");
    void prune();
  }, 5 * 60 * 1000);

  const onInput = () => {
    if (screenLocked) return;
    void mark("input");
  };
  window.addEventListener("pointerdown", onInput, { signal, passive: true });
  window.addEventListener("keydown", onInput, { signal });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && screenLocked !== true) void mark("active");
  }, { signal });

  window.addEventListener("devicemotion", (event) => {
    const now = Date.now();
    if (now - lastMotion < 500) return;
    lastMotion = now;
    const accel = event.accelerationIncludingGravity;
    if (!accel || accel.x === null || accel.y === null || accel.z === null) return;
    const magnitude = Math.hypot(accel.x, accel.y, accel.z);
    magnitudes.push(magnitude);
    if (magnitudes.length > 12) magnitudes.shift();
    if (magnitudes.length < 8) return;
    const mean = magnitudes.reduce((sum, value) => sum + value, 0) / magnitudes.length;
    const variance = magnitudes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / magnitudes.length;
    const still = Math.sqrt(variance) < 0.12;
    if (motionQuiet === still) return;
    motionQuiet = still;
    if (screenLocked === true || document.visibilityState === "visible") return;
    void mark(still ? "still" : "moving");
  }, { signal });

  if (document.visibilityState === "visible") void mark("active");
  void prune();

  const Idle = idleCtor();
  if (Idle) {
    const detector = new Idle();
    detector.addEventListener("change", () => {
      screenLocked = detector.screenState === "locked";
      void mark(screenLocked ? "locked" : "unlocked");
      if (!screenLocked && detector.userState === "active") void mark("active");
    });
    detector.start({ threshold: 60_000, signal }).then(() => {
      if (signal.aborted) return;
      screenLocked = detector.screenState === "locked";
      void mark(screenLocked ? "locked" : "unlocked");
    }).catch(() => {});
  }
}

export function stopSleepWatch() {
  stopCurrent?.();
}
