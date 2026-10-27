"use client";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { db } from "@/lib/db";
import { buildDailySeries, fmt, frequency, inRange, sleepMoodCorrelation } from "@/lib/analytics";
import { Card, Segmented, PageHeader, Empty } from "@/components/ui";

function CountList({ label, rows }: { label: string; rows: { name: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div>
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{label}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted">None recorded.</p> : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.name} className="flex items-center gap-3 text-sm">
              <span className="w-44 shrink-0 leading-snug text-ink">{row.name}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
                <span className="block h-full rounded-full bg-forest" style={{ width: `${Math.max(8, (row.count / max) * 100)}%` }} />
              </span>
              <span className="w-5 shrink-0 text-right tabular-nums text-muted">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const tick = { fontSize: 11, fill: "#5c564e" };
const tip = {
  contentStyle: { background: "#161513", border: "none", borderRadius: 16, fontSize: 12, padding: "10px 12px" },
  labelStyle: { color: "#d9d3c7", marginBottom: 4 },
  itemStyle: { color: "#f4f1ea" },
};

export default function TrendsPage() {
  const [range, setRange] = useState<"14 days" | "30 days">("14 days");
  const days = range === "14 days" ? 14 : 30;
  const data = useLiveQuery(async () => ({
    checkIns: await db.checkIns.orderBy("timestamp").toArray(),
    episodes: await db.episodes.toArray(),
    screenings: await db.screenings.toArray(),
  }), []);

  const { series, corr, symptoms, affect } = useMemo(() => {
    if (!data) return { series: [], corr: null, symptoms: [], affect: [] };
    const ci = inRange(data.checkIns, days);
    const series = buildDailySeries(days, ci, inRange(data.episodes, days), inRange(data.screenings, days)).map((p) => ({
      ...p,
      episodeMarker: p.episodePeak === null ? null : 5.5,
      screenMarker: p.phq9 ?? p.gad7,
    }));
    return {
      series,
      corr: sleepMoodCorrelation(ci),
      symptoms: frequency(ci, "somatic").slice(0, 8),
      affect: frequency(ci, "affect").slice(0, 8),
    };
  }, [data, days]);

  return (
    <>
      <PageHeader kicker="Patterns" title="Trends" lede="Daily mood against hours of sleep, then the symptoms and feelings recorded on those check-ins. Dots mark acute events. Diamonds mark a screener." />
      <Card>
        <Segmented label="Range" options={["14 days", "30 days"] as const} value={range} onChange={setRange} />
        <div className="h-72 w-full" role="img" aria-label="Mood versus sleep hours chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#ece6dc" vertical={false} />
              <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval={days > 14 ? 3 : 1} />
              <YAxis yAxisId="mood" domain={[-6, 6]} tick={tick} axisLine={false} tickLine={false} width={28} />
              <YAxis yAxisId="sleep" orientation="right" domain={[0, 12]} tick={tick} axisLine={false} tickLine={false} width={28} />
              <Tooltip {...tip} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Line yAxisId="mood" type="monotone" dataKey="mood" name="Mood" stroke="#1c3d32" strokeWidth={2.25} dot={false} connectNulls />
              <Line yAxisId="sleep" type="monotone" dataKey="sleep" name="Sleep (h)" stroke="#a68446" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
              <Scatter yAxisId="mood" dataKey="episodeMarker" name="Acute episode" fill="#9f3d38" />
              <Scatter yAxisId="mood" dataKey="screenMarker" name="Screener" fill="#161513" shape="diamond" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Check-in symptoms">
        {symptoms.length || affect.length ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <CountList label="Symptoms" rows={symptoms} />
            <CountList label="Affect" rows={affect} />
          </div>
        ) : (
          <Empty>No symptoms recorded in this range.</Empty>
        )}
      </Card>
      <Card title="Sleep and mood">
        {corr && corr.lowCount > 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-sand/70 p-4">
                <div className="font-serif text-4xl italic tabular-nums text-ink">{corr.pct}%</div>
                <p className="mt-2 text-sm leading-relaxed text-muted">of sub-zero moods overlapped with sleep under 6 hours ({corr.lowCount} {corr.lowCount === 1 ? "entry" : "entries"}).</p>
              </div>
              <div className="rounded-2xl bg-sand/70 p-4">
                <div className="font-serif text-4xl italic tabular-nums text-ink">{corr.lowGivenShort === null ? "—" : `${corr.lowGivenShort}%`}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {corr.lowGivenShort === null ? "Not enough short nights to compare." : `of nights under 6 hours were followed by low mood (${corr.shortCount} ${corr.shortCount === 1 ? "entry" : "entries"}).`}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Average mood was <span className="font-medium text-ink">{fmt(corr.avgShort)}</span> after less than 6 hours, and <span className="font-medium text-ink">{fmt(corr.avgOk)}</span> with 6 hours or more.
            </p>
          </>
        ) : (
          <Empty>Not enough check-ins in this range to compare sleep and mood.</Empty>
        )}
      </Card>
    </>
  );
}
