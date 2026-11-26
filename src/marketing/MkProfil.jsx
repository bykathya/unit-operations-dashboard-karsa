import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { hariIniLokal, NAMA_BULAN, bulanSekarang } from '../api-util'

function Mood({ studioId }) {
  const [d, setD] = useState(null)
  const [tanggal, setTanggal] = useState(hariIniLokal())
  const [catatan, setCatatan] = useState('')
  const [info, setInfo] = useState('')
  const bt = bulanSekarang()
  const muat = useCallback(() => api(`/api/circle/marketing/log?studioId=${studioId}&bulan=${bt.bulan}&tahun=${bt.tahun}`).then(setD), [studioId, bt.bulan, bt.tahun])
  useEffect(() => { muat().catch(() => {}) }, [muat])
  if (!d) return null
  const hari = d.log.find(l => l.tanggal === tanggal)
  async function pilih(mood) { try { await api('/api/circle/marketing/log', { method: 'PUT', body: { studioId, tanggal, mood, catatan: catatan || hari?.catatan } }); setInfo('Tersimpan.'); muat() } catch (e) { setInfo(e.message) } }
  return (
    <div className="panel">
      <h3 className="judul-bagian">Catatan harian · suasana hati</h3>
      <p className="redup kecil">Pribadi — hanya kamu yang bisa melihat isi log ini (koordinator tidak ikut melihat).</p>
      <div className="toolbar"><input type="date" max={hariIniLokal()} value={tanggal} onChange={e => { setTanggal(e.target.value); setInfo('') }} style={{ maxWidth: 170 }} /></div>
      <div className="chips">{d.mood.map(m => <button key={m.kunci} className={'pilih' + (hari?.mood === m.kunci ? ' aktif' : '')} onClick={() => pilih(m.kunci)}>{m.label}</button>)}</div>
      <label style={{ marginTop: 10 }}>Catatan (opsional)<textarea rows={2} defaultValue={hari?.catatan ?? ''} key={tanggal + (hari?.mood ?? '')} onChange={e => setCatatan(e.target.value)} /></label>
      {info && <div className="ok-info">{info}</div>}
      <h4 style={{ margin: '14px 0 6px', fontSize: 13 }}>{NAMA_BULAN[bt.bulan - 1]} {bt.tahun}</h4>
      <div className="chips">{d.log.length === 0 ? <span className="redup kecil">Belum ada catatan bulan ini.</span> : d.log.map(l => <span key={l.tanggal} className="lencana" title={l.catatan ?? ''}>{l.tanggal.slice(8)} · {d.mood.find(m => m.kunci === l.mood)?.label}</span>)}</div>
    </div>
  )
}

export default function MkProfil({ studioId }) {
  const [d, setD] = useState(null)
  const [baris, setBaris] = useState([])
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')
  const muat = useCallback(() => api(`/api/circle/marketing/profil?studioId=${studioId}`).then(x => { setD(x); setBaris(x.profil.filter(p => p.milikSaya).map(p => ({ platform: p.platform, link: p.link, label: p.label ?? '' }))) }).catch(e => setGalat(e.message)), [studioId])
  useEffect(() => { muat() }, [muat])
  if (galat) return <div className="galat blok">{galat}</div>
  if (!d) return <div className="redup tengah">Memuat…</div>
  const ubah = (i, p) => setBaris(b => b.map((x, n) => (n === i ? { ...x, ...p } : x)))
  async function simpan() { setInfo(''); try { await api('/api/circle/marketing/profil', { method: 'PUT', body: { studioId, profil: baris } }); setInfo('Profil tersimpan.'); muat() } catch (e) { setInfo(e.message) } }
  const lain = d.profil.filter(p => !p.milikSaya)
  return (
    <>
      {/* Akun studio dari Management Dashboard (12 Nov 2026): baca-saja, hanya pengelola/admin/marketer unit ini (disaring server). */}
      {d.akunStudio?.length > 0 && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <h3 className="judul-bagian">Akun sosmed &amp; marketplace studio</h3>
          <p className="redup kecil">Dari Bio studio di Management Dashboard — hanya terlihat oleh pengelola, admin, dan marketer unit ini. Menambah/mengubah akun dilakukan koordinator di Management Dashboard.</p>
          {d.akunStudio.map(a => <div key={a.id} className="tugas"><div><span className="chip">{a.platform}</span> {a.username ? <strong>{a.username}</strong> : null}</div><a className="tautan-k" href={a.url} target="_blank" rel="noreferrer noopener">{a.url}</a></div>)}
        </div>
      )}
      <div className="panel" style={{ marginBottom: 14 }}>
        <h3 className="judul-bagian">Profil sosial &amp; akun milikku</h3>
        <p className="redup kecil">Tautan akun PRIBADI yang kamu pakai untuk marketing (sosmed dan marketplace), supaya aset konten bisa ditelusuri. Akun milik studio tidak perlu diisi di sini — sudah tampil dari Management Dashboard.</p>
        {baris.map((b, i) => (
          <div key={i} className="alur-baris">
            <select value={b.platform} onChange={e => ubah(i, { platform: e.target.value })} style={{ maxWidth: 150 }}><option value="">platform…</option>{d.platform.map(p => <option key={p}>{p}</option>)}</select>
            <input value={b.link} placeholder="https://…" onChange={e => ubah(i, { link: e.target.value })} />
            <input value={b.label} placeholder="label (opsional)" onChange={e => ubah(i, { label: e.target.value })} style={{ maxWidth: 160 }} />
            <button className="btn kecil" onClick={() => setBaris(x => x.filter((_, n) => n !== i))}>✕</button>
          </div>
        ))}
        <div className="alur-aksi" style={{ marginTop: 8 }}><button className="btn" onClick={() => setBaris(b => [...b, { platform: 'X', link: '', label: '' }])}>+ Tambah profil</button><span className="spasi" /><button className="btn utama" onClick={simpan}>Simpan profil</button></div>
        {info && <div className={info.includes('tersimpan') ? 'ok-info' : 'galat'} style={{ marginTop: 8 }}>{info}</div>}
        {lain.length > 0 && (
          <><h4 style={{ margin: '16px 0 6px', fontSize: 13 }}>Profil tim</h4>
            {lain.map(p => <div key={p.id} className="tugas"><div><strong>{p.nama}</strong> <span className="chip">{p.platform}</span>{p.label ? ` · ${p.label}` : ''}</div><a className="tautan-k" href={p.link} target="_blank" rel="noreferrer noopener">{p.link}</a></div>)}</>
        )}
      </div>
      <Mood studioId={studioId} />
    </>
  )
}
