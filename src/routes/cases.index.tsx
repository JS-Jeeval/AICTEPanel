import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowUpDown, Download, Plus, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStore, userName, can } from "@/lib/store";
import { BUREAUS, CATEGORIES, REGION_NAMES, STATUSES, fmtDate, isOverdue, slug, toCSV, type Case } from "@/lib/data";
import { Btn, Empty, KV, OverlapFlag, PageHeader, PriorityBadge, Sel, StatusBadge, Urgency } from "@/components/common";
import { NewCaseDialog } from "@/components/new-case-dialog";

type S = { status?: string; bureau?: string; overdue?: boolean; q?: string };
export const Route = createFileRoute("/cases/")({
  validateSearch: (s: Record<string, unknown>): S => ({ status: s.status as string | undefined, bureau: s.bureau as string | undefined, overdue: s.overdue === true || s.overdue === "true" ? true : undefined, q: s.q as string | undefined }),
  head: () => ({ meta: [{ title: "All Cases — AICTE ICMS" }, { name: "description", content: "Registry of complaint cases across AICTE bureaus." }, { property: "og:title", content: "All Cases — AICTE ICMS" }, { property: "og:description", content: "Registry of complaint cases across AICTE bureaus." }] }),
  component: Cases,
});

function Cases() {
  const s = useStore();
  const init = Route.useSearch();
  const nav = useNavigate();
  const [f, setF] = useState({ q: init.q ?? "", bureau: init.bureau ?? "", status: init.status ?? "", region: "", category: "", priority: "", from: "", to: "", overdue: !!init.overdue });
  const [sort, setSort] = useState<{ k: keyof Case | "inst"; d: 1 | -1 }>({ k: "received", d: -1 });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  const [peek, setPeek] = useState<Case | null>(null);
  const [creating, setCreating] = useState(false);
  const inst = (id: string) => s.institutions.find((i) => i.id === id)!;
  const overlapIds = new Set(s.alerts.filter((a) => a.review !== "Dismissed").flatMap((a) => [a.caseA, a.caseB]));
  const rows = useMemo(() => {
    const q = f.q.toLowerCase();
    return s.cases.filter((c) => {
      const i = inst(c.instId);
      return (!q || c.id.toLowerCase().includes(q) || i.name.toLowerCase().includes(q) || i.permId.includes(q)) && (!f.bureau || c.currentBureau === f.bureau || c.receivingBureau === f.bureau) && (!f.status || c.status === f.status) && (!f.region || i.region === f.region) && (!f.category || c.category === f.category) && (!f.priority || c.priority === f.priority) && (!f.from || c.received >= f.from) && (!f.to || c.received <= f.to + "T23") && (!f.overdue || isOverdue(c));
    }).sort((a, b) => { const va = sort.k === "inst" ? inst(a.instId).name : String(a[sort.k]); const vb = sort.k === "inst" ? inst(b.instId).name : String(b[sort.k]); return va.localeCompare(vb) * sort.d; });
  }, [s.cases, f, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const view = rows.slice(page * size, page * size + size);
  const upd = (k: keyof typeof f) => (v: string) => { setF({ ...f, [k]: v }); setPage(0); };
  const chips = (Object.entries(f) as [keyof typeof f, string | boolean][]).filter(([, v]) => v);
  const H = ({ k, children }: { k: keyof Case | "inst"; children: string }) => <th className="whitespace-nowrap px-2 py-2 text-left font-medium"><button className="inline-flex items-center gap-1" onClick={() => setSort({ k, d: sort.k === k ? (-sort.d as 1 | -1) : 1 })}>{children}<ArrowUpDown className="size-3 opacity-50" /></button></th>;

  return (
    <>
      <PageHeader title="All Cases Registry" sub={`${rows.length} of ${s.cases.length} cases`}>
        {can(s.user).act && <Btn v="primary" onClick={() => setCreating(true)}><Plus className="size-3.5" />Register case</Btn>}
        <Btn onClick={() => toCSV(rows.map((c) => ({ CaseID: c.id, Institution: inst(c.instId).name, PermanentID: inst(c.instId).permId, Category: c.category, ReceivingBureau: c.receivingBureau, CurrentBureau: c.currentBureau, Officer: userName(s.users, c.officerId), Received: fmtDate(c.received), LastAction: c.lastAction, ExpectedDisposal: fmtDate(c.due), Status: c.status, Priority: c.priority, Overdue: isOverdue(c) ? "Yes" : "No" })), "aicte-cases")}><Download className="size-3.5" />Export CSV</Btn>
      </PageHeader>
      <div className="panel mb-3 flex flex-wrap gap-2 p-2">
        <input className="field w-64" placeholder="Case ID, institution or Permanent ID" value={f.q} onChange={(e) => upd("q")(e.target.value)} />
        <Sel label="Bureau" value={f.bureau} onChange={upd("bureau")} options={BUREAUS.map((b) => b.id)} />
        <Sel label="Status" value={f.status} onChange={upd("status")} options={STATUSES} />
        <Sel label="Region" value={f.region} onChange={upd("region")} options={REGION_NAMES} />
        <Sel label="Category" value={f.category} onChange={upd("category")} options={CATEGORIES} />
        <Sel label="Priority" value={f.priority} onChange={upd("priority")} options={["High", "Medium", "Low"]} />
        <input type="date" aria-label="From" className="field" value={f.from} onChange={(e) => upd("from")(e.target.value)} />
        <input type="date" aria-label="To" className="field" value={f.to} onChange={(e) => upd("to")(e.target.value)} />
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.overdue} onChange={(e) => setF({ ...f, overdue: e.target.checked })} />Overdue only</label>
      </div>
      {chips.length > 0 && <div className="mb-2 flex flex-wrap items-center gap-1.5">{chips.map(([k, v]) => <button key={k} onClick={() => setF({ ...f, [k]: k === "overdue" ? false : "" })} className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-[11px]">{k}: {String(v)}<X className="size-3" /></button>)}<button className="text-[11px] text-primary" onClick={() => { setF({ q: "", bureau: "", status: "", region: "", category: "", priority: "", from: "", to: "", overdue: false }); nav({ to: "/cases", search: {} }); }}>Clear all</button></div>}
      <div className="panel overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b bg-muted/60 text-muted-foreground"><tr><H k="id">Case ID</H><H k="inst">Institution</H><th className="px-2 text-left font-medium">Perm. ID</th><H k="category">Category</H><th className="px-2 text-left font-medium">Recv.</th><H k="currentBureau">Current</H><th className="px-2 text-left font-medium">Officer</th><H k="received">Received</H><th className="px-2 text-left font-medium">Last Action</th><H k="due">Exp. Disposal</H><H k="status">Status</H><H k="priority">Priority</H><th className="px-2 text-left font-medium">Flags</th><th /></tr></thead>
          <tbody className="divide-y">
            {view.map((c) => { const i = inst(c.instId); return (
              <tr key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => nav({ to: "/cases/$id", params: { id: slug(c.id) } })}>
                <td className="whitespace-nowrap px-2 py-2 font-mono text-primary">{c.id}</td><td className="max-w-52 truncate px-2" title={i.name}>{i.name}</td><td className="whitespace-nowrap px-2 font-mono">{i.permId}</td><td className="whitespace-nowrap px-2">{c.category}</td><td className="px-2">{c.receivingBureau}</td><td className="px-2">{c.currentBureau}</td><td className="whitespace-nowrap px-2">{userName(s.users, c.officerId)}</td><td className="whitespace-nowrap px-2">{fmtDate(c.received)}</td><td className="max-w-40 truncate px-2">{c.lastAction}</td><td className="whitespace-nowrap px-2">{fmtDate(c.due)}</td><td className="px-2"><StatusBadge s={c.status} /></td><td className="px-2"><PriorityBadge p={c.priority} /></td>
                <td className="px-2"><div className="flex gap-1"><Urgency c={c} />{overlapIds.has(c.id) && <OverlapFlag />}</div></td>
                <td className="px-2"><button className="text-primary hover:underline" onClick={(e) => { e.stopPropagation(); setPeek(c); }}>Quick view</button></td>
              </tr>); })}
          </tbody>
        </table>
        {!view.length && <Empty />}
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs">
          <span>Rows <select className="field h-7" value={size} onChange={(e) => { setSize(+e.target.value); setPage(0); }}>{[10, 15, 25, 50].map((n) => <option key={n}>{n}</option>)}</select></span>
          <span className="flex items-center gap-2">Page {page + 1} of {pages}<Btn disabled={!page} onClick={() => setPage(page - 1)}>Prev</Btn><Btn disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Btn></span>
        </div>
      </div>
      {creating && <NewCaseDialog open onClose={() => setCreating(false)} />}
      <Sheet open={!!peek} onOpenChange={(o) => !o && setPeek(null)}>
        <SheetContent className="w-[420px] overflow-auto">
          {peek && <><SheetHeader><SheetTitle className="font-mono text-sm">{peek.id}</SheetTitle></SheetHeader>
            <div className="mt-3 space-y-3 px-4 text-xs"><div className="flex gap-1"><StatusBadge s={peek.status} /><PriorityBadge p={peek.priority} /><Urgency c={peek} /></div>
              <p>{peek.summary}</p>
              <dl className="grid grid-cols-2 gap-2"><KV k="Institution" v={inst(peek.instId).name} /><KV k="Category" v={peek.category} /><KV k="Current bureau" v={peek.currentBureau} /><KV k="Officer" v={userName(s.users, peek.officerId)} /><KV k="Last action" v={peek.lastAction} /><KV k="Next action" v={peek.nextAction} /><KV k="Expected disposal" v={fmtDate(peek.due)} /></dl>
              <Btn v="primary" onClick={() => nav({ to: "/cases/$id", params: { id: slug(peek.id) } })}>Open case workspace</Btn></div></>}
        </SheetContent>
      </Sheet>
    </>
  );
}
