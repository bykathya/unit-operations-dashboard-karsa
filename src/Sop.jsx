import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

// SOP & ATURAN STUDIO (Karsa Circle, 27 Nov 2026): panduan kerja khusus studio ini. Koordinator menulis dan mengubah;
// semua anggota studio membaca. Studio lain punya SOP sendiri. Web pusat hanya melihat.
export const KATEGORI = [
  ['ADMIN', 'SOP Kerja Admin & Koordinator', 'Alur chat klien, serah terima shift, jadwal laporan harian/mingguan'],
  ['AKUN', 'SOP Menjalankan Akun', 'Cara menjalankan VGen, Ko-fi, Artistree, dan keamanan akun'],
  ['ATURAN', "Aturan Studio (Do's & Don'ts)", 'Kedisiplinan, kualitas QC, kerahasiaan NDA, tata tertib'],
]

export default function Sop({ studioId }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [kat, setKat] = useState('ADMIN'), [cari, setCari] = useState(''), [form, setForm] = useState(null), [buka, setBuka] = useState({})
  const muat = useCallback(() => api(`/api/circle/sop?studioId=${studioId}`).then(setD).catch(e => setGalat(e.message)), [studioId])
  useEffect(() => { muat() }, [muat])
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  const tampil = d.daftar.filter(p => p.kategori === kat && (!cari || `${p.judul} ${p.ket ?? ''} ${p.poin ?? ''} ${p.tag ?? ''}`.toLowerCase().includes(cari.toLowerCase())))
  const simpan = async (e) => {
    e.preventDefault(); setGalat('')
    try { if (form.id) await api(`/api/circle/sop/${form.id}`, { method: 'PUT', body: form }); else await api('/api/circle/sop', { method: 'POST', body: { ...form, studioId } }); setKat(form.kategori); setForm(null); await muat() } catch (er) { setGalat(er.message) }
  }
  const hapus = async (p) => { if (!window.confirm(`Hapus panduan "${p.judul}"?`)) return; try { await api(`/api/circle/sop/${p.id}`, { method: 'DELETE' }); await muat() } catch (er) { setGalat(er.message) } }
  return (
    <div>
      <p className="redup" style={{ marginTop: -6 }}>Panduan kerja khusus studio <b>{d.studio}</b>. Koordinator yang menulis dan mengubah; semua anggota studio bisa membaca.</p>
      {galat && <div className="galat">{galat}</div>}
      <div className="toolbar">
        <input className="cari" placeholder="Cari SOP, VGen, NDA, QC…" value={cari} onChange={e => setCari(e.target.value)} aria-label="Cari panduan" style={{ flex: '1 1 220px' }} />
        {d.bolehUbah ? !form && <button className="btn utama" onClick={() => setForm({ kategori: kat, judul: '', tag: '', ket: '', poin: '' })}>+ Tambah panduan</button>
          : <span className="chip sub">Lihat saja · hanya Koordinator yang bisa mengubah</span>}
      </div>
      <div className="sop-kat">
        {KATEGORI.map(([k, j, ket]) => (
          <button key={k} type="button" className={kat === k ? 'aktif' : ''} onClick={() => setKat(k)}>
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{j}</b><span className="chip">{d.daftar.filter(p => p.kategori === k).length}</span></span>
            <small className="redup">{ket}</small>
          </button>
        ))}
      </div>
      {form && (
        <form className="panel" onSubmit={simpan}>
          <h3 className="judul-bagian">{form.id ? 'Ubah panduan' : 'Panduan baru'}</h3>
          <div className="dua">
            <label>Bagian<select value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })}>{KATEGORI.map(([k, j]) => <option key={k} value={k}>{j}</option>)}</select></label>
            <label>Label singkat<input value={form.tag ?? ''} onChange={e => setForm({ ...form, tag: e.target.value })} maxLength={40} placeholder="mis. Chat klien" /></label>
          </div>
          <label>Judul<input value={form.judul} onChange={e => setForm({ ...form, judul: e.target.value })} required maxLength={160} placeholder="mis. Alur membalas chat klien" /></label>
          <label>Penjelasan singkat<input value={form.ket ?? ''} onChange={e => setForm({ ...form, ket: e.target.value })} maxLength={500} /></label>
          <label>Poin-poin (satu baris = satu poin)<textarea rows={6} value={form.poin ?? ''} onChange={e => setForm({ ...form, poin: e.target.value })} maxLength={8000} placeholder={'Balas chat klien baru paling lambat 15 menit di jam kerja.\nKonfirmasi brief, referensi, deadline, dan aturan revisi sebelum klien bayar.'} /></label>
          <div className="modal-aksi"><button type="button" className="btn" onClick={() => setForm(null)}>Batal</button><button className="btn utama">Simpan</button></div>
        </form>
      )}
      {tampil.length === 0 ? <div className="kosong">{d.daftar.some(p => p.kategori === kat) ? 'Tidak ada panduan yang cocok.' : `Belum ada panduan di bagian ini.${d.bolehUbah ? ' Klik "+ Tambah panduan".' : ''}`}</div> : tampil.map((p, i) => (
        <div key={p.id} className="panel">
          <button type="button" className="sop-judul" onClick={() => setBuka({ ...buka, [p.id]: !buka[p.id] })} aria-expanded={!!buka[p.id]}>
            <span><b>{i + 1}. {p.judul}</b>{p.tag && <span className="chip sub" style={{ marginLeft: 6 }}>{p.tag}</span>}{p.ket && <div className="redup kecil">{p.ket}</div>}</span><span>{buka[p.id] ? '▾' : '▸'}</span>
          </button>
          {buka[p.id] && (
            <>
              {p.poin && <ul style={{ margin: '10px 0 0', paddingLeft: 20, lineHeight: 1.6 }}>{p.poin.split('\n').filter(x => x.trim()).map((x, j) => <li key={j}>{x.replace(/^[-•*]\s*/, '')}</li>)}</ul>}
              <div className="meta" style={{ marginTop: 10 }}><span className="redup kecil">Terakhir diubah {p.olehNama ?? ''} · {new Date(p.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {d.bolehUbah && <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}><button className="btn kecil" onClick={() => setForm({ ...p })}>Ubah</button><button className="btn kecil" onClick={() => hapus(p)}>Hapus</button></span>}</div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
