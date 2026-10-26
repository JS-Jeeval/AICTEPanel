import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, userName } from "@/lib/store";
import { BUREAUS, fmtDateTime } from "@/lib/data";
import { Btn, Empty, PageHeader, Pill, Sel } from "@/components/common";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Audit Logs — AICTE ICMS" }, { name: "description", content: "Read-only audit trail of system actions." }, { property: "og:title", content: "Audit Logs — AICTE ICMS" }, { property: "og:description", content: "Read-only audit trail of system actions." }] }),
  component: AuditPage,
});

function AuditPage() {
  const s = useStore();
  const [f, setF] = useState({ q: "", user: "", bureau: "", entity: "", from: "", to: "" });
  const [page, setPage] = useState(0);
  const u = (id: string) => s.users.find((x) => x.id === id);
  const rows = s.audit.filter((a) => (!f.q || (a.action + a.entityId + a.summary).toLowerCase().includes(f.q.toLowerCase())) && (!f.user || a.userId === f.user) && (!f.bureau || u(a.userId)?.bureau === f.bureau) && (!f.entity || a.entityType === f.entity) && (!f.from || a.ts >= f.from) && (!f.to || a.ts <= f.to + "T23"));
  const view = rows.slice(page * 25, page * 25 + 25);
  const set = (k: keyof typeof f) => (v: string) => { setF({ ...f, [k]: v }); setPage(0); };
  return (
    <>
      <PageHeader title="Audit Logs" sub={`${rows.length} entries · read-only, append-only in production`} />
      <div className="panel mb-3 flex flex-wrap gap-2 p-2">
        <input className="field w-56" placeholder="Search action, entity, summary" value={f.q} onChange={(e) => set("q")(e.target.value)} />
        <Sel label="User" value={f.user} onChange={set("user")} options={s.users.map((x) => [x.id, x.name])} />
        <Sel label="Bureau" value={f.bureau} onChange={set("bureau")} options={BUREAUS.map((b) => b.id)} />
        <Sel label="Entity type" value={f.entity} onChange={set("entity")} options={["Case", "Alert", "Transfer", "User", "Session", "Institution"]} />
        <input type="date" aria-label="From" className="field" value={f.from} onChange={(e) => set("from")(e.target.value)} />
        <input type="date" aria-label="To" className="field" value={f.to} onChange={(e) => set("to")(e.target.value)} />
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-xs"><thead className="border-b bg-muted/60 text-left text-muted-foreground"><tr>{["Timestamp", "User", "Role", "Bureau", "Action", "Entity", "Entity ID", "Summary", "Result"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y">{view.map((a) => <tr key={a.id}><td className="whitespace-nowrap px-2 py-1.5">{fmtDateTime(a.ts)}</td><td className="px-2">{userName(s.users, a.userId)}</td><td className="px-2">{u(a.userId)?.role}</td><td className="px-2">{u(a.userId)?.bureau}</td><td className="px-2">{a.action}</td><td className="px-2">{a.entityType}</td><td className="px-2 font-mono">{a.entityId}</td><td className="max-w-64 truncate px-2" title={a.summary}>{a.summary}</td><td className="px-2"><Pill t="green">{a.result}</Pill></td></tr>)}</tbody></table>
        {!view.length && <Empty />}
        <div className="flex justify-end gap-2 border-t p-2 text-xs"><span className="self-center">Page {page + 1} of {Math.max(1, Math.ceil(rows.length / 25))}</span><Btn disabled={!page} onClick={() => setPage(page - 1)}>Prev</Btn><Btn disabled={(page + 1) * 25 >= rows.length} onClick={() => setPage(page + 1)}>Next</Btn></div>
      </div>
    </>
  );
}
