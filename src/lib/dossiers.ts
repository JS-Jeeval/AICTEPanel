import { BUREAUS, daysBetween, fmtDate, fmtDateTime, isOverdue, slug, type Alert, type Case, type Institution, type User } from "./data";
import { PdfBuilder } from "./pdf";

const FOOTER = "DEMO - synthetic data. Generated from the AICTE ICMS prototype; not an official record.";
const RUNNING = "AICTE  |  Integrated Institution Complaint Monitoring System";

const who = (users: User[], id?: string | null) =>
  id === "SYSTEM" ? "System" : users.find((u) => u.id === id)?.name ?? "Unassigned";
const stamp = () => fmtDateTime(new Date().toISOString());
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The event that closed a case, if it was recorded as a status change to Disposed. */
export const disposalEvent = (c: Case) => [...c.events].reverse().find((e) => e.to === "Disposed");

export const disposalFilename = (c: Case) => `${slug(c.id)}-disposal-dossier.pdf`;
export const institutionFilename = (i: Institution) => `${i.id}-institution-360-dossier.pdf`;

export interface DisposalInput {
  c: Case;
  inst: Institution;
  users: User[];
  allCases: Case[];
  alerts: Alert[];
  /** Internal remarks are only printed for roles allowed to see them. */
  includeRemarks: boolean;
}

export function buildDisposalDossier({ c, inst, users, allCases, alerts, includeRemarks }: DisposalInput) {
  if (c.status !== "Disposed") throw new Error("A disposal dossier can only be generated for a disposed case.");
  const closing = disposalEvent(c);
  const disposedOn = closing?.ts ?? c.lastActionDate;
  const takenDays = Math.max(0, Math.round((new Date(disposedOn).getTime() - new Date(c.received).getTime()) / 86400000));
  const lateBy = Math.round((new Date(disposedOn).getTime() - new Date(c.due).getTime()) / 86400000);
  const timeline = lateBy <= 0 ? "Within the expected disposal date" : `${lateBy} day${lateBy === 1 ? "" : "s"} after the expected disposal date`;
  const officer = who(users, closing?.officerId ?? c.officerId);
  const head = users.find((u) => u.role === "Bureau Head" && u.bureau === c.currentBureau);
  const bureauName = BUREAUS.find((b) => b.id === c.currentBureau)?.name ?? c.currentBureau;

  const pdf = new PdfBuilder({ title: `Case Disposal Dossier - ${c.id}`, running: RUNNING, footer: FOOTER });
  pdf.title("Case Disposal Dossier", `${c.id}  ·  ${inst.name}`, "DEMO");
  pdf.paragraph(`Generated ${stamp()}`, { size: 8, color: [0.4, 0.42, 0.46] });

  pdf.heading("Case particulars");
  pdf.kv([
    ["Case ID", c.id], ["Category", c.category], ["Priority", c.priority],
    ["Receiving bureau", c.receivingBureau], ["Disposing bureau", `${c.currentBureau} - ${bureauName}`], ["Disposing officer", officer],
    ["Received on", fmtDate(c.received)], ["Expected disposal", fmtDate(c.due)], ["Disposed on", fmtDate(disposedOn)],
    ["Time taken", `${takenDays} day${takenDays === 1 ? "" : "s"}`], ["Timeline compliance", timeline], ["Final status", c.status],
  ]);

  pdf.heading("Institution");
  pdf.kv([
    ["Name", inst.name], ["AICTE Permanent ID", `${inst.permId}${inst.verified ? " (verified)" : " (verification pending)"}`], ["Type", inst.type],
    ["Location", `${inst.district}, ${inst.state}`], ["Region", `${inst.region} Region`], ["Address", inst.address],
  ]);

  pdf.heading("Complaint");
  pdf.paragraph(c.summary);

  pdf.heading("Disposal details");
  pdf.paragraph(closing?.remarks || "No closing remarks were recorded.");
  pdf.kv([["Last action", c.lastAction], ["Last action date", fmtDate(c.lastActionDate)], ["Recorded by", officer]], 3);

  pdf.heading("Action timeline (oldest first)");
  const events = [...c.events].sort((a, b) => a.ts.localeCompare(b.ts));
  pdf.table(
    ["Date", "Action", "Officer / bureau", "Status change", "Remarks"],
    [14, 22, 20, 14, 30],
    events.map((e) => [fmtDateTime(e.ts), e.action, `${who(users, e.officerId)} (${e.bureau})`, e.to ? `${e.from ?? "New"} -> ${e.to}` : "-", e.remarks || "-"]),
  );

  pdf.heading("Supporting documents");
  pdf.bullets(c.docs);

  const related = alerts.filter((a) => a.caseA === c.id || a.caseB === c.id);
  pdf.heading("Linked cases and coordination alerts");
  if (!c.linked.length && !related.length) pdf.paragraph("No linked cases or overlap alerts on record.", { color: [0.4, 0.42, 0.46], font: "F3" });
  if (c.linked.length) pdf.bullets(c.linked.map((l) => `Linked case ${l}${allCases.find((x) => x.id === l) ? ` (${allCases.find((x) => x.id === l)?.status})` : ""}`));
  if (related.length) {
    pdf.table(
      ["Alert", "Other case", "Match type", "Confidence", "Review outcome"],
      [12, 28, 22, 12, 26],
      related.map((a) => [a.id, a.caseA === c.id ? a.caseB : a.caseA, a.matchType, pct(a.confidence), a.review]),
    );
  }

  if (includeRemarks) {
    pdf.heading("Internal remarks (restricted)");
    pdf.paragraph(c.remarks);
  }

  pdf.heading("Certification");
  pdf.paragraph("Extracted from the case record maintained in the Integrated Institution Complaint Monitoring System. Complaints about the same institution remain separate records unless linked by an authorised official.", { size: 8.5 });
  pdf.signatures([
    { role: "Case officer", name: officer },
    { role: `Bureau Head, ${c.currentBureau}`, name: head?.name ?? "Bureau Head" },
  ]);
  return pdf.build();
}

export interface InstitutionInput {
  inst: Institution;
  cases: Case[];
  alerts: Alert[];
  users: User[];
}

export function buildInstitutionDossier({ inst, cases, alerts, users }: InstitutionInput) {
  const active = cases.filter((c) => c.status !== "Disposed");
  const disposed = cases.filter((c) => c.status === "Disposed");
  const ids = new Set(cases.map((c) => c.id));
  const myAlerts = alerts.filter((a) => ids.has(a.caseA) || ids.has(a.caseB));
  const openAlerts = myAlerts.filter((a) => ["Open", "Under Review", "Coordination Required"].includes(a.review));
  const bureausInvolved = new Set(cases.flatMap((c) => [c.currentBureau, c.receivingBureau]));
  const avgDays = disposed.length
    ? Math.round(disposed.reduce((sum, c) => sum + Math.max(0, Math.round((new Date(c.events.find((e) => e.to === "Disposed")?.ts ?? c.lastActionDate).getTime() - new Date(c.received).getTime()) / 86400000)), 0) / disposed.length)
    : null;

  const pdf = new PdfBuilder({ title: `Institution 360 Dossier - ${inst.name}`, running: RUNNING, footer: FOOTER });
  pdf.title("Institution 360° Dossier", inst.name, "DEMO");
  pdf.paragraph(`Generated ${stamp()}`, { size: 8, color: [0.4, 0.42, 0.46] });

  pdf.heading("Institution profile");
  pdf.kv([
    ["Institution ID", inst.id], ["AICTE Permanent ID", inst.permId], ["Verification", inst.verified ? "Verified Permanent ID" : "Verification pending"],
    ["Type", inst.type], ["District / state", `${inst.district}, ${inst.state}`], ["Region", `${inst.region} Region`],
    ["Address", inst.address],
  ]);

  pdf.heading("Complaint summary");
  pdf.kv([
    ["Total complaints", String(cases.length)], ["Active cases", String(active.length)], ["Disposed", String(disposed.length)],
    ["Overdue", String(cases.filter(isOverdue).length)], ["High priority (active)", String(active.filter((c) => c.priority === "High").length)], ["Bureaus involved", String(bureausInvolved.size)],
    ["Unresolved overlap alerts", String(openAlerts.length)], ["Average disposal time", avgDays === null ? "n/a" : `${avgDays} days`], ["Oldest active case", active.length ? `${Math.max(...active.map((c) => daysBetween(c.received)))} days` : "n/a"],
  ]);

  const byCat = new Map<string, { n: number; open: number }>();
  cases.forEach((c) => { const v = byCat.get(c.category) ?? { n: 0, open: 0 }; v.n++; if (c.status !== "Disposed") v.open++; byCat.set(c.category, v); });
  pdf.heading("Complaints by category");
  pdf.table(["Category", "Total", "Active", "Disposed"], [50, 16, 16, 18],
    [...byCat.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => [k, String(v.n), String(v.open), String(v.n - v.open)]));

  pdf.heading("Bureau involvement");
  pdf.table(["Bureau", "Active", "Disposed", "Total"], [50, 16, 16, 18],
    BUREAUS.map((b) => ({ b, a: active.filter((c) => c.currentBureau === b.id).length, d: disposed.filter((c) => c.currentBureau === b.id).length }))
      .filter((r) => r.a + r.d > 0).map((r) => [`${r.b.id} - ${r.b.name}`, String(r.a), String(r.d), String(r.a + r.d)]));

  pdf.heading("All cases");
  pdf.table(["Case ID", "Category", "Bureau", "Officer", "Received", "Due", "Status", "Priority"], [22, 20, 8, 15, 11, 11, 11, 8],
    [...cases].sort((a, b) => b.received.localeCompare(a.received)).map((c) => [c.id, c.category, c.currentBureau, who(users, c.officerId), fmtDate(c.received), fmtDate(c.due), isOverdue(c) ? `${c.status} (overdue)` : c.status, c.priority]), { size: 7.5 });

  pdf.heading("Overlap and coordination alerts");
  pdf.table(["Alert", "Case A", "Case B", "Match type", "Conf.", "Review"], [9, 25, 25, 17, 8, 16],
    myAlerts.map((a) => [a.id, a.caseA, a.caseB, a.matchType, pct(a.confidence), a.review]), { size: 7.5 });

  const events = cases.flatMap((c) => c.events.map((e) => ({ ...e, caseId: c.id }))).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 15);
  pdf.heading("Recent activity (latest 15)");
  pdf.table(["Date", "Case", "Action", "Officer / bureau"], [18, 27, 30, 25],
    events.map((e) => [fmtDateTime(e.ts), e.caseId, e.action, `${who(users, e.officerId)} (${e.bureau})`]), { size: 7.5 });

  pdf.heading("Document index");
  const docs = cases.filter((c) => c.docs.length).map((c) => `${c.id}: ${c.docs.join(", ")}`);
  pdf.bullets(docs, 8.5);

  pdf.space(6);
  pdf.paragraph("Complaints about the same institution remain separate records unless an authorised official links them. Internal remarks are excluded from this dossier.", { size: 8.5, font: "F3" });
  return pdf.build();
}
