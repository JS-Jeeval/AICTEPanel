import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import { slug, type Case, type Institution } from "@/lib/data";
import type { OverlapMatch } from "@/lib/overlap";
import { Pill, StatusBadge } from "./common";

/** List of detected overlap matches with their reasons; `action` renders a per-row control (checkbox, button…). */
export function OverlapMatches({ matches, cases, institutions, limit = 5, action }: {
  matches: OverlapMatch[]; cases: Case[]; institutions: Institution[]; limit?: number; action?: (m: OverlapMatch) => ReactNode;
}) {
  const shown = matches.slice(0, limit);
  return (
    <div className="space-y-2">
      {shown.map((m) => {
        const other = cases.find((c) => c.id === m.caseId);
        const inst = institutions.find((i) => i.id === other?.instId);
        const strong = m.confidence >= 0.8;
        return (
          <div key={m.caseId} className={cn("rounded border p-2 text-xs", strong ? "border-destructive/40 bg-destructive/5" : "bg-card")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Link to="/cases/$id" params={{ id: slug(m.caseId) }} className="font-mono text-primary hover:underline">{m.caseId}</Link>
                {other && <StatusBadge s={other.status} />}
                <Pill t={m.matchType === "Potential Overlap" ? "violet" : "amber"}><GitCompare className="size-3" />{m.matchType}</Pill>
                <span className="tabular-nums text-muted-foreground">{Math.round(m.confidence * 100)}% match</span>
              </div>
              {action?.(m)}
            </div>
            {inst && other && <div className="mt-1 text-muted-foreground">{other.category} · {inst.name}</div>}
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-muted-foreground">{m.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        );
      })}
      {matches.length > limit && <p className="text-[11px] text-muted-foreground">+ {matches.length - limit} lower-confidence matches not shown.</p>}
    </div>
  );
}
