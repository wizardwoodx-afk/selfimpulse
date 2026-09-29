# VH 19.5.x — Adaptation Record: Computer-Use (multi-agent desktop patterns) + Generalist Face

*This document records what was ADAPTED AND SHIPPED, with the module and probe
that prove it. Nothing here is forward-looking: every line names shipped code
or an explicit refusal. We adopt patterns, never dependencies that break
local-first.*

---

## Part A — Computer-Use capability — SHIPPED in 19.5.1 (`src/vh19/computerUse.ts`, `probe/computerUse.test.ts` — 15 pins)

### What the multi-agent desktop genre proved, and what VH shipped from it
1. **A computer per mission** → SHIPPED as **BrowserProfile**: one isolated
   profile per mission (own identity string, viewport, cookies OFF by
   default); state dies with the mission — `newProfile()`.
2. **One gateway for every action** → SHIPPED as the **plane discipline**:
   every `pc.*` action returns a receipt record (`executed | refused |
   handover`) with a digest; refusals are worded, never silent.
3. **Take-the-wheel** → SHIPPED as **critical-tier handover**: any action
   classified `critical` returns `decision: "handover"` to the human gate
   instead of executing — probe-pinned for both `pc.exec` and browser
   navigation.
4. **Bounded execution** → SHIPPED as `pcExec()`: allowlisted binaries only,
   shell-metacharacter injection scan on arguments, hard timeout, output
   ceiling, receipted digest of stdout/stderr.
5. **Built-in headless browser** → SHIPPED as `HeadlessBrowser`: detects a
   real browser binary (chromium / google-chrome); HTTPS-by-policy navigation
   (plain-http refused); injectable transport (default: real `fetch`);
   screenshots run through the real binary and **refuse wordingly when no
   binary exists — a page is never faked**.

### What was refused (and stays refused)
| Genre pattern | VH's decision |
|---|---|
| External SaaS threads/memory services | **Refused.** VH memory + ledger stay local |
| PostgreSQL for policy/audit | **Refused.** Decisions and receipts flow into the existing hash-chained ledger — offline-verifiable |
| Docker hard-requirement | **Refused.** Not part of this release; the plane degrades honestly instead |
| Policy rules that could grant past the governance plane | **Refused.** The frozen governance plane decides; policy cannot widen it |

### Scope boundary of this release (stated, not promised)
The container adapter and the AG-UI BYOA adapter are **not in this release**.
BYOA's trust intersection (TLS-by-default, rate ceiling, injection scan,
delegation receipts) already covers external agents today.

---

## Part B — The Generalist Face — SUPERSEDED in 19.6.6

- 19.4.5 shipped a vendored avatar engine for the Generalist's face. That
  engine was DELETED in 19.6.6: its module and its vendored sources are gone
  from this tree.
- The face now on screen is deterministic and name-derived: one face for the
  Generalist, derived from the name its owner gives it; one deterministic
  mark per specialist (`src/vh19/face.tsx`; pinned by `probe/face`, 10
  checks). No uploaded image, no selectable preset — the face is a hash of
  identity, stated on screen.
- The record keeps its honesty rule: what shipped is named, what was refused
  is named, and what was deleted says so here.

---

## The honesty rule this record follows
A capability is listed here only when a probe pins it. Everything else is
either shipped elsewhere (named above) or refused (named above). There is no
third category.
