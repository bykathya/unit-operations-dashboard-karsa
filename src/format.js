export const formatRp = (n) => 'Rp ' + Math.round(n ?? 0).toLocaleString('id-ID')

export function tanggalPendek(d) {
  if (!d) return '—'
  const t = new Date(d)
  return `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}`
}

export const lewatDeadline = (d, jenis) => !!d && jenis !== 'SELESAI' && new Date(d) < new Date(new Date().toDateString())
