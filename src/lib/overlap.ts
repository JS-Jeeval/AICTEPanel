import type { Alert, Case, Institution, MatchType } from "./data";

/**
 * Client-side overlap detection.
 *
 * Works on a "draft" (a case being registered) or on an existing case. It is
 * deliberately rule-based and explainable: every match carries the reasons that
 * produced it so an officer can see why it was flagged. Complaints are never
 * merged automatically — a match only suggests coordination or linking.
 */
export interface CaseDraft {
  instId: string;
  category: string;
  summary: string;
  /** Bureau that will handle the case (used to decide whether coordination is needed). */
  bureau: string;
}

export type InstitutionMatch = "id" | "permId" | "name";

export interface OverlapMatch {
  caseId: string;
  matchType: MatchType;
  confidence: number;
  reasons: string[];
  institutionMatch: InstitutionMatch;
  sameCategory: boolean;
  bothActive: boolean;
  differentBureau: boolean;
  /** 0..1 word overlap between the two complaint summaries. */
  textSimilarity: number;
}

const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "at", "for", "by", "with", "is", "are", "was", "were", "be",
  "been", "that", "this", "it", "its", "as", "from", "after", "before", "within", "has", "have", "had", "not", "no",
  "their", "they", "them", "complainant", "complaint", "reports", "report", "reportedly", "alleged", "allegedly",
]);

const tokens = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );

/** Jaccard similarity of the significant words of two texts. */
export function textSimilarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  A.forEach((w) => { if (B.has(w)) shared++; });
  return shared / (A.size + B.size - shared);
}

const normName = (n: string) =>
  n.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\b(the|of|and)\b/g, " ").replace(/\s+/g, " ").trim();

/** How (if at all) two institution records refer to the same institution. */
export function institutionMatch(a: Institution | undefined, b: Institution | undefined): InstitutionMatch | null {
  if (!a || !b) return null;
  if (a.id === b.id) return "id";
  if (a.permId && a.permId === b.permId) return "permId";
  if (normName(a.name) === normName(b.name)) return "name";
  return null;
}

const isActive = (c: Case) => c.status !== "Disposed";
export const pairKey = (a: string, b: string) => [a, b].sort().join("|");

/** Confidence table mirrors the rules that generated the seeded alerts, plus a small text-similarity bonus. */
function confidence(sameCat: boolean, verified: boolean, via: InstitutionMatch, textSim: number): number {
  const base = sameCat ? (verified ? 0.86 : 0.64) : verified ? 0.58 : 0.41;
  const viaPenalty = via === "id" ? 0 : via === "permId" ? -0.03 : -0.1;
  const bonus = Math.min(0.08, textSim * 0.08);
  return Math.max(0, Math.min(0.97, Math.round((base + viaPenalty + bonus) * 100) / 100));
}

export interface DetectOptions {
  /** Ignore this case id (when checking an existing case against the rest). */
  excludeId?: string;
  /** Only keep matches at or above this confidence (default 0.4). */
  minConfidence?: number;
}

export function detectOverlaps(
  draft: CaseDraft,
  cases: Case[],
  institutions: Institution[],
  opts: DetectOptions = {},
): OverlapMatch[] {
  const inst = institutions.find((i) => i.id === draft.instId);
  if (!inst) return [];
  const byId = new Map(institutions.map((i) => [i.id, i]));
  const min = opts.minConfidence ?? 0.4;
  const out: OverlapMatch[] = [];

  for (const c of cases) {
    if (c.id === opts.excludeId) continue;
    const via = institutionMatch(inst, byId.get(c.instId));
    if (!via) continue;

    const sameCategory = c.category === draft.category;
    const bothActive = isActive(c); // the draft itself is always treated as active
    // A closed case about a different subject is just history, not an overlap.
    if (!bothActive && !sameCategory) continue;

    const sim = textSimilarity(draft.summary, c.summary);
    const differentBureau = c.currentBureau !== draft.bureau;
    const verified = inst.verified && (byId.get(c.instId)?.verified ?? false);

    const reasons: string[] = [];
    reasons.push(
      via === "id" ? (verified ? "Same verified AICTE Permanent ID" : "Same institution record (Permanent ID unverified)")
        : via === "permId" ? "Different institution records share the same Permanent ID — possible duplicate record"
          : "Institution names match across different records — verify Permanent ID",
    );
    if (sameCategory) reasons.push(`Same complaint category: ${draft.category}`);
    if (sim >= 0.35) reasons.push(`Complaint text is ${Math.round(sim * 100)}% similar`);
    if (bothActive) reasons.push("Existing case is still active");
    reasons.push(differentBureau ? `Handled by different bureaus: ${draft.bureau} and ${c.currentBureau}` : `Handled within the same bureau (${c.currentBureau}) — check for duplicate`);

    const matchType: MatchType =
      sameCategory && bothActive ? "Potential Overlap"
        : sameCategory ? "Similar Complaint"
          : differentBureau ? "Coordination Required" : "Same Institution";

    const conf = confidence(sameCategory, verified, via, sim);
    if (conf < min) continue;

    out.push({ caseId: c.id, matchType, confidence: conf, reasons, institutionMatch: via, sameCategory, bothActive, differentBureau, textSimilarity: sim });
  }

  return out.sort((a, b) => b.confidence - a.confidence || a.caseId.localeCompare(b.caseId));
}

/**
 * Live check for an existing case. Matches that already have an alert (in any review
 * state, including Dismissed) are removed, so only genuinely new findings surface.
 */
export function detectForCase(c: Case, cases: Case[], institutions: Institution[], alerts: Alert[]): OverlapMatch[] {
  const alerted = new Set(alerts.map((a) => pairKey(a.caseA, a.caseB)));
  return detectOverlaps(
    { instId: c.instId, category: c.category, summary: c.summary, bureau: c.currentBureau },
    cases,
    institutions,
    { excludeId: c.id },
  ).filter((m) => !alerted.has(pairKey(c.id, m.caseId)));
}

/** Highest-priority label for a result set, for compact badges. */
export const summariseMatches = (m: OverlapMatch[]) =>
  m.length === 0 ? "No overlaps detected" : `${m.length} possible ${m.length === 1 ? "overlap" : "overlaps"} · top match ${Math.round((m[0]?.confidence ?? 0) * 100)}%`;
