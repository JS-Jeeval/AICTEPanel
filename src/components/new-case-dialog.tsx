import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { BUREAUS, CATEGORIES, slug, type Priority } from "@/lib/data";
import { detectOverlaps, summariseMatches, type OverlapMatch } from "@/lib/overlap";
import { Btn, Field } from "./common";
import { OverlapMatches } from "./overlap-matches";

const PRIORITIES: Priority[] = ["High", "Medium", "Low"];
/** Cross-bureau matches of reasonable confidence are ticked by default; officers can untick any of them. */
const defaultOn = (m: OverlapMatch) => m.differentBureau && m.confidence >= 0.5;

export function NewCaseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const nav = useNavigate();
  const [f, setF] = useState({ instId: "", category: "", summary: "", bureau: s.user?.bureau ?? "PGRC", priority: "Medium" as Priority, doc: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const set = (k: "instId" | "category" | "summary" | "bureau") => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  // Re-runs on every change to institution, category, summary or bureau — this is the "dynamic" part.
  const matches = useMemo(
    () => (f.instId && f.category ? detectOverlaps({ instId: f.instId, category: f.category, summary: f.summary, bureau: f.bureau }, s.cases, s.institutions) : []),
    [f.instId, f.category, f.summary, f.bureau, s.cases, s.institutions],
  );
  const checked = (m: OverlapMatch) => override[m.caseId] ?? defaultOn(m);
  const top = matches[0];

  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.instId) e.instId = "Select the institution";
    if (!f.category) e.category = "Select a category";
    if (f.summary.trim().length < 20) e.summary = "Describe the complaint in at least 20 characters.";
    setErr(e);
    if (Object.keys(e).length) return;
    const created = s.createCase({ instId: f.instId, category: f.category, summary: f.summary, bureau: f.bureau, priority: f.priority, doc: f.doc || undefined }, matches.filter(checked));
    onClose();
    if (created) nav({ to: "/cases/$id", params: { id: slug(created.id) } });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-auto">
        <DialogHeader><DialogTitle className="text-base">Register new complaint</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <Field label="Institution *" error={err.instId}>
              <select className="field w-full" value={f.instId} onChange={set("instId")}><option value="">Select institution</option>{s.institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
            </Field>
            <Field label="Category *" error={err.category}>
              <select className="field w-full" value={f.category} onChange={set("category")}><option value="">Select category</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Handling bureau"><select className="field w-full" value={f.bureau} onChange={set("bureau")}>{BUREAUS.map((b) => <option key={b.id} value={b.id}>{b.id}</option>)}</select></Field>
              <Field label="Priority"><select className="field w-full" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Priority })}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
            </div>
            <Field label="Complaint summary *" error={err.summary}><textarea className="field h-28 w-full py-2" value={f.summary} onChange={set("summary")} placeholder="What is alleged, and when?" /></Field>
            <Field label="Supporting attachment (file name only in demo)"><input type="file" className="text-xs" onChange={(e) => setF({ ...f, doc: e.target.files?.[0]?.name ?? "" })} /></Field>
          </div>
          <div aria-live="polite">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold"><ShieldAlert className="size-3.5 text-primary" />Live overlap check</div>
            {!f.instId || !f.category ? <p className="text-xs text-muted-foreground">Choose an institution and category to compare against existing cases.</p>
              : matches.length === 0 ? <p className="rounded border border-success/25 bg-success/10 p-2 text-xs">No overlapping or duplicate complaints found for this institution.</p>
                : <>
                  <p className="mb-2 text-xs text-muted-foreground">{summariseMatches(matches)}.{top && top.confidence >= 0.8 ? " A high-confidence match exists — check whether this is a duplicate before registering." : ""}</p>
                  <OverlapMatches matches={matches} cases={s.cases} institutions={s.institutions} limit={4} action={(m) => (
                    <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={checked(m)} onChange={() => setOverride({ ...override, [m.caseId]: !checked(m) })} />Raise alert</label>
                  )} />
                  <p className="mt-2 text-[11px] text-muted-foreground">Ticked matches become coordination alerts for the bureau heads. Complaints stay separate records.</p>
                </>}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1"><Btn onClick={onClose}>Cancel</Btn><Btn v="primary" onClick={submit}>Register complaint</Btn></div>
      </DialogContent>
    </Dialog>
  );
}
