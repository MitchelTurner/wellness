"use client";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { db } from "@/lib/db";
import { buildDailySeries, fmt, inRange, sleepMoodCorrelation } from "@/lib/analytics";
import { Card, Segmented } from "@/components/ui";

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
      <Card title="Mood vs. sleep">
        <Segmented label="Range" options={["14 days", "30 days"] as const} value={range} onChange={setRange} />
        <div className="h-72 w-full" role="img" aria-label="Mood versus sleep hours chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" fontSize={11} interval={days > 14 ? 3 : 1} />
              <YAxis yAxisId="mood" domain={[-6, 6]} fontSize={11} />
              <YAxis yAxisId="sleep" orientation="right" domain={[0, 12]} fontSize={11} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="mood" type="monotone" dataKey="mood" name="Mood" stroke="#0f766e" strokeWidth={2} connectNulls />
              <Line yAxisId="sleep" type="monotone" dataKey="sleep" name="Sleep (h)" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 3" connectNulls />
              <Scatter yAxisId="mood" dataKey="episodeMarker" name="Acute episode" fill="#b91c1c" />
              <Scatter yAxisId="mood" dataKey="screenMarker" name="PHQ-9 / GAD-7 date" fill="#d97706" shape="diamond" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="Correlation summary">
        {corr && corr.lowCount > 0 ? (
          <ul className="list-disc space-y-1 pl-5">
            <li>Mood dips below 0 coincide with sleep under 6 hrs in <b>{corr.pct}%</b> of those entries ({corr.lowCount} entries).</li>
            {corr.lowGivenShort !== null && <li>Sleep under 6 hrs was followed by low mood in <b>{corr.lowGivenShort}%</b> of {corr.shortCount} entries.</li>}
            <li>Average mood: {fmt(corr.avgShort)} after &lt;6 h sleep vs {fmt(corr.avgOk)} with ≥6 h.</li>
          </ul>
        ) : (
          <p className="text-slate-700">Not enough data in this range.</p>
        )}
      </Card>
    </>
  );
}
