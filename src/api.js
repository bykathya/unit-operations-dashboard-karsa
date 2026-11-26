// Klien API Ekosistem. Token akses disimpan di memori (bukan localStorage), refresh-token = cookie httpOnly.
let token = null
let refreshing = null
let tokenAdmin = null // token asli Super Admin saat sedang menyamar

async function mentah(path, { method = 'GET', body } = {}) {
  return fetch(path, {
    method, credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
}

export async function pulihkanSesi() {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then(async r => (r.ok ? (await r.json()).data.accessToken : null))
    .catch(() => null)
    .finally(() => { refreshing = null })
  token = await refreshing
  return !!token
}

export async function api(path, opsi) {
  let r = await mentah(path, opsi)
  if (r.status === 401 && tokenAdmin) { akhiriMenyamar(); window.dispatchEvent(new Event('menyamar-berakhir')) }
  else if (r.status === 401 && !path.includes('/api/auth/') && (await pulihkanSesi())) r = await mentah(path, opsi)
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.success === false) {
    const e = new Error(j.message || 'Terjadi kesalahan, coba lagi')
    e.status = r.status
    if (j.galat) e.galat = j.galat   // galat per baris/field (validasi server)
    throw e
  }
  return j.data
}

export async function masuk(email, password) {
  const r = await mentah('/api/auth/login', { method: 'POST', body: { email, password } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.success === false) throw new Error(j.message || 'Email atau password salah')
  token = j.data.accessToken
  return j.data.user
}

export async function keluar() {
  await mentah('/api/auth/logout', { method: 'POST' }).catch(() => {})
  token = null
}

/** Identitas alamat web ini (nama + warna circle) — publik, dipakai halaman masuk. */
export async function ambilIdentitas() {
  const r = await fetch('/api/circle/identitas', { credentials: 'include' })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.message || 'Alamat web tidak dikenal')
  return j.data
}

// Mode menyamar (Super Admin): token tiruan dipakai sementara, token asli disimpan; sesi tiruan TIDAK di-refresh otomatis.
export const sedangMenyamar = () => tokenAdmin != null
export const ambilToken = () => token
export function mulaiMenyamar(tokenBaru) { if (!tokenAdmin) tokenAdmin = token; token = tokenBaru }
export function akhiriMenyamar() { if (tokenAdmin) { token = tokenAdmin; tokenAdmin = null } }
