/**
 * VH-19 — accept/reject learning memory (18.0.0).
 *
 * The learning payload is the user's REAL behavior: what they accepted and
 * why, what they rejected and why. Storage is local-first (per-user,
 * on-device, always on) in the same webview-local store the rest of the
 * engine uses; probes shim it.
 *
 * Cloud vector sync is OPT-IN ONLY by design. In 18.0.0 the honest state of
 * the cloud path is "not configured, nothing is sent" — `requestCloudSync`
 * refuses in words rather than pretending to synchronize. A fake sync would
 * poison exactly the trust this layer exists to build.
 */
import { uid, nowIso } from "../app/id";
import type { DecisionRecord, PatternReport } from "./types";

const KEY = "vh19.memory.v1";
const CLOUD_KEY = "vh19.cloudsync.v1";
export const MEMORY_CAP = 500;

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadMemory(userId = "default"): DecisionRecord[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = JSON.parse(s.getItem(KEY) ?? "[]") as DecisionRecord[];
    return Array.isArray(raw) ? raw.filter((r) => r && r.userId === userId) : [];
  } catch {
    return [];
  }
}

function saveAll(records: DecisionRecord[]): void {
  const s = storage();
  if (!s) return;
  // The cap protects the store; the OLDEST records give way, corrections last.
  const capped = records.length > MEMORY_CAP ? records.slice(records.length - MEMORY_CAP) : records;
  s.setItem(KEY, JSON.stringify(capped));
}

export function recordDecision(input: Omit<DecisionRecord, "id" | "ts"> & { ts?: string }): DecisionRecord {
  const rec: DecisionRecord = { id: uid("dec"), ts: input.ts ?? nowIso(), ...input };
  const s = storage();
  const all: DecisionRecord[] = s ? (JSON.parse(s.getItem(KEY) ?? "[]") as DecisionRecord[]) : [];
  all.push(rec);
  saveAll(all);
  return rec;
}

export function clearMemory(userId = "default"): void {
  const s = storage();
  if (!s) return;
  const all = JSON.parse(s.getItem(KEY) ?? "[]") as DecisionRecord[];
  saveAll(all.filter((r) => r.userId !== userId));
}

/** What the agent has learned so far — the payload behind exam questions and briefings. */
export function patternReport(userId = "default"): PatternReport {
  const mem = loadMemory(userId);
  const accepts = mem.filter((r) => r.kind === "accept").length;
  const rejects = mem.filter((r) => r.kind === "reject").length;
  const corrections = mem.filter((r) => r.kind === "correction").length;

  const perSpecialist = new Map<string, { accepts: number; rejects: number }>();
  for (const r of mem) {
    if (!r.specialistId) continue;
    const e = perSpecialist.get(r.specialistId) ?? { accepts: 0, rejects: 0 };
    if (r.kind === "accept") e.accepts += 1;
    if (r.kind === "reject") e.rejects += 1;
    perSpecialist.set(r.specialistId, e);
  }
  const bySpecialist = Array.from(perSpecialist.entries())
    .map(([id, e]) => ({ id, ...e, rate: e.accepts + e.rejects === 0 ? 0 : e.accepts / (e.accepts + e.rejects) }))
    .sort((a, b) => b.accepts + b.rejects - (a.accepts + a.rejects));

  return {
    total: mem.length,
    accepts,
    rejects,
    corrections,
    acceptanceRate: accepts + rejects === 0 ? 0 : accepts / (accepts + rejects),
    bySpecialist,
    recentRejections: mem.filter((r) => r.kind === "reject").slice(-5),
  };
}

/** Compact, honest briefing lines for a specialist about this user's preferences. */
export function memoryBriefing(userId = "default", maxLines = 4): string[] {
  const p = patternReport(userId);
  const lines: string[] = [];
  if (p.total === 0) return ["No decision history yet for this user — do not assume preferences."];
  lines.push(`User decision history: ${p.accepts} accepted, ${p.rejects} rejected, ${p.corrections} corrections (acceptance ${(p.acceptanceRate * 100).toFixed(0)}%).`);
  for (const r of p.recentRejections.slice(-maxLines)) {
    lines.push(`Rejected before: "${r.scenario.slice(0, 80)}" — ${r.reason ? `reason: ${r.reason.slice(0, 120)}` : "no reason stated"}.`);
  }
  return lines;
}

/* ── cloud sync: opt-in, and honest about its 18.0.0 state ────────────────── */

export interface CloudSyncState {
  optedIn: boolean;
  endpoint: string | null;
  /** The truthful operational state — the local ledger is the source of truth. */
  operational: false;
  note: string;
}

export function cloudSyncStatus(): CloudSyncState {
  const s = storage();
  let optedIn = false;
  let endpoint: string | null = null;
  if (s) {
    try {
      const raw = JSON.parse(s.getItem(CLOUD_KEY) ?? "null") as { optedIn?: boolean; endpoint?: string | null } | null;
      optedIn = raw?.optedIn === true;
      endpoint = raw?.endpoint ?? null;
    } catch {
      /* a corrupt opt-in record is treated as opted-out — the safe direction */
    }
  }
  return {
    optedIn,
    endpoint,
    operational: false,
    note: optedIn
      ? "Opt-in recorded, but cloud sync does not ship in 18.0.0 — nothing has left this device."
      : "Cloud sync is opt-in and not enabled. The local ledger is the only store.",
  };
}

export function setCloudOptIn(optedIn: boolean, endpoint: string | null = null): CloudSyncState {
  const s = storage();
  if (s) s.setItem(CLOUD_KEY, JSON.stringify({ optedIn, endpoint }));
  return cloudSyncStatus();
}

/** The refusal is the feature: this layer never pretends to sync. */
export function requestCloudSync(): { ok: false; error: string } {
  return {
    ok: false,
    error: "cloud vector sync is not operational in 18.0.0 — the opt-in is recorded but nothing was sent; the local ledger remains the source of truth",
  };
}
