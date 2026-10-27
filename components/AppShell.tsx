"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ClipboardCheck, Zap, ListChecks, LineChart, FileText, Settings } from "lucide-react";
import { seedIfFirstLaunch } from "@/lib/db";
import { pullServerRecords, pushOwnedRecords } from "@/lib/persist";

const NAV = [
  { href: "/", label: "Check-In", icon: ClipboardCheck },
  { href: "/episodes", label: "Episodes", icon: Zap },
  { href: "/screener", label: "Screeners", icon: ListChecks },
  { href: "/trends", label: "Trends", icon: LineChart },
  { href: "/summary", label: "Summary", icon: FileText },
];

function Mark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="10" fill="#161513" />
      <path d="M6.2 18.6h5l2.5-6.6 3.7 10.6 2.6-6.2H25.8" fill="none" stroke="#f4f1ea" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  useEffect(() => {
    seedIfFirstLaunch()
      .then(() => pullServerRecords())
      .then(() => pushOwnedRecords())
      .catch(() => {});
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const settingsOn = path.startsWith("/settings");

  return (
    <div className="relative min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-white/70 bg-white/40 px-4 py-7 backdrop-blur-2xl lg:flex">
        <Link href="/" className="rounded-2xl px-2">
          <span className="flex items-center gap-2.5">
            <Mark />
            <span>
              <span className="block font-serif text-[1.35rem] italic leading-none text-ink">ClinTrack</span>
              <span className="mt-1 block text-[11px] text-muted">Private · on this device</span>
            </span>
          </span>
        </Link>
        <nav className="mt-10 flex flex-1 flex-col gap-1" aria-label="Primary">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${active ? "bg-ink text-cream" : "text-ink/75 hover:bg-white/80 hover:text-ink"}`}
              >
                <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-line/80 pt-4">
          <Link
            href="/settings"
            aria-current={settingsOn ? "page" : undefined}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${settingsOn ? "bg-ink text-cream" : "text-ink/75 hover:bg-white/80 hover:text-ink"}`}
          >
            <Settings size={18} strokeWidth={settingsOn ? 2.25 : 1.75} />
            Settings
          </Link>
        </div>
      </aside>

      <div className="app-frame lg:pl-60">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between bg-cream/75 px-5 py-3 backdrop-blur-md lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <Mark className="size-7" />
            <span className="font-serif text-lg italic leading-none text-ink">ClinTrack</span>
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            aria-current={settingsOn ? "page" : undefined}
            className={`grid size-10 place-items-center rounded-full transition ${settingsOn ? "bg-ink text-cream" : "bg-white/80 text-ink ring-1 ring-line"}`}
          >
            <Settings size={18} />
          </Link>
        </header>
        <main className="mx-auto w-full max-w-3xl px-5 pb-32 pt-3 lg:px-10 lg:pb-16 lg:pt-12">{children}</main>
      </div>

      <nav className="no-print fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden" aria-label="Primary">
        <ul className="mx-auto flex max-w-md items-stretch rounded-full bg-white/80 p-1.5 shadow-[0_16px_40px_-18px_rgba(22,21,19,0.55)] ring-1 ring-white/90 backdrop-blur-xl">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 rounded-full px-1 py-2 text-[10px] font-medium tracking-tight ${active ? "bg-ink text-cream" : "text-muted"}`}
                >
                  <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
