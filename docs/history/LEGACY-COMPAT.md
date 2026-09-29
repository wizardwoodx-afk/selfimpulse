# Legacy compatibility registry

The active product identity is **Vouch Harbor (VH)**. A small set of legacy
identifiers from the predecessor build survives **on purpose** — each one is
load-bearing compatibility, listed here with its reason, and pinned by
`probe/legacyCompat` so it can neither rot silently nor be deleted by
accident. Anything legacy OUTSIDE this list fails the probe; anything in
this list that vanishes from the tree fails it too.

| Legacy identifier | Where it lives | Why it survives | Exit plan |
|---|---|---|---|
| `mj-proof-receipt/1`, `mj-proof-receipt/2` | receipt verifiers (`src/vouch/engine/proof.ts`, `tools/verify-receipt.mjs`) | Receipts already issued under the old format must keep verifying — deleting the format would un-prove real work |永 none — permanent back-compat contract, pinned by `probe/vhClean` |
| `mj-commercial-v1-offline` | offline license verification (`src/mission/licensing.ts`) | Offline licenses already issued embed this secret name; renaming invalidates them | none while issued licenses are honored |
| `mj_evolution` (`mj_evolution.stdio_server`) | `vendor/evolution-service` (VH-owned first-party component) | Installed builds spawn this exact python module path | rename in a release that also migrates the vendored package name |
| `mj-mission-record/1`, `mj-dossier/1`, `mj-incident-dossier/1`, `mj-merge-attestation/1`, `mj-provenance-statement/1` | format checks in `src/mission/*` | Old exported artifacts stay verifiable/readable | none — read-side compat only; writers emit `vh-*` |
| `https://mj.desktop/provenance/v1` | provenance predicate URI (`src/mission/provenance.ts`) | The URI is baked into issued credentials as an identifier, not a URL | a `v2` predicate can be added alongside; the v1 string stays for old credentials |
| `mjVersion` | receipt/manifest schema field (`verify/MANIFEST.json`, autonomy receipts) | Renaming a stored schema field without a storage migration would orphan data | storage-migration release (tracked; the one-time `mj.*` → `vh.*` key migration in `src/main.tsx` is the established pattern) |
| ~~`MJ_ACP_BIN`~~, ~~`MJ_ACP_ARGS`~~ | ACP harness spawn (`src/mission/acp.ts`) | **REMOVED 19.7.15, with the bridge itself.** The ACP bridge to external agent CLIs is gone, so these env vars now point at nothing. They were NOT kept as honor-shims: a back-compat shim that reads an env var nothing consumes is not compatibility, it is a lie the operator has to debug. Setting either has no effect. | **closed — no longer honored** |
| `MJ_BROWSER_DIR`, `MJ_BROWSER_NODE`, `MJ_BROWSER_URL` | browser-attach fallback | `VH_BROWSER_*` are primary; legacy names are honored so existing environments keep working | drop after a deprecation notice in release notes |
| `VH_BROWSER_*` primary / `MJ_BROWSER_*` fallback | native browser-service spawn (`src-tauri/src/commands.rs`) | same pattern: new name primary, old environments unbroken | drop fallback after a deprecation notice |
| `mj.sqlite` | native app-data database filename (`src-tauri/src/db.rs`) | Renaming orphans the user's local database | a copy-and-verify migration in a future release |
| `mj-browser`, `mj-bridge`, `mj-control-mcp`, `mj://event`, `.local/share/mj` data dir | native process/pipe/event names and the on-disk data directory | Installed builds and their bundled services speak these names; changing them without a coordinated native release breaks the desktop app | coordinated native-layer rename with a compat window |
| `"mj."` storage-key prefix | the one-time migration in `src/main.tsx` | The migration must name the old prefix to move it | the migration code is the exit plan; it can be removed once no user store carries legacy keys |

## Rules

1. **Active identity is VH everywhere new.** New code, new files, new
   env vars, new wire formats use `vh`/`VH`/`Vouch Harbor` names only.
2. **Legacy identifiers are read-side only where possible.** Writers emit
   the current format; readers accept old ones.
3. **Every entry above is tested.** `probe/legacyCompat` fails if an entry
   disappears from the tree or from this document, and `probe/vhClean`
   fails if any legacy identifier appears outside its allowlisted purpose.
4. **No absolutes in release notes.** The identity claim is "no *active*
   legacy identity", with this document as the honest inventory of
   deliberate compatibility.
