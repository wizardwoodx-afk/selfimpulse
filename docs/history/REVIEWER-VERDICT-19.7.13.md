# Reviewer verdict — seventh external review, 19.7.13 "Keyholder"

> **Status: ACCEPTED.** The reviewer's own recommendation was to stop iterating on this
> release and move to new capabilities. 19.7.13 is frozen as the flagship.
>
> The text below is the reviewer's, reproduced verbatim and unedited. Nothing in this file
> is the maintainer's assessment.

---

**This one is better than the previous 19.7.13 archive.** It is essentially the **19.7.13
cleanup/finalization pass**, and the important fixes are real.

What changed from the previous 19.7.13

**1. The Docs door is now fully covered by the shell test.**
Earlier, `shellRender` hardcoded five doors. This build derives the door list from
`Shell.tsx`, requires exactly six, checks that every declared door renders, and specifically
checks Docs. I ran it: **26/26 passed**.
That closes the exact verification hole we identified.

**2. Docs now explicitly tells the user how extraction works.**
The UI now says the default path is **mechanical extraction**, no model call, and no document
is sent anywhere. The code also distinguishes mechanical vs LLM distillation in stored
proposals. The knowledge suite passes **58/58**.
That is especially good for VH because it prevents the UI from implying an LLM processed
private documents when it didn't.

**3. The release record is internally cleaner.**
The current build says **19.7.13**, and the release record states the Node floor correctly.
`versionDrift` passes **43/43**, `docIdentity` **11/11**.

**4. The core runtime is intact.**
The production-stack check passes **7/7**, and the graph/performance path passes **18/18**.

One nuance

The `patinaShell` suite still has some historical wording like **"19.7.12 shell files"** in
its test title/comments. It does not affect behavior, and the actual assertions are correct,
but I'd clean that text so a reviewer doesn't see a stale release number in a test description.

Security-wise

I don't see a new blocker in this patch. The owner-key production path still follows:
**native keychain → encrypted browser storage → session-only fallback**
and the provider path remains vault-backed. There is no verifier private key artifact in the ZIP.

My verdict

**This is the 19.7.13 build I would keep.**
The previous 19.7.13 was already strong; this one closes the remaining **Docs/shell
verification gap** and improves the **privacy/processing disclosure** around document ingestion.

So, for your current flagship:

| Area | Verdict |
| --- | --- |
| Runtime | production-candidate |
| UI | production-grade |
| Security/governance | strong |
| Docs / Knowledge Forge | strong |
| Release hygiene | strong |
| **Overall** | **~9.9/10** |

I would stop iterating on 19.7.13 unless you find a functional bug. The next changes should
be new capabilities rather than more micro-revision churn.

---

## What was done in response, and where it is

Every item above, including the nuance, was actioned in `d8700cc` and `74b0891`:

| Reviewer's item | Resolution | Where it is now |
| --- | --- | --- |
| 1 — `shellRender` hardcoded five doors | Door list **derived** from `src/ui/Shell.tsx` (`shellDoors()`), count pinned at six, every declared door rendered + asserted, Docs specifically asserted | `probe/shellRender.test.tsx` — 26/0 |
| 2 — Docs must disclose the extraction path | Door states mechanical extraction on the cold surface; each proposal prints a `Distiller —` line naming mechanical extraction or the harness | `src/ui/screens/Docs.tsx`, `FEATURES.md` — knowledge suite 58/0 |
| 3 — release hygiene | Version-neutral current-state labels; the release record and Node floor corrected | `verify/BUILD-INFO.txt`, probes |
| 4 — core runtime intact | Unchanged and re-verified on the rebuilt tree | production-stack 7/7, graph 18/18 |
| Nuance — stale `19.7.12` in `patinaShell` | Title and section made version-neutral; `Docs.tsx` added to that suite's own shell-file list. The same class was swept repo-wide: `vh19Door`, `vhClean`, `src/App.tsx` and `docs/VERIFICATION.md` still said **five doors** and were corrected to six; `src/App.tsx` also carried a stale `19.8` stamp | `d8700cc` |

Historical mentions were deliberately kept where they explain why something is absent —
"19.7.12 retired the Teams page" is provenance, not rot. What changed is that no
**current-state** claim carries a release stamp, so the text cannot drift into a false one.

## Mutation proof for item 1

A green gate is not evidence; a gate that fails when the guarded thing is broken is. Deleting
the `docs` nav entry and the `<Docs />` render from `src/ui/Shell.tsx` and re-running:

```
FAIL the shell declares six doors — declared 5: Steward · Work · Receipts · Memory · Settings
FAIL the Docs door is among them
23 passed, 2 failed
```

Restored, the same suite is 26 passed, 0 failed. This is the property the pre-19.7.13 suite
lacked: it would have passed with Docs deleted.

## Verification at the frozen commit

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | 0 errors |
| `node tools/run-all-probes.mjs` | 155 passed, 0 failed |
| `node verify/run.mjs` | 154 passed, 0 failed |
| `sh VERIFY.sh` from a clean unzip, zero install | 154 passed, 0 failed |
| `patinaShell` | 66 passed, 0 failed |
| `navAlign` | 15 passed, 0 failed |
| `shellRender` | 26 passed, 0 failed |
| `offlinePack` | 17 passed, 0 failed |

Frozen commit: `d8700cc`. Source and runnable archives are attached to the release; the
runnable archive contains `dist/` and runs from the unzip.
