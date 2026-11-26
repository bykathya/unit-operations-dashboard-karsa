import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { NAMA_BULAN, bulanSekarang, geserBulan } from '../api-util'

const KPI = [['post', 'Post'], ['reply', 'Komen/Reply'], ['update', 'Update'], ['seo', 'SEO']]

function Batang({ p }) {
  const persen = p.persen == null ? 0 : Math.min(100, p.persen)
  return (
    <div className="kpi">
      <div className="kpi-atas"><span>{p.label}</span><b>{p.realisasi} / {p.target}{p.persen != null ? ` · ${p.persen}%` : ''}</b></div>
      <div className="bar"><i style={{ width: persen + '%' }} className={p.persen != null && p.persen >= 100 ? 'penuh' : ''} /></div>
    </div>
  )
}

function KartuAkun({ studioId, bulan, tahun, userId, a, bisaUbah, onSimpan }) {
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState(a.target)
  const [galat, setGalat] = useState('')
  async function simpan() { try { await api('/api/circle/marketing/rencana', { method: 'PUT', body: { studioId, akunId: a.akunId, userId, bulan, tahun, ...v } }); setEdit(false); onSimpan() } catch (e) { setGalat(e.message) } }
  return (
    <div className="panel kartu-akun">
      <div className="kpi-atas"><h4>{a.platform} · {a.nama}</h4>{a.pakaiStandar && <span className="lencana">target standar</span>}{bisaUbah && !edit && <button className="btn kecil" onClick={() => { setV(a.target); setEdit(true) }}>Ubah target</button>}</div>
      {edit ? (
        <>
          <div className="empat">{KPI.map(([k, l]) => <label key={k}>{l}<input inputMode="numeric" value={v[k]} onChange={e => setV({ ...v, [k]: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} /></label>)}</div>
          {galat && <div className="galat">{galat}</div>}
          <div className="modal-aksi"><button className="btn kecil" onClick={() => setEdit(false)}>Batal</button><button className="btn kecil utama" onClick={simpan}>Simpan target</button></div>
        </>
      ) : a.progres.map(p => <Batang key={p.kunci} p={p} />)}
    </div>
  )
}

function Penugasan({ studioId, onSimpan }) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  useEffect(() => { api(`/api/circle/marketing/akun?studioId=${studioId}`).then(setD).catch(e => setGalat(e.message)) }, [studioId])
  if (galat) return <div className="galat">{galat}</div>
  if (!d) return null
  async function toggle(m, akunId) {
    const ada = m.akunIds.includes(akunId)
    const akunIds = ada ? m.akunIds.filter(x => x !== akunId) : [...m.akunIds, akunId]
    try { await api('/api/circle/marketing/akun/penugasan', { method: 'PUT', body: { studioId, userId: m.id, akunIds } }); const n = await api(`/api/circle/marketing/akun?studioId=${studioId}`); setD(n); onSimpan() } catch (e) { alert(e.message) }
  }
  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <h3 className="judul-bagian">Penugasan akun ke marketer</h3>
      <p className="redup kecil">Marketer hanya bisa mencatat aktivitas dan menyusun rencana untuk akun yang ditugaskan padanya. (Akun marketplace berasal dari data produksi studio.)</p>
      {d.marketer.length === 0 && <div className="kosong">Belum ada Marketer di studio ini. Tetapkan fungsi Marketer di tab Tim.</div>}
      {d.marketer.map(m => (
        <div key={m.id} className="alur-baris"><strong style={{ minWidth: 150 }}>{m.nama}</strong>
          {d.akun.length === 0 ? <span className="redup kecil">Studio belum punya akun marketplace.</span> : d.akun.map(a => <button key={a.id} className={'pilih' + (m.akunIds.includes(a.id) ? ' aktif' : '')} onClick={() => toggle(m, a.id)}>{a.platform} · {a.namaAkun}</button>)}
        </div>
      ))}
    </div>
  )
}

export default function MkRencana({ studioId }) {
  const [bt, setBt] = useState(bulanSekarang())
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const muat = useCallback(() => api(`/api/circle/marketing/rencana?studioId=${studioId}&bulan=${bt.bulan}&tahun=${bt.tahun}&semua=1`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, bt])
  useEffect(() => { muat() }, [muat])
  if (galat) return <div className="galat blok">{galat}</div>
  if (!d) return <div className="redup tengah">Memuat rencana…</div>
  return (
    <>
      <div className="toolbar">
        <button className="btn kecil" onClick={() => setBt(geserBulan(bt, -1))}>‹</button>
        <strong>{NAMA_BULAN[bt.bulan - 1]} {bt.tahun}</strong>
        <button className="btn kecil" onClick={() => setBt(geserBulan(bt, 1))}>›</button>
        <span className="redup kecil">Standar per akun: {d.standar.map(s => `${s.kunci === 'reply' ? 'Reply' : s.kunci === 'post' ? 'Post' : s.kunci === 'update' ? 'Update' : 'SEO'} ${s.label}`).join(' · ')}</span>
      </div>
      {d.bisaTugaskanAkun && <Penugasan studioId={studioId} onSimpan={muat} />}
      {d.marketer.length === 0 && <div className="kosong">Belum ada marketer dengan akun yang ditugaskan.</div>}
      {d.marketer.map(m => (
        <div key={m.marketer.id} style={{ marginBottom: 16 }}>
          <h3 className="judul-bagian">{m.marketer.nama}</h3>
          {m.akun.length === 0 && <div className="kosong">Belum ada akun yang ditugaskan.</div>}
          <div className="kartu-grid">{m.akun.map(a => <KartuAkun key={a.akunId} studioId={studioId} bulan={bt.bulan} tahun={bt.tahun} userId={m.marketer.id} a={a} bisaUbah onSimpan={muat} />)}</div>
        </div>
      ))}
    </>
  )
}
