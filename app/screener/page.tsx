"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { ANSWER_OPTIONS, GAD7_ITEMS, MAX_SCORE, PHQ9_ITEMS, severity, sumAnswers } from "@/lib/scoring";
import { fmtDate } from "@/lib/analytics";
import { useNowInput, Card, Segmented, primaryBtn, inputCls, useToast } from "@/components/ui";

export default function ScreenerPage() {
  const [kind, setKind] = useState<"PHQ-9" | "GAD-7">("PHQ-9");
  const items = kind === "PHQ-9" ? PHQ9_ITEMS : GAD7_ITEMS;
  const [answers, setAnswers] = useState<Record<string, (number | null)[]>>({
    "PHQ-9": Array(9).fill(null),
    "GAD-7": Array(7).fill(null),
  });
  const [when, setWhen] = useNowInput();
  const [note, setNote] = useState("");
  const [toast, toastEl] = useToast();
  const history = useLiveQuery(() => db.screenings.orderBy("timestamp").reverse().toArray(), []);

  const cur = answers[kind];
  const complete = cur.every((a) => a !== null);
  const total = sumAnswers(cur.map((a) => a ?? 0));

  async function save() {
    const ts = new Date(when).getTime();
    await db.screenings.add({ timestamp: Number.isNaN(ts) ? Date.now() : ts, kind, answers: cur as number[], total, note: note.trim() });
    setAnswers((a) => ({ ...a, [kind]: Array(items.length).fill(null) }));
    setNote("");
    toast(`${kind} saved: ${total} (${severity(kind, total)})`);
  }

  return (
    <>
      <Card title="Bi-weekly screener">
        <Segmented label="Questionnaire" options={["PHQ-9", "GAD-7"] as const} value={kind} onChange={setKind} />
        <p className="mb-3 text-sm text-slate-700">Over the last 2 weeks, how often have you been bothered by the following?</p>
        {items.map((q, i) => (
          <fieldset key={q} className="mb-3 border-b border-slate-200 pb-3">
            <legend className="mb-1 text-sm font-semibold">{i + 1}. {q}</legend>
            <div className="grid grid-cols-2 gap-1">
              {ANSWER_OPTIONS.map((o, v) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={cur[i] === v}
                  onClick={() => setAnswers((a) => ({ ...a, [kind]: a[kind].map((x, j) => (j === i ? v : x)) }))}
                  className={`rounded border px-2 py-1.5 text-xs ${cur[i] === v ? "border-teal-800 bg-teal-700 text-white" : "border-slate-400 bg-white"}`}
                >
                  {v} – {o}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="mb-3 rounded-lg bg-slate-100 p-3 text-center">
          <div className="text-3xl font-bold text-teal-800">{total} <span className="text-base text-slate-700">/ {MAX_SCORE[kind]}</span></div>
          <div className="font-semibold">{severity(kind, total)}</div>
        </div>
        <label htmlFor="sdate" className="mb-1 block font-semibold">Date</label>
        <input id="sdate" type="datetime-local" className={`${inputCls} mb-3`} value={when} onChange={(e) => setWhen(e.target.value)} />
        <label htmlFor="snote" className="mb-1 block font-semibold">Context (e.g. medication or routine change)</label>
        <input id="snote" className={`${inputCls} mb-4`} value={note} onChange={(e) => setNote(e.target.value)} />
        <button className={primaryBtn} disabled={!complete} onClick={save}>{complete ? "Save result" : "Answer all items to save"}</button>
      </Card>
      <Card title="History">
        {!history?.length && <p className="text-slate-700">No screenings yet.</p>}
        <ul className="divide-y divide-slate-200">
          {history?.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-semibold">{s.kind}: {s.total} · {severity(s.kind, s.total)}</div>
                <div className="text-sm text-slate-700">{fmtDate(s.timestamp)}{s.note ? ` · ${s.note}` : ""}</div>
              </div>
              <button className="text-sm text-red-700 underline" onClick={() => s.id !== undefined && db.screenings.delete(s.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </Card>
      {toastEl}
    </>
  );
}
