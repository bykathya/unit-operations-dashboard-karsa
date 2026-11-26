import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

// REFLEKSI MINGGUAN (adaptasi OGS SDM): tiap orang menulis hambatan mingguan; koordinator membaca & memberi komentar.
const A = '/api/circle/refleksi'
const aksi = async (fn, setGalat, muat) => { setGalat(''); try { await fn(); muat?.() } catch (e) { setGalat(e.message) } }
const tgl = (t) => new Date(t + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' })

function Kartu({ r, onKomentar, bolehKomentar, userId, onHapus }) {
  const [isi, setIsi] = useState('')
  return (
    <div className="panel">
      <div className="meta"><b>{tgl(r.mingguMulai)} – {tgl(r.mingguAkhir)}</b><span className="chip sub">{r.kategori}</span><span className="lencana">Tingkat {r.tingkat}/5</span>{r.perluDukungan && <span className="lencana revisi">perlu dukungan</span>}</div>
      <div style={{ marginTop: 6 }}>{r.hambatan}</div>
      {r.komitmen && <div className="redup kecil" style={{ marginTop: 4 }}>Komitmen: {r.komitmen}</div>}
      {r.komentar.map(k => <div key={k.id} className="redup kecil" style={{ marginTop: 6 }}>💬 <b>{k.penulis}</b>: {k.isi}{k.penulisId === userId && <button className="btn kecil" style={{ marginLeft: 8 }} onClick={() => onHapus(k.id)}>Hapus</button>}</div>)}
      {bolehKomentar && <form className="chips" style={{ marginTop: 8 }} onSubmit={e => { e.preventDefault(); onKomentar(r.id, isi); setIsi('') }}><input placeholder="Tulis komentar…" value={isi} onChange={e => setIsi(e.target.value)} maxLength={2000} required /><button className="btn kecil">Kirim</button></form>}
    </div>
  )
}

function Saya() {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [edit, setEdit] = useState(false)
  const [f, setF] = useState({ kategori: '', tingkat: 3, hambatan: '', komitmen: '' })
  const muat = useCallback(() => api(`${A}/saya`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [])
  useEffect(() => { muat() }, [muat])
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  const ini = d.mingguIni
  const mulaiEdit = () => { setF({ kategori: ini.kategori, tingkat: ini.tingkat, hambatan: ini.hambatan, komitmen: ini.komitmen ?? '' }); setEdit(true) }
  const simpan = (e) => { e.preventDefault(); aksi(async () => { await api(ini ? `${A}/${ini.id}` : A, { method: ini ? 'PATCH' : 'POST', body: { ...f, tingkat: Number(f.tingkat) } }); setEdit(false) }, setGalat, muat) }
  return (
    <div>
      {galat && <div className="galat">{galat}</div>}
      {(!ini || edit) ? (
        <form className="panel" onSubmit={simpan}>
          <h3 className="judul-bagian">Refleksi minggu {tgl(d.mingguMulai)} – {tgl(d.mingguAkhir)}</h3>
          <label>Hambatan utama<select value={f.kategori} onChange={e => setF({ ...f, kategori: e.target.value })} required><option value="">— pilih —</option>{d.kategori.map(k => <option key={k}>{k}</option>)}</select></label>
          <label>Seberapa menghambat? ({f.tingkat}/5)<input type="range" min="1" max="5" value={f.tingkat} onChange={e => setF({ ...f, tingkat: e.target.value })} /></label>
          <label>Ceritakan hambatannya<textarea rows={3} value={f.hambatan} onChange={e => setF({ ...f, hambatan: e.target.value })} maxLength={2000} required /></label>
          <label>Komitmen minggu depan (opsional)<textarea rows={2} value={f.komitmen} onChange={e => setF({ ...f, komitmen: e.target.value })} maxLength={2000} /></label>
          <div className="redup kecil">Tingkat 4–5 otomatis ditandai "perlu dukungan" untuk koordinatormu. Bisa diubah sampai Minggu.</div>
          <div className="modal-aksi">{edit && <button type="button" className="btn" onClick={() => setEdit(false)}>Batal</button>}<button className="btn utama">Simpan</button></div>
        </form>
      ) : (<div>
        <div className="redup kecil" style={{ marginBottom: 6 }}>Refleksi minggu ini sudah terkirim.</div>
        <Kartu r={ini} userId={null} onHapus={() => {}} />
        {ini.bisaDiubah && <button className="btn" onClick={mulaiEdit}>Ubah</button>}
      </div>)}
      {d.riwayat.length > 0 && <h3 className="judul-bagian" style={{ marginTop: 14 }}>Riwayat</h3>}
      {d.riwayat.map(r => <Kartu key={r.id} r={r} userId={null} onHapus={() => {}} />)}
    </div>
  )
}

function Tim({ studioId, userId }) {
  const [t, setT] = useState(null), [org, setOrg] = useState(null), [galat, setGalat] = useState('')
  const muat = useCallback(() => api(`${A}/tim?studioId=${studioId}`).then(setT).catch(e => setGalat(e.message)), [studioId])
  const buka = useCallback((id) => api(`${A}/orang/${id}`).then(x => setOrg({ ...x, userId: id })).catch(e => setGalat(e.message)), [])
  useEffect(() => { muat() }, [muat])
  if (!t) return <div className="redup">{galat || 'Memuat…'}</div>
  const komentar = (id, isi) => aksi(() => api(`${A}/${id}/komentar`, { method: 'POST', body: { isi } }), setGalat, () => org && buka(org.userId))
  const hapus = (id) => aksi(() => api(`${A}/komentar/${id}`, { method: 'DELETE' }), setGalat, () => org && buka(org.userId))
  return (
    <div>
      {galat && <div className="galat">{galat}</div>}
      <div className="panel"><h3 className="judul-bagian">Minggu ini · {t.sudah}/{t.total} sudah mengisi{t.perluDukungan > 0 ? ` · ${t.perluDukungan} perlu dukungan` : ''}</h3>
        {t.orang.map(o => <div key={o.userId} className="meta" style={{ marginBottom: 4 }}><button className="btn kecil" onClick={() => buka(o.userId)}>{o.nama}</button>
          <span className={o.sudahMingguIni ? '' : 'redup'}>{o.sudahMingguIni ? 'sudah' : 'belum'}</span>{o.perluDukungan && <span className="lencana revisi">perlu dukungan</span>}{o.terakhir && <span className="redup kecil">terakhir: {o.terakhir.kategori} ({o.terakhir.tingkat}/5)</span>}</div>)}
      </div>
      {t.kategoriTerbanyak.length > 0 && <div className="panel"><h3 className="judul-bagian">Hambatan terbanyak ({t.cakupan})</h3>{t.kategoriTerbanyak.map(k => <div key={k.kategori} className="meta">{k.kategori}<span className="lencana">{k.jumlah}×</span><span className="redup kecil">rata-rata {k.rataTingkat}/5</span></div>)}</div>}
      {org && <div><h3 className="judul-bagian">{org.nama}</h3>{org.refleksi.length === 0 && <div className="redup">Belum ada refleksi.</div>}{org.refleksi.map(r => <Kartu key={r.id} r={r} bolehKomentar userId={userId} onKomentar={komentar} onHapus={hapus} />)}</div>}
    </div>
  )
}

export default function Refleksi({ studioId, manajer, userId }) {
  const [sub, setSub] = useState('saya')
  return (
    <div>
      {manajer && <div className="tab-mini"><button className={sub === 'saya' ? 'aktif' : ''} onClick={() => setSub('saya')}>Refleksiku</button><button className={sub === 'tim' ? 'aktif' : ''} onClick={() => setSub('tim')}>Tim</button></div>}
      {sub === 'saya' ? <Saya /> : <Tim studioId={studioId} userId={userId} />}
    </div>
  )
}
