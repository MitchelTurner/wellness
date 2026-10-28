import type { CheckIn, Episode, Screening } from "./types";

const DAY = 86400000;

export function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function startOfRange(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime() - (days - 1) * DAY;
}

export function inRange<T extends { timestamp: number }>(items: T[], days: number): T[] {
  const start = startOfRange(days);
  return items.filter((i) => i.timestamp >= start);
}

export interface DayPoint {
  day: string;
  label: string;
  ts: number;
  mood: number | null;
  anxiety: number | null;
  sleep: number | null;
  episodePeak: number | null;
  phq9: number | null;
  gad7: number | null;
  phq9Score: number | null;
  gad7Score: number | null;
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function buildDailySeries(days: number, checkIns: CheckIn[], episodes: Episode[], screenings: Screening[]): DayPoint[] {
  const start = startOfRange(days);
  const out: DayPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = dayKey(d.getTime());
    const ci = checkIns.filter((c) => dayKey(c.timestamp) === key);
    const ep = episodes.filter((e) => dayKey(e.timestamp) === key);
    const phq = screenings.filter((s) => s.kind === "PHQ-9" && dayKey(s.timestamp) === key);
    const gad = screenings.filter((s) => s.kind === "GAD-7" && dayKey(s.timestamp) === key);
    const m = mean(ci.map((c) => c.mood));
    const a = mean(ci.map((c) => c.anxiety));
    const s = mean(ci.map((c) => c.sleepHours));
    const phqScore = mean(phq.map((row) => row.total));
    const gadScore = mean(gad.map((row) => row.total));
    out.push({
      day: key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      ts: d.getTime(),
      mood: m === null ? null : Math.round(m * 10) / 10,
      anxiety: a === null ? null : Math.round(a * 10) / 10,
      sleep: s === null ? null : Math.round(s * 10) / 10,
      episodePeak: ep.length ? Math.max(...ep.map((e) => e.peak)) : null,
      phq9: phq.length ? -5.5 : null,
      gad7: gad.length ? -5.5 : null,
      phq9Score: phqScore === null ? null : Math.round(phqScore * 10) / 10,
      gad7Score: gadScore === null ? null : Math.round(gadScore * 10) / 10,
    });
  }
  return out;
}

export function sleepMoodCorrelation(checkIns: CheckIn[]) {
  // "Mood dip" = mood below neutral (< 0) on the -5..+5 scale
  const lowMood = checkIns.filter((c) => c.mood < 0);
  const short = lowMood.filter((c) => c.sleepHours < 6);
  const pct = lowMood.length ? Math.round((short.length / lowMood.length) * 100) : null;
  const shortSleep = checkIns.filter((c) => c.sleepHours < 6);
  const lowGivenShort = shortSleep.length ? Math.round((shortSleep.filter((c) => c.mood < 0).length / shortSleep.length) * 100) : null;
  const meanOf = (a: CheckIn[]) => (a.length ? a.reduce((x, c) => x + c.mood, 0) / a.length : null);
  return { lowCount: lowMood.length, pct, lowGivenShort, shortCount: shortSleep.length, avgShort: meanOf(shortSleep), avgOk: meanOf(checkIns.filter((c) => c.sleepHours >= 6)) };
}

export function frequency(checkIns: CheckIn[], field: "somatic" | "functional" | "affect") {
  const m = new Map<string, number>();
  checkIns.forEach((c) => c[field].forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)));
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export function summaryMetrics(checkIns: CheckIn[], days: number) {
  const moods = checkIns.map((c) => c.mood);
  const daysWith = new Set(checkIns.map((c) => dayKey(c.timestamp))).size;
  const avg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  const first = checkIns.slice(0, Math.min(7, checkIns.length));
  const baseline = first.length ? first.reduce((a, c) => a + c.mood, 0) / first.length : null;
  return {
    total: checkIns.length,
    completion: Math.round((daysWith / days) * 100),
    mean: avg,
    baseline,
    lowest: moods.length ? Math.min(...moods) : null,
    highest: moods.length ? Math.max(...moods) : null,
  };
}

export function treatmentResponse(episodes: Episode[]) {
  const stats = new Map<string, { uses: number; relieved: number; partial: number }>();
  episodes.forEach((e) =>
    e.interventions.forEach((i) => {
      const label = i.detail?.trim() || i.name;
      const s = stats.get(label) ?? { uses: 0, relieved: 0, partial: 0 };
      s.uses++;
      if (i.response === "Relieved") s.relieved++;
      if (i.response === "Partial") s.partial++;
      stats.set(label, s);
    }),
  );
  return [...stats.entries()].map(([name, s]) => ({ name, ...s, efficacy: Math.round(((s.relieved + s.partial * 0.5) / s.uses) * 100) }));
}

export function moodChange(checkIns: CheckIn[], days: number) {
  const start = startOfRange(days);
  const priorStart = start - days * DAY;
  const current = checkIns.filter((c) => c.timestamp >= start);
  const prior = checkIns.filter((c) => c.timestamp >= priorStart && c.timestamp < start);
  if (!current.length || !prior.length) return null;
  const avg = (rows: CheckIn[]) => rows.reduce((sum, row) => sum + row.mood, 0) / rows.length;
  const delta = Math.round((avg(current) - avg(prior)) * 10) / 10;
  return Object.is(delta, -0) ? 0 : delta;
}

export const fmt = (n: number | null, d = 1) => (n === null ? "–" : n.toFixed(d));
export const fmtDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
export const toLocalInput = (ts: number) => {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};
