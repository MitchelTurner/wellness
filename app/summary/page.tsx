"use client";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Printer } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { db } from "@/lib/db";
import { buildDailySeries, countTags, fmt, fmtDate, frequency, inRange, moodChange, summaryMetrics, treatmentResponse } from "@/lib/analytics";
import { severity } from "@/lib/scoring";
import { STEADY_FUNCTION } from "@/lib/types";
import { Segmented, primaryBtn, PageHeader } from "@/components/ui";

function Bars({ rows }: { rows: { name: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="text-xs text-muted">None recorded.</p>;
  return (
    <ul className="space-y-1">
      {rows.slice(0, 5).map((r) => (
        <li key={r.name} className="flex items-center gap-2 text-xs">
          <span className="w-36 shrink-0 truncate leading-tight" title={r.name}>{r.name}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
            <span className="block h-full rounded-full bg-forest" style={{ width: `${Math.max(4, (r.count / max) * 100)}%` }} />
          </span>
          <span className="w-4 shrink-0 text-right font-medium tabular-nums">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

const H = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-1.5 border-b border-ink/15 pb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-ink">{children}</h3>
);

export default function SummaryPage() {
  const [range, setRange] = useState<"14 days" | "30 days" | "90 days">("30 days");
  const days = parseInt(range);
  const profile = useLiveQuery(() => db.settings.get("profile"), []);
  const name = profile?.patientName ?? "";
  const data = useLiveQuery(async () => ({
    checkIns: await db.checkIns.orderBy("timestamp").toArray(),
    episodes: await db.episodes.toArray(),
    screenings: await db.screenings.orderBy("timestamp").toArray(),
  }), []);

  const r = useMemo(() => {
    if (!data) return null;
    const ci = inRange(data.checkIns, days);
    const ep = inRange(data.episodes, days);
    return {
      m: summaryMetrics(ci, days),
      ep,
      series: buildDailySeries(days, ci, [], []),
      somatic: countTags([...ci.map((row) => row.somatic), ...ep.map((row) => row.somatic)]),
      affect: frequency(ci, "affect"),
      functional: frequency(ci, "functional").filter((f) => !STEADY_FUNCTION.has(f.name)),
      treat: treatmentResponse(ep),
      moodDelta: moodChange(data.checkIns, days),
      prnUses: ep.reduce((n, row) => n + row.interventions.filter((item) => item.name === "PRN Medication").length, 0),
      screens: (["PHQ-9", "GAD-7"] as const).map((k) => data.screenings.filter((s) => s.kind === k).slice(-2).reverse()),
    };
  }, [data, days]);

  const [end, setEnd] = useState(0);
  useEffect(() => { const t = setTimeout(() => setEnd(Date.now()), 0); return () => clearTimeout(t); }, []);
  const start = end - (days - 1) * 86400000;

  return (
    <>
      <div className="no-print">
        <PageHeader kicker="For your clinician" title="Summary" lede="One page for a visit. Print it, or save it as a PDF." />
        <Segmented label="Report range" options={["14 days", "30 days", "90 days"] as const} value={range} onChange={setRange} />
        <button className={`${primaryBtn} mb-6`} onClick={() => window.print()}><Printer size={16} /> Print or save PDF</button>
      </div>
      {r && end > 0 && (
        <article className="print-page mx-auto max-w-[210mm] rounded-2xl border border-line bg-white p-5 text-ink shadow-[0_30px_60px_-42px_rgba(22,21,19,0.7)]">
          <header className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-ink pb-2">
            <div>
              <h2 className="font-serif text-2xl italic leading-none">Clinical summary</h2>
              <div className="mt-1 text-sm">Patient: <b>{name || "________________"}</b></div>
            </div>
            <div className="text-right text-xs text-muted">
              <div className="text-ink">{fmtDate(start)} – {fmtDate(end)}</div>
              <div>Past {days} days · {r.m.total} check-ins · {r.m.completion}% of days</div>
            </div>
          </header>

          <section className="mb-3 grid grid-cols-2 gap-1.5 text-center sm:grid-cols-5">
            {[["Mean mood", fmt(r.m.mean)], ["Baseline, first week", fmt(r.m.baseline)], ["Lowest", fmt(r.m.lowest, 0)], ["Highest", fmt(r.m.highest, 0)], ["Acute episodes", String(r.ep.length)]].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-line px-1 py-1.5">
                <div className="font-serif text-xl italic leading-none tabular-nums">{v}</div>
                <div className="mt-1 text-[10px] leading-tight text-muted">{l}</div>
              </div>
            ))}
          </section>
          <p className="mb-3 text-[10px] text-muted">Mood scale: −5 very low to +5 very high.</p>
          {r.moodDelta !== null && (
            <p className="mb-3 text-sm text-ink">Mean mood {r.moodDelta > 0 ? `+${r.moodDelta.toFixed(1)}` : r.moodDelta.toFixed(1)} vs the prior {days} days.</p>
          )}

          <section className="mb-3 break-inside-avoid">
            <H>Mood trajectory, daily average</H>
            {r.series.some((point) => point.mood !== null) ? (
              <div className="h-24 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={r.series} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
                    <YAxis domain={[-5, 5]} hide />
                    <Line type="monotone" dataKey="mood" stroke="#1c3d32" strokeWidth={2} dot={{ r: 2, fill: "#1c3d32", strokeWidth: 0 }} connectNulls={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-xs">No check-ins in this range.</p>}
          </section>

          <section className="mb-3 break-inside-avoid">
            <H>Affect, days</H>
            <Bars rows={r.affect} />
          </section>
          <section className="mb-3 grid grid-cols-1 gap-3 break-inside-avoid sm:grid-cols-2">
            <div><H>Symptoms, days</H><Bars rows={r.somatic} /></div>
            <div><H>Functional impairments, days</H><Bars rows={r.functional} /></div>
          </section>

          <section className="mb-3 break-inside-avoid">
            <H>Acute episodes and treatment response</H>
            {r.ep.length === 0 ? <p className="text-xs">No acute episodes.</p> : (
              <>
                <p className="mb-1 text-xs">
                  {r.ep.length} episodes · mean peak {fmt(r.ep.reduce((a, e) => a + e.peak, 0) / r.ep.length)}/10 · mean duration {fmt(r.ep.reduce((a, e) => a + e.durationMin, 0) / r.ep.length, 0)} min
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[28rem] text-xs">
                    <thead><tr className="border-b border-line text-left text-muted"><th className="py-1 font-medium">Intervention</th><th className="font-medium">Uses</th><th className="font-medium">Relieved</th><th className="font-medium">Partial</th><th className="font-medium">Efficacy*</th></tr></thead>
                    <tbody>
                      {r.treat.map((t) => (
                        <tr key={t.name} className="border-b border-line/70"><td className="py-1">{t.name}</td><td className="tabular-nums">{t.uses}</td><td className="tabular-nums">{t.relieved}</td><td className="tabular-nums">{t.partial}</td><td className="tabular-nums">{t.efficacy}%</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-[10px] text-muted">*Relieved = 100%, Partial = 50%, No change = 0%. PRN medication used in {r.prnUses} episodes.</p>
              </>
            )}
          </section>

          <section className="break-inside-avoid">
            <H>Validated screeners</H>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-xs">
                <thead><tr className="border-b border-line text-left text-muted"><th className="py-1 font-medium">Scale</th><th className="font-medium">Latest</th><th className="font-medium">Previous</th><th className="font-medium">Change</th></tr></thead>
                <tbody>
                  {(["PHQ-9", "GAD-7"] as const).map((k, i) => {
                    const [latest, prev] = r.screens[i];
                    return (
                      <tr key={k} className="border-b border-line/70">
                        <td className="py-1">{k}</td>
                        <td>{latest ? `${latest.total} ${severity(k, latest.total)} (${fmtDate(latest.timestamp)})` : "–"}</td>
                        <td>{prev ? `${prev.total} ${severity(k, prev.total)} (${fmtDate(prev.timestamp)})` : "–"}</td>
                        <td>{latest && prev ? `${latest.total - prev.total > 0 ? "+" : ""}${latest.total - prev.total}` : "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-muted">Self-reported. Screeners are not diagnostic. ClinTrack · {fmtDate(end)}.</p>
          </section>
        </article>
      )}
    </>
  );
}
