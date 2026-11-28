// Service worker minimal (Karsa, 28 Nov 2026) — hanya supaya web bisa dipasang sebagai aplikasi (Install App).
// Sengaja TIDAK menyimpan cache apa pun: data selalu diambil langsung dari server, jadi tidak ada tampilan basi.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
