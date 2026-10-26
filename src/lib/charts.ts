import { useMemo } from "react";
import { TODAY, daysBetween } from "./data";
export const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];
export const ax = { fontSize: 11, fill: "var(--muted-foreground)" };

export function useMonthly(cases: { received: string; status: string; events: { ts: string; to?: string }[] }[]) {
  return useMemo(() => {
    const m = Array.from({ length: 10 }, (_, i) => { const d = new Date(TODAY); d.setMonth(d.getMonth() - 9 + i); return { key: d.toISOString().slice(0, 7), month: d.toLocaleString("en-IN", { month: "short" }), Received: 0, Disposed: 0 }; });
    cases.forEach((c) => { const r = m.find((x) => x.key === c.received.slice(0, 7)); if (r) r.Received++; const d = c.events.find((e) => e.to === "Disposed"); const dm = d && m.find((x) => x.key === d.ts.slice(0, 7)); if (dm) dm.Disposed++; });
    return m;
  }, [cases]);
}
export const ageing = (cases: { status: string; received: string }[]) => {
  const b = [{ name: "0–7 d", v: 0 }, { name: "8–15 d", v: 0 }, { name: "16–30 d", v: 0 }, { name: "> 30 d", v: 0 }];
  cases.filter((c) => c.status !== "Disposed").forEach((c) => { const d = daysBetween(c.received); const bucket = b[d <= 7 ? 0 : d <= 15 ? 1 : d <= 30 ? 2 : 3]; if (bucket) bucket.v++; });
  return b;
};

