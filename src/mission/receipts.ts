/**
 * §PROOF RECEIPTS — cryptographically attestable run evidence (VH 11.9.4-Redesign).
 *
 * THE DIFFERENTIATOR. Every orchestrator can *claim* a run happened. In 2026,
 * regulation and enterprise diligence demand receipts: the EU AI Act's
 * tamper-evident-logging enforcement (Art. 12, Aug 2026) and the IETF AAT/SCITT
 * receipt work all converge on hash-chained, externally verifiable action
 * logs. VH is uniquely placed to issue them, because VH never infers what it
 * can measure: exit codes, artifact branches, review-snapshot shas, costs read
 * from the CLI's own output — the receipt chains exactly those facts.
 *
 * SHAPE (JSONL-friendly, auditor-readable)
 *   header   — mission, team, started/finished, VH version, license edition
 *   events   — one per measured fact; each carries `prev` + `hash`,
 *              hash = SHA-256( canonical(prev ‖ event-without-hash) )
 *   seal     — HMAC-SHA-256 over the final chain hash with the published
 *              verification secret (same honesty posture as licensing: a soft
 *              seal, externally re-computable; hardware/Ed25519 signing is on
 *              the enterprise roadmap and the schema already has room for it)
 *
 * VERIFY needs no VH state: re-canonicalize, re-hash the chain, re-check the
 * seal. "We have logs" becomes evidence a third party can re-run.
 */
import { VERIFY_SECRET, SEAL_SECRET_BY_FORMAT } from "./licensing";
import { signChainHash, verifyIssuerSignature } from "./signing";
import type { AutonomyRunSummary } from "./autonomyRuntime";

export interface ReceiptEvent {
  seq: number;
  ts: string;
  kind: string;
  seatId: string | null;
  data: Record<string, unknown>;
  prev: string;
  hash: string;
}

export interface ProofReceipt {
  /**
   * si-proof-receipt/2 (16.1.0): the SelfImpulse proof standard — chain + seal, plus `issuer`/`signature` — an Ed25519
   * signature over the final chain hash, verifiable with the exported public key alone.
   * verifyProofReceipt accepts BOTH formats: v1 receipts stay verifiable forever.
   */
  format: "si-proof-receipt/2" | "mj-proof-receipt/2" | "mj-proof-receipt/1";
  header: {
    mission: string;
    teamId: string;
    startedAt: string;
    finishedAt: string;
    mjVersion: string;
    edition: string;
    autonomyArms: string[];
  };
  events: ReceiptEvent[];
  seal: string;
  /**
   * C2 FIX (audit 2026-09-30) — the algorithm the seal/signature cover.
   *
   * `"si-seal/2"` means the signed material is
   *   sha256("si-seal/2" ‖ finalChainHash ‖ headerHash)
   * i.e. the HEADER IS INSIDE THE SIGNED MATERIAL. Before this, the chain covered
   * only `events[]`, so `header.mission`, `header.edition`, `header.autonomyArms`
   * and `header.finishedAt` could be rewritten freely and the receipt still
   * verified — an audit trail that named the wrong strategy or the wrong mission.
   *
   * Absent means a receipt minted before the fix. Those cannot prove their header
   * was not altered, so `verifyProofReceipt` reports exactly that instead of
   * accepting them (see the legacy-reason branch there).
   */
  sealAlgo?: "si-seal/2";
  /** sha256(canon(header)) — what `sealAlgo: "si-seal/2"` binds. */
  headerHash?: string;
  /** 11.10.1 — issuer identity; null when the runtime could not sign (see signatureNote). */
  issuer?: { keyId: string; publicKeyHex: string } | null;
  /** Hex Ed25519 signature over the SEALED MATERIAL (chain head ‖ header hash); null when unsigned. */
  signature?: string | null;
  /** Present exactly when signature is null: what happened, honestly. */
  signatureNote?: string;
}

const enc = new TextEncoder();
/** Deterministic canonical form: object keys sorted RECURSIVELY (the array
 *  replacer of JSON.stringify drops nested keys not in the list — that would
 *  make receipts blind to data tampering, which is the whole point). */
function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = sortDeep((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}
const canon = (o: unknown): string => JSON.stringify(sortDeep(o));

async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(s: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(s));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * C2 FIX — what the seal and the issuer signature actually cover.
 *
 * The chain head alone proves the EVENTS were not edited. It says nothing about
 * `header`, which carries the mission name, the edition, the finished timestamp
 * and `autonomyArms` — the record of which strategy arms ran. Binding the header
 * hash into the same digest is what makes "this receipt describes this mission"
 * a cryptographic claim instead of a formatting convention.
 */
const SEAL_ALGO = "si-seal/2" as const;

async function headerHashOf(header: ProofReceipt["header"]): Promise<string> {
  return sha256hex(canon(header));
}

/** The material the seal and the issuer signature are computed over. */
async function sealedMaterial(chainHead: string, headerHash: string): Promise<string> {
  return sha256hex(`${SEAL_ALGO}|${chainHead}|${headerHash}`);
}

/** Build a receipt from the SAME measured summary the autonomy settlement consumes. */
export async function buildProofReceipt(args: {
  mission: string;
  teamId: string;
  startedAt: string;
  finishedAt: string;
  mjVersion: string;
  edition: string;
  report: AutonomyRunSummary;
}): Promise<ProofReceipt> {
  const { report } = args;
  // 11.10.1 — when the summary names a seat's harness, the event carries the seat's
  // IDENTITY DIGEST (sha256 of seat|role|harness): a deterministic, chain-bound binding
  // of "which agent, in which role, under which harness" into the evidence.
  const seatEvents: Array<{ kind: string; seatId: string | null; data: Record<string, unknown> }> = [];
  for (const s of report.seats) {
    const data: Record<string, unknown> = { role: s.role, outcome: s.outcome, verified: s.verified };
    if (s.harness) {
      data.harness = s.harness;
      data.identity = await sha256hex(`${s.seatId}|${s.role}|${s.harness}`);
    }
    seatEvents.push({ kind: "seat.outcome", seatId: s.seatId, data });
  }
  const raw: Array<{ kind: string; seatId: string | null; data: Record<string, unknown> }> = [
    { kind: "mission.status", seatId: null, data: { status: report.status, reviewedBySnapshot: report.reviewedBySnapshot === true } },
    ...seatEvents,
    { kind: "mission.verdict", seatId: null, data: { verified: report.seats.some((s) => s.verified), arms: report.autonomyArms ?? [] } },
  ];
  // 11.9.9 — the adversarial-gate verdict becomes part of the chain when (and only when)
  // the run was gated. Keeping it conditional means pre-11.9.9 summaries produce exactly
  // the event sequence they always did (probe/receipts.test.ts pins that shape).
  if (report.gateStatus !== undefined) {
    raw.push({
      kind: "gate.verdict",
      seatId: null,
      data: {
        status: report.gateStatus,
        tier: report.gateTier ?? "n/a",
        // 11.10 — the writer→snapshot→verifier evidence link, in the chain itself.
        snapshotSha: report.gateSnapshotSha ?? null,
      },
    });
  }
  // 11.14.8 — the governance-arena preflight joins the chain when (and only when)
  // the run was admitted through the arena: the receipt then proves not just that
  // the work was verified, but that VH's own hostile battery PASSED before any
  // seat was invoked — digest + refusal evidence, in the sealed chain.
  if (report.arenaGate) {
    raw.push({
      kind: "arena.gate",
      seatId: null,
      data: {
        gate: report.arenaGate.gate,
        digest: report.arenaGate.digest,
        defended: report.arenaGate.defended,
        total: report.arenaGate.total,
        summary: report.arenaGate.summary,
      },
    });
  }

  const events: ReceiptEvent[] = [];
  let prev = "0".repeat(64);
  let seq = 0;
  for (const r of raw) {
    const ts = new Date().toISOString();
    const body = { seq, ts, kind: r.kind, seatId: r.seatId, data: r.data, prev };
    const hash = await sha256hex(canon(body));
    events.push({ ...body, hash });
    prev = hash;
    seq += 1;
  }

  const header = {
    mission: args.mission,
    teamId: args.teamId,
    startedAt: args.startedAt,
    finishedAt: args.finishedAt,
    mjVersion: args.mjVersion,
    edition: args.edition,
    autonomyArms: report.autonomyArms ?? [],
  };
  /* C2 FIX — the header is inside the signed material, not merely alongside it. */
  const headerHash = await headerHashOf(header);
  const material = await sealedMaterial(prev, headerHash);
  const seal = await hmacHex(material, VERIFY_SECRET);
  // 11.10.1 — ISSUER SIGNATURE over the sealed material (chain head ‖ header hash).
  // When the runtime cannot sign (no Ed25519), the receipt stays tamper-evident via
  // the seal and says so plainly — a null signature is an honest state, never a
  // silent one. C3 FIX: that state is no longer ACCEPTED as proof; see
  // verifyProofReceipt, which refuses an unsigned si-proof-receipt/2 outright.
  const sig = await signChainHash(material);
  if (sig) {
    return {
      format: "si-proof-receipt/2",
      header,
      events,
      seal,
      sealAlgo: SEAL_ALGO,
      headerHash,
      issuer: { keyId: sig.keyId, publicKeyHex: sig.publicKeyHex },
      signature: sig.sigHex,
    };
  }
  return {
    format: "si-proof-receipt/2",
    header,
    events,
    seal,
    sealAlgo: SEAL_ALGO,
    headerHash,
    issuer: null,
    signature: null,
    signatureNote: "This runtime has no Ed25519 (WebCrypto refused or is absent). The receipt is tamper-evident via its HMAC seal but NOT issuer-signed, so it verifies as seal-only evidence and is refused wherever issuer proof is required.",
  };
}

/**
 * External verification: no VH state, just the receipt and public constants.
 * Accepts the current si-proof-receipt/2 and the legacy mj-proof-receipt/1|2 — older receipts verify exactly as
 * before; v2 adds the issuer-signature check when a signature is present. A null
 * signature with an accompanying signatureNote is HONEST (no Ed25519 in the runtime)
 * and is not a failure — the seal still attests tamper-evidence.
 */
export async function verifyProofReceipt(rc: ProofReceipt): Promise<{ ok: true; events: number; assurance: "issuer-signed" | "seal-only" } | { ok: false; reason: string }> {
  if (rc.format !== "si-proof-receipt/2" && rc.format !== "mj-proof-receipt/2" && rc.format !== "mj-proof-receipt/1") return { ok: false, reason: "unknown format" };
  let prev = "0".repeat(64);
  for (const e of rc.events) {
    if (e.prev !== prev) return { ok: false, reason: `chain broken at seq ${e.seq}` };
    const { hash, ...body } = e;
    const expect = await sha256hex(canon(body));
    if (expect !== hash) return { ok: false, reason: `hash mismatch at seq ${e.seq}` };
    prev = hash;
  }

  /* C2 FIX — the header is inside the sealed material, or this is not proof.
   *
   * The chain above covers `events[]` only. `header.mission`, `header.edition`,
   * `header.autonomyArms` and `header.finishedAt` live outside it, so before this
   * fix an attacker rewrote any of them and the receipt still returned ok:true.
   * A receipt that does not declare the binding cannot prove its header is
   * unaltered, so it is refused BY NAME rather than accepted on trust. */
  const isModern = rc.format === "si-proof-receipt/2";
  let material = prev;
  if (rc.sealAlgo !== undefined || isModern) {
    if (rc.sealAlgo !== SEAL_ALGO) {
      return { ok: false, reason: `receipt carries no "${SEAL_ALGO}" header binding — its header (mission, edition, autonomyArms, finishedAt) is outside the signed material and cannot be shown unaltered` };
    }
    if (!rc.headerHash) return { ok: false, reason: "receipt declares a header binding but carries no header hash" };
    const expectHeader = await headerHashOf(rc.header);
    if (expectHeader !== rc.headerHash) return { ok: false, reason: "header hash mismatch — the header was altered after the receipt was sealed" };
    material = await sealedMaterial(prev, rc.headerHash);
  }

  const sealSecret = SEAL_SECRET_BY_FORMAT[rc.format as keyof typeof SEAL_SECRET_BY_FORMAT] ?? VERIFY_SECRET;
  const seal = await hmacHex(material, sealSecret);
  if (seal !== rc.seal) return { ok: false, reason: "seal mismatch" };

  /* C3 FIX — a signature is REQUIRED for the current format.
   *
   * The check used to sit inside `&& rc.signature`, so deleting the signature
   * turned a signed receipt into an accepted one. Combined with the published
   * HMAC secret (see licensing.ts) that made unsigned forgeries verify as valid.
   * The seal secret is public by design, so the signature is the ONLY part of a
   * si-proof-receipt/2 that a third party cannot recompute — it is not optional.
   * The legacy mj-proof-receipt/1|2 formats keep their historical semantics so
   * receipts already issued under them stay verifiable forever. */
  if (isModern) {
    if (!rc.signature) {
      return { ok: false, reason: "unsigned si-proof-receipt/2 — the seal uses a published secret, so without an issuer signature this receipt is tamper-EVIDENT only, not proof" };
    }
    if (!rc.issuer?.publicKeyHex) return { ok: false, reason: "receipt is signed but carries no issuer public key" };
    const ok = await verifyIssuerSignature(material, rc.signature, rc.issuer.publicKeyHex);
    if (!ok) return { ok: false, reason: `issuer signature verification FAILED for sealed material ${material}` };
    return { ok: true, events: rc.events.length, assurance: "issuer-signed" };
  }

  if ((rc.format === "mj-proof-receipt/2") && rc.signature) {
    if (!rc.issuer?.publicKeyHex) return { ok: false, reason: "receipt is signed but carries no issuer public key" };
    const ok = await verifyIssuerSignature(prev, rc.signature, rc.issuer.publicKeyHex);
    if (!ok) return { ok: false, reason: `issuer signature verification FAILED for chain head ${prev}` };
  }
  return { ok: true, events: rc.events.length, assurance: rc.signature ? "issuer-signed" : "seal-only" };
}

/**
 * VH 15.0.0 — the generic chained-receipt builder. The Mission Loop path keeps
 * `buildProofReceipt` (summary-driven, probe-pinned); the Teammate door mints
 * receipts from an explicit event list instead — same shape, same chain, same
 * seal, same honest null-signature posture. One protocol, two minters.
 */
export async function buildChainedReceipt(args: {
  mission: string;
  teamId: string;
  startedAt: string;
  finishedAt: string;
  mjVersion: string;
  edition: string;
  events: Array<{ kind: string; seatId: string | null; data: Record<string, unknown> }>;
}): Promise<ProofReceipt> {
  const events: ReceiptEvent[] = [];
  let prev = "0".repeat(64);
  let seq = 0;
  for (const r of args.events) {
    const ts = new Date().toISOString();
    const body = { seq, ts, kind: r.kind, seatId: r.seatId, data: r.data, prev };
    const hash = await sha256hex(canon(body));
    events.push({ ...body, hash });
    prev = hash;
    seq += 1;
  }

  const header = {
    mission: args.mission,
    teamId: args.teamId,
    startedAt: args.startedAt,
    finishedAt: args.finishedAt,
    mjVersion: args.mjVersion,
    edition: args.edition,
    autonomyArms: [] as string[],
  };
  /* C2 FIX — same binding as buildProofReceipt, because a second minter with a
   * weaker shape would be the weakest link in a two-minter protocol. */
  const headerHash = await headerHashOf(header);
  const material = await sealedMaterial(prev, headerHash);
  const seal = await hmacHex(material, VERIFY_SECRET);
  // Same honesty posture as buildProofReceipt: a null signature says so, plainly.
  const sig = await signChainHash(material);
  if (sig) {
    return {
      format: "si-proof-receipt/2",
      header,
      events,
      seal,
      sealAlgo: SEAL_ALGO,
      headerHash,
      issuer: { keyId: sig.keyId, publicKeyHex: sig.publicKeyHex },
      signature: sig.sigHex,
    };
  }
  return {
    format: "si-proof-receipt/2",
    header,
    events,
    seal,
    sealAlgo: SEAL_ALGO,
    headerHash,
    issuer: null,
    signature: null,
    signatureNote: "This runtime has no Ed25519 (WebCrypto refused or is absent). The receipt is tamper-evident via its HMAC seal but NOT issuer-signed, so it verifies as seal-only evidence and is refused wherever issuer proof is required.",
  };
}

/** JSONL export — human-readable, SIEM-ingestible, chain-preserving (IETF AAT guidance). */
export function receiptToJsonl(rc: ProofReceipt): string {
  const head: Record<string, unknown> = { receipt: rc.header, format: rc.format, seal: rc.seal };
  /* C2 FIX — the binding fields are part of the proof, so they must survive the
   * round trip. Dropping them here silently demoted an exported receipt to
   * unverifiable; probe/signing catches exactly that. */
  if (rc.sealAlgo !== undefined) head.sealAlgo = rc.sealAlgo;
  if (rc.headerHash !== undefined) head.headerHash = rc.headerHash;
  if (rc.issuer !== undefined) head.issuer = rc.issuer;
  if (rc.signature !== undefined) head.signature = rc.signature;
  if (rc.signatureNote !== undefined) head.signatureNote = rc.signatureNote;
  const lines = [JSON.stringify(head), ...rc.events.map((e) => JSON.stringify(e))];
  return `${lines.join("\n")}\n`;
}

export function receiptFromJsonl(text: string): ProofReceipt | null {
  try {
    const lines = text.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as unknown);
    if (lines.length < 1) return null;
    const head = lines[0] as {
      receipt?: ProofReceipt["header"];
      format?: string;
      seal?: string;
      sealAlgo?: ProofReceipt["sealAlgo"];
      headerHash?: ProofReceipt["headerHash"];
      issuer?: ProofReceipt["issuer"];
      signature?: ProofReceipt["signature"];
      signatureNote?: ProofReceipt["signatureNote"];
    };
    if (!head.receipt || !head.seal) return null;
    const out: ProofReceipt = {
      format: (head.format as ProofReceipt["format"]) ?? "mj-proof-receipt/1",
      header: head.receipt,
      events: lines.slice(1) as ReceiptEvent[],
      seal: head.seal,
    };
    if (head.sealAlgo !== undefined) out.sealAlgo = head.sealAlgo;
    if (head.headerHash !== undefined) out.headerHash = head.headerHash;
    if (head.issuer !== undefined) out.issuer = head.issuer;
    if (head.signature !== undefined) out.signature = head.signature;
    if (head.signatureNote !== undefined) out.signatureNote = head.signatureNote;
    return out;
  } catch {
    return null;
  }
}
