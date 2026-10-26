import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Clock, GitCompare, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNearDue, isOverdue, type Case, type Priority, type Status } from "@/lib/data";

const tone = {
  blue: "bg-primary/10 text-primary border-primary/20",
  green: "bg-success/10 text-success border-success/25",
  amber: "bg-warning/15 text-foreground border-warning/40",
  red: "bg-destructive/10 text-destructive border-destructive/25",
  violet: "bg-violet/10 text-violet border-violet/25",
  grey: "bg-muted text-muted-foreground border-border",
};
export type Tone = keyof typeof tone;
export const Pill = ({ t = "grey", children, className }: { t?: Tone; children: ReactNode; className?: string }) => (
  <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-medium", tone[t], className)}>{children}</span>
);
const ST: Record<Status, Tone> = { Pending: "amber", "Under Process": "blue", Disposed: "green", Transferred: "violet", Escalated: "red" };
export const StatusBadge = ({ s }: { s: Status }) => <Pill t={ST[s]}>{s}</Pill>;
export const PriorityBadge = ({ p }: { p: Priority }) => <Pill t={p === "High" ? "red" : p === "Medium" ? "amber" : "grey"}>{p}</Pill>;
export const Urgency = ({ c }: { c: Case }) =>
  isOverdue(c) ? <Pill t="red"><AlertTriangle className="size-3" />Overdue</Pill> : isNearDue(c) ? <Pill t="amber"><Clock className="size-3" />Due soon</Pill> : null;
export const OverlapFlag = () => <Pill t="violet"><GitCompare className="size-3" />Potential Overlap</Pill>;

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-lg font-semibold tracking-tight">{title}</h1>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
export function Metric({ label, value, icon: Icon, t = "blue", to, search, hint }: { label: string; value: number | string; icon: LucideIcon; t?: Tone; to: string; search?: Record<string, unknown>; hint?: string }) {
  return (
    <Link to={to} search={search as never} className="panel block p-3 transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><span className={cn("rounded p-1", tone[t])}><Icon className="size-3.5" /></span></div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </Link>
  );
}
export function Panel({ title, children, action, className }: { title?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={cn("panel", className)}>
      {title && <header className="flex items-center justify-between border-b px-3 py-2"><h2 className="text-[13px] font-semibold">{title}</h2>{action}</header>}
      <div className="p-3">{children}</div>
    </section>
  );
}
export const Empty = ({ text = "No records match the current filters." }: { text?: string }) => (
  <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground"><Inbox className="size-6" />{text}</div>
);
export const Btn = ({ v = "outline", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { v?: "primary" | "outline" | "danger" | "ghost" }) => (
  <button {...p} className={cn("inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors disabled:opacity-50",
    v === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
    v === "outline" && "border bg-card hover:bg-muted", v === "danger" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    v === "ghost" && "hover:bg-muted", className)} />
);
export const Sel = ({ value, onChange, options, label, className }: { value: string; onChange: (v: string) => void; options: (string | [string, string])[]; label: string; className?: string }) => (
  <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cn("field", className)}>
    <option value="">{label}</option>
    {options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <option key={v} value={v}>{l}</option>; })}
  </select>
);
export const Field = ({ label, children, error }: { label: string; children: ReactNode; error?: string }) => (
  <label className="block space-y-1 text-xs font-medium">{label}{children}{error && <span className="block font-normal text-destructive">{error}</span>}</label>
);
export const KV = ({ k, v }: { k: string; v: ReactNode }) => (
  <div><dt className="text-[11px] text-muted-foreground">{k}</dt><dd className="text-[13px]">{v}</dd></div>
);
