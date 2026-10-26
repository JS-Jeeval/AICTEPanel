import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronsLeft, FileText, GitCompare, Building2, LayoutDashboard, LogOut, Menu, ArrowLeftRight, BarChart3, ScrollText, Users, Settings, Search, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore, can } from "@/lib/store";
import { slug } from "@/lib/data";
import { Login } from "./login";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/cases", label: "All Cases", icon: FileText },
  { to: "/institutions", label: "Institutions", icon: Building2 },
  { to: "/overlaps", label: "Overlap Alerts", icon: GitCompare },
  { to: "/transfers", label: "Transfers & Escalations", icon: ArrowLeftRight },
  { to: "/reports", label: "Reports & Analytics", icon: BarChart3 },
  { to: "/audit", label: "Audit Logs", icon: ScrollText },
  { to: "/users", label: "User Administration", icon: Users, admin: true },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const s = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const path = useRouterState({ select: (r) => r.location.pathname });
  if (!s.user) return <Login />;
  const openAlerts = s.alerts.filter((a) => ["Open", "Under Review", "Coordination Required"].includes(a.review)).length;
  const unread = Math.max(0, openAlerts + s.transfers.filter((t) => t.status === "Pending Acceptance").length - s.read);
  const nav = NAV.filter((n) => !("admin" in n) || can(s.user).admin);
  const current = nav.find((n) => (n.to === "/" ? path === "/" : path.startsWith(n.to)));

  const side = (
    <aside className={cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", collapsed ? "w-14" : "w-60")}>
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3">
        <span className="grid size-8 shrink-0 place-items-center rounded bg-sidebar-primary text-sidebar-primary-foreground"><ShieldCheck className="size-4" /></span>
        {!collapsed && <div className="leading-tight"><div className="text-[13px] font-semibold text-sidebar-accent-foreground">AICTE ICMS</div><div className="text-[10px]">Complaint Monitoring</div></div>}
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {nav.map((n) => (
          <Link key={n.to} to={n.to} title={collapsed ? n.label : undefined} onClick={() => setMobile(false)}
            className={cn("flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] hover:bg-sidebar-accent", current?.to === n.to && "bg-sidebar-accent font-medium text-sidebar-accent-foreground")}>
            <n.icon className="size-4 shrink-0" />{!collapsed && <span className="flex-1">{n.label}</span>}
            {!collapsed && n.to === "/overlaps" && openAlerts > 0 && <span className="rounded bg-destructive px-1.5 text-[10px] text-destructive-foreground">{openAlerts}</span>}
          </Link>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-2">
        {!collapsed && <div className="px-2 pb-2 text-[11px]"><div className="font-medium text-sidebar-accent-foreground">{s.user.name}</div><div>{s.user.role}</div></div>}
        <button onClick={s.logout} title="Sign out" className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-[13px] hover:bg-sidebar-accent"><LogOut className="size-4" />{!collapsed && "Sign out"}</button>
        <button onClick={() => setCollapsed(!collapsed)} title="Collapse" className="hidden w-full items-center gap-2.5 rounded px-2.5 py-2 text-[13px] hover:bg-sidebar-accent lg:flex"><ChevronsLeft className={cn("size-4", collapsed && "rotate-180")} />{!collapsed && "Collapse"}</button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen lg:block">{side}</div>
      {mobile && <div className="fixed inset-0 z-40 flex lg:hidden"><div className="h-full">{side}</div><div className="flex-1 bg-foreground/40" onClick={() => setMobile(false)} /></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4">
          <button className="lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu className="size-5" /></button>
          <div className="hidden text-xs text-muted-foreground md:block">AICTE <span className="mx-1">/</span><span className="font-medium text-foreground">{current?.label ?? "Detail"}</span></div>
          <GlobalSearch />
          <button onClick={() => s.setRead(s.read + unread)} className="relative rounded p-1.5 hover:bg-muted" aria-label="Notifications" title={`${openAlerts} open alerts, pending transfers`}>
            <Bell className="size-4" />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-destructive px-1 text-[9px] text-destructive-foreground">{unread}</span>}
          </button>
          <div className="hidden text-right leading-tight sm:block"><div className="text-xs font-medium">{s.user.name}</div><div className="text-[10px] text-muted-foreground">{s.user.role} · {s.user.bureau}</div></div>
        </header>
        <div className="border-b bg-warning/15 px-4 py-1 text-[11px]">Demo mode — all institutions, cases and officers are synthetic. No live AICTE data or backend is connected.</div>
        <main className="flex-1 p-4 lg:p-5">{children}</main>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const s = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const t = q.trim().toLowerCase();
  const insts = t.length > 1 ? s.institutions.filter((i) => i.name.toLowerCase().includes(t) || i.permId.includes(t)).slice(0, 5) : [];
  const cases = t.length > 1 ? s.cases.filter((c) => c.id.toLowerCase().includes(t)).slice(0, 5) : [];
  const go = (fn: () => void) => { fn(); setQ(""); };
  return (
    <div className="relative ml-auto w-full max-w-sm">
      <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search case ID, institution, Permanent ID" className="field w-full pl-8" />
      {(insts.length > 0 || cases.length > 0) && (
        <div className="panel absolute z-50 mt-1 w-full py-1 shadow-md">
          {cases.map((c) => <button key={c.id} onClick={() => go(() => nav({ to: "/cases/$id", params: { id: slug(c.id) } }))} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"><FileText className="mr-1.5 inline size-3" />{c.id}</button>)}
          {insts.map((i) => <button key={i.id} onClick={() => go(() => nav({ to: "/institutions/$id", params: { id: i.id } }))} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted"><Building2 className="mr-1.5 inline size-3" />{i.name} <span className="text-muted-foreground">{i.permId}</span></button>)}
        </div>
      )}
    </div>
  );
}
