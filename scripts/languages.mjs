// Builds languages-{dark,light}.svg from the language bytes of the owner's
// public, non-fork, non-archived repositories.
// Usage: GITHUB_TOKEN=... node scripts/languages.mjs <owner> <outDir>
import { mkdir, writeFile } from "node:fs/promises";

const [owner = "th7bo", outDir = "dist"] = process.argv.slice(2);
const TOP = 6;
const IGNORE = new Set(["JSON", "Jupyter Notebook", "Makefile", "Batchfile", "Procfile", "Dockerfile"]);
const DEVICON = "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons";
const ICONS = {
  Kotlin: "kotlin/kotlin-original", Java: "java/java-original", TypeScript: "typescript/typescript-original",
  JavaScript: "javascript/javascript-original", Go: "go/go-original", Python: "python/python-original",
  "C#": "csharp/csharp-original", C: "c/c-original", "C++": "cplusplus/cplusplus-original",
  Rust: "rust/rust-original", Astro: "astro/astro-original", HTML: "html5/html5-original",
  CSS: "css3/css3-original", SCSS: "sass/sass-original", Lua: "lua/lua-original", Luau: "lua/lua-original",
  Shell: "bash/bash-original", PHP: "php/php-original", Svelte: "svelte/svelte-original",
  Vue: "vuejs/vuejs-original", Dart: "dart/dart-original", Swift: "swift/swift-original",
  Ruby: "ruby/ruby-original", Groovy: "groovy/groovy-original", Docker: "docker/docker-original",
};
const THEMES = {
  dark: { fg: "#f0f6fc", muted: "#9198a1", track: "#21262d", shades: ["#ffb35c", "#ff9e3d", "#f08a24", "#d9640b", "#b4520a", "#8a4a12"] },
  light: { fg: "#1f2328", muted: "#59636e", track: "#eaeef2", shades: ["#c2570c", "#d9640b", "#e8780f", "#f08a24", "#ffa552", "#ffc285"] },
};

const headers = { Accept: "application/vnd.github+json", "User-Agent": "profile-languages" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const repos = [];
for (let page = 1; ; page++) {
  const batch = await gh(`/users/${owner}/repos?type=owner&per_page=100&page=${page}`);
  repos.push(...batch);
  if (batch.length < 100) break;
}

const totals = {};
for (const repo of repos.filter((r) => !r.fork && !r.archived && r.name.toLowerCase() !== owner.toLowerCase())) {
  for (const [lang, bytes] of Object.entries(await gh(`/repos/${owner}/${repo.name}/languages`))) {
    if (!IGNORE.has(lang)) totals[lang] = (totals[lang] ?? 0) + bytes;
  }
}

const sum = Object.values(totals).reduce((a, b) => a + b, 0);
if (!sum) throw new Error("No language data found");
const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, TOP)
  .map(([name, bytes]) => ({ name, pct: (bytes / sum) * 100 }));

const iconCache = {};
async function icon(name) {
  const path = ICONS[name];
  if (!path) return null;
  if (!(name in iconCache)) {
    const res = await fetch(`${DEVICON}/${path}.svg`);
    iconCache[name] = res.ok ? `data:image/svg+xml;base64,${Buffer.from(await res.text()).toString("base64")}` : null;
  }
  return iconCache[name];
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function render(t) {
  const W = 900, COLS = 3, CW = 260, GX = 40, RH = 56;
  const rows = Math.ceil(top.length / COLS);
  const H = 4 + rows * RH;
  const cells = [];
  for (const [i, l] of top.entries()) {
    const x = 4 + (i % COLS) * (CW + GX), y = 10 + Math.floor(i / COLS) * RH;
    const href = await icon(l.name);
    const shade = t.shades[i % t.shades.length];
    const mark = href
      ? `<image href="${href}" x="${x}" y="${y}" width="30" height="30"/>`
      : `<rect x="${x + 3}" y="${y + 3}" width="24" height="24" rx="3" fill="${shade}"/>`;
    const barW = 210, fillW = Math.max(4, (l.pct / top[0].pct) * barW);
    cells.push(`<g>
    ${mark}
    <text x="${x + 44}" y="${y + 13}" class="m" font-size="14" fill="${t.fg}">${esc(l.name)}</text>
    <text x="${x + 44 + barW}" y="${y + 13}" class="m" font-size="12" fill="${t.muted}" text-anchor="end">${l.pct.toFixed(1)}%</text>
    <rect x="${x + 44}" y="${y + 22}" width="${barW}" height="6" rx="1.5" fill="${t.track}"/>
    <rect x="${x + 44}" y="${y + 22}" width="${fillW.toFixed(1)}" height="6" rx="1.5" fill="${shade}"/>
  </g>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Top languages: ${top.map((l) => `${esc(l.name)} ${l.pct.toFixed(1)}%`).join(", ")}">
  <style>
    .m{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace}
  </style>
  ${cells.join("\n  ")}
</svg>
`;
}

await mkdir(outDir, { recursive: true });
for (const [name, t] of Object.entries(THEMES)) {
  await writeFile(`${outDir}/languages-${name}.svg`, await render(t));
}
console.log(top.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join("\n"));
