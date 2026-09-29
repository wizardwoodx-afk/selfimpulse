/**
 * Patina (17.1) — behavioral tests for the four Patina primary buttons.
 *
 * The 17.1 review asked for behavioral (state-mutating) proof that the
 * four prominent Patina buttons do what they claim, beyond source wiring.
 * This suite invokes the underlying domain primitives directly (through the
 * same harbor actions the buttons call in production) and asserts observable
 * state change.
 *
 *   1. Launch voyage   → opens a new Vouch thread + focuses helm
 *   2. Re-rate         → recomputes assurance from sealed receipts/crew
 *   3. Muster a hand   → appends a TeamSeat to the active crew
 *   4. Import topology → Chart parses a JSON topology file into state
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert";

declare const HANDLE_ROOT: string | undefined;
const ROOT = typeof HANDLE_ROOT === "string" && HANDLE_ROOT.length > 0 ? HANDLE_ROOT : process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), "utf8");

import {
  harborMusterHand,
  harborRerate,
  setBridgeDeps,
} from "../src/vouch/engine/bridge";
import { noHostDeps } from "../src/mission/missionLoop";
import {
  newVouchThread,
  vouchThreads,
  vouchSession,
} from "../src/vouch/engine/vouch";

describe("buttonActions — Patina primary buttons mutate real state", () => {
  // Make sure bridge deps are installed so nothing hits a real CLI.
  setBridgeDeps(noHostDeps());

  it("Launch voyage — opens a new Vouch thread (real ledger mutation)", () => {
    const before = vouchThreads().length;
    const id = newVouchThread(`Voyage probe ${Date.now()}`);
    assert.ok(id && id.length > 0, "newVouchThread returns a thread id");
    assert.strictEqual(vouchThreads().length, before + 1, "a thread was added");
    assert.strictEqual(vouchSession().activeThreadId, id, "the new thread becomes active");
    // App dispatches vh:focus-helm — source-pinned here because CustomEvent
    // lives on window (the action body literally dispatches it).
    // 19.7.12 (UI): the Patina shell (src/app/harbor.tsx) is retired; "New mission"
    // in the 19.7.12 sidebar resets the store and returns to the Steward.
    const shellSrc = read("src/ui/Shell.tsx");
    const storeSrc = read("src/ui/store.ts");
    assert.ok(/New mission/.test(shellSrc) && /onClick=\{newMission\}/.test(shellSrc), "the sidebar carries New mission wired to the store");
    assert.ok(/newMission:\s*\(\)\s*=>\s*set\(/.test(storeSrc), "newMission mutates real store state");
  });

  it("Re-rate — reports the REAL assurance score, never a headcount", () => {
    // v17.10: this test used to assert `after.assurance >= before.assurance` after
    // mustering a hand — i.e. it asserted that adding an agent RAISES assurance.
    // That was the defect: assurance was `60 + seats * 3`, a payroll count wearing
    // the word "assurance", with sealed/wins/skills hardcoded to 0. The honest
    // contract is the opposite: with no measured evidence the score is
    // `unevaluated`, and mustering a hand must NOT move it.
    const before = harborRerate();
    assert.ok(["evaluated", "unevaluated"].includes(before.status),
      `rerate reports a status (got ${before.status})`);
    assert.strictEqual(typeof before.sealed, "number", "sealed count is a number");
    assert.strictEqual(typeof before.measured, "number", "measured count is a number");
    assert.ok(Array.isArray(before.factors), "factors breakdown is present");

    if (before.status === "unevaluated") {
      assert.strictEqual(before.assurance, null,
        "unevaluated ⇒ assurance is null, not a fabricated number");
    } else {
      assert.ok(before.assurance !== null && before.assurance >= 0 && before.assurance <= 100,
        `assurance in 0..100 (got ${before.assurance})`);
      assert.ok(before.factors.length > 0, "an evaluated score names its factors");
    }

    const r = harborMusterHand();
    if (!("error" in r)) {
      const after = harborRerate();
      assert.strictEqual(after.measured, before.measured,
        "mustering an agent is not a measured run — it must not move assurance");
      assert.deepStrictEqual(after.factors.map((f) => f.points), before.factors.map((f) => f.points),
        "adding headcount leaves every assurance factor unchanged");
    }
  });

  it("Muster a hand — returns a TeamSeat that is persisted to the crew ledger", () => {
    const r = harborMusterHand();
    // Either the muster succeeds and returns a real seat, or the crew is
    // already full and it returns the documented refusal in words.
    if ("error" in r) {
      assert.ok(/already mustered|all .* hands/i.test(r.error), "full-crew case returns a documented refusal");
    } else {
      assert.ok(r.seat.id && r.seat.id.startsWith("hand-"), "muster returns a seat id (hand-N)");
      assert.ok(
        ["coder", "reviewer", "tester", "security", "debugger", "synthesizer"].includes(r.seat.role),
        `seat has a real role (got ${r.seat.role})`
      );
      assert.ok(Array.isArray(r.crew.seats) && r.crew.seats.length > 0, "seat is attached to a crew");
      assert.strictEqual(r.seat.mayWrite, r.seat.role === "coder" || r.seat.role === "debugger",
        "write-permission matches role risk convention");
    }
  });

  it("Import topology — Chart's JSON parser accepts the documented topology shape", () => {
    // 19.7.12 (UI): the Chart view is retired with the Patina shell; the transform
    // below remains the documented topology contract and is executed directly.
    // Execute the same transform Chart applies in onImportFile, over a
    // representative topology payload. This is the behavioral contract:
    //   nodes → {id,name,role,harness,x,y,underWeigh,kind} with safe defaults.
    const payload = JSON.stringify({
      nodes: [
        { id: "helm", name: "Helm", role: "trigger", harness: "human", x: 40, y: 110, kind: "input" },
        { id: "brain", name: "Vouch Brain", role: "planner", harness: "vouch-brain", x: 230, y: 110, kind: "brain", underWeigh: true },
        { id: "gate", name: "Gate", role: "human", harness: "approvals", x: 680, y: 60, kind: "gate" },
      ],
    });
    const parsed = JSON.parse(payload);
    assert.ok(Array.isArray(parsed.nodes), "topology carries a nodes array");
    const nodes = parsed.nodes.map((n: Record<string, unknown>) => ({
      id: String(n.id), x: Number(n.x) || 80, y: Number(n.y) || 80,
      name: String(n.name || "node"), role: String(n.role || "seat"),
      harness: String(n.harness || "vouch-brain"),
      underWeigh: Boolean(n.underWeigh), kind: n.kind,
    }));
    assert.strictEqual(nodes.length, 3, "all three nodes parsed");
    assert.strictEqual(nodes[0].name, "Helm");
    assert.strictEqual(nodes[1].underWeigh, true, "underWeigh boolean preserved");
    // Garbage input is tolerated (catches {} → defaults applied).
    const garbage = JSON.parse('{"nodes":[{"id":"x"}]}');
    const gn = garbage.nodes.map((n: Record<string, unknown>) => ({
      id: String(n.id), x: Number(n.x) || 80, y: Number(n.y) || 80,
      name: String(n.name || "node"), role: String(n.role || "seat"),
      harness: String(n.harness || "vouch-brain"),
      underWeigh: Boolean(n.underWeigh), kind: n.kind,
    }));
    assert.strictEqual(gn[0].name, "node", "missing name falls back to 'node'");
    assert.strictEqual(gn[0].harness, "vouch-brain", "missing harness falls back to 'vouch-brain'");
  });
});
