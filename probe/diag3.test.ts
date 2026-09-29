import { MissionRuntime, createServices } from "../src/mission/missionRuntime";
import { instantiateTemplate } from "../src/mission/templates";
import { DEFAULT_BOUNDARY, DEFAULT_BUDGET, DEFAULT_POLICY } from "../src/mission/types";
const m = instantiateTemplate("tpl.software-development", { objective: "Build a production-ready SaaS billing feature in TypeScript", name: "d", workspace: "." });
m.successCriteria = ["Builds without errors","Tests pass"];
m.budget = { ...DEFAULT_BUDGET, maxCostUsd: 5, maxRetriesPerTask: 3, maxConcurrentAgents: 6, maxGraphMutations: 4 };
m.riskPolicy = { ...DEFAULT_POLICY, autonomy: "SUPERVISED", approvalThreshold: "HIGH", allowReorganization: true, allowHarnessSwitch: true };
m.boundary = { ...DEFAULT_BOUNDARY, shell: true, filesystemWrite: true, credentials: false, browser: false };
const services = createServices();
const rt = new MissionRuntime(m, services, { allowSimulated: true, installed: { "local-test": true }, approvalTimeoutMs: 3000 });
rt.prepare(); rt.buildOrganization();
await rt.run();
console.log("mission status:", m.status);
for (const t of rt.org.tasks_()) console.log(` task ${t.title} | ${t.state} | risk=${t.risk} cls=${t.cls} deps=[${t.dependsOn.join(",")}] err=${(t.error??"").slice(0,60)}`);
console.log("approvals:", services.approvals.forMission(m.missionId).length);
const arts = services.artifacts.forMission(m.missionId);
console.log("artifacts:", arts.length);
for (const a of arts.slice(0,8)) console.log(`  ${a.name} v${a.version} passed=${a.evaluation?.passed} fullyMeasured=${a.evaluation?.fullyMeasured} unmeasured=[${(a.evaluation?.unmeasured??[]).join("; ")}]`);
const ev = rt.getEvents();
console.log("event kinds:", [...new Set(ev.map(e=>e.kind))].sort().join(", "));
console.log("last 3:", ev.slice(-3).map(e=>e.kind+" :: "+e.reason.slice(0,100)).join("\n        "));

/* ── audit H5: this suite used to only PRINT (exit 0 no matter what). It
   asserts now — a diagnostic that cannot fail is not a check. ── */
let _pass = 0, _fail = 0;
function _ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { _pass += 1; console.log(" ok  ", label); }
  else { _fail += 1; console.log("  FAIL", label, detail); }
}
_ok("the mission carries a status", typeof m.status === "string" && m.status.length > 0, String(m.status));
_ok("the runtime recorded events", ev.length > 0, String(ev.length));
console.log(`\n${_pass} passed, ${_fail} failed`);
if (_fail > 0) process.exit(1);
