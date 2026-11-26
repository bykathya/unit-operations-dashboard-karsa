import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

// Akun jualan studio (Koordinator ke atas): platform + nama akun + fee. Muncul di dropdown "Masuk lewat akun"
// (prospek & order) dan bisa ditugaskan ke marketer di tab Marketing. Data sama dengan modul Produksi Ekosistem.
export default function Akun({ studioId }) {
  const [d, setD] = useState(null)
  const [f, setF] = useState({ platform: 'Fiverr', namaAkun: '', feePersen: 0 })
  const [edit, setEdit] = useState(null)
  const [galat, setGalat] = useState('')
  const muat = useCallback(() => api(`/api/circle/akun-jualan?studioId=${studioId}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId])
  useEffect(() => { setD(null); muat() }, [muat])

  async function tambah(e) {
    e.preventDefault(); setGalat('')
    try { await api('/api/circle/akun-jualan', { method: 'POST', body: { studioId, ...f } }); setF({ ...f, namaAkun: '' }); muat() } catch (er) { setGalat(er.message) }
  }
  async function simpanEdit() {
    setGalat('')
    try { await api('/api/circle/akun-jualan/' + edit.id, { method: 'PATCH', body: { platform: edit.platform, namaAkun: edit.namaAkun, feePersen: edit.feePersen } }); setEdit(null); muat() } catch (er) { setGalat(er.message) }
  }
  async function hapus(a) {
    if (!confirm(`Hapus akun ${a.namaAkun} (${a.platform})?`)) return
    try { await api('/api/circle/akun-jualan/' + a.id, { method: 'DELETE' }); muat() } catch (er) { setGalat(er.message) }
  }
  if (!d) return galat ? <div className="galat blok">{galat}</div> : <div className="redup">Memuat…</div>
  return (
    <div>
      {/* 18 Nov 2026 (keputusan user): Admin Market boleh MENGUBAH akun yang ia pegang; menambah & menghapus akun tetap Koordinator */}
      <p className="redup">{d.bisaTambah ? 'Tulis akun jualan studio ini persis seperti di platform (mis. nama toko Etsy, username Fiverr). Potongan platform bawaan 0%; isi hanya bila platform itu memotong bayaran (mis. Fiverr 20%).' : d.bisaUbah ? 'Akun jualan yang kamu pegang. Kamu bisa mengubah nama & potongan platform; menambah atau menghapus akun diatur Koordinator unit.' : 'Daftar akun jualan unit ini (lihat saja).'}</p>
      {galat && <div className="galat blok">{galat}</div>}
      {d.bisaTambah && <div className="panel" style={{ marginBottom: 16 }}>
        <form onSubmit={tambah}>
          <div className="dua">
            <label>Platform<select value={f.platform} onChange={e => setF({ ...f, platform: e.target.value })}>{d.platform.map(p => <option key={p}>{p}</option>)}</select></label>
            <label>Nama akun<input value={f.namaAkun} onChange={e => setF({ ...f, namaAkun: e.target.value })} required maxLength={80} /></label>
            <label>Potongan platform (%)<input type="number" min="0" max="100" step="0.1" value={f.feePersen} onChange={e => setF({ ...f, feePersen: e.target.value })} /></label>
          </div>
          <button className="btn utama">+ Tambah akun</button>
        </form>
      </div>}
      {d.akun.length === 0 ? <div className="kosong">Belum ada akun jualan. Tambahkan di atas.</div> : (
        <table>
          <thead><tr><th>Platform</th><th>Nama akun</th><th className="kanan">Potongan</th><th /></tr></thead>
          <tbody>{d.akun.map(a => edit?.id === a.id ? (
            <tr key={a.id}>
              <td><select value={edit.platform} onChange={e => setEdit({ ...edit, platform: e.target.value })}>{d.platform.map(p => <option key={p}>{p}</option>)}</select></td>
              <td><input value={edit.namaAkun} onChange={e => setEdit({ ...edit, namaAkun: e.target.value })} /></td>
              <td><input type="number" min="0" max="100" step="0.1" value={edit.feePersen} onChange={e => setEdit({ ...edit, feePersen: e.target.value })} /></td>
              <td className="kanan"><button className="btn kecil utama" onClick={simpanEdit}>Simpan</button> <button className="btn kecil" onClick={() => setEdit(null)}>Batal</button></td>
            </tr>
          ) : (
            <tr key={a.id}><td>{a.platform}</td><td><b>{a.namaAkun}</b></td><td className="kanan">{a.feePersen}%</td>
              <td className="kanan">{d.bisaUbah && <button className="btn kecil" onClick={() => setEdit({ ...a })}>Ubah</button>} {d.bisaTambah && <button className="btn kecil" onClick={() => hapus(a)}>Hapus</button>}</td></tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}
