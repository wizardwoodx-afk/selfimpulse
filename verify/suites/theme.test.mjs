import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// probe/theme.test.ts
import * as fs from "node:fs";
import * as path from "node:path";
var passed = 0;
var failed = 0;
var failures = [];
function ok(label, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    failures.push(`${label}${detail ? ` \u2014 ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? ` \u2014 ${detail}` : ""}`);
  }
}
var ROOT = ".".length > 0 ? "." : process.cwd();
var css = fs.readFileSync(path.join(ROOT, "src", "ui", "vh.css"), "utf8");
var main = fs.readFileSync(path.join(ROOT, "src", "main.tsx"), "utf8");
ok("one stylesheet \u2014 main.tsx imports vh.css and nothing else", /import '\.\/ui\/vh\.css'/.test(main) && (main.match(/\.css['"]/g) ?? []).length === 1);
ok("the retired sheets are gone", !fs.existsSync(path.join(ROOT, "src", "styles")));
ok("dark ground is TRUE BLACK with raised near-black surfaces", /--bg:\s*#000000/i.test(css) && /--s2:\s*#101013/i.test(css));
ok("the rail sits on base (transparent over background, hairline separator)", /border-right:1px solid var\(--line\)/.test(css) && !/\.side\{background:var\(--bg-deep\)/.test(css.replace(/background:transparent/, "")));
ok("light ground is warm paper-cream with ink", /--bg:\s*#FAF7F1/i.test(css) && /#1A1D21/i.test(css));
ok("the light theme carries its own surface step", /--s3:\s*#ECE6DA/i.test(css));
ok("one teal-family accent \u2014 dark runs live mint on black, light holds deep teal", /--accent:\s*#006E6C/i.test(css) && /--accent:\s*#3CE8C9/i.test(css));
ok("no Apple-blue / competitor purple / electric cyan anywhere", !/#007AFF|#3B82F6|#2563EB|#7C3AED|#06B6D4|#007AFF/i.test(css));
ok("Geist Mono is the display voice (uppercase, tracked), Geist for body, no serif face", /--display:[^;]*Geist Mono/.test(css) && /Geist/.test(css) && /Geist Mono/.test(css) && !/Instrument Serif/.test(css));
ok("not Inter / JetBrains", !/font-family[^;}]*Inter\b/.test(css) && !/JetBrains/.test(css));
ok("weights top out at medium (500) \u2014 nothing semibold/bold/600+", !/font-weight:\s*(6|7|8|9)00/.test(css) && !/font-weight:\s*bold(?!.*oblique)/.test(css.replace(/font-weight:\(.*?\)/g, "")));
ok("no legacy animation gimmicks (splash, shimmer, glow keyframes)", !/@keyframes\s+(splash|shimmer|glow|pulseGlow|float)/.test(css));
ok("themes are attribute-scoped so both ship in one sheet", /\[data-theme=dark\]|\[data-theme="dark"\]/.test(css) && /\[data-theme=light\]|\[data-theme="light"\]/.test(css));
console.log(`
${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nfailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed > 0 ? 1 : 0);
