// Service Worker — guarda o casco do aplicativo e as fotos locais dos candidatos.
// NUNCA armazena /api/* (R28).
//
// B11 — estratégia:
//   • index.html, app.js, styles.css e uf-paths.js: REDE PRIMEIRO (cache só como reserva offline).
//     Assim, depois de um deploy, a versão nova aparece no 1º recarregamento.
//   • fotos, ícone e manifesto: cache primeiro, atualizando em segundo plano (stale-while-revalidate).
//   • instalação tolerante a falhas: um arquivo ausente (ex.: foto de governador ainda não enviada)
//     não derruba a instalação.
//
// IMPORTANTE: troque o CACHE_VERSION a CADA deploy.
const CACHE_PREFIX = 'apuracao-broadcast-';
const CACHE_VERSION = 'v8-2026-10-26-pos-eleicao';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

const GOV_PHOTOS = [
  '/img/gov/ac-mailza-assis.webp',
  '/img/gov/ac-alan-rick.webp',
  '/img/gov/am-omar-aziz.webp',
  '/img/gov/am-professora-maria-do-carmo.webp',
  '/img/gov/df-celina-leao.webp',
  '/img/gov/df-leandro-grass.webp',
  '/img/gov/es-lorenzo-pazolini.webp',
  '/img/gov/es-ricardo-ferraco.webp',
  '/img/gov/rn-allyson.webp',
  '/img/gov/rn-cadu-de-lula.webp',
  '/img/gov/to-professora-dorinha.webp',
  '/img/gov/to-vicentinho-junior.webp',
];

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/pos.css',
  '/app.js',
  '/pos.js',
  '/uf-paths.js',
  '/manifest.webmanifest',
  '/icon.svg',
  '/img/logo/logo-horizontal-claro.svg',
  '/img/logo/logo-horizontal-escuro.svg',
  '/img/logo/icon-192.png',
  '/img/cand-1.webp',
  '/img/cand-2.webp',
  ...GOV_PHOTOS,
];

// Arquivos que precisam estar sempre na versão mais nova
const NETWORK_FIRST_PATHS = new Set(['/', '/index.html', '/app.js', '/pos.js', '/styles.css', '/pos.css', '/uf-paths.js']);
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // um por um e tolerante: o que falhar é ignorado, o resto entra no cache
        Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' }))))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const old = keys.filter((k) => k !== CACHE_NAME);
      await Promise.all(old.map((k) => caches.delete(k)));
      await self.clients.claim();

      // Havia uma versão anterior: recarrega as abas abertas UMA vez, para que a página já
      // rode o código novo sem precisar recarregar duas vezes.
      if (old.some((k) => k.startsWith(CACHE_PREFIX))) {
        const windows = await self.clients.matchAll({ type: 'window' });
        windows.forEach((client) => {
          try {
            client.navigate(client.url);
          } catch {
            /* ignora */
          }
        });
      }
    })()
  );
});

async function fetchWithTimeout(request, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(request, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (response && response.status === 200 && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached =
      (await cache.match(request, { ignoreSearch: true })) ||
      (request.mode === 'navigate' ? await cache.match('/index.html') : undefined);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || networkPromise;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.hostname.includes('tse.jus.br')) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || NETWORK_FIRST_PATHS.has(url.pathname) || url.pathname.startsWith('/data/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
