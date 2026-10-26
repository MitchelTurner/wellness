"use client";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Printer } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { db, getPatientName } from "@/lib/db";
import { buildDailySeries, fmt, fmtDate, frequency, inRange, summaryMetrics, treatmentResponse } from "@/lib/analytics";
import { severity } from "@/lib/scoring";
import { Segmented, primaryBtn } from "@/components/ui";

function Bars({ rows }: { rows: { name: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="text-xs">None recorded.</p>;
  return (
    <ul className="space-y-0.5">
      {rows.slice(0, 5).map((r) => (
        <li key={r.name} className="flex items-center gap-2 text-xs">
          <span className="w-32 shrink-0 truncate">{r.name}</span>
          <span className="h-2.5 rounded bg-teal-700" style={{ width: `${(r.count / max) * 100}%`, minWidth: 2 }} />
          <span className="font-semibold">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-1 border-b border-slate-400 text-xs font-bold uppercase tracking-wide text-slate-800">{children}</h3>;

export default function SummaryPage() {
  const [range, setRange] = useState<"14 days" | "30 days" | "90 days">("30 days");
  const days = parseInt(range);
  const [name, setName] = useState("");
  useEffect(() => { getPatientName().then(setName); }, []);
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
      somatic: frequency(ci, "somatic"),
      functional: frequency(ci, "functional").filter((f) => !["Normal activity", "High productivity"].includes(f.name)),
      treat: treatmentResponse(ep),
      screens: (["PHQ-9", "GAD-7"] as const).map((k) => data.screenings.filter((s) => s.kind === k).slice(-2).reverse()),
    };
  }, [data, days]);

  const [end, setEnd] = useState(0);
  useEffect(() => { const t = setTimeout(() => setEnd(Date.now()), 0); return () => clearTimeout(t); }, []);
  const start = end - (days - 1) * 86400000;

  return (
    <>
      <div className="no-print mb-3">
        <Segmented label="Report range" options={["14 days", "30 days", "90 days"] as const} value={range} onChange={setRange} />
        <button className={`${primaryBtn} flex items-center justify-center gap-2`} onClick={() => window.print()}><Printer size={20} /> Print / Save as PDF</button>
      </div>
      {r && end > 0 && (
        <article className="print-page mx-auto max-w-[210mm] rounded border border-slate-300 bg-white p-4 text-slate-900 shadow-sm">
          <header className="mb-2 flex flex-wrap items-end justify-between border-b-2 border-slate-900 pb-2">
            <div>
              <h2 className="text-lg font-bold">ClinTrack – Clinical Summary</h2>
              <div className="text-sm">Patient: <b>{name || "________________"}</b></div>
            </div>
            <div className="text-right text-xs">
              <div>{fmtDate(start)} – {fmtDate(end)} (Past {days} days)</div>
              <div>Check-ins: <b>{r.m.total}</b> · Completion: <b>{r.m.completion}%</b> of days</div>
            </div>
          </header>

          <section className="mb-2 grid grid-cols-5 gap-1 text-center">
            {[["Mean mood", fmt(r.m.mean)], ["Baseline (first wk)", fmt(r.m.baseline)], ["Lowest", fmt(r.m.lowest, 0)], ["Highest", fmt(r.m.highest, 0)], ["Acute episodes", String(r.ep.length)]].map(([l, v]) => (
              <div key={l} className="rounded border border-slate-400 p-1">
                <div className="text-lg font-bold">{v}</div>
                <div className="text-[10px] leading-tight">{l}</div>
              </div>
            ))}
          </section>
          <p className="mb-2 text-[10px]">Mood scale: −5 (very low) to +5 (very high).</p>

          <section className="mb-2">
            <H>Mood trajectory (daily average)</H>
            <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={r.series} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
                  <YAxis domain={[-5, 5]} hide />
                  <Line type="monotone" dataKey="mood" stroke="#0f766e" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="mb-2 grid grid-cols-2 gap-3">
            <div><H>Top somatic complaints (days)</H><Bars rows={r.somatic} /></div>
            <div><H>Functional impairments (days)</H><Bars rows={r.functional} /></div>
          </section>

          <section className="mb-2">
            <H>Acute episodes &amp; treatment response</H>
            {r.ep.length === 0 ? <p className="text-xs">No acute episodes.</p> : (
              <>
                <p className="mb-1 text-xs">
                  {r.ep.length} episodes · mean peak {fmt(r.ep.reduce((a, e) => a + e.peak, 0) / r.ep.length)}/10 · mean duration {fmt(r.ep.reduce((a, e) => a + e.durationMin, 0) / r.ep.length, 0)} min
                </p>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-400 text-left"><th>Intervention</th><th>Uses</th><th>Relieved</th><th>Partial</th><th>Efficacy*</th></tr></thead>
                  <tbody>
                    {r.treat.map((t) => (
                      <tr key={t.name}><td>{t.name}</td><td>{t.uses}</td><td>{t.relieved}</td><td>{t.partial}</td><td>{t.efficacy}%</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[10px]">*Relieved = 100%, Partial = 50%, No change = 0%. PRN medication used in {r.treat.find((t) => t.name === "PRN Medication")?.uses ?? 0} episodes.</p>
              </>
            )}
          </section>

          <section>
            <H>Validated screeners</H>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-slate-400 text-left"><th>Scale</th><th>Latest</th><th>Previous</th><th>Change</th></tr></thead>
              <tbody>
                {(["PHQ-9", "GAD-7"] as const).map((k, i) => {
                  const [latest, prev] = r.screens[i];
                  return (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{latest ? `${latest.total} ${severity(k, latest.total)} (${fmtDate(latest.timestamp)})` : "–"}</td>
                      <td>{prev ? `${prev.total} ${severity(k, prev.total)} (${fmtDate(prev.timestamp)})` : "–"}</td>
                      <td>{latest && prev ? `${latest.total - prev.total > 0 ? "+" : ""}${latest.total - prev.total}` : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-1 text-[10px]">Self-reported data; screeners are not diagnostic. Generated by ClinTrack {fmtDate(end)}.</p>
          </section>
        </article>
      )}
    </>
  );
}
