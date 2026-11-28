import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { NAMA_BULAN } from './api-util'
import Stiker from './Stiker'

// MANIFEST (Karsa Circle, 27 Nov 2026): tiap anggota menulis doa baik, rasa syukur, dan harapannya untuk bulan ini.
// Bisa diubah selama bulan berjalan; mulai tanggal 1 bulan berikutnya terkunci. Teman satu studio saling membaca.
const tglPanjang = (t) => new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

export default function Manifest({ studioId, namaStudio, namaSaya }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [ubah, setUbah] = useState(false), [teks, setTeks] = useState(''), [sibuk, setSibuk] = useState(false)
  const muat = useCallback(() => api(`/api/circle/manifest?studioId=${studioId}`).then(x => { setD(x); setTeks(x.saya.isi ?? '') }).catch(e => setGalat(e.message)), [studioId])
  useEffect(() => { muat() }, [muat])
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  const punya = d.saya.isi
  const kirim = async (e) => {
    e.preventDefault(); if (!teks.trim()) return
    setSibuk(true); setGalat('')
    try { await api('/api/circle/manifest', { method: 'PUT', body: { isi: teks } }); setUbah(false); await muat() } catch (er) { setGalat(er.message) } finally { setSibuk(false) }
  }
  return (
    <div className="kd">
      <div className="baris" style={{ marginBottom: 8 }}><span className="chip">{namaStudio} · {NAMA_BULAN[d.bulan - 1]} {d.tahun}</span><span className={`pill ${punya ? 'aman' : 'bahaya'}`}>{punya ? 'Terkirim ✓' : 'Belum menulis'}</span></div>
      <p className="sub" style={{ marginTop: 0 }}>Tuliskan doa baik, rasa syukur, dan harapanmu bulan ini. Bisa diubah sampai <b>{tglPanjang(d.batas)}</b>, setelah itu terkunci.</p>
      {galat && <div className="galat">{galat}</div>}
      <div className="kartu" style={{ padding: 22 }}>
        <div className="orang"><Stiker nama={namaSaya} ukuran={40} foto={d.saya.foto} /><b>Manifestasiku{namaSaya ? ` · ${namaSaya}` : ''}</b>{punya && !ubah && <button type="button" className="tombol k" style={{ marginLeft: 'auto' }} onClick={() => setUbah(true)}>Ubah</button>}</div>
        {punya && !ubah ? <p style={{ whiteSpace: 'pre-wrap', margin: '12px 0 0', lineHeight: 1.6 }}>{punya}</p> : (
          <form onSubmit={kirim}>
            <textarea className="mf-tulis" value={teks} onChange={e => setTeks(e.target.value)} required maxLength={3000} rows={7} placeholder="Alhamdulillah… Aku yakin dan percaya bulan ini…" />
            <div className="baris" style={{ marginTop: 12 }}><button className="tombol p" disabled={sibuk}>{sibuk ? 'Menyimpan…' : 'Kirim'}</button>{punya && <button type="button" className="tombol" onClick={() => { setUbah(false); setTeks(punya) }}>Batal</button>}</div>
          </form>
        )}
      </div>
      <h2 style={{ margin: '24px 0 12px', fontSize: 22, display: 'flex', alignItems: 'center', gap: 10 }}>Manifestasi tim {namaStudio} <span className="chip">{d.sudah}/{d.jumlahTim}</span></h2>
      <div className="mf-isi">
        {d.tim.length === 0 && <p className="kosong">Belum ada anggota lain di studio ini.</p>}
        {d.tim.map(t => (
          <div key={t.id} className={t.isi ? 'ada' : ''}>
            <div className="orang"><Stiker nama={t.nama} ukuran={36} foto={t.foto} /><b>{t.nama}</b></div>
            <p className={t.isi ? '' : 'kosong'}>{t.isi ?? 'Belum menulis.'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
