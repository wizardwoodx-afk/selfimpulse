/**
 * probe/a2aHostLifecycle.test.ts — does the A2A host actually STAY MOUNTED?
 *
 * This suite exists because of a bug that no source-reading review would have
 * caught, and a real user would have caught in one click.
 *
 * The desktop app mounted the A2A host through `shell_exec`, which ends in
 * `run_timeout()`: spawn, wait for exit, and `child.kill()` on the deadline. An
 * A2A host is a server — it never exits on its own — so the call waited 20
 * seconds, killed the freshly-started listener, and returned a timeout. The UI
 * showed a failed mount for a process that had, in fact, started correctly and
 * been murdered by its own supervisor.
 *
 * So this suite runs the real bundled host as a real child process and asks the
 * only question that matters: after it says it is ready, is it still alive
 * twenty-plus seconds later? That is the property the new supervisor exists to
 * provide, and it is the property the old code path could not.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as path from "node:path";

const ROOT: string = process.env.HANDLE_ROOT ?? process.cwd();

let passed = 0;
let failed = 0;
const failures: string[] = [];
const ok = (label: string, cond: boolean, detail = ""): void => {
  if (cond) { passed += 1; console.log(`  ok   ${label}`); }
  else { failed += 1; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
};
const section = (n: string): void => console.log(`\n== ${n}`);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface Launched {
  child: ChildProcessWithoutNullStreams;
  ready: Record<string, unknown> | null;
  readyAt: number | null;
  stdout: string;
  stderr: string;
  exited: { code: number | null; at: number } | null;
}

function launchHost(extra: string[] = []): Launched {
  const child = spawn(process.execPath, [
    path.join(ROOT, "tools", "vh-host.mjs"),
    "--harbor", "LIFECYCLE-PROBE",
    "--port", "0",
    ...extra,
  ], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }) as ChildProcessWithoutNullStreams;

  const state: Launched = { child, ready: null, readyAt: null, stdout: "", stderr: "", exited: null };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (c: string) => {
    state.stdout += c;
    for (const line of c.split("\n")) {
      if (line.startsWith("VH-A2A-READY") && !state.ready) {
        try { state.ready = JSON.parse(line.slice("VH-A2A-READY".length).trim()); } catch { state.ready = {}; }
        state.readyAt = Date.now();
      }
    }
  });
  child.stderr.on("data", (c: string) => { state.stderr += c; });
  child.on("exit", (code) => { state.exited = { code, at: Date.now() }; });
  return state;
}

async function main(): Promise<void> {
  section("1. the bundled host starts and announces itself");
  const h = launchHost();
  try {
    const deadline = Date.now() + 40_000;
    while (!h.ready && !h.exited && Date.now() < deadline) await sleep(200);
    ok("the host reports VH-A2A-READY", h.ready !== null, h.stderr.slice(0, 300) || h.stdout.slice(0, 300));
    ok("it is running, and says so in the descriptor", h.ready?.mounted === true, JSON.stringify(h.ready).slice(0, 200));
    ok("it names the port it actually bound", typeof (h.ready as Record<string, unknown> | null)?.port === "number");
    ok("it publishes a card URL", typeof (h.ready as Record<string, unknown> | null)?.cardUrl === "string");
    ok("the card is signed", (h.ready as Record<string, unknown> | null)?.cardSigned === true);
    ok("it has a pid", typeof h.child.pid === "number" && h.child.pid > 0);

    section("2. IT STAYS MOUNTED — the bug this suite was written for");
    /* 22 seconds is chosen deliberately: it is longer than the 20-second
     * timeout the old mount path used, so a host that dies "on its own" at the
     * old deadline fails here. Waiting from READY rather than from spawn keeps
     * the check honest on a slow machine. */
    const aliveAt = (h.readyAt ?? Date.now()) + 22_000;
    while (Date.now() < aliveAt) await sleep(500);
    const aliveNow = h.exited === null;
    ok("the host is STILL ALIVE 22s after it said it was ready", aliveNow,
      aliveNow ? "" : `it exited with code ${h.exited?.code} at ${(h.exited!.at - (h.readyAt ?? h.exited!.at)) / 1000}s — this is exactly the old timeout bug`);
    ok("so a supervisor that waits on it would kill a healthy listener", aliveNow,
      "if this fails the process dies by itself, which is a different bug and should be reported as such");

    section("3. the port is actually served while mounted");
    const port = (h.ready as Record<string, unknown> | null)?.port as number | undefined;
    if (typeof port === "number") {
      let served = false;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/.well-known/agent-card.json`, { signal: AbortSignal.timeout(5000) });
        served = res.ok;
      } catch { served = false; }
      ok("the signed card is fetchable on the bound port while mounted", served,
        "the port is claimed but nothing answers it");
    } else {
      ok("the signed card is fetchable on the bound port while mounted", false, "no port was reported");
    }

    section("4. an explicit stop is what ends it — not a deadline");
    const stopAt = Date.now();
    h.child.kill("SIGTERM");
    const stopDeadline = stopAt + 15_000;
    while (h.exited === null && Date.now() < stopDeadline) await sleep(200);
    ok("SIGTERM ends the host", h.exited !== null, `still running ${(Date.now() - stopAt) / 1000}s after the stop`);
    ok("it unmounted in words", /VH-A2A-STOPPED|unmounting|stopped/i.test(h.stdout + h.stderr),
      (h.stdout + h.stderr).split("\n").slice(-3).join(" | ").slice(0, 200));
    ok("the stop was clean, not a kill -9", h.exited?.code === 0 || h.exited?.code === 143 || h.exited === null,
      `exit code ${h.exited?.code}`);

    if (typeof port === "number") {
      await sleep(500);
      let stillAnswering = true;
      try {
        await fetch(`http://127.0.0.1:${port}/.well-known/agent-card.json`, { signal: AbortSignal.timeout(2500) });
      } catch { stillAnswering = false; }
      ok("the port stops answering once the host is stopped", !stillAnswering,
        "something is still serving the card after the host exited");
    }
  } finally {
    if (h.exited === null) { h.child.kill("SIGKILL"); await sleep(300); }
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed) {
    console.log(failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
}

void main();
