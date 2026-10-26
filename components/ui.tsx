"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { toLocalInput } from "@/lib/analytics";

export function PageHeader({ kicker, title, lede }: { kicker: string; title: string; lede?: string }) {
  return (
    <header className="mb-7">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted">{kicker}</p>
      <h1 className="max-w-xl font-serif text-[2.45rem] italic leading-[1.02] tracking-tight text-ink sm:text-5xl">{title}</h1>
      {lede && <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{lede}</p>}
    </header>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mb-4 rounded-[1.7rem] bg-white/75 p-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_24px_50px_-34px_rgba(22,21,19,0.55)] ring-1 ring-white/80 ${className}`}>
      {title && <h2 className="mb-4 text-[15px] font-medium text-ink">{title}</h2>}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-sand/70 px-4 py-8 text-center text-sm leading-relaxed text-muted">{children}</p>;
}

export function SliderField({ label, value, min, max, step = 1, onChange, hint, format, emphasis, caption, tone }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; hint?: [string, string]; format?: (v: number) => string; emphasis?: boolean; caption?: string; tone?: "bipolar";
}) {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const toneColor = tone === "bipolar" && value < 0 ? "#9f3d38" : "#1c3d32";
  const track = tone === "bipolar"
    ? `linear-gradient(to right, #e4ddd2 ${Math.min(pct, 50)}%, ${toneColor} ${Math.min(pct, 50)}%, ${toneColor} ${Math.max(pct, 50)}%, #e4ddd2 ${Math.max(pct, 50)}%)`
    : `linear-gradient(to right, #1c3d32 ${pct}%, #e4ddd2 ${pct}%)`;
  const valueClass = tone === "bipolar" ? (value < 0 ? "text-rose" : value > 0 ? "text-forest" : "text-ink") : "text-ink";
  return (
    <div className="mb-6 last:mb-0">
      <div className="mb-1 flex items-end justify-between gap-4">
        <label className="pb-1 text-[13px] font-medium text-muted">{label}</label>
        <div className="text-right">
          <div className={`font-serif italic leading-none tabular-nums ${emphasis ? "text-6xl" : "text-4xl"} ${valueClass}`}>
            {format ? format(value) : value}
          </div>
          {caption && <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{caption}</div>}
        </div>
      </div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range"
        style={{ ["--track" as string]: track }}
      />
      {hint && (
        <div className="mt-0.5 flex justify-between text-[11px] text-muted">
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
    <fieldset className="mb-5 last:mb-0">
      <legend className="mb-2 text-[13px] font-medium text-muted">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o)}
              className={`rounded-full px-3.5 py-2 text-sm transition ${on ? "bg-ink text-cream" : "bg-white text-ink ring-1 ring-line hover:ring-ink/25"}`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-5">
      <div className="mb-2 text-[13px] font-medium text-muted">{label}</div>
      <div className="flex gap-1 rounded-full bg-sand/80 p-1">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={`flex-1 rounded-full px-2 py-2 text-center text-[13px] leading-tight transition ${value === o ? "bg-white text-ink shadow-[0_1px_2px_rgba(22,21,19,0.08)]" : "text-muted hover:text-ink"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

const acuteClass = "group mb-6 flex w-full items-center gap-4 rounded-[1.6rem] bg-white/75 p-3 text-left shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_22px_44px_-30px_rgba(159,61,56,0.9)] ring-1 ring-rose/15 transition hover:bg-white";

export function AcuteTrigger({ href, onClick }: { href?: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rose text-white">
        <AlertTriangle size={18} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-ink">Log an acute event</span>
        <span className="mt-0.5 block text-sm text-muted">Panic, a crash, or a spike of anger</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted transition group-hover:translate-x-0.5" />
    </>
  );
  if (href) return <Link href={href} className={acuteClass}>{inner}</Link>;
  return <button type="button" onClick={onClick} className={acuteClass}>{inner}</button>;
}

export function severityTone(label: string) {
  if (label === "Minimal") return "bg-sand text-ink";
  if (label === "Mild") return "bg-[#e7f0ea] text-forest";
  if (label === "Moderate") return "bg-[#f6efdc] text-[#6e5420]";
  return "bg-[#f8e8e6] text-rose";
}

export const primaryBtn = "inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3.5 text-sm font-medium text-cream transition hover:bg-forest disabled:opacity-40";
export const secondaryBtn = "inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3.5 text-sm font-medium text-ink ring-1 ring-line transition hover:bg-sand/50";
export const dangerBtn = "inline-flex w-full items-center justify-center gap-2 rounded-full bg-rose/5 px-5 py-3.5 text-sm font-medium text-rose ring-1 ring-rose/20 transition hover:bg-rose/10";
export const quietDanger = "shrink-0 text-xs font-medium text-muted transition hover:text-rose";
export const inputCls = "w-full rounded-2xl border border-transparent bg-white px-4 py-3 text-ink shadow-[0_0_0_1px_rgba(227,221,210,1)] outline-none transition placeholder:text-muted/60 focus:shadow-[0_0_0_1px_rgba(22,21,19,0.35),0_0_0_4px_rgba(22,21,19,0.05)]";

export function useToast() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2500);
    return () => clearTimeout(t);
  }, [msg]);
  const el = msg ? (
    <div role="status" className="pointer-events-none fixed bottom-28 left-1/2 z-40 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-full bg-ink px-4 py-3 text-center text-sm text-cream shadow-[0_16px_40px_-20px_rgba(22,21,19,0.85)] lg:bottom-8">
      {msg}
    </div>
  ) : null;
  return [setMsg, el] as const;
}

export function useNowInput() {
  const [v, setV] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setV(toLocalInput(Date.now())), 0);
    return () => clearTimeout(t);
  }, []);
  return [v, setV] as const;
}
