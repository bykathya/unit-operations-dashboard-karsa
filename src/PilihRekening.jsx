// Pilihan rekening unit (12 Nov 2026) — daftar dari Bio studio Ekosistem (Rekening Bank). Hanya nama bank yang dikirim server,
// tanpa nomor rekening. Unit tanpa rekening di Bio: tampilkan petunjuk, bukan pilihan kosong.
export default function PilihRekening({ daftar, value, onChange, kosong = '— belum dipilih —', style, kecil }) {
  if (!daftar?.length) return <span className="redup kecil" title="Tambahkan rekening di Management Dashboard → Bio studio → Rekening Bank">Belum ada rekening di Bio Ekosistem</span>
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value || null)} style={{ ...(kecil ? { padding: '4px 8px', fontSize: 12, width: 'auto' } : {}), ...style }}>
      <option value="">{kosong}</option>
      {daftar.map(r => <option key={r.id} value={r.id}>{r.nama}</option>)}
    </select>
  )
}
export const namaRekening = (daftar, id) => (id ? daftar?.find(r => r.id === id)?.nama ?? 'Rekening dihapus' : null)
