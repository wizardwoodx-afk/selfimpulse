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
var hex = (h) => {
  const s = h.replace("#", "").trim();
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};
var relLum = (h) => {
  const c = hex(h).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
var hueOf = (h) => {
  const [r, g, b] = hex(h);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  if (d === 0) return 0;
  let x = mx === r ? 60 * ((g - b) / d % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return x < 0 ? x + 360 : x;
};
var token = (theme, name) => {
  const block = css.match(new RegExp(`\\[data-theme=${theme}\\]\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  const m = block?.[1].match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`, "i"));
  return m ? m[1] : "";
};
ok("one stylesheet \u2014 main.tsx imports vh.css and nothing else", /import '\.\/ui\/vh\.css'/.test(main) && (main.match(/\.css['"]/g) ?? []).length === 1);
ok("the retired sheets are gone", !fs.existsSync(path.join(ROOT, "src", "styles")));
var darkBg = token("dark", "bg");
var darkS1 = token("dark", "s1");
var darkS2 = token("dark", "s2");
var darkS3 = token("dark", "s3");
var contrast = (a, b) => {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
var REJECTED_FLAT_S1_LUM = 45e-4;
ok(
  "the dark ground is true black and the surface ramp is measurably raised above it",
  /^#000000$/i.test(darkBg) && relLum(darkS1) < relLum(darkS2) && relLum(darkS2) < relLum(darkS3) && relLum(darkS1) > REJECTED_FLAT_S1_LUM,
  `bg ${darkBg} (lum ${relLum(darkBg)}), s1 ${darkS1} (${relLum(darkS1).toFixed(5)}), s2 ${darkS2}, s3 ${darkS3}`
);
ok("the rail sits on base (transparent over background, hairline separator)", /border-right:1px solid var\(--line\)/.test(css) && !/\.side\{background:var\(--bg-deep\)/.test(css.replace(/background:transparent/, "")));
var lightBg = token("light", "bg");
var lightFg = token("light", "fg");
ok(
  "light ground is paper-cream, not screen-white, and the ink on it is ink",
  relLum(lightBg) > 0.75 && relLum(lightBg) < 1 && relLum(lightFg) < 0.05 && contrast(lightFg, lightBg) >= 4.5,
  `bg ${lightBg} (lum ${relLum(lightBg).toFixed(4)}), fg ${lightFg} (${relLum(lightFg).toFixed(4)}), contrast ${contrast(lightFg, lightBg).toFixed(2)}:1`
);
ok(
  "the light theme carries its own surface step",
  relLum(token("light", "s3")) > 0 && relLum(token("light", "s3")) < relLum(lightBg),
  `s3 ${token("light", "s3")} vs bg ${lightBg}`
);
var darkAccent = token("dark", "accent");
var lightAccent = token("light", "accent");
ok(
  "one desaturated teal accent \u2014 dark pulls brighter, light holds deeper",
  Math.abs(hueOf(darkAccent) - hueOf(lightAccent)) < 8 && relLum(darkAccent) > relLum(lightAccent) * 2 && contrast(darkAccent, darkBg) >= 4.5 && contrast(lightAccent, lightBg) >= 4.5,
  `dark ${darkAccent} (hue ${hueOf(darkAccent).toFixed(0)}, ${contrast(darkAccent, darkBg).toFixed(2)}:1), light ${lightAccent} (hue ${hueOf(lightAccent).toFixed(0)}, ${contrast(lightAccent, lightBg).toFixed(2)}:1)`
);
ok("no Apple-blue / competitor purple / electric cyan anywhere", !/#007AFF|#3B82F6|#2563EB|#7C3AED|#06B6D4|#007AFF/i.test(css));
ok("Instrument Serif for display, Geist for body and mono", /Instrument Serif/.test(css) && /Geist/.test(css) && /Geist Mono/.test(css));
ok("not Inter / JetBrains", !/font-family[^;}]*Inter\b/.test(css) && !/JetBrains/.test(css));
ok("weights top out at medium (500) \u2014 nothing semibold/bold/600+", !/font-weight:\s*(6|7|8|9)00/.test(css) && !/font-weight:\s*bold(?!.*oblique)/.test(css.replace(/font-weight:\(.*?\)/g, "")));
ok("no legacy animation gimmicks (splash, shimmer, glow keyframes)", !/@keyframes\s+(splash|shimmer|glow|pulseGlow|float)/.test(css));
ok("themes are attribute-scoped so both ship in one sheet", /\[data-theme=dark\]|\[data-theme="dark"\]/.test(css) && /\[data-theme=light\]|\[data-theme="light"\]/.test(css));
var indexHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
var inline = indexHtml.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
var inlineDark = inline.match(/html,body\{[^}]*?background:\s*(#[0-9a-fA-F]{3,8})/)?.[1] ?? "";
var inlineLight = inline.match(/\[data-theme="light"\][^{]*\{[^}]*?background:\s*(#[0-9a-fA-F]{3,8})/)?.[1] ?? "";
ok(
  "the inline boot ground EQUALS --bg in vh.css \u2014 they cannot separate again",
  inlineDark.toLowerCase() === darkBg.toLowerCase() && inlineLight.toLowerCase() === lightBg.toLowerCase(),
  `index.html ${inlineDark}/${inlineLight} vs vh.css ${darkBg}/${lightBg}`
);
console.log(`
${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nfailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed > 0 ? 1 : 0);
