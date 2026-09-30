/**
 * proofLayerIntegrity — does the proof layer actually PROVE anything?
 *
 * Written after an external audit (2026-09-30) claimed four executed exploits
 * against the headline guarantees. Every assertion below is the SECURE
 * behaviour; run against a vulnerable tree, this suite fails and names which
 * guarantee is decorative.
 *
 * Claims under test:
 *   1. a hand-rolled envelope literal must not satisfy custody (checkEnvelope)
 *   2. the receipt header must be inside the signed material
 *   3. stripping the issuer signature must not yield a valid receipt
 *   4. the license seal must not be mintable from a published constant
 *
 * Run: node tools/run-one-probe.mjs proofLayerIntegrity
 */
import {
  issueRootEnvelope,
  attenuate,
  revoke,
  checkEnvelope,
  verifyEnvelope,
  isHumanPrincipal,
  type AuthorityEnvelope,
} from "../src/mission/custody";
import { buildProofReceipt, verifyProofReceipt, type ProofReceipt } from "../src/mission/receipts";
import { issueLicenseKey, verifyLicenseKey, VERIFY_SECRET } from "../src/mission/licensing";
import type { AutonomyRunSummary } from "../src/mission/autonomyRuntime";
import fs from "node:fs";
import path from "node:path";

/**
 * SI_ROOT is injected by esbuild (absolute path for the dev runner, "." for the
 * offline pack, which runs with cwd = the tree root). import.meta.url cannot be
 * used: the packed bundle lives one level deeper than the dev bundle, so the
 * source-scanning assertions below would resolve to the wrong directory and pass
 * or fail for the wrong reason.
 */
declare const SI_ROOT: string | undefined;
const ROOT = typeof SI_ROOT === "string" && SI_ROOT.length > 0 ? path.resolve(SI_ROOT) : process.cwd();

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const NOW = 1_760_000_000_000;

function fakeReport(over: Partial<AutonomyRunSummary> = {}): AutonomyRunSummary {
  return {
    status: "completed",
    reviewedBySnapshot: true,
    seats: [
      { seatId: "seat-01", role: "builder", outcome: "done", verified: true },
      { seatId: "seat-02", role: "verifier", outcome: "done", verified: true },
    ],
    autonomyArms: ["plan", "execute"],
    ...over,
  } as unknown as AutonomyRunSummary;
}

/** The attacker's move: a literal that satisfies every FIELD check, signed by nobody. */
function forgedEnvelope(scope: string[]): AuthorityEnvelope {
  return {
    format: "si-envelope/1",
    id: "env-attacker-1",
    principal: "human:attacker",
    delegationChain: ["human:attacker"],
    scope,
    issuedAt: NOW - 1000,
    expiresAt: NOW + 10_000_000,
    budgetUsd: null,
    revoked: null,
    parentId: null,
    digest: "deadbeef",
  };
}

async function main(): Promise<void> {
  console.log("\n== 1 · custody: a forged envelope literal must not authorize ==");
  {
    const forged = forgedEnvelope(["run:team-mission", "egress:share"]);
    const verdict = await checkEnvelope(forged, "run:team-mission", NOW);
    ok(
      "a hand-rolled envelope (digest deadbeef, no signature) is REFUSED",
      verdict.ok === false,
      verdict.ok ? "custody accepted an unsigned forgery — any caller owns the machine" : verdict.reason,
    );

    // the honest path must still work
    const root = await issueRootEnvelope({ principal: "human:owner", scope: ["run:team-mission"], expiresAt: null, now: NOW });
    const good = await checkEnvelope(root, "run:team-mission", NOW);
    ok("a genuinely issued envelope still authorizes", good.ok === true, good.reason);

    // and the guards that already existed must not regress
    const outside = await checkEnvelope(root, "egress:share", NOW);
    ok("an action outside scope is still refused", outside.ok === false, outside.reason);
    const expired = await issueRootEnvelope({ principal: "human:owner", scope: ["run:team-mission"], expiresAt: NOW - 1, now: NOW });
    ok("an expired envelope is still refused", (await checkEnvelope(expired, "run:team-mission", NOW)).ok === false);
    const revoked = revoke(root, "owner pulled it");
    ok("a revoked envelope is still refused", (await checkEnvelope(revoked, "run:team-mission", NOW)).ok === false);

    // attenuation forks from a parent — a forged parent must not fork into live seats
    const att = await attenuate(forged, "seat:seat-01", ["run:team-mission"], { now: NOW });
    ok(
      "a forged parent cannot be attenuated into a seat envelope",
      att.envelope === null || (await checkEnvelope(att.envelope, "run:team-mission", NOW)).ok === false,
      att.envelope ? "the forgery forked into a seat envelope that executes" : "attenuation refused it",
    );
  }

  console.log("\n== 2 · receipts: the header must be inside the signed material ==");
  let signedReceipt: ProofReceipt | null = null;
  {
    const receipt = await buildProofReceipt({
      mission: "REAL-MISSION",
      teamId: "team-honest",
      startedAt: new Date(NOW).toISOString(),
      finishedAt: new Date(NOW + 1000).toISOString(),
      mjVersion: "19.7.15",
      edition: "community",
      report: fakeReport(),
    });
    signedReceipt = receipt;

    const baseline = await verifyProofReceipt(receipt);
    ok("the honest receipt verifies", baseline.ok === true, baseline.ok ? "" : baseline.reason);

    const forgedHeader: ProofReceipt = {
      ...receipt,
      header: { ...receipt.header, mission: "ATTACKER-MISSION", edition: "pro", autonomyArms: ["exfiltrate"] },
    };
    const headerCheck = await verifyProofReceipt(forgedHeader);
    ok(
      "rewriting header.mission / edition / autonomyArms FAILS verification",
      headerCheck.ok === false,
      headerCheck.ok ? "the audit trail can be rewritten while still verifying" : headerCheck.reason,
    );

    const headerEventsCheck = await verifyProofReceipt({ ...receipt, header: { ...receipt.header, finishedAt: "1999-01-01T00:00:00.000Z" } });
    ok("rewriting header.finishedAt FAILS verification", headerEventsCheck.ok === false, headerEventsCheck.ok ? "timestamp is unfalsifiable" : headerEventsCheck.reason);
  }

  console.log("\n== 3 · receipts: a stripped signature must not verify ==");
  {
    const receipt = signedReceipt!;
    const signable = receipt.signature !== null;
    ok(
      "this runtime can sign (so a missing signature is a state to explain, not a default)",
      signable === true || receipt.signatureNote !== undefined,
      signable ? "" : "no Ed25519 here — the honest null path applies",
    );

    const stripped: ProofReceipt = { ...receipt, signature: null, issuer: null };
    delete (stripped as { signatureNote?: string }).signatureNote;
    const check = await verifyProofReceipt(stripped);
    ok(
      "a receipt with the issuer signature REMOVED fails verification",
      check.ok === false,
      check.ok ? "unsigned forgeries verify as valid" : check.reason,
    );

    // swapping in someone else's signature must fail too
    const tampered: ProofReceipt = { ...receipt, signature: "00".repeat(64) };
    ok("a garbage signature fails verification", (await verifyProofReceipt(tampered)).ok === false);

    // a receipt whose events were edited still fails (this guard already existed)
    const edited: ProofReceipt = {
      ...receipt,
      events: receipt.events.map((e, i) => (i === 1 ? { ...e, data: { ...e.data, outcome: "forged" } } : e)),
    };
    ok("editing an event still breaks the chain", (await verifyProofReceipt(edited)).ok === false);
  }

  console.log("\n== 4 · licensing: a published-constant key must not claim to be proof ==");
  {
    /* CORRECTION to the audit's finding 4, verified by reading every caller:
     * `verifyLicenseKey` has NO production call site and nothing ever calls
     * `rememberLicense`, so a forged pro key cannot currently unlock anything —
     * `currentEdition()` resolves from stored state, not from a key. The forgeable
     * verifier is therefore LATENT, not a live bypass. What must not happen is it
     * being wired up and mistaken for proof, so the assertion is about the label. */
    const forged = await issueLicenseKey(
      { licensee: "attacker-co", edition: "pro", issued: "2026-01-01", expires: null, maxSeats: 9999 },
      VERIFY_SECRET,
    );
    const check = await verifyLicenseKey(forged, NOW);
    ok(
      "a key minted with the PUBLISHED constant is reported self-attested, never issuer-signed",
      check.ok === true && check.assurance === "self-attested",
      check.ok ? `assurance=${check.assurance}` : check.reason,
    );

    const signed = "si-k1." + forged;
    const signedCheck = await verifyLicenseKey(signed, NOW);
    ok(
      "an si-k1 key is refused while this build embeds no license public key",
      signedCheck.ok === false && /public key/.test(signedCheck.reason),
      signedCheck.ok ? "an unverifiable issuer key was accepted" : signedCheck.reason,
    );

    const srcFiles: string[] = [];
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) walk(f);
        else if (/\.tsx?$/.test(e.name)) srcFiles.push(f);
      }
    };
    walk(path.join(ROOT, "src"));
    const callers = srcFiles.filter((f) => /verifyLicenseKey|rememberLicense/.test(fs.readFileSync(f, "utf8")) && !f.endsWith("licensing.ts"));
    ok(
      "no production module verifies or stores a license key (documents the latency)",
      callers.length === 0,
      callers.length ? `now reachable from: ${callers.map((c) => path.relative(ROOT, c)).join(", ")} — require assurance === \"issuer-signed\" there` : "",
    );
  }

  console.log("\n== 5 · honest-label check: the UI must not overstate the guarantee ==");
  {
    const receiptsUI = (await import("node:fs")).readFileSync(path.join(ROOT, "src/ui/screens/Receipts.tsx"), "utf8");
    ok(
      'the Receipts screen does not call the log "tamper-proof"',
      !/tamper-proof/i.test(receiptsUI),
      "the seal uses a published constant; the issuer signature is what proves it — say tamper-evident",
    );
  }

  ok("the human-principal format rule is unchanged", isHumanPrincipal("human:owner") === true && isHumanPrincipal("agent:bot") === false);
  ok("verifying a freshly issued envelope returns ok with no reason", (await verifyEnvelope(await issueRootEnvelope({ principal: "human:owner", scope: ["x"], expiresAt: null, now: NOW }))).ok === true);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nfailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

void main();
