// Builds every SVG in /assets, in dark and light, from scripts/data.mjs.
//   node scripts/build.mjs            → static art (header, landmarks, route, legend)
//   node scripts/build.mjs --terrain  → also the contribution terrain (needs GH_TOKEN)
// No dependencies. Fonts are embedded (GitHub renders README SVGs as images, so they
// can't fetch web fonts); contours come from a value-noise field via marching squares.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LEGEND, PERSON, PROJECTS, ROUTE, THEMES } from "./data.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "assets");
mkdirSync(OUT, { recursive: true });

const font = (f) => readFileSync(join(here, "fonts", f)).toString("base64");
const FONTS = `
@font-face{font-family:Serif;src:url(data:font/woff2;base64,${font("serif.woff2")}) format("woff2");font-style:normal}
@font-face{font-family:Serif;src:url(data:font/woff2;base64,${font("serif-italic.woff2")}) format("woff2");font-style:italic}
@font-face{font-family:Mono;src:url(data:font/woff2;base64,${font("mono.woff2")}) format("woff2");font-weight:100 900}
.serif{font-family:Serif,Georgia,serif}.mono{font-family:Mono,ui-monospace,monospace}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r1 = (n) => Math.round(n * 10) / 10;

/* ───────────────────────── noise + contours ───────────────────────── */

function hash(x, y, seed) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
function fbm(x, y, seed) {
  let s = 0, a = 0.5;
  for (let o = 0; o < 4; o++) {
    s += a * noise(x, y, seed + o * 13);
    x = x * 2.03 + 1.7;
    y = y * 2.03 + 9.2;
    a *= 0.5;
  }
  return s;
}

/** Contour polylines for `levels` of a heightfield over w×h at `cell` px. */
function contours({ w, h, cell, levels, seed, scale, shift = 0, lift }) {
  const cols = Math.ceil(w / cell) + 1;
  const rows = Math.ceil(h / cell) + 1;
  const field = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = i * cell, y = j * cell;
      let v = fbm((x / scale) + shift, (y / scale) + shift * 0.6, seed);
      if (lift) v += lift(x, y);
      field[j * cols + i] = v;
    }
  let min = Infinity, max = -Infinity;
  for (const v of field) (min = Math.min(min, v)), (max = Math.max(max, v));
  const out = [];
  for (let L = 1; L <= levels; L++) {
    const t = min + ((max - min) * L) / (levels + 1);
    const segs = [];
    for (let j = 0; j < rows - 1; j++)
      for (let i = 0; i < cols - 1; i++) {
        const a = field[j * cols + i], b = field[j * cols + i + 1];
        const c = field[(j + 1) * cols + i + 1], d = field[(j + 1) * cols + i];
        const x = i * cell, y = j * cell;
        const pts = [];
        const edge = (va, vb, xa, ya, xb, yb) => {
          if ((va < t) !== (vb < t)) {
            const k = (t - va) / (vb - va);
            pts.push([r1(xa + (xb - xa) * k), r1(ya + (yb - ya) * k)]);
          }
        };
        edge(a, b, x, y, x + cell, y);
        edge(b, c, x + cell, y, x + cell, y + cell);
        edge(c, d, x + cell, y + cell, x, y + cell);
        edge(d, a, x, y + cell, x, y);
        if (pts.length === 2) segs.push(pts);
        else if (pts.length === 4) segs.push([pts[0], pts[1]], [pts[2], pts[3]]);
      }
    out.push({ index: L % 4 === 0, d: chain(segs) });
  }
  return out;
}

/** Join loose segments into polylines (much smaller paths). */
function chain(segs) {
  const key = (p) => `${p[0]},${p[1]}`;
  const ends = new Map();
  segs.forEach((s, i) => {
    for (const p of s) {
      const k = key(p);
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push(i);
    }
  });
  const used = new Uint8Array(segs.length);
  let d = "";
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const line = [...segs[i]];
    for (const dir of [1, -1]) {
      for (;;) {
        const tip = dir === 1 ? line[line.length - 1] : line[0];
        const next = (ends.get(key(tip)) ?? []).find((n) => !used[n]);
        if (next === undefined) break;
        used[next] = 1;
        const s = segs[next];
        const other = key(s[0]) === key(tip) ? s[1] : s[0];
        if (dir === 1) line.push(other);
        else line.unshift(other);
      }
    }
    d += `M${line.map((p) => `${p[0]} ${p[1]}`).join("L")}`;
  }
  return d;
}

const contourGroup = (set, t, cls = "") =>
  `<g class="${cls}" fill="none" stroke-linejoin="round">${set
    .map((c) => `<path d="${c.d}" stroke="${c.index ? t.index : t.contour}" stroke-width="${c.index ? 1.4 : 0.8}"/>`)
    .join("")}</g>`;

function neatline(w, h, t, step = 100) {
  let s = `<rect x="12" y="12" width="${w - 24}" height="${h - 24}" fill="none" stroke="${t.line}"/>`;
  for (let x = 12 + step; x < w - 12; x += step) s += `<line x1="${x}" y1="12" x2="${x}" y2="20" stroke="${t.muted}" stroke-opacity=".5"/><line x1="${x}" y1="${h - 12}" x2="${x}" y2="${h - 20}" stroke="${t.muted}" stroke-opacity=".5"/>`;
  for (let y = 12 + step; y < h - 12; y += step) s += `<line x1="12" y1="${y}" x2="20" y2="${y}" stroke="${t.muted}" stroke-opacity=".5"/><line x1="${w - 12}" y1="${y}" x2="${w - 20}" y2="${y}" stroke="${t.muted}" stroke-opacity=".5"/>`;
  return s;
}

const svg = (w, h, body, css = "", title = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"${title ? ` aria-label="${esc(title)}"` : ""}><style>${FONTS}${css}</style>${body}</svg>`;

const write = (name, content) => {
  writeFileSync(join(OUT, name), content);
  console.log(`${name.padEnd(28)} ${(content.length / 1024).toFixed(0)} KB`);
};

/* ───────────────────────── header ───────────────────────── */

function header(t) {
  const W = 1200, H = 430;
  // the cursor-hill from the portfolio becomes a fixed summit over Addis
  const lift = (x, y) => 0.32 * Math.exp(-(((x - 140) ** 2) / 36000 + ((y - 250) ** 2) / 22000));
  const a = contours({ w: W, h: H, cell: 9, levels: 16, seed: 3, scale: 230, lift });
  const namePath = "M 58 242 C 310 154, 680 138, 1036 190";
  const river = "M -20 318 C 150 282, 260 342, 430 312 S 700 262, 860 300 S 1080 346, 1220 296";
  const css = `
  .name{fill:${t.ink};fill-opacity:0;stroke:${t.ink};stroke-width:.8;stroke-dasharray:2400;stroke-dashoffset:2400;animation:engrave 3.2s cubic-bezier(.16,1,.3,1) .3s forwards}
  @keyframes engrave{70%{fill-opacity:0}to{stroke-dashoffset:0;fill-opacity:1}}
  .flow{stroke-dasharray:12 9;animation:flow 6s linear infinite}@keyframes flow{to{stroke-dashoffset:-210}}
  .ping{transform-origin:76px 268px;animation:ping 2.4s cubic-bezier(.2,.6,.3,1) infinite}@keyframes ping{from{transform:scale(.5);opacity:.9}to{transform:scale(3);opacity:0}}
  .fade{opacity:0;animation:fade 1.2s ease-out forwards}@keyframes fade{to{opacity:1}}
  .needle{transform-origin:1096px 92px;animation:sway 9s ease-in-out infinite}@keyframes sway{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(9deg)}}`;
  const ticks = Array.from({ length: 36 }, (_, i) => {
    const ang = (i * 10 * Math.PI) / 180, long = i % 9 === 0;
    return `<line x1="${r1(1096 + Math.sin(ang) * 46)}" y1="${r1(92 - Math.cos(ang) * 46)}" x2="${r1(1096 + Math.sin(ang) * (long ? 38 : 42))}" y2="${r1(92 - Math.cos(ang) * (long ? 38 : 42))}" stroke="${t.muted}" stroke-opacity="${long ? 0.8 : 0.4}"/>`;
  }).join("");
  const body = `
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  <defs>
    <clipPath id="sheet"><rect x="12" y="12" width="${W - 24}" height="${H - 24}"/></clipPath>
    <radialGradient id="veil" cx="35%" cy="62%" r="60%"><stop offset="0" stop-color="${t.bg}" stop-opacity=".88"/><stop offset=".6" stop-color="${t.bg}" stop-opacity=".35"/><stop offset="1" stop-color="${t.bg}" stop-opacity="0"/></radialGradient>
  </defs>
  <g clip-path="url(#sheet)">
    ${contourGroup(a, t)}
    <rect width="${W}" height="${H}" fill="url(#veil)"/>
    <path d="${river}" fill="none" stroke="${t.water}" stroke-width="10" stroke-opacity=".14"/>
    <path d="${river}" fill="none" stroke="${t.water}" stroke-width="1.8" class="flow"/>
    <path id="river" d="${river}" fill="none"/>
    <text class="serif fade" font-style="italic" font-size="34" letter-spacing="10" fill="${t.water}" style="animation-delay:1.8s"><textPath href="#river" startOffset="58%" dy="-12">Abay</textPath></text>
  </g>
  ${neatline(W, H, t)}
  <text x="40" y="52" class="mono" font-size="11" letter-spacing="2.6" fill="${t.muted}">SHEET 00 · GITHUB · ${esc(PERSON.handle.toUpperCase())}</text>
  <text x="${W - 160}" y="52" class="mono" font-size="11" letter-spacing="2.6" fill="${t.muted}" text-anchor="end">ADDIS ABABA · 1 : 25 000</text>
  <path id="name" d="${namePath}" fill="none"/>
  <text class="serif name" font-size="104"><textPath href="#name" textLength="968" lengthAdjust="spacing">${esc(PERSON.name)}</textPath></text>
  <g class="fade" style="animation-delay:1.4s">
    <circle cx="76" cy="268" r="6" fill="none" stroke="${t.accent}" class="ping"/>
    <circle cx="76" cy="268" r="5.5" fill="${t.accent}"/>
    <text x="94" y="272" class="mono" font-size="11.5" letter-spacing="2" fill="${t.muted}">YOU ARE HERE · ${esc(PERSON.coords.toUpperCase())}</text>
  </g>
  <g class="fade" style="animation-delay:2.2s">
    <text x="40" y="384" class="serif" font-size="27" fill="${t.ink}">${esc(PERSON.role)} — <tspan font-style="italic" fill="${t.accent}">${esc(PERSON.tagline.charAt(0).toLowerCase() + PERSON.tagline.slice(1))}</tspan></text>
  </g>
  <g>
    <circle cx="1096" cy="92" r="46" fill="${t.bg}" fill-opacity=".75" stroke="${t.muted}" stroke-opacity=".5"/>${ticks}
    <g class="needle"><path d="M1096 58 L1102 92 L1096 97 L1090 92 Z" fill="${t.accent}"/><path d="M1096 126 L1102 92 L1096 87 L1090 92 Z" fill="${t.muted}" fill-opacity=".5"/></g>
    <text x="1096" y="36" class="serif" font-size="15" fill="${t.ink}" text-anchor="middle">N</text>
  </g>
  <g transform="translate(${W - 212} ${H - 56})">
    <rect width="160" height="6" fill="none" stroke="${t.ink}" stroke-opacity=".6"/>
    ${[0, 1, 2, 3].map((i) => (i % 2 ? "" : `<rect x="${i * 40}" width="40" height="6" fill="${t.ink}" fill-opacity=".6"/>`)).join("")}
    <text y="22" class="mono" font-size="10" fill="${t.muted}">0</text>
    <text x="80" y="22" class="mono" font-size="10" fill="${t.muted}" text-anchor="middle">500 m</text>
    <text x="160" y="22" class="mono" font-size="10" fill="${t.muted}" text-anchor="end">1 km</text>
  </g>`;
  return svg(W, H, body, css, `${PERSON.name} ${PERSON.surname} — ${PERSON.role}`);
}

/* ───────────────────────── landmark cards ───────────────────────── */

function wrap(text, max) {
  const words = text.split(" ");
  const lines = [""];
  for (const w of words) {
    if ((lines[lines.length - 1] + " " + w).trim().length > max) lines.push(w);
    else lines[lines.length - 1] = (lines[lines.length - 1] + " " + w).trim();
  }
  return lines;
}

function glyph(kind, t) {
  // small illustrations, drawn in a 150×150 box
  switch (kind) {
    case "spike":
      return `<path d="M0 118 L20 114 L38 117 L56 112 L70 116 L78 40 L86 116 L104 113 L122 116 L150 112" fill="none" stroke="${t.ink}" stroke-width="2"/><path d="M74 80 L78 40 L82 80" fill="none" stroke="${t.accent}" stroke-width="2.6"/><line x1="0" x2="150" y1="90" y2="90" stroke="${t.accent}" stroke-dasharray="4 4" stroke-opacity=".7"/>`;
    case "receipt":
      return `<path d="M20 6 H130 V138 l-10 -7 -10 7 -10 -7 -10 7 -10 -7 -10 7 -10 -7 -10 7 -10 -7 -10 7 -10 -7 Z" fill="${t.panel}" stroke="${t.ink}" stroke-width="1.5"/>${[0, 1, 2, 3, 4]
        .map((i) => `<rect x="34" y="${26 + i * 18}" width="${[30, 62, 44, 80, 20][i]}" height="7" fill="${i === 4 ? t.accent : t.ink}" fill-opacity="${i === 4 ? 1 : 0.75}"/>`)
        .join("")}<line x1="32" x2="118" y1="116" y2="116" stroke="${t.ink}" stroke-dasharray="3 3" stroke-opacity=".6"/>`;
    case "contours":
      return Array.from({ length: 7 }, (_, i) => `<ellipse cx="75" cy="75" rx="${10 + i * 10}" ry="${7 + i * 8}" fill="none" stroke="${i % 3 === 0 ? t.index : t.ink}" stroke-opacity="${0.35 + (i % 3 === 0 ? 0.4 : 0)}" transform="rotate(${i * 6} 75 75)"/>`).join("") + `<circle cx="75" cy="75" r="4" fill="${t.accent}"/>`;
    case "grid":
      return Array.from({ length: 36 }, (_, i) => {
        const x = (i % 6) * 24 + 12, y = Math.floor(i / 6) * 24 + 12;
        const hot = [8, 9, 14, 15, 16, 21, 27].includes(i);
        return `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" fill="${hot ? t.accent : t.ink}" fill-opacity="${hot ? 0.9 : 0.15 + ((i * 7) % 5) * 0.05}"/>`;
      }).join("");
    case "signal":
      return `<circle cx="20" cy="75" r="6" fill="${t.accent}"/>${[30, 52, 74, 96, 118].map((r, i) => `<path d="M${20 + r * 0.7} ${75 - r * 0.7} A ${r} ${r} 0 0 1 ${20 + r * 0.7} ${75 + r * 0.7}" fill="none" stroke="${t.ink}" stroke-opacity="${0.8 - i * 0.13}" stroke-width="1.6"/>`).join("")}<text x="128" y="140" class="mono" font-size="10" fill="${t.muted}" text-anchor="end">200 OK · retry 3/5</text>`;
    case "strata":
      return [0, 1, 2, 3, 4, 5].map((i) => `<path d="M0 ${20 + i * 22} C 40 ${12 + i * 22 + (i % 2) * 10}, 100 ${30 + i * 22 - (i % 3) * 8}, 150 ${18 + i * 22}" fill="none" stroke="${i === 3 ? t.accent : t.ink}" stroke-opacity="${i === 3 ? 1 : 0.55}" stroke-width="${i === 3 ? 2.4 : 1.3}"/>`).join("");
    default:
      return "";
  }
}

function card(p, i, t) {
  const W = 600, H = 280;
  const patch = contours({ w: W, h: H, cell: 12, levels: 9, seed: 20 + i * 7, scale: 160 });
  const lines = wrap(p.line, 44).slice(0, 4);
  const tick = (x, y, sx, sy) => `<path d="M${x} ${y + sy * 14} V${y} H${x + sx * 14}" fill="none" stroke="${t.accent}" stroke-width="2"/>`;
  const body = `
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  <defs><linearGradient id="fadeL" x1="0" x2="1"><stop offset="0" stop-color="${t.bg}"/><stop offset=".55" stop-color="${t.bg}" stop-opacity=".9"/><stop offset="1" stop-color="${t.bg}" stop-opacity=".2"/></linearGradient></defs>
  ${contourGroup(patch, t)}
  <rect width="${W}" height="${H}" fill="url(#fadeL)"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="${t.line}"/>
  ${tick(1, 1, 1, 1)}${tick(W - 1, 1, -1, 1)}${tick(1, H - 1, 1, -1)}${tick(W - 1, H - 1, -1, -1)}
  <text x="32" y="44" class="mono" font-size="11" letter-spacing="2.4" fill="${t.muted}"><tspan fill="${t.accent}">◆</tspan> SHEET ${String(i + 1).padStart(2, "0")} · GRID ${p.grid}</text>
  <text x="30" y="104" class="serif" font-size="56" fill="${t.ink}">${esc(p.name)}</text>
  ${lines.map((l, k) => `<text x="32" y="${140 + k * 20}" class="mono" font-size="13" fill="${t.muted}">${esc(l)}</text>`).join("")}
  <text x="32" y="${H - 30}" class="mono" font-size="11.5" letter-spacing="1" fill="${t.accent}">${esc(p.stack.toUpperCase())}</text>
  <text x="${W - 32}" y="${H - 30}" class="mono" font-size="11.5" fill="${t.ink}" text-anchor="end">↗ ${esc(p.label)}</text>
  <g transform="translate(${W - 190} 54)">${glyph(p.glyph, t)}</g>`;
  return svg(W, H, body, "", `${p.name}: ${p.line}`);
}

/* ───────────────────────── the route ───────────────────────── */

function route(t) {
  const W = 1200, H = 300;
  const n = ROUTE.length;
  const pts = ROUTE.map((_, i) => [132 + (i * (W - 264)) / (n - 1), i % 2 ? 168 : 132]);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < n; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`;
  }
  const css = `.drive{stroke-dasharray:1600;stroke-dashoffset:1600;animation:drive 4.5s cubic-bezier(.65,0,.35,1) .4s forwards}@keyframes drive{to{stroke-dashoffset:0}}
  .wp{opacity:0;animation:pop .6s ease-out forwards}@keyframes pop{to{opacity:1}}
  .ping{transform-box:fill-box;transform-origin:center;animation:ping 2.4s cubic-bezier(.2,.6,.3,1) infinite}@keyframes ping{from{transform:scale(.6);opacity:.9}to{transform:scale(2.6);opacity:0}}`;
  const body = `
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  ${neatline(W, H, t)}
  <text x="40" y="48" class="mono" font-size="11" letter-spacing="2.6" fill="${t.muted}">THE ROUTE · 2022 → NOW · ${n - 1} STOPS</text>
  <path d="${d}" fill="none" stroke="${t.index}" stroke-width="2" stroke-dasharray="2 7"/>
  <path d="${d}" fill="none" stroke="${t.accent}" stroke-width="3" class="drive"/>
  ${ROUTE.map((s, i) => {
    const [x, y] = pts[i];
    const up = i % 2 === 0;
    const ty = up ? y - 34 : y + 46;
    const delay = 0.4 + (i / (n - 1)) * 4.2;
    const mark =
      s.kind === "next"
        ? `<circle cx="${x}" cy="${y}" r="9" fill="none" stroke="${t.accent}" class="ping"/><circle cx="${x}" cy="${y}" r="9" fill="${t.bg}" stroke="${t.accent}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="4" fill="${t.accent}"/>`
        : s.kind === "depart"
          ? `<circle cx="${x}" cy="${y}" r="9" fill="${t.bg}" stroke="${t.accent}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="4" fill="${t.ink}"/>`
          : `${s.kind === "now" ? `<circle cx="${x}" cy="${y}" r="11" fill="none" stroke="${t.accent}" class="ping"/>` : ""}<rect x="${x - 8}" y="${y - 8}" width="16" height="16" transform="rotate(45 ${x} ${y})" fill="${s.kind === "now" ? t.accent : t.bg}" stroke="${t.accent}" stroke-width="2"/>`;
    return `<g class="wp" style="animation-delay:${delay.toFixed(2)}s">${mark}
      <text x="${x}" y="${ty - 20}" class="mono" font-size="11" letter-spacing="2" fill="${t.accent}" text-anchor="middle">${esc(s.at.toUpperCase())}</text>
      <text x="${x}" y="${ty}" class="serif" font-size="25" fill="${t.ink}" text-anchor="middle">${esc(s.name)}</text>
      <text x="${x}" y="${ty + 18}" class="mono" font-size="11" fill="${t.muted}" text-anchor="middle">${esc(s.role)}</text></g>`;
  }).join("")}`;
  return svg(W, H, body, css, `Career route: ${ROUTE.map((s) => s.name).join(" → ")}`);
}

/* ───────────────────────── legend ───────────────────────── */

function symbol(kind, t) {
  switch (kind) {
    case "pillar":
      return `<path d="M14 2 L26 24 H2 Z" fill="none" stroke="${t.accent}" stroke-width="1.6"/><circle cx="14" cy="17" r="2.6" fill="${t.accent}"/>`;
    case "summit":
      return `<path d="M1 24 L10 8 L15 15 L19 10 L27 24 Z" fill="none" stroke="${t.accent}" stroke-width="1.6"/><path d="M10 8 L12 11.5 L8 11.5 Z" fill="${t.accent}"/>`;
    case "station":
      return `<rect x="5" y="10" width="18" height="14" fill="none" stroke="${t.accent}" stroke-width="1.6"/><path d="M5 10 L14 3 L23 10" fill="none" stroke="${t.accent}" stroke-width="1.6"/><rect x="11" y="16" width="6" height="8" fill="${t.accent}"/>`;
    default:
      return `<rect x="2" y="5" width="24" height="18" fill="none" stroke="${t.accent}" stroke-width="1.6"/><path d="M2 13 L10 5 M2 21 L18 5 M8 23 L26 5 M16 23 L26 13" stroke="${t.accent}"/>`;
  }
}

function legend(t) {
  const W = 1200, H = 304;
  const colW = (W - 80) / LEGEND.length;
  const body = `
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  ${neatline(W, H, t)}
  <text x="40" y="48" class="mono" font-size="11" letter-spacing="2.6" fill="${t.muted}">LEGEND · WHAT THE MARKS ON THIS MAP MEAN</text>
  ${LEGEND.map((g, i) => {
    const x = 40 + i * colW;
    return `<g transform="translate(${x} 74)">
      ${symbol(g.symbol, t)}
      <text x="40" y="20" class="serif" font-size="25" fill="${t.ink}">${esc(g.title)}</text>
      ${g.items.map((it, k) => `<rect x="2" y="${48 + k * 25}" width="6" height="6" transform="rotate(45 5 ${51 + k * 25})" fill="${t.muted}"/><text x="18" y="${55 + k * 25}" class="mono" font-size="13" fill="${t.muted}">${esc(it)}</text>`).join("")}
    </g>${i ? `<line x1="${x - 20}" x2="${x - 20}" y1="74" y2="${H - 40}" stroke="${t.line}"/>` : ""}`;
  }).join("")}`;
  return svg(W, H, body, "", `Skills legend: ${LEGEND.map((g) => g.title).join(", ")}`);
}

/* ───────────────────────── terrain (contributions) ───────────────────────── */

async function fetchContributions() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GH_TOKEN is required for --terrain");
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount weekday}}}}}}`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "profile-atlas" },
    body: JSON.stringify({ query, variables: { login: PERSON.handle } }),
  });
  const json = await res.json();
  if (!json.data) throw new Error(JSON.stringify(json.errors ?? json));
  return json.data.user.contributionsCollection.contributionCalendar;
}

function smooth(points) {
  // Catmull-Rom → cubic Bézier
  let d = `M${r1(points[0][0])} ${r1(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${r1(c1[0])} ${r1(c1[1])}, ${r1(c2[0])} ${r1(c2[1])}, ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d;
}

function terrain(cal, t) {
  const W = 1200, H = 400;
  const weeks = cal.weeks;
  const left = 70, right = W - 60;
  const max = Math.max(1, ...weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)));
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const rowGap = 22;
  const top = 208;
  const amp = 84;
  const x = (i) => left + (i * (right - left)) / (weeks.length - 1);
  // busiest week
  let peak = { i: 0, total: -1 };
  weeks.forEach((w, i) => {
    const total = w.contributionDays.reduce((s, d) => s + d.contributionCount, 0);
    if (total > peak.total) peak = { i, total, date: w.contributionDays[0]?.date };
  });
  const ridges = [];
  for (let day = 0; day < 7; day++) {
    const base = top + day * rowGap;
    const pts = weeks.map((w, i) => {
      const d = w.contributionDays.find((c) => c.weekday === day);
      const v = d ? d.contributionCount : 0;
      return [x(i), base - Math.sqrt(v / max) * amp];
    });
    const line = smooth(pts);
    ridges.push(`<g class="ridge" style="animation-delay:${(day * 0.18).toFixed(2)}s">
      <path d="${line} L${right} ${base + 2} L${left} ${base + 2} Z" fill="${t.bg}"/>
      <path d="${line}" fill="none" stroke="${day === 3 ? t.index : t.ink}" stroke-opacity="${day === 3 ? 1 : 0.55}" stroke-width="1.4"/>
      <text x="${left - 14}" y="${base + 4}" class="mono" font-size="10" fill="${t.muted}" text-anchor="end">${dayNames[day]}</text></g>`);
  }
  const months = [];
  let last = "";
  weeks.forEach((w, i) => {
    const m = w.contributionDays[0]?.date.slice(0, 7);
    if (m && m !== last) {
      last = m;
      if (i > 0 && i < weeks.length - 2)
        months.push(`<text x="${x(i)}" y="${top + 6 * rowGap + 34}" class="mono" font-size="10" fill="${t.muted}">${new Date(`${m}-01T00:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase()}</text>`);
    }
  });
  const px = x(peak.i);
  const css = `.ridge{opacity:0;animation:rise 1.2s cubic-bezier(.16,1,.3,1) forwards}@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .flag{opacity:0;animation:rise 1s ease-out 1.6s forwards}`;
  const peakDate = peak.date ? new Date(`${peak.date}T00:00:00Z`).toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "";
  const body = `
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  ${neatline(W, H, t)}
  <text x="40" y="48" class="mono" font-size="11" letter-spacing="2.6" fill="${t.muted}">TERRAIN · ONE RIDGE PER WEEKDAY · HEIGHT = CONTRIBUTIONS</text>
  <text x="${W - 40}" y="48" class="mono" font-size="11" letter-spacing="2.6" fill="${t.muted}" text-anchor="end">REBUILT DAILY</text>
  <text x="40" y="86" class="serif" font-size="30" fill="${t.ink}">${cal.totalContributions.toLocaleString("en-US")} contributions <tspan font-style="italic" fill="${t.accent}">in the last year.</tspan></text>
  ${ridges.join("")}
  ${months.join("")}
  <g class="flag"><line x1="${px}" x2="${px}" y1="${top - amp - 6}" y2="${top + 6 * rowGap + 6}" stroke="${t.accent}" stroke-dasharray="3 4"/>
  <rect x="${px - 5}" y="${top - amp - 14}" width="10" height="10" transform="rotate(45 ${px} ${top - amp - 9})" fill="${t.accent}"/>
  <text x="${px + (px > W - 260 ? -14 : 14)}" y="${top - amp - 4}" class="mono" font-size="11" fill="${t.ink}" text-anchor="${px > W - 260 ? "end" : "start"}">SUMMIT · WEEK OF ${peakDate.toUpperCase()} · ${peak.total}</text></g>`;
  return svg(W, H, body, css, `${cal.totalContributions} GitHub contributions in the last year, drawn as terrain`);
}

/* ───────────────────────── build ───────────────────────── */

for (const [name, t] of Object.entries(THEMES)) {
  write(`header-${name}.svg`, header(t));
  write(`route-${name}.svg`, route(t));
  write(`legend-${name}.svg`, legend(t));
  PROJECTS.forEach((p, i) => write(`landmark-${p.name.toLowerCase()}-${name}.svg`, card(p, i, t)));
}
if (process.argv.includes("--terrain")) {
  const cal = await fetchContributions();
  for (const [name, t] of Object.entries(THEMES)) write(`terrain-${name}.svg`, terrain(cal, t));
}
