"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { AFFECT_TAGS, SOMATIC_TAGS, FUNCTIONAL_TAGS, type SleepQuality } from "@/lib/types";
import { toLocalInput } from "@/lib/analytics";
import { useNowInput, Card, SliderField, TagSelect, Segmented, primaryBtn, inputCls, useToast, PageHeader, AcuteTrigger } from "@/components/ui";

const MOOD_WORD = ["Very low", "Very low", "Low", "Low", "Subdued", "Even", "Steady", "Lifted", "High", "Very high", "Very high"];

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

  async function save() {
    const ts = new Date(when).getTime();
    await db.checkIns.add({ timestamp: Number.isNaN(ts) ? Date.now() : ts, mood, anxiety, sleepHours, sleepQuality, affect, somatic, functional, note: note.trim() });
    setAffect([]); setSomatic([]); setFunctional([]); setNote(""); setMood(0); setAnxiety(4);
    setWhen(toLocalInput(Date.now()));
    toast("Check-in saved");
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
        <TagSelect label="Somatic markers" options={SOMATIC_TAGS} value={somatic} onChange={setSomatic} />
        <TagSelect label="Functional impact" options={FUNCTIONAL_TAGS} value={functional} onChange={setFunctional} />
        <label className="mb-2 block text-[13px] font-medium text-muted" htmlFor="note">Note</label>
        <input id="note" maxLength={160} className={`${inputCls} mb-4`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="One sentence about the day" />
        <label className="mb-2 block text-[13px] font-medium text-muted" htmlFor="when">Time</label>
        <input id="when" type="datetime-local" className={`${inputCls} mb-5`} value={when} onChange={(e) => setWhen(e.target.value)} />
        <button className={primaryBtn} onClick={save}>Save check-in</button>
        <p className="mt-3 text-center text-xs text-muted">Saved on this device only.</p>
      </Card>
      {toastEl}
    </>
  );
}
