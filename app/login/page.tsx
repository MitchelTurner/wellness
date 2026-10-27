"use client";
import { useEffect, useState } from "react";
import { inputCls, primaryBtn } from "@/components/ui";

export default function LoginPage() {
  const [mode, setMode] = useState<"loading" | "setup" | "login">("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data: { user: { username: string } | null; needsSetup: boolean }) => {
        if (data.user) {
          window.location.replace("/");
          return;
        }
        setMode(data.needsSetup ? "setup" : "login");
      })
      .catch(() => setMode("login"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || mode === "loading") return;
    setPending(true);
    setError("");
    try {
      const res = await fetch(mode === "setup" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not sign in.");
        setPending(false);
        return;
      }
      // Full load so the session cookie is on the next document request.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch {
      setError("Could not reach ClinTrack.");
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-16">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted">ClinTrack</p>
      <h1 className="font-serif text-5xl italic leading-none tracking-tight text-ink">{mode === "setup" ? "Create your account" : "Sign in"}</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        {mode === "setup"
          ? "The first account locks check-ins and episodes. Only someone with this password can open them."
          : "Your check-ins and episodes stay locked until you sign in."}
      </p>
      {mode === "loading" ? (
        <p className="mt-8 text-sm text-muted">Checking the lock…</p>
      ) : (
        <form onSubmit={submit} className="mt-8 rounded-[1.7rem] bg-white/75 p-5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_24px_50px_-34px_rgba(22,21,19,0.55)] ring-1 ring-white/80">
          <label className="mb-2 block text-[13px] font-medium text-muted" htmlFor="username">Username</label>
          <input id="username" name="username" autoComplete="username" required className={`${inputCls} mb-4`} value={username} onChange={(e) => setUsername(e.target.value)} />
          <label className="mb-2 block text-[13px] font-medium text-muted" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete={mode === "setup" ? "new-password" : "current-password"} required className={`${inputCls} mb-5`} value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="mb-4 text-sm text-rose" role="alert">{error}</p>}
          <button type="submit" className={primaryBtn} disabled={pending}>{pending ? "Checking…" : mode === "setup" ? "Create account" : "Sign in"}</button>
        </form>
      )}
    </main>
  );
}
