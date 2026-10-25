// プレイヤーズセットリスト Service Worker
// 方針：ネット優先（最新版を取りに行く）→ 3秒以内に返事がない／オフラインなら保存済みの版で起動する。
// アプリの更新は index.html の差し替えだけでOK。このファイルを変える必要はありません。
const CACHE = 'players-setlist-v48';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png'];
const TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;     // 外部（フォント等）はブラウザに任せる
  if (url.searchParams.has('check')) return;            // 新バージョン確認用の通信はキャッシュしない
  event.respondWith(networkFirst(req));
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then((res) => {
    if (res) return res;
    // ページ遷移なら index.html で代用
    return req.mode === 'navigate' ? caches.match('./index.html') : undefined;
  });
}

function networkFirst(req) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (res) => { if (!settled && res) { settled = true; resolve(res); } };

    const timer = setTimeout(() => { fromCache(req).then(finish); }, TIMEOUT_MS);

    fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      clearTimeout(timer);
      finish(res);
    }).catch(() => {
      clearTimeout(timer);
      fromCache(req).then((res) => {
        if (res) finish(res);
        else if (!settled) { settled = true; resolve(Response.error()); }
      });
    });
  });
}
