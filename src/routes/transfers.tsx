import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore, userName, can } from "@/lib/store";
import { fmtDate, isOverdue, slug, type Transfer } from "@/lib/data";
import { Btn, Empty, PageHeader, Pill, StatusBadge } from "@/components/common";

export const Route = createFileRoute("/transfers")({
  head: () => ({ meta: [{ title: "Transfers & Escalations — AICTE ICMS" }, { name: "description", content: "Transfer and escalation queues between AICTE bureaus." }, { property: "og:title", content: "Transfers & Escalations" }, { property: "og:description", content: "Transfer and escalation queues between AICTE bureaus." }] }),
  component: Transfers,
});

function Transfers() {
  const s = useStore();
  const p = can(s.user);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const decide = (t: Transfer, ok: boolean) => { const r = (reason[t.id] ?? "").trim(); if (r.length < 5) { setErr(t.id); return; } setErr(""); s.decideTransfer(t.id, ok, r); };
  const Table = ({ list, decision }: { list: Transfer[]; decision?: boolean }) => !list.length ? <Empty text="Queue is empty." /> : (
    <table className="w-full text-xs"><thead className="border-b text-left text-muted-foreground"><tr>{["Ref", "Case", "Type", "From → To", "Current officer", "Reason", "Initiated", "Status", ...(decision ? ["Decision"] : [])].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead>
      <tbody className="divide-y">{list.map((t) => { const c = s.cases.find((x) => x.id === t.caseId)!; return (
        <tr key={t.id} className="align-top"><td className="px-2 py-2 font-mono">{t.id}</td><td className="px-2"><Link to="/cases/$id" params={{ id: slug(c.id) }} className="font-mono text-primary">{c.id}</Link><div><StatusBadge s={c.status} /></div></td><td className="px-2">{t.kind}</td><td className="whitespace-nowrap px-2">{t.from} → {t.to}</td><td className="px-2">{userName(s.users, c.officerId)}</td><td className="max-w-56 px-2">{t.reason}{t.decisionReason && <div className="text-muted-foreground">Decision: {t.decisionReason} ({fmtDate(t.decidedAt)})</div>}</td><td className="whitespace-nowrap px-2">{fmtDate(t.initiated)}</td>
          <td className="px-2"><Pill t={t.status === "Accepted" ? "green" : t.status === "Rejected" ? "red" : "amber"}>{t.status}</Pill></td>
          {decision && <td className="px-2">{p.decide ? <div className="w-56 space-y-1"><input className="field h-7 w-full" placeholder="Reason (required)" value={reason[t.id] ?? ""} onChange={(e) => setReason({ ...reason, [t.id]: e.target.value })} />{err === t.id && <p className="text-destructive">Reason required.</p>}<div className="flex gap-1"><Btn v="primary" className="h-7" onClick={() => decide(t, true)}>Accept</Btn><Btn className="h-7" onClick={() => decide(t, false)}>Reject</Btn></div></div> : <span className="text-muted-foreground">Bureau Head required</span>}</td>}
        </tr>); })}</tbody></table>
  );
  const pending = s.transfers.filter((t) => t.status === "Pending Acceptance");
  const senior = s.transfers.filter((t) => t.status === "Senior Review");
  const overdue = s.cases.filter((c) => isOverdue(c) && ["Transferred", "Escalated"].includes(c.status));
  return (
    <>
      <PageHeader title="Transfers & Escalations" sub="Previous assignments are retained in each case's history." />
      <Tabs defaultValue="pending">
        <TabsList><TabsTrigger value="pending">Awaiting acceptance ({pending.length})</TabsTrigger><TabsTrigger value="senior">Awaiting senior review ({senior.length})</TabsTrigger><TabsTrigger value="escalated">Escalated</TabsTrigger><TabsTrigger value="recent">Transfer history</TabsTrigger><TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger></TabsList>
        <div className="panel mt-2 overflow-x-auto">
          <TabsContent value="pending" className="m-0"><Table list={pending} decision /></TabsContent>
          <TabsContent value="senior" className="m-0"><Table list={senior} decision /></TabsContent>
          <TabsContent value="escalated" className="m-0"><Table list={s.transfers.filter((t) => t.kind === "Escalation")} /></TabsContent>
          <TabsContent value="recent" className="m-0"><Table list={[...s.transfers].filter((t) => t.kind === "Transfer").sort((a, b) => b.initiated.localeCompare(a.initiated))} /></TabsContent>
          <TabsContent value="overdue" className="m-0">{overdue.length ? <table className="w-full text-xs"><tbody className="divide-y">{overdue.map((c) => <tr key={c.id}><td className="px-2 py-2"><Link to="/cases/$id" params={{ id: slug(c.id) }} className="font-mono text-primary">{c.id}</Link></td><td><StatusBadge s={c.status} /></td><td>{c.currentBureau}</td><td>Due {fmtDate(c.due)}</td></tr>)}</tbody></table> : <Empty />}</TabsContent>
        </div>
      </Tabs>
    </>
  );
}
