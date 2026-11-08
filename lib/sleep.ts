import type { SleepQuality } from "./types";

export interface SleepMark {
  timestamp: number;
  kind: string;
}

export interface SleepEstimate {
  hours: number;
  quality: SleepQuality;
  start: number;
  end: number;
  wakes: number;
  /** Screen lock or a still phone, not only a gap between visits. */
  observed: boolean;
  /** Solid enough to fill the check-in before you edit it. */
  reliable: boolean;
}

const HOUR = 60 * 60 * 1000;
const MIN_BOUT = 30 * 60 * 1000;
const QUIET_GAP = 3 * HOUR;
const WAKE_MERGE = 8 * 60 * 1000;
const WAKE_MIN = 60 * 1000;
const LOOKBACK = 4 * HOUR;
const AWAKE = new Set(["unlocked", "moving", "input", "active"]);
const QUIET = new Set(["locked", "still"]);

export function nightWindow(now: number) {
  const date = new Date(now);
  const end = new Date(date);
  if (date.getHours() >= 14) end.setHours(14, 0, 0, 0);
  else end.setTime(now);
  const start = new Date(end);
  start.setHours(18, 0, 0, 0);
  if (start.getTime() >= end.getTime()) start.setDate(start.getDate() - 1);
  return { start: start.getTime(), end: end.getTime() };
}

function overlapsCoreSleep(start: number, end: number) {
  for (let t = start; t < end; t += 30 * 60 * 1000) {
    const hour = new Date(t).getHours();
    if (hour >= 21 || hour < 11) return true;
  }
  const hour = new Date(Math.max(start, end - 1)).getHours();
  return hour >= 21 || hour < 11;
}

function qualityFor(hours: number, wakes: number): SleepQuality {
  if (hours < 5 || wakes >= 3) return "Poor";
  if (hours >= 6.5 && hours <= 9 && wakes <= 1) return "Good";
  return "Fair";
}

interface QuietSpan {
  start: number;
  end: number;
  observed: boolean;
}

interface Bout {
  start: number;
  end: number;
  wakes: number;
  observedMs: number;
}

export function estimateSleep(marks: SleepMark[], now: number): SleepEstimate | null {
  if (!Number.isFinite(now)) return null;
  const window = nightWindow(now);
  const rangeStart = window.start - LOOKBACK;
  const rangeEnd = window.end;
  if (rangeEnd <= rangeStart) return null;

  const sorted = marks.filter((mark) => mark.timestamp <= rangeEnd).sort((a, b) => a.timestamp - b.timestamp);
  let mode: "awake" | "quiet" | "unknown" = "unknown";
  let quietObserved = false;
  let cursor = rangeStart;
  const spans: QuietSpan[] = [];

  function remember(kind: string) {
    if (QUIET.has(kind)) {
      mode = "quiet";
      quietObserved = true;
    } else if (AWAKE.has(kind)) {
      mode = "awake";
      quietObserved = false;
    }
  }

  function fillQuiet(until: number, closed: boolean) {
    if (until <= cursor || mode === "unknown") return;
    if (mode === "quiet") spans.push({ start: cursor, end: until, observed: quietObserved });
    else if (closed && until - cursor >= QUIET_GAP) spans.push({ start: cursor, end: until, observed: false });
  }

  for (const mark of sorted) {
    if (mark.timestamp < rangeStart) {
      remember(mark.kind);
      continue;
    }
    const at = Math.min(mark.timestamp, rangeEnd);
    fillQuiet(at, true);
    cursor = Math.max(cursor, at);
    remember(mark.kind);
  }
  // An open stretch after the last awake mark is not sleep. A screen that is
  // still locked can run through to now.
  fillQuiet(rangeEnd, false);

  const bouts: Bout[] = [];
  for (const span of spans) {
    if (span.end <= span.start) continue;
    const last = bouts[bouts.length - 1];
    const gap = last ? span.start - last.end : Number.POSITIVE_INFINITY;
    if (last && gap > 0 && gap < WAKE_MERGE) {
      if (gap >= WAKE_MIN) last.wakes += 1;
      last.end = span.end;
      if (span.observed) last.observedMs += span.end - span.start;
      continue;
    }
    bouts.push({
      start: span.start,
      end: span.end,
      wakes: 0,
      observedMs: span.observed ? span.end - span.start : 0,
    });
  }

  const ready = bouts
    .map((bout) => {
      const duration = bout.end - bout.start;
      return { ...bout, duration, observed: bout.observedMs >= duration * 0.7 };
    })
    .filter((bout) => bout.duration >= MIN_BOUT);
  const core = ready.filter((bout) => overlapsCoreSleep(bout.start, bout.end));
  const observedCore = core.filter((bout) => bout.observed && bout.duration >= 3 * HOUR);
  const pool = observedCore.length ? observedCore : core.length ? core : ready.filter((bout) => bout.observed);
  pool.sort((a, b) => b.duration - a.duration || b.end - a.end);
  const best = pool[0];
  if (!best) return null;

  const rawHours = best.duration / HOUR;
  const hours = Math.max(0.5, Math.min(14, Math.round(rawHours * 2) / 2));
  const observed = best.observedMs >= best.duration * 0.7;
  return {
    hours,
    quality: qualityFor(hours, best.wakes),
    start: best.start,
    end: best.end,
    wakes: best.wakes,
    observed,
    reliable: observed && rawHours >= 3 && rawHours <= 12 && best.wakes <= 4,
  };
}
