// Deterministic synthetic demo dataset. All names, IDs and details are fictional.
export const TODAY = new Date("2026-10-26T10:00:00Z");
const DAY = 86400000;
export const daysBetween = (a: string, b: Date = TODAY) => Math.floor((b.getTime() - new Date(a).getTime()) / DAY);
export const addDays = (d: Date | string, n: number) => new Date(new Date(d).getTime() + n * DAY).toISOString();
export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export type Status = "Pending" | "Under Process" | "Disposed" | "Transferred" | "Escalated";
export type Priority = "High" | "Medium" | "Low";
export type Role =
  | "System Administrator" | "PGRC Officer" | "Regulation Bureau Officer" | "Bureau Head"
  | "Regional Officer" | "Senior Management" | "Auditor";

export interface Bureau { id: string; name: string }
export interface User { id: string; name: string; email: string; role: Role; bureau: string; region: string; status: "Active" | "Deactivated"; lastLogin: string }
export interface Institution { id: string; name: string; permId: string; type: string; address: string; district: string; state: string; region: string; verified: boolean }
export interface CaseEvent { id: string; ts: string; action: string; officerId: string; bureau: string; from?: Status; to?: Status; remarks: string; doc?: string }
export interface Case {
  id: string; instId: string; category: string; summary: string; receivingBureau: string; currentBureau: string;
  officerId: string | null; received: string; due: string; status: Status; priority: Priority; lastAction: string;
  lastActionDate: string; nextAction: string; linked: string[]; remarks: string; docs: string[]; events: CaseEvent[]; awaitingCoordination: boolean;
}
export type MatchType = "Potential Overlap" | "Same Institution" | "Similar Complaint" | "Coordination Required";
export type ReviewStatus = "Open" | "Under Review" | "Coordination Required" | "Reviewed" | "Dismissed" | "Confirmed Overlap";
export interface AlertEvent { ts: string; userId: string; decision: string; remarks: string }
export interface Alert { id: string; caseA: string; caseB: string; detected: string; matchType: MatchType; confidence: number; reasons: string[]; review: ReviewStatus; reviewerId: string | null; history: AlertEvent[] }
export interface Transfer { id: string; caseId: string; from: string; to: string; reason: string; initiated: string; status: "Pending Acceptance" | "Accepted" | "Rejected" | "Senior Review"; initiatedBy: string; decidedAt?: string; decisionReason?: string; kind: "Transfer" | "Escalation" }
export interface Audit { id: string; ts: string; userId: string; action: string; entityType: "Case" | "Alert" | "Transfer" | "User" | "Session" | "Institution"; entityId: string; summary: string; result: "Success" | "Denied" }

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r = rng(2621);
/** Unwrap a value that must exist (keeps strict `noUncheckedIndexedAccess` happy without scattering `!`). */
export function req<T>(v: T | undefined | null, what = "value"): T {
  if (v === undefined || v === null) throw new Error(`Expected ${what} to be defined`);
  return v;
}
const pick = <T,>(a: readonly T[]): T => req(a[Math.floor(r() * a.length)], "pick() element");
const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));

export const BUREAUS: Bureau[] = [
  { id: "PGRC", name: "Public Grievance Redressal Cell" },
  { id: "RB", name: "Regulation Bureau" },
  { id: "AB", name: "Approval Bureau" },
  { id: "ACAD", name: "Academic Bureau" },
  { id: "FIN", name: "Finance Bureau" },
  { id: "QA", name: "Quality Assurance Cell" },
];
export const REGIONS: Record<string, string[]> = {
  Northern: ["Delhi", "Haryana", "Punjab"], Southern: ["Tamil Nadu", "Kerala"], Western: ["Maharashtra", "Gujarat"],
  Eastern: ["West Bengal", "Odisha"], Central: ["Madhya Pradesh", "Chhattisgarh"], "South-Western": ["Karnataka"],
  "South-Central": ["Telangana", "Andhra Pradesh"], "North-Western": ["Rajasthan"],
};
export const REGION_NAMES = Object.keys(REGIONS);
export const CATEGORIES = [
  "Fee Refund", "Admission Irregularity", "Faculty Shortage", "Infrastructure Deficiency", "Approval Violation",
  "Withholding of Certificates", "Student Safety", "Scholarship Disbursement", "Unapproved Course", "Salary Non-payment",
];
export const STATUSES: Status[] = ["Pending", "Under Process", "Disposed", "Transferred", "Escalated"];
export const ROLES: Role[] = ["System Administrator", "PGRC Officer", "Regulation Bureau Officer", "Bureau Head", "Regional Officer", "Senior Management", "Auditor"];

const FIRST = ["Anil", "Priya", "Rakesh", "Meera", "Suresh", "Kavita", "Vikram", "Nandini", "Arjun", "Shalini", "Deepak", "Ritu", "Mohan", "Aparna", "Harish", "Sneha", "Gaurav", "Lata", "Imran", "Pooja", "Naveen", "Farah"];
const LAST = ["Verma", "Iyer", "Kulkarni", "Banerjee", "Reddy", "Nair", "Chauhan", "Joshi", "Menon", "Saxena", "Das", "Rao", "Pillai", "Khanna"];

export const USERS: User[] = [];
let ui = 0;
const mkUser = (role: Role, bureau: string) => {
  const name = `${FIRST[ui % FIRST.length]} ${LAST[(ui * 5) % LAST.length]}`;
  const region = req(REGION_NAMES[ui % REGION_NAMES.length], "region");
  USERS.push({ id: `U${String(++ui).padStart(3, "0")}`, name, email: `${name.toLowerCase().replace(" ", ".")}@aicte-demo.in`, role, bureau, region, status: ui === 17 ? "Deactivated" : "Active", lastLogin: addDays(TODAY, -int(0, 12)) });
};
mkUser("System Administrator", "PGRC");
mkUser("Senior Management", "RB");
mkUser("Auditor", "QA");
for (const b of BUREAUS) {
  mkUser("Bureau Head", b.id);
  const role: Role = b.id === "PGRC" ? "PGRC Officer" : b.id === "RB" ? "Regulation Bureau Officer" : "Regional Officer";
  for (let i = 0; i < (b.id === "PGRC" || b.id === "RB" ? 4 : 2); i++) mkUser(role, b.id);
}
mkUser("Regional Officer", "AB");
export const officersOf = (bureau: string, users = USERS) => users.filter((u) => u.bureau === bureau && u.status === "Active" && !["System Administrator", "Senior Management", "Auditor"].includes(u.role));

const P1 = ["Sri Venkateshwara", "Rajarshi", "Govind Vallabh", "Shantiniketan", "Narmada Valley", "Kaveri", "Himalayan", "Deccan", "Sahyadri", "Ganga Tech", "Vindhya", "Aravali", "Konark", "Malabar", "Brahmaputra", "Satpura", "Tapti", "Nilgiri"];
const P2 = ["Institute of Technology", "College of Engineering", "School of Management", "Polytechnic", "Institute of Pharmacy"];
const TYPES: Record<string, string> = { "Institute of Technology": "Engineering & Technology", "College of Engineering": "Engineering & Technology", "School of Management": "Management", Polytechnic: "Diploma", "Institute of Pharmacy": "Pharmacy" };
export const INSTITUTIONS: Institution[] = Array.from({ length: 32 }, (_, i) => {
  const region = req(REGION_NAMES[i % REGION_NAMES.length], "region");
  const state: string = pick(req(REGIONS[region], "region states"));
  const suf = req(P2[(i * 3) % P2.length], "institution suffix");
  const district = `${pick(["North", "East", "Rural", "Urban", "Central"])} ${state.split(" ")[0]} District`;
  return { id: `I${String(i + 1).padStart(3, "0")}`, name: `${P1[i % P1.length]} ${suf}${i >= P1.length ? ", " + state.split(" ")[0] : ""}`, permId: `1-${(41000000 + i * 137913).toString()}`, type: req(TYPES[suf], "institution type"), address: `Plot ${int(10, 400)}, Institutional Area`, district, state, region, verified: r() > 0.12 };
});

const SUMMARY: Record<string, string> = {
  "Fee Refund": "Complainant reports non-refund of tuition fee after withdrawal of admission within the prescribed period.",
  "Admission Irregularity": "Allegation of admissions beyond approved intake and collection of capitation fee.",
  "Faculty Shortage": "Students report sustained shortage of qualified faculty in core departments.",
  "Infrastructure Deficiency": "Laboratories and library facilities reported to be below approved norms.",
  "Approval Violation": "Institution reportedly operating a course or shift without valid extension of approval.",
  "Withholding of Certificates": "Original certificates of the complainant are allegedly being withheld by the institution.",
  "Student Safety": "Complaint regarding inadequate grievance mechanism and student safety on campus.",
  "Scholarship Disbursement": "Delay in disbursement of scholarship amounts credited to the institution.",
  "Unapproved Course": "Institution advertising a programme not listed in its approval letter.",
  "Salary Non-payment": "Faculty members report non-payment of salaries for several months.",
};

export const CASES: Case[] = [];
export const TRANSFERS: Transfer[] = [];
let ev = 0;
for (let i = 0; i < 92; i++) {
  const inst = req(INSTITUTIONS[i < 64 ? i % 32 : int(0, 11)], "institution");
  const recvBureau = i % 3 === 0 ? "RB" : i % 3 === 1 ? "PGRC" : pick(BUREAUS).id;
  const age = i < 8 ? int(2, 12) : int(1, 320);
  const received = addDays(TODAY, -age);
  const due = addDays(received, recvBureau === "PGRC" ? 30 : 45);
  const roll = r();
  let status: Status = age < 6 ? "Pending" : roll < 0.36 ? "Disposed" : roll < 0.6 ? "Under Process" : roll < 0.75 ? "Pending" : roll < 0.88 ? "Transferred" : "Escalated";
  if (i < 8) status = i % 2 ? "Under Process" : "Pending";
  const category = i >= 64 && r() > 0.5 ? CASES[i - 64]?.category ?? pick(CATEGORIES) : pick(CATEGORIES);
  let current = recvBureau;
  const pool = officersOf(recvBureau);
  const officerId = status === "Pending" && r() < 0.5 ? null : pick(pool).id;
  const id = `AICTE/${recvBureau}/2026/${String(1001 + i)}`;
  const events: CaseEvent[] = [];
  const span = Math.max(1, Math.min(age, status === "Disposed" ? int(10, 40) : age));
  const at = (f: number) => addDays(received, Math.max(0, Math.floor(span * f)));
  const push = (f: number, action: string, by: string, bureau: string, from?: Status, to?: Status, remarks = "", doc?: string) =>
    events.push({ id: `E${++ev}`, ts: at(f), action, officerId: by, bureau, from, to, remarks, doc });
  const head = USERS.find((u) => u.role === "Bureau Head" && u.bureau === recvBureau)!.id;
  push(0, "Complaint received and registered", head, recvBureau, undefined, "Pending", "Registered from grievance portal.");
  if (officerId) push(0.1, "Assigned to case officer", head, recvBureau, undefined, undefined, `Assigned to ${USERS.find((u) => u.id === officerId)!.name}.`);
  let lastAction = "Complaint registered";
  let nextAction = officerId ? "Issue notice to institution" : "Assign case officer";
  if (status !== "Pending" && officerId) {
    push(0.3, "Notice issued to institution", officerId, recvBureau, "Pending", "Under Process", "Institution asked to submit reply within 15 days.", "Notice_letter.pdf");
    lastAction = "Notice issued to institution"; nextAction = "Examine institution reply";
  }
  if (status === "Transferred") {
    const to = recvBureau === "RB" ? "PGRC" : "RB";
    const pending = r() < 0.45;
    push(0.6, `Transfer initiated to ${to}`, officerId!, recvBureau, "Under Process", "Transferred", "Subject matter falls within jurisdiction of destination bureau.");
    TRANSFERS.push({ id: `T${String(TRANSFERS.length + 1).padStart(3, "0")}`, caseId: id, from: recvBureau, to, reason: "Subject matter falls within jurisdiction of destination bureau.", initiated: at(0.6), status: pending ? "Pending Acceptance" : "Accepted", initiatedBy: officerId!, decidedAt: pending ? undefined : at(0.7), decisionReason: pending ? undefined : "Accepted for processing.", kind: "Transfer" });
    current = to; lastAction = "Transferred"; nextAction = pending ? "Destination bureau to accept transfer" : "Destination officer to review";
  }
  if (status === "Escalated") {
    push(0.7, "Escalated to Bureau Head", officerId!, recvBureau, "Under Process", "Escalated", "No reply from institution after reminder.");
    TRANSFERS.push({ id: `T${String(TRANSFERS.length + 1).padStart(3, "0")}`, caseId: id, from: recvBureau, to: recvBureau, reason: "No reply from institution after reminder.", initiated: at(0.7), status: r() < 0.5 ? "Senior Review" : "Accepted", initiatedBy: officerId!, kind: "Escalation" });
    lastAction = "Escalated to Bureau Head"; nextAction = "Senior review of institution conduct";
  }
  if (status === "Disposed") {
    push(0.75, "Institution reply examined", officerId!, recvBureau, undefined, undefined, "Reply found satisfactory with supporting evidence.", "Institution_reply.pdf");
    push(1, "Case disposed", officerId!, recvBureau, "Under Process", "Disposed", "Grievance redressed; complainant informed.");
    lastAction = "Case disposed"; nextAction = "—";
  }
  const lastDate = req(events[events.length - 1], "last event").ts;
  CASES.push({
    id, instId: inst.id, category, summary: req(SUMMARY[category], "category summary"), receivingBureau: recvBureau, currentBureau: current, officerId, received, due, status,
    priority: r() < 0.25 ? "High" : r() < 0.6 ? "Medium" : "Low", lastAction, lastActionDate: lastDate, nextAction, linked: [],
    remarks: "Internal: verify approval records with Approval Bureau before final disposal.", docs: ["Complaint_form.pdf", ...events.filter((e) => e.doc).map((e) => e.doc!)],
    events, awaitingCoordination: false,
  });
}

export const ALERTS: Alert[] = [];
const active = (c: Case) => c.status !== "Disposed";
const byInst = new Map<string, Case[]>();
CASES.forEach((c) => byInst.set(c.instId, [...(byInst.get(c.instId) ?? []), c]));
const reviewers = USERS.filter((u) => u.role === "Bureau Head");
const reviews: ReviewStatus[] = ["Open", "Open", "Open", "Under Review", "Coordination Required", "Reviewed", "Dismissed", "Open"];
for (const [, list] of byInst) {
  for (let a = 0; a < list.length && ALERTS.length < 16; a++)
    for (let b = a + 1; b < list.length && ALERTS.length < 16; b++) {
      const A = req(list[a], "case A"), B = req(list[b], "case B");
      if (A.currentBureau === B.currentBureau || !(active(A) || active(B))) continue;
      const sameCat = A.category === B.category;
      const both = active(A) && active(B);
      const inst = INSTITUTIONS.find((i) => i.id === A.instId)!;
      const reasons = [inst.verified ? "Same verified AICTE Permanent ID" : "Same institution name (Permanent ID unverified)"];
      if (sameCat) reasons.push(`Same complaint category: ${A.category}`);
      if (both) reasons.push("Both cases currently active");
      reasons.push(`Handled by different bureaus: ${A.currentBureau} and ${B.currentBureau}`);
      const matchType: MatchType = sameCat && both ? "Potential Overlap" : sameCat ? "Similar Complaint" : both ? "Coordination Required" : "Same Institution";
      const review = req(reviews[ALERTS.length % reviews.length], "review status");
      const reviewer = review === "Open" ? null : pick(reviewers).id;
      const detected = addDays(new Date(Math.max(new Date(A.received).getTime(), new Date(B.received).getTime())), 1);
      const history: AlertEvent[] = [{ ts: detected, userId: "SYSTEM", decision: "Alert generated", remarks: "Rule-based match on institution identity." }];
      if (reviewer) history.push({ ts: addDays(detected, 2), userId: reviewer, decision: review, remarks: review === "Dismissed" ? "Different issues, no coordination needed." : "Reviewed by bureau head." });
      ALERTS.push({ id: `OA-${String(ALERTS.length + 1).padStart(3, "0")}`, caseA: A.id, caseB: B.id, detected, matchType, confidence: sameCat ? (inst.verified ? 0.86 : 0.64) : inst.verified ? 0.58 : 0.41, reasons, review, reviewerId: reviewer, history });
      if (review === "Coordination Required") { A.awaitingCoordination = true; B.awaitingCoordination = true; }
    }
}

export const AUDIT: Audit[] = CASES.flatMap((c) =>
  c.events.map((e) => ({ id: `A-${e.id}`, ts: e.ts, userId: e.officerId, action: e.action, entityType: "Case" as const, entityId: c.id, summary: e.to ? `Status ${e.from ?? "—"} → ${e.to}` : e.remarks, result: "Success" as const })),
).sort((a, b) => b.ts.localeCompare(a.ts));

export const isOverdue = (c: Case) => c.status !== "Disposed" && new Date(c.due) < TODAY;
export const isNearDue = (c: Case) => c.status !== "Disposed" && !isOverdue(c) && daysBetween(TODAY.toISOString(), new Date(c.due)) <= 7;

export function toCSV(rows: Record<string, unknown>[], name: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0] ?? {});
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `${name}.csv`; a.click();
}
export const slug = (id: string) => id.replaceAll("/", "-");
