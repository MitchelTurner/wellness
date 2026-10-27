"use client";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { deleteStoredCheckIn, saveCheckIn } from "@/lib/persist";
import { AFFECT_TAGS, SOMATIC_TAGS, FUNCTIONAL_TAGS, type SleepQuality } from "@/lib/types";
import { fmtDate, toLocalInput } from "@/lib/analytics";
import { useNowInput, Card, SliderField, TagSelect, Segmented, primaryBtn, inputCls, useToast, PageHeader, AcuteTrigger, quietDanger } from "@/components/ui";

const MOOD_WORD = ["Very low", "Very low", "Low", "Low", "Subdued", "Even", "Steady", "Lifted", "High", "Very high", "Very high"];

function TagLine({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-2">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">{label}</div>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item} className="rounded-full bg-white px-2.5 py-1 text-xs text-ink ring-1 ring-line">{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function CheckInPage() {
  const [mood, setMood] = useState(0);
  const [anxiety, setAnxiety] = useState(4);
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState<SleepQuality>("Fair");
  const [affect, setAffect] = useState<string[]>([]);
  const [somatic, setSomatic] = useState<string[]>([]);
  const [functional, setFunctional] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [when, setWhen] = useNowInput();
  const [toast, toastEl] = useToast();
  const [kicker, setKicker] = useState("Today");

  useEffect(() => {
    const t = setTimeout(() => {
      setKicker(new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const [saving, setSaving] = useState(false);
  const saved = useLiveQuery(async () => {
    const rows = await db.checkIns.orderBy("timestamp").reverse().toArray();
    return rows.filter((row) => row.clientId);
  }, []);

  async function save() {
    if (saving) return;
    setSaving(true);
    const ts = new Date(when).getTime();
    try {
      const ok = await saveCheckIn({ timestamp: Number.isNaN(ts) ? Date.now() : ts, mood, anxiety, sleepHours, sleepQuality, affect, somatic, functional, note: note.trim() });
      setAffect([]); setSomatic([]); setFunctional([]); setNote(""); setMood(0); setAnxiety(4);
      setWhen(toLocalInput(Date.now()));
      toast(ok ? "Check-in saved" : "Saved on this device. The database could not be reached.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader kicker={kicker} title="How are you now" lede="Mood, sleep, and what the day asked of you. A minute is enough." />
      <AcuteTrigger href="/episodes?new=1" />
      <Card>
        <SliderField emphasis tone="bipolar" caption={MOOD_WORD[mood + 5]} label="Mood" value={mood} min={-5} max={5} onChange={setMood} hint={["Very low", "Very high"]} format={(v) => (v > 0 ? `+${v}` : `${v}`)} />
        <SliderField label="Anxiety" value={anxiety} min={1} max={10} onChange={setAnxiety} hint={["Calm", "Extreme"]} />
        <SliderField label="Sleep" value={sleepHours} min={0} max={14} step={0.5} onChange={setSleepHours} format={(v) => `${v} h`} hint={["0 hours", "14 hours"]} />
        <Segmented label="Sleep quality" options={["Poor", "Fair", "Good"] as const} value={sleepQuality} onChange={setSleepQuality} />
      </Card>
      <Card>
        <TagSelect label="Affect" options={AFFECT_TAGS} value={affect} onChange={setAffect} />
        <TagSelect label="Symptoms" options={SOMATIC_TAGS} value={somatic} onChange={setSomatic} />
        <TagSelect label="Functional impact" options={FUNCTIONAL_TAGS} value={functional} onChange={setFunctional} />
        <label className="mb-2 block text-[13px] font-medium text-muted" htmlFor="note">Note</label>
        <input id="note" maxLength={160} className={`${inputCls} mb-4`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="One sentence about the day" />
        <label className="mb-2 block text-[13px] font-medium text-muted" htmlFor="when">Time</label>
        <input id="when" type="datetime-local" className={`${inputCls} mb-5`} value={when} onChange={(e) => setWhen(e.target.value)} />
        <button className={primaryBtn} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save check-in"}</button>
        <p className="mt-3 text-center text-xs text-muted">Saved on this device and in the app database.</p>
      </Card>
      {!!saved?.length && (
        <Card title="Saved check-ins">
          <ul className="space-y-2">
            {saved.map((row) => (
              <li key={row.clientId} className="flex items-start justify-between gap-3 rounded-2xl bg-sand/50 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-serif text-xl italic tabular-nums">{row.mood > 0 ? `+${row.mood}` : row.mood}</span>
                    <span className="text-sm text-muted">Anxiety {row.anxiety} · {row.sleepHours} h {row.sleepQuality.toLowerCase()}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{fmtDate(row.timestamp)} {new Date(row.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  {row.note && <p className="mt-2 text-sm text-ink/80">{row.note}</p>}
                  <TagLine label="Affect" items={row.affect} />
                  <TagLine label="Symptoms" items={row.somatic} />
                  <TagLine label="Function" items={row.functional} />
                </div>
                <button className={quietDanger} onClick={() => deleteStoredCheckIn(row).then((ok) => toast(ok ? "Check-in deleted" : "Removed on this device. The database could not be reached."))}>Delete</button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {toastEl}
    </>
  );
}
