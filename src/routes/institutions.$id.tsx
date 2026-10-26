import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore, userName } from "@/lib/store";
import { BUREAUS, fmtDate, fmtDateTime, slug } from "@/lib/data";
import { Btn, Empty, KV, Panel, Pill, PriorityBadge, StatusBadge, Urgency } from "@/components/common";
import { buildInstitutionDossier, institutionFilename } from "@/lib/dossiers";
import { downloadPdf } from "@/lib/pdf";

export const Route = createFileRoute("/institutions/$id")({
  head: () => ({ meta: [{ title: "Institution Profile — AICTE ICMS" }, { name: "description", content: "Institution 360° complaint profile." }, { property: "og:title", content: "Institution Profile — AICTE ICMS" }, { property: "og:description", content: "Institution 360° complaint profile." }] }),
  component: InstitutionDetail,
});

function InstitutionDetail() {
  const { id } = Route.useParams();
  const s = useStore();
  const i = s.institutions.find((x) => x.id === id);
  if (!i) return <Empty text="Institution not found." />;
  const cases = s.cases.filter((c) => c.instId === i.id);
  const ids = new Set(cases.map((c) => c.id));
  const alerts = s.alerts.filter((a) => ids.has(a.caseA));
  const open = alerts.filter((a) => ["Open", "Under Review", "Coordination Required"].includes(a.review));
  const bureaus = BUREAUS.map((b) => ({ name: b.id, Active: cases.filter((c) => c.currentBureau === b.id && c.status !== "Disposed").length, Disposed: cases.filter((c) => c.currentBureau === b.id && c.status === "Disposed").length })).filter((b) => b.Active + b.Disposed);
  const events = cases.flatMap((c) => c.events.map((e) => ({ ...e, caseId: c.id }))).sort((a, b) => b.ts.localeCompare(a.ts));
  const exportDossier = () => {
    try {
      downloadPdf(buildInstitutionDossier({ inst: i, cases, alerts: s.alerts, users: s.users }), institutionFilename(i));
      s.logExport("Institution", i.id, "Institution 360 dossier (PDF)");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not generate the PDF"); }
  };
  const CaseRows = ({ list }: { list: typeof cases }) => (
    <table className="w-full text-xs"><tbody className="divide-y">{list.map((c) => <tr key={c.id} className="hover:bg-muted/50"><td className="py-2"><Link to="/cases/$id" params={{ id: slug(c.id) }} className="font-mono text-primary">{c.id}</Link></td><td>{c.category}</td><td>{c.currentBureau}</td><td>{userName(s.users, c.officerId)}</td><td>{fmtDate(c.received)}</td><td><StatusBadge s={c.status} /></td><td><PriorityBadge p={c.priority} /></td><td><Urgency c={c} /></td></tr>)}</tbody></table>
  );
  return (
    <>
      <div className="panel mb-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><h1 className="text-lg font-semibold">{i.name}</h1><Btn onClick={exportDossier}><Download className="size-3.5" />360° dossier (PDF)</Btn></div>
        <div className="text-xs text-muted-foreground"><span className="font-mono">{i.permId}</span> · {i.type} · {i.address}, {i.district}, {i.state} · {i.region} Region</div>
        <div className="mt-1">{i.verified ? <Pill t="green"><BadgeCheck className="size-3" />Verified Permanent ID</Pill> : <Pill t="amber">Verification pending</Pill>}</div>
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 md:grid-cols-4"><KV k="Associated complaints" v={cases.length} /><KV k="Active cases" v={cases.filter((c) => c.status !== "Disposed").length} /><KV k="Bureaus involved" v={new Set(cases.flatMap((c) => [c.currentBureau, c.receivingBureau])).size} /><KV k="Unresolved overlap alerts" v={open.length} /></dl>
        <p className="mt-2 text-[11px] text-muted-foreground">Complaints about the same institution remain separate records unless an authorised official links them.</p>
      </div>
      <Tabs defaultValue="overview">
        <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="cases">All Cases</TabsTrigger><TabsTrigger value="bureaus">Bureau Involvement</TabsTrigger><TabsTrigger value="history">Action History</TabsTrigger><TabsTrigger value="docs">Documents</TabsTrigger></TabsList>
        <TabsContent value="overview" className="grid gap-3 lg:grid-cols-2">
          <Panel title="Active cases"><CaseRows list={cases.filter((c) => c.status !== "Disposed")} /></Panel>
          <Panel title="Open coordination issues">{open.length ? open.map((a) => <Link key={a.id} to="/overlaps" search={{ id: a.id }} className="block py-1 text-xs text-primary">{a.id} · {a.caseA} ↔ {a.caseB} · {a.review}</Link>) : <p className="text-xs text-muted-foreground">None.</p>}</Panel>
          <Panel title="Recent activity" className="lg:col-span-2"><ol className="space-y-1.5">{events.slice(0, 8).map((e) => <li key={e.id} className="text-xs"><span className="text-muted-foreground">{fmtDateTime(e.ts)}</span> · <span className="font-mono">{e.caseId}</span> · {e.action}</li>)}</ol></Panel>
        </TabsContent>
        <TabsContent value="cases"><Panel><CaseRows list={cases} /></Panel></TabsContent>
        <TabsContent value="bureaus"><Panel title="Bureau-wise cases"><ResponsiveContainer height={220}><BarChart data={bureaus}><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="Active" stackId="a" fill="var(--chart-1)" /><Bar dataKey="Disposed" stackId="a" fill="var(--chart-2)" /></BarChart></ResponsiveContainer></Panel></TabsContent>
        <TabsContent value="history"><Panel><ol className="space-y-2">{events.map((e) => <li key={e.id} className="text-xs"><span className="text-muted-foreground">{fmtDateTime(e.ts)}</span> · <Link to="/cases/$id" params={{ id: slug(e.caseId) }} className="font-mono text-primary">{e.caseId}</Link> · {e.action} — {userName(s.users, e.officerId)} ({e.bureau})</li>)}</ol></Panel></TabsContent>
        <TabsContent value="docs"><Panel><ul className="space-y-1">{cases.flatMap((c) => c.docs.map((d, k) => <li key={c.id + k} className="flex items-center gap-1.5 text-xs"><FileText className="size-3.5 text-muted-foreground" />{d} <span className="font-mono text-muted-foreground">{c.id}</span></li>))}</ul></Panel></TabsContent>
      </Tabs>
    </>
  );
}
