import { MissionRuntime, createServices, graphFromSteps } from "../src/mission/missionRuntime";
import { instantiateTemplate } from "../src/mission/templates";
import { DEFAULT_BOUNDARY, DEFAULT_BUDGET, DEFAULT_POLICY } from "../src/mission/types";
import { validateWorkflow } from "../src/graph/validation";
import { classifyRisk } from "../src/mission/riskPolicy";

const m = instantiateTemplate("tpl.software-development", { objective: "Build a production-ready SaaS billing feature in TypeScript", name: "p", workspace: "." });
m.budget = { ...DEFAULT_BUDGET, maxCostUsd: 5, maxRetriesPerTask: 3, maxGraphMutations: 4 };
m.riskPolicy = { ...DEFAULT_POLICY, autonomy: "SUPERVISED", approvalThreshold: "HIGH" };
m.boundary = { ...DEFAULT_BOUNDARY, shell: true, filesystemWrite: true };
const rt = new MissionRuntime(m, createServices(), { allowSimulated: true, installed: { "local-test": true } });
const plan = rt.prepare();
for (const s of plan.steps) console.log(`${s.id} kind=${s.kind} risk=${s.risk} appr=${s.requiresApproval} def=${s.agentDefId} :: ${s.title}`);
console.log("approvalCheckpoints:", JSON.stringify(plan.approvalCheckpoints));
console.log("classify deploy:", JSON.stringify(classifyRisk("Deploy the billing service to production")));
console.log("classify ship:", JSON.stringify(classifyRisk("Ship release to production")));
const g = graphFromSteps(m, plan.steps);
console.log("graph nodes:", g.nodes.length, "wires:", g.connections.length);
const v = validateWorkflow(g);
console.log("validation issues:", JSON.stringify(v, null, 1));
for (const n of g.nodes) console.log("  node", n.id, n.definitionId, "| purpose set:", n.purpose.trim().length > 0);

/* ── audit H5: this suite used to only PRINT (exit 0 no matter what). It
   asserts now — a diagnostic that cannot fail is not a check. ── */
let _pass = 0, _fail = 0;
function _ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { _pass += 1; console.log(" ok  ", label); }
  else { _fail += 1; console.log("  FAIL", label, detail); }
}
_ok("the plan has steps", plan.steps.length >= 1, String(plan.steps.length));
_ok("every step carries id, kind and risk", plan.steps.every((s) => !!s.id && !!s.kind && typeof s.risk === "string"));
_ok("approval checkpoints are an array", Array.isArray(plan.approvalCheckpoints));
console.log(`\n${_pass} passed, ${_fail} failed`);
if (_fail > 0) process.exit(1);
