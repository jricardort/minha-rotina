/* Service worker do "minha-rotina" — offline-first do app shell.
   Estratégia:
   - Navegação (index.html): network-first → quando online sempre pega a versão
     mais nova (deploys do GitHub Pages aparecem na hora); offline cai no cache.
   - Demais GETs (CSS/JS de CDN, ícones): stale-while-revalidate.
   - Firebase/Firestore/Google: NUNCA passam pelo cache (sempre rede) para não
     quebrar auth/sync nem servir dados velhos.
   Para forçar atualização do próprio SW, basta mudar CACHE (ex: treino-v2). */
const CACHE = 'treino-v1';
const SHELL = ['./', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Deixa Firebase/Google passarem direto pela rede (sem cache).
  if (/firebaseio|firestore|googleapis|google\.com|gstatic\.com/.test(url.host)) return;

  // App shell: network-first, fallback para o cache quando offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => {
          const cp = r.clone();
          caches.open(CACHE).then(c => c.put('./index.html', cp));
          return r;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Outros recursos: stale-while-revalidate.
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(r => {
        if (r && r.status === 200) {
          const cp = r.clone();
          caches.open(CACHE).then(c => c.put(req, cp));
        }
        return r;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
