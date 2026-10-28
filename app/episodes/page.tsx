"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { X } from "lucide-react";
import { db } from "@/lib/db";
import { deleteStoredEpisode, saveEpisode } from "@/lib/persist";
import { EPISODE_SOMATIC, EPISODE_TYPES, INTERVENTIONS, RESPONSES, type Intervention, type Response } from "@/lib/types";
import { fmtDate } from "@/lib/analytics";
import { useNowInput, Card, SliderField, TagSelect, primaryBtn, inputCls, PageHeader, AcuteTrigger, Empty, quietDanger, useToast } from "@/components/ui";

function EpisodeModal({ onClose, onSaved }: { onClose: () => void; onSaved: (ok: boolean) => void }) {
  const [when, setWhen] = useNowInput();
  const [duration, setDuration] = useState(15);
  const [peak, setPeak] = useState(7);
  const [type, setType] = useState(EPISODE_TYPES[0]);
  const [somatic, setSomatic] = useState<string[]>([]);
  const [used, setUsed] = useState<Partial<Record<Intervention, Response>>>({});
  const [prnDetail, setPrnDetail] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const profile = useLiveQuery(() => db.settings.get("profile"), []);
  const medications = profile?.medications ?? [];

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const toggle = (name: Intervention) =>
    setUsed((u) => {
      const n = { ...u };
      if (name in n) delete n[name];
      else n[name] = "Partial";
      return n;
    });

  async function save() {
    if (saving) return;
    setSaving(true);
    const ts = new Date(when).getTime();
    try {
      const ok = await saveEpisode({
        timestamp: Number.isNaN(ts) ? Date.now() : ts,
        durationMin: duration,
        peak,
        type,
        somatic,
        interventions: (Object.entries(used) as [Intervention, Response][]).map(([name, response]) => ({
          name,
          response,
          ...(name === "PRN Medication" && prnDetail ? { detail: prnDetail } : {}),
        })),
        note: note.trim(),
      });
      onSaved(ok);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Log acute event" className="fixed inset-0 z-30 flex items-end justify-center bg-ink/45 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div className="sheet max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[1.75rem] bg-paper p-5 shadow-2xl sm:rounded-[1.75rem]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Right now</p>
            <h2 className="font-serif text-3xl italic leading-none text-ink">Acute event</h2>
          </div>
          <button aria-label="Close" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-sand text-ink"><X size={18} /></button>
        </div>
        <div className="mb-5">
          <div className="mb-2 text-[13px] font-medium text-muted">Type</div>
          <div className="flex flex-wrap gap-2">
            {EPISODE_TYPES.map((o) => (
              <button key={o} type="button" aria-pressed={type === o} onClick={() => setType(o)} className={`rounded-full px-3.5 py-2 text-sm ${type === o ? "bg-ink text-cream" : "bg-white text-ink ring-1 ring-line"}`}>{o}</button>
            ))}
          </div>
        </div>
        <label htmlFor="start" className="mb-2 block text-[13px] font-medium text-muted">Start time</label>
        <input id="start" type="datetime-local" className={`${inputCls} mb-4`} value={when} onChange={(e) => setWhen(e.target.value)} />
        <label htmlFor="dur" className="mb-2 block text-[13px] font-medium text-muted">Estimated duration (minutes)</label>
        <input id="dur" type="number" min={1} className={`${inputCls} mb-5`} value={duration} onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))} />
        <SliderField label="Peak intensity" value={peak} min={1} max={10} onChange={setPeak} hint={["Mild", "Extreme"]} />
        <TagSelect label="Symptoms" options={EPISODE_SOMATIC} value={somatic} onChange={setSomatic} allowCustom />
        <div className="mb-5">
          <div className="mb-2 text-[13px] font-medium text-muted">Interventions and response</div>
          <div className="space-y-2">
            {INTERVENTIONS.map((name) => (
              <div key={name} className={`rounded-2xl p-3 ${name in used ? "bg-sand/80" : "bg-white ring-1 ring-line"}`}>
                <button type="button" aria-pressed={name in used} onClick={() => toggle(name)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${name in used ? "bg-ink text-cream" : "bg-cream text-ink ring-1 ring-line"}`}>{name}</button>
                {name in used && name === "PRN Medication" && (
                  <label className="mt-3 block text-xs text-muted">
                    Which medication
                    <select aria-label="Which medication" className={`${inputCls} mt-1`} value={prnDetail} onChange={(e) => setPrnDetail(e.target.value)}>
                      <option value="">PRN Medication</option>
                      {medications.map((med) => {
                        const label = med.dose ? `${med.name} ${med.dose}` : med.name;
                        return <option key={med.id} value={label}>{label}</option>;
                      })}
                    </select>
                  </label>
                )}
                {name in used && name !== "None" && (
                  <div className="mt-2 flex gap-1 rounded-full bg-white p-1">
                    {RESPONSES.map((r) => (
                      <button key={r} type="button" aria-pressed={used[name] === r} onClick={() => setUsed((u) => ({ ...u, [name]: r }))} className={`flex-1 rounded-full py-1.5 text-xs font-medium ${used[name] === r ? "bg-ink text-cream" : "text-muted"}`}>{r}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <label htmlFor="episode-note" className="mb-2 block text-[13px] font-medium text-muted">Note</label>
        <input id="episode-note" maxLength={160} className={`${inputCls} mb-5`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was happening" />
        <button className={primaryBtn} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save event"}</button>
      </div>
    </div>
  );
}

function Episodes() {
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("new") === "1");
  const close = useCallback(() => setOpen(false), []);
  const [toast, toastEl] = useToast();
  const episodes = useLiveQuery(() => db.episodes.orderBy("timestamp").reverse().toArray(), []);
  return (
    <>
      <PageHeader kicker="Acute events" title="Episodes" lede="Intensity, how long it lasted, and whether anything helped." />
      <AcuteTrigger onClick={() => setOpen(true)} />
      <Card title="History">
        {episodes === undefined ? null : episodes.length === 0 ? <Empty>No acute events yet.</Empty> : (
          <ul className="space-y-2">
            {episodes.map((e) => {
              const detail = [...e.somatic, ...e.interventions.map((i) => (i.name === "None" ? "No intervention" : `${i.detail || i.name}: ${i.response}`))].join(" · ");
              return (
                <li key={e.id} className="flex items-start justify-between gap-3 rounded-2xl bg-sand/50 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium text-ink">{e.type}</span>
                      <span className="font-serif text-xl italic tabular-nums text-ink">{e.peak}<span className="ml-0.5 text-xs font-sans not-italic text-muted">/10</span></span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {fmtDate(e.timestamp)} {new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {e.durationMin} min
                    </div>
                    {detail && <p className="mt-2 text-sm leading-relaxed text-ink/80">{detail}</p>}
                    {e.note && <p className="mt-2 text-sm text-ink/80">{e.note}</p>}
                  </div>
                  <button className={quietDanger} onClick={() => deleteStoredEpisode(e).then((ok) => toast(ok ? "Event deleted" : "Removed on this device. The database could not be reached."))}>Delete</button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {open && <EpisodeModal onClose={close} onSaved={(ok) => { close(); toast(ok ? "Event saved" : "Saved on this device. The database could not be reached."); }} />}
      {toastEl}
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
