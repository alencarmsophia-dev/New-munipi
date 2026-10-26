#!/usr/bin/env node
// ============================================================================
// scripts/build-ufs.js — Conversor zero-dependências de GeoJSON do IBGE
// para caminhos SVG simplificados em public/uf-paths.js (viewBox 0 0 640 640).
//
// Uso:
//   node scripts/build-ufs.js caminho/para/br-ufs-ibge.geojson
// ============================================================================

const fs = require('fs');
const path = require('path');

const IBGE_TO_UF = {
  11: 'ro', 12: 'ac', 13: 'am', 14: 'rr', 15: 'pa', 16: 'ap', 17: 'to',
  21: 'ma', 22: 'pi', 23: 'ce', 24: 'rn', 25: 'pb', 26: 'pe', 27: 'al', 28: 'se', 29: 'ba',
  31: 'mg', 32: 'es', 33: 'rj', 35: 'sp',
  41: 'pr', 42: 'sc', 43: 'rs',
  50: 'ms', 51: 'mt', 52: 'go', 53: 'df',
};

const UF_INFO = {
  ac: { name: 'Acre', reg: 'Norte', ibge: 12, row: 3, col: 0 },
  al: { name: 'Alagoas', reg: 'Nordeste', ibge: 27, row: 3, col: 7, lx: 608, ly: 254 },
  ap: { name: 'Amapá', reg: 'Norte', ibge: 16, row: 0, col: 3 },
  am: { name: 'Amazonas', reg: 'Norte', ibge: 13, row: 2, col: 1 },
  ba: { name: 'Bahia', reg: 'Nordeste', ibge: 29, row: 4, col: 5 },
  ce: { name: 'Ceará', reg: 'Nordeste', ibge: 23, row: 1, col: 6 },
  df: { name: 'Distrito Federal', reg: 'Centro-Oeste', ibge: 53, row: 4, col: 4, lx: 446, ly: 326 },
  es: { name: 'Espírito Santo', reg: 'Sudeste', ibge: 32, row: 5, col: 6 },
  go: { name: 'Goiás', reg: 'Centro-Oeste', ibge: 52, row: 4, col: 3 },
  ma: { name: 'Maranhão', reg: 'Nordeste', ibge: 21, row: 1, col: 4 },
  mt: { name: 'Mato Grosso', reg: 'Centro-Oeste', ibge: 51, row: 4, col: 2 },
  ms: { name: 'Mato Grosso do Sul', reg: 'Centro-Oeste', ibge: 50, row: 5, col: 2 },
  mg: { name: 'Minas Gerais', reg: 'Sudeste', ibge: 31, row: 5, col: 5 },
  pa: { name: 'Pará', reg: 'Norte', ibge: 15, row: 1, col: 3 },
  pb: { name: 'Paraíba', reg: 'Nordeste', ibge: 25, row: 2, col: 7, lx: 608, ly: 198 },
  pr: { name: 'Paraná', reg: 'Sul', ibge: 41, row: 6, col: 3 },
  pe: { name: 'Pernambuco', reg: 'Nordeste', ibge: 26, row: 3, col: 6, lx: 608, ly: 226 },
  pi: { name: 'Piauí', reg: 'Nordeste', ibge: 22, row: 2, col: 5 },
  rj: { name: 'Rio de Janeiro', reg: 'Sudeste', ibge: 33, row: 6, col: 5 },
  rn: { name: 'Rio Grande do Norte', reg: 'Nordeste', ibge: 24, row: 1, col: 7, lx: 608, ly: 170 },
  rs: { name: 'Rio Grande do Sul', reg: 'Sul', ibge: 43, row: 8, col: 3 },
  ro: { name: 'Rondônia', reg: 'Norte', ibge: 11, row: 3, col: 1 },
  rr: { name: 'Roraima', reg: 'Norte', ibge: 14, row: 0, col: 1 },
  sc: { name: 'Santa Catarina', reg: 'Sul', ibge: 42, row: 7, col: 3 },
  sp: { name: 'São Paulo', reg: 'Sudeste', ibge: 35, row: 6, col: 4 },
  se: { name: 'Sergipe', reg: 'Nordeste', ibge: 28, row: 4, col: 6, lx: 608, ly: 282 },
  to: { name: 'Tocantins', reg: 'Norte', ibge: 17, row: 3, col: 3 },
  zz: { name: 'Exterior', reg: 'Exterior', ibge: 0, row: 8, col: 6 },
};

function mercatorRaw(lon, lat) {
  const x = (lon * Math.PI) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return [x, -y];
}

// Simplificação Ramer-Douglas-Peucker para manter caminhos leves e precisos
function simplifyRDP(pts, sqTol) {
  if (pts.length <= 2) return pts;
  let maxDistSq = 0;
  let index = 0;
  const [x1, y1] = pts[0];
  const [x2, y2] = pts[pts.length - 1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    const dSq = (px - projX) ** 2 + (py - projY) ** 2;
    if (dSq > maxDistSq) {
      index = i;
      maxDistSq = dSq;
    }
  }

  if (maxDistSq > sqTol) {
    const left = simplifyRDP(pts.slice(0, index + 1), sqTol);
    const right = simplifyRDP(pts.slice(index), sqTol);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[pts.length - 1]];
}

const inputPath = process.argv[2];
if (!inputPath || !fs.existsSync(inputPath)) {
  console.log('Uso: node scripts/build-ufs.js <caminho-do-geojson-ibge>');
  console.log('Nenhum arquivo GeoJSON externo informado; mantendo public/uf-paths.js atual.');
  process.exit(0);
}

const geojson = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

function scanRing(ring) {
  for (const [lon, lat] of ring) {
    const [rx, ry] = mercatorRaw(lon, lat);
    if (rx < minX) minX = rx;
    if (rx > maxX) maxX = rx;
    if (ry < minY) minY = ry;
    if (ry > maxY) maxY = ry;
  }
}

for (const f of geojson.features || []) {
  const g = f.geometry;
  if (!g) continue;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) {
    for (const ring of poly) scanRing(ring);
  }
}

const padL = 16, padR = 56, padT = 18, padB = 18;
const availW = 640 - padL - padR;
const availH = 640 - padT - padB;
const scale = Math.min(availW / (maxX - minX), availH / (maxY - minY));
const offX = padL + (availW - (maxX - minX) * scale) / 2;
const offY = padT + (availH - (maxY - minY) * scale) / 2;

function proj(lon, lat) {
  const [rx, ry] = mercatorRaw(lon, lat);
  return [
    Number((offX + (rx - minX) * scale).toFixed(1)),
    Number((offY + (ry - minY) * scale).toFixed(1)),
  ];
}

const pathsOut = {};
const centroidsOut = {};

for (const f of geojson.features || []) {
  const props = f.properties || {};
  const code = Number(props.codarea || props.CD_UF || props.id);
  const sigla = (props.sigla || props.SIGLA_UF || IBGE_TO_UF[code] || '').toLowerCase();
  if (!sigla || !UF_INFO[sigla]) continue;

  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let d = '';
  let bestRing = [];

  for (const poly of polys) {
    for (const ring of poly) {
      const projected = ring.map(([lon, lat]) => proj(lon, lat));
      const simplified = simplifyRDP(projected, 0.45);
      if (simplified.length < 3) continue;
      if (simplified.length > bestRing.length) bestRing = simplified;
      d += 'M' + simplified.map((p) => `${p[0]},${p[1]}`).join('L') + 'Z';
    }
  }
  pathsOut[sigla] = d;
  if (bestRing.length) {
    const cx = bestRing.reduce((s, p) => s + p[0], 0) / bestRing.length;
    const cy = bestRing.reduce((s, p) => s + p[1], 0) / bestRing.length;
    centroidsOut[sigla] = [Number(cx.toFixed(1)), Number(cy.toFixed(1))];
  }
}

let out = '// Gerado por scripts/build-ufs.js\nexport const UF_META = {\n';
for (const [uf, m] of Object.entries(UF_INFO)) {
  const [cx, cy] = centroidsOut[uf] || [580, 580];
  const callout = m.lx ? `, lx: ${m.lx}, ly: ${m.ly}` : '';
  out += `  ${uf}: { name: ${JSON.stringify(m.name)}, reg: ${JSON.stringify(m.reg)}, ibge: ${m.ibge}, row: ${m.row}, col: ${m.col}, cx: ${cx}, cy: ${cy}${callout} },\n`;
}
out += '};\n\nexport const UF_PATHS = {\n';
for (const [uf, d] of Object.entries(pathsOut)) {
  out += `  ${uf}: ${JSON.stringify(d)},\n`;
}
out += '};\n';

const targetFile = path.join(__dirname, '..', 'public', 'uf-paths.js');
fs.writeFileSync(targetFile, out, 'utf8');
console.log(`Gravado ${targetFile} (${out.length} bytes)`);
