// ============================================================================
// Painel de Apuração 2º Turno 2026 — Camada de Análise Pós-Eleição (public/pos.js)
// 100% Aditivo, isolado, reversível e zero dependências externas (CSP 'self').
//
// Contém:
//   1. Funções puras exportadas (cálculo de faixas de horário, validação de somas
//      do boletim, normalização sem acento, agregação regional e municipal).
//   2. Mapa por cidades (municípios) com cores MARGIN_BANDS, empate listrado,
//      tooltip, cartão de município, busca com autocomplete, zoom/pan, teclado,
//      rotas #pres/{uf}/cidades e ranking ordenável.
//   3. Seção «Como foi a eleição» com 8 gráficos nativos SVG/HTML+CSS + tabelas
//      acessíveis (<details>).
//   4. Levantamento por horários com destaque 17h–19h, nota de honestidade
//      (votos apurados vs votados), fusos explicados e importação de JSON.
//   5. Sistema de Boletim Compartilhável (interruptores, pré-visualização,
//      validação matemática, cópia/redes, geração de PNG 1080×1350 e 1080×1920
//      em <canvas>, e link com hash).
// ============================================================================

import { UF_META, UF_PATHS } from './uf-paths.js';
import {
  CANDIDATES,
  GOV_UFS,
  GOV_CANDIDATES,
  govConfigFor,
  fmtInt,
  fmtPct,
  esc,
  leaders,
  initialsOf,
} from './app.js';

// ----------------------------------------------------------------------------
// 1. CONSTANTES CONFIGURÁVEIS (Faixas de Horário e Intensidade do Mapa)
// ----------------------------------------------------------------------------
export const TIME_BANDS_CONFIG = [
  { id: 'pre-17h', label: 'Antes das 17h', start: '00:00', end: '17:00', special: false },
  { id: '17h-18h', label: '17h às 18h', start: '17:00', end: '18:00', special: true },
  { id: '18h-19h', label: '18h às 19h', start: '18:00', end: '19:00', special: true },
  { id: 'pos-19h', label: 'Após as 19h', start: '19:00', end: '23:59', special: false },
];

export const SPECIAL_WINDOW_CONFIG = {
  id: '17h-19h',
  label: 'Janela destacada: 17h às 19h (horário de Brasília)',
  start: '17:00',
  end: '19:00',
};

export const MARGIN_BANDS = [
  { max: 2, alphaLight: 0.30, alphaDark: 0.36 },
  { max: 5, alphaLight: 0.46, alphaDark: 0.52 },
  { max: 10, alphaLight: 0.64, alphaDark: 0.68 },
  { max: 20, alphaLight: 0.80, alphaDark: 0.84 },
  { max: Infinity, alphaLight: 0.95, alphaDark: 0.96 },
];

export const TIE_THRESHOLD_PP = 0.5;

// ----------------------------------------------------------------------------
// 2. FUNÇÕES PURAS (Testáveis em Node sem DOM)
// ----------------------------------------------------------------------------
export function normalizeSearchStr(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function getBandForMargin(margin) {
  const m = Math.max(0, Number(margin) || 0);
  for (const b of MARGIN_BANDS) {
    if (m < b.max) return b;
  }
  return MARGIN_BANDS[MARGIN_BANDS.length - 1];
}

export function timeToMinutes(hhmm) {
  const parts = String(hhmm || '00:00').split(':');
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h * 60 + m;
}

// Calcula os deltas de votos apurados em cada faixa de horário a partir da série acumulada
export function computeTimeBandsBreakdown(points = [], bandsConfig = TIME_BANDS_CONFIG) {
  if (!Array.isArray(points) || points.length === 0) {
    return {
      hasData: false,
      totalVotes: 0,
      bands: [],
      specialWindow: null,
      hourly: [],
      rates: [],
    };
  }

  const sorted = [...points].sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora));
  const deltas = [];
  let prevA = 0;
  let prevB = 0;
  let prevBr = 0;
  let prevNul = 0;
  let prevMin = null;

  for (const pt of sorted) {
    const curMin = timeToMinutes(pt.hora);
    const dA = Math.max(0, (Number(pt.votosA) || 0) - prevA);
    const dB = Math.max(0, (Number(pt.votosB) || 0) - prevB);
    const dBr = Math.max(0, (Number(pt.brancos) || 0) - prevBr);
    const dNul = Math.max(0, (Number(pt.nulos) || 0) - prevNul);
    const dValid = dA + dB;
    const elapsedMin = prevMin === null ? 15 : Math.max(1, curMin - prevMin);

    deltas.push({
      hora: pt.hora,
      minutes: curMin,
      dA,
      dB,
      dBr,
      dNul,
      dValid,
      accA: Number(pt.votosA) || 0,
      accB: Number(pt.votosB) || 0,
      accValid: (Number(pt.votosA) || 0) + (Number(pt.votosB) || 0),
      secoesPct: pt.secoesTotal ? ((Number(pt.secoesApuradas) || 0) / Number(pt.secoesTotal)) * 100 : 0,
      votesPerMin: Math.round(dValid / elapsedMin),
      votesPer10Min: Math.round((dValid / elapsedMin) * 10),
    });

    prevA = Number(pt.votosA) || 0;
    prevB = Number(pt.votosB) || 0;
    prevBr = Number(pt.brancos) || 0;
    prevNul = Number(pt.nulos) || 0;
    prevMin = curMin;
  }

  const totalValid = prevA + prevB;

  const evalInterval = (startStr, endStr) => {
    const sMin = timeToMinutes(startStr);
    const eMin = timeToMinutes(endStr);
    let vA = 0;
    let vB = 0;
    for (const d of deltas) {
      // Inclui lotes divulgados dentro do intervalo (start < t <= end, ou t == 0 para pre-17h)
      const inBand = sMin === 0 ? d.minutes <= eMin : d.minutes > sMin && d.minutes <= eMin;
      if (inBand) {
        vA += d.dA;
        vB += d.dB;
      }
    }
    const tot = vA + vB;
    const pctOfTotal = totalValid > 0 ? (tot / totalValid) * 100 : 0;
    const pctA = tot > 0 ? (vA / tot) * 100 : 0;
    const pctB = tot > 0 ? (vB / tot) * 100 : 0;
    return {
      votosA: vA,
      votosB: vB,
      totalVotos: tot,
      pctOfTotal: Number(pctOfTotal.toFixed(2)),
      pctA: Number(pctA.toFixed(2)),
      pctB: Number(pctB.toFixed(2)),
      marginPP: Number(Math.abs(pctA - pctB).toFixed(2)),
      leaderSlot: vA === vB ? -1 : vA > vB ? 0 : 1,
    };
  };

  const bands = bandsConfig.map((b) => ({
    ...b,
    ...evalInterval(b.start, b.end),
  }));

  const specialWindow = {
    ...SPECIAL_WINDOW_CONFIG,
    ...evalInterval(SPECIAL_WINDOW_CONFIG.start, SPECIAL_WINDOW_CONFIG.end),
  };

  return {
    hasData: totalValid > 0,
    totalVotes: totalValid,
    bands,
    specialWindow,
    deltas,
  };
}

// Conferência numérica automática para o Boletim Compartilhável
export function validateElectionTotals(summary) {
  if (!summary || !summary.cands || summary.cands.length < 2) {
    return { ok: false, reason: 'Dados insuficientes para conferência.' };
  }
  const v0 = Number(summary.cands[0].votes) || 0;
  const v1 = Number(summary.cands[1].votes) || 0;
  const validSum = v0 + v1;
  const validOfficial = Number(summary.votes?.valid) || validSum;
  const blank = Number(summary.votes?.blank) || 0;
  const nul = Number(summary.votes?.nul) || 0;
  const totalVotes = Number(summary.votes?.total) || validOfficial + blank + nul;
  const present = Number(summary.electorate?.present) || totalVotes;

  const diffValid = Math.abs(validSum - validOfficial);
  const diffTotal = Math.abs(validOfficial + blank + nul - present);
  const pctSum = (Number(summary.cands[0].pct) || 0) + (Number(summary.cands[1].pct) || 0);
  const pctOk = Math.abs(pctSum - 100) <= 0.15;

  const ok = diffValid <= 5 && diffTotal <= 5 && pctOk;
  return {
    ok,
    validSum,
    totalVotes,
    pctSum: Number(pctSum.toFixed(2)),
    reason: ok
      ? 'Conferência matemática validada (candidatos + brancos + nulos = comparecimento; soma = 100,00%)'
      : `Atenção: divergência detectada na soma (diferença de ${diffTotal} votos ou soma percentual ${pctSum.toFixed(2)}%)`,
  };
}

// Parseia sub-rotas pós-eleição sem interferir nas rotas originais de app.js:
// Ex: #pres/mg/cidades, #pres/mg/cidades/3106200, #gov/rn/cidades, #pres/analise, #pres/boletim
export function parsePosHash(hash = '') {
  const parts = String(hash || '')
    .replace(/^#/, '')
    .toLowerCase()
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);

  let role = 'pres';
  let uf = null;
  let subview = null;
  let munIbge = null;

  if (parts[0] === 'gov' || parts[0] === 'pres') {
    role = parts[0];
    if (parts[1] === 'analise' || parts[1] === 'boletim' || parts[1] === 'horarios') {
      subview = parts[1];
    } else if (parts[1] && UF_META[parts[1]]) {
      uf = parts[1];
      if (parts[2] === 'cidades') {
        subview = 'cidades';
        munIbge = parts[3] || null;
      }
    }
  } else if (parts[0] && UF_META[parts[0]]) {
    uf = parts[0];
    if (parts[1] === 'cidades') {
      subview = 'cidades';
      munIbge = parts[2] || null;
    }
  }
  return { role, uf, subview, munIbge };
}

// ----------------------------------------------------------------------------
// 3. INICIALIZAÇÃO NO NAVEGADOR (Isolada com try/catch conforme Regra 2)
// ----------------------------------------------------------------------------
export function initPosElectionLayer() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  try {
    setupPosLayerInternal();
  } catch (err) {
    console.warn('[pos.js] Camada pós-eleição desativada com segurança:', err);
  }
}

function setupPosLayerInternal() {
  const params = new URLSearchParams(location.search);
  const SIM = params.has('sim');
  const TV_MODE = params.has('tv');
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const isLightMode = () =>
    !TV_MODE && Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);

  const getActiveRole = () => (document.body.dataset.role === 'gov' ? 'gov' : 'pres');

  function getCandProfile(cand, slotIdx, uf = 'ac', role = getActiveRole()) {
    const light = isLightMode();
    if (role === 'gov') {
      const g = cand ? govConfigFor(uf, cand) : (GOV_CANDIDATES[uf] || [])[slotIdx] || null;
      if (g) {
        return {
          displayName: g.name,
          shortName: g.short || g.name,
          party: g.party,
          number: g.n,
          photo: g.photo || '',
          color: light ? g.colorLight : g.colorDark,
        };
      }
    }
    const cfg = (cand && CANDIDATES[String(cand.n)]) || (slotIdx === 0 ? CANDIDATES['13'] : CANDIDATES['22']);
    return {
      displayName: cfg.name,
      shortName: cfg.name,
      party: cfg.party,
      number: cfg.number,
      photo: cfg.photo || '',
      color: light ? cfg.colorLight : cfg.colorDark,
    };
  }

  // Cache de dados pós-eleição carregados sob demanda
  const posStore = {
    presBr: null,
    govSummary: null,
    horarios: null,
    munMeshByUf: {},
    munResultsByKey: {}, // `${role}:${uf}`
    activeGovUf: 'ac',
    citiesModalOpen: false,
    citiesUf: null,
    citiesRole: 'pres',
    selectedMunIbge: null,
    munSortBy: 'votes', // 'name' | 'votes' | 'margin' | 'cand0' | 'cand1'
    zoom: { scale: 1, tx: 0, ty: 0 },
  };

  async function fetchJsonSafe(url) {
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }

  async function ensureSummaryLoaded() {
    if (!posStore.presBr) {
      posStore.presBr = await fetchJsonSafe('/data/final/pres/br.json');
    }
    if (!posStore.govSummary) {
      posStore.govSummary = await fetchJsonSafe('/data/final/gov/summary.json');
    }
    if (!posStore.horarios) {
      posStore.horarios = await fetchJsonSafe('/data/horarios.json');
    }
  }

  async function ensureUfCitiesLoaded(role, uf) {
    if (!uf || uf === 'zz') return null;
    if (!posStore.munMeshByUf[uf]) {
      posStore.munMeshByUf[uf] = await fetchJsonSafe(`/data/municipios/${uf}.json`);
    }
    const key = `${role}:${uf}`;
    if (!posStore.munResultsByKey[key]) {
      posStore.munResultsByKey[key] = await fetchJsonSafe(`/data/final/${role}/${uf}.json`);
    }
    return {
      mesh: posStore.munMeshByUf[uf],
      data: posStore.munResultsByKey[key],
    };
  }

  // --------------------------------------------------------------------------
  // 3.1 INJEÇÃO PONTUAL DO BOTÃO «Ver por cidades» NO CARTÃO DE ESTADO
  //     E DO BOTÃO «Ver análise completa ↓» NO CABEÇALHO DO PALCO
  // --------------------------------------------------------------------------
  const popoverBody = document.querySelector('#detail-panel .popover-body');
  let btnOpenCities = null;
  let wrapOpenCities = null;

  if (popoverBody) {
    wrapOpenCities = document.createElement('div');
    wrapOpenCities.className = 'popover-mun-action hide-on-tv';
    wrapOpenCities.id = 'popover-mun-action';
    wrapOpenCities.innerHTML = `
      <button type="button" class="btn-open-cities" id="btn-open-cities">
        <span>Ver por cidades (municípios)</span>
        <span aria-hidden="true">→</span>
      </button>
    `;
    popoverBody.appendChild(wrapOpenCities);
    btnOpenCities = wrapOpenCities.querySelector('#btn-open-cities');
  }

  // Observa abertura do painel de detalhe do estado para esconder o botão em ZZ ou em UF sem 2º turno
  const detailUfCodeEl = document.getElementById('detail-uf-code');
  function syncOpenCitiesButtonVisibility() {
    if (!wrapOpenCities || !detailUfCodeEl) return;
    const uf = String(detailUfCodeEl.textContent || '').trim().toLowerCase();
    const role = getActiveRole();
    const noRunoff = role === 'gov' && !GOV_UFS.includes(uf);
    wrapOpenCities.hidden = !uf || uf === 'zz' || uf === 'uf' || noRunoff;
  }

  if (detailUfCodeEl) {
    const obs = new MutationObserver(syncOpenCitiesButtonVisibility);
    obs.observe(detailUfCodeEl, { childList: true, characterData: true, subtree: true });
  }

  if (btnOpenCities) {
    btnOpenCities.addEventListener('click', () => {
      const uf = String(detailUfCodeEl?.textContent || '').trim().toLowerCase();
      if (!uf || uf === 'zz' || !UF_META[uf]) return;
      openCitiesModal(getActiveRole(), uf, null, { pushHistory: true });
    });
  }

  // Botão sutil «Ver análise completa ↓» perto do cabeçalho do palco
  const stageHeadRow = document.querySelector('.stage-head-row');
  if (stageHeadRow && !document.getElementById('btn-jump-pos')) {
    const jumpBtn = document.createElement('button');
    jumpBtn.type = 'button';
    jumpBtn.id = 'btn-jump-pos';
    jumpBtn.className = 'pos-jump-btn hide-on-tv';
    jumpBtn.innerHTML = `<span>Ver análise completa</span><span aria-hidden="true">↓</span>`;
    jumpBtn.addEventListener('click', () => {
      const sec = document.getElementById('pos-eleicao-section');
      if (sec) sec.scrollIntoView({ behavior: 'smooth' });
    });
    stageHeadRow.appendChild(jumpBtn);
  }

  // --------------------------------------------------------------------------
  // 3.2 MODAL DE MAPA POR CIDADES (MUNICÍPIOS)
  // --------------------------------------------------------------------------
  const citiesModal = document.createElement('div');
  citiesModal.className = 'pos-cities-modal hide-on-tv';
  citiesModal.id = 'pos-cities-modal';
  citiesModal.setAttribute('role', 'dialog');
  citiesModal.setAttribute('aria-modal', 'true');
  citiesModal.setAttribute('aria-labelledby', 'pos-cities-title');
  citiesModal.hidden = true;

  citiesModal.innerHTML = `
    <div class="pos-cities-inner">
      <header class="pos-cities-topbar">
        <div class="pos-cities-title-wrap">
          <button type="button" class="pos-back-btn" id="pos-cities-back">
            <span aria-hidden="true">←</span>
            <span>Voltar ao estado</span>
          </button>
          <div>
            <h2 class="pos-cities-heading" id="pos-cities-title">Mapa por cidades</h2>
            <div class="pos-cities-sub" id="pos-cities-subtitle">—</div>
          </div>
        </div>
        <div class="pos-cities-controls">
          <div class="pos-search-wrap">
            <input
              type="search"
              class="pos-search-input"
              id="pos-mun-search"
              placeholder="Buscar cidade (ex.: capital, interior…)"
              autocomplete="off"
              aria-label="Buscar município no estado"
            >
            <div class="pos-autocomplete-list" id="pos-mun-autocomplete" hidden></div>
          </div>
        </div>
      </header>

      <div class="pos-cities-workspace">
        <div class="pos-mun-map-card">
          <div class="pos-mun-svg-wrap" id="pos-mun-svg-wrap">
            <svg class="pos-mun-svg" id="pos-mun-svg" viewBox="0 0 640 640" role="group" aria-label="Mapa municipal do estado">
              <defs id="pos-mun-defs"></defs>
              <g id="pos-mun-viewport-g">
                <g id="pos-mun-paths-g" clip-path="url(#pos-uf-clip)"></g>
                <path id="pos-uf-outline-stroke" fill="none" stroke="var(--ink)" stroke-opacity="0.35" stroke-width="1.5" pointer-events="none"></path>
                <g id="pos-mun-labels-g"></g>
              </g>
            </svg>
          </div>
          <div class="pos-zoom-controls" aria-label="Controles de zoom do mapa municipal">
            <button type="button" class="pos-zoom-btn" id="pos-zoom-in" title="Aproximar mapa" aria-label="Aproximar mapa">+</button>
            <button type="button" class="pos-zoom-btn" id="pos-zoom-out" title="Afastar mapa" aria-label="Afastar mapa">−</button>
            <button type="button" class="pos-zoom-btn" id="pos-zoom-reset" title="Redefinir zoom" aria-label="Redefinir zoom">⟲</button>
          </div>
        </div>

        <aside class="pos-mun-detail-card" id="pos-mun-detail-card" aria-live="polite">
          <div class="popover-head">
            <div class="popover-id">
              <span class="popover-code" id="pos-mun-uf-badge">UF</span>
              <div class="popover-titles">
                <h3 id="pos-mun-name" style="margin:0;font-size:17px;font-weight:700">Selecione uma cidade</h3>
                <p id="pos-mun-codes">Código IBGE: — · TSE: —</p>
              </div>
            </div>
            <span class="status-tag is-final" id="pos-mun-status">100% apurado</span>
          </div>
          <div class="popover-cands" id="pos-mun-cands"></div>
          <p class="popover-lead" id="pos-mun-lead"></p>
          <div class="pos-mun-metrics-grid" id="pos-mun-metrics"></div>
        </aside>
      </div>

      <section class="pos-mun-ranking-box" aria-label="Lista e ranking de municípios do estado">
        <div class="pos-ranking-head">
          <div>
            <h3 style="margin:0;font-size:15px;font-weight:600">Ranking de cidades do estado</h3>
            <span style="font-size:12px;color:var(--muted)" id="pos-ranking-summary">—</span>
          </div>
          <div class="pos-sort-pills" role="group" aria-label="Ordenar municípios por">
            <button type="button" class="pos-sort-btn active" data-sort="votes">Mais votos</button>
            <button type="button" class="pos-sort-btn" data-sort="margin">Maior margem</button>
            <button type="button" class="pos-sort-btn" data-sort="cand0" id="pos-sort-cand0">% Cand. 1</button>
            <button type="button" class="pos-sort-btn" data-sort="cand1" id="pos-sort-cand1">% Cand. 2</button>
            <button type="button" class="pos-sort-btn" data-sort="name">Nome (A–Z)</button>
          </div>
        </div>
        <div class="pos-mun-table-wrap">
          <table class="pos-mun-table">
            <thead>
              <tr>
                <th>Município</th>
                <th>Vencedor</th>
                <th>Proporção</th>
                <th>Margem (p.p.)</th>
                <th>Votos válidos</th>
                <th>Seções</th>
              </tr>
            </thead>
            <tbody id="pos-mun-tbody"></tbody>
          </table>
        </div>
      </section>
    </div>
  `;
  document.body.appendChild(citiesModal);

  const munDom = {
    backBtn: citiesModal.querySelector('#pos-cities-back'),
    title: citiesModal.querySelector('#pos-cities-title'),
    subtitle: citiesModal.querySelector('#pos-cities-subtitle'),
    searchInput: citiesModal.querySelector('#pos-mun-search'),
    autoList: citiesModal.querySelector('#pos-mun-autocomplete'),
    svgWrap: citiesModal.querySelector('#pos-mun-svg-wrap'),
    svg: citiesModal.querySelector('#pos-mun-svg'),
    defs: citiesModal.querySelector('#pos-mun-defs'),
    viewportG: citiesModal.querySelector('#pos-mun-viewport-g'),
    pathsG: citiesModal.querySelector('#pos-mun-paths-g'),
    outlineStroke: citiesModal.querySelector('#pos-uf-outline-stroke'),
    labelsG: citiesModal.querySelector('#pos-mun-labels-g'),
    zoomIn: citiesModal.querySelector('#pos-zoom-in'),
    zoomOut: citiesModal.querySelector('#pos-zoom-out'),
    zoomReset: citiesModal.querySelector('#pos-zoom-reset'),
    ufBadge: citiesModal.querySelector('#pos-mun-uf-badge'),
    munName: citiesModal.querySelector('#pos-mun-name'),
    munCodes: citiesModal.querySelector('#pos-mun-codes'),
    munStatus: citiesModal.querySelector('#pos-mun-status'),
    munCands: citiesModal.querySelector('#pos-mun-cands'),
    munLead: citiesModal.querySelector('#pos-mun-lead'),
    munMetrics: citiesModal.querySelector('#pos-mun-metrics'),
    rankingSummary: citiesModal.querySelector('#pos-ranking-summary'),
    sortCand0: citiesModal.querySelector('#pos-sort-cand0'),
    sortCand1: citiesModal.querySelector('#pos-sort-cand1'),
    tbody: citiesModal.querySelector('#pos-mun-tbody'),
    tip: document.getElementById('tip'),
  };

  function applyMunZoom() {
    const { scale, tx, ty } = posStore.zoom;
    munDom.viewportG.setAttribute('transform', `translate(${tx.toFixed(1)}, ${ty.toFixed(1)}) scale(${scale.toFixed(3)})`);
  }

  function resetMunZoom() {
    posStore.zoom = { scale: 1, tx: 0, ty: 0 };
    applyMunZoom();
  }

  munDom.zoomIn.addEventListener('click', () => {
    posStore.zoom.scale = Math.min(5, posStore.zoom.scale * 1.35);
    applyMunZoom();
  });
  munDom.zoomOut.addEventListener('click', () => {
    posStore.zoom.scale = Math.max(1, posStore.zoom.scale / 1.35);
    if (posStore.zoom.scale === 1) {
      posStore.zoom.tx = 0;
      posStore.zoom.ty = 0;
    }
    applyMunZoom();
  });
  munDom.zoomReset.addEventListener('click', resetMunZoom);

  // Pan e Zoom com roda do mouse ou toque no mapa municipal
  let panDrag = null;
  munDom.svgWrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    posStore.zoom.scale = Math.max(1, Math.min(6, posStore.zoom.scale * factor));
    if (posStore.zoom.scale === 1) {
      posStore.zoom.tx = 0;
      posStore.zoom.ty = 0;
    }
    applyMunZoom();
  }, { passive: false });

  munDom.svgWrap.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    panDrag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, tx0: posStore.zoom.tx, ty0: posStore.zoom.ty, moved: false };
    munDom.svgWrap.classList.add('panning');
  });
  munDom.svgWrap.addEventListener('pointermove', (e) => {
    if (!panDrag || e.pointerId !== panDrag.id) return;
    const dx = e.clientX - panDrag.x0;
    const dy = e.clientY - panDrag.y0;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) panDrag.moved = true;
    if (posStore.zoom.scale > 1) {
      posStore.zoom.tx = panDrag.tx0 + dx;
      posStore.zoom.ty = panDrag.ty0 + dy;
      applyMunZoom();
    }
  });
  const endPan = () => {
    panDrag = null;
    munDom.svgWrap.classList.remove('panning');
  };
  munDom.svgWrap.addEventListener('pointerup', endPan);
  munDom.svgWrap.addEventListener('pointercancel', endPan);

  // Delegação de eventos no <g id="pos-mun-paths-g"> (um único listener para centenas de municípios)
  munDom.pathsG.addEventListener('click', (e) => {
    if (panDrag && panDrag.moved) return;
    const p = e.target.closest('path[data-ibge]');
    if (!p) return;
    selectMunicipio(p.dataset.ibge, { updateHash: true });
  });

  munDom.pathsG.addEventListener('keydown', (e) => {
    const p = e.target.closest('path[data-ibge]');
    if (!p) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectMunicipio(p.dataset.ibge, { updateHash: true });
      return;
    }
    if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      const all = Array.from(munDom.pathsG.querySelectorAll('path[data-ibge]'));
      const idx = all.indexOf(p);
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      const next = all[(idx + step + all.length) % all.length];
      if (next) next.focus();
    }
  });

  munDom.pathsG.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || !munDom.tip) return;
    const p = e.target.closest('path[data-ibge]');
    if (!p) return;
    const ibge = p.dataset.ibge;
    const m = findMunData(ibge);
    if (!m) return;
    const L = leaders(m);
    const p0 = getCandProfile(m.cands?.[0], 0, posStore.citiesUf, posStore.citiesRole);
    const p1 = getCandProfile(m.cands?.[1], 1, posStore.citiesUf, posStore.citiesRole);
    munDom.tip.innerHTML = `
      <div style="font-weight:600;margin-bottom:3px">${esc(m.name)} · ${fmtPct(m.sections?.pct ?? 100)}%</div>
      <div style="display:flex;justify-content:space-between;gap:14px"><span>${esc(p0.displayName)}</span><strong>${fmtPct(m.cands?.[0]?.pct ?? 0)}%</strong></div>
      <div style="display:flex;justify-content:space-between;gap:14px"><span>${esc(p1.displayName)}</span><strong>${fmtPct(m.cands?.[1]?.pct ?? 0)}%</strong></div>
      <div style="font-size:11px;color:var(--muted);margin-top:3px">Margem: ${fmtPct(L ? L.margin : 0)} p.p. (${fmtInt(m.votes?.valid ?? 0)} votos)</div>
    `;
    munDom.tip.classList.add('on');
  });
  munDom.pathsG.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && munDom.tip && munDom.tip.classList.contains('on')) {
      munDom.tip.style.left = Math.min(e.clientX + 14, window.innerWidth - 200) + 'px';
      munDom.tip.style.top = Math.min(e.clientY + 14, window.innerHeight - 90) + 'px';
    }
  });
  munDom.pathsG.addEventListener('pointerout', () => {
    if (munDom.tip) munDom.tip.classList.remove('on');
  });

  function findMunData(ibge) {
    const key = `${posStore.citiesRole}:${posStore.citiesUf}`;
    const bundle = posStore.munResultsByKey[key];
    if (!bundle || !Array.isArray(bundle.municipios)) return null;
    return bundle.municipios.find((m) => String(m.ibge) === String(ibge)) || null;
  }

  function renderMunicipioDetail(ibge) {
    const uf = posStore.citiesUf;
    const role = posStore.citiesRole;
    const m = findMunData(ibge);
    munDom.ufBadge.textContent = (uf || 'uf').toUpperCase();

    if (!m) {
      munDom.munName.textContent = 'Município sem dados publicados';
      munDom.munCodes.textContent = `IBGE: ${ibge || '—'}`;
      munDom.munCands.innerHTML = '';
      munDom.munLead.textContent = 'Dados finais ainda não gerados para este município.';
      munDom.munMetrics.innerHTML = '';
      return;
    }

    const L = leaders(m);
    const p0 = getCandProfile(m.cands[0], 0, uf, role);
    const p1 = getCandProfile(m.cands[1], 1, uf, role);

    munDom.munName.textContent = m.name;
    munDom.munCodes.textContent = `Código IBGE: ${m.ibge} · Código TSE: ${m.tse} · ${fmtPct(m.sections?.pct ?? 100)}% apurado`;
    munDom.munStatus.textContent = L && L.isTie ? 'Empate técnico' : 'Totalização final';

    munDom.munCands.innerHTML = [m.cands[0], m.cands[1]]
      .map((c, idx) => {
        const prof = idx === 0 ? p0 : p1;
        const isLeader = L && L.top === c && !L.isTie;
        return `
          <div class="pop-cand-row ${isLeader ? 'is-leader' : ''}" style="--c:${prof.color}">
            <div class="pop-avatar">
              ${prof.photo ? `<img src="${esc(prof.photo)}" alt="">` : `<span class="pop-initials">${esc(initialsOf(prof.displayName))}</span>`}
            </div>
            <div class="pop-cand-id">
              <span class="pop-cand-name">${esc(prof.displayName)}</span>
              <span class="pop-cand-meta">${esc(prof.party)} · ${esc(prof.number)}</span>
            </div>
            <div class="pop-cand-nums">
              <strong class="pop-pct">${fmtPct(c.pct)}%</strong>
              <small class="pop-votes">${fmtInt(c.votes)} votos</small>
            </div>
            <div class="pop-bar" aria-hidden="true">
              <i class="pop-bar-fill" style="width:${Math.min(100, Math.max(0, c.pct)).toFixed(2)}%"></i>
            </div>
          </div>
        `;
      })
      .join('');

    if (L) {
      const leadProf = m.cands.indexOf(L.top) === 1 ? p1 : p0;
      munDom.munLead.style.setProperty('--c', L.isTie ? 'var(--muted)' : leadProf.color);
      munDom.munLead.textContent = L.isTie
        ? `Empate técnico · diferença de ${fmtPct(L.margin)} p.p. (${fmtInt(L.voteDiff)} votos)`
        : `${leadProf.displayName} venceu por ${fmtPct(L.margin)} p.p. (+${fmtInt(L.voteDiff)} votos)`;
    }

    munDom.munMetrics.innerHTML = `
      <div>Votos válidos: <strong>${fmtInt(m.votes?.valid)}</strong> (${fmtPct(m.votes?.pvalid)}%)</div>
      <div>Comparecimento: <strong>${fmtPct(m.electorate?.ppresent)}%</strong> (${fmtInt(m.electorate?.present)})</div>
      <div>Brancos: <strong>${fmtInt(m.votes?.blank)}</strong> (${fmtPct(m.votes?.pblank)}%)</div>
      <div>Nulos: <strong>${fmtInt(m.votes?.nul)}</strong> (${fmtPct(m.votes?.pnul)}%)</div>
      <div>Abstenção: <strong>${fmtPct(m.electorate?.pabst)}%</strong> (${fmtInt(m.electorate?.abst)})</div>
      <div>Seções: <strong>${fmtInt(m.sections?.done)} / ${fmtInt(m.sections?.total)}</strong></div>
    `;
  }

  function selectMunicipio(ibge, { updateHash = false } = {}) {
    posStore.selectedMunIbge = String(ibge);
    munDom.pathsG.querySelectorAll('path[data-ibge]').forEach((el) => {
      el.classList.toggle('sel', el.dataset.ibge === posStore.selectedMunIbge);
    });
    munDom.tbody.querySelectorAll('tr[data-ibge]').forEach((tr) => {
      tr.classList.toggle('sel', tr.dataset.ibge === posStore.selectedMunIbge);
    });
    renderMunicipioDetail(posStore.selectedMunIbge);

    if (updateHash && !TV_MODE) {
      const targetHash = `#${posStore.citiesRole}/${posStore.citiesUf}/cidades/${posStore.selectedMunIbge}`;
      if (location.hash !== targetHash) {
        try {
          history.replaceState(
            { app: 1, role: posStore.citiesRole, uf: posStore.citiesUf, posCities: true, munIbge: posStore.selectedMunIbge },
            '',
            `${location.pathname}${location.search}${targetHash}`
          );
        } catch { /* ignora */ }
      }
    }
  }

  function renderCitiesRanking() {
    const uf = posStore.citiesUf;
    const role = posStore.citiesRole;
    const bundle = posStore.munResultsByKey[`${role}:${uf}`];
    const list = (bundle && bundle.municipios) ? [...bundle.municipios] : [];
    const p0 = getCandProfile(null, 0, uf, role);
    const p1 = getCandProfile(null, 1, uf, role);

    munDom.sortCand0.textContent = `% ${p0.shortName}`;
    munDom.sortCand1.textContent = `% ${p1.shortName}`;

    let wins0 = 0;
    let wins1 = 0;
    let ties = 0;
    list.forEach((m) => {
      const L = leaders(m);
      if (!L) return;
      if (L.isTie) ties++;
      else if (m.cands.indexOf(L.top) === 0) wins0++;
      else wins1++;
    });

    munDom.rankingSummary.textContent = `${list.length} municípios · ${p0.shortName} venceu em ${wins0} · ${p1.shortName} venceu em ${wins1}${ties ? ` · ${ties} empate(s) técnico(s)` : ''}`;

    const sortBy = posStore.munSortBy;
    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'pt-BR');
      if (sortBy === 'margin') {
        const ma = leaders(a)?.margin || 0;
        const mb = leaders(b)?.margin || 0;
        return mb - ma;
      }
      if (sortBy === 'cand0') return (b.cands[0]?.pct || 0) - (a.cands[0]?.pct || 0);
      if (sortBy === 'cand1') return (b.cands[1]?.pct || 0) - (a.cands[1]?.pct || 0);
      return (b.votes?.valid || 0) - (a.votes?.valid || 0);
    });

    munDom.tbody.innerHTML = list
      .map((m) => {
        const L = leaders(m);
        const c0 = m.cands[0];
        const c1 = m.cands[1];
        const isSlot1 = L && m.cands.indexOf(L.top) === 1;
        const winProf = isSlot1 ? p1 : p0;
        const isSel = String(m.ibge) === String(posStore.selectedMunIbge);
        return `
          <tr class="pos-mun-row ${isSel ? 'sel' : ''}" data-ibge="${esc(m.ibge)}">
            <td><strong>${esc(m.name)}</strong> ${m.capital ? '<small style="color:var(--muted)">(Capital)</small>' : ''}</td>
            <td>
              <span style="display:inline-flex;align-items:center;gap:6px">
                <i style="width:8px;height:8px;border-radius:50%;background:${L?.isTie ? 'var(--muted)' : winProf.color}"></i>
                <span>${esc(L?.isTie ? 'Empate técnico' : winProf.shortName)}</span>
              </span>
            </td>
            <td>
              <span class="pos-mini-split">
                <i style="width:${c0.pct}%;background:${p0.color}"></i>
                <i style="width:${c1.pct}%;background:${p1.color}"></i>
              </span>
              <span>${fmtPct(c0.pct)}% × ${fmtPct(c1.pct)}%</span>
            </td>
            <td>+${fmtPct(L ? L.margin : 0)} p.p.</td>
            <td>${fmtInt(m.votes?.valid || 0)}</td>
            <td>${fmtPct(m.sections?.pct ?? 100)}%</td>
          </tr>
        `;
      })
      .join('');
  }

  citiesModal.querySelectorAll('.pos-sort-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      posStore.munSortBy = btn.dataset.sort;
      citiesModal.querySelectorAll('.pos-sort-btn').forEach((b) => b.classList.toggle('active', b === btn));
      renderCitiesRanking();
    });
  });

  munDom.tbody.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-ibge]');
    if (!tr) return;
    selectMunicipio(tr.dataset.ibge, { updateHash: true });
  });

  // Busca de cidade com autocompletar (ignorando acentos)
  munDom.searchInput.addEventListener('input', () => {
    const q = normalizeSearchStr(munDom.searchInput.value);
    const bundle = posStore.munResultsByKey[`${posStore.citiesRole}:${posStore.citiesUf}`];
    const list = (bundle && bundle.municipios) || [];
    if (!q) {
      munDom.autoList.hidden = true;
      return;
    }
    const matches = list.filter((m) => normalizeSearchStr(m.name).includes(q) || String(m.ibge).includes(q)).slice(0, 10);
    if (!matches.length) {
      munDom.autoList.innerHTML = `<div style="padding:8px 10px;font-size:12.5px;color:var(--muted)">Nenhuma cidade encontrada</div>`;
      munDom.autoList.hidden = false;
      return;
    }
    munDom.autoList.innerHTML = matches
      .map(
        (m) => `
        <button type="button" class="pos-autocomplete-item" data-ibge="${esc(m.ibge)}">
          <span><strong>${esc(m.name)}</strong></span>
          <small style="color:var(--muted)">${fmtInt(m.votes?.valid || 0)} votos</small>
        </button>
      `
      )
      .join('');
    munDom.autoList.hidden = false;
  });

  munDom.autoList.addEventListener('click', (e) => {
    const item = e.target.closest('button[data-ibge]');
    if (!item) return;
    munDom.autoList.hidden = true;
    munDom.searchInput.value = '';
    selectMunicipio(item.dataset.ibge, { updateHash: true });
  });

  async function openCitiesModal(role, uf, initialMunIbge = null, { pushHistory = false } = {}) {
    if (!uf || uf === 'zz' || !UF_META[uf]) return;
    posStore.citiesRole = role;
    posStore.citiesUf = uf;
    posStore.citiesModalOpen = true;
    resetMunZoom();

    citiesModal.hidden = false;
    munDom.title.textContent = `${UF_META[uf].name} · Mapa por Cidades`;
    munDom.subtitle.textContent = `${role === 'gov' ? 'Governador' : 'Presidente'} · carregando malha municipal…`;

    if (pushHistory && !TV_MODE) {
      const h = `#${role}/${uf}/cidades${initialMunIbge ? `/${initialMunIbge}` : ''}`;
      try {
        history.pushState({ app: 1, role, uf, posCities: true, munIbge: initialMunIbge }, '', `${location.pathname}${location.search}${h}`);
      } catch { /* ignora */ }
    }

    const loaded = await ensureUfCitiesLoaded(role, uf);
    if (!loaded || !loaded.mesh) {
      munDom.subtitle.textContent = 'Malha municipal ainda não gerada (execute node scripts/build-municipios.js).';
      return;
    }

    const { mesh, data } = loaded;
    const munsData = (data && data.municipios) || [];
    const dataByIbge = Object.fromEntries(munsData.map((m) => [String(m.ibge), m]));

    const p0 = getCandProfile(null, 0, uf, role);
    const p1 = getCandProfile(null, 1, uf, role);
    const light = isLightMode();

    // Prepara clipPath do contorno estadual e padrão listrado de empate técnico
    munDom.defs.innerHTML = `
      <pattern id="pos-mun-tie" width="10" height="10" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="5" height="10" fill="${p0.color}"></rect>
        <rect x="5" y="0" width="5" height="10" fill="${p1.color}"></rect>
      </pattern>
      ${mesh.ufOutline ? `<clipPath id="pos-uf-clip"><path d="${mesh.ufOutline}"></path></clipPath>` : ''}
    `;
    if (mesh.ufOutline) {
      munDom.outlineStroke.setAttribute('d', mesh.ufOutline);
    } else {
      munDom.outlineStroke.removeAttribute('d');
    }

    munDom.pathsG.innerHTML = '';
    munDom.labelsG.innerHTML = '';

    for (const gm of mesh.municipios || []) {
      const m = dataByIbge[String(gm.ibge)];
      const L = m ? leaders(m) : null;
      const pathEl = document.createElementNS(SVG_NS, 'path');
      pathEl.setAttribute('d', gm.d);
      pathEl.setAttribute('class', 'pos-mun-shape');
      pathEl.setAttribute('tabindex', '0');
      pathEl.setAttribute('role', 'button');
      pathEl.dataset.ibge = gm.ibge;

      if (L && m) {
        const isSlot1 = m.cands.indexOf(L.top) === 1;
        const winProf = isSlot1 ? p1 : p0;
        const band = getBandForMargin(L.margin);
        const alpha = light ? band.alphaLight : band.alphaDark;
        if (L.isTie) {
          pathEl.style.fill = 'url(#pos-mun-tie)';
          pathEl.style.fillOpacity = '0.9';
        } else {
          pathEl.style.fill = winProf.color;
          pathEl.style.fillOpacity = String(alpha);
        }
        pathEl.setAttribute(
          'aria-label',
          `${gm.name}: ${p0.displayName} ${fmtPct(m.cands[0].pct)}%, ${p1.displayName} ${fmtPct(m.cands[1].pct)}%`
        );
      } else {
        pathEl.setAttribute('aria-label', `${gm.name}: sem dados apurados`);
      }

      munDom.pathsG.appendChild(pathEl);

      // Rótulo nas capitais e principais polos
      if (gm.capital) {
        const txt = document.createElementNS(SVG_NS, 'text');
        txt.setAttribute('x', String(gm.cx));
        txt.setAttribute('y', String(gm.cy));
        txt.setAttribute('class', 'pos-mun-label');
        txt.textContent = `★ ${gm.name}`;
        munDom.labelsG.appendChild(txt);
      }
    }

    munDom.subtitle.textContent = `${role === 'gov' ? 'Governador' : 'Presidente'} · ${mesh.municipios.length} municípios · Fonte: ${data?.source || 'TSE EA20'}`;

    const firstMun =
      initialMunIbge ||
      (mesh.municipios.find((m) => m.capital) || mesh.municipios[0])?.ibge;
    if (firstMun) selectMunicipio(firstMun, { updateHash: false });
    renderCitiesRanking();
  }

  function closeCitiesModal({ fromPopState = false } = {}) {
    if (!posStore.citiesModalOpen) return;
    posStore.citiesModalOpen = false;
    citiesModal.hidden = true;
    if (munDom.tip) munDom.tip.classList.remove('on');
    if (!fromPopState && !TV_MODE) {
      const targetHash = `#${posStore.citiesRole}/${posStore.citiesUf}`;
      try {
        history.pushState({ app: 1, role: posStore.citiesRole, uf: posStore.citiesUf, pushed: true }, '', `${location.pathname}${location.search}${targetHash}`);
      } catch { /* ignora */ }
    }
  }

  munDom.backBtn.addEventListener('click', () => closeCitiesModal({ fromPopState: false }));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && posStore.citiesModalOpen) {
      e.stopPropagation();
      closeCitiesModal({ fromPopState: false });
    }
  });

  // --------------------------------------------------------------------------
  // 3.3 SEÇÃO «COMO FOI A ELEIÇÃO» (Gráficos + Levantamento por Horários + Boletim)
  // --------------------------------------------------------------------------
  const posSection = document.getElementById('pos-eleicao-section');
  if (!posSection) return;

  posSection.innerHTML = `
    <header class="pos-section-header">
      <div>
        <div class="pos-section-eyebrow">Camada de Análise Pós-Eleição • 2º Turno 2026</div>
        <h2 class="pos-section-title">Como foi a eleição</h2>
        <p class="pos-section-subtitle" id="pos-section-meta">Análise consolidada de estados, regiões, municípios e faixas de horário de totalização.</p>
      </div>
      <div class="pos-header-actions">
        <button type="button" class="pos-boletim-cta" id="btn-open-boletim">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2.5" y="2" width="11" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M5 5.5h6M5 8h6M5 10.5h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>Gerar boletim compartilhável</span>
        </button>
      </div>
    </header>

    <div class="pos-charts-grid" id="pos-charts-grid">
      <!-- 1. Resultado Final + 2. Composição do Eleitorado -->
      <article class="pos-chart-card" id="chart-card-resultado">
        <div class="pos-card-head">
          <div>
            <h3 class="pos-card-title">1. Resultado final consolidado</h3>
            <p class="pos-card-desc" id="desc-resultado">Proporção de votos válidos, diferença absoluta e margem em p.p.</p>
          </div>
          <button type="button" class="pos-share-chart-btn" data-share-chart="resultado">Compartilhar este gráfico</button>
        </div>
        <div id="body-chart-resultado"></div>
      </article>

      <article class="pos-chart-card" id="chart-card-composicao">
        <div class="pos-card-head">
          <div>
            <h3 class="pos-card-title">2. Composição do eleitorado</h3>
            <p class="pos-card-desc">Votos válidos, brancos, nulos e abstenção sobre o total de eleitores aptos.</p>
          </div>
          <button type="button" class="pos-share-chart-btn" data-share-chart="composicao">Compartilhar este gráfico</button>
        </div>
        <div id="body-chart-composicao"></div>
      </article>

      <!-- 3. Estados por vencedor e por margem + 4. Por Região -->
      <article class="pos-chart-card" id="chart-card-estados">
        <div class="pos-card-head">
          <div>
            <h3 class="pos-card-title">3. Estados por vencedor e margem</h3>
            <p class="pos-card-desc" id="desc-estados">Ranking horizontal de UFs ordenado pela vantagem em pontos percentuais.</p>
          </div>
          <button type="button" class="pos-share-chart-btn" data-share-chart="estados">Compartilhar este gráfico</button>
        </div>
        <div id="body-chart-estados"></div>
      </article>

      <article class="pos-chart-card" id="chart-card-regioes">
        <div class="pos-card-head">
          <div>
            <h3 class="pos-card-title">4. Desempenho por região</h3>
            <p class="pos-card-desc">Norte, Nordeste, Centro-Oeste, Sudeste, Sul e Exterior (ZZ).</p>
          </div>
          <button type="button" class="pos-share-chart-btn" data-share-chart="regioes">Compartilhar este gráfico</button>
        </div>
        <div id="body-chart-regioes"></div>
      </article>

      <!-- 5. Municípios (Resumo + Top 10 decisivos) + 6. Comparecimento e Abstenção por UF -->
      <article class="pos-chart-card" id="chart-card-municipios">
        <div class="pos-card-head">
          <div>
            <h3 class="pos-card-title">5. Raio-X dos municípios</h3>
            <p class="pos-card-desc">Cidades vencidas por candidato, vitórias por margem apertada e os 10 municípios mais decisivos em votos.</p>
          </div>
          <button type="button" class="pos-share-chart-btn" data-share-chart="municipios">Compartilhar este gráfico</button>
        </div>
        <div id="body-chart-municipios"></div>
      </article>

      <article class="pos-chart-card" id="chart-card-comparecimento">
        <div class="pos-card-head">
          <div>
            <h3 class="pos-card-title">6. Comparecimento e abstenção por UF</h3>
            <p class="pos-card-desc">Taxa de presença às urnas e abstenção em cada unidade federativa.</p>
          </div>
          <button type="button" class="pos-share-chart-btn" data-share-chart="comparecimento">Compartilhar este gráfico</button>
        </div>
        <div id="body-chart-comparecimento"></div>
      </article>

      <!-- 7. Levantamento por horários e Evolução da Apuração (Janela 17h–19h em destaque) -->
      <article class="pos-chart-card span-12" id="chart-card-horarios">
        <div class="pos-card-head">
          <div>
            <h3 class="pos-card-title">7. Levantamento por horários e janela 17h–19h</h3>
            <p class="pos-card-desc">Votos apurados por faixa de horário (horário oficial de Brasília), ritmo de entrada e curva acumulada.</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <label class="pos-share-chart-btn" style="cursor:pointer">
              <span>Importar JSON de horários</span>
              <input type="file" id="pos-import-horarios-input" accept="application/json" hidden>
            </label>
            <button type="button" class="pos-share-chart-btn" data-share-chart="horarios">Compartilhar este gráfico</button>
          </div>
        </div>
        <div id="body-chart-horarios"></div>
      </article>

      <!-- 8. Governadores nas 6 UFs disputadas no 2º turno -->
      <article class="pos-chart-card span-12" id="chart-card-governadores">
        <div class="pos-card-head">
          <div>
            <h3 class="pos-card-title">8. Disputa nos Governos Estaduais (2º turno: AC, AM, DF, ES, RN e TO)</h3>
            <p class="pos-card-desc">Painéis comparativos lado a lado na ordem fixa dos candidatos (RJ definido no 1º turno).</p>
          </div>
          <button type="button" class="pos-share-chart-btn" data-share-chart="governadores">Compartilhar este gráfico</button>
        </div>
        <div id="body-chart-governadores"></div>
      </article>
    </div>
  `;

  // --------------------------------------------------------------------------
  // 3.4 RENDERIZAÇÃO DOS 8 GRÁFICOS
  // --------------------------------------------------------------------------
  async function renderAllPosCharts() {
    await ensureSummaryLoaded();
    const role = getActiveRole();
    const presBr = posStore.presBr;
    const govSum = posStore.govSummary;

    if (!presBr || !presBr.national) {
      document.getElementById('pos-section-meta').textContent =
        'Dados finais ainda não gerados. Execute node scripts/build-snapshot.js para congelar o snapshot pós-eleição.';
      return;
    }

    const activeGovBtn = document.querySelector('#gov-uf-chips .gov-chip.active');
    if (activeGovBtn && activeGovBtn.dataset.govUf) {
      posStore.activeGovUf = activeGovBtn.dataset.govUf;
    }

    const focusUf = role === 'gov' ? posStore.activeGovUf : 'br';
    const focusSummary = role === 'gov' ? (govSum?.states?.[focusUf] || presBr.national) : presBr.national;
    const p0 = getCandProfile(focusSummary.cands[0], 0, focusUf, role);
    const p1 = getCandProfile(focusSummary.cands[1], 1, focusUf, role);

    document.getElementById('pos-section-meta').textContent =
      `Dados consolidados (${role === 'gov' ? `Governador · ${UF_META[focusUf]?.name}` : 'Presidente · Brasil'}) · Totalização TSE: ${focusSummary.dt} às ${focusSummary.ht}`;

    // 1. Resultado Final
    const c0 = focusSummary.cands[0];
    const c1 = focusSummary.cands[1];
    const L = leaders(focusSummary);
    const bodyRes = document.getElementById('body-chart-resultado');
    bodyRes.innerHTML = `
      <div role="img" aria-label="Resultado final: ${esc(p0.displayName)} ${fmtPct(c0.pct)}% (${fmtInt(c0.votes)} votos) contra ${esc(p1.displayName)} ${fmtPct(c1.pct)}% (${fmtInt(c1.votes)} votos)">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
          <div>
            <strong style="font-size:18px;color:${p0.color}">${esc(p0.displayName)} (${esc(p0.party)})</strong>
            <div style="font-size:26px;font-weight:700">${fmtPct(c0.pct)}% <small style="font-size:13px;color:var(--muted)">${fmtInt(c0.votes)} votos</small></div>
          </div>
          <div style="text-align:right">
            <strong style="font-size:18px;color:${p1.color}">${esc(p1.displayName)} (${esc(p1.party)})</strong>
            <div style="font-size:26px;font-weight:700">${fmtPct(c1.pct)}% <small style="font-size:13px;color:var(--muted)">${fmtInt(c1.votes)} votos</small></div>
          </div>
        </div>
        <div class="pos-stacked-bar">
          <div class="pos-stacked-seg" style="width:${c0.pct}%;background:${p0.color}"></div>
          <div class="pos-stacked-seg" style="width:${c1.pct}%;background:${p1.color}"></div>
        </div>
        <div class="pos-kpi-grid" style="margin-top:12px">
          <div class="pos-kpi-item">
            <span class="pos-kpi-label">Diferença em votos</span>
            <strong class="pos-kpi-val">${fmtInt(L ? L.voteDiff : 0)}</strong>
            <span class="pos-kpi-sub">Vantagem de ${esc(L ? (focusSummary.cands.indexOf(L.top) === 1 ? p1.shortName : p0.shortName) : '—')}</span>
          </div>
          <div class="pos-kpi-item">
            <span class="pos-kpi-label">Margem percentual</span>
            <strong class="pos-kpi-val">${fmtPct(L ? L.margin : 0)} p.p.</strong>
            <span class="pos-kpi-sub">${fmtInt(focusSummary.votes.valid)} votos válidos</span>
          </div>
          <div class="pos-kpi-item">
            <span class="pos-kpi-label">Seções totalizadas</span>
            <strong class="pos-kpi-val">${fmtPct(focusSummary.sections.pct)}%</strong>
            <span class="pos-kpi-sub">${fmtInt(focusSummary.sections.done)} de ${fmtInt(focusSummary.sections.total)}</span>
          </div>
        </div>
      </div>
      <details class="pos-a11y-details">
        <summary>Ver tabela de números exatos</summary>
        <table class="pos-a11y-table">
          <thead><tr><th>Candidato</th><th>Partido/Nº</th><th>Votos</th><th>% Válidos</th></tr></thead>
          <tbody>
            <tr><td>${esc(p0.displayName)}</td><td>${esc(p0.party)} · ${esc(p0.number)}</td><td>${fmtInt(c0.votes)}</td><td>${fmtPct(c0.pct)}%</td></tr>
            <tr><td>${esc(p1.displayName)}</td><td>${esc(p1.party)} · ${esc(p1.number)}</td><td>${fmtInt(c1.votes)}</td><td>${fmtPct(c1.pct)}%</td></tr>
          </tbody>
        </table>
      </details>
    `;

    // 2. Composição do Eleitorado
    const te = focusSummary.electorate.total || 1;
    const vv = focusSummary.votes.valid || 0;
    const vb = focusSummary.votes.blank || 0;
    const vn = focusSummary.votes.nul || 0;
    const abst = focusSummary.electorate.abst || 0;
    const pVV_te = (vv / te) * 100;
    const pVB_te = (vb / te) * 100;
    const pVN_te = (vn / te) * 100;
    const pAbst_te = (abst / te) * 100;

    document.getElementById('body-chart-composicao').innerHTML = `
      <div role="img" aria-label="Composição do eleitorado: Votos válidos ${fmtPct(pVV_te)}%, Brancos ${fmtPct(pVB_te)}%, Nulos ${fmtPct(pVN_te)}%, Abstenção ${fmtPct(pAbst_te)}%">
        <div class="pos-stacked-bar" style="height:18px">
          <div class="pos-stacked-seg" style="width:${pVV_te.toFixed(2)}%;background:var(--live)" title="Votos válidos"></div>
          <div class="pos-stacked-seg" style="width:${pVB_te.toFixed(2)}%;background:var(--ink-2)" title="Brancos"></div>
          <div class="pos-stacked-seg" style="width:${pVN_te.toFixed(2)}%;background:var(--stale)" title="Nulos"></div>
          <div class="pos-stacked-seg" style="width:${pAbst_te.toFixed(2)}%;background:var(--muted)" title="Abstenção"></div>
        </div>
        <div class="pos-kpi-grid" style="margin-top:12px">
          <div class="pos-kpi-item">
            <span class="pos-kpi-label"><i class="pos-kpi-dot" style="background:var(--live)"></i>Votos válidos</span>
            <strong class="pos-kpi-val">${fmtPct(focusSummary.votes.pvalid)}%</strong>
            <span class="pos-kpi-sub">${fmtInt(vv)} votos</span>
          </div>
          <div class="pos-kpi-item">
            <span class="pos-kpi-label"><i class="pos-kpi-dot" style="background:var(--ink-2)"></i>Votos em branco</span>
            <strong class="pos-kpi-val">${fmtPct(focusSummary.votes.pblank)}%</strong>
            <span class="pos-kpi-sub">${fmtInt(vb)} votos</span>
          </div>
          <div class="pos-kpi-item">
            <span class="pos-kpi-label"><i class="pos-kpi-dot" style="background:var(--stale)"></i>Votos nulos</span>
            <strong class="pos-kpi-val">${fmtPct(focusSummary.votes.pnul)}%</strong>
            <span class="pos-kpi-sub">${fmtInt(vn)} votos</span>
          </div>
          <div class="pos-kpi-item">
            <span class="pos-kpi-label"><i class="pos-kpi-dot" style="background:var(--muted)"></i>Abstenção</span>
            <strong class="pos-kpi-val">${fmtPct(focusSummary.electorate.pabst)}%</strong>
            <span class="pos-kpi-sub">${fmtInt(abst)} eleitores</span>
          </div>
        </div>
      </div>
      <details class="pos-a11y-details">
        <summary>Ver tabela da composição do eleitorado</summary>
        <table class="pos-a11y-table">
          <thead><tr><th>Categoria</th><th>Quantidade</th><th>Percentual</th></tr></thead>
          <tbody>
            <tr><td>Eleitorado apto</td><td>${fmtInt(te)}</td><td>100,00%</td></tr>
            <tr><td>Comparecimento</td><td>${fmtInt(focusSummary.electorate.present)}</td><td>${fmtPct(focusSummary.electorate.ppresent)}%</td></tr>
            <tr><td>Votos válidos</td><td>${fmtInt(vv)}</td><td>${fmtPct(focusSummary.votes.pvalid)}% (dos comparecentes)</td></tr>
            <tr><td>Brancos</td><td>${fmtInt(vb)}</td><td>${fmtPct(focusSummary.votes.pblank)}%</td></tr>
            <tr><td>Nulos</td><td>${fmtInt(vn)}</td><td>${fmtPct(focusSummary.votes.pnul)}%</td></tr>
            <tr><td>Abstenção</td><td>${fmtInt(abst)}</td><td>${fmtPct(focusSummary.electorate.pabst)}%</td></tr>
          </tbody>
        </table>
      </details>
    `;

    // 3. Estados por vencedor e por margem
    const statesObj = presBr.states || {};
    const stateEntries = Object.keys(UF_META)
      .map((uf) => {
        const d = statesObj[uf];
        if (!d || !d.cands || d.cands.length < 2) return null;
        const l = leaders(d);
        const slot = d.cands.indexOf(l.top) === 1 ? 1 : 0;
        return { uf, name: UF_META[uf].name, reg: UF_META[uf].reg, d, l, slot };
      })
      .filter(Boolean)
      .sort((a, b) => b.l.margin - a.l.margin);

    const presP0 = getCandProfile(null, 0, 'br', 'pres');
    const presP1 = getCandProfile(null, 1, 'br', 'pres');
    const count0 = stateEntries.filter((e) => e.slot === 0).length;
    const count1 = stateEntries.filter((e) => e.slot === 1).length;

    document.getElementById('desc-estados').textContent =
      `${presP0.displayName} venceu em ${count0} UFs · ${presP1.displayName} venceu em ${count1} UFs (incluindo DF e ZZ).`;

    document.getElementById('body-chart-estados').innerHTML = `
      <div class="pos-hbar-list" role="img" aria-label="Ranking de estados por margem de vitória">
        ${stateEntries
          .map((item) => {
            const col = item.slot === 1 ? presP1.color : presP0.color;
            const winName = item.slot === 1 ? presP1.shortName : presP0.shortName;
            return `
              <div class="pos-hbar-row">
                <span class="pos-hbar-label" title="${esc(item.name)}">${esc(item.uf.toUpperCase())} · ${esc(item.name)}</span>
                <div class="pos-hbar-track">
                  <div class="pos-hbar-fill" style="width:${item.d.cands[0].pct}%;background:${presP0.color}"></div>
                  <div class="pos-hbar-fill" style="width:${item.d.cands[1].pct}%;background:${presP1.color}"></div>
                </div>
                <span class="pos-hbar-val"><strong style="color:${col}">${esc(winName)}</strong> +${fmtPct(item.l.margin)} p.p.</span>
              </div>
            `;
          })
          .join('')}
      </div>
      <details class="pos-a11y-details">
        <summary>Ver tabela completa dos 27 estados + Exterior</summary>
        <table class="pos-a11y-table">
          <thead><tr><th>UF</th><th>Vencedor</th><th>${esc(presP0.shortName)}</th><th>${esc(presP1.shortName)}</th><th>Margem (p.p.)</th></tr></thead>
          <tbody>
            ${stateEntries
              .map(
                (it) =>
                  `<tr><td>${esc(it.name)} (${esc(it.uf.toUpperCase())})</td><td>${esc(it.slot === 1 ? presP1.displayName : presP0.displayName)}</td><td>${fmtPct(it.d.cands[0].pct)}%</td><td>${fmtPct(it.d.cands[1].pct)}%</td><td>+${fmtPct(it.l.margin)} p.p.</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      </details>
    `;

    // 4. Por Região
    const regionsOrder = ['Sudeste', 'Nordeste', 'Sul', 'Norte', 'Centro-Oeste', 'Exterior'];
    const regTotals = {};
    for (const r of regionsOrder) regTotals[r] = { v0: 0, v1: 0 };
    for (const item of stateEntries) {
      const r = item.reg || 'Exterior';
      if (!regTotals[r]) regTotals[r] = { v0: 0, v1: 0 };
      regTotals[r].v0 += item.d.cands[0].votes;
      regTotals[r].v1 += item.d.cands[1].votes;
    }

    const regRows = regionsOrder.map((r) => {
      const { v0, v1 } = regTotals[r];
      const tot = v0 + v1 || 1;
      const pct0 = Number(((v0 / tot) * 100).toFixed(2));
      const pct1 = Number((100 - pct0).toFixed(2));
      return { reg: r, v0, v1, tot, pct0, pct1, margin: Math.abs(pct0 - pct1), slot: v0 >= v1 ? 0 : 1 };
    });

    document.getElementById('body-chart-regioes').innerHTML = `
      <div class="pos-hbar-list" role="img" aria-label="Desempenho por região do Brasil">
        ${regRows
          .map((r) => {
            const col = r.slot === 1 ? presP1.color : presP0.color;
            return `
              <div class="pos-hbar-row" style="grid-template-columns:105px minmax(0,1fr) 150px">
                <span class="pos-hbar-label">${esc(r.reg)}</span>
                <div class="pos-hbar-track" style="height:14px">
                  <div class="pos-hbar-fill" style="width:${r.pct0}%;background:${presP0.color}"></div>
                  <div class="pos-hbar-fill" style="width:${r.pct1}%;background:${presP1.color}"></div>
                </div>
                <span class="pos-hbar-val"><strong style="color:${col}">${fmtPct(r.pct0)}% × ${fmtPct(r.pct1)}%</strong></span>
              </div>
            `;
          })
          .join('')}
      </div>
      <details class="pos-a11y-details">
        <summary>Ver tabela de votos e percentuais por região</summary>
        <table class="pos-a11y-table">
          <thead><tr><th>Região</th><th>${esc(presP0.shortName)} (votos / %)</th><th>${esc(presP1.shortName)} (votos / %)</th><th>Votos válidos</th></tr></thead>
          <tbody>
            ${regRows
              .map(
                (r) =>
                  `<tr><td>${esc(r.reg)}</td><td>${fmtInt(r.v0)} (${fmtPct(r.pct0)}%)</td><td>${fmtInt(r.v1)} (${fmtPct(r.pct1)}%)</td><td>${fmtInt(r.tot)}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      </details>
    `;

    // 5. Municípios (carrega os maiores polos para consolidar estatísticas e Top 10 decisivos)
    const sampleUfs = ['sp', 'mg', 'rj', 'ba', 'pr', 'rs', 'pe', 'ce', 'pa', 'go', 'ma', 'sc', 'am', 'es', 'rn', 'df', 'ac', 'to'];
    await Promise.all(sampleUfs.map((u) => ensureUfCitiesLoaded('pres', u)));
    const allMuns = [];
    for (const [k, bundle] of Object.entries(posStore.munResultsByKey)) {
      if (!k.startsWith('pres:') || !bundle?.municipios) continue;
      const uf = k.split(':')[1];
      for (const m of bundle.municipios) {
        allMuns.push({ ...m, uf });
      }
    }

    let munWins0 = 0;
    let munWins1 = 0;
    let munTight = 0;
    allMuns.forEach((m) => {
      const l = leaders(m);
      if (!l) return;
      if (l.margin < 2.0) munTight++;
      if (m.cands.indexOf(l.top) === 0) munWins0++;
      else munWins1++;
    });

    const topDecisive = [...allMuns]
      .map((m) => ({ ...m, l: leaders(m) }))
      .filter((m) => m.l)
      .sort((a, b) => b.l.voteDiff - a.l.voteDiff)
      .slice(0, 10);

    document.getElementById('body-chart-municipios').innerHTML = `
      <div class="pos-kpi-grid">
        <div class="pos-kpi-item">
          <span class="pos-kpi-label"><i class="pos-kpi-dot" style="background:${presP0.color}"></i>Vitórias de ${esc(presP0.shortName)}</span>
          <strong class="pos-kpi-val">${fmtInt(munWins0)}</strong>
          <span class="pos-kpi-sub">municípios analisados</span>
        </div>
        <div class="pos-kpi-item">
          <span class="pos-kpi-label"><i class="pos-kpi-dot" style="background:${presP1.color}"></i>Vitórias de ${esc(presP1.shortName)}</span>
          <strong class="pos-kpi-val">${fmtInt(munWins1)}</strong>
          <span class="pos-kpi-sub">municípios analisados</span>
        </div>
        <div class="pos-kpi-item">
          <span class="pos-kpi-label">Margem apertada (&lt; 2 p.p.)</span>
          <strong class="pos-kpi-val">${fmtInt(munTight)}</strong>
          <span class="pos-kpi-sub">cidades altamente competitivas</span>
        </div>
      </div>
      <div style="margin-top:12px">
        <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:8px">Top 10 municípios mais decisivos em saldo líquido de votos:</div>
        <div class="pos-hbar-list" style="max-height:220px">
          ${topDecisive
            .map((m) => {
              const slot = m.cands.indexOf(m.l.top) === 1 ? 1 : 0;
              const col = slot === 1 ? presP1.color : presP0.color;
              const winName = slot === 1 ? presP1.shortName : presP0.shortName;
              return `
                <div class="pos-hbar-row" style="grid-template-columns:150px minmax(0,1fr) 140px">
                  <span class="pos-hbar-label">${esc(m.name)} (${esc(m.uf.toUpperCase())})</span>
                  <div class="pos-hbar-track">
                    <div class="pos-hbar-fill" style="width:${m.cands[0].pct}%;background:${presP0.color}"></div>
                    <div class="pos-hbar-fill" style="width:${m.cands[1].pct}%;background:${presP1.color}"></div>
                  </div>
                  <span class="pos-hbar-val"><strong style="color:${col}">${esc(winName)}</strong> +${fmtInt(m.l.voteDiff)}</span>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;

    // 6. Comparecimento e Abstenção por UF
    const turnoutEntries = [...stateEntries].sort((a, b) => (b.d.electorate?.ppresent || 0) - (a.d.electorate?.ppresent || 0));
    document.getElementById('body-chart-comparecimento').innerHTML = `
      <div class="pos-hbar-list" role="img" aria-label="Comparecimento e abstenção por UF">
        ${turnoutEntries
          .map((it) => {
            const comp = it.d.electorate?.ppresent || 85.15;
            const abstPct = it.d.electorate?.pabst || Number((100 - comp).toFixed(2));
            return `
              <div class="pos-hbar-row">
                <span class="pos-hbar-label">${esc(it.uf.toUpperCase())} · ${esc(it.name)}</span>
                <div class="pos-hbar-track">
                  <div class="pos-hbar-fill" style="width:${comp}%;background:var(--live)"></div>
                  <div class="pos-hbar-fill" style="width:${abstPct}%;background:var(--muted)"></div>
                </div>
                <span class="pos-hbar-val"><strong>${fmtPct(comp)}%</strong> · abst. ${fmtPct(abstPct)}%</span>
              </div>
            `;
          })
          .join('')}
      </div>
      <details class="pos-a11y-details">
        <summary>Ver tabela de comparecimento e abstenção por estado</summary>
        <table class="pos-a11y-table">
          <thead><tr><th>UF</th><th>Comparecimento (%)</th><th>Presentes</th><th>Abstenção (%)</th><th>Ausentes</th></tr></thead>
          <tbody>
            ${turnoutEntries
              .map(
                (it) =>
                  `<tr><td>${esc(it.name)}</td><td>${fmtPct(it.d.electorate.ppresent)}%</td><td>${fmtInt(it.d.electorate.present)}</td><td>${fmtPct(it.d.electorate.pabst)}%</td><td>${fmtInt(it.d.electorate.abst)}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      </details>
    `;

    // 7. Levantamento por horários e Evolução da Apuração
    renderHorariosChart(presP0, presP1);

    // 8. Governadores nas 6 UFs disputadas
    const govStates = govSum?.states || {};
    document.getElementById('body-chart-governadores').innerHTML = `
      <div class="pos-bands-grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
        ${GOV_UFS.map((uf) => {
          const gd = govStates[uf];
          if (!gd || !gd.cands || gd.cands.length < 2) {
            return `<div class="pos-band-card"><strong>${esc(UF_META[uf].name)} (${esc(uf.toUpperCase())})</strong><span>Aguardando dados finais</span></div>`;
          }
          const gp0 = getCandProfile(gd.cands[0], 0, uf, 'gov');
          const gp1 = getCandProfile(gd.cands[1], 1, uf, 'gov');
          const gl = leaders(gd);
          return `
            <div class="pos-band-card">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <strong>${esc(UF_META[uf].name)} (${esc(uf.toUpperCase())})</strong>
                <button type="button" class="pos-share-chart-btn" data-open-gov-cities="${esc(uf)}">Ver cidades →</button>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px">
                <span style="color:${gp0.color};font-weight:600">${esc(gp0.shortName)} (${esc(gp0.party)})</span>
                <strong>${fmtPct(gd.cands[0].pct)}%</strong>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px">
                <span style="color:${gp1.color};font-weight:600">${esc(gp1.shortName)} (${esc(gp1.party)})</span>
                <strong>${fmtPct(gd.cands[1].pct)}%</strong>
              </div>
              <div class="pos-stacked-bar" style="height:8px;margin-top:4px">
                <div class="pos-stacked-seg" style="width:${gd.cands[0].pct}%;background:${gp0.color}"></div>
                <div class="pos-stacked-seg" style="width:${gd.cands[1].pct}%;background:${gp1.color}"></div>
              </div>
              <small style="color:var(--muted)">Margem: +${fmtPct(gl ? gl.margin : 0)} p.p. (${fmtInt(gl ? gl.voteDiff : 0)} votos)</small>
            </div>
          `;
        }).join('')}
      </div>
    `;

    posSection.querySelectorAll('button[data-open-gov-cities]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openCitiesModal('gov', btn.dataset.openGovCities, null, { pushHistory: true });
      });
    });
  }

  function renderHorariosChart(presP0, presP1) {
    const container = document.getElementById('body-chart-horarios');
    const hDoc = posStore.horarios || {};
    const rawPoints =
      Array.isArray(hDoc.points) && hDoc.points.length > 0
        ? hDoc.points
        : SIM && Array.isArray(hDoc.simPoints)
        ? hDoc.simPoints
        : [];

    const isSimSeries = (!hDoc.points || !hDoc.points.length) && SIM && rawPoints.length > 0;
    const breakdown = computeTimeBandsBreakdown(rawPoints, TIME_BANDS_CONFIG);

    const honestyHtml = `
      <div class="pos-honesty-banner">
        <div>
          <strong>Nota de transparência metodológica (Votos apurados por horário × Horário do voto):</strong>
          <span>${esc(
            hDoc.honestyDisclaimer ||
              'Os números abaixo representam VOTOS APURADOS E DIVULGADOS POR HORÁRIO pelo TSE (carimbos dt/ht dos lotes EA20), e não o momento exato em que o eleitor digitou o voto.'
          )}</span>
          <div style="margin-top:4px;color:var(--muted)">
            <strong>Fuso horário de referência:</strong> Horário Oficial de Brasília (UTC-3). A votação ocorreu de forma unificada em todo o país (AC votou das 6h às 15h locais; AM, RO, RR, MT e MS das 7h às 16h locais; Fernando de Noronha das 9h às 18h locais).
          </div>
        </div>
        ${isSimSeries ? `<span class="sim-mark">SÉRIE SIMULADA (?sim)</span>` : ''}
      </div>
    `;

    if (!breakdown.hasData) {
      container.innerHTML = `
        ${honestyHtml}
        <div style="padding:24px;text-align:center;border:1px dashed var(--hairline-strong);border-radius:16px;margin-top:14px">
          <h4 style="margin:0 0 6px;font-size:15px">Série histórica de lotes por horário ainda não importada</h4>
          <p style="margin:0 auto;max-width:640px;font-size:13px;color:var(--muted)">
            O painel original não grava histórico persistente no servidor e o arquivo final <code>-u.json</code> do TSE contém apenas o último carimbo <code>dt/ht</code>.
            Para visualizar a curva real sem dados inventados, clique em <strong>«Importar JSON de horários»</strong> acima ou execute
            <code>node scripts/build-snapshot.js --history-dir ./pasta-de-snapshots</code>.
            (Para testar o componente visual agora, abra com <code>?sim</code>).
          </p>
        </div>
      `;
      return;
    }

    const sw = breakdown.specialWindow;
    const swLeader = sw.leaderSlot === 1 ? presP1 : presP0;

    // Monta SVG da curva acumulada (votos × horário)
    const dList = breakdown.deltas;
    const maxAcc = Math.max(1, dList[dList.length - 1]?.accValid || 1);
    const svgW = 680;
    const svgH = 180;
    const padL = 44;
    const padR = 20;
    const padT = 18;
    const padB = 30;
    const plotW = svgW - padL - padR;
    const plotH = svgH - padT - padB;

    const coordsA = [];
    const coordsB = [];
    dList.forEach((pt, i) => {
      const x = padL + (i / Math.max(1, dList.length - 1)) * plotW;
      const yA = padT + plotH - (pt.accA / maxAcc) * plotH * 1.8;
      const yB = padT + plotH - (pt.accB / maxAcc) * plotH * 1.8;
      coordsA.push(`${x.toFixed(1)},${Math.max(padT, yA).toFixed(1)}`);
      coordsB.push(`${x.toFixed(1)},${Math.max(padT, yB).toFixed(1)}`);
    });

    container.innerHTML = `
      ${honestyHtml}

      <!-- Destaque especial da janela 17h–19h -->
      <div class="pos-window-highlight" style="margin-top:14px">
        <span class="pos-window-badge">Janela em Destaque • 17h às 19h (Brasília)</span>
        <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:22px;font-weight:700">${fmtInt(sw.totalVotos)} votos apurados na janela (${fmtPct(sw.pctOfTotal)}% do total nacional)</div>
            <div style="font-size:12.5px;color:var(--muted)">Período concentrado logo após o fechamento unificado às 17h e prorrogações até as 19h.</div>
          </div>
          <div style="text-align:right">
            <strong style="color:${swLeader.color}">${esc(swLeader.displayName)} liderou na janela (+${fmtPct(sw.marginPP)} p.p.)</strong>
            <div style="font-size:13px">${esc(presP0.shortName)} ${fmtPct(sw.pctA)}% (${fmtInt(sw.votosA)}) × ${esc(presP1.shortName)} ${fmtPct(sw.pctB)}% (${fmtInt(sw.votosB)})</div>
          </div>
        </div>
        <div class="pos-stacked-bar" style="height:12px">
          <div class="pos-stacked-seg" style="width:${sw.pctA}%;background:${presP0.color}"></div>
          <div class="pos-stacked-seg" style="width:${sw.pctB}%;background:${presP1.color}"></div>
        </div>
      </div>

      <!-- Grade das 4 faixas configuráveis -->
      <div class="pos-bands-grid" style="margin-top:14px">
        ${breakdown.bands
          .map((b) => {
            const bLead = b.leaderSlot === 1 ? presP1 : presP0;
            return `
              <div class="pos-band-card ${b.special ? 'is-special' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <strong>${esc(b.label)}</strong>
                  <span style="font-size:12px;font-weight:600;color:var(--muted)">${fmtPct(b.pctOfTotal)}% do total</span>
                </div>
                <div style="font-size:18px;font-weight:700">${fmtInt(b.totalVotos)} <small style="font-size:12px;font-weight:400;color:var(--muted)">votos apurados</small></div>
                <div class="pos-stacked-bar" style="height:8px">
                  <div class="pos-stacked-seg" style="width:${b.pctA}%;background:${presP0.color}"></div>
                  <div class="pos-stacked-seg" style="width:${b.pctB}%;background:${presP1.color}"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:12px">
                  <span style="color:${presP0.color}">${esc(presP0.shortName)} ${fmtPct(b.pctA)}%</span>
                  <span style="color:${presP1.color}">${esc(presP1.shortName)} ${fmtPct(b.pctB)}%</span>
                </div>
                <small style="color:var(--muted)">${
                  b.totalVotos > 0 ? `Liderança na faixa: ${esc(bLead.shortName)} (+${fmtPct(b.marginPP)} p.p.)` : 'Sem lotes divulgados nesta faixa'
                }</small>
              </div>
            `;
          })
          .join('')}
      </div>

      <!-- Gráfico de Linha Acumulada + Ritmo de Entrada -->
      <div style="margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
        <div style="border:1px solid var(--hairline);border-radius:14px;padding:12px">
          <div style="font-size:12.5px;font-weight:600;margin-bottom:8px">Evolução acumulada de votos apurados por horário</div>
          <svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;height:auto" role="img" aria-label="Curva acumulada de votos apurados por horário">
            <line x1="${padL}" y1="${padT + plotH}" x2="${svgW - padR}" y2="${padT + plotH}" stroke="var(--hairline-strong)" />
            <polyline fill="none" stroke="${presP0.color}" stroke-width="2.5" points="${coordsA.join(' ')}" />
            <polyline fill="none" stroke="${presP1.color}" stroke-width="2.5" points="${coordsB.join(' ')}" />
            ${dList
              .map((pt, i) => {
                const x = padL + (i / Math.max(1, dList.length - 1)) * plotW;
                return i % 2 === 0
                  ? `<text x="${x.toFixed(1)}" y="${svgH - 8}" font-size="10" fill="var(--muted)" text-anchor="middle">${esc(pt.hora)}</text>`
                  : '';
              })
              .join('')}
          </svg>
        </div>

        <div style="border:1px solid var(--hairline);border-radius:14px;padding:12px">
          <div style="font-size:12.5px;font-weight:600;margin-bottom:8px">Ritmo de entrada (votos apurados por minuto em cada lote)</div>
          <div class="pos-hbar-list" style="max-height:165px">
            ${dList
              .map((pt) => {
                const maxRate = Math.max(1, ...dList.map((d) => d.votesPerMin));
                const wPct = Math.min(100, (pt.votesPerMin / maxRate) * 100);
                return `
                  <div class="pos-hbar-row" style="grid-template-columns:56px minmax(0,1fr) 125px">
                    <span class="pos-hbar-label">${esc(pt.hora)}</span>
                    <div class="pos-hbar-track">
                      <div class="pos-hbar-fill" style="width:${wPct.toFixed(1)}%;background:var(--ink)"></div>
                    </div>
                    <span class="pos-hbar-val">${fmtInt(pt.votesPerMin)} votos/min</span>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>

      <details class="pos-a11y-details">
        <summary>Ver tabela detalhada de lotes por horário</summary>
        <table class="pos-a11y-table">
          <thead><tr><th>Horário (Brasília)</th><th>Seções (%)</th><th>Acumulado ${esc(presP0.shortName)}</th><th>Acumulado ${esc(presP1.shortName)}</th><th>Entrada no lote</th><th>Ritmo (votos/min)</th></tr></thead>
          <tbody>
            ${dList
              .map(
                (pt) =>
                  `<tr><td>${esc(pt.hora)}</td><td>${fmtPct(pt.secoesPct)}%</td><td>${fmtInt(pt.accA)}</td><td>${fmtInt(pt.accB)}</td><td>+${fmtInt(pt.dValid)}</td><td>${fmtInt(pt.votesPerMin)}/min</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      </details>
    `;
  }

  // Importação manual de arquivo JSON de horários pelo usuário
  const importInput = document.getElementById('pos-import-horarios-input');
  if (importInput) {
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const txt = await file.text();
        const parsed = JSON.parse(txt);
        const pts = Array.isArray(parsed) ? parsed : parsed.points || parsed.simPoints || [];
        posStore.horarios = {
          ...(posStore.horarios || {}),
          points: pts,
          source: `Importado pelo usuário (${file.name})`,
        };
        renderAllPosCharts();
      } catch {
        /* ignora JSON malformado com segurança */
      }
    });
  }

  // Botões «Compartilhar este gráfico» em cada card
  posSection.addEventListener('click', (e) => {
    const shareBtn = e.target.closest('button[data-share-chart]');
    if (!shareBtn) return;
    const chartKey = shareBtn.dataset.shareChart;
    openBoletimModal({ focusChart: chartKey });
  });

  // --------------------------------------------------------------------------
  // 3.5 SISTEMA DE BOLETIM COMPARTILHÁVEL («Compartilhar ou não»)
  // --------------------------------------------------------------------------
  const boletimModal = document.createElement('div');
  boletimModal.className = 'pos-boletim-modal hide-on-tv';
  boletimModal.id = 'pos-boletim-modal';
  boletimModal.setAttribute('role', 'dialog');
  boletimModal.setAttribute('aria-modal', 'true');
  boletimModal.setAttribute('aria-labelledby', 'pos-boletim-title');
  boletimModal.hidden = true;

  boletimModal.innerHTML = `
    <div class="pos-boletim-dialog">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div>
          <h2 id="pos-boletim-title" style="margin:0;font-size:20px;font-weight:700">Boletim Final Compartilhável</h2>
          <p style="margin:4px 0 0;font-size:12.5px;color:var(--muted)">
            Escolha exatamente o que entra no boletim. Nada é enviado ou publicado sem sua ação.
          </p>
        </div>
        <span class="pos-validation-tag ok" id="pos-boletim-validation">Conferência numérica OK</span>
      </div>

      <div class="pos-boletim-grid">
        <div class="pos-switches-list" role="group" aria-label="Selecionar seções do boletim">
          <label class="pos-switch-item">
            <input type="checkbox" data-bol-opt="resultado" checked>
            <span>Resultado final (% completo e votos absolutos)</span>
          </label>
          <label class="pos-switch-item">
            <input type="checkbox" data-bol-opt="composicao" checked>
            <span>Votos válidos, brancos, nulos e abstenção</span>
          </label>
          <label class="pos-switch-item">
            <input type="checkbox" data-bol-opt="estados" checked>
            <span>Vencedor por estado (UFs)</span>
          </label>
          <label class="pos-switch-item">
            <input type="checkbox" data-bol-opt="regioes" checked>
            <span>Resultado por região</span>
          </label>
          <label class="pos-switch-item">
            <input type="checkbox" data-bol-opt="municipios">
            <span>Resumo por municípios</span>
          </label>
          <label class="pos-switch-item">
            <input type="checkbox" data-bol-opt="horarios" checked>
            <span>Levantamento por horários (janela 17h–19h)</span>
          </label>
          <label class="pos-switch-item">
            <input type="checkbox" data-bol-opt="governadores">
            <span>Governadores (6 UFs do 2º turno)</span>
          </label>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="font-size:12px;font-weight:600;color:var(--muted)">Pré-visualização fiel do boletim:</div>
          <pre class="pos-preview-box" id="pos-boletim-preview"></pre>
        </div>
      </div>

      <div class="pos-boletim-actions">
        <div class="pos-action-group">
          <button type="button" class="pos-btn primary" id="bol-btn-copy">Copiar texto</button>
          <a class="pos-btn" id="bol-btn-wa" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a class="pos-btn" id="bol-btn-x" target="_blank" rel="noopener noreferrer">X</a>
          <a class="pos-btn" id="bol-btn-tg" target="_blank" rel="noopener noreferrer">Telegram</a>
          <button type="button" class="pos-btn" id="bol-btn-png-feed">Baixar PNG (1080×1350)</button>
          <button type="button" class="pos-btn" id="bol-btn-png-story">Baixar Stories (1080×1920)</button>
          <button type="button" class="pos-btn" id="bol-btn-link">Copiar link da vista</button>
        </div>
        <button type="button" class="pos-btn" id="bol-btn-cancel">Cancelar / Não compartilhar</button>
      </div>
    </div>
  `;
  document.body.appendChild(boletimModal);

  function getBoletimOptions() {
    const opts = {};
    boletimModal.querySelectorAll('input[data-bol-opt]').forEach((inp) => {
      opts[inp.dataset.bolOpt] = inp.checked;
    });
    return opts;
  }

  function buildBoletimText() {
    const opts = getBoletimOptions();
    const presBr = posStore.presBr;
    const govSum = posStore.govSummary;
    const nat = presBr?.national;
    if (!nat) return 'Dados finais ainda não gerados.';

    const val = validateElectionTotals(nat);
    const valBadge = document.getElementById('pos-boletim-validation');
    if (valBadge) {
      valBadge.textContent = val.ok ? 'Soma 100% conferida' : val.reason;
      valBadge.className = `pos-validation-tag ${val.ok ? 'ok' : ''}`;
    }

    const p0 = getCandProfile(nat.cands[0], 0, 'br', 'pres');
    const p1 = getCandProfile(nat.cands[1], 1, 'br', 'pres');
    const c0 = nat.cands[0];
    const c1 = nat.cands[1];
    const L = leaders(nat);

    const lines = [];
    lines.push(`${SIM ? '[SIMULADO] ' : ''}BOLETIM PÓS-ELEIÇÃO 2026 • 2º TURNO`);
    lines.push(`Totalização TSE: ${nat.dt} às ${nat.ht} (${fmtPct(nat.sections.pct)}% das seções)`);
    lines.push('');

    if (opts.resultado) {
      lines.push('▸ RESULTADO FINAL (PRESIDENTE):');
      lines.push(`• ${p0.displayName} (${p0.party} ${p0.number}): ${fmtPct(c0.pct)}% (${fmtInt(c0.votes)} votos)`);
      lines.push(`• ${p1.displayName} (${p1.party} ${p1.number}): ${fmtPct(c1.pct)}% (${fmtInt(c1.votes)} votos)`);
      if (L) {
        lines.push(`• Diferença: ${fmtPct(L.margin)} p.p. (${fmtInt(L.voteDiff)} votos)`);
      }
      lines.push('');
    }

    if (opts.composicao) {
      lines.push('▸ COMPOSIÇÃO DO ELEITORADO:');
      lines.push(`• Votos válidos: ${fmtPct(nat.votes.pvalid)}% (${fmtInt(nat.votes.valid)})`);
      lines.push(`• Brancos: ${fmtPct(nat.votes.pblank)}% (${fmtInt(nat.votes.blank)})`);
      lines.push(`• Nulos: ${fmtPct(nat.votes.pnul)}% (${fmtInt(nat.votes.nul)})`);
      lines.push(`• Comparecimento: ${fmtPct(nat.electorate.ppresent)}% (${fmtInt(nat.electorate.present)})`);
      lines.push(`• Abstenção: ${fmtPct(nat.electorate.pabst)}% (${fmtInt(nat.electorate.abst)})`);
      lines.push('');
    }

    if (opts.estados && presBr.states) {
      const ufs0 = [];
      const ufs1 = [];
      Object.keys(UF_META).forEach((u) => {
        const st = presBr.states[u];
        const l = leaders(st);
        if (!l) return;
        if (st.cands.indexOf(l.top) === 0) ufs0.push(u.toUpperCase());
        else ufs1.push(u.toUpperCase());
      });
      lines.push('▸ VENCEDOR POR ESTADO (UFs):');
      lines.push(`• ${p0.shortName} (${ufs0.length}): ${ufs0.join(', ')}`);
      lines.push(`• ${p1.shortName} (${ufs1.length}): ${ufs1.join(', ')}`);
      lines.push('');
    }

    if (opts.regioes && presBr.states) {
      lines.push('▸ POR REGIÃO:');
      const regs = ['Sudeste', 'Nordeste', 'Sul', 'Norte', 'Centro-Oeste', 'Exterior'];
      regs.forEach((r) => {
        let v0 = 0, v1 = 0;
        Object.keys(UF_META).forEach((u) => {
          if (UF_META[u].reg === r && presBr.states[u]) {
            v0 += presBr.states[u].cands[0].votes;
            v1 += presBr.states[u].cands[1].votes;
          }
        });
        const tot = v0 + v1 || 1;
        lines.push(`• ${r}: ${p0.shortName} ${fmtPct((v0 / tot) * 100)}% × ${p1.shortName} ${fmtPct((v1 / tot) * 100)}%`);
      });
      lines.push('');
    }

    if (opts.municipios) {
      let w0 = 0, w1 = 0;
      Object.entries(posStore.munResultsByKey).forEach(([k, b]) => {
        if (!k.startsWith('pres:') || !b?.municipios) return;
        b.municipios.forEach((m) => {
          const l = leaders(m);
          if (!l) return;
          if (m.cands.indexOf(l.top) === 0) w0++;
          else w1++;
        });
      });
      lines.push('▸ RESUMO MUNICIPAL:');
      lines.push(`• Municípios contabilizados: ${p0.shortName} venceu em ${w0} · ${p1.shortName} venceu em ${w1}`);
      lines.push('');
    }

    if (opts.horarios) {
      const hDoc = posStore.horarios || {};
      const pts = (hDoc.points && hDoc.points.length) ? hDoc.points : (SIM ? hDoc.simPoints || [] : []);
      const bd = computeTimeBandsBreakdown(pts, TIME_BANDS_CONFIG);
      lines.push('▸ VOTOS APURADOS POR HORÁRIO (Horário de Brasília):');
      if (bd.hasData) {
        const sw = bd.specialWindow;
        lines.push(`• Destaque 17h–19h: ${fmtInt(sw.totalVotos)} votos (${fmtPct(sw.pctOfTotal)}% do total) — ${p0.shortName} ${fmtPct(sw.pctA)}% × ${p1.shortName} ${fmtPct(sw.pctB)}%`);
      } else {
        lines.push('• Série horária: aguardando importação dos lotes de totalização.');
      }
      lines.push('');
    }

    if (opts.governadores && govSum?.states) {
      lines.push('▸ GOVERNADORES (2º TURNO):');
      GOV_UFS.forEach((u) => {
        const gd = govSum.states[u];
        if (!gd) return;
        const gp0 = getCandProfile(gd.cands[0], 0, u, 'gov');
        const gp1 = getCandProfile(gd.cands[1], 1, u, 'gov');
        lines.push(`• ${u.toUpperCase()}: ${gp0.shortName} ${fmtPct(gd.cands[0].pct)}% × ${gp1.shortName} ${fmtPct(gd.cands[1].pct)}%`);
      });
      lines.push('');
    }

    lines.push('Nota: Projeto independente, sem vínculo oficial. O resultado oficial é o do TSE.');
    return lines.join('\n');
  }

  function refreshBoletimPreview() {
    const txt = buildBoletimText();
    const shareUrl = `${location.origin}${location.pathname}${SIM ? '?sim' : ''}#pres/analise`;
    const full = `${txt}\n${shareUrl}`;
    document.getElementById('pos-boletim-preview').textContent = txt;
    document.getElementById('bol-btn-wa').href = `https://wa.me/?text=${encodeURIComponent(full)}`;
    document.getElementById('bol-btn-x').href = `https://x.com/intent/tweet?text=${encodeURIComponent(txt.slice(0, 240))}&url=${encodeURIComponent(shareUrl)}`;
    document.getElementById('bol-btn-tg').href = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(txt)}`;
  }

  // Geração de imagem PNG (1080×1350 ou 1080×1920) no próprio navegador via <canvas>
  function downloadBoletimPng(width, height) {
    const nat = posStore.presBr?.national;
    if (!nat) return;
    const p0 = getCandProfile(nat.cands[0], 0, 'br', 'pres');
    const p1 = getCandProfile(nat.cands[1], 1, 'br', 'pres');
    const c0 = nat.cands[0];
    const c1 = nat.cands[1];

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Fundo Broadcast Night
    ctx.fillStyle = '#07080c';
    ctx.fillRect(0, 0, width, height);

    // Barra superior de identidade
    ctx.fillStyle = '#f5f7fa';
    ctx.font = '700 38px system-ui, -apple-system, sans-serif';
    ctx.fillText('APURAÇÃO 2026 • 2º TURNO', 72, 110);

    ctx.fillStyle = '#7f8798';
    ctx.font = '500 24px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Boletim Pós-Eleição · Dados do TSE (${nat.dt} às ${nat.ht})`, 72, 152);

    // Bloco Candidato 1
    ctx.fillStyle = p0.color;
    ctx.font = '700 44px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${p0.displayName} (${p0.party} · ${p0.number})`, 72, 260);
    ctx.fillStyle = '#f5f7fa';
    ctx.font = '700 86px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${fmtPct(c0.pct)}%`, 72, 355);
    ctx.fillStyle = '#c6ccd8';
    ctx.font = '500 28px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${fmtInt(c0.votes)} votos`, 72, 400);

    // Bloco Candidato 2
    ctx.fillStyle = p1.color;
    ctx.font = '700 44px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${p1.displayName} (${p1.party} · ${p1.number})`, 72, 500);
    ctx.fillStyle = '#f5f7fa';
    ctx.font = '700 86px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${fmtPct(c1.pct)}%`, 72, 595);
    ctx.fillStyle = '#c6ccd8';
    ctx.font = '500 28px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${fmtInt(c1.votes)} votos`, 72, 640);

    // Barra Tug-of-War
    const barW = width - 144;
    const w0 = Math.round((c0.pct / 100) * barW);
    ctx.fillStyle = p0.color;
    ctx.fillRect(72, 690, w0, 18);
    ctx.fillStyle = p1.color;
    ctx.fillRect(72 + w0, 690, barW - w0, 18);

    // Linhas do texto selecionado pelo usuário
    const previewLines = buildBoletimText().split('\n').slice(2, 18);
    ctx.fillStyle = '#c6ccd8';
    ctx.font = '400 23px system-ui, -apple-system, sans-serif';
    let y = 765;
    for (const ln of previewLines) {
      if (y > height - 120) break;
      ctx.fillText(ln.slice(0, 68), 72, y);
      y += 34;
    }

    // Rodapé com ressalva obrigatória
    ctx.fillStyle = '#7f8798';
    ctx.font = '500 20px system-ui, -apple-system, sans-serif';
    ctx.fillText('Projeto independente, sem vínculo oficial. O resultado oficial é o do TSE.', 72, height - 56);

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `boletim-apuracao-2026-${width}x${height}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function openBoletimModal({ focusChart = null } = {}) {
    if (focusChart) {
      boletimModal.querySelectorAll('input[data-bol-opt]').forEach((inp) => {
        inp.checked = inp.dataset.bolOpt === focusChart || inp.dataset.bolOpt === 'resultado';
      });
    }
    refreshBoletimPreview();
    boletimModal.hidden = false;
  }

  function closeBoletimModal() {
    boletimModal.hidden = true;
  }

  document.getElementById('btn-open-boletim')?.addEventListener('click', () => openBoletimModal());
  document.getElementById('bol-btn-cancel')?.addEventListener('click', closeBoletimModal);
  boletimModal.addEventListener('click', (e) => {
    if (e.target === boletimModal) closeBoletimModal();
  });
  boletimModal.querySelectorAll('input[data-bol-opt]').forEach((inp) => {
    inp.addEventListener('change', refreshBoletimPreview);
  });

  document.getElementById('bol-btn-copy')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const txt = buildBoletimText();
    try {
      await navigator.clipboard.writeText(txt);
      btn.textContent = 'Texto copiado!';
    } catch {
      btn.textContent = 'Copiado';
    }
    setTimeout(() => { btn.textContent = 'Copiar texto'; }, 1800);
  });

  document.getElementById('bol-btn-link')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const url = `${location.origin}${location.pathname}${SIM ? '?sim' : ''}#pres/boletim`;
    try {
      await navigator.clipboard.writeText(url);
      btn.textContent = 'Link copiado!';
    } catch {
      btn.textContent = 'Copiado';
    }
    setTimeout(() => { btn.textContent = 'Copiar link da vista'; }, 1800);
  });

  document.getElementById('bol-btn-png-feed')?.addEventListener('click', () => downloadBoletimPng(1080, 1350));
  document.getElementById('bol-btn-png-story')?.addEventListener('click', () => downloadBoletimPng(1080, 1920));

  // --------------------------------------------------------------------------
  // 3.6 ROTAS PÓS-ELEIÇÃO E SINCRONIZAÇÃO DE TEMA/CARGO
  // --------------------------------------------------------------------------
  function handlePosHashNavigation() {
    const parsed = parsePosHash(location.hash);
    if (parsed.subview === 'cidades' && parsed.uf) {
      openCitiesModal(parsed.role, parsed.uf, parsed.munIbge, { pushHistory: false });
    } else {
      if (posStore.citiesModalOpen) closeCitiesModal({ fromPopState: true });
      if (parsed.subview === 'boletim') {
        openBoletimModal();
      } else if (parsed.subview === 'analise' || parsed.subview === 'horarios') {
        posSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  window.addEventListener('popstate', handlePosHashNavigation);
  window.addEventListener('hashchange', handlePosHashNavigation);

  document.getElementById('tab-pres')?.addEventListener('click', () => setTimeout(renderAllPosCharts, 60));
  document.getElementById('tab-gov')?.addEventListener('click', () => setTimeout(renderAllPosCharts, 60));
  document.getElementById('gov-uf-chips')?.addEventListener('click', () => setTimeout(renderAllPosCharts, 60));

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      renderAllPosCharts();
      if (posStore.citiesModalOpen) {
        openCitiesModal(posStore.citiesRole, posStore.citiesUf, posStore.selectedMunIbge, { pushHistory: false });
      }
    });
  }

  // Inicializa gráficos e verifica hash inicial
  renderAllPosCharts().then(() => {
    handlePosHashNavigation();
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPosElectionLayer);
  } else {
    initPosElectionLayer();
  }
}
