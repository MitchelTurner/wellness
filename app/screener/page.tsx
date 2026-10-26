"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { ANSWER_OPTIONS, GAD7_ITEMS, MAX_SCORE, PHQ9_ITEMS, severity, sumAnswers } from "@/lib/scoring";
import { fmtDate } from "@/lib/analytics";
import { useNowInput, Card, Segmented, primaryBtn, inputCls, useToast, PageHeader, Empty, quietDanger, severityTone } from "@/components/ui";

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
  const answered = cur.filter((a) => a !== null).length;
  const complete = answered === cur.length;
  const total = sumAnswers(cur.map((a) => a ?? 0));
  const band = severity(kind, total);

  async function save() {
    const ts = new Date(when).getTime();
    await db.screenings.add({ timestamp: Number.isNaN(ts) ? Date.now() : ts, kind, answers: cur as number[], total, note: note.trim() });
    setAnswers((a) => ({ ...a, [kind]: Array(items.length).fill(null) }));
    setNote("");
    toast(`${kind} saved: ${total} (${severity(kind, total)})`);
  }

  return (
    <>
      <PageHeader kicker="Every two weeks" title="Screeners" lede="PHQ-9 and GAD-7, kept next to the daily record. These scores are not a diagnosis." />
      <Card>
        <Segmented label="Questionnaire" options={["PHQ-9", "GAD-7"] as const} value={kind} onChange={setKind} />
        <div className="mb-5 h-1 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-forest transition-[width]" style={{ width: `${(answered / items.length) * 100}%` }} />
        </div>
        <p className="mb-5 text-sm leading-relaxed text-muted">Over the last 2 weeks, how often have you been bothered by the following?</p>
        {items.map((q, i) => (
          <fieldset key={q} className="mb-5">
            <legend className="mb-2.5 flex gap-3 text-sm leading-snug text-ink">
              <span className="font-serif text-lg italic leading-none text-muted">{String(i + 1).padStart(2, "0")}</span>
              <span>{q}</span>
            </legend>
            <div className="grid grid-cols-1 gap-2 min-[460px]:grid-cols-2">
              {ANSWER_OPTIONS.map((o, v) => {
                const on = cur[i] === v;
                return (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setAnswers((a) => ({ ...a, [kind]: a[kind].map((x, j) => (j === i ? v : x)) }))}
                    className={`rounded-2xl px-3 py-2.5 text-left text-[13px] leading-snug ${on ? "bg-ink text-cream" : "bg-white text-ink ring-1 ring-line"}`}
                  >
                    <span className={`mr-1.5 font-serif italic ${on ? "text-cream" : "text-muted"}`}>{v}</span>
                    {o}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <div className="mb-5 rounded-[1.5rem] bg-ink px-5 py-6 text-cream">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-cream/60">{kind}</div>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div className="font-serif text-6xl italic leading-none tabular-nums">{complete ? total : "—"}</div>
            <div className="pb-1 text-right text-sm">
              {complete ? (
                <>
                  <div className="text-cream/60">of {MAX_SCORE[kind]}</div>
                  <div className="mt-1 font-medium">{band}</div>
                </>
              ) : (
                <div className="leading-snug text-cream/70">{answered} of {items.length}<br />answered</div>
              )}
            </div>
          </div>
        </div>
        <label htmlFor="sdate" className="mb-2 block text-[13px] font-medium text-muted">Date</label>
        <input id="sdate" type="datetime-local" className={`${inputCls} mb-4`} value={when} onChange={(e) => setWhen(e.target.value)} />
        <label htmlFor="snote" className="mb-2 block text-[13px] font-medium text-muted">Context</label>
        <input id="snote" className={`${inputCls} mb-5`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Medication or routine change" />
        <button className={primaryBtn} disabled={!complete} onClick={save}>{complete ? "Save result" : "Answer all items to save"}</button>
      </Card>
      <Card title="History">
        {history === undefined ? null : history.length === 0 ? <Empty>No screenings yet.</Empty> : (
          <ul className="space-y-1">
            {history.map((s) => {
              const bandLabel = severity(s.kind, s.total);
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{s.kind}</span>
                      <span className="font-serif text-2xl italic leading-none tabular-nums">{s.total}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${severityTone(bandLabel)}`}>{bandLabel}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted">{fmtDate(s.timestamp)}{s.note ? ` · ${s.note}` : ""}</div>
                  </div>
                  <button className={quietDanger} onClick={() => s.id !== undefined && db.screenings.delete(s.id)}>Delete</button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {toastEl}
    </>
  );
}
