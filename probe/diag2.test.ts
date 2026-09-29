import { MissionRuntime, createServices } from "../src/mission/missionRuntime";
import { instantiateTemplate } from "../src/mission/templates";
import { DEFAULT_BOUNDARY, DEFAULT_BUDGET, DEFAULT_POLICY } from "../src/mission/types";
const m = instantiateTemplate("tpl.software-development", { objective: "Build a production-ready SaaS billing feature in TypeScript", name: "d", workspace: "." });
m.successCriteria = ["Builds without errors","Tests pass"];
m.budget = { ...DEFAULT_BUDGET, maxCostUsd: 5, maxRetriesPerTask: 3, maxConcurrentAgents: 6, maxGraphMutations: 4 };
m.riskPolicy = { ...DEFAULT_POLICY, autonomy: "SUPERVISED", approvalThreshold: "HIGH", allowReorganization: true, allowHarnessSwitch: true };
m.boundary = { ...DEFAULT_BOUNDARY, shell: true, filesystemWrite: true, credentials: false, browser: false };
const services = createServices();
const rt = new MissionRuntime(m, services, { allowSimulated: true, installed: { "local-test": true }, approvalTimeoutMs: 4000 });
rt.prepare(); rt.buildOrganization();
await rt.run();
const ev = rt.getEvents();
for (const k of ["REPAIR_STARTED","REPAIR_COMPLETED"]) {
  const rows = ev.filter((e)=>e.kind===k);
  const byPolicy: Record<string, number> = {};
  for (const e of rows) byPolicy[e.policy] = (byPolicy[e.policy] ?? 0) + 1;
  console.log(k, "=", rows.length, JSON.stringify(byPolicy));
  for (const e of rows.slice(0,3)) console.log("   sample:", e.seq, e.policy, "::", e.reason.slice(0,90), "| subj", e.subjectId);
}
const seqs = ev.map((e)=>e.seq);
console.log("total", ev.length, "min seq", seqs[0], "max seq", seqs[seqs.length-1], "unique seqs", new Set(seqs).size);

/* ── audit H5: this suite used to only PRINT (exit 0 no matter what). It
   asserts now — a diagnostic that cannot fail is not a check. ── */
let _pass = 0, _fail = 0;
function _ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { _pass += 1; console.log(" ok  ", label); }
  else { _fail += 1; console.log("  FAIL", label, detail); }
}
_ok("the runtime recorded events", ev.length > 0, String(ev.length));
_ok("event sequence numbers are unique (ledger integrity)", new Set(seqs).size === ev.length, `unique ${new Set(seqs).size} of ${ev.length}`);
console.log(`\n${_pass} passed, ${_fail} failed`);
if (_fail > 0) process.exit(1);
