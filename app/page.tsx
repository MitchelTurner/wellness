"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { deleteStoredCheckIn, saveCheckIn } from "@/lib/persist";
import { isCheckInDue } from "@/lib/reminder-time";
import { estimateSleep, type SleepEstimate } from "@/lib/sleep";
import { AFFECT_TAGS, SOMATIC_TAGS, FUNCTIONAL_TAGS, type CheckIn, type SleepQuality } from "@/lib/types";
import { toLocalInput } from "@/lib/analytics";
import { useNowInput, Card, SliderField, TagSelect, Segmented, primaryBtn, secondaryBtn, inputCls, useToast, PageHeader, AcuteTrigger, quietDanger } from "@/components/ui";

const MOOD_WORD = ["Very low", "Very low", "Low", "Low", "Subdued", "Even", "Steady", "Lifted", "High", "Very high", "Very high"];

function moodWord(mood: number) {
  return MOOD_WORD[Math.max(0, Math.min(MOOD_WORD.length - 1, mood + 5))] ?? "Even";
}

function signedMood(mood: number) {
  return mood > 0 ? `+${mood}` : `${mood}`;
}

function hoursPhrase(hours: number) {
  const shown = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `${shown} ${hours === 1 ? "hour" : "hours"}`;
}

function dayStamp(ts: number) {
  const date = new Date(ts);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(ts: number, now: number) {
  const date = new Date(ts);
  const today = new Date(now);
  const start = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diff = Math.round((start(today) - start(date)) / 86_400_000);
  if (now && diff === 0) return "Today";
  if (now && diff === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  });
}

function clock(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function groupByDay(rows: CheckIn[], now: number) {
  const groups: { key: string; label: string; rows: CheckIn[] }[] = [];
  for (const row of rows) {
    const key = dayStamp(row.timestamp);
    const last = groups.at(-1);
    if (last?.key === key) last.rows.push(row);
    else groups.push({ key, label: dayLabel(row.timestamp, now), rows: [row] });
  }
  return groups;
}

function moodTone(mood: number) {
  if (mood < 0) return "text-rose";
  if (mood > 0) return "text-forest";
  return "text-ink";
}

function suggestionCopy(estimate: SleepEstimate) {
  const from = clock(estimate.start);
  const to = clock(estimate.end);
  const length = hoursPhrase(estimate.hours);
  const wakes = estimate.wakes === 0 ? "" : estimate.wakes === 1 ? " One brief wake." : ` ${estimate.wakes} brief wakes.`;
  if (estimate.observed) return `Phone activity suggests ${length}, ${estimate.quality}. The screen was quiet from ${from} to ${to}.${wakes}`;
  return `Phone activity suggests ${length}, ${estimate.quality}, from ${from} to ${to}, based on a long stretch with no activity in ClinTrack.${wakes}`;
}

function sleepTone(quality: SleepQuality) {
  if (quality === "Poor") return "text-rose";
  if (quality === "Good") return "text-forest";
  return "text-ink";
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.25rem_minmax(0,1fr)] items-baseline gap-x-3 px-3 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm leading-snug text-ink">{children}</dd>
    </div>
  );
}

function TagLine({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-sm text-muted">{label}</div>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item} className="rounded-full bg-white px-2.5 py-1 text-sm text-ink ring-1 ring-line">{item}</li>
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
  const [sleepTouched, setSleepTouched] = useState(false);
  const [affect, setAffect] = useState<string[]>([]);
  const [somatic, setSomatic] = useState<string[]>([]);
  const [functional, setFunctional] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [when, setWhen] = useNowInput();
  const [editing, setEditing] = useState<string | null>(null);
  const [toast, toastEl] = useToast();
  const [kicker, setKicker] = useState("Today");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const current = Date.now();
      setNow(current);
      setKicker(new Date(current).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const [saving, setSaving] = useState(false);
  const saved = useLiveQuery(async () => {
    const rows = await db.checkIns.orderBy("timestamp").reverse().toArray();
    return rows.filter((row) => row.clientId);
  }, []);
  const marks = useLiveQuery(async () => {
    const since = Date.now() - 36 * 60 * 60 * 1000;
    return db.activity.where("timestamp").above(since).toArray();
  }, []);
  const sleepOn = useLiveQuery(async () => (await db.settings.get("sleepWatch"))?.sleepWatch === true, []);
  const reminderSetting = useLiveQuery(() => db.settings.get("reminder"), []);
  const estimate = useMemo(() => (marks && now !== null ? estimateSleep(marks, now) : null), [marks, now]);
  const suggested = !editing && !sleepTouched && estimate?.reliable ? estimate : null;
  const shownHours = suggested ? suggested.hours : sleepHours;
  const shownQuality = suggested ? suggested.quality : sleepQuality;
  const checkInDue = now !== null && saved !== undefined && isCheckInDue(now, reminderSetting?.reminderTime, (saved ?? []).map((row) => row.timestamp));

  function resetForm() {
    setEditing(null);
    setAffect([]);
    setSomatic([]);
    setFunctional([]);
    setNote("");
    setMood(0);
    setAnxiety(4);
    setSleepHours(7);
    setSleepQuality("Fair");
    setSleepTouched(false);
    setWhen(toLocalInput(Date.now()));
  }

  function applyEstimate() {
    if (!estimate) return;
    setSleepTouched(true);
    setSleepHours(estimate.hours);
    setSleepQuality(estimate.quality);
  }

  function load(row: CheckIn) {
    setEditing(row.clientId ?? null);
    setSleepTouched(true);
    setMood(row.mood);
    setAnxiety(row.anxiety);
    setSleepHours(row.sleepHours);
    setSleepQuality(row.sleepQuality);
    setAffect(row.affect);
    setSomatic(row.somatic);
    setFunctional(row.functional);
    setNote(row.note);
    setWhen(toLocalInput(row.timestamp));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function copyLast() {
    const rows = await db.checkIns.orderBy("timestamp").reverse().toArray();
    const last = rows.find((row) => row.clientId && row.clientId !== editing);
    if (!last) {
      toast("No earlier check-in to copy");
      return;
    }
    setAffect([...last.affect]);
    setSomatic([...last.somatic]);
    setFunctional([...last.functional]);
    toast("Copied tags from the last check-in");
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    const ts = new Date(when).getTime();
    const wasEdit = !!editing;
    try {
      const ok = await saveCheckIn({
        clientId: editing ?? undefined,
        timestamp: Number.isNaN(ts) ? Date.now() : ts,
        mood,
        anxiety,
        sleepHours: shownHours,
        sleepQuality: shownQuality,
        affect,
        somatic,
        functional,
        note: note.trim(),
      });
      resetForm();
      toast(ok ? (wasEdit ? "Check-in updated" : "Check-in saved") : "Saved on this device. The database could not be reached.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader kicker={kicker} title="How are you now" lede="Mood, sleep, and what the day asked of you. A minute is enough." />
      {checkInDue && <p className="mb-6 rounded-2xl bg-ink px-4 py-3 text-sm leading-relaxed text-cream">Time to check in. You have not saved one today.</p>}
      <AcuteTrigger href="/episodes?new=1" />
      <Card>
        <SliderField emphasis tone="bipolar" caption={MOOD_WORD[mood + 5]} label="Mood" value={mood} min={-5} max={5} onChange={setMood} hint={["Very low", "Very high"]} format={(v) => (v > 0 ? `+${v}` : `${v}`)} />
        <SliderField label="Anxiety" value={anxiety} min={1} max={10} onChange={setAnxiety} hint={["Calm", "Extreme"]} />
        <SliderField label="Sleep" value={shownHours} min={0} max={14} step={0.5} onChange={(value) => { if (!sleepTouched && estimate?.reliable) setSleepQuality(estimate.quality); setSleepTouched(true); setSleepHours(value); }} format={(v) => `${v} h`} hint={["0 hours", "14 hours"]} />
        <Segmented label="Sleep quality" options={["Poor", "Fair", "Good"] as const} value={shownQuality} onChange={(value) => { if (!sleepTouched && estimate?.reliable) setSleepHours(estimate.hours); setSleepTouched(true); setSleepQuality(value); }} />
        {!editing && estimate && (
          <div className="rounded-2xl bg-sand/60 px-4 py-3" role="status">
            <p className="text-sm leading-relaxed text-ink">{suggestionCopy(estimate)}</p>
            <button type="button" className={`${secondaryBtn} mt-3`} onClick={applyEstimate}>Use this sleep</button>
          </div>
        )}
        {!editing && !estimate && sleepOn === true && <p className="text-xs leading-relaxed text-muted">Watching phone activity. A sleep guess shows up after a quiet night.</p>}
        {!editing && !estimate && sleepOn === false && (
          <p className="text-xs leading-relaxed text-muted">
            Phone activity can fill this in. <Link href="/settings" className="font-medium text-ink underline decoration-line underline-offset-2">Turn it on in Settings</Link>.
          </p>
        )}
      </Card>
      <Card>
        {editing && <p className="mb-4 text-sm text-muted">Editing a saved check-in. Saving keeps the same record.</p>}
        <TagSelect label="Affect" options={AFFECT_TAGS} value={affect} onChange={setAffect} />
        <TagSelect label="Symptoms" options={SOMATIC_TAGS} value={somatic} onChange={setSomatic} allowCustom />
        <TagSelect label="Functional impact" options={FUNCTIONAL_TAGS} value={functional} onChange={setFunctional} />
        <button type="button" className={`${secondaryBtn} mb-2`} onClick={copyLast}>Same as last time</button>
        <p className="mb-5 text-center text-xs text-muted">Copies affect, symptoms, and function. Mood, anxiety, and sleep stay as you set them.</p>
        <label className="mb-2 block text-[13px] font-medium text-muted" htmlFor="note">Note</label>
        <input id="note" maxLength={160} className={`${inputCls} mb-4`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="One sentence about the day" />
        <label className="mb-2 block text-[13px] font-medium text-muted" htmlFor="when">Time</label>
        <input id="when" type="datetime-local" className={`${inputCls} mb-5`} value={when} onChange={(e) => setWhen(e.target.value)} />
        <button className={primaryBtn} onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Update check-in" : "Save check-in"}</button>
        {editing && <button type="button" className={`${secondaryBtn} mt-2`} onClick={resetForm}>Cancel</button>}
        <p className="mt-3 text-center text-xs text-muted">Saved on this device and in the app database.</p>
      </Card>
      {!!saved?.length && now !== null && (
        <Card title="Saved check-ins">
          <p className="mb-4 text-sm text-muted">Newest first. Mood uses the same words as the scale above, from very low to very high.</p>
          <ul className="space-y-6">
            {groupByDay(saved, now).map((group) => (
              <li key={group.key}>
                <h3 className="mb-2 font-serif text-2xl italic leading-none text-ink">{group.label}</h3>
                <ul className="space-y-2">
                  {group.rows.map((row) => {
                    const active = editing === row.clientId;
                    const tags = row.affect.length + row.somatic.length + row.functional.length > 0;
                    return (
                      <li key={row.clientId} className={`rounded-2xl px-4 py-3.5 ${active ? "bg-white ring-1 ring-ink/15" : "bg-sand/50"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-ink">{clock(row.timestamp)}</p>
                            {active && <p className="mt-0.5 text-xs text-muted">Editing this check-in</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <button type="button" className="text-xs font-medium text-muted transition hover:text-ink" onClick={() => load(row)}>Edit</button>
                            <button className={quietDanger} onClick={() => deleteStoredCheckIn(row).then((ok) => toast(ok ? "Check-in deleted" : "Removed on this device. The database could not be reached."))}>Delete</button>
                          </div>
                        </div>
                        <dl className={`mt-3 divide-y divide-line/80 overflow-hidden rounded-xl ${active ? "bg-sand/70" : "bg-white/80"}`}>
                          <Fact label="Mood">
                            <span className={`font-medium ${moodTone(row.mood)}`}>{moodWord(row.mood)}</span>
                            <span className="text-muted"> · {signedMood(row.mood)}</span>
                          </Fact>
                          <Fact label="Anxiety">{row.anxiety} of 10</Fact>
                          <Fact label="Sleep">
                            {hoursPhrase(row.sleepHours)}
                            <span className="text-muted"> · </span>
                            <span className={sleepTone(row.sleepQuality)}>{row.sleepQuality}</span>
                          </Fact>
                        </dl>
                        {row.note && <p className="mt-3 text-sm leading-relaxed text-ink">{row.note}</p>}
                        {tags && (
                          <div className="mt-3 space-y-3">
                            <TagLine label="How you felt" items={row.affect} />
                            <TagLine label="In your body" items={row.somatic} />
                            <TagLine label="How the day went" items={row.functional} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {toastEl}
    </>
  );
}
