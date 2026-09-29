/**
 * probe/brainSeam.test.ts — the real-model planning seam (16.9.7).
 *
 * The 16.9.6 review found the production gap: the seam spawned via
 * node:child_process, which the web bundle aliases to an honest stub — so a
 * shipped "Claude exited 1" could mean the CLI never ran. 16.9.7 fixes the
 * boundary, and this probe pins the FIX:
 *
 *   - HOST ROUTING: production invoke routes Tauri → ipc.cliInvoke (the Rust
 *     allowlist), refuses the web edition in words BEFORE any spawn, and the
 *     module never imports node:child_process at all (the stub is untouchable).
 *   - ASYNC: decide admits a Promise; the chat's event loop never blocks.
 *   - THE TRUE END-TO-END: a REAL process (node itself — harmless and
 *     deterministic) is resolved, invoked, parsed into a PLAN, labeled REAL,
 *     under the hybrid identity — in this probe's real Node environment.
 *   - REFUSAL TAXONOMY: unknown · not installed · host-cannot-spawn (which
 *     is NOT "exited 1") · non-zero exit · timeout · empty — all in words.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import {
  wrapRealModelBrain, runModelPrompt, planFromModelText, plannerPrompt,
  brainModelRun, realBrainDeps, realBrainInvoke, bareProviderId,
  BrainHostError, type BrainInvokeDeps,
} from "../src/vouch/engine/brainSeam";
import { simulatedBrain, type VouchBrain } from "../src/vouch/engine/vouch";
import { HARNESS_BY_ID, type HarnessId } from "../src/domain/harness";

const root: string = (globalThis as { IMPULSE_ROOT?: string }).IMPULSE_ROOT ?? process.cwd();
const AUTO = "auto" as const;
const execFileP = promisify(execFile);

/** Fake deps: host-shaped, no real process — for the refusal taxonomy. */
const fakeDeps = (behavior: { installed?: boolean; exit?: number; answer?: string; timeout?: boolean; hostError?: boolean }): BrainInvokeDeps => ({
  resolve: (id) => (id === "unknown" ? null : behavior.installed === false ? { name: "Fake CLI", bin: null, argv: ["$PROMPT"] } : { name: "Fake CLI", bin: "/usr/bin/fake-cli", argv: ["$PROMPT"] }),
  invoke: async (_bin, _argv, _t) => {
    if (behavior.hostError) throw new BrainHostError("this host cannot spawn processes — test host error");
    if (behavior.timeout) return { exitCode: 1, stdout: "", stderr: "timed out", timedOut: true };
    if (behavior.exit) return { exitCode: behavior.exit, stdout: "", stderr: "boom", timedOut: false };
    return { exitCode: 0, stdout: behavior.answer ?? "step one\nstep two\n- step three", stderr: "", timedOut: false };
  },
});

/** REAL deps: a genuine process — node itself as the harmless deterministic harness. */
const realNodeDeps = (): BrainInvokeDeps => ({
  // this fake host has exactly one CLI installed — node itself — aliased to
  // whatever registry id the walk asks for. The template passes the prompt as
  // DATA (argv[1]) to a small deterministic program that derives the plan from
  // it — the same shape a real harness adapter uses. REAL process, REAL output.
  resolve: (id) =>
    id === "unknown"
      ? null
      : {
          name: "Node runtime",
          bin: process.execPath,
          argv: [
            "-e",
            "const p = process.argv[1]; const ls = p.split(/\\n/).filter(l => l.trim().length > 20).slice(0, 3); ls.forEach((l, i) => console.log((i + 1) + '. ' + l.trim().slice(0, 60)));",
            "$PROMPT",
          ],
        },
  invoke: async (bin, argv, timeoutSecs) =>
    await new Promise((resolve) => {
      execFile(bin, argv, { timeout: timeoutSecs * 1000, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
        const e = err as { killed?: boolean; code?: number | string } | null;
        resolve({
          exitCode: e ? (typeof e.code === "number" ? e.code : 1) : 0,
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
          timedOut: Boolean(e?.killed),
        });
      });
    }),
});

test("brainSeam — real model, honest refusal, or labeled simulated: never faked", async () => {
  // 1. default is OFF — a human turns the seam on; the base brain runs untouched
  const plain = wrapRealModelBrain(simulatedBrain, fakeDeps({ installed: true }), "simulated");
  const ref = simulatedBrain.decide("What time is it in Chennai?", { mode: "quick", persona: "witty", facts: [] });
  const plainPlan = await plain.decide("x", { mode: "quick", persona: "witty", facts: [] });
  assert.deepEqual(plainPlan.plan, ref.plan, "pref simulated → the base brain runs untouched");

  // 2. THE TRUE END-TO-END: a REAL process runs, its output becomes the PLAN
  const real = wrapRealModelBrain(simulatedBrain, realNodeDeps(), AUTO);
  assert.equal(real.id, "simulated+real-plan", "auto → the hybrid identity is live");
  const planReal = await real.decide("Plan a mission to verify the workspace", { mode: "deep", persona: "professional", facts: [] });
  assert.ok(planReal.thoughts[0].includes("REAL model") && planReal.thoughts[0].includes("Node runtime"), `the run is labeled with the real harness: ${planReal.thoughts[0].slice(0, 80)}`);
  assert.ok(planReal.thoughts[0].includes("still gated"), "the label names the unchanged human gate");
  assert.equal(planReal.plan.length, 3, `plan steps parsed from the REAL process output: ${JSON.stringify(planReal.plan)}`);
  assert.ok(planReal.plan[0].startsWith("You are the planner"), );
  assert.ok(planReal.plan[2].includes("Objective"), "the objective line survived the real round-trip");

  // 3. host-cannot-spawn (the web path) → refused in words, NEVER "exited 1"
  const web = wrapRealModelBrain(simulatedBrain, fakeDeps({ installed: true, hostError: true }), AUTO);
  const planWeb = await web.decide("Plan something", { mode: "deep", persona: "minimal", facts: [] });
  assert.ok(planWeb.thoughts[0].includes("cannot spawn processes"), "the web refusal names the capability gap");
  assert.ok(!planWeb.thoughts[0].includes("exited"), "a host refusal is NOT reported as a CLI exit — no fabricated exit codes");
  assert.ok(planWeb.plan[0].includes("simulated brain retained"), "the labeled simulated brain is retained");
  const direct = await runModelPrompt("hi", "gemini", fakeDeps({ installed: true, hostError: true }));
  assert.equal(direct.ok, false);
  assert.ok(direct.refused.includes("cannot spawn processes") && !direct.refused.includes("exited"), "refusal text is precise at the API level too");

  // 4. not installed / unknown / exit-failure / timeout — all in words
  const absent = wrapRealModelBrain(simulatedBrain, fakeDeps({ installed: false }), AUTO);
  const planAbsent = await absent.decide("Plan something real", { mode: "deep", persona: "minimal", facts: [] });
  assert.ok(planAbsent.thoughts[0].includes("never fakes"), "the absence refusal names the honesty rule");
  const failed = await runModelPrompt("hi", "fake", fakeDeps({ installed: true, exit: 3 }));
  assert.ok(!failed.ok && failed.refused.includes("exited 3"), "a real CLI failure is reported as itself");
  const slow = await runModelPrompt("hi", "fake", fakeDeps({ installed: true, timeout: true }));
  assert.ok(!slow.ok && slow.refused.includes("timed out"), "timeout refused in words");
  const unknown = await runModelPrompt("hi", "unknown", fakeDeps({}));
  assert.ok(!unknown.ok && unknown.refused.includes("unknown harness"), "unknown harness refused in words");
  const none = await brainModelRun("hi", fakeDeps({ installed: false }));
  assert.equal(none.ok, false);
  assert.ok(none.refused.includes("not installed"), "the registry walk reports the honest absence");

  // 5. prompt shaping + parsing bounds
  assert.ok(plannerPrompt("build a barn").includes("build a barn") && plannerPrompt("build a barn").includes("human gate"), "the prompt carries the objective and the governance");
  assert.equal(planFromModelText("a\n\nbb bb\n- ccc ccc\ndddd dddd\neeee eeee\nffff ffff\ngggg gggg\nhhhh hhhh").length, 6, "steps bounded");

  // 6. THE PRODUCTION ROUTING, pinned in source (the 16.9.6 review's fix):
  const src = fs.readFileSync(path.join(root, "src", "vouch", "engine", "brainSeam.ts"), "utf8");
  assert.ok(!/from "node:child_process"/.test(src), "the seam NEVER imports node:child_process — the stub is untouchable");
  assert.ok(/useTauri\(\)/.test(src) && /ipc\.cliInvoke/.test(src), "the Tauri path routes through the governed IPC boundary (Rust allowlist)");
  assert.ok(/BrainHostError/.test(src), "the web path refuses via a typed host error, before any spawn");
  const vouchSrc = fs.readFileSync(path.join(root, "src", "vouch", "engine", "vouch.ts"), "utf8");
  assert.ok(/await brainNow\.decide/.test(vouchSrc), "the governed pipeline awaits the (possibly async) plan");
  assert.ok(/VouchPlan \| Promise<VouchPlan>/.test(vouchSrc), "the brain interface admits async plans");
  assert.ok(/wrapRealModelBrain\(simulatedBrain\)/.test(vouchSrc), "the simulated brain ships wrapped");
  assert.ok(!/no host app|no mission engine|until the merge/i.test(vouchSrc), "no stale header narrative survives");

  // 7. identity pins (the 16.9.6 honesty fix, kept)
  const offBrain = wrapRealModelBrain(simulatedBrain, fakeDeps({ installed: true }), "simulated");
  assert.equal(offBrain.id, "simulated", "off → the base identity stands");
  const wb: VouchBrain = wrapRealModelBrain(simulatedBrain, fakeDeps({ installed: true }), AUTO);
  assert.ok(wb.label.includes("real-model planning"), "auto → the label names the seam");
  assert.ok(realBrainDeps.resolve !== undefined && realBrainDeps.invoke !== undefined, "production deps exist");
});

test("brainSeam — the native boundary: bare provider id on the wire, PATH resolution, real process (16.10.0 review fix)", async (t) => {
  // The 16.9.7 external review found the material bug this probe's DI harness
  // could not see: resolveBrainHarness returns an ABSOLUTE path, realBrainInvoke
  // sent it as the IPC provider id, and the Rust gate matches ALLOWED_CLI_BINS
  // against BARE names — so the native production path refused an installed
  // harness. Three layers of proof, mirroring the reviewer's requested chain
  // "real provider ID → IPC contract → Rust allowlist → PATH resolution →
  // harmless executable → stdout → plan parsing → REAL label":

  const rustSrc = fs.readFileSync(path.join(root, "src-tauri", "src", "commands.rs"), "utf8");
  const seamSrc = fs.readFileSync(path.join(root, "src", "vouch", "engine", "brainSeam.ts"), "utf8");

  // 1. THE IPC CONTRACT, pinned in the Rust source: bare-name gate, then the
  //    server resolves the binary itself (which_bin), then executes the
  //    RESOLVED path — the webview never supplies an executable location.
  assert.ok(rustSrc.includes("ALLOWED_CLI_BINS.contains(&bin.as_str())"),
    "the Rust gate matches the allowlist against the BARE provider id");
  assert.ok(rustSrc.includes("which_bin(bin)"),
    "after the gate, Rust resolves the bare id itself (which_bin: fast paths + login-shell paths)");
  // The executed program must be the server-RESOLVED path — resolution is never
  // the webview's job.
  //
  // This used to be asserted as the literal `Command::new(&resolved)` in
  // commands.rs. Containment construction now happens inside `contain.rs`
  // (`wrap_command` returns the built Command, because std's Command has no
  // program setter and the wrapper program differs from the target program), so
  // the literal moved. The PROPERTY is unchanged and is now asserted across the
  // whole chain instead of at one string, which is a stronger check: if any
  // link in "bare id -> server resolution -> the Command that actually runs"
  // ever breaks, this fails.
  assert.ok(/which_bin\(&bin\)/.test(rustSrc),
    "the binary is resolved server-side from the bare id");
  assert.ok(/wrap_command\(\s*&resolved\b/.test(rustSrc),
    "the RESOLVED path is what is handed to the containment wrapper");
  const containSrc = fs.readFileSync(path.join(root, "src-tauri", "src", "contain.rs"), "utf8");
  assert.ok(containSrc.includes("Command::new(program)"),
    "the containment wrapper builds the process from exactly the program it was given");
  // The CLI path specifically must never spawn the bare, webview-supplied id.
  // (The shell_run path DOES pass a program through, but that is a different,
  // separately-gated command: its cwd goes through ensure_allowed(), which
  // refuses any path outside a registered workspace root. Asserting a blanket
  // ban on Command::new(&program) here would be wrong, so this check is scoped
  // to the resolved-path function the probe is actually about.)
  const cliFn = /pub fn cli_invoke[\s\S]*?\n\}/.exec(rustSrc);
  assert.ok(cliFn !== null, "the CLI invoke function is locatable in the Rust source");
  if (cliFn) {
    assert.ok(!/Command::new\(&bin\b/.test(cliFn[0]),
      "inside the CLI invoke path, the bare provider id is NEVER passed to a process");
    assert.ok(!/Command::new\(&resolved\b/.test(cliFn[0]),
      "the CLI invoke path does not re-wrap the resolved path in a bare Command");
  }
  // The shell path keeps its own independent gate.
  assert.ok(rustSrc.includes("ensure_allowed(&state, &c)"),
    "the shell path still refuses a cwd outside every registered workspace root");

  // 2. THE WIRE IDENTITY, pinned in the seam source: the resolved absolute
  //    path is normalized to the bare id BEFORE ipc.cliInvoke — the exact
  //    16.9.7 bug, asserted dead.
  assert.ok(seamSrc.includes("ipc.cliInvoke(bareProviderId(bin)"),
    "realBrainInvoke sends the bare provider id across IPC");
  assert.ok(!seamSrc.includes("ipc.cliInvoke(bin,"),
    "the absolute resolved path is NEVER the wire identity");
  assert.equal(bareProviderId("/usr/local/bin/claude"), "claude", "unix absolute path → bare id");
  assert.equal(bareProviderId("C:\\Users\\x\\claude.cmd"), "claude", "windows path + extension → bare id");
  assert.equal(bareProviderId("codex"), "codex", "already-bare stays bare");

  // 3. THE WALK IS GATE-SAFE: every harness the prefOrder walk names either has
  //    no registry spec (the walk honestly continues) or ONLY bins the Rust
  //    allowlist accepts — the seam can never send an ungatable identity.
  const m = seamSrc.match(/const prefOrder = \[([^\]]+)\]/);
  assert.ok(m, "the walk order is pinned in source");
  for (const id of (m![1].match(/"([^"]+)"/g) ?? []).map((x) => x.slice(1, -1))) {
    const spec = HARNESS_BY_ID.get(id as HarnessId);
    if (!spec) continue; // e.g. "llm": no spec → "unknown harness" → the walk continues
    for (const b of spec.bins) {
      assert.ok(rustSrc.includes('"' + b + '"'), 'walk bin "' + b + '" (' + id + ") is in the Rust allowlist");
    }
  }

  // 4. THE DYNAMIC MIRROR of the production resolution: POSIX only (the stub is
  //    a shell script); the contract pins above are platform-independent. Two
  //    copies of a harmless harness exist — an absolute-path copy OFF the PATH
  //    and a bare-name copy ON the PATH. If the wire identity were still the
  //    absolute path (the 16.9.7 bug), the wrong copy would answer.
  if (process.platform === "win32") {
    t.skip("the PATH-resolution mirror needs a POSIX stub — the wire-contract pins above are platform-independent");
    return;
  }
  // 4pre. the RAW boundary stays host-aware: outside Tauri it refuses in words
  //      (the typed host error) — the mirror below exists because a node probe
  //      cannot cross the real IPC; the contract pins above carry that proof.
  await assert.rejects(() => realBrainInvoke("/usr/local/bin/claude", ["x"], 5), BrainHostError,
    "outside Tauri the production invoke refuses in words — never a spawn, never a fake exit code");

  const dirAbs = fs.mkdtempSync(path.join(os.tmpdir(), "vh-abs-"));
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), "vh-pth-"));
  fs.writeFileSync(path.join(dirAbs, "vh-probe-harness"), '#!/bin/sh\necho "FROM-ABSOLUTE-PATH — the 16.9.7 bug ran this"\n');
  fs.writeFileSync(path.join(dirPath, "vh-probe-harness"), '#!/bin/sh\necho "VH-NATIVE-BOUNDARY-OK\n1. received: $1\n2. resolved by name\n3. executed for real"\n');
  fs.chmodSync(path.join(dirAbs, "vh-probe-harness"), 0o755);
  fs.chmodSync(path.join(dirPath, "vh-probe-harness"), 0o755);
  const oldPath = process.env.PATH ?? "";
  process.env.PATH = dirPath + path.delimiter + oldPath;
  try {
    // 4a. resolution by NAME: the bare id + PATH finds and runs the real stub
    //     (exactly what which_bin + Command::new do behind the gate).
    const run = await execFileP("vh-probe-harness", ["boundary proof"], { env: { ...process.env } });
    assert.ok(run.stdout.includes("VH-NATIVE-BOUNDARY-OK"), "the PATH-resolved bare id reached a REAL process and stdout came back");
    assert.ok(!run.stdout.includes("FROM-ABSOLUTE-PATH"), "the absolute-path copy never ran — resolution went through PATH by name");
    // 4b. honesty, mirrored: with the name absent from PATH, resolution FAILS —
    //     the gate reports "not installed", never a fabricated answer.
    process.env.PATH = oldPath;
    await assert.rejects(
      () => execFileP("vh-probe-harness", ["x"], { env: { ...process.env } }),
      /ENOENT|EACCES|EPERM|ENOEXEC/,
      "a bare id absent from PATH refuses (ENOENT/EACCES — portable to sandboxed filesystems) — the not-installed refusal is real",
    );
    // 4c. the full production shape end-to-end: resolve → invoke → parse → REAL
    //     label, with the seam's own normalization holding the wire identity.
    process.env.PATH = dirPath + path.delimiter + oldPath; // restore resolution
    const deps: BrainInvokeDeps = {
      resolve: () => ({ name: "Boundary stub", bin: path.join(dirAbs, "vh-probe-harness"), argv: ["$PROMPT"] }),
      invoke: async (bin, argv, timeoutSecs) => {
        assert.equal(bareProviderId(bin), "vh-probe-harness", "the boundary receives an absolute candidate; its wire identity is the bare id");
        // mirror the Tauri branch exactly: bare id on the wire, server-side
        // PATH resolution, REAL process, REAL stdout.
        const wire = bareProviderId(bin);
        try {
          const r = await execFileP(wire, argv, { env: { ...process.env }, timeout: timeoutSecs * 1000 });
          return { exitCode: 0, stdout: r.stdout, stderr: r.stderr, timedOut: false };
        } catch (e) {
          const err = e as { code?: string | number; stdout?: string; stderr?: string; killed?: boolean };
          if (err.code === "ENOENT") throw new BrainHostError("not installed on this host (bare id unresolved via PATH)");
          return { exitCode: typeof err.code === "number" ? err.code : 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "", timedOut: Boolean(err.killed) };
        }
      },
    };
    const r = await runModelPrompt("plan the boundary proof", "vh-probe-harness", deps);
    assert.ok(r.ok, "the boundary run succeeded: " + (r.ok ? "" : (r as { refused: string }).refused));
    if (r.ok) {
      const steps = planFromModelText(r.text);
      assert.ok(steps.length >= 3, "the REAL stdout parsed into a plan: " + steps.length + " steps");
      assert.equal(r.harness.id, "vh-probe-harness", "the plan carries the REAL harness identity");
      assert.ok(r.durationMs >= 0, "the real run is timed, labeled — never faked");
    }
  } finally {
    process.env.PATH = oldPath;
    fs.rmSync(dirAbs, { recursive: true, force: true });
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
});
