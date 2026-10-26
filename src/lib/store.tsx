import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { ALERTS, AUDIT, CASES, INSTITUTIONS, TRANSFERS, USERS, TODAY, addDays, type Alert, type Audit, type Case, type Priority, type Status, type Transfer, type User, type ReviewStatus } from "./data";
import type { OverlapMatch } from "./overlap";

export interface NewCaseInput { instId: string; category: string; summary: string; bureau: string; priority: Priority; doc?: string }

let seq = 0;
const now = () => new Date(TODAY.getTime() + ++seq * 60000).toISOString();

export const can = (u: User | null) => ({
  act: !!u && !["Auditor", "Senior Management"].includes(u.role),
  admin: u?.role === "System Administrator",
  remarks: !!u && !["Auditor", "Regional Officer"].includes(u.role),
  decide: !!u && ["Bureau Head", "System Administrator", "Senior Management"].includes(u.role),
});

function useStoreState() {
  const [user, setUser] = useState<User | null>(null);
  const [cases, setCases] = useState<Case[]>(CASES);
  const [alerts, setAlerts] = useState<Alert[]>(ALERTS);
  const [transfers, setTransfers] = useState<Transfer[]>(TRANSFERS);
  const [users, setUsers] = useState<User[]>(USERS);
  const [audit, setAudit] = useState<Audit[]>(AUDIT);
  const [read, setRead] = useState(0);

  const log = useCallback((a: Omit<Audit, "id" | "ts" | "userId" | "result">, u = user) =>
    setAudit((x) => [{ ...a, id: `A-N${seq}`, ts: now(), userId: u?.id ?? "SYSTEM", result: "Success" }, ...x]), [user]);

  const updateCase = (id: string, fn: (c: Case) => Case) => setCases((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));

  const recordAction = (id: string, f: { action: string; remarks: string; next: string; status?: Status; followUp?: string; doc?: string }) => {
    const ts = now();
    updateCase(id, (c) => ({
      ...c, status: f.status ?? c.status, lastAction: f.action, lastActionDate: ts, nextAction: f.next,
      due: f.followUp ? new Date(f.followUp).toISOString() : c.due, docs: f.doc ? [...c.docs, f.doc] : c.docs,
      events: [...c.events, { id: `EN${seq}`, ts, action: f.action, officerId: user!.id, bureau: c.currentBureau, from: f.status && f.status !== c.status ? c.status : undefined, to: f.status && f.status !== c.status ? f.status : undefined, remarks: f.remarks, doc: f.doc }],
    }));
    log({ action: f.action, entityType: "Case", entityId: id, summary: f.remarks });
    toast.success(`Action recorded on ${id}`);
  };
  const reassign = (id: string, officerId: string) => {
    const name = users.find((u) => u.id === officerId)?.name;
    updateCase(id, (c) => ({ ...c, officerId, events: [...c.events, { id: `EN${seq}`, ts: now(), action: "Officer reassigned", officerId: user!.id, bureau: c.currentBureau, remarks: `Reassigned to ${name}. Previous assignment retained in history.` }] }));
    log({ action: "Reassign officer", entityType: "Case", entityId: id, summary: `Assigned to ${name}` });
    toast.success(`Reassigned to ${name}`);
  };
  const transfer = (id: string, to: string, reason: string, kind: "Transfer" | "Escalation" = "Transfer") => {
    const c = cases.find((x) => x.id === id)!;
    const st: Status = kind === "Transfer" ? "Transferred" : "Escalated";
    setTransfers((t) => [{ id: `T${String(t.length + 1).padStart(3, "0")}`, caseId: id, from: c.currentBureau, to, reason, initiated: now(), status: kind === "Transfer" ? "Pending Acceptance" : "Senior Review", initiatedBy: user!.id, kind }, ...t]);
    updateCase(id, (x) => ({ ...x, status: st, currentBureau: to, lastAction: kind === "Transfer" ? `Transfer to ${to}` : "Escalated", lastActionDate: now(), events: [...x.events, { id: `EN${seq}`, ts: now(), action: kind === "Transfer" ? `Transfer initiated to ${to}` : "Escalated for senior review", officerId: user!.id, bureau: x.currentBureau, from: x.status, to: st, remarks: reason }] }));
    log({ action: kind, entityType: "Case", entityId: id, summary: reason });
    toast.success(kind === "Transfer" ? `Transfer to ${to} initiated` : "Case escalated");
  };
  const decideTransfer = (tid: string, accept: boolean, reason: string) => {
    const t = transfers.find((x) => x.id === tid)!;
    setTransfers((ts) => ts.map((x) => (x.id === tid ? { ...x, status: accept ? "Accepted" : "Rejected", decidedAt: now(), decisionReason: reason } : x)));
    updateCase(t.caseId, (c) => ({ ...c, status: "Under Process", currentBureau: accept ? t.to : t.from, lastAction: accept ? "Transfer accepted" : "Transfer rejected", lastActionDate: now(), events: [...c.events, { id: `EN${seq}`, ts: now(), action: `${t.kind} ${accept ? "accepted" : "rejected"}`, officerId: user!.id, bureau: t.to, from: c.status, to: "Under Process", remarks: reason }] }));
    log({ action: `${t.kind} ${accept ? "accepted" : "rejected"}`, entityType: "Transfer", entityId: tid, summary: reason });
    toast.success(`${t.kind} ${accept ? "accepted" : "rejected"}`);
  };
  const linkCases = (a: string, b: string) => {
    setCases((cs) => cs.map((c) => (c.id === a && !c.linked.includes(b) ? { ...c, linked: [...c.linked, b] } : c.id === b && !c.linked.includes(a) ? { ...c, linked: [...c.linked, a] } : c)));
    log({ action: "Link related cases", entityType: "Case", entityId: a, summary: `Linked with ${b} (records kept separate)` });
  };
  const reviewAlert = (aid: string, review: ReviewStatus | null, decision: string, remarks: string) => {
    const al = alerts.find((x) => x.id === aid)!;
    setAlerts((as) => as.map((x) => (x.id === aid ? { ...x, review: review ?? x.review, reviewerId: user!.id, history: [...x.history, { ts: now(), userId: user!.id, decision, remarks }] } : x)));
    if (decision === "Link Cases") linkCases(al.caseA, al.caseB);
    if (review === "Coordination Required") setCases((cs) => cs.map((c) => ([al.caseA, al.caseB].includes(c.id) ? { ...c, awaitingCoordination: true } : c)));
    log({ action: `Alert: ${decision}`, entityType: "Alert", entityId: aid, summary: remarks });
    toast.success(`${aid}: ${decision}`);
  };
  const lastNum = (ids: string[], sep: string) => ids.reduce((m, id) => Math.max(m, Number(id.split(sep).pop()) || 0), 0);
  const buildAlert = (n: number, a: string, b: string, m: OverlapMatch, trigger: string): Alert => {
    const ts = now();
    return { id: `OA-${String(n).padStart(3, "0")}`, caseA: a, caseB: b, detected: ts, matchType: m.matchType, confidence: m.confidence, reasons: m.reasons, review: "Open", reviewerId: null, history: [{ ts, userId: "SYSTEM", decision: "Alert generated", remarks: `Client-side overlap detection (${trigger}).` }] };
  };
  /** Register a new complaint. Selected overlap matches become coordination alerts in the same step. */
  const createCase = (d: NewCaseInput, raiseFor: OverlapMatch[]): Case | null => {
    if (!user) return null;
    const id = `AICTE/${d.bureau}/2026/${Math.max(1000, lastNum(cases.map((c) => c.id), "/")) + 1}`;
    const ts = now();
    const created: Case = {
      id, instId: d.instId, category: d.category, summary: d.summary.trim(), receivingBureau: d.bureau, currentBureau: d.bureau,
      officerId: null, received: ts, due: addDays(ts, d.bureau === "PGRC" ? 30 : 45), status: "Pending", priority: d.priority,
      lastAction: "Complaint registered", lastActionDate: ts, nextAction: "Assign case officer", linked: [], remarks: "", docs: d.doc ? [d.doc] : [],
      awaitingCoordination: false,
      events: [{ id: `EN${seq}`, ts, action: "Complaint received and registered", officerId: user.id, bureau: d.bureau, to: "Pending", remarks: `Registered by ${user.name}.`, doc: d.doc }],
    };
    setCases((cs) => [created, ...cs]);
    if (raiseFor.length) {
      const start = lastNum(alerts.map((a) => a.id), "-");
      setAlerts((as) => [...raiseFor.map((m, i) => buildAlert(start + i + 1, id, m.caseId, m, `new case ${id}`)), ...as]);
    }
    log({ action: "Register case", entityType: "Case", entityId: id, summary: `${d.category}${raiseFor.length ? ` · ${raiseFor.length} overlap alert(s) raised` : ""}` });
    toast.success(`Case ${id} registered${raiseFor.length ? ` with ${raiseFor.length} overlap alert(s)` : ""}`);
    return created;
  };
  /** Raise an alert for a freshly detected pair on an existing case. */
  const raiseAlert = (caseId: string, m: OverlapMatch) => {
    const exists = alerts.some((a) => (a.caseA === caseId && a.caseB === m.caseId) || (a.caseA === m.caseId && a.caseB === caseId));
    if (exists) return;
    const n = lastNum(alerts.map((a) => a.id), "-") + 1;
    setAlerts((as) => [buildAlert(n, caseId, m.caseId, m, `viewing ${caseId}`), ...as]);
    log({ action: "Raise overlap alert", entityType: "Alert", entityId: `OA-${String(n).padStart(3, "0")}`, summary: `${caseId} ↔ ${m.caseId} (${m.matchType}, ${Math.round(m.confidence * 100)}%)` });
    toast.success(`Overlap alert raised for ${caseId} and ${m.caseId}`);
  };
  const logExport = (entityType: Audit["entityType"], entityId: string, summary: string) => {
    log({ action: "Export PDF dossier", entityType, entityId, summary });
    toast.success("PDF dossier downloaded");
  };
  const saveUser = (u: User) => {
    setUsers((us) => (us.some((x) => x.id === u.id) ? us.map((x) => (x.id === u.id ? u : x)) : [...us, u]));
    log({ action: "Save user", entityType: "User", entityId: u.id, summary: `${u.name} · ${u.role} · ${u.status}` });
    toast.success(`User ${u.name} saved`);
  };
  const login = (u: User) => { setUser(u); log({ action: "Sign in (demo)", entityType: "Session", entityId: u.id, summary: `${u.role}, ${u.bureau}` }, u); };
  const logout = () => { log({ action: "Sign out", entityType: "Session", entityId: user!.id, summary: "" }); setUser(null); };

  return { user, login, logout, cases, alerts, transfers, users, audit, institutions: INSTITUTIONS, recordAction, reassign, transfer, decideTransfer, linkCases, reviewAlert, saveUser, createCase, raiseAlert, logExport, read, setRead };
}

type Store = ReturnType<typeof useStoreState>;
const Ctx = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const s = useStoreState();
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}
export const useStore = () => useContext(Ctx)!;
export const userName = (users: User[], id?: string | null) => (id === "SYSTEM" ? "System" : users.find((u) => u.id === id)?.name ?? "Unassigned");
