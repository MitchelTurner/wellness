"use client";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { db } from "@/lib/db";
import { buildDailySeries, fmt, inRange, sleepMoodCorrelation } from "@/lib/analytics";
import { Card, Segmented, PageHeader, Empty } from "@/components/ui";

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

  const { series, corr } = useMemo(() => {
    if (!data) return { series: [], corr: null };
    const ci = inRange(data.checkIns, days);
    const series = buildDailySeries(days, ci, inRange(data.episodes, days), inRange(data.screenings, days)).map((p) => ({
      ...p,
      episodeMarker: p.episodePeak === null ? null : 5.5,
      screenMarker: p.phq9 ?? p.gad7,
    }));
    return { series, corr: sleepMoodCorrelation(ci) };
  }, [data, days]);

  return (
    <>
      <PageHeader kicker="Patterns" title="Trends" lede="Daily mood against hours of sleep. Dots mark acute events. Diamonds mark a screener." />
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
