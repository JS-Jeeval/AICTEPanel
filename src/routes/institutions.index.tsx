import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { REGION_NAMES } from "@/lib/data";
import { Empty, PageHeader, Pill, Sel } from "@/components/common";

export const Route = createFileRoute("/institutions/")({
  head: () => ({ meta: [{ title: "Institutions — AICTE ICMS" }, { name: "description", content: "Institution-wise consolidated complaint histories." }, { property: "og:title", content: "Institutions — AICTE ICMS" }, { property: "og:description", content: "Institution-wise consolidated complaint histories." }] }),
  component: Institutions,
});

function Institutions() {
  const s = useStore();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const list = s.institutions.filter((i) => (!q || i.name.toLowerCase().includes(q.toLowerCase()) || i.permId.includes(q)) && (!region || i.region === region));
  return (
    <>
      <PageHeader title="Institutions" sub={`${list.length} institutions`}><input className="field w-64" placeholder="Name or Permanent ID" value={q} onChange={(e) => setQ(e.target.value)} /><Sel label="All regions" value={region} onChange={setRegion} options={REGION_NAMES} /></PageHeader>
      <div className="panel overflow-x-auto">
        <table className="w-full text-xs"><thead className="border-b bg-muted/60 text-left text-muted-foreground"><tr>{["Institution", "Permanent ID", "Type", "State / Region", "Cases", "Active", "Bureaus", "Open alerts"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y">{list.map((i) => { const cs = s.cases.filter((c) => c.instId === i.id); const ids = new Set(cs.map((c) => c.id)); const al = s.alerts.filter((a) => ids.has(a.caseA) && ["Open", "Under Review", "Coordination Required"].includes(a.review)).length; return (
            <tr key={i.id} className="hover:bg-muted/50"><td className="px-2 py-2"><Link to="/institutions/$id" params={{ id: i.id }} className="font-medium text-primary">{i.name}</Link></td><td className="px-2 font-mono">{i.permId} {i.verified && <BadgeCheck className="inline size-3 text-success" />}</td><td className="px-2">{i.type}</td><td className="px-2">{i.state} · {i.region}</td><td className="px-2 tabular-nums">{cs.length}</td><td className="px-2 tabular-nums">{cs.filter((c) => c.status !== "Disposed").length}</td><td className="px-2">{[...new Set(cs.map((c) => c.currentBureau))].join(", ")}</td><td className="px-2">{al > 0 ? <Pill t="violet">{al}</Pill> : "—"}</td></tr>); })}</tbody></table>
        {!list.length && <Empty />}
      </div>
    </>
  );
}
