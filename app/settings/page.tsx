"use client";
import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, clearAll, exportAll, getPatientName, importAll } from "@/lib/db";
import { clearServerRecords, pushOwnedRecords } from "@/lib/persist";
import { Card, primaryBtn, secondaryBtn, dangerBtn, inputCls, useToast, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const stored = useLiveQuery(() => db.settings.get("profile"), []);
  const [name, setName] = useState<string | null>(null);
  const shown = name ?? stored?.patientName ?? "";
  const [toast, toastEl] = useToast();
  const file = useRef<HTMLInputElement>(null);

  async function saveName() {
    await db.settings.put({ key: "profile", patientName: shown.trim() });
    toast("Name saved");
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
      <PageHeader kicker="Private by default" title="Settings" lede="Check-ins and episodes are stored in the app database as well as on this device. A JSON backup still leaves only when you export it." />
      <Card title="Name on reports">
        <label htmlFor="pname" className="mb-2 block text-[13px] font-medium text-muted">Patient name</label>
        <input id="pname" className={`${inputCls} mb-4`} value={shown} onChange={(e) => setName(e.target.value)} placeholder="Shown on the clinical summary" />
        <button className={primaryBtn} onClick={saveName}>Save name</button>
      </Card>
      <Card title="Backup">
        <p className="mb-4 text-sm leading-relaxed text-muted">Export a JSON file, or restore one. Restoring replaces the data on this device and replaces check-ins and episodes in the app database.</p>
        <div className="flex flex-col gap-2">
          <button className={primaryBtn} onClick={doExport}>Export JSON</button>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" aria-label="Import JSON file" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
          <button className={secondaryBtn} onClick={() => file.current?.click()}>Import JSON</button>
          <button
            className={dangerBtn}
            onClick={async () => { if (confirm("Delete all data on this device, including check-ins and episodes in the app database?")) { await clearAll(); await clearServerRecords(); setName(""); toast("All data deleted"); } }}
          >
            Delete all data
          </button>
        </div>
      </Card>
      {toastEl}
    </>
  );
}
