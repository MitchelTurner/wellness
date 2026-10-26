"use client";
import { useEffect, useRef, useState } from "react";
import { db, clearAll, exportAll, getPatientName, importAll } from "@/lib/db";
import { Card, primaryBtn, inputCls, useToast } from "@/components/ui";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [toast, toastEl] = useToast();
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { getPatientName().then(setName); }, []);

  async function saveName() {
    await db.settings.put({ key: "profile", patientName: name.trim() });
    toast("Saved");
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
      setName(await getPatientName());
      toast("Backup restored");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import failed");
    }
    if (file.current) file.current.value = "";
  }

  return (
    <>
      <Card title="Profile">
        <label htmlFor="pname" className="mb-1 block font-semibold">Patient name (shown on reports)</label>
        <input id="pname" className={`${inputCls} mb-3`} value={name} onChange={(e) => setName(e.target.value)} />
        <button className={primaryBtn} onClick={saveName}>Save</button>
      </Card>
      <Card title="Backup">
        <p className="mb-3 text-sm text-slate-700">All data stays on this device. Export a JSON backup or restore one (this replaces current data).</p>
        <button className={`${primaryBtn} mb-2`} onClick={doExport}>Export JSON</button>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" aria-label="Import JSON file" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        <button className={`${primaryBtn} mb-2 !bg-slate-800`} onClick={() => file.current?.click()}>Import JSON</button>
        <button
          className="w-full rounded-xl border-2 border-red-700 px-4 py-3 font-bold text-red-700"
          onClick={async () => { if (confirm("Delete ALL data on this device?")) { await clearAll(); setName(""); toast("All data deleted"); } }}
        >
          Delete all data
        </button>
      </Card>
      {toastEl}
    </>
  );
}
