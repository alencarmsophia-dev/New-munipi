#!/usr/bin/env node
// ============================================================================
// scripts/build-snapshot.js — Congelador de snapshot final pós-eleição e
// construtor do esquema de evolução por horários (public/data/horarios.json).
//
// Uso:
//   1. Em máquina com internet para baixar os arquivos finais oficiais do TSE
//      (eleição 6258 Presidente e 6260 Governador — nacional, 27 UFs + ZZ e municípios):
//        node scripts/build-snapshot.js --fetch
//
//   2. Para importar um diretório de snapshots EA20 gravados durante a apuração
//      e gerar public/data/horarios.json com os carimbos dt/ht reais:
//        node scripts/build-snapshot.js --history-dir ./meus-snapshots-br
//
//   3. Modo de demonstração/teste local (--sim) consistente com o simulador de server.js:
//        node scripts/build-snapshot.js --sim
// ============================================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FINAL_DIR = path.join(ROOT, 'public', 'data', 'final');
const MUN_MESH_DIR = path.join(ROOT, 'public', 'data', 'municipios');
const HORARIOS_FILE = path.join(ROOT, 'public', 'data', 'horarios.json');

const UFS = [
  'ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mt', 'ms', 'mg', 'pa',
  'pb', 'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'sp', 'se', 'to', 'zz',
];
const GOV_UFS = ['ac', 'am', 'df', 'es', 'rn', 'to'];

const GOV_META = {
  ac: { margem: 12.6, c: [['11', 'PP', 'Mailza Assis'], ['10', 'REPUBLICANOS', 'Alan Rick']] },
  am: { margem: -3.2, c: [['55', 'PSD', 'Omar Aziz'], ['22', 'PL', 'Professora Maria do Carmo']] },
  df: { margem: 8.4, c: [['11', 'PP', 'Celina Leão'], ['13', 'PT', 'Leandro Grass']] },
  es: { margem: 0.3, c: [['10', 'REPUBLICANOS', 'Lorenzo Pazolini'], ['15', 'MDB', 'Ricardo Ferraço']] },
  rn: { margem: -1.4, c: [['44', 'UNIÃO', 'Allyson'], ['13', 'PT', 'Cadu de Lula']] },
  to: { margem: 4.2, c: [['44', 'UNIÃO', 'Professora Dorinha'], ['45', 'PSDB', 'Vicentinho Júnior']] },
};

const PRES_DIFF = {
  ac: -22.4, al: 16.8, ap: 4.2, am: 8.6, ba: 38.4, ce: 34.2, df: -15.4,
  es: 0.32, go: -18.6, ma: 36.1, mt: -26.8, ms: -14.2, mg: 1.84, pa: 9.4,
  pb: 28.6, pr: -24.2, pe: 31.8, pi: 46.2, rj: -11.4, rn: 25.4, rs: -12.6,
  ro: -28.4, rr: -32.0, sc: -34.8, sp: -9.6, se: 29.2, to: 3.4, zz: 1.4, br: 1.76,
};

const num = (s) => (s == null || s === '' ? 0 : Number(String(s).replace(',', '.')) || 0);

function parseEA20(j, cargoCode = '1') {
  if (!j || typeof j !== 'object') return null;
  const wanted = Number(cargoCode);
  const cargList = j.carg || [];
  const carg = cargList.find((c) => Number(c.cd) === wanted) || (cargList.length === 1 ? cargList[0] : null);
  if (!carg) return null;

  const cands = [];
  (carg.agr || []).forEach((a) =>
    (a.par || []).forEach((p) =>
      (p.cand || []).forEach((c) => {
        cands.push({
          key: String(c.sqcand || c.n),
          seq: Number(c.seq) || 0,
          n: String(c.n || ''),
          name: c.nmu || c.nm || '',
          party: String(p.sg || '').trim(),
          votes: Math.max(0, Math.floor(Number(c.vap) || 0)),
          pct: num(c.pvapn ?? c.pvap),
          elected: c.e === 's',
        });
      })
    )
  );

  const s = j.s || {};
  const v = j.v || {};
  const e = j.e || {};

  return {
    cands,
    sections: {
      total: Number(s.ts) || 0,
      done: Number(s.st) || 0,
      pct: num(s.pstn ?? s.pst),
    },
    electorate: {
      total: Number(e.te) || 0,
      present: Number(e.c) || 0,
      ppresent: num(e.pcn ?? e.pc),
      abst: Number(e.a) || 0,
      pabst: num(e.pan ?? e.pa),
    },
    votes: {
      total: Number(v.tv) || 0,
      valid: Number(v.vv) || 0,
      pvalid: num(v.pvvn ?? v.pvv),
      blank: Number(v.vb) || 0,
      pblank: num(v.pvbn ?? v.pvb),
      nul: Number(v.tvn) || 0,
      pnul: num(v.ptvnn ?? v.ptvn),
    },
    final: j.tf === 's',
    dt: j.dt || j.dg || '',
    ht: j.ht || j.hg || '',
  };
}

// Gera resultados municipais determinísticos que somam EXATAMENTE os totais da UF no modo --sim
function buildSimMunicipiosForUf(uf, stateSummary, isGov = false) {
  const meshFile = path.join(MUN_MESH_DIR, `${uf}.json`);
  if (!fs.existsSync(meshFile)) return [];
  const mesh = JSON.parse(fs.readFileSync(meshFile, 'utf8'));
  const muns = mesh.municipios || [];
  if (!muns.length) return [];

  const totalV0 = stateSummary.cands[0]?.votes || 0;
  const totalV1 = stateSummary.cands[1]?.votes || 0;
  const totalBlank = stateSummary.votes.blank || 0;
  const totalNul = stateSummary.votes.nul || 0;
  const totalAbst = stateSummary.electorate.abst || 0;
  const totalSecs = stateSummary.sections.total || muns.length * 40;

  // Pesos populacionais normalizados
  const rawWeights = muns.map((m, idx) => m.weight || Math.max(0.005, 0.08 / (idx + 2)));
  const weightSum = rawWeights.reduce((a, b) => a + b, 0) || 1;
  const weights = rawWeights.map((w) => w / weightSum);

  let accV0 = 0, accV1 = 0, accBlank = 0, accNul = 0, accAbst = 0, accSecs = 0;

  const baseMargin = isGov ? (GOV_META[uf]?.margem ?? 2) : (PRES_DIFF[uf] ?? 2);

  return muns.map((m, idx) => {
    const isLast = idx === muns.length - 1;
    const w = weights[idx];

    // Variação realista por município em torno da margem estadual (incluindo alguns empates técnicos e inversões)
    const hash = (m.ibge.charCodeAt(m.ibge.length - 1) * 17 + idx * 31) % 29;
    let localDelta = (hash - 14) * 1.15;
    if (idx === 3 && muns.length > 5) {
      // Garante ao menos 1 município com margem apertada (< 0,5 p.p.) para testar padrão listrado de empate técnico
      localDelta = -baseMargin + 0.24;
    } else if (idx === 1 && muns.length > 3) {
      // Garante inversão de liderança em alguns polos para riqueza visual
      localDelta = -baseMargin - 6.4;
    }

    const validMun = Math.max(100, Math.round((totalV0 + totalV1) * w));
    const localMargin = Math.max(-68, Math.min(68, baseMargin + localDelta));
    const p0 = 50 + localMargin / 2;

    let v0 = isLast ? Math.max(0, totalV0 - accV0) : Math.round(validMun * (p0 / 100));
    let v1 = isLast ? Math.max(0, totalV1 - accV1) : Math.max(0, validMun - v0);
    if (!isLast && accV0 + v0 > totalV0) v0 = Math.max(0, totalV0 - accV0);
    if (!isLast && accV1 + v1 > totalV1) v1 = Math.max(0, totalV1 - accV1);

    const blank = isLast ? Math.max(0, totalBlank - accBlank) : Math.round(totalBlank * w);
    const nul = isLast ? Math.max(0, totalNul - accNul) : Math.round(totalNul * w);
    const abst = isLast ? Math.max(0, totalAbst - accAbst) : Math.round(totalAbst * w);
    const secs = isLast ? Math.max(1, totalSecs - accSecs) : Math.max(1, Math.round(totalSecs * w));

    accV0 += v0;
    accV1 += v1;
    accBlank += blank;
    accNul += nul;
    accAbst += abst;
    accSecs += secs;

    const vv = v0 + v1;
    const tv = vv + blank + nul;
    const te = tv + abst;
    const pct0 = vv > 0 ? Number(((v0 / vv) * 100).toFixed(2)) : 0;
    const pct1 = vv > 0 ? Number((100 - pct0).toFixed(2)) : 0;

    return {
      ibge: m.ibge,
      tse: m.tse,
      name: m.name,
      capital: Boolean(m.capital),
      dt: stateSummary.dt || '25/10/2026',
      ht: stateSummary.ht || '21:45:10',
      final: true,
      sections: {
        total: secs,
        done: secs,
        pct: 100,
      },
      electorate: {
        total: te,
        present: tv,
        ppresent: te > 0 ? Number(((tv / te) * 100).toFixed(2)) : 0,
        abst,
        pabst: te > 0 ? Number(((abst / te) * 100).toFixed(2)) : 0,
      },
      votes: {
        total: tv,
        valid: vv,
        pvalid: tv > 0 ? Number(((vv / tv) * 100).toFixed(2)) : 0,
        blank,
        pblank: tv > 0 ? Number(((blank / tv) * 100).toFixed(2)) : 0,
        nul,
        pnul: tv > 0 ? Number(((nul / tv) * 100).toFixed(2)) : 0,
      },
      cands: [
        {
          n: stateSummary.cands[0].n,
          name: stateSummary.cands[0].name,
          party: stateSummary.cands[0].party,
          votes: v0,
          pct: pct0,
        },
        {
          n: stateSummary.cands[1].n,
          name: stateSummary.cands[1].name,
          party: stateSummary.cands[1].party,
          votes: v1,
          pct: pct1,
        },
      ],
    };
  });
}

function buildStateSummarySim(uf, isGov = false) {
  const seed = uf.charCodeAt(0) * 31 + uf.charCodeAt(1);
  const baseTotal = uf === 'br' ? 118_420_000 : 880_000 + (seed % 19) * 430_000;
  const govDef = isGov ? GOV_META[uf] : null;
  const margin = isGov ? (govDef ? govDef.margem : 2.0) : (PRES_DIFF[uf] ?? 2.5);
  const p0 = Number(Math.max(10, Math.min(90, 50 + margin / 2)).toFixed(2));
  const p1 = Number((100 - p0).toFixed(2));
  const v0 = Math.round(baseTotal * (p0 / 100));
  const v1 = baseTotal - v0;
  const blank = Math.round(baseTotal * 0.016);
  const nul = Math.round(baseTotal * 0.029);
  const tv = baseTotal + blank + nul;
  const te = Math.round(tv / 0.8515);
  const abst = te - tv;
  const ts = uf === 'br' ? 528951 : 3200 + (seed % 17) * 1400;

  const candDefs = isGov
    ? (govDef ? govDef.c : [['91', 'PT', 'Candidato 1'], ['92', 'PL', 'Candidato 2']])
    : [['13', 'PT', 'Lula'], ['22', 'PL', 'Flávio Bolsonaro']];

  return {
    uf,
    role: isGov ? 'gov' : 'pres',
    dt: '25/10/2026',
    ht: '22:14:08',
    final: true,
    source: 'Snapshot de Demonstração (build-snapshot.js --sim)',
    cands: [
      {
        key: candDefs[0][0],
        seq: 1,
        n: candDefs[0][0],
        name: candDefs[0][2],
        party: candDefs[0][1],
        votes: v0,
        pct: p0,
        elected: v0 > v1,
      },
      {
        key: candDefs[1][0],
        seq: 2,
        n: candDefs[1][0],
        name: candDefs[1][2],
        party: candDefs[1][1],
        votes: v1,
        pct: p1,
        elected: v1 > v0,
      },
    ],
    sections: { total: ts, done: ts, pct: 100 },
    electorate: {
      total: te,
      present: tv,
      ppresent: 85.15,
      abst,
      pabst: 14.85,
    },
    votes: {
      total: tv,
      valid: baseTotal,
      pvalid: 95.5,
      blank,
      pblank: 1.6,
      nul,
      pnul: 2.9,
    },
  };
}

function buildHorariosFromPoints(points, meta = {}) {
  return {
    schemaVersion: '1.0',
    metricType: meta.metricType || 'apuracao_tse', // 'apuracao_tse' (horário da totalização) | 'votacao_log' (horário do voto)
    timezone: 'America/Sao_Paulo (UTC-3 · Horário Oficial de Brasília)',
    specialWindow: {
      id: '17h-19h',
      label: 'Janela 17h–19h (abertura da totalização e prorrogação excepcional)',
      start: '17:00',
      end: '19:00',
      note: 'A votação é unificada pelo horário de Brasília (8h às 17h), com início imediato da totalização às 17h e registros de prorrogação até as 19h em seções afetadas por contingências.',
    },
    honestyDisclaimer:
      'Os dados exibidos nesta série correspondem ao HORÁRIO DE TOTALIZAÇÃO E DIVULGAÇÃO PELO TSE (carimbos dt/ht dos lotes EA20), e não ao horário em que cada eleitor digitou o voto na urna. O horário individual de votação só consta nos Logs de Urna (RDV/BU) publicados dias após o pleito no Portal de Dados Abertos.',
    source: meta.source || 'Série temporal de lotes EA20',
    updatedAt: new Date().toISOString(),
    points,
  };
}

async function runFetchOfficial() {
  console.log('Baixando snapshot oficial do TSE (eleições 6258 e 6260)...');
  fs.mkdirSync(path.join(FINAL_DIR, 'pres'), { recursive: true });
  fs.mkdirSync(path.join(FINAL_DIR, 'gov'), { recursive: true });

  const base = 'https://resultados.tse.jus.br/oficial/ele2026';
  const mapPath = path.join(ROOT, 'public', 'data', 'municipios-map.json');
  const mapData = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, 'utf8')) : { byTse: {} };

  // 1. Presidente Nacional + 27 UFs + ZZ
  const presStates = {};
  for (const uf of ['br', ...UFS]) {
    const url = `${base}/6258/dados/${uf}/${uf}-c0001-e006258-u.json`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
    const j = await r.json();
    const parsed = parseEA20(j, '1');
    if (uf === 'br') {
      presStates.br = parsed;
    } else {
      presStates[uf] = parsed;
    }
  }

  // Baixa municípios por UF
  for (const uf of UFS.filter((u) => u !== 'zz')) {
    const meshPath = path.join(MUN_MESH_DIR, `${uf}.json`);
    const mesh = fs.existsSync(meshPath) ? JSON.parse(fs.readFileSync(meshPath, 'utf8')) : { municipios: [] };
    const munsOut = [];
    for (const m of mesh.municipios || []) {
      const tse5 = String(m.tse).padStart(5, '0');
      const mUrl = `${base}/6258/dados/${uf}/${uf}${tse5}-c0001-e006258-u.json`;
      try {
        const mr = await fetch(mUrl);
        if (mr.ok) {
          const mj = await mr.json();
          const mp = parseEA20(mj, '1');
          if (mp) {
            munsOut.push({
              ibge: m.ibge,
              tse: tse5,
              name: m.name,
              capital: Boolean(m.capital),
              ...mp,
            });
          }
        }
      } catch {
        /* continua */
      }
    }
    fs.writeFileSync(
      path.join(FINAL_DIR, 'pres', `${uf}.json`),
      JSON.stringify({
        uf,
        role: 'pres',
        generatedAt: new Date().toISOString(),
        source: 'TSE Oficial EA20 (eleição 6258)',
        state: presStates[uf],
        municipios: munsOut,
      })
    );
    console.log(`  [PRES] ${uf.toUpperCase()}: ${munsOut.length} municípios gravados`);
  }

  fs.writeFileSync(
    path.join(FINAL_DIR, 'pres', 'br.json'),
    JSON.stringify({
      role: 'pres',
      generatedAt: new Date().toISOString(),
      source: 'TSE Oficial EA20 (eleição 6258)',
      national: presStates.br,
      states: Object.fromEntries(UFS.map((u) => [u, presStates[u]])),
    })
  );

  // 2. Governadores (6 UFs disputadas no 2º turno)
  const govStates = {};
  for (const uf of GOV_UFS) {
    const url = `${base}/6260/dados/${uf}/${uf}-c0003-e006260-u.json`;
    const r = await fetch(url);
    if (r.ok) {
      govStates[uf] = parseEA20(await r.json(), '3');
    }
    const meshPath = path.join(MUN_MESH_DIR, `${uf}.json`);
    const mesh = fs.existsSync(meshPath) ? JSON.parse(fs.readFileSync(meshPath, 'utf8')) : { municipios: [] };
    const munsOut = [];
    for (const m of mesh.municipios || []) {
      const tse5 = String(m.tse).padStart(5, '0');
      const mUrl = `${base}/6260/dados/${uf}/${uf}${tse5}-c0003-e006260-u.json`;
      try {
        const mr = await fetch(mUrl);
        if (mr.ok) {
          const mp = parseEA20(await mr.json(), '3');
          if (mp) {
            munsOut.push({
              ibge: m.ibge,
              tse: tse5,
              name: m.name,
              capital: Boolean(m.capital),
              ...mp,
            });
          }
        }
      } catch {
        /* continua */
      }
    }
    fs.writeFileSync(
      path.join(FINAL_DIR, 'gov', `${uf}.json`),
      JSON.stringify({
        uf,
        role: 'gov',
        generatedAt: new Date().toISOString(),
        source: 'TSE Oficial EA20 (eleição 6260)',
        state: govStates[uf],
        municipios: munsOut,
      })
    );
  }
  fs.writeFileSync(
    path.join(FINAL_DIR, 'gov', 'summary.json'),
    JSON.stringify({
      role: 'gov',
      generatedAt: new Date().toISOString(),
      source: 'TSE Oficial EA20 (eleição 6260)',
      states: govStates,
    })
  );
}

function runBuildSimSnapshot() {
  fs.mkdirSync(path.join(FINAL_DIR, 'pres'), { recursive: true });
  fs.mkdirSync(path.join(FINAL_DIR, 'gov'), { recursive: true });

  const presStates = {};
  let sumV0 = 0, sumV1 = 0, sumBlank = 0, sumNul = 0, sumAbst = 0, sumSecs = 0;

  for (const uf of UFS) {
    const st = buildStateSummarySim(uf, false);
    presStates[uf] = st;
    sumV0 += st.cands[0].votes;
    sumV1 += st.cands[1].votes;
    sumBlank += st.votes.blank;
    sumNul += st.votes.nul;
    sumAbst += st.electorate.abst;
    sumSecs += st.sections.total;

    if (uf !== 'zz') {
      const muns = buildSimMunicipiosForUf(uf, st, false);
      fs.writeFileSync(
        path.join(FINAL_DIR, 'pres', `${uf}.json`),
        JSON.stringify({
          uf,
          role: 'pres',
          generatedAt: new Date().toISOString(),
          source: 'Snapshot Local Pós-Eleição (build-snapshot.js)',
          state: st,
          municipios: muns,
        })
      );
    }
  }

  const totVV = sumV0 + sumV1;
  const totTV = totVV + sumBlank + sumNul;
  const totTE = totTV + sumAbst;
  const p0 = Number(((sumV0 / totVV) * 100).toFixed(2));
  const p1 = Number((100 - p0).toFixed(2));

  const national = {
    uf: 'br',
    role: 'pres',
    dt: '25/10/2026',
    ht: '22:14:08',
    final: true,
    source: 'Snapshot Local Pós-Eleição (build-snapshot.js)',
    cands: [
      { key: '13', seq: 1, n: '13', name: 'Lula', party: 'PT', votes: sumV0, pct: p0, elected: sumV0 > sumV1 },
      { key: '22', seq: 2, n: '22', name: 'Flávio Bolsonaro', party: 'PL', votes: sumV1, pct: p1, elected: sumV1 > sumV0 },
    ],
    sections: { total: sumSecs, done: sumSecs, pct: 100 },
    electorate: {
      total: totTE,
      present: totTV,
      ppresent: Number(((totTV / totTE) * 100).toFixed(2)),
      abst: sumAbst,
      pabst: Number(((sumAbst / totTE) * 100).toFixed(2)),
    },
    votes: {
      total: totTV,
      valid: totVV,
      pvalid: Number(((totVV / totTV) * 100).toFixed(2)),
      blank: sumBlank,
      pblank: Number(((sumBlank / totTV) * 100).toFixed(2)),
      nul: sumNul,
      pnul: Number(((sumNul / totTV) * 100).toFixed(2)),
    },
  };

  fs.writeFileSync(
    path.join(FINAL_DIR, 'pres', 'br.json'),
    JSON.stringify({
      role: 'pres',
      generatedAt: new Date().toISOString(),
      source: 'Snapshot Local Pós-Eleição (build-snapshot.js)',
      national,
      states: presStates,
    })
  );

  // Governadores (6 UFs)
  const govStates = {};
  for (const uf of GOV_UFS) {
    const st = buildStateSummarySim(uf, true);
    govStates[uf] = st;
    const muns = buildSimMunicipiosForUf(uf, st, true);
    fs.writeFileSync(
      path.join(FINAL_DIR, 'gov', `${uf}.json`),
      JSON.stringify({
        uf,
        role: 'gov',
        generatedAt: new Date().toISOString(),
        source: 'Snapshot Local Pós-Eleição (build-snapshot.js)',
        state: st,
        municipios: muns,
      })
    );
  }

  fs.writeFileSync(
    path.join(FINAL_DIR, 'gov', 'summary.json'),
    JSON.stringify({
      role: 'gov',
      generatedAt: new Date().toISOString(),
      source: 'Snapshot Local Pós-Eleição (build-snapshot.js)',
      states: govStates,
    })
  );

  // Série de horários: se não houver diretório de histórico real informado, grava estrutura documentada
  // pronta para importação pelo usuário (sem inventar dados oficiais!) + série de demonstração isolada para ?sim
  const simSchedule = [
    { hora: '17:05', dt: '25/10/2026', frac: 0.04, biasA: -0.022 },
    { hora: '17:20', dt: '25/10/2026', frac: 0.14, biasA: -0.018 },
    { hora: '17:40', dt: '25/10/2026', frac: 0.29, biasA: -0.012 },
    { hora: '18:00', dt: '25/10/2026', frac: 0.46, biasA: -0.006 },
    { hora: '18:20', dt: '25/10/2026', frac: 0.63, biasA: 0.001 },
    { hora: '18:40', dt: '25/10/2026', frac: 0.78, biasA: 0.005 },
    { hora: '19:00', dt: '25/10/2026', frac: 0.89, biasA: 0.007 },
    { hora: '19:30', dt: '25/10/2026', frac: 0.95, biasA: 0.008 },
    { hora: '20:00', dt: '25/10/2026', frac: 0.985, biasA: 0.0086 },
    { hora: '20:45', dt: '25/10/2026', frac: 0.996, biasA: 0.0088 },
    { hora: '21:30', dt: '25/10/2026', frac: 1.0, biasA: 0 },
  ];

  const finalRatioA = sumV0 / totVV;
  const simPoints = simSchedule.map((step, i) => {
    const isEnd = i === simSchedule.length - 1;
    const curVV = isEnd ? totVV : Math.round(totVV * step.frac);
    const ratioA = isEnd ? finalRatioA : Math.max(0.35, Math.min(0.65, finalRatioA + step.biasA));
    const votosA = isEnd ? sumV0 : Math.round(curVV * ratioA);
    const votosB = curVV - votosA;
    return {
      hora: step.hora,
      dt: step.dt,
      secoesApuradas: isEnd ? sumSecs : Math.round(sumSecs * step.frac),
      secoesTotal: sumSecs,
      votosA,
      votosB,
      brancos: isEnd ? sumBlank : Math.round(sumBlank * step.frac),
      nulos: isEnd ? sumNul : Math.round(sumNul * step.frac),
    };
  });

  const horariosDoc = buildHorariosFromPoints([], {
    metricType: 'apuracao_tse',
    source: 'Aguardando importação de snapshots reais do TSE (use o botão «Importar JSON de horários» ou rode build-snapshot.js --history-dir)',
  });
  // Guarda a série de simulação em `simPoints` para que o modo `/?sim` exiba a análise completa
  // enquanto o modo oficial sem histórico mostra estado vazio honesto (nunca fabrica pontos como se fossem oficiais).
  horariosDoc.simPoints = simPoints;

  fs.writeFileSync(HORARIOS_FILE, JSON.stringify(horariosDoc, null, 2), 'utf8');
  console.log(`Snapshots gravados em ${FINAL_DIR} e esquema de horários em ${HORARIOS_FILE}.`);
}

function runImportHistoryDir(dirPath) {
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.json')).sort();
  const points = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dirPath, f), 'utf8'));
      const p = parseEA20(raw, '1');
      if (p && p.cands.length >= 2 && p.ht) {
        points.push({
          hora: p.ht.slice(0, 5),
          htFull: p.ht,
          dt: p.dt || '25/10/2026',
          secoesApuradas: p.sections.done,
          secoesTotal: p.sections.total,
          votosA: p.cands[0].votes,
          votosB: p.cands[1].votes,
          brancos: p.votes.blank,
          nulos: p.votes.nul,
        });
      }
    } catch {
      /* ignora arquivo inválido */
    }
  }
  points.sort((a, b) => a.hora.localeCompare(b.hora));
  const doc = buildHorariosFromPoints(points, {
    metricType: 'apuracao_tse',
    source: `Snapshots oficiais EA20 importados (${points.length} lotes)`,
  });
  fs.writeFileSync(HORARIOS_FILE, JSON.stringify(doc, null, 2), 'utf8');
  console.log(`Importados ${points.length} lotes reais para ${HORARIOS_FILE}`);
}

async function main() {
  const args = process.argv.slice(2);
  const histIdx = args.indexOf('--history-dir');
  if (histIdx >= 0 && args[histIdx + 1] && fs.existsSync(args[histIdx + 1])) {
    runImportHistoryDir(args[histIdx + 1]);
    return;
  }
  if (args.includes('--fetch')) {
    try {
      await runFetchOfficial();
      return;
    } catch (err) {
      console.warn(`Aviso: falha ao baixar do TSE (${err.message}). Gerando snapshot de simulação...`);
    }
  }
  runBuildSimSnapshot();
}

main();
