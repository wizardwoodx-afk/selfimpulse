/**
 * VH-19 — the Captain layer (19.0.0 as AgentLead; renamed Captain in 19.1.0 "Shipyard").
 *
 * Specialists within a domain are not a flat crowd: each of the ten domains
 * has a Captain — a named oversight role that (a) plans domain work
 * across its members, (b) aggregates what actually happened, and (c)
 * reports DIRECTLY to the Generalist in a structured, honest report. The
 * lead never fabricates member outcomes: its report is computed from the
 * real pipeline results, and it is part of the provenance-digested
 * response. A lead is an orchestrator over states — like the goal engine,
 * it calls no provider and invents nothing.
 */
import type { CaptainReport, SpecialistCategory } from "./types";
import { getSpecialist, specialistsForCategory } from "./registry";

export interface Captain {
  id: string;
  name: string;
  domain: SpecialistCategory;
  /** What this lead is accountable for, in one sentence. */
  mandate: string;
  /** The lead's own playbook, composed into oversight prompts. */
  systemPrompt: string;
}

const captain = (domain: SpecialistCategory, name: string, mandate: string, focus: string): Captain => ({
  id: `captain.${domain}`,
  name,
  domain,
  mandate,
  systemPrompt: `You are ${name}, captain of the ${domain} domain. Your members are the ${domain} specialists on the bench. ${focus} Report only what actually happened: name the members involved, their real outcomes, and the single next step. Never claim work that did not run.`,
});

export const CAPTAINS: Captain[] = [
  captain("code", "Captain of Code", "Owns implementation quality end to end.", "Sequence work so foundations land before dependents; pair every implementation step with its test and review path."),
  captain("security", "Captain of Security", "Owns the trust boundary of every plan.", "Nothing ships without its threat reviewed; escalate anything touching credentials, egress or autonomy immediately."),
  captain("testing", "Captain of Testing", "Owns the evidence that work is correct.", "Every claimed fix needs a failing-then-passing test; quarantine flake with an owner, never with a retry."),
  captain("review", "Captain of Review", "Owns the quality gate before merge.", "Weight review effort by blast radius; no approval without the residual risks named."),
  captain("data", "Captain of Data", "Owns data trust: lineage, quality, privacy.", "Every number names its source and freshness; destructive data steps are reversible or flagged."),
  captain("devops", "Captain of DevOps", "Owns delivery and operability.", "Every change states its blast radius and rollback before it runs; recovery is rehearsed, not hoped for."),
  captain("research", "Captain of Research", "Owns evidence quality behind decisions.", "Load-bearing claims need two independent sources or an honest single-sourced label."),
  captain("writing", "Captain of Writing", "Owns clarity of everything shipped to readers.", "Lead with the answer; every command in docs runs as written or is flagged."),
  captain("analysis", "Captain of Analysis", "Owns the honesty of numbers in decisions.", "Assumptions are visible before results; ranges over false point estimates."),
  captain("design", "Captain of Design", "Owns the product's visible quality bar.", "Refuse the generic look; hierarchy works in greyscale first; every state is designed, including the worst one."),
  captain("product", "Captain of Product", "Owns the problem definition behind every build.", "The problem statement ships before the solution; every order names the user outcome it serves."),
  captain("business", "Captain of Business", "Owns the honesty of plans and numbers.", "Every projection lists its assumptions and its error range; a plan without a kill criterion is decoration."),
  captain("legal", "Captain of Legal", "Owns obligations, consent and liability clarity.", "Obligations map to controls with evidence; never assure what the product cannot verify."),
  captain("comms", "Captain of Comms", "Owns what we say, when, and to whom.", "Known, unknown, next — on a clock; corrections are appended, never erased."),
];

export function getCaptain(id: string): Captain | null {
  return CAPTAINS.find((l) => l.id === id) ?? null;
}

export function captainForDomain(domain: SpecialistCategory): Captain | null {
  return CAPTAINS.find((l) => l.domain === domain) ?? null;
}

/** The lead accountable for a routed set: the domain with the most members routed (ties → first routed). */
export function captainForRoute(specialistIds: string[]): Captain | null {
  const counts = new Map<SpecialistCategory, number>();
  let firstCat: SpecialistCategory | null = null;
  for (const id of specialistIds) {
    const s = getSpecialist(id);
    if (!s) continue;
    if (firstCat === null) firstCat = s.category;
    counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  }
  if (firstCat === null) return null;
  let best = firstCat;
  let bestN = -1;
  for (const [cat, n] of counts) if (n > bestN) { best = cat; bestN = n; }
  return captainForDomain(best);
}

/**
 * The lead's work plan for a task: the domain members whose routing
 * vocabulary best matches the task text, capped at 3 — a plan, not a
 * wishlist. Pure keyword scoring; the router remains the authority for
 * actual routing.
 */
export function planDomainWork(captainId: string, task: string, cap = 3): { specialistId: string; name: string; score: number }[] {
  const l = getCaptain(captainId);
  if (!l) return [];
  const tokens = new Set(task.toLowerCase().split(/[^a-z0-9+#.]+/).filter((t) => t.length > 2));
  return specialistsForCategory(l.domain)
    .map((s) => ({
      specialistId: s.id,
      name: s.name,
      score: s.keywords.reduce((n, k) => n + (tokens.has(k.toLowerCase()) ? 1 : 0), 0),
    }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.specialistId.localeCompare(b.specialistId))
    .slice(0, cap);
}

/**
 * The lead's report to the Generalist — computed from REAL member results,
 * never asserted. Status logic mirrors the goal truthfulness contract:
 * "completed" requires every involved member actually executed.
 */
export function buildCaptainReport(
  captainId: string,
  results: { specialistId: string; outcome: string; note?: string; memberDigest?: string }[],
): CaptainReport | null {
  const l = getCaptain(captainId);
  if (!l || results.length === 0) return null;
  const done = results.filter((r) => r.outcome === "answered" || r.outcome === "peer-delegated").length;
  const status: CaptainReport["status"] =
    done === results.length ? "completed"
    : done > 0 ? "partial"
    : results.some((r) => r.outcome === "refused" || r.outcome === "gated-out") ? "blocked"
    : results.every((r) => r.outcome === "planned") ? "planned"
    : "blocked";
  const members = results.map((r) => ({
    specialistId: r.specialistId,
    name: getSpecialist(r.specialistId)?.name ?? r.specialistId,
    outcome: r.outcome,
    note: r.note,
    memberDigest: r.memberDigest,
  }));
  const failures = results.filter((r) => r.outcome !== "answered" && r.outcome !== "peer-delegated")
    .map((r) => `${getSpecialist(r.specialistId)?.name ?? r.specialistId}: ${r.outcome}${r.note ? ` — ${r.note.slice(0, 80)}` : ""}`);
  const summary =
    status === "completed" ? `All ${done} routed ${l.domain} member(s) executed; work is done end to end.`
    : status === "partial" ? `${done} of ${results.length} routed member(s) executed; the rest did not run — see failures.`
    : status === "planned" ? `No member executed (no provider); the ${l.domain} plan is ready to run when a key exists.`
    : `Nothing executed in the ${l.domain} domain; progress stopped at the gate or a refusal.`;
  const nextStep =
    status === "completed" ? "None — accept or reject the work in the log."
    : status === "planned" ? "Add a provider key and re-run the plan."
    : status === "partial" ? "Re-run only the failed members; the executed ones keep their receipts."
    : "Resolve the blocking decision at the gate, then resume.";
  return { captainId: l.id, captainName: l.name, domain: l.domain, status, summary, members, failures, nextStep };
}
