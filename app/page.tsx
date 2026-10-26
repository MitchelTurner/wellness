"use client";
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { AFFECT_TAGS, SOMATIC_TAGS, FUNCTIONAL_TAGS, type SleepQuality } from "@/lib/types";
import { toLocalInput } from "@/lib/analytics";
import { useNowInput, Card, SliderField, TagSelect, Segmented, primaryBtn, inputCls, useToast } from "@/components/ui";

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

  async function save() {
    const ts = new Date(when).getTime();
    await db.checkIns.add({ timestamp: Number.isNaN(ts) ? Date.now() : ts, mood, anxiety, sleepHours, sleepQuality, affect, somatic, functional, note: note.trim() });
    setAffect([]); setSomatic([]); setFunctional([]); setNote(""); setMood(0); setAnxiety(4);
    setWhen(toLocalInput(Date.now()));
    toast("Check-in saved");
  }

  return (
    <>
      <Link href="/episodes?new=1" className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-4 text-lg font-bold text-white">
        <AlertTriangle /> Log Acute Event
      </Link>
      <Card title="Quick Check-In">
        <SliderField label="Mood" value={mood} min={-5} max={5} onChange={setMood} hint={["-5 very low", "+5 very high"]} format={(v) => (v > 0 ? `+${v}` : `${v}`)} />
        <SliderField label="Anxiety / Activation" value={anxiety} min={1} max={10} onChange={setAnxiety} hint={["1 calm", "10 extreme"]} />
        <SliderField label="Sleep duration" value={sleepHours} min={0} max={14} step={0.5} onChange={setSleepHours} format={(v) => `${v} h`} />
        <Segmented label="Sleep quality" options={["Poor", "Fair", "Good"] as const} value={sleepQuality} onChange={setSleepQuality} />
        <TagSelect label="Affect" options={AFFECT_TAGS} value={affect} onChange={setAffect} />
        <TagSelect label="Somatic markers" options={SOMATIC_TAGS} value={somatic} onChange={setSomatic} />
        <TagSelect label="Functional impact" options={FUNCTIONAL_TAGS} value={functional} onChange={setFunctional} />
        <label className="mb-1 block font-semibold" htmlFor="note">Note (optional)</label>
        <input id="note" maxLength={160} className={`${inputCls} mb-3`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="One sentence…" />
        <label className="mb-1 block font-semibold" htmlFor="when">Time</label>
        <input id="when" type="datetime-local" className={`${inputCls} mb-4`} value={when} onChange={(e) => setWhen(e.target.value)} />
        <button className={primaryBtn} onClick={save}>Save check-in</button>
      </Card>
      {toastEl}
    </>
  );
}
