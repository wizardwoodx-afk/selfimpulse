# Vouch Harbor interop — the external-agent boundary (18.1.0)

> **VH executes. Vouch governs. The receipt proves. The protocol carries
> that proof across machines.** — and this document is the door that
> *other* machines and *other* agents walk through.

## One rulebook, three doors

Every proof that crosses a machine boundary is checked by the SAME rules,
no matter who presents it:

| Door | Who uses it | Dependencies |
|---|---|---|
| `src/vouch/engine/crossHarbor.ts` | the live Patina runtime (Register → **Anchor**) | none beyond WebCrypto |
| `tools/vh-interop.mjs` | external agents, other harbors, CI, humans | **zero npm deps** — node builtins + the protocol bridge |
| `protocol/bridge/vouch-receipt-bridge.mjs` | the library both of the above share | zero |
| `src/mission/a2aRuntime.ts` + `npm run host` | a harbor mounting itself on the A2A v1.0 wire (since 17.10.7) | Node runtime; the bridge's CLI deps to execute |

The receipt verdicts are byte-identical to `tools/verify-receipt.mjs`.
There is exactly one rulebook; there are no "interop mode" exceptions.

## The transport pack — the machine boundary as files

An independent harbor receives exactly three files and nothing more.
Content never crosses — proof and identity only.

```
pack/
├── receipt.jsonl          the sealed vh-proof-receipt/2 chain
├── anchor-envelope.json   {p, n, ts, sig} — signer-bound anchor fact
├── signer-public.json     the anchoring agent's ECDSA P-256 public JWK
└── MANIFEST.txt           the verify commands, verbatim
```

Build one:

```
node tools/vh-interop.mjs identity      --dir ./agentA
node tools/vh-interop.mjs anchor        --receipt receipt.jsonl --dir ./agentA --out env.json
node tools/vh-interop.mjs transport-pack --receipt receipt.jsonl --env env.json \
     --signer-jwk ./agentA/public.json --out ./pack
```

Verify one (the receiving harbor):

```
node tools/vh-interop.mjs verify-receipt  pack/receipt.jsonl
node tools/vh-interop.mjs verify-envelope pack/anchor-envelope.json \
     --signer-jwk pack/signer-public.json --seen ./seen.json
```

Exit codes: `0` verified · `1` refused **in words** on stderr · `2` usage error.

## Guarantees the boundary enforces

1. **Receipt integrity first** — an envelope is only issued over a receipt
   that already verified; the receiving side re-verifies BOTH, independently.
2. **Signer binding** — the envelope's evidence names the verified chain
   head, the event count and the issuer fingerprint; a different signer's
   key cannot open it.
3. **One-time evidence** — `--seen <ledger.json>` records verified nonces
   (bounded, last 4096). A replayed envelope is refused as
   `replayed-envelope`. Without `--seen` the check is window-only (5
   minutes) and the CLI does not pretend otherwise.
4. **Tampering is loud** — any in-transit change to payload, nonce,
   timestamp or signature fails as `bad-signature`; a rewritten receipt
   event fails the chain at its exact seq.
5. **No silent anything** — every refusal is a sentence; every pass prints
   the evidence it passed on.

## What this boundary does NOT claim

- It is not a network protocol. Transport is files (or any byte channel you
  already trust). The protocol subtree (`protocol/`) provides the real
  device-to-device layer when both sides run a harbor.
- An envelope verified here is *evidence*, not authorization. A receiving
  harbor additionally runs PolicyEngine, signer binding and the
  grant-authority gate before it acts on an anchored fact.
- The interop CLI's identity file stores a private key at rest, in plain
  JSON, where you point it. The file says so inside itself. Protect it as
  you would any credential — or run inside a harbor, where the OS keychain
  is the seat.

## Proven interop (pinned in-tree)

`probe/interop.test.ts` runs the two-machine scenario for real: machine A
(the TypeScript runtime) seals and anchors; machine B (a spawned
`node tools/vh-interop.mjs` process — separate process, separate rulebook
copy, zero shared state) verifies. Cross-implementation, tamper-refusing,
replay-refusing. That is the external-validation pillar, reproducible from
the zip.

## The A2A wire — a harbor that is actually listening (17.10.7)

The transport pack above carries proof as files. The A2A v1.0.0 door carries
*work*: one harbor delegates a task to another and gets back a sealed receipt.
Until 17.10.7 that door was complete and unmounted — `createA2AServer()` and
the delegation handler existed and were probed, but nothing in the shipped
product called them, so the only evidence was a harness wiring them by hand.

`startA2ARuntime()` is the single bootstrap (identity → team → signed card →
handler → receiver risk policy → live bridge → listen) and `npm run host` runs
it as a process. `probe/a2aRuntime.test.ts` pins the launch-time behaviour
across independent OS processes: a stranger discovers the card over HTTP and
verifies its JWS against the published key; an unauthorized caller is refused;
a delegation executes a real TeamExecutor mission in the receiver's process
and returns a `vh-proof-receipt/2` that verifies in the sender's process AND
in a third process (`tools/verify-receipt.mjs`); a receiver that cannot execute
refuses in words; a repository whose tests fail is reported as
`executed-failed`, never as completed; and a sender that labels a
`git push --force` "safe" meets the receiver's own §10 risk table and is
denied at a headless gate. The suite also byte-pins `tools/vh-host-engine.mjs`
against its source, so the shipped launcher cannot drift from the shipped
bootstrap.
