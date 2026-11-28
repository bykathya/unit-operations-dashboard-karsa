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
  const judulKat = KATEGORI.find(k => k[0] === kat)?.[1]
  return (
    <div className="kd">
      <div className="baris" style={{ marginBottom: 8 }}><span className="chip">{d.daftar.length} panduan</span></div>
      <p className="sub" style={{ marginTop: 0 }}>Panduan kerja khusus studio <b>{d.studio}</b>. Koordinator yang menulis dan mengubah; semua anggota studio bisa membaca. Studio lain punya SOP sendiri.</p>
      {galat && <div className="galat">{galat}</div>}
      <div className="baris" style={{ marginBottom: 16 }}>
        <input className="kd-cari-isi" placeholder="Cari SOP, VGen, NDA, QC…" value={cari} onChange={e => setCari(e.target.value)} aria-label="Cari panduan" />
        {d.bolehUbah ? !form && <button type="button" className="tombol hitam" onClick={() => setForm({ kategori: kat, judul: '', tag: '', ket: '', poin: '' })}>+ Tambah Panduan</button>
          : <span className="chip">Lihat saja · hanya Koordinator yang bisa mengubah</span>}
      </div>
      <div className="sop-kat">
        {KATEGORI.map(([k, j, ket]) => (
          <button key={k} type="button" className={kat === k ? 'on' : ''} onClick={() => setKat(k)}>
            <span className="baris" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'flex-start' }}><b>{j}</b><span className="jml">{d.daftar.filter(p => p.kategori === k).length}</span></span>
            <small>{ket}</small>
          </button>
        ))}
      </div>
      {form && (
        <form className="kartu" style={{ padding: 22, marginTop: 16 }} onSubmit={simpan}>
          <h3 style={{ margin: '0 0 12px' }}>{form.id ? 'Ubah panduan' : 'Panduan baru'}</h3>
          <div className="dua">
            <label>Bagian<select value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })}>{KATEGORI.map(([k, j]) => <option key={k} value={k}>{j}</option>)}</select></label>
            <label>Label singkat<input value={form.tag ?? ''} onChange={e => setForm({ ...form, tag: e.target.value })} maxLength={40} placeholder="mis. Chat klien" /></label>
          </div>
          <label>Judul<input value={form.judul} onChange={e => setForm({ ...form, judul: e.target.value })} required maxLength={160} placeholder="mis. Alur membalas chat klien" /></label>
          <label>Penjelasan singkat<input value={form.ket ?? ''} onChange={e => setForm({ ...form, ket: e.target.value })} maxLength={500} /></label>
          <label>Poin-poin (satu baris = satu poin)<textarea rows={6} value={form.poin ?? ''} onChange={e => setForm({ ...form, poin: e.target.value })} maxLength={8000} placeholder={'Balas chat klien baru paling lambat 15 menit di jam kerja.\nKonfirmasi brief, referensi, deadline, dan aturan revisi sebelum klien bayar.'} /></label>
          <div className="modal-aksi"><button type="button" className="tombol k" onClick={() => setForm(null)}>Batal</button><button className="tombol k p">Simpan</button></div>
        </form>
      )}
      <h2 style={{ margin: '20px 0 4px', fontSize: 24 }}>{judulKat}</h2>
      <p style={{ margin: '0 0 14px', color: 'var(--text-secondary)' }}>{d.studio}</p>
      {tampil.length === 0 ? (
        <div className="kartu" style={{ padding: 32, textAlign: 'center' }}><b>{d.daftar.some(p => p.kategori === kat) ? 'Tidak ada panduan yang cocok.' : 'Belum ada panduan di bagian ini.'}</b>{d.bolehUbah && !d.daftar.some(p => p.kategori === kat) && <p className="kosong" style={{ margin: '6px 0 0' }}>Klik "+ Tambah Panduan" untuk menulis SOP studio ini.</p>}</div>
      ) : tampil.map((p, i) => (
        <div key={p.id} className="kartu sop-item">
          <button type="button" onClick={() => setBuka({ ...buka, [p.id]: !buka[p.id] })} aria-expanded={!!buka[p.id]}>
            <span className="no">{i + 1}</span>
            <span style={{ flex: 1 }}><b>{p.judul}</b>{p.tag && <span className="chip" style={{ marginLeft: 8, fontSize: 12, padding: '1px 10px' }}>{p.tag}</span>}{p.ket && <small className="arti">{p.ket}</small>}</span>
            <span aria-hidden>{buka[p.id] ? '▾' : '▸'}</span>
          </button>
          {buka[p.id] && (
            <>
              {p.poin && <ul>{p.poin.split('\n').filter(x => x.trim()).map((x, j) => <li key={j}>{x.replace(/^[-•*]\s*/, '')}</li>)}</ul>}
              <div className="baris" style={{ padding: '0 20px 16px' }}><small className="arti" style={{ margin: 0 }}>Terakhir diubah {p.olehNama ?? ''} · {new Date(p.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
                {d.bolehUbah && <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}><button type="button" className="tombol k" onClick={() => setForm({ ...p })}>Ubah</button><button type="button" className="tombol k" onClick={() => hapus(p)}>Hapus</button></span>}</div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
