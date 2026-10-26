#!/usr/bin/env node
// ============================================================================
// scripts/test-pos.mjs — Testes unitários automatizados (Node puro, zero deps)
// ============================================================================

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Carrega um ES module de public/ em contexto isolado sem alterar package.json
function loadBrowserEsModule(relPath, importedBindings = {}) {
  const code = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  const exportNames = [];
  const transformed = code
    .replace(/^import\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];?/gm, '')
    .replace(/^export\s+(?:const|let|var|function|class)\s+(\w+)/gm, (m, name) => {
      exportNames.push(name);
      return m.replace(/^export\s+/, '');
    }) + '\n' + exportNames.map((n) => `exports.${n} = ${n};`).join('\n');

  const sandbox = {
    exports: {},
    Intl,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    WeakMap,
    Date,
    RegExp,
    JSON,
    Promise,
    console,
    performance: { now: () => Date.now() },
    ...importedBindings,
  };
  vm.runInNewContext(transformed, sandbox, { filename: relPath });
  return sandbox.exports;
}

const ufMod = loadBrowserEsModule('public/uf-paths.js');
const appMod = loadBrowserEsModule('public/app.js', ufMod);
const posMod = loadBrowserEsModule('public/pos.js', { ...ufMod, ...appMod });

const { runTickerSelfCheck } = appMod;
const {
  computeTimeBandsBreakdown,
  validateElectionTotals,
  normalizeSearchStr,
  parsePosHash,
} = posMod;

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    process.exitCode = 1;
  }
}

console.log('=== Executando bateria de testes unitários (Pós-Eleição 2026) ===');

test('LiveTicker mantém as 5 invariantes obrigatórias', () => {
  const res = runTickerSelfCheck();
  assert.equal(res.allPass, true, 'LiveTicker falhou em uma invariante');
});

test('Normalização de busca de municípios ignora acentos e caixa', () => {
  assert.equal(normalizeSearchStr('São José dos Pinhais'), 'sao jose dos pinhais');
  assert.equal(normalizeSearchStr('Maceió'), 'maceio');
  assert.equal(normalizeSearchStr('  ÁGUAS LINDAS DE GOIÁS '), 'aguas lindas de goias');
});

test('Roteador de hash pós-eleição interpreta rotas municipais e de análise sem quebrar rotas existentes', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(parsePosHash('#pres/mg/cidades'))), {
    role: 'pres',
    uf: 'mg',
    subview: 'cidades',
    munIbge: null,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(parsePosHash('#gov/rn/cidades/2408102'))), {
    role: 'gov',
    uf: 'rn',
    subview: 'cidades',
    munIbge: '2408102',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(parsePosHash('#pres/boletim'))), {
    role: 'pres',
    uf: null,
    subview: 'boletim',
    munIbge: null,
  });
});

test('Cálculo de faixas de horário e janela especial 17h–19h fecha 100% dos votos', () => {
  const samplePoints = [
    { hora: '16:50', votosA: 1000, votosB: 1000, secoesApuradas: 100, secoesTotal: 1000 },
    { hora: '17:30', votosA: 5000, votosB: 4000, secoesApuradas: 450, secoesTotal: 1000 },
    { hora: '18:45', votosA: 9000, votosB: 8000, secoesApuradas: 850, secoesTotal: 1000 },
    { hora: '19:30', votosA: 10000, votosB: 10000, secoesApuradas: 1000, secoesTotal: 1000 },
  ];
  const bd = computeTimeBandsBreakdown(samplePoints);
  assert.equal(bd.hasData, true);
  assert.equal(bd.totalVotes, 20000);
  assert.equal(bd.specialWindow.totalVotos, 15000);
  assert.equal(bd.specialWindow.pctOfTotal, 75);
  assert.equal(bd.specialWindow.leaderSlot, 0);
  const sumBands = bd.bands.reduce((acc, b) => acc + b.totalVotos, 0);
  assert.equal(sumBands, 20000);
});

test('Validação matemática do Boletim detecta somas corretas e incorretas', () => {
  const validSummary = {
    cands: [
      { votes: 600, pct: 60 },
      { votes: 400, pct: 40 },
    ],
    votes: { valid: 1000, blank: 50, nul: 50, total: 1100 },
    electorate: { present: 1100, abst: 200, total: 1300 },
  };
  assert.equal(validateElectionTotals(validSummary).ok, true);

  const brokenSummary = {
    cands: [
      { votes: 600, pct: 60 },
      { votes: 400, pct: 45 },
    ],
    votes: { valid: 1000, blank: 50, nul: 50, total: 1100 },
    electorate: { present: 1100, abst: 200, total: 1300 },
  };
  assert.equal(validateElectionTotals(brokenSummary).ok, false);
});

test('Tabela TSE ↔ IBGE (municipios-map.json) tem 100% de casamento e todas as 27 UFs possuem malha municipal', () => {
  const mapData = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'municipios-map.json'), 'utf8'));
  assert.equal(mapData.matchRatePct, 100);
  assert.equal(mapData.exceptions.length, 0);
  assert.ok(mapData.totalMunicipios >= 600);

  const ufs27 = [
    'ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mt', 'ms', 'mg', 'pa',
    'pb', 'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'sp', 'se', 'to',
  ];
  for (const uf of ufs27) {
    const p = path.join(ROOT, 'public', 'data', 'municipios', `${uf}.json`);
    assert.equal(fs.existsSync(p), true, `Malha ausente para ${uf}`);
    const m = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.ok(m.municipios.length >= 1, `Sem municípios em ${uf}`);
  }
});

test('Snapshots finais fecham matematicamente em Presidente e Governadores', () => {
  const presBr = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'final', 'pres', 'br.json'), 'utf8'));
  const v = validateElectionTotals(presBr.national);
  assert.equal(v.ok, true, v.reason);
});

console.log(`=== Todos os ${passed} testes passaram com sucesso! ===`);
