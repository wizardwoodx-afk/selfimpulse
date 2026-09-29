import { DEFINITIONS_BY_ID } from "../src/domain/nodeLibrary";
const pick = ["agent.architect","agent.coder","agent.tester","agent.reviewer","agent.synthesizer","agent.researcher"];
for (const id of pick) {
  const d = DEFINITIONS_BY_ID.get(id);
  if (!d) { console.log(id, "MISSING"); continue; }
  console.log(id, "| in:", JSON.stringify((d.inputs??[]).map((p:any)=>[p.id,p.label,p.dataType,p.required])), "| out:", JSON.stringify((d.outputs??[]).map((p:any)=>[p.id,p.label,p.dataType])));
}
console.log("--- candidates for a source/brief node ---");
console.log([...DEFINITIONS_BY_ID.keys()].filter((k)=>/input|source|brief|objective|seed|start/i.test(k)).join("\n"));

/* ── audit H5: this suite used to only PRINT (exit 0 no matter what). It
   asserts now — a diagnostic that cannot fail is not a check. ── */
let _pass = 0, _fail = 0;
function _ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { _pass += 1; console.log(" ok  ", label); }
  else { _fail += 1; console.log("  FAIL", label, detail); }
}
for (const id of pick) {
  const d = DEFINITIONS_BY_ID.get(id);
  _ok(`node definition ships: ${id}`, !!d, "missing from DEFINITIONS_BY_ID");
  if (d) {
    _ok(`${id} declares inputs and outputs`, (d.inputs ?? []).length >= 1 && (d.outputs ?? []).length >= 1);
  }
}
console.log(`\n${_pass} passed, ${_fail} failed`);
if (_fail > 0) process.exit(1);
