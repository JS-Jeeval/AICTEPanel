import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Clock, FileText, GitCompare, Loader } from "lucide-react";
import { useStore, userName } from "@/lib/store";
import { BUREAUS, TODAY, addDays, daysBetween, fmtDateTime, isNearDue, isOverdue, slug, STATUSES } from "@/lib/data";
import { COLORS, ax, useMonthly, ageing } from "@/lib/charts";
import { Metric, PageHeader, Panel, Sel, Pill } from "@/components/common";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Executive Overview — AICTE ICMS" }, { name: "description", content: "Current complaint case situation across AICTE bureaus." }, { property: "og:title", content: "Executive Overview — AICTE ICMS" }, { property: "og:description", content: "Current complaint case situation across AICTE bureaus." }] }),
  component: Overview,
});
function Overview() {
  const s = useStore();
  const [range, setRange] = useState("");
  const [bureau, setBureau] = useState("");
  const cases = s.cases.filter((c) => (!bureau || c.currentBureau === bureau || c.receivingBureau === bureau) && (!range || c.received >= addDays(TODAY, -Number(range))));
  const ids = new Set(cases.map((c) => c.id));
  const alerts = s.alerts.filter((a) => (ids.has(a.caseA) || ids.has(a.caseB)));
  const openAlerts = alerts.filter((a) => ["Open", "Under Review", "Coordination Required"].includes(a.review));
  const cnt = (st: string) => cases.filter((c) => c.status === st).length;
  const overdue = cases.filter(isOverdue);
  const monthly = useMonthly(cases);
  const dist = STATUSES.map((st) => ({ name: st, value: cnt(st) }));
  const workload = BUREAUS.map((b) => ({ name: b.id, Active: cases.filter((c) => c.currentBureau === b.id && c.status !== "Disposed").length }));
  const pairs = Object.entries(alerts.reduce<Record<string, number>>((acc, a) => { const A = s.cases.find((c) => c.id === a.caseA)!, B = s.cases.find((c) => c.id === a.caseB)!; const k = [A.currentBureau, B.currentBureau].sort().join(" ↔ "); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})).map(([name, v]) => ({ name, v }));
  const recent = cases.flatMap((c) => c.events.map((e) => ({ ...e, caseId: c.id }))).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 8);
  const priority = [
    ...overdue.slice(0, 4).map((c) => ({ c, tag: <Pill t="red">Overdue {daysBetween(c.due)}d</Pill> })),
    ...cases.filter(isNearDue).slice(0, 3).map((c) => ({ c, tag: <Pill t="amber">Due soon</Pill> })),
    ...cases.filter((c) => c.awaitingCoordination && c.status !== "Disposed").slice(0, 2).map((c) => ({ c, tag: <Pill t="violet">Awaiting coordination</Pill> })),
    ...cases.filter((c) => !c.officerId && c.status !== "Disposed").slice(0, 3).map((c) => ({ c, tag: <Pill>No officer</Pill> })),
  ];

  return (
    <>
      <PageHeader title="Executive Overview" sub={`Status as of ${TODAY.toLocaleDateString("en-IN", { dateStyle: "long" })}`}>
        <Sel label="All bureaus" value={bureau} onChange={setBureau} options={BUREAUS.map((b) => b.id)} />
        <Sel label="All time" value={range} onChange={setRange} options={[["30", "Last 30 days"], ["90", "Last 90 days"], ["180", "Last 180 days"]]} />
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <Metric label="Total Received" value={cases.length} icon={FileText} to="/cases" search={{ bureau: bureau || undefined }} />
        <Metric label="Pending" value={cnt("Pending")} icon={Clock} t="amber" to="/cases" search={{ status: "Pending" }} />
        <Metric label="Under Process" value={cnt("Under Process")} icon={Loader} to="/cases" search={{ status: "Under Process" }} />
        <Metric label="Disposed" value={cnt("Disposed")} icon={CheckCircle2} t="green" to="/cases" search={{ status: "Disposed" }} hint={`${cases.length ? Math.round((cnt("Disposed") / cases.length) * 100) : 0}% disposal rate`} />
        <Metric label="Transferred" value={cnt("Transferred")} icon={ArrowLeftRight} t="violet" to="/cases" search={{ status: "Transferred" }} />
        <Metric label="Overdue" value={overdue.length} icon={AlertTriangle} t="red" to="/cases" search={{ overdue: true }} />
        <Metric label="Open Overlap Alerts" value={openAlerts.length} icon={GitCompare} t="violet" to="/overlaps" />
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Panel title="Complaints received vs disposed (monthly)" className="xl:col-span-2">
          <ResponsiveContainer height={220}><LineChart data={monthly}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="month" tick={ax} /><YAxis tick={ax} allowDecimals={false} width={28} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Line dataKey="Received" stroke="var(--chart-1)" strokeWidth={2} /><Line dataKey="Disposed" stroke="var(--chart-2)" strokeWidth={2} /></LineChart></ResponsiveContainer>
        </Panel>
        <Panel title="Requires attention">
          <ul className="max-h-[220px] divide-y overflow-auto">
            {priority.map(({ c, tag }, i) => <li key={c.id + i}><Link to="/cases/$id" params={{ id: slug(c.id) }} className="flex items-center justify-between gap-2 py-1.5 text-xs hover:text-primary"><span className="font-mono">{c.id}</span>{tag}</Link></li>)}
            {openAlerts.slice(0, 3).map((a) => <li key={a.id}><Link to="/overlaps" search={{ id: a.id }} className="flex items-center justify-between py-1.5 text-xs hover:text-primary"><span className="font-mono">{a.id}</span><Pill t="violet">Unresolved overlap</Pill></Link></li>)}
          </ul>
        </Panel>
        <Panel title="Case distribution by status">
          <ResponsiveContainer height={200}><PieChart><Pie data={dist} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>{dist.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer>
        </Panel>
        <Panel title="Active workload by bureau">
          <ResponsiveContainer height={200}><BarChart data={workload} layout="vertical"><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" tick={ax} allowDecimals={false} /><YAxis type="category" dataKey="name" tick={ax} width={40} /><Tooltip /><Bar dataKey="Active" fill="var(--chart-1)" radius={2} /></BarChart></ResponsiveContainer>
        </Panel>
        <Panel title="Pending-case ageing">
          <ResponsiveContainer height={200}><BarChart data={ageing(cases)}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="name" tick={ax} /><YAxis tick={ax} allowDecimals={false} width={28} /><Tooltip /><Bar dataKey="v" name="Active cases" radius={2}>{ageing(cases).map((_, i) => <Cell key={i} fill={["var(--chart-2)", "var(--chart-1)", "var(--chart-3)", "var(--chart-4)"][i]} />)}</Bar></BarChart></ResponsiveContainer>
        </Panel>
        <Panel title="Overlap alerts by bureau pair">
          <ResponsiveContainer height={200}><BarChart data={pairs}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="name" tick={ax} /><YAxis tick={ax} allowDecimals={false} width={28} /><Tooltip /><Bar dataKey="v" name="Alerts" fill="var(--chart-5)" radius={2} /></BarChart></ResponsiveContainer>
        </Panel>
        <Panel title="Recent case activity" className="xl:col-span-2">
          <ol className="space-y-2">{recent.map((e) => <li key={e.id} className="flex gap-3 text-xs"><span className="w-36 shrink-0 text-muted-foreground">{fmtDateTime(e.ts)}</span><Link to="/cases/$id" params={{ id: slug(e.caseId) }} className="w-40 shrink-0 font-mono text-primary">{e.caseId}</Link><span>{e.action} <span className="text-muted-foreground">— {userName(s.users, e.officerId)} ({e.bureau})</span></span></li>)}</ol>
        </Panel>
      </div>
    </>
  );
}
