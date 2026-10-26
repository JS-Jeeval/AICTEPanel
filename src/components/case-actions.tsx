import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { BUREAUS, STATUSES, officersOf, type Case, type Status } from "@/lib/data";
import { Btn, Field } from "./common";

export type Mode = "record" | "status" | "reassign" | "transfer" | "escalate" | "link" | null;
const ACTIONS = ["Notice issued to institution", "Reminder sent", "Institution reply examined", "Site inspection scheduled", "Hearing conducted", "Coordination meeting held", "Case disposed"];

export function CaseActionDialog({ c, mode, onClose }: { c: Case; mode: Mode; onClose: () => void }) {
  const s = useStore();
  const [f, setF] = useState({ action: "", remarks: "", next: "", status: "", followUp: "", doc: "", officer: "", bureau: "", link: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const submit = () => {
    const e: Record<string, string> = {};
    const req = (k: keyof typeof f, msg = "Required") => { if (!f[k].trim()) e[k] = msg; };
    if (mode === "record") { req("action"); req("remarks"); req("next"); if (f.remarks.trim().length < 10) e.remarks = "Provide at least 10 characters."; }
    if (mode === "status") { req("status"); req("remarks"); }
    if (mode === "reassign") req("officer");
    if (mode === "transfer") { req("bureau"); req("remarks", "Transfer reason is required"); }
    if (mode === "escalate") req("remarks", "Escalation reason is required");
    if (mode === "link") { req("link"); if (f.link && !s.cases.some((x) => x.id === f.link.trim())) e.link = "Case ID not found"; if (f.link.trim() === c.id) e.link = "Cannot link a case to itself"; }
    setErr(e);
    if (Object.keys(e).length) return;
    if (mode === "record") s.recordAction(c.id, { action: f.action, remarks: f.remarks, next: f.next, status: (f.status || undefined) as Status | undefined, followUp: f.followUp || undefined, doc: f.doc || undefined });
    if (mode === "status") s.recordAction(c.id, { action: `Status changed to ${f.status}`, remarks: f.remarks, next: c.nextAction, status: f.status as Status });
    if (mode === "reassign") s.reassign(c.id, f.officer);
    if (mode === "transfer") s.transfer(c.id, f.bureau, f.remarks);
    if (mode === "escalate") s.transfer(c.id, c.currentBureau, f.remarks, "Escalation");
    if (mode === "link") { s.linkCases(c.id, f.link.trim()); }
    onClose();
  };
  const title = { record: "Record action", status: "Change status", reassign: "Reassign officer", transfer: "Transfer case", escalate: "Escalate case", link: "Link related case" }[mode ?? "record"];
  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-base">{title} · <span className="font-mono text-sm">{c.id}</span></DialogTitle></DialogHeader>
        <div className="space-y-3">
          {mode === "record" && <>
            <Field label="Action type *" error={err.action}><select className="field w-full" value={f.action} onChange={set("action")}><option value="">Select</option>{ACTIONS.map((a) => <option key={a}>{a}</option>)}</select></Field>
            <Field label="Remarks *" error={err.remarks}><textarea className="field h-20 w-full py-2" value={f.remarks} onChange={set("remarks")} /></Field>
            <Field label="Next action required *" error={err.next}><input className="field w-full" value={f.next} onChange={set("next")} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="New status"><select className="field w-full" value={f.status} onChange={set("status")}><option value="">No change</option>{STATUSES.filter((x) => x !== "Transferred").map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Next follow-up date"><input type="date" className="field w-full" value={f.followUp} onChange={set("followUp")} /></Field>
            </div>
            <Field label="Supporting attachment (file name only in demo)"><input type="file" className="text-xs" onChange={(e) => setF({ ...f, doc: e.target.files?.[0]?.name ?? "" })} /></Field>
          </>}
          {mode === "status" && <>
            <Field label="New status *" error={err.status}><select className="field w-full" value={f.status} onChange={set("status")}><option value="">Select</option>{STATUSES.filter((x) => x !== c.status && x !== "Transferred").map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Reason *" error={err.remarks}><textarea className="field h-20 w-full py-2" value={f.remarks} onChange={set("remarks")} /></Field>
          </>}
          {mode === "reassign" && <Field label="Officer *" error={err.officer}><select className="field w-full" value={f.officer} onChange={set("officer")}><option value="">Select officer in {c.currentBureau}</option>{officersOf(c.currentBureau, s.users).filter((u) => u.id !== c.officerId).map((u) => <option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}</select></Field>}
          {mode === "transfer" && <>
            <Field label="Destination bureau *" error={err.bureau}><select className="field w-full" value={f.bureau} onChange={set("bureau")}><option value="">Select</option>{BUREAUS.filter((b) => b.id !== c.currentBureau).map((b) => <option key={b.id} value={b.id}>{b.id} — {b.name}</option>)}</select></Field>
            <Field label="Transfer reason *" error={err.remarks}><textarea className="field h-20 w-full py-2" value={f.remarks} onChange={set("remarks")} /></Field>
          </>}
          {mode === "escalate" && <Field label="Escalation reason *" error={err.remarks}><textarea className="field h-20 w-full py-2" value={f.remarks} onChange={set("remarks")} /></Field>}
          {mode === "link" && <Field label="Related case ID *" error={err.link}><input list="caseids" className="field w-full font-mono" value={f.link} onChange={set("link")} placeholder="AICTE/RB/2026/1001" />
            <datalist id="caseids">{s.cases.filter((x) => x.instId === c.instId && x.id !== c.id).map((x) => <option key={x.id} value={x.id} />)}</datalist>
            <span className="block font-normal text-muted-foreground">Linking records a relationship; both complaints remain separate.</span></Field>}
          <div className="flex justify-end gap-2 pt-1"><Btn onClick={onClose}>Cancel</Btn><Btn v="primary" onClick={submit}>Submit</Btn></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
