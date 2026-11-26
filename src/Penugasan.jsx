import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { useSegarkan } from './realtime'

// PENUGASAN (adaptasi OGS): antrean per orang (bernomor, bisa diurut), keahlian (tahap & genre) + penugasan otomatis per unit.
// Koordinator ke atas. Anggota biasa melihat antreannya sendiri di "Tugas saya".
const tgl = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '')
const aksi = async (fn, setGalat, muat) => { setGalat(''); try { await fn(); muat?.() } catch (e) { setGalat(e.message) } }

function Antrean({ studioId }) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const muat = useCallback(() => api(`/api/circle/antrean?studioId=${studioId}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId])
  useEffect(() => { setD(null); muat() }, [muat])
  useSegarkan(muat, ['orders', 'penugasan', 'antrean', 'tugas'])
  const geser = (o, i, arah) => { const ids = o.antrean.map(a => a.id); const j = i + arah; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; aksi(() => api('/api/circle/antrean/urutan', { method: 'PUT', body: { studioId, userId: o.userId, ids } }), setGalat, muat) }
  if (!d) return galat ? <div className="galat blok">{galat}</div> : <div className="redup">Memuat…</div>
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      <label className="toolbar" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" style={{ width: 'auto' }} checked={d.otomatis} onChange={e => aksi(() => api('/api/circle/pengaturan-penugasan', { method: 'PUT', body: { studioId, otomatis: e.target.checked } }), setGalat, muat)} /> <b>Penugasan otomatis</b> <span className="redup kecil">— order tanpa penanggung jawab ditugaskan otomatis saat masuk tahap kerja (butuh kesulitan order + keahlian)</span></label>
      {d.orang.length === 0 ? <div className="kosong">Belum ada tugas aktif di antrean siapa pun.</div> : d.orang.map(o0 => {
        // Ditunda (12 Nov 2026, masukan tim): tidak masuk antrean harian talent; tampil terpisah di bawah dengan tombol "Masukkan antrean"
        const o = { ...o0, antrean: o0.antrean.filter(a => !a.tunda) }, ditunda = o0.antrean.filter(a => a.tunda)
        const tunda = (a, v) => aksi(() => api(`/api/circle/penugasan/${a.id}/tunda`, { method: 'POST', body: { tunda: v } }), setGalat, muat)
        return (
        <div className="panel" key={o.userId} style={{ marginBottom: 10 }}>
          <div className="baris-atas"><b>{o.nama}</b><span className="redup kecil">{o.antrean.length} di antrean{ditunda.length ? ` · ${ditunda.length} ditunda` : ''}</span></div>
          <table><tbody>{o.antrean.map((a, i) => (
            <tr key={a.id}><td style={{ width: 34 }}><b>{a.nomor}</b></td><td><b>{a.mendesak && <span title="Mendesak">🔥 </span>}{a.judul}</b><div className="redup kecil">{a.klien} · {a.tahap}{a.deadline ? ` · ⏱ ${tgl(a.deadline)}` : ''}{a.otomatis ? ' · otomatis' : ''}</div>{a.catatanKerja && <div className="redup kecil">“{a.catatanKerja}”</div>}</td>
              <td style={{ width: 150 }}><div className="gf-trek" title={`${a.progres}%`}><i style={{ width: `${a.progres}%`, background: 'var(--seri-1)' }} /></div><div className="redup kecil">{a.progres}%</div></td>
              <td className="kanan"><button className={'btn kecil' + (a.mendesak ? ' utama' : '')} title="Tandai mendesak (selalu di atas antrean)" onClick={() => aksi(() => api(`/api/circle/penugasan/${a.id}/mendesak`, { method: 'POST' }), setGalat, muat)}>🔥</button> <button className="btn kecil" title="Tunda — bukan untuk hari ini (tetap terlihat di Tugasku talent)" onClick={() => tunda(a, true)}>⏸</button> <button className="btn kecil" disabled={i === 0} onClick={() => geser(o, i, -1)} aria-label="Naikkan">↑</button> <button className="btn kecil" disabled={i === o.antrean.length - 1} onClick={() => geser(o, i, 1)} aria-label="Turunkan">↓</button></td></tr>
          ))}</tbody></table>
          {ditunda.length > 0 && <div style={{ marginTop: 8 }}>
            <div className="redup kecil" style={{ fontWeight: 700, margin: '4px 0' }}>⏸ Ditunda — belum masuk antrean talent (tampil di Tugasku: prioritas berikutnya / bisa untuk lembur)</div>
            <table><tbody>{ditunda.map(a => <tr key={a.id} style={{ opacity: 0.75 }}><td><b>{a.judul}</b><div className="redup kecil">{a.klien} · {a.tahap}{a.deadline ? ` · ⏱ ${tgl(a.deadline)}` : ''}</div></td><td className="kanan"><button className="btn kecil utama" onClick={() => tunda(a, false)}>▶ Masukkan antrean</button></td></tr>)}</tbody></table>
          </div>}
        </div>
        )
      })}
    </div>
  )
}

function Keahlian({ studioId }) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const [f, setF] = useState({ jenis: 'tahap', userId: '', tahapId: '', genre: '', akunId: '', maksKesulitan: 'SEDANG' })
  const muat = useCallback(() => api(`/api/circle/keahlian?studioId=${studioId}`).then(x => { setD(x); setF(v => ({ ...v, userId: v.userId || x.anggota[0]?.id || '', tahapId: v.tahapId || x.tahap[0]?.id || '' })); setGalat('') }).catch(e => setGalat(e.message)), [studioId])
  useEffect(() => { setD(null); muat() }, [muat])
  if (!d) return galat ? <div className="galat blok">{galat}</div> : <div className="redup">Memuat…</div>
  const hapus = (k, jenis) => confirm('Hapus keahlian ini?') && aksi(() => api(`/api/circle/keahlian/${k.id}?jenis=${jenis}`, { method: 'DELETE' }), setGalat, muat)
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      <p className="redup">Keahlian dipakai untuk penugasan otomatis dan saran penugasan: anggota dianggap cocok bila <b>kesulitan maksimal</b>-nya ≥ kesulitan order. Keahlian <b>tahap</b> diprioritaskan; bila tahap itu belum punya keahlian terdaftar, dipakai keahlian <b>genre</b>.</p>
      <div className="toolbar"><button className="btn" onClick={() => aksi(async () => { const h = await api('/api/circle/keahlian/dari-riwayat', { method: 'POST', body: { studioId } }); alert(`${h.ditambah} keahlian ditambahkan (ambang ${h.ambang}× tuntas; ${h.dilewati} dilewati).`) }, setGalat, muat)}>Isi keahlian dari riwayat</button><span className="redup kecil">Orang yang sudah ≥ 2× menuntaskan sebuah tahap otomatis dianggap mampu (level = kesulitan tertinggi yang pernah dituntaskan). Tidak menimpa yang sudah diisi.</span></div>
      <form className="panel" style={{ marginBottom: 14 }} onSubmit={e => { e.preventDefault(); aksi(() => api('/api/circle/keahlian', { method: 'PUT', body: { studioId, userId: f.userId, maksKesulitan: f.maksKesulitan, ...(f.jenis === 'tahap' ? { tahapId: f.tahapId, akunId: f.akunId || undefined } : { genre: f.genre }) } }), setGalat, muat) }}>
        <div className="dua">
          <label>Anggota<select value={f.userId} onChange={e => setF({ ...f, userId: e.target.value })}>{d.anggota.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}</select></label>
          <label>Berdasarkan<select value={f.jenis} onChange={e => setF({ ...f, jenis: e.target.value })}><option value="tahap">Tahap kerja</option><option value="genre">Genre</option></select></label>
          {f.jenis === 'tahap' ? <>
            <label>Tahap<select value={f.tahapId} onChange={e => setF({ ...f, tahapId: e.target.value })}>{d.tahap.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}</select></label>
            <label>Akun (opsional)<select value={f.akunId} onChange={e => setF({ ...f, akunId: e.target.value })}><option value="">Semua akun</option>{d.akun.map(a => <option key={a.id} value={a.id}>{a.platform} · {a.namaAkun}</option>)}</select></label>
          </> : <label>Genre<input value={f.genre} onChange={e => setF({ ...f, genre: e.target.value })} placeholder="mis. Vtuber, Chibi" maxLength={60} required /></label>}
          <label>Kesulitan maksimal<select value={f.maksKesulitan} onChange={e => setF({ ...f, maksKesulitan: e.target.value })}>{d.kesulitan.map(k => <option key={k}>{k}</option>)}</select></label>
        </div>
        <button className="btn utama">Simpan keahlian</button>
      </form>
      <h3 className="judul-bagian">Keahlian tahap</h3>
      {d.keahlianTahap.length === 0 ? <div className="kosong">Belum ada.</div> : <table><tbody>{d.keahlianTahap.map(k => <tr key={k.id}><td><b>{k.nama}</b></td><td>{k.tahap}{k.akunId && <span className="chip sub" style={{ marginLeft: 6 }}>{d.akun.find(a => a.id === k.akunId)?.namaAkun ?? 'akun'}</span>}</td><td><span className="chip">{k.maksKesulitan}</span></td><td className="kanan"><button className="btn kecil" onClick={() => hapus(k, 'tahap')}>Hapus</button></td></tr>)}</tbody></table>}
      <h3 className="judul-bagian" style={{ marginTop: 16 }}>Keahlian genre</h3>
      {d.keahlianGenre.length === 0 ? <div className="kosong">Belum ada.</div> : <table><tbody>{d.keahlianGenre.map(k => <tr key={k.id}><td><b>{k.nama}</b></td><td>{k.genre}</td><td><span className="chip">{k.maksKesulitan}</span></td><td className="kanan"><button className="btn kecil" onClick={() => hapus(k, 'genre')}>Hapus</button></td></tr>)}</tbody></table>}
    </div>
  )
}

export default function Penugasan({ unit }) {
  const [sub, setSub] = useState('antrean')
  const [studioId, setStudioId] = useState(unit[0]?.id ?? '')
  return (
    <div>
      <div className="tab-mini">{[['antrean', 'Antrean'], ['keahlian', 'Keahlian']].map(([k, l]) => <button key={k} className={sub === k ? 'aktif' : ''} onClick={() => setSub(k)}>{l}</button>)}</div>
      <label style={{ maxWidth: 320 }}>Unit<select value={studioId} onChange={e => setStudioId(e.target.value)}>{unit.map(s => <option key={s.id} value={s.id}>{s.nama.trim()}</option>)}</select></label>
      {sub === 'antrean' && studioId && <Antrean key={studioId} studioId={studioId} />}
      {sub === 'keahlian' && studioId && <Keahlian key={studioId} studioId={studioId} />}
    </div>
  )
}
