// Tanggal lokal (YYYY-MM-DD) tanpa pergeseran zona waktu
export const hariIniLokal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
export const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
export const bulanSekarang = () => { const d = new Date(); return { bulan: d.getMonth() + 1, tahun: d.getFullYear() } }
export const geserBulan = ({ bulan, tahun }, n) => { const t = tahun * 12 + (bulan - 1) + n; return { bulan: (t % 12) + 1, tahun: Math.floor(t / 12) } }

// Ekspor CSV (pemisah ";" + BOM agar terbuka rapi di Excel berlokal Indonesia). Angka ditulis mentah (tanpa pemisah ribuan).
export function unduhCsv(nama, baris) {
  const sel = (v) => { const s = v == null ? '' : String(v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const isi = '﻿' + baris.map(r => r.map(sel).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([isi], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = nama.endsWith('.csv') ? nama : nama + '.csv'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Ekspor Excel (.xlsx) — pustaka dimuat hanya saat dipakai. Baris pertama = judul kolom (tebal). Angka tetap angka.
export async function unduhXlsx(nama, baris, sheet = 'Data') {
  const { default: tulis } = await import('write-excel-file/browser')
  const data = baris.map((r, i) => r.map(v => (v == null || v === '' ? null : i === 0 ? { value: String(v), fontWeight: 'bold' } : typeof v === 'number' || typeof v === 'boolean' ? v : String(v))))
  await tulis(data, { sheet, columns: (baris[0] ?? []).map((_, i) => ({ width: i === 0 ? 34 : 16 })) }).toFile(nama.endsWith('.xlsx') ? nama : nama + '.xlsx')
}

// Alamat web pusat (28 Nov 2026): diturunkan dari alamat web kerja (kerja.domain → pusat.domain), tanpa domain tertulis di kode.
export function webPusat(jalur = '') {
  const h = window.location.hostname.split('.')
  return h.length > 2 ? `https://${['pusat', ...h.slice(1)].join('.')}/${jalur}` : `/${jalur}`
}
