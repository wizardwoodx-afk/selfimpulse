/**
 * §PROOF — cryptographically attestable work evidence (SelfImpulse 1.0).
 *
 * THE DIFFERENTIATOR. Every agent can *claim* a job happened. SelfImpulse issues
 * receipts instead: tamper-evident, signed, independently verifiable.
 * "Every job selfimpulseed" — the claim is checkable by anyone, with zero SelfImpulse
 * state: re-canonicalize, re-hash the chain, re-check the seal.
 *
 * PROTOCOL — `si-proof-receipt/2`, the SelfImpulse proof standard (16.1.0):
 * the legacy wire ("mj-proof-receipt/1|2") still verifies — one open verifier covers all receipts):
 *   format   — "si-proof-receipt/2" (legacy "mj-proof-receipt/1|2" receipts still verify)
 *   header   — mission, team, started/finished, version (issuing product),
 *              edition, autonomyArms (empty for standalone SelfImpulse)
 *   events   — one per measured fact; each carries `prev` + `hash`,
 *              hash = SHA-256( canonical(prev ‖ event-without-hash) )
 *   seal     — HMAC-SHA-256 over the final chain hash with the shared
 *              verification secret (soft seal, externally re-computable)
 *   issuer   — Ed25519 signature over the final chain hash where the runtime
 *              can sign; null + an honest note when it cannot.
 *
 * VERIFICATION — `node tools/verify-receipt.mjs receipt.jsonl` (zero
 * dependencies). The header's `version` field carries the ISSUING product's
 * version (the SelfImpulse product line stamps here) — the
 * verifier treats the header as opaque, so both products verify identically.
 */
import { signChainHash, verifyIssuerSignature } from "./signing";

/**
 * Shared verification secret — IDENTICAL across the product (src/mission/licensing.ts
 * is the same constant the execution core uses). One secret by design: the seal is a
 * soft, re-computable tamper-evidence layer, and one secret is what lets the
 * same zero-dependency verifier check receipts from either product.
 */
export const VERIFY_SECRET = "si-commercial-v1-offline";
/* Legacy wire secret — receipts sealed before 16.1.0 (formats mj-proof-receipt/1|2).
   NEVER rename: already-issued receipts must stay verifiable forever. */
export const LEGACY_SEAL_SECRET = "mj-commercial-v1-offline";
/* Each wire format is sealed with the constant published when that wire shipped. */
const SEAL_SECRET_BY_FORMAT = {
  "si-proof-receipt/2": VERIFY_SECRET,
  "mj-proof-receipt/2": LEGACY_SEAL_SECRET,
  "mj-proof-receipt/1": LEGACY_SEAL_SECRET,
} as const;

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
   * si-proof-receipt/2: chain + seal, plus `issuer`/`signature` — an
   * Ed25519 signature over the final chain hash, verifiable with the exported
   * public key alone. verifyProofReceipt accepts BOTH formats: v1 receipts
   * stay verifiable forever.
   */
  format: "si-proof-receipt/2" | "mj-proof-receipt/2" | "mj-proof-receipt/1";
  header: {
    mission: string;
    teamId: string;
    startedAt: string;
    finishedAt: string;
    /** Issuing product's version (SelfImpulse 1.x standalone; the SelfImpulse product line, 16.x, after the merge). */
    version: string;
    edition: string;
    autonomyArms: string[];
  };
  events: ReceiptEvent[];
  seal: string;
  /** C2 (audit 2026-09-30): "si-seal/2" = the seal/signature ALSO cover sha256(canon(header)),
   *  so the header is inside the signed material instead of merely beside it. */
  sealAlgo?: "si-seal/2";
  headerHash?: string;
  /** Issuer identity; null when the runtime could not sign (see signatureNote). */
  issuer?: { keyId: string; publicKeyHex: string } | null;
  /** Hex Ed25519 signature over the SEALED MATERIAL; null when unsigned. */
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

const SEAL_ALGO = "si-seal/2" as const;

async function headerHashOf(header: ProofReceipt["header"]): Promise<string> {
  return sha256hex(canon(header));
}

async function sealedMaterial(chainHead: string, headerHash: string): Promise<string> {
  return sha256hex(`${SEAL_ALGO}|${chainHead}|${headerHash}`);
}

async function hmacHex(s: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(s));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The chained-receipt builder: an explicit event list → chain → seal →
 * issuer signature (or an honest null). Same shape as the execution core's minter.
 */
export async function buildChainedReceipt(args: {
  mission: string;
  teamId: string;
  startedAt: string;
  finishedAt: string;
  version: string;
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
    version: args.version,
    edition: args.edition,
    autonomyArms: [] as string[],
  };
  /* C2 (audit 2026-09-30) — the header rides INSIDE the sealed material. The two
   * implementations of this wire must agree byte for byte, or receipts minted by
   * one fail in the other's verifier. */
  const headerHash = await headerHashOf(header);
  const material = await sealedMaterial(prev, headerHash);
  const seal = await hmacHex(material, VERIFY_SECRET);
  // A null signature says so, plainly — tamper-evidence never claims signing
  // it cannot prove.
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
 * External verification: no SelfImpulse state, just the receipt and public
 * constants. Accepts ALL three wire formats — legacy mj-proof-receipt/1|2
 * receipts verify exactly as before (chain + seal), and any receipt that
 * claims an issuer signature has it verified, regardless of format name.
 */
export async function verifyProofReceipt(rc: ProofReceipt): Promise<{ ok: true; events: number; assurance: "issuer-signed" | "seal-only" } | { ok: false; reason: string }> {
  const sealSecret = SEAL_SECRET_BY_FORMAT[rc.format as keyof typeof SEAL_SECRET_BY_FORMAT];
  if (!sealSecret) return { ok: false, reason: `unknown format ${rc.format}` };
  let prev = "0".repeat(64);
  for (const e of rc.events) {
    if (e.prev !== prev) return { ok: false, reason: `chain broken at seq ${e.seq}` };
    const { hash, ...body } = e;
    const expect = await sha256hex(canon(body));
    if (expect !== hash) return { ok: false, reason: `hash mismatch at seq ${e.seq}` };
    prev = hash;
  }

  /* C2 (audit 2026-09-30) — the chain above covers events[] only; the header is
   * bound separately and must be present and matching for the current format. */
  const isModern = rc.format === "si-proof-receipt/2";
  let material = prev;
  if (rc.sealAlgo !== undefined || isModern) {
    if (rc.sealAlgo !== SEAL_ALGO) {
      return { ok: false, reason: `receipt carries no "${SEAL_ALGO}" header binding — its header is outside the signed material` };
    }
    if (!rc.headerHash) return { ok: false, reason: "receipt declares a header binding but carries no header hash" };
    if ((await headerHashOf(rc.header)) !== rc.headerHash) {
      return { ok: false, reason: "header hash mismatch — the header was altered after the receipt was sealed" };
    }
    material = await sealedMaterial(prev, rc.headerHash);
  }

  const seal = await hmacHex(material, sealSecret);
  if (seal !== rc.seal) return { ok: false, reason: "seal mismatch" };

  /* A claimed signature is always verified. This previously gated on
     "mj-proof-receipt/2" — a legacy format this module stopped minting in
     16.1.0 — so every current "si-proof-receipt/2" receipt silently skipped
     issuer verification. The check could no longer fail, which is worse than
     not having it. C3 (audit 2026-09-30) adds the other half: for the current
     format the signature is REQUIRED, because the seal secret is published. */
  if (isModern) {
    if (!rc.signature) {
      return { ok: false, reason: "unsigned si-proof-receipt/2 — the seal uses a published secret, so without an issuer signature this receipt is tamper-EVIDENT only, not proof" };
    }
    if (!rc.issuer?.publicKeyHex) return { ok: false, reason: "receipt is signed but carries no issuer public key" };
    const ok = await verifyIssuerSignature(material, rc.signature, rc.issuer.publicKeyHex);
    if (!ok) return { ok: false, reason: `issuer signature verification FAILED for sealed material ${material}` };
    return { ok: true, events: rc.events.length, assurance: "issuer-signed" };
  }

  if (rc.signature) {
    if (!rc.issuer?.publicKeyHex) return { ok: false, reason: "receipt is signed but carries no issuer public key" };
    const ok = await verifyIssuerSignature(prev, rc.signature, rc.issuer.publicKeyHex);
    if (!ok) return { ok: false, reason: `issuer signature verification FAILED for chain head ${prev}` };
  } else if (rc.format !== "mj-proof-receipt/1" && !rc.signatureNote) {
    return { ok: false, reason: "receipt is neither signed nor carries a signatureNote explaining why not" };
  }
  return { ok: true, events: rc.events.length, assurance: rc.signature ? "issuer-signed" : "seal-only" };
}

/** JSONL export — human-readable, SIEM-ingestible, chain-preserving (IETF AAT guidance). */
export function receiptToJsonl(rc: ProofReceipt): string {
  const head: Record<string, unknown> = { receipt: rc.header, format: rc.format, seal: rc.seal };
  /* C2 — the binding fields are part of the proof; dropping them on export
   * demotes a receipt to unverifiable (and the CLI refuses it, correctly). */
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
