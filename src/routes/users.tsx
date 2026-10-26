import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore, can } from "@/lib/store";
import { BUREAUS, REGION_NAMES, ROLES, TODAY, fmtDateTime, req, type Role, type User } from "@/lib/data";
import { Btn, Empty, Field, PageHeader, Pill } from "@/components/common";

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "User Administration — AICTE ICMS" }, { name: "description", content: "Manage officer accounts, roles and bureaus." }, { property: "og:title", content: "User Administration — AICTE ICMS" }, { property: "og:description", content: "Manage officer accounts, roles and bureaus." }] }),
  component: Users,
});
const PERMS: Record<Role, string> = {
  "System Administrator": "Full access, user management", "PGRC Officer": "Act on assigned PGRC cases", "Regulation Bureau Officer": "Act on assigned RB cases",
  "Bureau Head": "Assign, transfer, decide alerts & transfers", "Regional Officer": "Act on regional cases; no internal remarks", "Senior Management": "Read-only, all reports", Auditor: "Read-only, audit logs; no internal remarks",
};

function Users() {
  const s = useStore();
  const [edit, setEdit] = useState<User | null>(null);
  const [confirm, setConfirm] = useState<User | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  if (!can(s.user).admin) return <Empty text="You are not authorised to view User Administration." />;
  const save = () => {
    if (!edit) return;
    const e: Record<string, string> = {};
    if (edit.name.trim().length < 3) e.name = "Enter full name";
    if (!/^\S+@\S+\.\S+$/.test(edit.email)) e.email = "Valid email required";
    if (s.users.some((u) => u.email === edit.email && u.id !== edit.id)) e.email = "Email already in use";
    setErr(e); if (Object.keys(e).length) return;
    s.saveUser(edit); setEdit(null);
  };
  const toggleStatus = () => {
    if (!confirm) return;
    s.saveUser({ ...confirm, status: confirm.status === "Active" ? "Deactivated" : "Active" });
    setConfirm(null);
  };
  const blank = (): User => ({ id: `U${String(s.users.length + 1).padStart(3, "0")}`, name: "", email: "", role: "PGRC Officer", bureau: "PGRC", region: req(REGION_NAMES[0], "default region"), status: "Active", lastLogin: TODAY.toISOString() });
  return (
    <>
      <PageHeader title="User Administration" sub="Frontend checks are not a security boundary; production requires server-side authorisation."><Btn v="primary" onClick={() => { setErr({}); setEdit(blank()); }}>Add user</Btn></PageHeader>
      <div className="panel overflow-x-auto">
        <table className="w-full text-xs"><thead className="border-b bg-muted/60 text-left text-muted-foreground"><tr>{["Name", "Role", "Bureau", "Region", "Status", "Last login", "Permissions", ""].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y">{s.users.map((u) => <tr key={u.id}><td className="px-2 py-2"><div className="font-medium">{u.name}</div><div className="text-muted-foreground">{u.email}</div></td><td className="px-2">{u.role}</td><td className="px-2">{u.bureau}</td><td className="px-2">{u.region}</td><td className="px-2"><Pill t={u.status === "Active" ? "green" : "grey"}>{u.status}</Pill></td><td className="whitespace-nowrap px-2">{fmtDateTime(u.lastLogin)}</td><td className="max-w-48 px-2 text-muted-foreground">{PERMS[u.role]}</td>
            <td className="whitespace-nowrap px-2"><Btn v="ghost" onClick={() => { setErr({}); setEdit({ ...u }); }}>Edit</Btn>{u.id !== s.user?.id && <Btn v="ghost" onClick={() => setConfirm(u)}>{u.status === "Active" ? "Deactivate" : "Reactivate"}</Btn>}</td></tr>)}</tbody></table>
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle className="text-base">{s.users.some((u) => u.id === edit?.id) ? "Edit user" : "Add user"}</DialogTitle></DialogHeader>
          {edit && <div className="space-y-3">
            <Field label="Full name" error={err.name}><input className="field w-full" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Email" error={err.email}><input className="field w-full" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value.toLowerCase() })} /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Role"><select className="field w-full" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
              <Field label="Bureau"><select className="field w-full" value={edit.bureau} onChange={(e) => setEdit({ ...edit, bureau: e.target.value })}>{BUREAUS.map((b) => <option key={b.id}>{b.id}</option>)}</select></Field>
              <Field label="Region"><select className="field w-full" value={edit.region} onChange={(e) => setEdit({ ...edit, region: e.target.value })}>{REGION_NAMES.map((r) => <option key={r}>{r}</option>)}</select></Field>
            </div>
            <p className="text-[11px] text-muted-foreground">{PERMS[edit.role]}</p>
            <div className="flex justify-end gap-2"><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn v="primary" onClick={save}>Save</Btn></div>
          </div>}
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle className="text-base">Confirm account change</DialogTitle></DialogHeader>
          <p className="text-sm">{confirm?.status === "Active" ? "Deactivate" : "Reactivate"} <b>{confirm?.name}</b>? This is recorded in the audit log.</p>
          <div className="flex justify-end gap-2"><Btn onClick={() => setConfirm(null)}>Cancel</Btn><Btn v="danger" onClick={toggleStatus}>Confirm</Btn></div>
        </DialogContent>
      </Dialog>
    </>
  );
}
