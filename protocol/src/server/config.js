import { VHConfigError } from "../core/vh-errors.js";

function ranged(val, min, max, name) {
  const n = Number(val);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new VHConfigError(`${name} must be between ${min} and ${max}, got: ${val}`);
  return n;
}

function strictBool(val, dflt, name) {
  if (val === undefined || val === null) return dflt;
  if (val === "true"  || val === true)   return true;
  if (val === "false" || val === false)  return false;
  throw new VHConfigError(`${name} must be "true" or "false", got: ${val}`);
}

export function loadConfig(env = process.env) {
  return Object.freeze({
    port:          ranged(env.PORT ?? 3000,                          1024, 65535,       "PORT"),
    dataDir:       String(env.IMPULSE_DATA_DIR   ?? "./data"),
    ledgerFile:    String(env.IMPULSE_LEDGER_FILE ?? "ledger.jsonl"),
    chainMemory:   ranged(env.IMPULSE_CHAIN_MEMORY ?? 1_000,             10, 1_000_000,     "IMPULSE_CHAIN_MEMORY"),
    tsWindowMs:    ranged(env.IMPULSE_TS_WINDOW_MS ?? 5 * 60_000,        10_000, 30 * 60_000, "IMPULSE_TS_WINDOW_MS"),
    maxFileMB:     ranged(env.IMPULSE_MAX_FILE_MB  ?? 500,               1, 10_000,          "IMPULSE_MAX_FILE_MB"),
    maxNameLen:    ranged(env.IMPULSE_MAX_NAME_LEN ?? 60,                1, 200,             "IMPULSE_MAX_NAME_LEN"),
    maxSocketsPerIp: ranged(env.IMPULSE_MAX_SOCKETS_PER_IP ?? 10,        1, 1000,            "IMPULSE_MAX_SOCKETS_PER_IP"),
    maxPayloadBytes: ranged(env.IMPULSE_MAX_PAYLOAD_BYTES ?? 64 * 1024,  1024, 10 * 1024 * 1024, "IMPULSE_MAX_PAYLOAD_BYTES"),
    banThreshold:  ranged(env.IMPULSE_BAN_THRESHOLD ?? 20,               1, 1000,            "IMPULSE_BAN_THRESHOLD"),
    banDurationMs: ranged(env.IMPULSE_BAN_DURATION_MS ?? 15 * 60_000,    60_000, 24 * 3_600_000, "IMPULSE_BAN_DURATION_MS"),
    /*
     * requireMetaSig — Sentinel / Strict posture merged.
     * true (default): every new link MUST carry a harbor metaSig.
     *   The harbor refuses to append a link if metaSig computation fails.
     *   Startup rejects any link after firstMetaSigSeq that lacks metaSig.
     * false: legacy mode for pre-v0.9 ledgers being migrated.
     *   New links still get metaSig when harborKey is available, but
     *   startup does NOT reject links that are missing metaSig.
     */
    requireMetaSig: strictBool(env.IMPULSE_REQUIRE_META_SIG, true, "IMPULSE_REQUIRE_META_SIG"),
    /* v0.10.3: cap on delegated-authority depth (see protocol/THREAT-MODEL.md) */
    maxDelegationDepth: ranged(env.IMPULSE_MAX_DELEGATION_DEPTH ?? 2, 0, 8, "IMPULSE_MAX_DELEGATION_DEPTH"),
    /* v0.10.5/0.10.6 RULES 4+5: the fingerprints permitted to HAND OUT
       authority — the operator-authorized identities. A capability declaration
       by one of these is delegable; anyone else's is descriptive only, and
       "*"-class tokens belong to these alone. Empty by default: a fresh harbour
       grants nothing until the operator names somebody (its own root key is
       added at boot). An OPERATOR decision, never a self-claim.
       IMPULSE_WILDCARD_AUTHORITIES is the v0.10.5 name and is still read.
       (see protocol/THREAT-MODEL.md, RULES 4 and 5) */
    authorities: [
      ...String(env.IMPULSE_AUTHORITIES ?? "").split(","),
      ...String(env.IMPULSE_WILDCARD_AUTHORITIES ?? "").split(","),
    ].map((s) => s.trim().toUpperCase()).filter(Boolean),
    /* v0.10.4: grant-authority coverage posture (see protocol/THREAT-MODEL.md RULE 3).
       "strict" (default): a granter may only delegate authority it HOLDS.
       "compat" : v0.10.3 attested-only — migration only, widens attack surface.
       "off"    : gate disabled — TEST FIXTURES ONLY, never in production. */
    grantPolicy: (() => {
      const v = String(env.IMPULSE_GRANT_POLICY ?? "strict").toLowerCase();
      return ["strict", "compat", "off"].includes(v) ? v : "strict";
    })(),
    failFastOnTamper: strictBool(env.IMPULSE_FAIL_FAST_ON_TAMPER, true, "IMPULSE_FAIL_FAST_ON_TAMPER"),
    rate: Object.freeze({
      join:   ranged(env.IMPULSE_RATE_JOIN   ?? 2,  0.01, 100,   "IMPULSE_RATE_JOIN"),
      signal: ranged(env.IMPULSE_RATE_SIGNAL ?? 30, 1,    1000,  "IMPULSE_RATE_SIGNAL"),
      vouch:  ranged(env.IMPULSE_RATE_VOUCH  ?? 5,  0.1,  100,   "IMPULSE_RATE_VOUCH"),
    }),
  });
}
