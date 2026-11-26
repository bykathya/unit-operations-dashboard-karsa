import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

// KOLOM KHUSUS ORDER (12 Nov 2026, masukan tim): kebutuhan khusus tiap project yang dirancang studio sendiri,
// mis. "Boleh pakai AI?" (Ya/Tidak). Diatur di menu Alur, diisi di detail order, tampil sebagai label di kartu & antrean talent.

/** Label di kartu / antrean: [{nama, nilai, nada}] — Ya hijau, Tidak merah, lainnya netral. */
export function LabelKhusus({ daftar }) {
  if (!daftar?.length) return null
  return <>{daftar.map(x => <span key={x.nama} className={'chip khusus' + (x.nada ? ' ' + x.nada : '')} title={`${x.nama}: ${x.nilai}`}>{x.nama}: {x.nilai}</span>)}</>
}

/** Isian di detail order — tersimpan langsung saat diubah. */
export function IsianKhusus({ d, muat, setGalat }) {
  const [teks, setTeks] = useState({})
  if (!d.khusus?.length) return null
  const simpan = async (id, v) => { setGalat(''); try { await api(`/api/circle/orders/${d.id}/isian-khusus`, { method: 'PATCH', body: { [id]: v } }); muat() } catch (e) { setGalat(e.message) } }
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <h4 className="judul-bagian">Kebutuhan khusus project</h4>
      <div className="dua">{d.khusus.map(k => <label key={k.id}>{k.nama}
        {!d.bisaIsiKhusus ? <b>{Array.isArray(k.nilai) ? k.nilai.join(', ') : k.nilai ?? '—'}</b>
          : k.tipe === 'PILIHAN_BANYAK' ? <span className="chips" style={{ margin: 0 }}>{[...k.pilihan, ...(k.nilai ?? []).filter(x => !k.pilihan.includes(x))].map(p => { const pilih = (k.nilai ?? []).includes(p); return <button key={p} type="button" className={'pilih kecil' + (pilih ? ' aktif' : '')} title={k.pilihan.includes(p) ? '' : 'Pilihan lama (sudah tidak ada di daftar)'} onClick={() => simpan(k.id, pilih ? (k.nilai ?? []).filter(x => x !== p && k.pilihan.includes(x)) : [...(k.nilai ?? []).filter(x => k.pilihan.includes(x)), p])}>{pilih ? '✓ ' : ''}{p}</button> })}</span>
          : k.tipe === 'TEKS' ? <span className="chips" style={{ margin: 0 }}><input value={teks[k.id] ?? k.nilai ?? ''} onChange={e => setTeks({ ...teks, [k.id]: e.target.value })} maxLength={300} /><button type="button" className="btn kecil" disabled={(teks[k.id] ?? k.nilai ?? '') === (k.nilai ?? '')} onClick={() => simpan(k.id, teks[k.id] ?? '')}>Simpan</button></span>
          : <select value={k.nilai ?? ''} onChange={e => simpan(k.id, e.target.value)}><option value="">— belum diisi —</option>{(k.tipe === 'YA_TIDAK' ? ['Ya', 'Tidak'] : k.pilihan).map(p => <option key={p} value={p}>{p}</option>)}</select>}
      </label>)}</div>
    </div>
  )
}

/** Pengaturan kolom khusus (menu Alur). */
export function AturKolomKhusus({ studioId }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [f, setF] = useState({ nama: '', tipe: 'YA_TIDAK', pilihan: '', diKartu: true })
  const [ubah, setUbah] = useState(null) // { id, nama, tipe, pilihan } — Ubah kolom (16 Nov 2026, masukan tim; tetap hanya Koordinator)
  const berPilihan = (t) => t === 'PILIHAN' || t === 'PILIHAN_BANYAK'
  const muat = useCallback(() => api(`/api/circle/kolom-khusus?studioId=${studioId}`).then(setD).catch(e => setGalat(e.message)), [studioId])
  useEffect(() => { muat() }, [muat])
  const jalan = async (fn) => { setGalat(''); try { await fn(); await muat() } catch (e) { setGalat(e.message) } }
  if (!d) return galat ? <div className="galat blok">{galat}</div> : null
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h3 className="judul-bagian">Kolom khusus order</h3>
      <div className="redup kecil" style={{ marginBottom: 8 }}>Kebutuhan khusus tiap project yang ingin dicatat di setiap order, mis. <b>Boleh pakai AI?</b> (Ya/Tidak), <b>Gaya</b> (pilihan), <b>Catatan klien</b> (teks). Diisi di detail order. Yang dicentang "tampil di kartu" muncul sebagai label di kartu papan & antrean talent.</div>
      {galat && <div className="galat blok">{galat}</div>}
      {d.kolom.length === 0 ? <div className="kosong">Belum ada kolom khusus. Tambahkan lewat isian di bawah, lalu klik <b>+ Kolom</b>.</div> : <table><tbody>{d.kolom.map(k => ubah?.id === k.id ? <tr key={k.id}>
        <td><input value={ubah.nama} maxLength={60} onChange={e => setUbah({ ...ubah, nama: e.target.value })} /></td>
        <td><select style={{ width: 'auto' }} value={ubah.tipe} onChange={e => setUbah({ ...ubah, tipe: e.target.value })}>{Object.entries(d.tipe).map(([t, l]) => <option key={t} value={t}>{l}</option>)}</select>
          {berPilihan(ubah.tipe) && <input style={{ marginTop: 4 }} placeholder="Pilihan, pisahkan koma" value={ubah.pilihan} onChange={e => setUbah({ ...ubah, pilihan: e.target.value })} />}
          <div className="redup kecil">Isian yang sudah terisi di order tidak ikut berubah.</div></td>
        <td colSpan={2} className="kanan"><button className="btn kecil utama" onClick={() => jalan(async () => { await api(`/api/circle/kolom-khusus/${k.id}`, { method: 'PATCH', body: { nama: ubah.nama, tipe: ubah.tipe, ...(berPilihan(ubah.tipe) ? { pilihan: ubah.pilihan } : {}) } }); setUbah(null) })}>Simpan</button> <button className="btn kecil" onClick={() => setUbah(null)}>Batal</button></td>
      </tr> : <tr key={k.id}>
        <td><b>{k.nama}</b></td><td className="redup kecil">{d.tipe[k.tipe] ?? k.tipe}{berPilihan(k.tipe) ? `: ${k.pilihan.join(', ')}` : ''}</td>
        <td>{d.bisaAtur ? <label style={{ flexDirection: 'row', alignItems: 'center', gap: 4, margin: 0 }} className="kecil"><input type="checkbox" style={{ width: 'auto' }} checked={k.diKartu} onChange={e => jalan(() => api(`/api/circle/kolom-khusus/${k.id}`, { method: 'PATCH', body: { diKartu: e.target.checked } }))} /> tampil di kartu</label> : <span className="redup kecil">{k.diKartu ? 'tampil di kartu' : ''}</span>}</td>
        <td className="kanan">{d.bisaAtur && <button className="btn kecil" onClick={() => setUbah({ id: k.id, nama: k.nama, tipe: k.tipe, pilihan: k.pilihan.join(', ') })}>Ubah</button>}{' '}{d.bisaAtur && <button className="btn kecil" onClick={() => confirm(`Hapus kolom "${k.nama}"?`) && jalan(() => api(`/api/circle/kolom-khusus/${k.id}`, { method: 'DELETE' }))}>Hapus</button>}</td></tr>)}</tbody></table>}
      {d.bisaAtur && <form className="toolbar" style={{ marginTop: 8 }} onSubmit={e => { e.preventDefault(); jalan(async () => { await api('/api/circle/kolom-khusus', { method: 'POST', body: { studioId, nama: f.nama, tipe: f.tipe, pilihan: berPilihan(f.tipe) ? f.pilihan : undefined, diKartu: f.diKartu } }); setF({ nama: '', tipe: 'YA_TIDAK', pilihan: '', diKartu: true }) }) }}>
        <input style={{ width: 200 }} placeholder="Nama kolom (mis. Boleh pakai AI?)" value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} maxLength={60} required />
        <select style={{ width: 'auto' }} value={f.tipe} onChange={e => setF({ ...f, tipe: e.target.value })}>{Object.entries(d.tipe).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {berPilihan(f.tipe) && <input style={{ width: 220 }} placeholder="Pilihan, pisahkan koma (mis. Chibi, Realis)" value={f.pilihan} onChange={e => setF({ ...f, pilihan: e.target.value })} required />}
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 4, margin: 0 }} className="kecil"><input type="checkbox" style={{ width: 'auto' }} checked={f.diKartu} onChange={e => setF({ ...f, diKartu: e.target.checked })} /> tampil di kartu</label>
        <button className="btn kecil utama">+ Kolom</button>
      </form>}
    </div>
  )
}
