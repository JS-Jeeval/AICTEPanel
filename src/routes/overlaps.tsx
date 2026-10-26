import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Info, X } from "lucide-react";
import { useStore, userName, can } from "@/lib/store";
import { BUREAUS, daysBetween, fmtDate, fmtDateTime, slug, type Alert, type ReviewStatus } from "@/lib/data";
import { Btn, Empty, PageHeader, Panel, Pill, Sel, StatusBadge, type Tone } from "@/components/common";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/overlaps")({
  validateSearch: (s: Record<string, unknown>): { id?: string } => ({ id: s.id as string | undefined }),
  head: () => ({ meta: [{ title: "Overlap Coordination Centre — AICTE ICMS" }, { name: "description", content: "Review potentially overlapping cases across AICTE bureaus." }, { property: "og:title", content: "Overlap Coordination Centre" }, { property: "og:description", content: "Review potentially overlapping cases across AICTE bureaus." }] }),
  component: Overlaps,
});
const OPEN: ReviewStatus[] = ["Open", "Under Review", "Coordination Required"];
const RT: Record<ReviewStatus, Tone> = { Open: "amber", "Under Review": "blue", "Coordination Required": "violet", Reviewed: "green", Dismissed: "grey", "Confirmed Overlap": "red" };

function Overlaps() {
  const s = useStore();
  const { id } = Route.useSearch();
  const nav = useNavigate();
  const [f, setF] = useState({ bureau: "", conf: "", age: "", review: "" });
  const get = (cid: string) => s.cases.find((c) => c.id === cid)!;
  const list = s.alerts.filter((a) => { const A = get(a.caseA), B = get(a.caseB); return (!f.bureau || [A.currentBureau, B.currentBureau].includes(f.bureau)) && (!f.conf || (f.conf === "high" ? a.confidence >= 0.75 : f.conf === "med" ? a.confidence >= 0.5 && a.confidence < 0.75 : a.confidence < 0.5)) && (!f.age || daysBetween(a.detected) > Number(f.age)) && (!f.review || (f.review === "unresolved" ? OPEN.includes(a.review) : a.review === f.review)); });
  const sel = s.alerts.find((a) => a.id === id) ?? list[0];
  const unresolved = s.alerts.filter((a) => OPEN.includes(a.review)).length;
  return (
    <>
      <PageHeader title="Overlap Coordination Centre" sub="Rule-based candidates for review. A match indicates possible overlap — it does not prove duplication.">
        <Pill t="red" className="text-xs">{unresolved} unresolved</Pill>
        <Sel label="Bureau" value={f.bureau} onChange={(v) => setF({ ...f, bureau: v })} options={BUREAUS.map((b) => b.id)} />
        <Sel label="Matching strength" value={f.conf} onChange={(v) => setF({ ...f, conf: v })} options={[["high", "Strong (≥75%)"], ["med", "Moderate"], ["low", "Weak (<50%)"]]} />
        <Sel label="Any age" value={f.age} onChange={(v) => setF({ ...f, age: v })} options={[["7", "> 7 days"], ["30", "> 30 days"]]} />
        <Sel label="Review status" value={f.review} onChange={(v) => setF({ ...f, review: v })} options={[["unresolved", "Unresolved"], ...(Object.keys(RT) as string[])]} />
      </PageHeader>
      <div className="grid gap-3 xl:grid-cols-[360px_1fr]">
        <div className="panel max-h-[calc(100vh-200px)] divide-y overflow-auto">
          {list.map((a) => { const A = get(a.caseA), B = get(a.caseB); const inst = s.institutions.find((i) => i.id === A.instId)!; return (
            <button key={a.id} onClick={() => nav({ to: "/overlaps", search: { id: a.id } })} className={cn("block w-full p-3 text-left hover:bg-muted/50", sel?.id === a.id && "bg-accent")}>
              <div className="flex items-center justify-between"><span className="font-mono text-xs font-medium">{a.id}</span><Pill t={RT[a.review]}>{a.review}</Pill></div>
              <div className="mt-0.5 truncate text-[13px] font-medium">{inst.name}</div>
              <div className="text-[11px] text-muted-foreground"><span className="font-mono">{inst.permId}</span> · {A.currentBureau} ↔ {B.currentBureau}</div>
              <div className="mt-1 flex items-center gap-2 text-[11px]"><Pill t="violet">{a.matchType}</Pill><span>Strength {Math.round(a.confidence * 100)}%</span><span className="text-muted-foreground">· {fmtDate(a.detected)}</span></div>
            </button>); })}
          {!list.length && <Empty />}
        </div>
        {sel ? <AlertDetail key={sel.id} a={sel} /> : <Panel><Empty text="Select an alert." /></Panel>}
      </div>
    </>
  );
}

function AlertDetail({ a }: { a: Alert }) {
  const s = useStore();
  const p = can(s.user);
  const [remarks, setRemarks] = useState("");
  const [err, setErr] = useState("");
  const A = s.cases.find((c) => c.id === a.caseA)!, B = s.cases.find((c) => c.id === a.caseB)!;
  const inst = s.institutions.find((i) => i.id === A.instId)!;
  const rows: [string, (c: typeof A) => React.ReactNode, boolean?][] = [
    ["Case ID", (c) => <Link to="/cases/$id" params={{ id: slug(c.id) }} className="font-mono text-primary">{c.id}</Link>, false],
    ["Institution", () => `${inst.name} (${inst.permId})`, true], ["Complaint category", (c) => c.category], ["Summary", (c) => c.summary],
    ["Receiving bureau", (c) => c.receivingBureau], ["Current bureau", (c) => c.currentBureau], ["Status", (c) => <StatusBadge s={c.status} />],
    ["Last action", (c) => c.lastAction], ["Next action", (c) => c.nextAction], ["Expected disposal", (c) => fmtDate(c.due)],
  ];
  const raw: Record<string, (c: typeof A) => string> = { "Complaint category": (c) => c.category, Summary: (c) => c.summary, "Receiving bureau": (c) => c.receivingBureau, "Current bureau": (c) => c.currentBureau, Status: (c) => c.status, "Last action": (c) => c.lastAction, "Next action": (c) => c.nextAction };
  const both = A.status !== "Disposed" && B.status !== "Disposed";
  const explanation = `${inst.verified ? "Both cases reference the same verified AICTE Permanent ID." : "Both cases reference the same institution name; the Permanent ID is not yet verified."} One case is with ${A.currentBureau} and the other with ${B.currentBureau}. ${A.category === B.category ? `Both concern "${A.category}".` : `They concern different issues (${A.category} / ${B.category}).`} ${both ? "Both cases remain active. Coordination is recommended to prevent conflicting or duplicated action." : "One case is disposed; review whether its outcome affects the active case."}`;
  const act = (review: ReviewStatus | null, decision: string, needRemarks = false) => {
    if (needRemarks && remarks.trim().length < 5) { setErr(decision === "Dismiss Alert" ? "A dismissal reason is required." : "Remarks are required for this decision."); return; }
    setErr(""); s.reviewAlert(a.id, review, decision, remarks.trim() || decision); setRemarks("");
  };
  return (
    <div className="space-y-3">
      <Panel title={`${a.id} · ${a.matchType}`} action={<Link to="/institutions/$id" params={{ id: inst.id }} className="text-xs text-primary">View institution profile</Link>}>
        <div className="flex gap-2 rounded border border-primary/20 bg-primary/5 p-3 text-xs"><Info className="mt-0.5 size-4 shrink-0 text-primary" /><div><p>{explanation}</p><ul className="mt-1.5 flex flex-wrap gap-1">{a.reasons.map((r) => <Pill key={r} t="blue">{r}</Pill>)}</ul><p className="mt-1.5 text-[11px] text-muted-foreground">Illustrative demo content generated from synthetic records. Matching strength {Math.round(a.confidence * 100)}% reflects rule matches, not proof of duplication.</p></div></div>
        <table className="mt-3 w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th className="w-36 py-1 font-medium">Field</th><th className="font-medium">Case A</th><th className="font-medium">Case B</th><th className="w-14" /></tr></thead>
          <tbody className="divide-y">{rows.map(([k, fn, same]) => { const m = same ?? (raw[k] ? raw[k](A) === raw[k](B) : undefined); return (
            <tr key={k} className={cn(m === true && "bg-success/5")}><td className="py-1.5 text-muted-foreground">{k}</td><td className="pr-3">{fn(A)}</td><td className="pr-3">{fn(B)}</td><td>{m === true ? <Pill t="green"><Check className="size-3" />Match</Pill> : m === false ? <Pill><X className="size-3" />Differs</Pill> : null}</td></tr>); })}</tbody></table>
      </Panel>
      <Panel title="Review decision">
        {p.act ? <>
          <textarea className="field h-16 w-full py-2" placeholder="Review remarks / dismissal reason" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn v="primary" onClick={() => act("Confirmed Overlap", "Confirm Overlap", true)}>Confirm Overlap</Btn>
            <Btn onClick={() => act("Reviewed", "Same Institution, Different Issues")}>Same Institution, Different Issues</Btn>
            <Btn onClick={() => act("Coordination Required", "Request Coordination", true)}>Request Coordination</Btn>
            <Btn onClick={() => act(null, "Link Cases")} disabled={A.linked.includes(B.id)}>{A.linked.includes(B.id) ? "Cases linked" : "Link Cases"}</Btn>
            <Btn onClick={() => act(null, "Review remarks added", true)}>Add Remarks</Btn>
            <Btn v="danger" onClick={() => act("Dismissed", "Dismiss Alert", true)}>Dismiss Alert</Btn>
          </div></> : <p className="text-xs text-muted-foreground">Your role can view but not decide on overlap alerts.</p>}
      </Panel>
      <Panel title="Review audit trail"><ol className="space-y-1.5">{a.history.map((h, i) => <li key={i} className="text-xs"><span className="text-muted-foreground">{fmtDateTime(h.ts)}</span> · <b className="font-medium">{h.decision}</b> — {userName(s.users, h.userId)}{h.remarks && h.remarks !== h.decision && <span className="text-muted-foreground">: {h.remarks}</span>}</li>)}</ol>
        <p className="mt-2 text-[11px] text-muted-foreground">Assigned reviewer: {userName(s.users, a.reviewerId)}</p></Panel>
    </div>
  );
}
