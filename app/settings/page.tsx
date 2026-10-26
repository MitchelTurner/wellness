"use client";
import { useEffect, useRef, useState } from "react";
import { db, clearAll, exportAll, getPatientName, importAll } from "@/lib/db";
import { Card, primaryBtn, secondaryBtn, dangerBtn, inputCls, useToast, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [toast, toastEl] = useToast();
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { getPatientName().then(setName); }, []);

  async function saveName() {
    await db.settings.put({ key: "profile", patientName: name.trim() });
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
      setName(await getPatientName());
      toast("Backup restored");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import failed");
    }
    if (file.current) file.current.value = "";
  }

  return (
    <>
      <PageHeader kicker="Private by default" title="Settings" lede="Nothing is uploaded. A backup leaves this device only when you export it." />
      <Card title="Name on reports">
        <label htmlFor="pname" className="mb-2 block text-[13px] font-medium text-muted">Patient name</label>
        <input id="pname" className={`${inputCls} mb-4`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Shown on the clinical summary" />
        <button className={primaryBtn} onClick={saveName}>Save name</button>
      </Card>
      <Card title="Backup">
        <p className="mb-4 text-sm leading-relaxed text-muted">Export a JSON file, or restore one. Restoring replaces everything currently stored here.</p>
        <div className="flex flex-col gap-2">
          <button className={primaryBtn} onClick={doExport}>Export JSON</button>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" aria-label="Import JSON file" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
          <button className={secondaryBtn} onClick={() => file.current?.click()}>Import JSON</button>
          <button
            className={dangerBtn}
            onClick={async () => { if (confirm("Delete ALL data on this device?")) { await clearAll(); setName(""); toast("All data deleted"); } }}
          >
            Delete all data
          </button>
        </div>
      </Card>
      {toastEl}
    </>
  );
}
