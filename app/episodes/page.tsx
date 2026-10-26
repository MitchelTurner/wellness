"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, X } from "lucide-react";
import { db } from "@/lib/db";
import { EPISODE_SOMATIC, EPISODE_TYPES, INTERVENTIONS, RESPONSES, type Intervention, type Response } from "@/lib/types";
import { fmtDate } from "@/lib/analytics";
import { useNowInput, Card, SliderField, TagSelect, Segmented, primaryBtn, inputCls } from "@/components/ui";

function EpisodeModal({ onClose }: { onClose: () => void }) {
  const [when, setWhen] = useNowInput();
  const [duration, setDuration] = useState(15);
  const [peak, setPeak] = useState(7);
  const [type, setType] = useState(EPISODE_TYPES[0]);
  const [somatic, setSomatic] = useState<string[]>([]);
  const [used, setUsed] = useState<Partial<Record<Intervention, Response>>>({});

  const toggle = (name: Intervention) =>
    setUsed((u) => {
      const n = { ...u };
      if (name in n) delete n[name];
      else n[name] = "Partial";
      return n;
    });

  async function save() {
    const ts = new Date(when).getTime();
    await db.episodes.add({
      timestamp: Number.isNaN(ts) ? Date.now() : ts,
      durationMin: duration,
      peak,
      type,
      somatic,
      interventions: (Object.entries(used) as [Intervention, Response][]).map(([name, response]) => ({ name, response })),
      note: "",
    });
    onClose();
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Log acute event" className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Log Acute Event</h2>
          <button aria-label="Close" onClick={onClose} className="p-1"><X /></button>
        </div>
        <Segmented label="Type" options={EPISODE_TYPES} value={type} onChange={setType} />
        <label htmlFor="start" className="mb-1 block font-semibold">Start time</label>
        <input id="start" type="datetime-local" className={`${inputCls} mb-4`} value={when} onChange={(e) => setWhen(e.target.value)} />
        <label htmlFor="dur" className="mb-1 block font-semibold">Estimated duration (minutes)</label>
        <input id="dur" type="number" min={1} className={`${inputCls} mb-4`} value={duration} onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))} />
        <SliderField label="Peak intensity" value={peak} min={1} max={10} onChange={setPeak} />
        <TagSelect label="Somatic cluster" options={EPISODE_SOMATIC} value={somatic} onChange={setSomatic} />
        <div className="mb-4">
          <div className="mb-1 font-semibold">Interventions used &amp; response</div>
          {INTERVENTIONS.map((name) => (
            <div key={name} className="mb-2 rounded-lg border border-slate-300 p-2">
              <button type="button" aria-pressed={name in used} onClick={() => toggle(name)} className={`rounded-full border px-3 py-1 text-sm font-medium ${name in used ? "border-teal-800 bg-teal-700 text-white" : "border-slate-400"}`}>{name}</button>
              {name in used && name !== "None" && (
                <div className="mt-2 flex gap-1">
                  {RESPONSES.map((r) => (
                    <button key={r} type="button" aria-pressed={used[name] === r} onClick={() => setUsed((u) => ({ ...u, [name]: r }))} className={`flex-1 rounded border py-1 text-sm ${used[name] === r ? "bg-teal-700 text-white" : "bg-white"}`}>{r}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <button className={primaryBtn} onClick={save}>Save event</button>
      </div>
    </div>
  );
}

function Episodes() {
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("new") === "1");
  const episodes = useLiveQuery(() => db.episodes.orderBy("timestamp").reverse().toArray(), []);
  return (
    <>
      <button onClick={() => setOpen(true)} className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-4 text-lg font-bold text-white">
        <AlertTriangle /> Log Acute Event
      </button>
      <Card title="Episode history">
        {!episodes?.length && <p className="text-slate-700">No episodes logged.</p>}
        <ul className="divide-y divide-slate-200">
          {episodes?.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-2 py-2">
              <div>
                <div className="font-semibold">{e.type} · peak {e.peak}/10</div>
                <div className="text-sm text-slate-700">
                  {fmtDate(e.timestamp)} {new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {e.durationMin} min
                </div>
                <div className="text-sm text-slate-700">
                  {[...e.somatic, ...e.interventions.map((i) => (i.name === "None" ? "No intervention" : `${i.name}: ${i.response}`))].join(" · ")}
                </div>
              </div>
              <button className="text-sm text-red-700 underline" onClick={() => e.id !== undefined && db.episodes.delete(e.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </Card>
      {open && <EpisodeModal onClose={() => setOpen(false)} />}
    </>
  );
}

export default function EpisodesPage() {
  return (
    <Suspense>
      <Episodes />
    </Suspense>
  );
}
