# Vouch Harbor RSI Framework — the bounded, production-grade design (19.4.2)

> **19.4.3 update:** this design has been superseded by **RSIRALS v5.0** —
> the proprietary trust-rooted architecture (three planes, control-plane
> firewall, canary auto-rollback, end-to-end evidentiary promotion). See
> [RSIRALS.md](RSIRALS.md). Everything below remains the landscape and
> rationale the RSIRALS design stands on.

Every serious recursive-self-improvement system in the 2026 landscape improves
against a **fixed external signal** and is **bounded**. None of the verified
production examples is an open-ended self-modifier. Vouch Harbor's RSI takes
that shared discipline and adds what the field's own papers say is missing:
**governance-grade measurement and human-gated promotion with receipts**.

## 1. The landscape (what exists, and what it proves)

| System | What it changes | Fixed signal it scores against | Loop closure |
|---|---|---|---|
| AlphaEvolve (DeepMind) | Candidate programs/algorithms | Automated program evaluators | bounded |
| Darwin Gödel Machine (Sakana) | Its own agent codebase | Coding-benchmark scores | bounded |
| Gödel Agent (ACL 2025) | Scaffolding/own logic via monkey-patching | Task metric; paper itself calls for human oversight and limited modification scope | bounded by prompting |
| STOP (self-taught optimizer) | Its own scaffolding program | Task metric | bounded |
| SEAL | Model weights via self-edits | Task metrics | research-grade |
| ADAS | Agent architecture search | Benchmark scores | research-grade |
| RSIAgent (Aether AI, 2026) | Frozen environment memory (curriculum/actor/verifier agents) | Validated outcomes; memory reused without parameter updates | bounded |
| DSPy / TextGrad / Trace | Prompts and program graphs | Compiled metrics | production libraries |
| Reflexion / Voyager | Episodic reflections / skill libraries | Environment feedback | bounded |
| Self-Rewarding LMs | Its own preference data | Partly self-generated reward — the caveat case | bounded with warning |

Two findings from the literature bind this design:

1. **Huang et al. (ICLR 2024): LLMs cannot reliably self-correct reasoning
   without external feedback — intrinsic self-reflection is unreliable and can
   degrade performance.** The production consensus (iteration caps of 2–3,
   external ground truth, anti-gaming rubrics) follows from it.
2. **The 2026 RSI survey (Chen et al.) orders verifier signals into a
   hierarchy — formal verifiers strongest, intrinsic self-assessment weakest —
   and shows the characteristic failure modes (self-confirming loops, model
   collapse, diversity collapse) all follow from letting a loop verify
   itself.** Bounded self-refinement is already practice; open-ended RSI
   remains bounded by grounding, collapse and compute on every measurable
   side.

**Positioning.** The field ships improvement mechanisms; Vouch Harbor ships
the *assurance runtime around them*: a human gate with risk tiers, receipts
for approvals **and** refusals, a floor the loop cannot touch, and exact
revert. A Gödel-class self-rewriter inside VH would still pause at the gate,
mint receipts, and be revertible — that is the product thesis.

## 2. The VH-19 RSI architecture (what ships in 19.4.2)

```
USER
 ↓
VH-19 Generalist
 ↓
EVIDENCE LEDGER ── five sources, all wired live (nothing invented):
   · user rejection      (decision ledger, memory.ts)
   · human-gate denial   (ingested at the gate, rsi signals store)
   · execution failure   (refused/error/gated-out outcomes + failure classes)
   · live-data unverified(retrieval receipts that did not verify)
   · handoff refusal     (A2A/BYOA handoff ledger)
 ↓
CURRICULUM — deterministic scan → candidate topics with cited evidence
 ↓
ACTOR — one frozen SKILL playbook draft per topic
   (deterministic by default; ONE receipted provider call may refine wording —
    provider proposes ≠ provider decides)
 ↓
VERIFIER — the hierarchy, honored in code:
   human approval + autonomy exam  >  measured comparison  >  NEVER intrinsic self-assessment
 ↓
PROMOTION LADDER — applied ≠ trusted:
   applied playbook enters as "measuring"; only a MEASURED comparison
   (candidateScore > baselineScore, evidence named) can adopt it;
   losing measurements retire it and revert the frozen memory exactly —
   the same discipline as the mission self-improve loop
   (baseline/candidate arms, MIN_TRIALS, ADOPT_MARGIN, learning receipts).
 ↓
FROZEN MEMORY — digest-stamped SKILL.md playbooks composed into routed
   specialist prompts. No parameter updates. Reverts exactly.
```

The floor (`RSI_FLOOR`): the loop may never touch the human gate and its risk
tiers, the autonomy exam and its threshold, the verification suites and their
pins, the self-evolution floor, or the floor list itself.

## 3. Failure modes, and the mechanic that blocks each

| Failure mode (from the literature) | VH mechanic |
|---|---|
| Self-confirming loop (loop verifies itself) | Intrinsic self-assessment is never a verifier; promotion needs measured numbers; apply needs a human |
| Reward hacking | The signal is the user's own ledger and measured runs, not a proxy the agent can edit |
| Model / diversity collapse | Tighten-only playbooks, human reject path, cap on topics per cycle, frozen immutable entries |
| Cost explosion / runaway iterations | One provider call per draft, cycle is on-demand, hard caps on topics/signals/drafts |
| Silent drift | Digest-stamped memory, receipts everywhere, exact revert, audit ledger |
| Self-modification escaping control | RSI_FLOOR + the existing SELF_EVOLUTION_FLOOR + probes that pin both |

## 4. Production checklist compliance

| Production guidance (2026 consensus) | VH-19 RSI |
|---|---|
| External signals, not self-judgment | ledger + measured comparisons only |
| Capped iterations | one refinement call per draft; capped stores |
| Promotion gates | promotion ladder: measuring → adopted/retired |
| Rollback | exact revert of frozen memory, probe-pinned |
| Evidence lineage | every topic cites ledger evidence ids; every draft carries a digest |
| Log everything | decisions, handoffs, signals, promotions — all receipted/local-ledger |
| Human oversight on self-modification | apply/reject is always a human decision; the gate never moves |

## 5. The four authority levels (they deliberately differ)

1. **User level** — accept/reject learning (memory.ts). Authority: personal.
2. **Team level** — Team-Evolve proposals. Authority: gated per team.
3. **VH-19 level** — this framework: evidence → playbook → human approval →
   measured promotion → frozen memory. Authority: user-gated, measurement-settled.
4. **Mission level** — selfImprove.ts: baseline vs candidate strategy arms
   with real attributed runs, adoption margins and learning receipts.
   Authority: experiment-gated.

Levels 3 and 4 now share one discipline: **nothing is adopted on its own
say-so.** That contract matured at 19.4.2 and is the shipping behaviour today.
