// ============================================================================
// Painel de Apuração 2º Turno 2026 — Broadcast Live Engine (app.js)
// Layout 3 Zonas | Fotos dos Candidatos | Live Ticker Monotônico | Mapa c/ Callouts
// Presidente (BR) + Governadores (AC, AM, DF, ES, RN, TO) com dados separados por cargo
// ============================================================================

import { UF_META, UF_PATHS } from './uf-paths.js';

// ----------------------------------------------------------------------------
// 1. CONFIGURAÇÃO DOS CANDIDATOS (Edite aqui nomes, números, fotos ou cores!)
// ----------------------------------------------------------------------------
// - A chave é o número oficial do candidato no TSE (campo "n" do JSON).
// - No modo de teste /?sim, o TSE usa os números fictícios "91" e "92":
//   mapeamos ambos para a Foto 1 (Esquerda) e Foto 2 (Direita) automaticamente
//   para que você veja o visual final completo mesmo offline.
// - Para trocar as fotos, basta substituir:
//   public/img/cand-1.webp (Esquerda) e public/img/cand-2.webp (Direita)
// ----------------------------------------------------------------------------
export const CANDIDATES = {
  // Candidato 1 (SEMPRE À ESQUERDA — Posição Fixa 0)
  '13': {
    slot: 0,
    name: 'Lula',
    party: 'PT',
    number: '13',
    photo: '/img/cand-1.webp',
    colorDark: '#ef3340',
    colorLight: '#d91b2b',
  },
  // Candidato 2 (SEMPRE À DIREITA — Posição Fixa 1)
  '22': {
    slot: 1,
    name: 'Flávio Bolsonaro',
    party: 'PL',
    number: '22',
    photo: '/img/cand-2.webp',
    colorDark: '#3b82f6',
    colorLight: '#1a4fd1',
  },

  // Mapeamento automático para o modo simulado (/?sim usa candidatos nº 91 e 92)
  '91': {
    slot: 0,
    name: 'Lula',
    party: 'PT',
    number: '13',
    photo: '/img/cand-1.webp',
    colorDark: '#ef3340',
    colorLight: '#d91b2b',
  },
  '92': {
    slot: 1,
    name: 'Flávio Bolsonaro',
    party: 'PL',
    number: '22',
    photo: '/img/cand-2.webp',
    colorDark: '#3b82f6',
    colorLight: '#1a4fd1',
  },
};

// ----------------------------------------------------------------------------
// 1b. GOVERNADORES — 2º turno de 25/10/2026: SOMENTE AC, AM, DF, ES, RN e TO
// ----------------------------------------------------------------------------
// - O Rio de Janeiro NÃO tem 2º turno de governador: o TSE anulou os votos de Anthony Garotinho
//   e Douglas Ruas (PL) foi proclamado eleito no 1º turno. Por isso o RJ não está aqui nem nos chips.
// - Cada UF tem exatamente 2 candidatos, em posição FIXA (side: 'left' | 'right'), que nunca muda
//   quando a liderança muda. A ordem do array é a ordem de exibição (esquerda, direita).
// - A cor é por CANDIDATO (e não por posição), com variante para tema escuro e claro,
//   e é a mesma no mapa, nas barras e no painel do estado.
// - `n` é o número de urna (2 dígitos em governador). `photo` aponta para o arquivo local
//   public/img/gov/{uf}-{slug}.webp (600×660). Se o arquivo ainda não existir, aparecem as iniciais.
// - `full` (nome completo) só é usado em texto acessível (alt/aria): confira no DivulgaCandContas.
// - Para testar o RJ (ou outra UF) caso algo mude: abra com ?govextra=rj (sem candidatos fixos,
//   usa os nomes que vierem nos arquivos do TSE).
export const GOV_UFS = ['ac', 'am', 'df', 'es', 'rn', 'to'];

export const GOV_CANDIDATES = {
  ac: [
    { side: 'left',  n: '11', name: 'Mailza Assis', short: 'Mailza', full: 'Mailza Assis Cameli da Silva', party: 'PP', photo: '/img/gov/ac-mailza-assis.webp', colorDark: '#f59e0b', colorLight: '#b45309' },
    { side: 'right', n: '10', name: 'Alan Rick', short: 'Alan Rick', full: 'Alan Rick Miranda', party: 'REPUBLICANOS', photo: '/img/gov/ac-alan-rick.webp', colorDark: '#14b8a6', colorLight: '#0f766e' },
  ],
  am: [
    { side: 'left',  n: '55', name: 'Omar Aziz', short: 'Omar', full: 'Omar José Abdel Aziz', party: 'PSD', photo: '/img/gov/am-omar-aziz.webp', colorDark: '#ef4444', colorLight: '#b91c1c' },
    { side: 'right', n: '22', name: 'Professora Maria do Carmo', short: 'Maria do Carmo', full: 'Professora Maria do Carmo', party: 'PL', photo: '/img/gov/am-professora-maria-do-carmo.webp', colorDark: '#3b82f6', colorLight: '#1d4ed8' },
  ],
  df: [
    { side: 'left',  n: '11', name: 'Celina Leão', short: 'Celina', full: 'Celina Leão Hizim Ferreira', party: 'PP', photo: '/img/gov/df-celina-leao.webp', colorDark: '#ec4899', colorLight: '#be185d' },
    { side: 'right', n: '13', name: 'Leandro Grass', short: 'Grass', full: 'Leandro Grass Peixoto', party: 'PT', photo: '/img/gov/df-leandro-grass.webp', colorDark: '#22c55e', colorLight: '#15803d' },
  ],
  es: [
    { side: 'left',  n: '10', name: 'Lorenzo Pazolini', short: 'Pazolini', full: 'Lorenzo Silva de Pazolini', party: 'REPUBLICANOS', photo: '/img/gov/es-lorenzo-pazolini.webp', colorDark: '#f97316', colorLight: '#c2410c' },
    { side: 'right', n: '15', name: 'Ricardo Ferraço', short: 'Ferraço', full: 'Ricardo de Rezende Ferraço', party: 'MDB', photo: '/img/gov/es-ricardo-ferraco.webp', colorDark: '#d946ef', colorLight: '#a21caf' },
  ],
  rn: [
    { side: 'left',  n: '44', name: 'Allyson', short: 'Allyson', full: 'Allyson Leandro Bezerra Silva', party: 'UNIÃO', photo: '/img/gov/rn-allyson.webp', colorDark: '#84cc16', colorLight: '#4d7c0f' },
    { side: 'right', n: '13', name: 'Cadu de Lula', short: 'Cadu', full: 'Cadu Xavier', party: 'PT', photo: '/img/gov/rn-cadu-de-lula.webp', colorDark: '#fb7185', colorLight: '#be123c' },
  ],
  to: [
    { side: 'left',  n: '44', name: 'Professora Dorinha', short: 'Dorinha', full: 'Maria Auxiliadora Seabra Rezende', party: 'UNIÃO', photo: '/img/gov/to-professora-dorinha.webp', colorDark: '#06b6d4', colorLight: '#0e7490' },
    { side: 'right', n: '45', name: 'Vicentinho Júnior', short: 'Vicentinho', full: 'Vicente Alves de Oliveira Junior', party: 'PSDB', photo: '/img/gov/to-vicentinho-junior.webp', colorDark: '#6366f1', colorLight: '#4338ca' },
  ],
};

// Cores de reserva para candidatos que não estão na config (ex.: arquivos do simulado do TSE).
// A cor sai de um hash da chave do candidato: o mesmo candidato mantém a mesma cor em qualquer UF.
export const GOV_FALLBACK_COLORS = [
  { d: '#f59e0b', l: '#b45309' }, { d: '#14b8a6', l: '#0f766e' }, { d: '#ef4444', l: '#b91c1c' },
  { d: '#3b82f6', l: '#1d4ed8' }, { d: '#ec4899', l: '#be185d' }, { d: '#22c55e', l: '#15803d' },
  { d: '#f97316', l: '#c2410c' }, { d: '#d946ef', l: '#a21caf' }, { d: '#84cc16', l: '#4d7c0f' },
  { d: '#fb7185', l: '#be123c' }, { d: '#06b6d4', l: '#0e7490' }, { d: '#6366f1', l: '#4338ca' },
];

const normParty = (s) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');

// Acha a config de um candidato de governador: primeiro pelo número de urna, depois pelo partido.
export function govConfigFor(uf, cand) {
  const list = GOV_CANDIDATES[uf];
  if (!list || !cand) return null;
  return (
    list.find((g) => g.n === String(cand.n)) ||
    list.find((g) => normParty(g.party) === normParty(cand.party)) ||
    null
  );
}

// ----------------------------------------------------------------------------
// 2. CONFIGURAÇÃO GERAL DE REDE E RITMO DE ATUALIZAÇÃO
// ----------------------------------------------------------------------------
const CONFIG = {
  POLL_INTERVAL_MS: 12_000,       // Polling invisível a cada 12s (dentro da janela 10–15s)
  FINAL_POLL_INTERVAL_MS: 300_000,// 5 min após totalização final
  REQUEST_TIMEOUT_MS: 10_000,     // Timeout por requisição (AbortController)
  MAX_CONCURRENCY: 8,             // Fila máxima de estados simultâneos
  MAX_REQ_PER_CYCLE: 30,          // Limite de segurança por ciclo
  GOV_BG_REFRESH_MS: 60_000,      // Governador: estados fora de foco só atualizam a cada 60s (0 = nunca após a 1ª carga)
  RETRY_404_STATE_MS: 300_000,    // Aguarda 5 min se uma UF retornar 404
  RATE_LIMIT_PAUSE_MS: 600_000,   // Pausa de 10 min em caso de HTTP 429/403
  ARIA_ANNOUNCE_MIN_MS: 180_000,  // Throttle de 3 min para leitores de tela
  TIE_THRESHOLD_PP: 0.5,          // Empate técnico < 0,5 p.p.
  TV_CYCLE_STATE_MS: 6_500,       // No modo ?tv, destaca um estado a cada 6,5s
  CICLO: 'ele2026',
  ELE_PRES_OFICIAL: '6258',
  ELE_GOV_OFICIAL: '6260',
  ELE_SIM_DEFAULT: '21270',       // simulado TSE: Eleição Ordinária Federal (Presidente)
  ELE_SIM_ESTADUAL: '21272',      // simulado TSE: Eleição Ordinária Estadual (Governador)

  // 5 faixas de intensidade para o mapa
  MARGIN_BANDS: [
    { max: 2,        alphaLight: 0.30, alphaDark: 0.36 },
    { max: 5,        alphaLight: 0.46, alphaDark: 0.52 },
    { max: 10,       alphaLight: 0.64, alphaDark: 0.68 },
    { max: 20,       alphaLight: 0.80, alphaDark: 0.84 },
    { max: Infinity, alphaLight: 0.95, alphaDark: 0.96 },
  ],
};

// ----------------------------------------------------------------------------
// 3. FUNÇÕES PURAS DE FORMATAÇÃO E PARSING DO CONTRATO EA20 DO TSE
// ----------------------------------------------------------------------------
const numFmtInt = new Intl.NumberFormat('pt-BR');
const numFmtPct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const num = (s) => (s == null || s === '' ? 0 : Number(String(s).replace(',', '.')) || 0);
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtInt = (n) => numFmtInt.format(Math.round(Number(n || 0)));
export const fmtPct = (n) => numFmtPct.format(Number(n || 0));

const SMALL_WORDS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
export const titleCase = (s) =>
  String(s || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

export const initialsOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter((w) => !SMALL_WORDS.has(w.toLowerCase()));
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ctx = { role: 'pres' | 'gov', uf } — o cargo define a regra de ordenação dos candidatos (B8).
export function parseUnified(j, cargoCode = '1', ctx = {}) {
  if (!j || typeof j !== 'object') return null;
  // B10: o TSE pode mandar "0003"; compara como número. Só aceita o único cargo do arquivo
  // se ele não trouxer o código (nunca mistura cargos).
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

  if (ctx.role === 'gov') {
    // B8: governador ignora CANDIDATES (13 e 22 colidem com PT/PL) e usa a ordem fixa da UF em GOV_CANDIDATES.
    // Quem não está na config vai depois, pela ordem `seq` do TSE.
    const list = GOV_CANDIDATES[ctx.uf] || [];
    const idxOf = (c) => {
      const g = govConfigFor(ctx.uf, c);
      return g ? list.indexOf(g) : -1;
    };
    cands.sort((a, b) => {
      const ia = idxOf(a);
      const ib = idxOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.seq - b.seq;
    });
  } else {
    // Ordem fixa: respeita o slot configurado em CANDIDATES (Esquerda = 0, Direita = 1) ou o `seq` do TSE
    cands.sort((a, b) => {
      const sa = CANDIDATES[a.n]?.slot ?? a.seq;
      const sb = CANDIDATES[b.n]?.slot ?? b.seq;
      return sa - sb;
    });
  }

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

export function leaders(d) {
  if (!d || !d.cands || !d.cands.length) return null;
  const tot = d.cands.reduce((acc, c) => acc + c.votes, 0);
  if (!tot) return null;
  const sorted = [...d.cands].sort((a, b) => b.votes - a.votes);
  const top = sorted[0];
  const second = sorted[1] || null;
  const margin = second ? Math.max(0, top.pct - second.pct) : top.pct;
  const voteDiff = second ? Math.max(0, top.votes - second.votes) : top.votes;
  return { top, second, margin, voteDiff, tot, isTie: second ? margin < CONFIG.TIE_THRESHOLD_PP : false };
}

export const stampOf = (a) => `${a.dt || ''} ${a.ht || ''} ${a.s && a.s.st}`;

// ----------------------------------------------------------------------------
// 4. MOTOR DO TICKER AO VIVO (LiveTicker — todas as regras obrigatórias)
// ----------------------------------------------------------------------------
// Regras garantidas:
// 1. TARGET = último valor oficial exato recebido do TSE. SHOWN = inteiro exibido na tela.
// 2. SHOWN <= TARGET sempre (a menos que o TSE publique uma correção para baixo; nesse caso,
//    faz ease suave até o novo TARGET oficial).
// 3. Entre lotes oficiais, SHOWN sobe com pequenos incrementos irregulares naturais no ritmo
//    observado dos últimos lotes, pousando exatamente em TARGET quando o próximo lote é esperado.
// 4. Se SHOWN ficar muito atrás (> 20s ou > 2 intervalos), aciona catch-up suave (ease-out de 2.5s)
//    pousando exatamente em TARGET.
// 5. Quando SHOWN === TARGET, fica em repouso exato.
// 6. Se uma requisição falhar ou os dados ficarem obsoletos (stale), congela imediatamente em TARGET.
// 7. Faz snap instantâneo (SHOWN = TARGET) em: totalização final (tf === "s"), retorno de aba oculta,
//    abertura de detalhe de estado ou prefers-reduced-motion ativo.
export class LiveTicker {
  constructor() {
    this.target = 0;
    this.shown = 0;
    this.floatShown = 0;
    this.initialized = false;
    this.frozen = false;

    // Controle de ritmo entre lotes
    this.lastBatchAt = 0;
    this.expectedIntervalMs = CONFIG.POLL_INTERVAL_MS;
    this.lastTickAt = 0;

    // Modo catch-up ou correção oficial do TSE
    this.easingMode = false;
    this.easeStartVal = 0;
    this.easeStartTime = 0;
    this.easeDurationMs = 2500;
  }

  receiveOfficialTarget(newTarget, nowMs = performance.now(), options = {}) {
    const exactTarget = Math.max(0, Math.floor(Number(newTarget) || 0));
    const { snap = false } = options;

    if (!this.initialized || snap) {
      this.target = exactTarget;
      this.shown = exactTarget;
      this.floatShown = exactTarget;
      this.initialized = true;
      this.frozen = false;
      this.easingMode = false;
      this.lastBatchAt = nowMs;
      this.lastTickAt = nowMs;
      return;
    }

    // Calcula o ritmo observado entre lotes reais
    if (exactTarget !== this.target && this.lastBatchAt > 0) {
      const elapsed = nowMs - this.lastBatchAt;
      if (elapsed >= 3000 && elapsed <= 60_000) {
        this.expectedIntervalMs = Math.round(0.65 * this.expectedIntervalMs + 0.35 * elapsed);
      }
      this.lastBatchAt = nowMs;
    }

    // Caso 1: Correção rara do TSE para baixo -> ease suave até o novo TARGET oficial
    if (exactTarget < this.shown) {
      this.target = exactTarget;
      this.easingMode = true;
      this.easeStartVal = this.shown;
      this.easeStartTime = nowMs;
      this.easeDurationMs = 1800;
      this.lastTickAt = nowMs;
      return;
    }

    const prevTarget = this.target;
    const prevGap = Math.max(0, prevTarget - this.shown);
    this.target = exactTarget;
    this.frozen = false;

    // Caso 2: Se no início de um novo lote o SHOWN anterior ainda não tinha alcançado o prevTarget,
    // ou se o atraso acumulado for grande (> 2 intervalos), faz catch-up suave em 2.4s
    const newGap = this.target - this.shown;
    if (prevGap > 0 && newGap > (this.target - prevTarget) * 1.8) {
      this.easingMode = true;
      this.easeStartVal = this.shown;
      this.easeStartTime = nowMs;
      this.easeDurationMs = 2400;
    } else if (!this.initialized) {
      // No primeiro lote da sessão, começa 99,985% perto do TARGET para já mostrar vida sutil sem atrasar
      this.shown = exactTarget;
      this.floatShown = exactTarget;
    }
    this.lastTickAt = nowMs;
  }

  // Permite iniciar uma subida sutil quando um novo lote chega com mais votos
   receiveBatchWithTrailing(newTarget, nowMs = performance.now(), options = {}) {
    const exactTarget = Math.max(0, Math.floor(Number(newTarget) || 0));
    const { snap = false } = options;

    if (snap) {
      this.receiveOfficialTarget(exactTarget, nowMs, { snap: true });
      return;
    }

    if (!this.initialized) {
      // Na abertura inicial, começa a uma fração minúscula abaixo do TARGET (ex.: 450 votos atrás)
      // para que o contador já pulse vivo até pousar em TARGET no fim do ciclo de 12s
      const initialLeadIn = Math.min(480, Math.floor(exactTarget * 0.00001));
      this.target = exactTarget;
      this.shown = Math.max(0, exactTarget - initialLeadIn);
      this.floatShown = this.shown;
      this.initialized = true;
      this.frozen = false;
      this.easingMode = false;
      this.lastBatchAt = nowMs;
      this.lastTickAt = nowMs;
      return;
    }

    this.receiveOfficialTarget(exactTarget, nowMs, { snap: false });
  }

  freezeAtTarget() {
    this.frozen = true;
    this.easingMode = false;
    this.shown = this.target;
    this.floatShown = this.target;
  }

  snapToTarget() {
    this.easingMode = false;
    this.shown = this.target;
    this.floatShown = this.target;
  }

  step(nowMs = performance.now()) {
    if (!this.initialized || this.frozen) return this.shown;
    if (this.shown === this.target) {
      this.easingMode = false;
      this.lastTickAt = nowMs;
      return this.shown;
    }

    const dt = Math.max(0, Math.min(250, nowMs - (this.lastTickAt || nowMs)));
    this.lastTickAt = nowMs;

    // Se estiver muito atrasado (> 20s desde o último lote), entra em catch-up suave (2.5s)
    if (!this.easingMode && this.lastBatchAt > 0 && nowMs - this.lastBatchAt > 20_000 && this.shown < this.target) {
      this.easingMode = true;
      this.easeStartVal = this.shown;
      this.easeStartTime = nowMs;
      this.easeDurationMs = 2400;
    }

    if (this.easingMode) {
      const t = Math.min(1, (nowMs - this.easeStartTime) / this.easeDurationMs);
      // Cubic ease-out: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(this.easeStartVal + (this.target - this.easeStartVal) * eased);
      if (this.target >= this.easeStartVal) {
        this.shown = Math.min(this.target, Math.max(this.shown, val));
      } else {
        // Correção oficial do TSE para baixo
        this.shown = Math.max(this.target, val);
      }
      this.floatShown = this.shown;
      if (t >= 1 || this.shown === this.target) {
        this.shown = this.target;
        this.floatShown = this.target;
        this.easingMode = false;
      }
      return this.shown;
    }

    // Subida orgânica irregular entre lotes: calcula o tempo restante até o próximo lote esperado
    const elapsedSinceBatch = Math.max(0, nowMs - this.lastBatchAt);
    const remainingMs = Math.max(600, this.expectedIntervalMs - elapsedSinceBatch);
    const remainingVotes = this.target - this.shown;

    if (remainingVotes <= 0) {
      this.shown = this.target;
      this.floatShown = this.target;
      return this.shown;
    }

    // Modulação orgânica determinística (combinação de senos não harmônicos para evitar passo robótico)
    const wave = 1 + 0.42 * Math.sin(nowMs * 0.0073) + 0.28 * Math.cos(nowMs * 0.0191);
    const baseRatePerMs = remainingVotes / remainingMs;
    const delta = baseRatePerMs * dt * Math.max(0.25, wave);

    this.floatShown = Math.min(this.target, this.floatShown + delta);
    const nextInt = Math.min(this.target, Math.floor(this.floatShown));

    // Monotônico: nunca diminui e nunca ultrapassa TARGET
    if (nextInt > this.shown) {
      this.shown = nextInt;
    }
    if (remainingMs <= 650 && this.shown < this.target) {
      this.shown = this.target;
      this.floatShown = this.target;
    }
    return this.shown;
  }
}

// Auto-verificação automatizada das 5 invariantes do LiveTicker (acessível via ?selftest ou console)
export function runTickerSelfCheck() {
  const results = [];

  // 1. Invariante: SHOWN <= TARGET sempre e monotônico
  const t1 = new LiveTicker();
  t1.receiveBatchWithTrailing(100_000, 1000);
  let prev = t1.shown;
  let monotonic = true;
  let neverExceeds = true;
  for (let ms = 1016; ms <= 15_000; ms += 50) {
    const cur = t1.step(ms);
    if (cur < prev) monotonic = false;
    if (cur > t1.target) neverExceeds = false;
    prev = cur;
  }
  results.push({ check: 'SHOWN <= TARGET sempre', pass: neverExceeds });
  results.push({ check: 'SHOWN é monotônico crescente', pass: monotonic });
  results.push({ check: 'Converge exatamente para TARGET no repouso', pass: t1.shown === 100_000 });

  // 2. Catch-up suave após atraso longo (> 20s)
  const t2 = new LiveTicker();
  t2.receiveOfficialTarget(50_000, 1000, { snap: true });
  t2.receiveOfficialTarget(80_000, 2000, { snap: false });
  t2.step(25_000); // Dispara catch-up após > 20s
  for (let ms = 25_100; ms <= 28_000; ms += 100) t2.step(ms);
  results.push({ check: 'Catch-up converge em 2.4s após atraso longo', pass: t2.shown === 80_000 });

  // 3. Falha de rede ou dado obsoleto congela SHOWN em TARGET
  const t3 = new LiveTicker();
  t3.receiveBatchWithTrailing(200_000, 1000);
  t3.step(3000);
  t3.freezeAtTarget();
  const afterFreeze = t3.shown;
  t3.step(9000);
  results.push({ check: 'Falha/stale congela imediatamente em TARGET', pass: afterFreeze === 200_000 && t3.shown === 200_000 });

  const allPass = results.every((r) => r.pass);
  return { allPass, results };
}
if (typeof window !== 'undefined') window.__runTickerSelfCheck = runTickerSelfCheck;

// ----------------------------------------------------------------------------
// 5. APLICAÇÃO PRINCIPAL (DOM, Mapa, Rede e Eventos)
// ----------------------------------------------------------------------------
if (typeof window !== 'undefined' && typeof document !== 'undefined') (() => {
  const params = new URLSearchParams(location.search);
  const SIM = params.has('sim');
  const TV_MODE = params.has('tv');
  const FORCE_PRE17 = params.has('pre17');
  const SELFTEST = params.has('selftest');
  const IS_FILE = location.protocol === 'file:';

  const MSG_NO_RUNOFF = 'Governador definido no 1º turno';
  const MSG_WAITING = 'Aguardando o TSE';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // --------------------------------------------------------------------------
  // 5.1 ROTAS — a URL é a fonte da verdade (B6)
  //     #pres  #pres/sp  #gov  #gov/ac   (o formato antigo #sp continua valendo = #pres/sp)
  // --------------------------------------------------------------------------
  function parseRoute(hash = location.hash) {
    const parts = String(hash || '')
      .replace(/^#/, '')
      .toLowerCase()
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    let role = 'pres';
    let uf = null;
    if (parts[0] === 'gov' || parts[0] === 'pres') {
      role = parts[0];
      uf = parts[1] || null;
    } else if (parts[0]) {
      uf = parts[0];
    }
    if (uf && !UF_META[uf]) uf = null;
    return { role, uf };
  }
  const routeHash = (role, uf) => `#${role}${uf ? `/${uf}` : ''}`;
  const initialRoute = parseRoute();

  // B1: só as 6 UFs com 2º turno de governador (mais as que forem pedidas em ?govextra=)
  const extraUfs = (params.get('govextra') || '')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter((u) => UF_META[u] && u !== 'zz' && !GOV_UFS.includes(u));
  const govDisputedUfs = [...GOV_UFS, ...extraUfs];
  const hasRunoff = (uf) => govDisputedUfs.includes(uf);

  let activeRole = initialRoute.role;
  let activeGovUf = activeRole === 'gov' && hasRunoff(initialRoute.uf) ? initialRoute.uf : govDisputedUfs[0];

  // --------------------------------------------------------------------------
  // 5.2 DADOS SEPARADOS POR CARGO (B2)
  // --------------------------------------------------------------------------
  const makeStore = (role) => ({
    role,
    national: null, // Presidente: arquivo `br`
    states: {}, // dados por UF
    stamps: {},
    stateTimes: {},
    fetchedAt: {}, // quando cada UF foi buscada pela última vez (Governador)
    retryAt: {},
    hist: {}, // séries do sparkline (chave: 'br' ou UF)
    tickers: [new LiveTicker(), new LiveTicker()], // Presidente
    tickersByUf: {}, // Governador: um par de contadores por UF
  });
  const store = { pres: makeStore('pres'), gov: makeStore('gov') };
  const cur = () => store[activeRole];
  const focusKey = () => (activeRole === 'gov' ? activeGovUf : 'br');
  // Dado que alimenta o bloco principal (esquerda | direita)
  const focusData = (S = cur()) => (S.role === 'gov' ? S.states[activeGovUf] : S.national) || null;
  const hasVotes = (d) => Boolean(d && d.cands && d.cands.length >= 2 && leaders(d));
  const tickersOf = (S, uf) => {
    if (S.role !== 'gov') return S.tickers;
    if (!S.tickersByUf[uf]) S.tickersByUf[uf] = [new LiveTicker(), new LiveTicker()];
    return S.tickersByUf[uf];
  };
  const activeTickers = () => tickersOf(cur(), activeGovUf);
  const forEachTicker = (S, fn) => {
    if (S.role === 'gov') Object.values(S.tickersByUf).forEach((pair) => pair.forEach(fn));
    else S.tickers.forEach(fn);
  };
  const freezeTickers = (S) => forEachTicker(S, (t) => t.freezeAtTarget());

  // --------------------------------------------------------------------------
  // 5.3 URLs do TSE (ciclo ele2026)
  //     Oficial: 2º turno Presidente = 6258, Governador = 6260
  //     Simulado (simulado2026): Federal = 21270, Estadual = 21272
  // --------------------------------------------------------------------------
  const getEleCode = (role = activeRole) => {
    if (SIM) {
      const s = params.get(role === 'gov' ? 'simgov' : 'sim');
      if (s && /^\d+$/.test(s)) return s;
      return role === 'gov' ? CONFIG.ELE_SIM_ESTADUAL : CONFIG.ELE_SIM_DEFAULT;
    }
    const e = params.get(role === 'gov' ? 'elegov' : 'ele');
    if (e && /^\d+$/.test(e)) return e;
    return role === 'gov' ? CONFIG.ELE_GOV_OFICIAL : CONFIG.ELE_PRES_OFICIAL;
  };

  const getCargoCode = (role = activeRole) => (role === 'gov' ? '0003' : '0001');
  const getBaseUrl = () => {
    if (SIM) return IS_FILE ? 'https://resultados-sim.tse.jus.br/simulado/simulado2026' : '/api/sim';
    return IS_FILE ? 'https://resultados.tse.jus.br/oficial' : '/api/tse';
  };

  const urlResult = (uf, role = activeRole) => {
    const ele = getEleCode(role);
    const e6 = 'e' + String(ele).padStart(6, '0');
    return `${getBaseUrl()}/${CONFIG.CICLO}/${ele}/dados/${uf}/${uf}-c${getCargoCode(role)}-${e6}-u.json`;
  };

  const urlTrack = (role = activeRole) => {
    const ele = getEleCode(role);
    const e6 = 'e' + String(ele).padStart(6, '0');
    return `${getBaseUrl()}/${CONFIG.CICLO}/${ele}/dados/br/br-${e6}-ab.json`;
  };

  // --------------------------------------------------------------------------
  // 5.4 DOM
  // --------------------------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const dom = {
    srAnnouncer: $('#sr-announcer'),
    liveIndicator: $('#live-indicator'),
    liveLabel: $('#live-label'),
    officialTimeLabel: $('#official-time-label'),
    simMark: $('#sim-mark'),
    finalMark: $('#final-mark'),
    tabPres: $('#tab-pres'),
    tabGov: $('#tab-gov'),
    govBar: $('#gov-bar'),
    govChips: $('#gov-uf-chips'),
    calmLine: $('#calm-state-line'),
    calmText: $('#calm-state-text'),
    pre17Timer: $('#pre17-timer'),
    stage: $('#stage'),
    stageOffice: $('#stage-office'),
    stageUf: $('#stage-uf'),
    stagePlace: $('#stage-place'),
    stageTime: $('#stage-time'),
    splitSeg0: $('#split-seg-0'),
    splitSeg1: $('#split-seg-1'),
    secPctLabel: $('#sec-pct-label'),
    secsCountText: $('#secs-count-text'),
    diffValues: $('#diff-values'),
    totalValidVotes: $('#total-valid-votes'),
    secProgressbar: $('#sec-progressbar'),
    secProgFill: $('#sec-prog-fill'),
    mapViewport: $('#map-viewport'),
    mapSvg: $('#map'),
    mapDefs: $('#map defs'),
    mapPaths: $('#map-paths'),
    mapRings: $('#map-rings'),
    mapCallouts: $('#map-callouts'),
    mapLabels: $('#map-labels'),
    tieRectA: $('#tie-rect-a'),
    tieRectB: $('#tie-rect-b'),
    extBtn: $('#ext-btn'),
    extDot: $('#ext-dot'),
    shareMain: $('#share-main'),
    btnShareMain: $('#btn-share-main'),
    shareMenu: $('#share-menu'),
    shareCopy: $('#share-copy'),
    shareCopyText: $('#share-copy-text'),
    shareNative: $('#share-native'),
    shareStatus: $('#share-status'),
    legendGradient: $('#legend-gradient'),
    legendCaption: $('#legend-caption'),
    detailBackdrop: $('#detail-backdrop'),
    detailPanel: $('#detail-panel'),
    sheetHandle: $('#sheet-handle'),
    popoverHead: $('#popover-head'),
    detailUfCode: $('#detail-uf-code'),
    detailUfTitle: $('#detail-uf-title'),
    detailUfSub: $('#detail-uf-sub'),
    detailStatus: $('#detail-status'),
    btnShareUf: $('#btn-share-uf'),
    shareBtnText: $('#share-btn-text'),
    btnCloseDetail: $('#btn-close-detail'),
    detailCandsList: $('#detail-cands-list'),
    detailMsg: $('#detail-msg'),
    detailLead: $('#detail-lead'),
    detailSecWrap: $('#detail-sec-wrap'),
    detailSecFill: $('#detail-sec-fill'),
    detSec: $('#det-sec'),
    btnToggleDetails: $('#btn-toggle-details'),
    secondaryDrawer: $('#secondary-drawer'),
    mCompPct: $('#m-comp-pct'),
    mCompAbs: $('#m-comp-abs'),
    mAbstPct: $('#m-abst-pct'),
    mAbstAbs: $('#m-abst-abs'),
    mValPct: $('#m-val-pct'),
    mValAbs: $('#m-val-abs'),
    mBrPct: $('#m-br-pct'),
    mBrAbs: $('#m-br-abs'),
    mNulPct: $('#m-nul-pct'),
    mNulAbs: $('#m-nul-abs'),
    sparklineBody: $('#sparkline-body'),
    selftestBadge: $('#selftest-badge'),
    tip: $('#tip'),
    cands: [0, 1].map((i) => ({
      photo: $(`#photo-${i}`),
      avatar: $(`#avatar-${i}`),
      initials: $(`#initials-${i}`),
      elected: $(`#elected-${i}`),
      meta: $(`#meta-${i}`),
      name: $(`#name-${i}`),
      pct: $(`#pct-${i}`),
      tickerBtn: $(`#ticker-btn-${i}`),
      votesShown: $(`#votes-shown-${i}`),
      exactPop: $(`#exact-pop-${i}`),
      votesTarget: $(`#votes-target-${i}`),
      votesTime: $(`#votes-time-${i}`),
      lead: $(`#lead-${i}`),
    })),
  };

  if (SIM) dom.simMark.hidden = false;
  if (TV_MODE) document.body.classList.add('tv-mode');

  // Estado em memória que não depende do cargo
  const etags = new Map();
  const jsonCache = new Map();
  const svgPathEls = {};
  const calloutEls = {};
  const domTextCache = new WeakMap();
  const rings = {};

  let selectedUf = null;
  let busy = false;
  let pendingSnap = null; // B4: pedido de ciclo feito enquanto outro ciclo roda
  let cycleCtrl = null;
  let errorStreak = 0;
  let rateLimitedUntil = 0;
  let lastAriaAnnounceAt = 0;
  let waitingFor17h = false;

  const prefersReducedMotion = () =>
    Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const isLightMode = () =>
    !TV_MODE && Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);

  const isMobileSheet = () => Boolean(window.matchMedia && window.matchMedia('(max-width: 960px)').matches);

  function setTextDiff(el, text) {
    if (!el) return;
    const str = String(text ?? '');
    if (domTextCache.get(el) === str) return;
    domTextCache.set(el, str);
    el.textContent = str;
  }

  const hashStr = (s) => {
    let h = 0;
    const str = String(s || '');
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  };

  // --------------------------------------------------------------------------
  // 5.5 PERFIL VISUAL DOS CANDIDATOS (nome, partido, foto e cor)
  //     Presidente: CANDIDATES. Governador: GOV_CANDIDATES (cor fixa POR CANDIDATO — B9).
  // --------------------------------------------------------------------------
  function getCandidateProfile(cand, slotIdx, uf = activeGovUf, role = activeRole) {
    const light = isLightMode();

    if (role === 'gov') {
      const g = cand ? govConfigFor(uf, cand) : (GOV_CANDIDATES[uf] || [])[slotIdx] || null;
      if (g) {
        return {
          displayName: g.name,
          fullName: g.full || g.name,
          shortName: g.short || g.name,
          party: g.party,
          number: g.n,
          photo: g.photo || '',
          color: light ? g.colorLight : g.colorDark,
        };
      }
      const name = titleCase(cand?.name || `Candidato ${slotIdx + 1}`);
      const pal = GOV_FALLBACK_COLORS[hashStr(cand?.key || cand?.n || name) % GOV_FALLBACK_COLORS.length];
      return {
        displayName: name,
        fullName: name,
        shortName: name.split(' ')[0],
        party: cand?.party || '',
        number: cand?.n || '',
        photo: '',
        color: light ? pal.l : pal.d,
      };
    }

    const cfg = (cand && CANDIDATES[String(cand.n)]) || (slotIdx === 0 ? CANDIDATES['13'] : CANDIDATES['22']);
    return {
      displayName: cfg.name || titleCase(cand?.name || ''),
      fullName: cfg.name || titleCase(cand?.name || ''),
      shortName: cfg.name || titleCase(cand?.name || ''),
      party: cfg.party || cand?.party || '',
      number: cfg.number || cand?.n || '',
      photo: cfg.photo || '',
      color: light ? cfg.colorLight : cfg.colorDark,
    };
  }

  // Cores que alimentam aurora, barra de proporção e halos (candidatos do bloco principal)
  function syncThemeColors() {
    const d = focusData();
    const cands = hasVotes(d) ? d.cands : [];
    const p0 = getCandidateProfile(cands[0], 0);
    const p1 = getCandidateProfile(cands[1], 1);
    // No <body> (e não no <html>): o tema claro do CSS redefine --cand-0/--cand-1 no body
    // e ganharia das cores do candidato quando elas ficassem no <html>.
    document.body.style.setProperty('--cand-0', p0.color);
    document.body.style.setProperty('--cand-1', p1.color);
    if (dom.tieRectA) dom.tieRectA.setAttribute('fill', p0.color);
    if (dom.tieRectB) dom.tieRectB.setAttribute('fill', p1.color);
    const metaTheme = $('#meta-theme-color');
    if (metaTheme) metaTheme.setAttribute('content', isLightMode() ? '#f6f7f9' : '#07080c');
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      refreshView({ snap: true });
    });
  }

  // Foto com fallback para iniciais. Também volta ao normal ao trocar de cargo (a foto
  // do Presidente não reaparecia depois de passar pelos Governadores).
  function setPhoto(slotDom, url, alt) {
    slotDom.photo.alt = alt || '';
    if (!url) {
      slotDom.photo.hidden = true;
      slotDom.avatar.hidden = false;
      return;
    }
    if (slotDom.photo.getAttribute('src') !== url) {
      slotDom.photo.hidden = true; // até carregar, mostra as iniciais
      slotDom.avatar.hidden = false;
      slotDom.photo.setAttribute('src', url);
    } else if (slotDom.photo.complete && slotDom.photo.naturalWidth > 0) {
      slotDom.photo.hidden = false;
      slotDom.avatar.hidden = true;
    }
  }

  dom.cands.forEach((slotDom) => {
    slotDom.photo.addEventListener('error', () => {
      slotDom.photo.hidden = true;
      slotDom.avatar.hidden = false;
    });
    slotDom.photo.addEventListener('load', () => {
      slotDom.photo.hidden = false;
      slotDom.avatar.hidden = true;
    });

    // Affordance para exibir o valor oficial exato TARGET com o horário do TSE
    const showExact = () => {
      slotDom.exactPop.hidden = false;
    };
    const hideExact = () => {
      slotDom.exactPop.hidden = true;
    };
    slotDom.tickerBtn.addEventListener('mouseenter', showExact);
    slotDom.tickerBtn.addEventListener('mouseleave', hideExact);
    slotDom.tickerBtn.addEventListener('focus', showExact);
    slotDom.tickerBtn.addEventListener('blur', hideExact);
    slotDom.tickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      slotDom.exactPop.hidden = !slotDom.exactPop.hidden;
    });
  });

  document.addEventListener('click', () => {
    dom.cands.forEach((s) => {
      s.exactPop.hidden = true;
    });
  });

  // Loop de animação de 60 fps do LiveTicker via requestAnimationFrame
  function tickerAnimationLoop(nowMs) {
    if (!document.hidden && !prefersReducedMotion()) {
      const d = focusData();
      if (hasVotes(d)) {
        const tk = activeTickers();
        for (let i = 0; i < 2; i++) {
          const val = tk[i].step(nowMs);
          setTextDiff(dom.cands[i].votesShown, fmtInt(val));
        }
      }
    }
    requestAnimationFrame(tickerAnimationLoop);
  }
  requestAnimationFrame(tickerAnimationLoop);

  // --------------------------------------------------------------------------
  // 5.6 MAPA DO BRASIL COM CALLOUTS PARA NORDESTE DENSO E DF
  // --------------------------------------------------------------------------
  function initMap() {
    dom.mapPaths.innerHTML = '';
    dom.mapCallouts.innerHTML = '';
    dom.mapLabels.innerHTML = '';
    dom.mapRings.innerHTML = '';

    Object.keys(UF_META).forEach((uf) => {
      if (uf === 'zz' || !UF_PATHS[uf]) return;
      const meta = UF_META[uf];

      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', UF_PATHS[uf]);
      p.setAttribute('class', 'uf-shape');
      p.setAttribute('tabindex', '0');
      p.setAttribute('role', 'button');
      p.setAttribute('aria-label', `${meta.name}: sem votos apurados`);
      p.dataset.uf = uf;
      dom.mapPaths.appendChild(p);
      svgPathEls[uf] = p;

      // Se o estado tiver coordenada de callout (RN, PB, PE, AL, SE, DF), desenha linha + pílula sem sobrepor
      if (meta.lx && meta.ly) {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', String(meta.cx));
        line.setAttribute('y1', String(meta.cy));
        line.setAttribute('x2', String(meta.lx - 13));
        line.setAttribute('y2', String(meta.ly));
        line.setAttribute('class', 'uf-callout-line');
        dom.mapCallouts.appendChild(line);

        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'uf-callout-pill');
        g.dataset.uf = uf;
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', String(meta.lx - 13));
        rect.setAttribute('y', String(meta.ly - 9));
        rect.setAttribute('width', '26');
        rect.setAttribute('height', '18');
        const txt = document.createElementNS(SVG_NS, 'text');
        txt.setAttribute('x', String(meta.lx));
        txt.setAttribute('y', String(meta.ly));
        txt.textContent = uf.toUpperCase();
        g.appendChild(rect);
        g.appendChild(txt);
        dom.mapCallouts.appendChild(g);
        calloutEls[uf] = { group: g, rect };
      } else {
        const lbl = document.createElementNS(SVG_NS, 'text');
        lbl.setAttribute('x', String(meta.cx));
        lbl.setAttribute('y', String(meta.cy));
        lbl.setAttribute('class', 'uf-map-label');
        lbl.textContent = uf.toUpperCase();
        dom.mapLabels.appendChild(lbl);
      }
    });

    // B13: anéis de destaque (hover e seleção) desenhados POR CIMA dos estados, sem mexer na
    // ordem dos nós do mapa (a navegação por setas e os cliques ficam estáveis).
    ['hover', 'sel'].forEach((kind) => {
      const ring = document.createElementNS(SVG_NS, 'path');
      ring.setAttribute('class', `uf-ring uf-ring-${kind}`);
      ring.setAttribute('aria-hidden', 'true');
      dom.mapRings.appendChild(ring);
      rings[kind] = ring;
    });
  }

  function setRing(kind, uf) {
    const ring = rings[kind];
    if (!ring) return;
    if (uf && UF_PATHS[uf]) {
      ring.setAttribute('d', UF_PATHS[uf]);
      ring.classList.add('on');
    } else {
      ring.classList.remove('on');
    }
  }

  function markSelected() {
    Object.entries(svgPathEls).forEach(([k, el]) => el.classList.toggle('sel', k === selectedUf));
    Object.entries(calloutEls).forEach(([k, c]) => c.group.classList.toggle('sel', k === selectedUf));
    dom.extBtn.classList.toggle('sel', selectedUf === 'zz');
    setRing('sel', selectedUf);
  }

  let hoverUf = null;
  function setHover(uf) {
    if (hoverUf === uf) return;
    if (hoverUf && svgPathEls[hoverUf]) svgPathEls[hoverUf].classList.remove('hover');
    hoverUf = uf;
    if (uf && svgPathEls[uf]) svgPathEls[uf].classList.add('hover');
    setRing('hover', uf);
  }

  function getBandForMargin(margin) {
    const m = Math.max(0, Number(margin) || 0);
    for (const b of CONFIG.MARGIN_BANDS) {
      if (m < b.max) return b;
    }
    return CONFIG.MARGIN_BANDS[CONFIG.MARGIN_BANDS.length - 1];
  }

  // Padrão listrado de empate técnico: um global (Presidente) e um por UF (Governador, cores de cada dupla)
  function ensureTiePattern(id, colA, colB) {
    let pat = dom.mapDefs.querySelector(`#${id}`);
    if (!pat) {
      pat = document.createElementNS(SVG_NS, 'pattern');
      pat.setAttribute('id', id);
      pat.setAttribute('width', '10');
      pat.setAttribute('height', '10');
      pat.setAttribute('patternTransform', 'rotate(-45 0 0)');
      pat.setAttribute('patternUnits', 'userSpaceOnUse');
      ['0', '5'].forEach((x) => {
        const r = document.createElementNS(SVG_NS, 'rect');
        r.setAttribute('x', x);
        r.setAttribute('y', '0');
        r.setAttribute('width', '5');
        r.setAttribute('height', '10');
        pat.appendChild(r);
      });
      dom.mapDefs.appendChild(pat);
    }
    const [a, b] = pat.querySelectorAll('rect');
    a.setAttribute('fill', colA);
    b.setAttribute('fill', colB);
    return `url(#${id})`;
  }

  function paintState(uf) {
    const S = cur();
    const meta = UF_META[uf];
    const pathEl = svgPathEls[uf];
    const callout = calloutEls[uf];
    const light = isLightMode();
    const gov = activeRole === 'gov';
    const noRunoff = gov && !hasRunoff(uf); // B3: UFs sem 2º turno ficam neutras
    const d = noRunoff ? null : S.states[uf];
    const L = hasVotes(d) ? leaders(d) : null;
    const name = meta ? meta.name : uf.toUpperCase();

    if (pathEl) pathEl.classList.toggle('no-runoff', noRunoff);
    if (callout) callout.group.classList.toggle('no-runoff', noRunoff);

    let ariaDesc = noRunoff ? `${name}: ${MSG_NO_RUNOFF}` : `${name}: sem votos apurados`;
    if (L && d) {
      const candsDesc = d.cands
        .slice(0, 2)
        .map((c, idx) => `${getCandidateProfile(c, idx, uf).displayName} ${fmtPct(c.pct)}% (${fmtInt(c.votes)} votos)`)
        .join(', ');
      ariaDesc = `${name}: ${candsDesc}${L.isTie ? ' (empate técnico)' : ''}, ${fmtPct(d.sections.pct)}% das seções apuradas`;
    }

    if (pathEl) pathEl.setAttribute('aria-label', ariaDesc);
    if (uf === 'zz') dom.extBtn.setAttribute('aria-label', ariaDesc);

    if (!L || !d) {
      if (pathEl) {
        pathEl.style.fill = '';
        pathEl.style.fillOpacity = '';
      }
      if (callout) callout.rect.style.fill = '';
      if (uf === 'zz') dom.extDot.style.background = 'var(--map-empty)';
      return;
    }

    // Determina qual dos dois slots lidera na UF
    const leaderSlot = d.cands.indexOf(L.top) === 1 ? 1 : 0;
    const baseColor = getCandidateProfile(L.top, leaderSlot, uf).color;
    const band = getBandForMargin(L.margin);
    const alpha = light ? band.alphaLight : band.alphaDark;

    if (uf === 'zz') {
      dom.extDot.style.background = L.isTie ? 'var(--ink)' : baseColor;
      return;
    }

    if (pathEl) {
      if (L.isTie) {
        const pattern = gov
          ? ensureTiePattern(
              `tie-pattern-${uf}`,
              getCandidateProfile(d.cands[0], 0, uf).color,
              getCandidateProfile(d.cands[1], 1, uf).color
            )
          : 'url(#tie-pattern)';
        pathEl.style.fill = pattern;
        pathEl.style.fillOpacity = '0.88';
      } else {
        pathEl.style.fill = baseColor;
        pathEl.style.fillOpacity = String(alpha);
      }
    }

    if (callout) {
      callout.rect.style.fill = L.isTie
        ? 'var(--map-empty)'
        : `color-mix(in srgb, ${baseColor} ${Math.round(alpha * 75)}%, var(--bg))`;
    }
  }

  const paintAll = () => Object.keys(UF_META).forEach(paintState);

  // Interações no mapa (clique, teclado e hover no desktop)
  function onUfActivate(uf) {
    if (navigator.vibrate) {
      try { navigator.vibrate(8); } catch { /* ignora */ }
    }
    selectState(uf); // sempre seleciona (nunca alterna/fecha — B5)
  }

  dom.mapPaths.addEventListener('click', (e) => {
    const p = e.target.closest('path[data-uf]');
    if (p) onUfActivate(p.dataset.uf);
  });

  dom.mapCallouts.addEventListener('click', (e) => {
    const g = e.target.closest('g[data-uf]');
    if (g) onUfActivate(g.dataset.uf);
  });

  dom.extBtn.addEventListener('click', () => onUfActivate('zz'));

  dom.mapPaths.addEventListener('keydown', (e) => {
    const p = e.target.closest('path[data-uf]');
    if (!p) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onUfActivate(p.dataset.uf);
      return;
    }
    if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      const items = Array.from(dom.mapPaths.querySelectorAll('path[data-uf]'));
      const idx = items.indexOf(p);
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      items[(idx + step + items.length) % items.length].focus();
    }
  });

  // Tooltip de mouse no desktop (usa sempre valores oficiais exatos TARGET)
  function showMapTip(uf, e) {
    if (e.pointerType !== 'mouse') return;
    const S = cur();
    const gov = activeRole === 'gov';
    const noRunoff = gov && !hasRunoff(uf);
    const d = noRunoff ? null : S.states[uf];
    const meta = UF_META[uf];
    const L = hasVotes(d) ? leaders(d) : null;
    let html = `<div style="font-weight:600;margin-bottom:3px">${esc(meta ? meta.name : uf.toUpperCase())} · ${
      d ? fmtPct(d.sections.pct) + '%' : '0,00%'
    }</div>`;
    if (noRunoff) {
      html = `<div style="font-weight:600;margin-bottom:3px">${esc(meta ? meta.name : uf.toUpperCase())}</div>`;
      html += `<div style="color:var(--muted)">${esc(MSG_NO_RUNOFF)}</div>`;
    } else if (L && d) {
      html += d.cands
        .slice(0, 2)
        .map((c, idx) => {
          const prof = getCandidateProfile(c, idx, uf);
          return `<div style="display:flex;justify-content:space-between;gap:14px"><span>${esc(
            prof.displayName
          )}</span><strong>${fmtPct(c.pct)}%</strong></div>`;
        })
        .join('');
    } else {
      html += `<div style="color:var(--muted)">Sem votos apurados</div>`;
    }
    dom.tip.innerHTML = html;
    dom.tip.classList.add('on');
    moveMapTip(e);
  }

  function moveMapTip(e) {
    const w = dom.tip.offsetWidth || 170;
    const h = dom.tip.offsetHeight || 68;
    dom.tip.style.left = Math.min(e.clientX + 14, window.innerWidth - w - 10) + 'px';
    dom.tip.style.top = Math.min(e.clientY + 14, window.innerHeight - h - 10) + 'px';
  }

  // B13: hover só troca a classe `.hover` e o anel — nunca reordena os nós do SVG
  dom.mapPaths.addEventListener('pointerover', (e) => {
    const p = e.target.closest('path[data-uf]');
    if (!p || e.pointerType !== 'mouse') return;
    setHover(p.dataset.uf);
    showMapTip(p.dataset.uf, e);
  });
  dom.mapPaths.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && dom.tip.classList.contains('on')) moveMapTip(e);
  });
  dom.mapPaths.addEventListener('pointerout', () => {
    setHover(null);
    dom.tip.classList.remove('on');
  });

  // --------------------------------------------------------------------------
  // 5.7 RENDERIZAÇÃO DO BLOCO PRINCIPAL (dois candidatos + HUD central)
  // --------------------------------------------------------------------------
  function renderStageHead(d) {
    const gov = activeRole === 'gov';
    setTextDiff(dom.stageOffice, gov ? 'Governador' : 'Presidente');
    setTextDiff(dom.stageUf, gov ? activeGovUf.toUpperCase() : 'BR');
    setTextDiff(dom.stagePlace, gov ? UF_META[activeGovUf].name : 'Brasil');
    setTextDiff(dom.stageTime, hasVotes(d) && d.ht ? `Boletim das ${d.ht}` : MSG_WAITING);
  }

  function renderNational(d, options = {}) {
    if (!hasVotes(d)) return;
    syncThemeColors();
    dom.stage.classList.remove('is-waiting');

    const shouldSnap = Boolean(options.snap || d.final || prefersReducedMotion());
    const nowMs = performance.now();
    const tk = activeTickers();

    dom.finalMark.hidden = !d.final;
    renderStageHead(d);

    const c0 = d.cands[0];
    const c1 = d.cands[1];
    const L = leaders(d);

    [c0, c1].forEach((c, idx) => {
      const slotDom = dom.cands[idx];
      const prof = getCandidateProfile(c, idx, activeGovUf);

      setTextDiff(slotDom.name, prof.displayName);
      setTextDiff(slotDom.meta, `${prof.party} · ${prof.number}`);
      setTextDiff(slotDom.initials, initialsOf(prof.displayName));
      setPhoto(slotDom, prof.photo, `Foto de ${prof.fullName} (${prof.party})`);

      // Nunca exibe "Eleito" antes da totalização oficial do TSE (c.elected && d.final)
      slotDom.elected.hidden = !(c.elected && d.final);

      // Percentual sempre mostra o valor oficial exato do lote
      setTextDiff(slotDom.pct, fmtPct(c.pct));

      // Popover de valor oficial exato (TARGET) + horário do TSE
      setTextDiff(slotDom.votesTarget, fmtInt(c.votes));
      setTextDiff(slotDom.votesTime, d.ht || 'oficial');

      // Atualiza o LiveTicker de votos
      tk[idx].receiveBatchWithTrailing(c.votes, nowMs, { snap: shouldSnap });
      setTextDiff(slotDom.votesShown, fmtInt(tk[idx].shown));

      // Indicador discreto de liderança (estilizado de forma idêntica em ambos os lados)
      if (L && L.top.key === c.key && !L.isTie) {
        setTextDiff(slotDom.lead, `à frente por ${fmtPct(L.margin)} p.p.`);
      } else if (L && L.isTie) {
        setTextDiff(slotDom.lead, 'empate técnico');
      } else {
        setTextDiff(slotDom.lead, '\u00A0');
      }
    });

    // Barra de proporção (sempre oficial exata)
    const totTwo = c0.votes + c1.votes;
    const w0 = totTwo > 0 ? ((c0.votes / totTwo) * 100).toFixed(3) : '50.000';
    const w1 = totTwo > 0 ? ((c1.votes / totTwo) * 100).toFixed(3) : '50.000';
    dom.splitSeg0.style.width = `${w0}%`;
    dom.splitSeg1.style.width = `${w1}%`;

    // Linha fina de progresso e totais
    setTextDiff(dom.secPctLabel, `${fmtPct(d.sections.pct)}%`);
    setTextDiff(dom.secsCountText, `(${fmtInt(d.sections.done)} de ${fmtInt(d.sections.total)})`);
    dom.secProgFill.style.width = `${Math.min(100, Math.max(0, d.sections.pct)).toFixed(2)}%`;
    dom.secProgressbar.setAttribute('aria-valuenow', String(d.sections.pct.toFixed(2)));
    setTextDiff(dom.totalValidVotes, fmtInt(d.votes.valid));

    if (L) {
      setTextDiff(dom.diffValues, `Diferença atual: ${fmtPct(L.margin)} p.p. (${fmtInt(L.voteDiff)} votos)`);
    } else {
      setTextDiff(dom.diffValues, 'Aguardando abertura dos votos');
    }

    // Métricas secundárias na linha expansível do rodapé
    setTextDiff(dom.mCompPct, `${fmtPct(d.electorate.ppresent)}%`);
    setTextDiff(dom.mCompAbs, `(${fmtInt(d.electorate.present)})`);
    setTextDiff(dom.mAbstPct, `${fmtPct(d.electorate.pabst)}%`);
    setTextDiff(dom.mAbstAbs, `(${fmtInt(d.electorate.abst)})`);
    setTextDiff(dom.mValPct, `${fmtPct(d.votes.pvalid)}%`);
    setTextDiff(dom.mValAbs, `(${fmtInt(d.votes.valid)})`);
    setTextDiff(dom.mBrPct, `${fmtPct(d.votes.pblank)}%`);
    setTextDiff(dom.mBrAbs, `(${fmtInt(d.votes.blank)})`);
    setTextDiff(dom.mNulPct, `${fmtPct(d.votes.pnul)}%`);
    setTextDiff(dom.mNulAbs, `(${fmtInt(d.votes.nul)})`);
  }

  // Estado vazio elegante: sem zeros e sem dados de outro cargo
  function renderEmpty() {
    syncThemeColors();
    dom.stage.classList.add('is-waiting');
    dom.finalMark.hidden = true;
    renderStageHead(null);

    [0, 1].forEach((idx) => {
      const slotDom = dom.cands[idx];
      const prof = getCandidateProfile(null, idx, activeGovUf);
      setTextDiff(slotDom.name, prof.displayName);
      setTextDiff(slotDom.meta, `${prof.party} · ${prof.number}`);
      setTextDiff(slotDom.initials, initialsOf(prof.displayName));
      setPhoto(slotDom, prof.photo, `Foto de ${prof.fullName} (${prof.party})`);
      slotDom.elected.hidden = true;
      setTextDiff(slotDom.pct, '—');
      setTextDiff(slotDom.votesShown, '—');
      setTextDiff(slotDom.votesTarget, '—');
      setTextDiff(slotDom.votesTime, '—');
      setTextDiff(slotDom.lead, '\u00A0');
    });

    dom.splitSeg0.style.width = '50%';
    dom.splitSeg1.style.width = '50%';
    setTextDiff(dom.secPctLabel, '—');
    setTextDiff(dom.secsCountText, '');
    dom.secProgFill.style.width = '0%';
    dom.secProgressbar.setAttribute('aria-valuenow', '0');
    setTextDiff(dom.totalValidVotes, '—');
    setTextDiff(dom.diffValues, MSG_WAITING);
    [dom.mCompPct, dom.mAbstPct, dom.mValPct, dom.mBrPct, dom.mNulPct].forEach((el) => setTextDiff(el, '—'));
    [dom.mCompAbs, dom.mAbstAbs, dom.mValAbs, dom.mBrAbs, dom.mNulAbs].forEach((el) => setTextDiff(el, ''));
  }

  function renderFocus(options = {}) {
    const d = focusData();
    if (hasVotes(d)) renderNational(d, options);
    else renderEmpty();
  }

  // Sparkline: uma série por cargo (e por UF no Governador)
  function renderSparkline() {
    const pts0 = cur().hist[focusKey()] || [];
    if (!pts0.length) {
      dom.sparklineBody.innerHTML = '';
      return;
    }
    const pts = pts0.length === 1 ? [pts0[0], pts0[0]] : pts0;
    const maxM = Math.max(4, ...pts.map((p) => p.margin * 1.2));
    const coords = pts.map((p, i) => {
      const x = 4 + (i / (pts.length - 1)) * 232;
      const y = 28 - (Math.min(p.margin, maxM) / maxM) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const last = pts[pts.length - 1];
    const strokeCol = last.leaderSlot === 1 ? 'var(--cand-1)' : 'var(--cand-0)';
    dom.sparklineBody.innerHTML = `<polyline fill="none" stroke="${strokeCol}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${coords.join(
      ' '
    )}"/>`;
  }

  function recordSparkline(S, key, d) {
    const L = leaders(d);
    if (!L) return;
    if (!S.hist[key]) S.hist[key] = [];
    const arr = S.hist[key];
    const last = arr[arr.length - 1];
    if (last && last.ht === d.ht && Math.abs(last.margin - L.margin) < 1e-9) return;
    arr.push({ ht: d.ht, margin: L.margin, leaderSlot: d.cands.indexOf(L.top) === 1 ? 1 : 0 });
    if (arr.length > 60) arr.shift();
    if (S === cur() && key === focusKey()) renderSparkline();
  }

  // --------------------------------------------------------------------------
  // 5.8 CHIPS DE UF DO GOVERNADOR (B7: sem piscar — monta uma vez e só atualiza o que mudou)
  // --------------------------------------------------------------------------
  let chipsListKey = '';
  let lastChipActive = null;

  function renderGovChips() {
    const key = govDisputedUfs.join(',');
    if (key !== chipsListKey) {
      const left = dom.govChips.scrollLeft;
      dom.govChips.textContent = '';
      govDisputedUfs.forEach((uf) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gov-chip';
        btn.dataset.govUf = uf;
        btn.setAttribute('aria-pressed', 'false');
        const code = document.createElement('span');
        code.className = 'chip-uf';
        code.textContent = uf.toUpperCase();
        const dot = document.createElement('i');
        dot.className = 'chip-dot';
        dot.setAttribute('aria-hidden', 'true');
        const lead = document.createElement('span');
        lead.className = 'chip-lead';
        btn.append(code, dot, lead);
        dom.govChips.appendChild(btn);
      });
      chipsListKey = key;
      lastChipActive = null;
      dom.govChips.scrollLeft = left;
    }
    updateGovChips();
  }

  function updateGovChips() {
    if (activeRole !== 'gov') return;
    const S = store.gov;
    dom.govChips.querySelectorAll('button[data-gov-uf]').forEach((btn) => {
      const uf = btn.dataset.govUf;
      const d = S.states[uf];
      const L = hasVotes(d) ? leaders(d) : null;
      const name = UF_META[uf].name;
      let leadText = '—';
      let color = '';
      let aria = `${name}: aguardando o TSE`;
      if (L) {
        const leaderSlot = d.cands.indexOf(L.top) === 1 ? 1 : 0;
        const prof = getCandidateProfile(L.top, leaderSlot, uf);
        if (L.isTie) {
          leadText = 'empate';
          aria = `${name}: empate técnico`;
        } else {
          leadText = prof.shortName;
          color = prof.color;
          aria = `${name}: ${prof.displayName} à frente por ${fmtPct(L.margin)} pontos percentuais`;
        }
      }
      setTextDiff(btn.querySelector('.chip-lead'), leadText);
      const dot = btn.querySelector('.chip-dot');
      if (dot.dataset.c !== color) {
        dot.dataset.c = color;
        dot.style.background = color || '';
        dot.classList.toggle('empty', !color);
      }
      if (btn.getAttribute('aria-label') !== aria) btn.setAttribute('aria-label', aria);
      const active = uf === activeGovUf;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    if (lastChipActive !== activeGovUf) {
      lastChipActive = activeGovUf;
      scrollChipIntoView(activeGovUf);
    }
  }

  function scrollChipIntoView(uf) {
    const btn = dom.govChips.querySelector(`button[data-gov-uf="${uf}"]`);
    const box = dom.govChips;
    if (!btn || box.scrollWidth <= box.clientWidth) return;
    const left = btn.offsetLeft - (box.clientWidth - btn.offsetWidth) / 2;
    box.scrollTo({ left: Math.max(0, left), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  dom.govChips.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-gov-uf]');
    if (!btn) return;
    selectState(btn.dataset.govUf); // chip sempre seleciona (B5)
  });

  // --------------------------------------------------------------------------
  // 5.9 VISÃO GERAL: tudo que depende de dados + cargo ativo
  // --------------------------------------------------------------------------
  function applyRoleChrome() {
    const isPres = activeRole === 'pres';
    document.body.dataset.role = activeRole;
    dom.tabPres.setAttribute('aria-selected', String(isPres));
    dom.tabGov.setAttribute('aria-selected', String(!isPres));
    dom.govBar.hidden = isPres;
    dom.extBtn.hidden = !isPres; // não há voto de Governador no Exterior
    dom.shareMain.hidden = !isPres; // botão de compartilhar é da apuração da Presidência
    if (!isPres) closeShareMenu({ restoreFocus: false });
    dom.legendGradient.hidden = !isPres;
    dom.legendCaption.hidden = isPres;
    if (!isPres) renderGovChips();
  }

  function refreshView(options = {}) {
    renderFocus(options);
    paintAll();
    renderSparkline();
    updateGovChips();
    renderDetail();
  }

  function renderAll(options = {}) {
    applyRoleChrome();
    refreshView(options);
  }

  // --------------------------------------------------------------------------
  // 5.10 PAINEL DO ESTADO (popover no desktop / bottom sheet no celular)
  // --------------------------------------------------------------------------
  let detailKey = '';
  let detailRows = [];
  let detailFresh = false;
  let closeTimer = null;
  let panelLastFocus = null;

  function buildDetail() {
    detailKey = `${activeRole}:${selectedUf}`;
    detailFresh = true;
    dom.detailCandsList.textContent = '';
    detailRows = [0, 1].map(() => {
      const row = document.createElement('div');
      row.className = 'pop-cand-row';
      row.innerHTML = `
        <div class="pop-avatar"><img alt="" decoding="async" hidden><span class="pop-initials"></span></div>
        <div class="pop-cand-id"><span class="pop-cand-name"></span><span class="pop-cand-meta"></span><span class="pop-elected" hidden>Eleito</span></div>
        <div class="pop-cand-nums"><strong class="pop-pct"></strong><small class="pop-votes"></small></div>
        <div class="pop-bar" aria-hidden="true"><i class="pop-bar-fill"></i></div>`;
      dom.detailCandsList.appendChild(row);
      const r = {
        row,
        img: row.querySelector('img'),
        initials: row.querySelector('.pop-initials'),
        name: row.querySelector('.pop-cand-name'),
        meta: row.querySelector('.pop-cand-meta'),
        pct: row.querySelector('.pop-pct'),
        votes: row.querySelector('.pop-votes'),
        fill: row.querySelector('.pop-bar-fill'),
        elected: row.querySelector('.pop-elected'),
      };
      r.img.addEventListener('error', () => {
        r.img.hidden = true;
        r.initials.hidden = false;
      });
      r.img.addEventListener('load', () => {
        r.img.hidden = false;
        r.initials.hidden = true;
      });
      return r;
    });
  }

  function renderDetail() {
    if (selectedUf == null || !UF_META[selectedUf]) return;
    const uf = selectedUf;
    const meta = UF_META[uf];
    const S = cur();
    const gov = activeRole === 'gov';
    const noRunoff = gov && !hasRunoff(uf);
    if (detailKey !== `${activeRole}:${uf}`) buildDetail();

    const d = noRunoff ? null : S.states[uf];
    const L = hasVotes(d) ? leaders(d) : null;

    setTextDiff(dom.detailUfCode, uf.toUpperCase());
    setTextDiff(dom.detailUfTitle, meta.name);
    const time = S.stateTimes[uf] || (d && d.ht ? d.ht : '—');
    setTextDiff(
      dom.detailUfSub,
      noRunoff ? 'Governador' : `Totalização oficial TSE: ${time}`
    );

    // Etiqueta de status (usa sempre o estado oficial do TSE; "Eleito" só com totalização final)
    let st = { text: MSG_WAITING, cls: 'is-wait' };
    if (noRunoff) st = { text: 'Definido no 1º turno', cls: 'is-done' };
    else if (L && d.final && d.cands.some((c) => c.elected)) st = { text: 'Eleito', cls: 'is-final' };
    else if (L && L.isTie) st = { text: 'Empate técnico', cls: 'is-tie' };
    else if (L) st = { text: 'Em apuração', cls: 'is-live' };
    setTextDiff(dom.detailStatus, st.text);
    const stCls = `status-tag ${st.cls}`;
    if (dom.detailStatus.className !== stCls) dom.detailStatus.className = stCls;

    const showRows = Boolean(L);
    dom.detailCandsList.hidden = !showRows;
    dom.detailLead.hidden = !showRows;
    dom.detailSecWrap.hidden = !showRows;
    dom.detailMsg.hidden = showRows;
    if (!showRows) {
      setTextDiff(
        dom.detailMsg,
        noRunoff ? MSG_NO_RUNOFF : `${MSG_WAITING}. Sem votos apurados neste local até o momento.`
      );
      return;
    }

    // Usa sempre os valores oficiais exatos TARGET no detalhe do estado
    d.cands.slice(0, 2).forEach((c, idx) => {
      const r = detailRows[idx];
      const prof = getCandidateProfile(c, idx, uf);
      r.row.style.setProperty('--c', prof.color);
      r.row.classList.toggle('is-leader', L.top === c && !L.isTie);
      setTextDiff(r.name, prof.displayName);
      setTextDiff(r.meta, `${prof.party} · ${prof.number}`);
      setTextDiff(r.initials, initialsOf(prof.displayName));
      if (prof.photo) {
        if (r.img.getAttribute('src') !== prof.photo) {
          r.img.hidden = true;
          r.initials.hidden = false;
          r.img.setAttribute('src', prof.photo);
        } else if (r.img.complete && r.img.naturalWidth > 0) {
          r.img.hidden = false;
          r.initials.hidden = true;
        }
      } else {
        r.img.hidden = true;
        r.initials.hidden = false;
      }
      setTextDiff(r.pct, `${fmtPct(c.pct)}%`);
      setTextDiff(r.votes, `${fmtInt(c.votes)} votos`);
      r.elected.hidden = !(c.elected && d.final);
      // Barra = participação nos votos válidos, com entrada suave na primeira exibição
      if (detailFresh) {
        r.fill.style.transition = 'none';
        r.fill.style.width = '0%';
        void r.fill.offsetWidth;
        r.fill.style.transition = '';
      }
      r.fill.style.width = `${Math.min(100, Math.max(0, c.pct)).toFixed(2)}%`;
    });
    detailFresh = false;

    const leadProf = getCandidateProfile(L.top, d.cands.indexOf(L.top) === 1 ? 1 : 0, uf);
    dom.detailLead.style.setProperty('--c', L.isTie ? 'var(--muted)' : leadProf.color);
    setTextDiff(
      dom.detailLead,
      L.isTie
        ? `empate técnico · ${fmtPct(L.margin)} p.p. · ${fmtInt(L.voteDiff)} votos`
        : `à frente por ${fmtPct(L.margin)} p.p. · ${fmtInt(L.voteDiff)} votos`
    );
    setTextDiff(dom.detSec, `${fmtPct(d.sections.pct)}% das seções apuradas`);
    dom.detailSecFill.style.width = `${Math.min(100, Math.max(0, d.sections.pct)).toFixed(2)}%`;
  }

  // Desktop: o painel fica perto do estado clicado e sempre dentro da área do mapa
  function positionPanel() {
    const panel = dom.detailPanel;
    if (selectedUf == null || panel.hidden) return;
    if (isMobileSheet()) {
      ['left', 'top', 'right', 'bottom'].forEach((k) => panel.style.removeProperty(k));
      return;
    }
    const target = selectedUf === 'zz' ? dom.extBtn : svgPathEls[selectedUf];
    if (!target) return;
    const stage = dom.mapViewport.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    const pad = 10;
    const gap = 14;
    const cx = (r.left + r.right) / 2 - stage.left;
    let left = cx < stage.width / 2 ? r.right - stage.left + gap : r.left - stage.left - pw - gap;
    left = Math.max(pad, Math.min(left, stage.width - pw - pad));
    let top = (r.top + r.bottom) / 2 - stage.top - ph / 2;
    top = Math.max(pad, Math.min(top, stage.height - ph - pad));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(positionPanel, 120);
  });

  // Abre (ou troca) o painel — só interface; o histórico fica em selectState/applyRoute
  function openPanel(uf, { focus = true } = {}) {
    if (!uf || !UF_META[uf]) return;
    clearTimeout(closeTimer);
    const wasOpen = selectedUf != null;
    const changed = selectedUf !== uf;

    if (!wasOpen && focus && !TV_MODE) {
      const ae = document.activeElement;
      panelLastFocus = ae && ae !== document.body && ae.focus ? ae : null;
    }

    // Regra obrigatória do Ticker: abrir um detalhe de estado faz snap instantâneo SHOWN = TARGET
    const tk = activeTickers();
    tk.forEach((t) => t.snapToTarget());
    if (hasVotes(focusData())) dom.cands.forEach((s, i) => setTextDiff(s.votesShown, fmtInt(tk[i].shown)));

    closeShareMenu({ restoreFocus: false });
    selectedUf = uf;
    markSelected();
    // Sobe o palco acima do rodapé/topbar enquanto o painel está aberto (corrige o rodapé
    // aparecendo por cima do bottom sheet no celular, ex.: ao abrir "Exterior")
    document.body.classList.add('panel-open');
    dom.detailPanel.hidden = false;
    dom.detailBackdrop.hidden = false;
    dom.detailPanel.setAttribute('aria-modal', String(isMobileSheet()));
    if (changed || !wasOpen) buildDetail();
    renderDetail();
    positionPanel();
    dom.detailPanel.style.transform = '';

    requestAnimationFrame(() => {
      if (selectedUf == null) return;
      dom.detailPanel.classList.add('open');
      dom.detailBackdrop.classList.add('on');
    });

    if (!wasOpen && focus && !TV_MODE) dom.detailPanel.focus({ preventScroll: true });
  }

  function closePanelUi({ restoreFocus = true } = {}) {
    if (selectedUf == null) return;
    selectedUf = null;
    markSelected();
    const panel = dom.detailPanel;
    panel.classList.remove('open');
    dom.detailBackdrop.classList.remove('on');
    const finish = () => {
      if (selectedUf != null) return; // reaberto durante a animação
      document.body.classList.remove('panel-open');
      panel.hidden = true;
      dom.detailBackdrop.hidden = true;
      panel.style.transform = '';
      panel.classList.remove('dragging');
    };
    clearTimeout(closeTimer);
    if (prefersReducedMotion()) finish();
    else closeTimer = setTimeout(finish, 230);

    if (restoreFocus && !TV_MODE && panelLastFocus && document.contains(panelLastFocus)) {
      try { panelLastFocus.focus({ preventScroll: true }); } catch { /* ignora */ }
    }
    panelLastFocus = null;
  }

  // Foco preso dentro do painel enquanto ele está aberto
  const focusablesIn = (el) =>
    Array.from(el.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')).filter(
      (n) => !n.hidden && n.offsetParent !== null
    );

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selectedUf != null) {
      closeState();
      return;
    }
    if (e.key !== 'Tab' || selectedUf == null || TV_MODE || dom.detailPanel.hidden) return;
    const nodes = focusablesIn(dom.detailPanel);
    if (!nodes.length) {
      e.preventDefault();
      dom.detailPanel.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const ae = document.activeElement;
    if (!dom.detailPanel.contains(ae)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    } else if (e.shiftKey && (ae === first || ae === dom.detailPanel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && ae === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // Bottom sheet: arrastar para baixo fecha
  function bindSheetDrag(el) {
    if (!el) return;
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      if (!isMobileSheet() || selectedUf == null || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (e.target.closest('button')) return;
      drag = { id: e.pointerId, y0: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0, dy: 0 };
      try { el.setPointerCapture(e.pointerId); } catch { /* ignora */ }
      dom.detailPanel.classList.add('dragging');
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dy = Math.max(0, e.clientY - drag.y0);
      const dt = Math.max(1, e.timeStamp - drag.lastT);
      drag.v = (e.clientY - drag.lastY) / dt;
      drag.lastY = e.clientY;
      drag.lastT = e.timeStamp;
      dom.detailPanel.style.transform = `translateY(${drag.dy}px)`;
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { dy, v } = drag;
      drag = null;
      dom.detailPanel.classList.remove('dragging');
      if (dy > 90 || (dy > 24 && v > 0.6)) {
        closeState();
      } else {
        dom.detailPanel.style.transform = '';
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  bindSheetDrag(dom.sheetHandle);
  bindSheetDrag(dom.popoverHead);

  dom.btnCloseDetail.addEventListener('click', () => closeState());
  dom.detailBackdrop.addEventListener('click', () => closeState());

  // Compartilhamento com valores oficiais exatos TARGET
  dom.btnShareUf.addEventListener('click', async () => {
    if (selectedUf == null) return;
    const uf = selectedUf;
    const gov = activeRole === 'gov';
    const d = gov && !hasRunoff(uf) ? null : cur().states[uf];
    const meta = UF_META[uf];
    const place = `${gov ? 'Governador · ' : ''}${meta.name}`;
    const shareUrl = `${location.origin}${location.pathname}${location.search}${routeHash(activeRole, uf)}`;
    let summary = `Apuração 2026 — ${place}`;
    if (gov && !hasRunoff(uf)) {
      summary = `${place}: ${MSG_NO_RUNOFF}`;
    } else if (hasVotes(d)) {
      const a = getCandidateProfile(d.cands[0], 0, uf);
      const b = getCandidateProfile(d.cands[1], 1, uf);
      summary = `${place}: ${a.displayName} ${fmtPct(d.cands[0].pct)}% (${fmtInt(d.cands[0].votes)}) × ${
        b.displayName
      } ${fmtPct(d.cands[1].pct)}% (${fmtInt(d.cands[1].votes)}) — Oficial TSE`;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: summary, text: summary, url: shareUrl });
        return;
      } catch { /* fallback */ }
    }
    try {
      await navigator.clipboard.writeText(`${summary} ${shareUrl}`);
    } catch { /* ignora */ }
    setTextDiff(dom.shareBtnText, 'Copiado');
    setTimeout(() => setTextDiff(dom.shareBtnText, 'Compartilhar'), 1800);
  });

  // --------------------------------------------------------------------------
  // 5.10b COMPARTILHAR A APURAÇÃO DA PRESIDÊNCIA NAS REDES SOCIAIS
  //       O texto usa sempre os valores OFICIAIS exatos do último boletim do TSE
  //       (nunca o número animado do contador). Em ?sim o texto é marcado como SIMULADO.
  // --------------------------------------------------------------------------
  const canNativeShare = typeof navigator.share === 'function';
  // Celular/tablet: abre direto a folha de compartilhamento do sistema (WhatsApp, Instagram, etc.)
  const prefersNativeShare = () =>
    canNativeShare && Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  function buildMainShare() {
    const d = store.pres.national;
    // Link limpo: sem ?tv/?selftest/?pre17. Só mantém ?sim para ninguém tomar simulado por oficial.
    const url = `${location.origin}${location.pathname}${SIM ? '?sim' : ''}${routeHash('pres', null)}`;
    const title = `${SIM ? '[SIMULADO] ' : ''}Apuração 2026 · 2º turno — Presidente`;
    const lines = [title];

    if (hasVotes(d)) {
      const two = d.cands.slice(0, 2);
      two.forEach((c, i) => {
        const p = getCandidateProfile(c, i, activeGovUf, 'pres');
        lines.push(`${p.displayName} ${fmtPct(c.pct)}% (${fmtInt(c.votes)} votos)`);
      });
      const winner = d.final ? two.findIndex((c) => c.elected) : -1;
      if (winner >= 0) {
        lines.push(`Eleito: ${getCandidateProfile(two[winner], winner, activeGovUf, 'pres').displayName} — totalização final do TSE`);
      } else {
        lines.push(`${fmtPct(d.sections.pct)}% das seções apuradas${d.ht ? ` · Boletim das ${d.ht}` : ''} (oficial TSE)`);
      }
    } else {
      lines.push('Acompanhe ao vivo — dados oficiais do TSE.');
    }

    const text = lines.join('\n');
    return { title, text, url, full: `${text}\n${url}` };
  }

  const SHARE_HREF = {
    whatsapp: (s) => `https://wa.me/?text=${encodeURIComponent(s.full)}`,
    x: (s) => `https://x.com/intent/tweet?text=${encodeURIComponent(s.text)}&url=${encodeURIComponent(s.url)}`,
    facebook: (s) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(s.url)}`,
    telegram: (s) => `https://t.me/share/url?url=${encodeURIComponent(s.url)}&text=${encodeURIComponent(s.text)}`,
  };

  // Atualiza os links com o boletim mais recente (chamado ao abrir o menu e de novo no clique)
  function refreshShareLinks() {
    const s = buildMainShare();
    dom.shareMenu.querySelectorAll('a[data-net]').forEach((a) => {
      const make = SHARE_HREF[a.dataset.net];
      if (make) a.href = make(s);
    });
    return s;
  }

  // Mantém o menu inteiro dentro da tela (botão pode estar fora do centro quando a linha quebra)
  function fitShareMenu() {
    dom.shareMenu.style.setProperty('--shift', '0px');
    const r = dom.shareMenu.getBoundingClientRect();
    const pad = 10;
    let shift = 0;
    if (r.left < pad) shift = pad - r.left;
    else if (r.right > window.innerWidth - pad) shift = window.innerWidth - pad - r.right;
    dom.shareMenu.style.setProperty('--shift', `${Math.round(shift)}px`);
  }

  function openShareMenu() {
    refreshShareLinks();
    dom.shareNative.hidden = !canNativeShare;
    dom.shareMenu.hidden = false;
    dom.btnShareMain.setAttribute('aria-expanded', 'true');
    fitShareMenu();
  }

  function closeShareMenu({ restoreFocus = true } = {}) {
    if (dom.shareMenu.hidden) return;
    dom.shareMenu.hidden = true;
    dom.btnShareMain.setAttribute('aria-expanded', 'false');
    if (restoreFocus) dom.btnShareMain.focus({ preventScroll: true });
  }

  async function nativeShare() {
    const s = buildMainShare();
    try {
      await navigator.share({ title: s.title, text: s.text, url: s.url });
      return true;
    } catch (err) {
      // AbortError = a pessoa fechou a folha de compartilhamento: não é erro
      return err && err.name === 'AbortError';
    }
  }

  async function copyShareText() {
    const { full } = buildMainShare();
    let ok = false;
    try {
      await navigator.clipboard.writeText(full);
      ok = true;
    } catch {
      // Fallback para http/ambientes sem Clipboard API
      const ta = document.createElement('textarea');
      ta.value = full;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    const msg = ok ? 'Copiado!' : 'Não foi possível copiar';
    setTextDiff(dom.shareCopyText, msg);
    setTextDiff(dom.shareStatus, msg);
    setTimeout(() => {
      setTextDiff(dom.shareCopyText, 'Copiar texto e link');
      setTextDiff(dom.shareStatus, '');
    }, 1800);
  }

  dom.btnShareMain.addEventListener('click', async () => {
    if (!dom.shareMenu.hidden) {
      closeShareMenu();
      return;
    }
    if (prefersNativeShare()) {
      if (await nativeShare()) return;
    }
    openShareMenu();
  });

  dom.shareMenu.addEventListener('click', async (e) => {
    const a = e.target.closest('a[data-net]');
    if (a) {
      refreshShareLinks(); // garante o boletim mais novo antes de abrir a rede
      setTimeout(() => closeShareMenu({ restoreFocus: false }), 0);
      return;
    }
    if (e.target.closest('#share-copy')) {
      await copyShareText();
      return;
    }
    if (e.target.closest('#share-native')) {
      closeShareMenu({ restoreFocus: false });
      await nativeShare();
    }
  });

  // Clicar fora ou apertar Esc fecha o menu
  document.addEventListener('pointerdown', (e) => {
    if (!dom.shareMenu.hidden && !dom.shareMain.contains(e.target)) closeShareMenu({ restoreFocus: false });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dom.shareMenu.hidden) closeShareMenu();
  });
  window.addEventListener('resize', () => {
    if (!dom.shareMenu.hidden) fitShareMenu();
  });

  // Linha expansível do rodapé
  dom.btnToggleDetails.addEventListener('click', () => {
    const isOpen = !dom.secondaryDrawer.hidden;
    dom.secondaryDrawer.hidden = isOpen;
    dom.btnToggleDetails.setAttribute('aria-expanded', String(!isOpen));
  });

  // --------------------------------------------------------------------------
  // 5.11 NAVEGAÇÃO E HISTÓRICO (B4, B5, B6)
  // --------------------------------------------------------------------------
  // mode: 'push' (abrir estado / trocar de cargo) | 'keep' (troca de UF com painel aberto:
  // substitui a entrada e mantém a marca de "criada pelo app") | 'replace' (limpa a marca)
  function navigate(role, uf, mode) {
    if (TV_MODE) return;
    const url = `${location.pathname}${location.search}${routeHash(role, uf)}`;
    const prevPushed = Boolean(history.state && history.state.pushed);
    try {
      if (mode === 'push') history.pushState({ app: 1, role, uf, pushed: true }, '', url);
      else history.replaceState({ app: 1, role, uf, pushed: mode === 'keep' ? prevPushed : false }, '', url);
    } catch { /* ignora (ex.: ambiente sem history) */ }
  }

  // Seleciona SEMPRE (nunca alterna). Só X, fundo escuro e Esc fecham.
  function selectState(uf) {
    if (!uf || !UF_META[uf]) return;
    const prev = selectedUf;
    if (activeRole === 'gov' && uf !== 'zz' && hasRunoff(uf)) setGovUf(uf);
    openPanel(uf);
    if (prev === uf) return; // já estava aberto: nada de novo no histórico
    navigate(activeRole, uf, prev != null ? 'keep' : 'push');
  }

  function closeState() {
    if (selectedUf == null) return;
    const st = history.state;
    closePanelUi();
    if (TV_MODE) return;
    if (st && st.app && st.uf && st.pushed) {
      try { history.back(); return; } catch { /* cai no replace */ }
    }
    navigate(activeRole, null, 'replace');
  }

  // Troca o estado em foco do Governador (bloco principal, contadores e chips)
  function setGovUf(uf) {
    if (uf === activeGovUf || !hasRunoff(uf)) return;
    activeGovUf = uf;
    activeTickers().forEach((t) => t.snapToTarget());
    renderFocus({ snap: true });
    renderSparkline();
    updateGovChips();
    // Clicou noutro estado: busca esse estado já, sem esperar o próximo ciclo de 12s
    if (activeRole === 'gov') tick(false);
  }

  function setRole(role) {
    if (role === activeRole) return;
    if (cycleCtrl) cycleCtrl.abort(); // descarta o ciclo do outro cargo
    closePanelUi({ restoreFocus: false });
    setHover(null);
    dom.tip.classList.remove('on');
    activeRole = role;
    dom.calmLine.hidden = true;
    const d = focusData();
    setLiveStatus(hasVotes(d) ? 'live' : 'waiting', hasVotes(d) ? `atualizado às ${d.ht || 'ao vivo'}` : 'conectando ao TSE…');
    renderAll({ snap: true }); // limpa e repinta o mapa inteiro, reinicia contadores com snap
    tick(true);
  }

  function switchRole(role) {
    if (role === activeRole) return;
    navigate(role, null, 'push');
    setRole(role);
  }

  dom.tabPres.addEventListener('click', () => switchRole('pres'));
  dom.tabGov.addEventListener('click', () => switchRole('gov'));

  // URL -> interface (botão Voltar/Avançar, hash editado, recarregar)
  function applyRoute(r) {
    if (/#(pres|gov)\/[a-z]{2}\/cidades/i.test(location.hash)) return;
    const sameRole = r.role === activeRole;
    const sameUf = (r.uf || null) === (selectedUf || null);
    if (sameRole && sameUf) return;
    if (!sameRole) setRole(r.role);
    if (r.uf) {
      if (r.role === 'gov' && hasRunoff(r.uf)) setGovUf(r.uf);
      openPanel(r.uf);
    } else {
      closePanelUi();
    }
  }
  const onRouteEvent = () => {
    const r = parseRoute();
    applyRoute(r);
    // normaliza o formato antigo (#sp) digitado/colado numa aba já aberta (preservando sub-rotas pós-eleição)
    if (!TV_MODE && location.hash && !/#(pres|gov)\/([a-z]{2}\/cidades|analise|boletim|horarios)/i.test(location.hash) && location.hash !== routeHash(r.role, r.uf)) navigate(r.role, r.uf, 'keep');
  };
  window.addEventListener('popstate', onRouteEvent);
  window.addEventListener('hashchange', onRouteEvent);

  // --------------------------------------------------------------------------
  // 5.12 REDE, POLLING INVISÍVEL (12s), ETAG/304 E FALLBACK SIMULADO PROGRESSIVO
  // --------------------------------------------------------------------------
  let localSimStep = 0;

  const SIM_GOV_MARGIN = { ac: 12.6, am: -3.2, df: 8.4, es: 0.3, rn: -1.4, to: 4.2 }; // + = candidato da esquerda
  const SIM_GOV_BASE = { ac: 410000, am: 1950000, df: 1650000, es: 2150000, rn: 1530000, to: 870000 };
  const SIM_GOV_SECTIONS = { ac: 1900, am: 7200, df: 3300, es: 4700, rn: 4900, to: 2300 };
  const SIM_PRES_DIFF = {
    ac: -22.4, al: 16.8, ap: 4.2, am: 8.6, ba: 38.4, ce: 34.2, df: -15.4,
    es: 0.32, go: -18.6, ma: 36.1, mt: -26.8, ms: -14.2, mg: 1.84, pa: 9.4,
    pb: 28.6, pr: -24.2, pe: 31.8, pi: 46.2, rj: -11.4, rn: 25.4, rs: -12.6,
    ro: -28.4, rr: -32.0, sc: -34.8, sp: -9.6, se: 29.2, to: 3.4, zz: 1.4, br: 1.76,
  };

  function buildLocalSimFallback(url) {
    localSimStep += 1;
    const now = new Date();
    const ht = now.toTimeString().slice(0, 8);
    const dt = '25/10/2026';
    // O cargo vem da URL pedida (não do cargo ativo agora): evita misturar cargos
    const isGov = /-c0003-/.test(url) || url.includes(`/${getEleCode('gov')}/`);

    if (url.endsWith('-ab.json')) {
      const list = isGov ? govDisputedUfs : Object.keys(UF_META);
      return {
        ele: getEleCode(isGov ? 'gov' : 'pres'),
        t: '2',
        hg: ht,
        abr: list.map((uf, i) => ({
          and: 'p',
          tpabr: 'uf',
          cdabr: uf,
          dt,
          ht,
          s: { ts: String(4000 + i * 800), st: String(3800 + i * 760), pstn: '95,12' },
          e: { te: '2000000', c: '1700000', pcn: '85,00' },
        })),
      };
    }

    const m = url.match(/\/dados\/([a-z]{2})\//);
    const uf = m ? m[1] : 'br';

    // B12: simulado de Governador usa os candidatos reais de cada UF (GOV_CANDIDATES)
    if (isGov) {
      const defs = GOV_CANDIDATES[uf] || [
        { n: '91', party: 'PT', name: 'Candidato 1' },
        { n: '92', party: 'PL', name: 'Candidato 2' },
      ];
      const margin = SIM_GOV_MARGIN[uf] ?? 2;
      const p1 = 50 + margin / 2;
      const p2 = 100 - p1;
      const baseTot = (SIM_GOV_BASE[uf] || 900000) + localSimStep * 35;
      const v1 = Math.round(baseTot * (p1 / 100));
      const v2 = baseTot - v1;
      const ts = SIM_GOV_SECTIONS[uf] || 3000;
      const pctSec = Math.min(99.8, 78 + (hashStr(uf) % 18) + localSimStep * 0.02);
      const st = Math.round(ts * (pctSec / 100));
      const blank = Math.round(baseTot * 0.016);
      const nul = Math.round(baseTot * 0.029);
      const tv = baseTot + blank + nul;
      const te = Math.round(tv / 0.8515);
      const mkCand = (g, i, votes, pct) => ({
        n: g.n,
        sqcand: `26000${String(i + 1)}${g.n}`,
        nm: String(g.name).toUpperCase(),
        nmu: String(g.name).toUpperCase(),
        seq: String(i + 1),
        e: 'n',
        dvt: 'Válido',
        vap: String(votes),
        pvapn: pct.toFixed(6).replace('.', ','),
      });
      return {
        ele: getEleCode('gov'),
        t: '2',
        tf: 'n',
        and: 'p',
        dt,
        ht,
        carg: [
          {
            cd: '3',
            nmn: 'Governador',
            agr: [
              { par: [{ n: defs[0].n, sg: defs[0].party, cand: [mkCand(defs[0], 0, v1, p1)] }] },
              { par: [{ n: defs[1].n, sg: defs[1].party, cand: [mkCand(defs[1], 1, v2, p2)] }] },
            ],
          },
        ],
        s: { ts: String(ts), st: String(st), pstn: pctSec.toFixed(2).replace('.', ',') },
        e: { te: String(te), c: String(tv), pcn: '85,15', a: String(te - tv), pan: '14,85' },
        v: {
          tv: String(tv),
          vv: String(baseTot),
          pvvn: '95,50',
          vb: String(blank),
          pvbn: '1,60',
          tvn: String(nul),
          ptvnn: '2,90',
        },
      };
    }

    const margin = SIM_PRES_DIFF[uf] ?? 2.0;
    const p1 = 50 + margin / 2;
    const p2 = 100 - p1;
    const baseTot = (uf === 'br' ? 114_820_400 : 2_450_000) + localSimStep * (uf === 'br' ? 1420 : 60);
    const v1 = Math.round(baseTot * (p1 / 100));
    const v2 = baseTot - v1;
    return {
      ele: getEleCode('pres'),
      t: '2',
      tf: 'n',
      and: 'p',
      dt,
      ht,
      carg: [
        {
          cd: '1',
          nmn: 'Presidente',
          agr: [
            {
              par: [
                {
                  n: '91',
                  sg: 'PT',
                  cand: [
                    {
                      n: '91',
                      sqcand: '250001000001',
                      nm: 'LULA',
                      nmu: 'LULA',
                      seq: '1',
                      e: 'n',
                      dvt: 'Válido',
                      vap: String(v1),
                      pvapn: p1.toFixed(6).replace('.', ','),
                    },
                  ],
                },
              ],
            },
            {
              par: [
                {
                  n: '92',
                  sg: 'PL',
                  cand: [
                    {
                      n: '92',
                      sqcand: '250001000002',
                      nm: 'FLÁVIO BOLSONARO',
                      nmu: 'FLÁVIO BOLSONARO',
                      seq: '2',
                      e: 'n',
                      dvt: 'Válido',
                      vap: String(v2),
                      pvapn: p2.toFixed(6).replace('.', ','),
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      s: { ts: '528951', st: '503120', pstn: '95,12' },
      e: { te: '163079139', c: '138863131', pcn: '85,15', a: '24216008', pan: '14,85' },
      v: { tv: '138863131', vv: String(baseTot), pvvn: '95,50', vb: '2221810', pvbn: '1,60', tvn: '4027030', ptvnn: '2,90' },
    };
  }

  async function fetchTSEJson(url, isHighPriority = false, outerSignal = null) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONFIG.REQUEST_TIMEOUT_MS);
    const onAbort = () => ctrl.abort();
    if (outerSignal) {
      if (outerSignal.aborted) ctrl.abort();
      else outerSignal.addEventListener('abort', onAbort, { once: true });
    }
    const headers = {};
    const prevEtag = etags.get(url);
    if (prevEtag) headers['If-None-Match'] = prevEtag;

    try {
      const opts = { signal: ctrl.signal, headers, cache: 'no-cache' };
      if (isHighPriority) opts.priority = 'high';
      const r = await fetch(url, opts);
      clearTimeout(timer);

      if (r.status === 304 && jsonCache.has(url)) {
        return { ok: true, notModified: true, data: jsonCache.get(url) };
      }
      if (r.status === 404) return { missing: true };
      if (r.status === 429 || r.status === 403) return { rateLimited: true };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      const newEtag = r.headers.get('etag');
      if (newEtag) etags.set(url, newEtag);

      const data = await r.json();
      jsonCache.set(url, data);
      return { ok: true, data };
    } catch (err) {
      clearTimeout(timer);
      if (outerSignal && outerSignal.aborted) throw err; // ciclo cancelado: não vira dado simulado
      if (SIM) {
        const fb = buildLocalSimFallback(url);
        jsonCache.set(url, fb);
        return { ok: true, data: fb };
      }
      throw err;
    } finally {
      if (outerSignal) outerSignal.removeEventListener('abort', onAbort);
    }
  }

  async function runConcurrentQueue(items, workerFn, maxConc = CONFIG.MAX_CONCURRENCY) {
    const q = [...items];
    const workers = Array.from({ length: Math.min(maxConc, q.length) }, async () => {
      while (q.length > 0) {
        const it = q.shift();
        if (it !== undefined) await workerFn(it);
      }
    });
    await Promise.all(workers);
  }

  function getSecondsUntil17hBrasilia() {
    try {
      const fmt = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
      const nowSec = Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
      const targetSec = 17 * 3600;
      if (targetSec > nowSec) return targetSec - nowSec;
      return FORCE_PRE17 ? 24 * 3600 - nowSec + targetSec : 0;
    } catch {
      return FORCE_PRE17 ? 3600 : 0;
    }
  }

  function setLiveStatus(mode, text) {
    dom.liveIndicator.className = `live-indicator ${mode}`;
    setTextDiff(dom.liveLabel, mode === 'stale' ? 'DESATUALIZADO' : mode === 'waiting' ? 'AGUARDANDO' : 'AO VIVO');
    setTextDiff(dom.officialTimeLabel, text);
  }

  function showCalm() {
    const before17 = getSecondsUntil17hBrasilia() > 0;
    waitingFor17h = before17;
    dom.calmLine.hidden = false;
    dom.pre17Timer.hidden = !before17;
    setTextDiff(
      dom.calmText,
      before17
        ? 'A divulgação oficial do TSE começa às 17h (horário de Brasília).'
        : 'Aguardando os primeiros boletins oficiais do TSE.'
    );
  }

  async function fetchSingleState(role, S, uf, abrEntry, signal) {
    const res = await fetchTSEJson(urlResult(uf, role), false, signal);
    if (res.missing) {
      S.retryAt[uf] = Date.now() + CONFIG.RETRY_404_STATE_MS;
      return 'missing';
    }
    if (res.rateLimited) {
      rateLimitedUntil = Date.now() + CONFIG.RATE_LIMIT_PAUSE_MS;
      return 'limited';
    }
    const parsed = parseUnified(res.data, role === 'gov' ? '3' : '1', { role, uf });
    if (!parsed) return 'invalid';
    S.states[uf] = parsed;
    S.fetchedAt[uf] = Date.now();
    if (abrEntry) S.stamps[uf] = stampOf(abrEntry);
    S.stateTimes[uf] = `${(abrEntry && abrEntry.ht) || parsed.ht}`;
    return 'ok';
  }

  function announce(text) {
    const now = Date.now();
    if (now - lastAriaAnnounceAt < CONFIG.ARIA_ANNOUNCE_MIN_MS) return;
    lastAriaAnnounceAt = now;
    setTextDiff(dom.srAnnouncer, text);
  }

  // Ciclo do Presidente: arquivo nacional `br` + UFs que mudaram
  async function cyclePres(S, signal, snap, stale) {
    // 6.3 Primeira regra de ouro: busca primeiro o arquivo nacional `br`
    const natRes = await fetchTSEJson(urlResult('br', 'pres'), true, signal);
    if (stale()) return;
    if (natRes.rateLimited) {
      rateLimitedUntil = Date.now() + CONFIG.RATE_LIMIT_PAUSE_MS;
      freezeTickers(S);
      setLiveStatus('stale', 'dados desatualizados · limite do TSE');
      return;
    }
    if (natRes.missing) {
      showCalm();
      setLiveStatus('waiting', 'aguardando abertura oficial às 17h');
      if (!hasVotes(S.national)) renderEmpty();
      return;
    }

    const d = parseUnified(natRes.data, '1', { role: 'pres', uf: 'br' });
    if (!d || d.cands.length < 2) {
      setLiveStatus('waiting', 'aguardando primeiros boletins de urna');
      if (!hasVotes(S.national)) renderEmpty();
      return;
    }

    errorStreak = 0;
    waitingFor17h = false;
    S.national = d;
    if (!hasVotes(d)) {
      // arquivo aberto, mas ainda sem votos: estado vazio (sem zeros)
      showCalm();
      setLiveStatus('waiting', 'aguardando primeiros boletins de urna');
      renderEmpty();
      return;
    }
    dom.calmLine.hidden = true;
    recordSparkline(S, 'br', d);

    const abRes = await fetchTSEJson(urlTrack('pres'), false, signal);
    if (stale()) return;
    if (abRes.ok && abRes.data && Array.isArray(abRes.data.abr)) {
      const now = Date.now();
      const todo = abRes.data.abr
        .filter(
          (a) =>
            a.tpabr === 'uf' &&
            UF_META[a.cdabr] &&
            stampOf(a) !== S.stamps[a.cdabr] &&
            (S.retryAt[a.cdabr] || 0) < now
        )
        .slice(0, CONFIG.MAX_REQ_PER_CYCLE - 2);

      if (todo.length > 0) {
        await runConcurrentQueue(
          todo,
          (a) =>
            fetchSingleState('pres', S, a.cdabr, a, signal).catch((err) => {
              if (signal.aborted) throw err;
            }),
          CONFIG.MAX_CONCURRENCY
        );
      }
    }
    if (stale()) return;

    setLiveStatus('live', `atualizado às ${d.ht || 'ao vivo'}`);
    refreshView({ snap });

    announce(
      `Oficial TSE às ${d.ht}: ${getCandidateProfile(d.cands[0], 0).displayName} ${fmtPct(d.cands[0].pct)}% (${fmtInt(
        d.cands[0].votes
      )} votos), ${getCandidateProfile(d.cands[1], 1).displayName} ${fmtPct(d.cands[1].pct)}% (${fmtInt(
        d.cands[1].votes
      )} votos). ${fmtPct(d.sections.pct)}% das seções apuradas.`
    );
  }

  // B3: ciclo do Governador busca TODAS as UFs com 2º turno (respeita ETag/304 e o limite por ciclo)
  async function cycleGov(S, signal, snap, stale) {
    const abRes = await fetchTSEJson(urlTrack('gov'), true, signal);
    if (stale()) return;
    if (abRes.rateLimited) {
      rateLimitedUntil = Date.now() + CONFIG.RATE_LIMIT_PAUSE_MS;
      freezeTickers(S);
      setLiveStatus('stale', 'dados desatualizados · limite do TSE');
      return;
    }
    if (abRes.missing) {
      showCalm();
      setLiveStatus('waiting', 'aguardando dados de Governador (17h)');
      refreshView({ snap });
      return;
    }

    // B1: do acompanhamento só interessam as UFs que realmente têm 2º turno
    const abByUf = {};
    ((abRes.data && abRes.data.abr) || []).forEach((a) => {
      if (a.tpabr === 'uf' && hasRunoff(a.cdabr)) abByUf[a.cdabr] = a;
    });

    const now = Date.now();
    // Economia de requisições: o estado em foco atualiza a cada ciclo; os demais só na 1ª carga
    // (para os chips) e depois raramente (GOV_BG_REFRESH_MS), em vez de todos a cada 12s.
    const bgMs = CONFIG.GOV_BG_REFRESH_MS;
    const todo = govDisputedUfs
      .filter((uf) => {
        if ((S.retryAt[uf] || 0) >= now) return false;
        if (uf === activeGovUf) return true;
        const last = S.fetchedAt[uf];
        if (!last) return true;
        return bgMs > 0 && now - last >= bgMs;
      })
      .slice(0, CONFIG.MAX_REQ_PER_CYCLE - 2);
    let failed = 0;
    await runConcurrentQueue(
      todo,
      (uf) =>
        fetchSingleState('gov', S, uf, abByUf[uf], signal).catch((err) => {
          if (signal.aborted) throw err;
          failed += 1;
        }),
      CONFIG.MAX_CONCURRENCY
    );
    if (stale()) return;
    if (todo.length > 0 && failed === todo.length) throw new Error('falha em todas as UFs de governador');

    errorStreak = 0;
    const anyVotes = govDisputedUfs.some((uf) => hasVotes(S.states[uf]));
    if (!anyVotes) {
      showCalm();
      setLiveStatus('waiting', 'aguardando dados de Governador (17h)');
      refreshView({ snap });
      return;
    }

    waitingFor17h = false;
    dom.calmLine.hidden = true;
    govDisputedUfs.forEach((uf) => {
      if (hasVotes(S.states[uf])) recordSparkline(S, uf, S.states[uf]);
    });

    const d = focusData(S);
    // hora do boletim mais recente entre as UFs (o nome da UF em foco já aparece no cabeçalho do bloco)
    const latestHt = govDisputedUfs.reduce((m, uf) => {
      const h = S.states[uf] && S.states[uf].ht;
      return h && h > m ? h : m;
    }, '');
    setLiveStatus('live', `atualizado às ${latestHt || 'ao vivo'}`);
    refreshView({ snap });

    if (hasVotes(d)) {
      announce(
        `Oficial TSE às ${d.ht}, governador de ${UF_META[activeGovUf].name}: ${
          getCandidateProfile(d.cands[0], 0).displayName
        } ${fmtPct(d.cands[0].pct)}% (${fmtInt(d.cands[0].votes)} votos), ${
          getCandidateProfile(d.cands[1], 1).displayName
        } ${fmtPct(d.cands[1].pct)}% (${fmtInt(d.cands[1].votes)} votos). ${fmtPct(
          d.sections.pct
        )}% das seções apuradas.`
      );
    }
  }

  async function runCycle(snapTickers) {
    busy = true;
    const role = activeRole;
    const S = store[role];
    const ctrl = new AbortController();
    cycleCtrl = ctrl;
    const signal = ctrl.signal;
    // Ciclo "velho": foi cancelado ou o cargo mudou enquanto a rede respondia
    const stale = () => signal.aborted || activeRole !== role;

    try {
      if (Date.now() < rateLimitedUntil) {
        freezeTickers(S);
        setLiveStatus('stale', 'acesso temporariamente limitado pelo TSE');
        return;
      }
      if (navigator.onLine === false) {
        freezeTickers(S);
        setLiveStatus('stale', 'dados desatualizados · sem conexão');
        return;
      }

      if (FORCE_PRE17) {
        waitingFor17h = true;
        dom.calmLine.hidden = false;
        dom.pre17Timer.hidden = false;
        setLiveStatus('waiting', 'divulgação a partir das 17h (Brasília)');
        if (!hasVotes(focusData(S))) renderEmpty();
        return;
      }

      if (role === 'gov') await cycleGov(S, signal, snapTickers, stale);
      else await cyclePres(S, signal, snapTickers, stale);
    } catch (err) {
      if (signal.aborted) return;
      errorStreak += 1;
      // Regra obrigatória do Ticker: se o fetch falhar, SHOWN para em TARGET e não continua subindo
      freezeTickers(S);
      if (activeRole === role) {
        if (hasVotes(focusData(S))) {
          const tk = activeTickers();
          dom.cands.forEach((s, i) => setTextDiff(s.votesShown, fmtInt(tk[i].shown)));
        }
        const d = focusData(S);
        setLiveStatus('stale', `dados desatualizados${d && d.ht ? ' · último lote ' + d.ht : ''}`);
      }
    } finally {
      if (cycleCtrl === ctrl) cycleCtrl = null;
      busy = false;
      // B4: se alguém pediu atualização durante o ciclo, roda logo em seguida (nenhum clique se perde)
      if (pendingSnap !== null) {
        const snap = pendingSnap;
        pendingSnap = null;
        setTimeout(() => tick(snap), 0);
      }
    }
  }

  function tick(snapTickers = false) {
    if (busy) {
      pendingSnap = Boolean(pendingSnap) || Boolean(snapTickers);
      return Promise.resolve();
    }
    return runCycle(snapTickers);
  }

  const allFinal = (S) =>
    S.role === 'gov'
      ? govDisputedUfs.every((uf) => S.states[uf] && S.states[uf].final)
      : Boolean(S.national && S.national.final);

  // Loop invisível de polling (12s padrão, ou backoff exponencial em erro)
  function scheduleNextPoll() {
    const base = allFinal(cur()) ? CONFIG.FINAL_POLL_INTERVAL_MS : CONFIG.POLL_INTERVAL_MS;
    const delay = errorStreak > 0 ? Math.min(180_000, base * Math.pow(2, errorStreak - 1)) : base;
    setTimeout(async () => {
      if (!document.hidden && navigator.onLine !== false) {
        await tick(false);
      }
      scheduleNextPoll();
    }, delay);
  }

  // Relógio para contagem regressiva antes das 17h
  setInterval(() => {
    if (!waitingFor17h || document.hidden) return;
    const rem = getSecondsUntil17hBrasilia();
    if (rem > 0) {
      const hh = String(Math.floor(rem / 3600)).padStart(2, '0');
      const mm = String(Math.floor((rem % 3600) / 60)).padStart(2, '0');
      const ss = String(rem % 60).padStart(2, '0');
      setTextDiff(dom.pre17Timer, `${hh}:${mm}:${ss}`);
    } else {
      waitingFor17h = false;
      dom.calmLine.hidden = true;
      tick(true);
    }
  }, 1000);

  // Regra obrigatória do Ticker: ao retornar de aba oculta, faz snap instantâneo SHOWN = TARGET e atualiza
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      const tk = activeTickers();
      tk.forEach((t) => t.snapToTarget());
      if (hasVotes(focusData())) dom.cands.forEach((s, i) => setTextDiff(s.votesShown, fmtInt(tk[i].shown)));
      tick(true);
    }
  });

  window.addEventListener('offline', () => {
    freezeTickers(cur());
    setLiveStatus('stale', 'dados desatualizados · sem conexão');
  });

  window.addEventListener('online', () => {
    errorStreak = 0;
    tick(true);
  });

  // Modo TV (?tv): destaca estados automaticamente em ciclo lento e elegante
  if (TV_MODE) {
    let tvIdx = 0;
    setInterval(() => {
      const S = cur();
      const hasAny = S.role === 'gov' ? govDisputedUfs.some((u) => hasVotes(S.states[u])) : Boolean(S.national);
      if (document.hidden || !hasAny) return;
      const list = activeRole === 'gov' ? govDisputedUfs : Object.keys(UF_META).filter((u) => u !== 'zz');
      const uf = list[tvIdx % list.length];
      tvIdx += 1;
      if (activeRole === 'gov') setGovUf(uf);
      openPanel(uf, { focus: false });
    }, CONFIG.TV_CYCLE_STATE_MS);
  }

  // Auto-teste do Ticker se ?selftest estiver na URL
  if (SELFTEST) {
    const report = runTickerSelfCheck();
    dom.secondaryDrawer.hidden = false;
    dom.selftestBadge.hidden = false;
    setTextDiff(dom.selftestBadge, `Self-check Ticker: ${report.allPass ? '5/5 PASS' : 'FAIL'}`);
  }

  if ('serviceWorker' in navigator && !IS_FILE) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  // --------------------------------------------------------------------------
  // 5.13 INICIALIZAÇÃO
  // --------------------------------------------------------------------------
  initMap();
  if (location.hash && !/#(pres|gov)\/([a-z]{2}\/cidades|analise|boletim|horarios)/i.test(location.hash)) navigate(initialRoute.role, initialRoute.uf, 'keep'); // normaliza #sp -> #pres/sp
  renderAll({ snap: true });
  if (initialRoute.uf) openPanel(initialRoute.uf, { focus: false }); // recarregar restaura cargo + estado

  tick(false);
  scheduleNextPoll();
})();
