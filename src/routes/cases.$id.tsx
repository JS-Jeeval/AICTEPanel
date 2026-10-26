import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, FileText, Lock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useStore, userName, can } from "@/lib/store";
import { fmtDate, fmtDateTime, slug } from "@/lib/data";
import { detectForCase } from "@/lib/overlap";
import { buildDisposalDossier, disposalFilename } from "@/lib/dossiers";
import { downloadPdf } from "@/lib/pdf";
import { toast } from "sonner";
import { Btn, Empty, KV, OverlapFlag, Panel, PriorityBadge, StatusBadge, Urgency } from "@/components/common";
import { CaseActionDialog, type Mode } from "@/components/case-actions";
import { OverlapMatches } from "@/components/overlap-matches";

export const Route = createFileRoute("/cases/$id")({
  head: ({ params }) => ({ meta: [{ title: `Case ${params.id} — AICTE ICMS` }, { name: "description", content: "Case workspace and action timeline." }, { property: "og:title", content: `Case ${params.id}` }, { property: "og:description", content: "Case workspace and action timeline." }] }),
  component: CaseDetail,
});

function CaseDetail() {
  const { id } = Route.useParams();
  const s = useStore();
  const [mode, setMode] = useState<Mode>(null);
  const c = s.cases.find((x) => slug(x.id) === id);
  if (!c) return <Empty text="Case not found." />;
  const inst = s.institutions.find((i) => i.id === c.instId)!;
  const p = can(s.user);
  const alerts = s.alerts.filter((a) => (a.caseA === c.id || a.caseB === c.id) && a.review !== "Dismissed");
  // Computed on every render from the live store, so a newly registered or changed case shows up immediately.
  const live = detectForCase(c, s.cases, s.institutions, s.alerts);
  const downloadDossier = () => {
    try {
      downloadPdf(buildDisposalDossier({ c, inst, users: s.users, allCases: s.cases, alerts: s.alerts, includeRemarks: p.remarks }), disposalFilename(c));
      s.logExport("Case", c.id, "Case disposal dossier (PDF)");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not generate the PDF"); }
  };
  const download = () => {
    const txt = [`AICTE Case Summary (DEMO — synthetic data)`, `Case: ${c.id}`, `Institution: ${inst.name} (${inst.permId})`, `Category: ${c.category}`, `Status: ${c.status}`, `Current bureau: ${c.currentBureau}`, `Officer: ${userName(s.users, c.officerId)}`, `Received: ${fmtDate(c.received)}  Expected disposal: ${fmtDate(c.due)}`, ``, c.summary, ``, `Timeline:`, ...c.events.map((e) => `${fmtDateTime(e.ts)} | ${e.action} | ${userName(s.users, e.officerId)} (${e.bureau}) | ${e.remarks}`)].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" })); a.download = `${slug(c.id)}-summary.txt`; a.click();
  };
  const menu: [Mode, string][] = [["record", "Record Action"], ["status", "Change Status"], ["reassign", "Reassign Officer"], ["transfer", "Transfer Case"], ["escalate", "Escalate"], ["link", "Link Related Case"]];
  return (
    <>
      <div className="panel mb-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="font-mono text-xs text-muted-foreground">{c.id}</div><h1 className="text-lg font-semibold"><Link to="/institutions/$id" params={{ id: inst.id }} className="hover:text-primary">{inst.name}</Link></h1>
            <div className="mt-1 flex flex-wrap gap-1"><StatusBadge s={c.status} /><PriorityBadge p={c.priority} /><Urgency c={c} />{(alerts.length > 0 || live.some((m) => m.matchType === "Potential Overlap")) && <OverlapFlag />}</div></div>
          <DropdownMenu><DropdownMenuTrigger asChild><Btn v="primary">Actions<ChevronDown className="size-3.5" /></Btn></DropdownMenuTrigger>
            <DropdownMenuContent align="end">{menu.map(([m, l]) => <DropdownMenuItem key={l} disabled={!p.act || (c.status === "Disposed" && m !== "link")} onClick={() => setMode(m)}>{l}</DropdownMenuItem>)}<DropdownMenuItem onClick={download}>Download Case Summary (TXT)</DropdownMenuItem><DropdownMenuItem disabled={c.status !== "Disposed"} onClick={downloadDossier}>Disposal Dossier (PDF){c.status !== "Disposed" ? " — after disposal" : ""}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 md:grid-cols-6"><KV k="Current bureau" v={c.currentBureau} /><KV k="Assigned officer" v={userName(s.users, c.officerId)} /><KV k="Received" v={fmtDate(c.received)} /><KV k="Expected disposal" v={fmtDate(c.due)} /><KV k="Receiving bureau" v={c.receivingBureau} /><KV k="Category" v={c.category} /></dl>
        {!p.act && <p className="mt-2 text-[11px] text-muted-foreground">Your role has read-only access to case actions.</p>}
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <Panel title="Complaint"><p className="text-[13px]">{c.summary}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3"><KV k="Last action taken" v={c.lastAction} /><KV k="Next action required" v={c.nextAction} /><KV k="Last action date" v={fmtDate(c.lastActionDate)} /></dl></Panel>
          <Panel title="Action timeline (newest first)">
            <ol className="relative space-y-4 border-l pl-4">
              {[...c.events].sort((a, b) => b.ts.localeCompare(a.ts)).map((e) => (
                <li key={e.id} className="relative"><span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-card bg-primary" />
                  <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium">{e.action}{e.to && <span className="text-[11px] font-normal text-muted-foreground">{e.from ?? "—"} → {e.to}</span>}</div>
                  <div className="text-[11px] text-muted-foreground">{fmtDateTime(e.ts)} · {userName(s.users, e.officerId)} · {e.bureau}</div>
                  {e.remarks && <p className="mt-0.5 text-xs">{e.remarks}</p>}{e.doc && <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary"><FileText className="size-3" />{e.doc}</span>}
                </li>))}
            </ol>
          </Panel>
        </div>
        <div className="space-y-3">
          <Panel title="Related cases">
            {c.linked.length === 0 && alerts.length === 0 && <p className="text-xs text-muted-foreground">No linked or flagged cases.</p>}
            {c.linked.map((l) => <Link key={l} to="/cases/$id" params={{ id: slug(l) }} className="block py-1 font-mono text-xs text-primary">{l} <span className="font-sans text-muted-foreground">(linked)</span></Link>)}
            {alerts.map((a) => <Link key={a.id} to="/overlaps" search={{ id: a.id }} className="block py-1 text-xs text-primary">{a.id}: {a.matchType} · {a.review}</Link>)}
          </Panel>
          <Panel title="Live overlap check" action={<span className="text-[11px] text-muted-foreground">{live.length} new</span>}>
            {live.length === 0 ? <p className="text-xs text-muted-foreground">No new overlaps beyond the alerts above.</p>
              : <OverlapMatches matches={live} cases={s.cases} institutions={s.institutions} limit={4} action={(m) => p.act ? <Btn className="h-6 px-2" onClick={() => s.raiseAlert(c.id, m)}>Raise alert</Btn> : null} />}
          </Panel>
          <Panel title="Internal remarks">{p.remarks ? <p className="text-xs">{c.remarks}</p> : <p className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="size-3" />Restricted for your role.</p>}</Panel>
          <Panel title="Supporting documents"><ul className="space-y-1">{c.docs.map((d, i) => <li key={i} className="flex items-center gap-1.5 text-xs"><FileText className="size-3.5 text-muted-foreground" />{d}</li>)}</ul></Panel>
        </div>
      </div>
      {mode && <CaseActionDialog key={mode} c={c} mode={mode} onClose={() => setMode(null)} />}
    </>
  );
}
