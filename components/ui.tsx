"use client";
import { useEffect, useState } from "react";
import { toLocalInput } from "@/lib/analytics";

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mb-4 rounded-xl border border-slate-300 bg-white p-4 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 text-base font-bold text-slate-900">{title}</h2>}
      {children}
    </section>
  );
}

export function SliderField({ label, value, min, max, step = 1, onChange, hint, format }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; hint?: [string, string]; format?: (v: number) => string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between">
        <label className="font-semibold text-slate-900">{label}</label>
        <span className="text-xl font-bold text-teal-800">{format ? format(value) : value}</span>
      </div>
      <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8 w-full accent-teal-700" />
      {hint && (
        <div className="flex justify-between text-xs text-slate-600">
          <span>{hint[0]}</span>
          <span>{hint[1]}</span>
        </div>
      )}
    </div>
  );
}

export function TagSelect({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <fieldset className="mb-4">
      <legend className="mb-1 font-semibold text-slate-900">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value.includes(o)}
            onClick={() => toggle(o)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${value.includes(o) ? "border-teal-800 bg-teal-700 text-white" : "border-slate-400 bg-white text-slate-800"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-4">
      <div className="mb-1 font-semibold text-slate-900">{label}</div>
      <div className="flex overflow-hidden rounded-lg border border-slate-400">
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)} className={`flex-1 py-2 text-sm font-medium ${value === o ? "bg-teal-700 text-white" : "bg-white text-slate-800"}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export const primaryBtn = "w-full rounded-xl bg-teal-700 px-4 py-3 text-base font-bold text-white hover:bg-teal-800 disabled:opacity-50";
export const inputCls = "w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-slate-900";

export function useToast() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2500);
    return () => clearTimeout(t);
  }, [msg]);
  const el = msg ? <div role="status" className="fixed inset-x-4 bottom-24 z-20 mx-auto max-w-sm rounded-lg bg-slate-900 p-3 text-center text-white">{msg}</div> : null;
  return [setMsg, el] as const;
}

// Defaults to "now" once mounted (avoids reading the clock during prerender)
export function useNowInput() {
  const [v, setV] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setV(toLocalInput(Date.now())), 0);
    return () => clearTimeout(t);
  }, []);
  return [v, setV] as const;
}
