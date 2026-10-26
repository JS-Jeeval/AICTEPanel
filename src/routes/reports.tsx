import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { useStore, can } from "@/lib/store";
import { BUREAUS, REGION_NAMES, STATUSES, TODAY, addDays, toCSV } from "@/lib/data";
import { ax, ageing, useMonthly } from "@/lib/charts";
import { Btn, Empty, PageHeader, Panel, Sel } from "@/components/common";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports & Analytics — AICTE ICMS" }, { name: "description", content: "Bureau, region, status and ageing reports." }, { property: "og:title", content: "Reports & Analytics — AICTE ICMS" }, { property: "og:description", content: "Bureau, region, status and ageing reports." }] }),
  component: Reports,
});

function Reports() {
  const s = useStore();
  const [f, setF] = useState({ range: "", bureau: "", region: "" });
  const inst = (id: string) => s.institutions.find((i) => i.id === id)!;
  const cases = s.cases.filter((c) => (!f.bureau || c.currentBureau === f.bureau) && (!f.region || inst(c.instId).region === f.region) && (!f.range || c.received >= addDays(TODAY, -Number(f.range))));
  const monthly = useMonthly(cases).map((m) => ({ ...m, "Disposal rate %": m.Received ? Math.round((m.Disposed / m.Received) * 100) : 0 }));
  const bureau = BUREAUS.map((b) => { const l = cases.filter((c) => c.currentBureau === b.id); return { name: b.id, Active: l.filter((c) => c.status !== "Disposed").length, Disposed: l.filter((c) => c.status === "Disposed").length }; });
  const region = REGION_NAMES.map((r) => ({ name: r, Cases: cases.filter((c) => inst(c.instId).region === r).length }));
  const status = STATUSES.map((st) => ({ name: st, Cases: cases.filter((c) => c.status === st).length }));
  const ids = new Set(cases.map((c) => c.id));
  const overlapByBureau = BUREAUS.map((b) => ({ name: b.id, Alerts: s.alerts.filter((a) => ids.has(a.caseA) && [a.caseA, a.caseB].some((x) => s.cases.find((c) => c.id === x)!.currentBureau === b.id)).length }));
  const officers = s.users.map((u) => ({ name: u.name, Active: cases.filter((c) => c.officerId === u.id && c.status !== "Disposed").length })).filter((o) => o.Active).sort((a, b) => b.Active - a.Active).slice(0, 10);
  const instHistory = s.institutions.map((i) => { const l = cases.filter((c) => c.instId === i.id); return { Institution: i.name, PermanentID: i.permId, Total: l.length, Active: l.filter((c) => c.status !== "Disposed").length, Disposed: l.filter((c) => c.status === "Disposed").length }; }).filter((r) => r.Total).sort((a, b) => b.Total - a.Total);
  const coord = cases.filter((c) => c.awaitingCoordination && c.status !== "Disposed").length;
  const chart = (data: object[], keys: string[], layout?: "vertical") => !data.length ? <Empty /> : (
    <ResponsiveContainer height={210}><BarChart data={data} layout={layout}><CartesianGrid stroke="var(--border)" /><XAxis {...(layout ? { type: "number" as const } : { dataKey: "name" })} tick={ax} allowDecimals={false} /><YAxis {...(layout ? { type: "category" as const, dataKey: "name", width: 100 } : { width: 28 })} tick={ax} allowDecimals={false} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />{keys.map((k, i) => <Bar key={k} dataKey={k} stackId="a" fill={`var(--chart-${i + 1})`} />)}</BarChart></ResponsiveContainer>
  );
  return (
    <>
      <PageHeader title="Reports & Analytics" sub={`${cases.length} cases in scope · ${coord} unresolved coordination cases`}>
        <Sel label="All time" value={f.range} onChange={(v) => setF({ ...f, range: v })} options={[["30", "Last 30 days"], ["90", "Last 90 days"], ["180", "Last 180 days"]]} />
        <Sel label="All bureaus" value={f.bureau} onChange={(v) => setF({ ...f, bureau: v })} options={BUREAUS.map((b) => b.id)} />
        <Sel label="All regions" value={f.region} onChange={(v) => setF({ ...f, region: v })} options={REGION_NAMES} />
        <Btn onClick={() => toCSV(instHistory, "institution-history")}><Download className="size-3.5" />Institution CSV</Btn>
        <Btn onClick={() => toCSV(bureau, "bureau-workload")}><Download className="size-3.5" />Bureau CSV</Btn>
      </PageHeader>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Monthly received vs disposed, with disposal rate"><ResponsiveContainer height={210}><LineChart data={monthly}><CartesianGrid stroke="var(--border)" /><XAxis dataKey="month" tick={ax} /><YAxis tick={ax} width={28} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Line dataKey="Received" stroke="var(--chart-1)" /><Line dataKey="Disposed" stroke="var(--chart-2)" /><Line dataKey="Disposal rate %" stroke="var(--chart-3)" strokeDasharray="4 3" /></LineChart></ResponsiveContainer></Panel>
        <Panel title="Bureau-wise workload (current bureau)">{chart(bureau, ["Active", "Disposed"])}</Panel>
        <Panel title="Region-wise case distribution">{chart(region, ["Cases"], "vertical")}</Panel>
        <Panel title="Status-wise case counts">{chart(status, ["Cases"])}</Panel>
        <Panel title="Pending-case ageing (days since receipt)">{chart(ageing(cases).map((b) => ({ name: b.name, "Active cases": b.v })), ["Active cases"])}</Panel>
        <Panel title="Cross-bureau overlap frequency">{chart(overlapByBureau, ["Alerts"])}</Panel>
        {can(s.user).decide && <Panel title="Officer workload — top 10 (active cases)">{chart(officers, ["Active"], "vertical")}</Panel>}
        <Panel title="Institution-wise complaint history (top 10)"><table className="w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th className="py-1 font-medium">Institution</th><th className="font-medium">Total</th><th className="font-medium">Active</th><th className="font-medium">Disposed</th></tr></thead><tbody className="divide-y">{instHistory.slice(0, 10).map((r) => <tr key={r.PermanentID}><td className="py-1.5">{r.Institution}</td><td>{r.Total}</td><td>{r.Active}</td><td>{r.Disposed}</td></tr>)}</tbody></table>{!instHistory.length && <Empty />}</Panel>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">Definitions: Active = any status except Disposed. Disposal rate = cases disposed in month ÷ cases received in month. Ageing measured from received date to {TODAY.toLocaleDateString("en-IN")}.</p>
    </>
  );
}
