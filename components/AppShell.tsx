"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ClipboardCheck, Zap, ListChecks, LineChart, FileText, Settings } from "lucide-react";
import { seedIfFirstLaunch } from "@/lib/db";

const NAV = [
  { href: "/", label: "Check-In", icon: ClipboardCheck },
  { href: "/episodes", label: "Episodes", icon: Zap },
  { href: "/screener", label: "Screeners", icon: ListChecks },
  { href: "/trends", label: "Trends", icon: LineChart },
  { href: "/summary", label: "Summary", icon: FileText },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  useEffect(() => {
    seedIfFirstLaunch().catch(() => {});
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return (
    <>
      <header className="no-print sticky top-0 z-10 flex items-center justify-between bg-teal-700 px-4 py-3 text-white">
        <h1 className="text-lg font-bold">ClinTrack</h1>
        <Link href="/settings" aria-label="Settings" className="rounded p-1 hover:bg-teal-600">
          <Settings size={22} />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4">{children}</main>
      <nav className="no-print fixed inset-x-0 bottom-0 z-10 border-t border-slate-300 bg-white" aria-label="Primary">
        <ul className="mx-auto flex max-w-3xl">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${active ? "text-teal-800" : "text-slate-600"}`}
                >
                  <Icon size={22} strokeWidth={active ? 2.6 : 2} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
