#!/usr/bin/env node
// Lists every colour literal in the public templates, the menu kit and the public stylesheet (Kian, 2026-10-08: no public
// page may keep a hard-coded colour outside the token defaults file, src/venues/tokens.ts). Looks for hex colours, rgb()/
// hsl() and friends, CSS named colours in property values, and Tailwind palette utilities (bg-white, text-black,
// border-black/10, text-neutral-500…). `transparent`, `currentColor` and `inherit` are not colours. Exit 1 when any is found.
//   node scripts/check-colour-literals.mjs [--json out.json] [files…]
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_FILES = [
  'src/components/menu-kit.tsx', 'src/components/Welcome.tsx', 'src/components/LangToggle.tsx', 'src/components/Bi.tsx', 'src/lib/welcome.ts',
  'src/venues/senso.tsx', 'src/venues/kebab-land.tsx', 'src/venues/default.tsx', 'src/venues/styles.ts',
  'src/pages/senso.tsx', 'src/pages/kebab-land.tsx', 'src/pages/[venue].tsx', 'src/pages/_app.tsx', 'src/pages/_document.tsx',
  'src/styles/public.css',
];
const TOKENS_FILE = 'src/venues/tokens.ts';
const argv = process.argv.slice(2);
const jsonOut = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null;
const files = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--json');
const list = files.length ? files : DEFAULT_FILES;

const NAMED = 'aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen';
const TW_PALETTE = 'white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const TW_PREFIX = 'bg|text|border|divide|ring|ring-offset|outline|fill|stroke|shadow|from|via|to|decoration|accent|caret|placeholder|inset-ring|border-[trblxyse]|border-[se]';
const RULES = [
  { kind: 'hex', re: /#[0-9a-f]{3,8}\b/gi, test: (m) => [3, 4, 6, 8].includes(m.length - 1) },
  { kind: 'function', re: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/gi },
  { kind: 'named (css value)', re: new RegExp(`:\\s*[^;{}]*?\\b(${NAMED})\\b`, 'gi'), cssOnly: true },
  { kind: 'tailwind palette', re: new RegExp(`(?<![\\w-])(?:hover:|focus:|active:|focus-visible:|dark:|group-hover:)?(?:${TW_PREFIX})-(?:${TW_PALETTE})(?:-\\d{2,3})?(?:/\\[?[\\d.]+\\]?)?(?![\\w-])`, 'g') },
];
// A line (or a CSS declaration) is scanned without its string-free parts: URLs and SVG data are not colours of the page, and a
// reference to a custom property (var(--c-welcome-snow): a token name, not a value; 2026-10-09) is never a literal.
const STRIP = [/url\([^)]*\)/g, /https?:\/\/\S+/g, /var\(--[a-z0-9-]+\)/g];

const found = [];
for (const file of list) {
  if (!fs.existsSync(file)) { found.push({ file, line: 0, kind: 'missing file', match: '' }); continue; }
  const isCss = file.endsWith('.css');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((raw, i) => {
    let line = raw; for (const s of STRIP) line = line.replace(s, 'URL');
    for (const r of RULES) {
      if (r.cssOnly && !isCss) continue;
      for (const m of line.matchAll(r.re)) {
        const text = m[0];
        if (r.test && !r.test(text)) continue; // (an id selector such as #welcome, #tabs or the scene symbols #wl1… never matches: those names are not hex digits)
        found.push({ file, line: i + 1, kind: r.kind, match: text, context: raw.trim().slice(0, 160) });
      }
    }
  });
}
const tokensHas = fs.existsSync(TOKENS_FILE) ? (fs.readFileSync(TOKENS_FILE, 'utf8').match(/#[0-9a-f]{6}\b/gi) || []).length : 0;
for (const f of found) console.log(`${f.file}:${f.line} ${f.kind}: ${f.match}    ${f.context}`);
console.log(`${found.length} colour literal(s) in ${list.length} public files (${list.join(', ')}); ${tokensHas} hex literals live in ${TOKENS_FILE}, the token defaults file, where they belong`);
if (jsonOut) fs.writeFileSync(path.resolve(jsonOut), JSON.stringify({ at: new Date().toISOString(), files: list, tokensFile: TOKENS_FILE, tokensFileHexLiterals: tokensHas, literals: found, count: found.length, pass: found.length === 0 }, null, 2));
console.log(found.length === 0 ? 'PASS' : 'FAIL');
process.exit(found.length === 0 ? 0 : 1);
