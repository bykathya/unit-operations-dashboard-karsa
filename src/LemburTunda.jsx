import { useEffect, useState } from 'react'
import { useSegarkan } from './realtime'
import { api } from './api'
import { tanggalPendek } from './format'
import { InputAngka } from './Pilihan'

// LEMBUR DARI TUGAS YANG DITUNDA — penilaian admin (22 Nov 2026, ATURAN LEMBUR 3D ARTIST, tim).
// Talent menyelesaikan tugas yang DITUNDA admin di luar jam kerja → calon lembur 🌙. Admin Market / Koordinator mencentang tahap yang sudah
// sesuai (boleh beberapa) + level → nilai otomatis (fee level × bagian tahap), boleh disesuaikan → dikirim ke Koordinator
// (Tugas saya › Lembur) yang mengubah nilai / menyetujui / menolak. Hanya yang disetujui masuk slip.
const rp = (n) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'))

function FormNilai({ b, d, onSelesai, onBatal }) {
  const [levelId, setLevelId] = useState(b.levelId ?? (d.level.length === 1 ? d.level[0].id : ''))
  const [tahap, setTahap] = useState(() => new Set(d.tahap.filter(t => b.tahapDinilai?.some(x => x.nama === t.nama)).map(t => t.id)))
  const [nilai, setNilai] = useState(b.nilaiUsulan != null && b.status === 'MENUNGGU' ? String(b.nilaiUsulan) : '')
  const [catatan, setCatatan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState('')
  const level = d.level.find(l => l.id === levelId)
  const persen = Math.min(100, d.tahap.filter(t => tahap.has(t.id)).reduce((s, t) => s + t.bagian, 0))
  const otomatis = level && tahap.size ? Math.round(level.fee * persen / 100) : null
  const ubahTahap = (id) => { const s = new Set(tahap); s.has(id) ? s.delete(id) : s.add(id); setTahap(s) }
  async function kirim() {
    setSibuk(true); setGalat('')
    try {
      await api(`/api/circle/lembur/${b.id}/usul`, { method: 'POST', body: { levelId: levelId || null, tahap: [...tahap], nilai: nilai === '' ? null : Number(nilai), catatan } })
      onSelesai()
    } catch (e) { setGalat(e.message) }
    setSibuk(false)
  }
  return (
    <div className="panel" style={{ marginTop: 6, background: 'var(--bg-subtle, var(--hover))' }}>
      {d.level.length > 0 && <label>Level pekerjaan
        <select value={levelId} onChange={e => setLevelId(e.target.value)}>
          <option value="">— pilih level —</option>
          {d.level.map(l => <option key={l.id} value={l.id}>{l.nama}{l.produk ? ` — ${l.produk}` : ''} · fee {rp(l.fee)}</option>)}
        </select>
      </label>}
      {d.tahap.length > 0 ? <div style={{ margin: '6px 0' }}>
        <div className="redup kecil">Tahap yang sudah sesuai dikerjakan saat lembur (boleh lebih dari satu)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 4 }}>{d.tahap.map(t => <label key={t.id} style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: 5, margin: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}><input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={tahap.has(t.id)} onChange={() => ubahTahap(t.id)} />{t.nama} <span className="redup kecil">{t.bagian}%</span></label>)}</div>
      </div> : <div className="redup kecil" style={{ margin: '6px 0' }}>Koordinator belum mengisi daftar tahap lembur (Kehadiran › Jam kerja &amp; lembur). Isi nilainya langsung.</div>}
      {otomatis != null && <div className="kecil">Hitungan otomatis: <b>{rp(otomatis)}</b> <span className="redup">({persen}% × fee {rp(level.fee)})</span></div>}
      <div className="toolbar" style={{ marginTop: 6 }}>
        <label>Nilai diusulkan (Rp)
          <InputAngka value={nilai} placeholder={otomatis != null ? `${otomatis} (otomatis)` : 'isi nilai'} onChange={e => setNilai(e.target.value)} title="Kosongkan untuk memakai hitungan otomatis; ubah bila kualitasnya belum sesuai" />
        </label>
        <label>Catatan penilaian (opsional)
          <input value={catatan} maxLength={200} onChange={e => setCatatan(e.target.value)} placeholder="mis. rigging perlu dirapikan" />
        </label>
      </div>
      {galat && <div className="galat">{galat}</div>}
      <div className="toolbar">
        <button className="btn kecil utama" disabled={sibuk} onClick={kirim}>{sibuk ? '…' : 'Kirim ke koordinator'}</button>
        <button className="btn kecil" onClick={onBatal}>Batal</button>
      </div>
    </div>
  )
}

export default function LemburDinilai({ studioId, segarkan, onUbah }) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const [buka, setBuka] = useState(null)
  const muat = () => api(`/api/circle/lembur/calon?studioId=${studioId}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message))
  useEffect(() => { setD(null); muat() }, [studioId, segarkan]) // eslint-disable-line react-hooks/exhaustive-deps
  useSegarkan(() => muat(), ['orders', 'tugas', 'lembur'])
  if (galat) return <div className="galat">{galat}</div>
  if (!d || (!d.aktif && d.baris.length === 0)) return null
  return (
    <div className="panel">
      <h3 className="judul-bagian">🌙 Lembur perlu dinilai</h3>
      <div className="redup kecil" style={{ marginBottom: 6 }}>Tugas yang <b>ditunda</b> lalu diselesaikan talent di luar jam kerja. Cek hasilnya, centang tahap yang sudah sesuai, lalu kirim usulan nilai — keputusan akhir di Koordinator (Tugas saya › Lembur).</div>
      {d.baris.length === 0 ? <div className="kosong">Tidak ada lembur yang perlu dinilai</div> : d.baris.map(b => (
        <div key={b.id} style={{ borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
          <div className="tugas" style={{ border: 0, padding: 0 }}>
            <div>
              <strong>{b.tahap ?? 'Tugas'}</strong> – {b.judul} – {b.nama} <span className="lencana" title="Lembur dari tugas yang ditunda">🌙 {b.status === 'CALON' ? 'perlu dinilai' : 'menunggu koordinator'}</span>
              <div className="redup kecil">{b.klien} · selesai {tanggalPendek(b.tanggal)} {b.jam} WIB{b.status === 'MENUNGGU' ? ` · usulan ${rp(b.nilaiUsulan)}${b.tahapDinilai?.length ? ` (${b.tahapDinilai.map(t => t.nama).join(', ')})` : ''}${b.diusulkanOleh ? ` oleh ${b.diusulkanOleh}` : ''}` : ''}</div>
            </div>
            <div className="tugas-kanan">
              {b.folder && <a className="btn kecil" href={b.folder} target="_blank" rel="noreferrer noopener">📁 Folder</a>}
              {b.milikSaya ? <span className="redup kecil">lemburmu — dinilai admin lain</span>
                : <button className="btn kecil utama" onClick={() => setBuka(buka === b.id ? null : b.id)}>{b.status === 'CALON' ? 'Nilai' : 'Ubah usulan'}</button>}
            </div>
          </div>
          {buka === b.id && <FormNilai b={b} d={d} onBatal={() => setBuka(null)} onSelesai={() => { setBuka(null); muat(); onUbah?.() }} />}
        </div>
      ))}
    </div>
  )
}
