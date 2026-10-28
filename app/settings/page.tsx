"use client";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, clearAll, exportAll, getPatientName, importAll } from "@/lib/db";
import { clearServerRecords, pushOwnedRecords, saveProfile, signOut } from "@/lib/persist";
import type { Medication } from "@/lib/types";
import { Card, primaryBtn, secondaryBtn, dangerBtn, inputCls, useToast, PageHeader, quietDanger } from "@/components/ui";

export default function SettingsPage() {
  const stored = useLiveQuery(() => db.settings.get("profile"), []);
  const storedReminder = useLiveQuery(() => db.settings.get("reminder"), []);
  const [name, setName] = useState<string | null>(null);
  const shown = name ?? stored?.patientName ?? "";
  const [remind, setRemind] = useState<string | null>(null);
  const shownRemind = remind ?? storedReminder?.reminderTime ?? "";
  const [toast, toastEl] = useToast();
  const [account, setAccount] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    fetch("/api/auth/session").then((res) => res.json()).then((data: { user: { username: string } | null }) => setAccount(data.user?.username ?? ""));
  }, []);

  const medications = stored?.medications ?? [];

  async function saveName() {
    const ok = await saveProfile({ patientName: shown.trim(), medications });
    toast(ok ? "Name saved" : "Saved on this device. The database could not be reached.");
  }

  async function changePassword() {
    setPwError("");
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current: currentPw, next: nextPw }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setPwError(data.error ?? "Could not change the password.");
      return;
    }
    setCurrentPw("");
    setNextPw("");
    toast("Password changed");
  }

  async function addMed() {
    const nextName = medName.trim();
    if (!nextName) return;
    const next: Medication[] = [...medications, { id: crypto.randomUUID(), name: nextName, dose: medDose.trim() }];
    const ok = await saveProfile({ patientName: shown.trim(), medications: next });
    setMedName("");
    setMedDose("");
    toast(ok ? "Medication saved" : "Saved on this device. The database could not be reached.");
  }

  async function removeMed(id: string) {
    const ok = await saveProfile({ patientName: shown.trim(), medications: medications.filter((med) => med.id !== id) });
    toast(ok ? "Medication removed" : "Removed on this device. The database could not be reached.");
  }

  async function saveReminder() {
    if (!shownRemind) {
      await db.settings.delete("reminder");
      setRemind("");
      toast("Reminder turned off");
      return;
    }
    if (typeof Notification === "undefined") {
      toast("This browser cannot show notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast("Notifications are blocked in this browser.");
      return;
    }
    await db.settings.put({ key: "reminder", reminderTime: shownRemind });
    toast("Daily reminder saved");
  }

  async function doExport() {
    const blob = new Blob([JSON.stringify(await exportAll(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clintrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function doImport(f: File) {
    try {
      await importAll(JSON.parse(await f.text()));
      await clearServerRecords();
      await pushOwnedRecords();
      setName(await getPatientName());
      toast("Backup restored");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import failed");
    }
    if (file.current) file.current.value = "";
  }

  return (
    <>
      <PageHeader kicker="Private by default" title="Settings" lede="Sign-in locks check-ins, episodes, screeners, and the report name to your account. A JSON backup still leaves only when you export it." />
      <Card title="Account">
        <p className="mb-4 text-sm leading-relaxed text-muted">{account ? <>Signed in as <span className="font-medium text-ink">{account}</span>. Signing out locks the records until that password is used again.</> : "Signed in."}</p>
        <button className={secondaryBtn} onClick={() => signOut()}>Sign out</button>
      </Card>
      <Card title="Change password">
        <p className="mb-4 text-sm leading-relaxed text-muted">There is no email on this account, so a reset has to happen here, with the current password.</p>
        <label htmlFor="current-pw" className="mb-2 block text-[13px] font-medium text-muted">Current password</label>
        <input id="current-pw" type="password" autoComplete="current-password" className={`${inputCls} mb-4`} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
        <label htmlFor="next-pw" className="mb-2 block text-[13px] font-medium text-muted">New password</label>
        <input id="next-pw" type="password" autoComplete="new-password" className={`${inputCls} mb-4`} value={nextPw} onChange={(e) => setNextPw(e.target.value)} />
        {pwError && <p className="mb-3 text-sm text-rose">{pwError}</p>}
        <button className={primaryBtn} onClick={changePassword}>Change password</button>
      </Card>
      <Card title="Name on reports">
        <label htmlFor="pname" className="mb-2 block text-[13px] font-medium text-muted">Patient name</label>
        <input id="pname" maxLength={80} className={`${inputCls} mb-4`} value={shown} onChange={(e) => setName(e.target.value)} placeholder="Shown on the clinical summary" />
        <button className={primaryBtn} onClick={saveName}>Save name</button>
      </Card>
      <Card title="Medications">
        <p className="mb-4 text-sm leading-relaxed text-muted">A short list of name and dose. An acute event can record which one was used instead of a generic PRN label.</p>
        {medications.length > 0 && (
          <ul className="mb-4 space-y-2">
            {medications.map((med) => (
              <li key={med.id} className="flex items-center justify-between gap-3 rounded-2xl bg-sand/50 px-4 py-3">
                <span className="text-sm text-ink">{med.name}{med.dose ? ` ${med.dose}` : ""}</span>
                <button className={quietDanger} onClick={() => removeMed(med.id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <label htmlFor="med-name" className="mb-2 block text-[13px] font-medium text-muted">Name</label>
        <input id="med-name" maxLength={80} className={`${inputCls} mb-4`} value={medName} onChange={(e) => setMedName(e.target.value)} placeholder="Lorazepam" />
        <label htmlFor="med-dose" className="mb-2 block text-[13px] font-medium text-muted">Dose</label>
        <input id="med-dose" maxLength={40} className={`${inputCls} mb-4`} value={medDose} onChange={(e) => setMedDose(e.target.value)} placeholder="0.5 mg" />
        <button className={primaryBtn} onClick={addMed} disabled={!medName.trim() || medications.length >= 30}>Add medication</button>
      </Card>
      <Card title="Daily reminder">
        <p className="mb-4 text-sm leading-relaxed text-muted">Asks once a day while this tab is open, then opens the check-in page. Nothing is emailed, and there is no push server.</p>
        <label htmlFor="remind" className="mb-2 block text-[13px] font-medium text-muted">Time</label>
        <input id="remind" type="time" className={`${inputCls} mb-4`} value={shownRemind} onChange={(e) => setRemind(e.target.value)} />
        <button className={primaryBtn} onClick={saveReminder}>{shownRemind ? "Save reminder" : "Turn reminder off"}</button>
      </Card>
      <Card title="Backup">
        <p className="mb-4 text-sm leading-relaxed text-muted">Export a JSON file, or restore one. Restoring replaces the data on this device and replaces the account records in the app database.</p>
        <div className="flex flex-col gap-2">
          <button className={primaryBtn} onClick={doExport}>Export JSON</button>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" aria-label="Import JSON file" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
          <button className={secondaryBtn} onClick={() => file.current?.click()}>Import JSON</button>
          <button
            className={dangerBtn}
            onClick={async () => { if (confirm("Delete all data on this device, including the records stored with this account?")) { await clearAll(); await clearServerRecords(); setName(""); toast("All data deleted"); } }}
          >
            Delete all data
          </button>
        </div>
      </Card>
      {toastEl}
    </>
  );
}
