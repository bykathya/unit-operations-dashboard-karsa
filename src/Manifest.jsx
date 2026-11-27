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
    <div>
      <div className="toolbar"><span className="chip">{namaStudio} · {NAMA_BULAN[d.bulan - 1]} {d.tahun}</span>{punya ? <span className="lencana bayar-lunas">Terkirim ✓</span> : <span className="lencana bayar-belum_lunas">Belum menulis</span>}</div>
      <p className="redup">Tuliskan doa baik, rasa syukur, dan harapanmu bulan ini. Bisa diubah sampai <b>{tglPanjang(d.batas)}</b>, setelah itu terkunci.</p>
      {galat && <div className="galat">{galat}</div>}
      <div className="panel">
        <div className="mf-orang"><Stiker nama={namaSaya} ukuran={40} /><b>Manifestasiku{namaSaya ? ` · ${namaSaya}` : ""}</b>{punya && !ubah && <button className="btn kecil" style={{ marginLeft: 'auto' }} onClick={() => setUbah(true)}>Ubah</button>}</div>
        {punya && !ubah ? <p style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{punya}</p> : (
          <form onSubmit={kirim}>
            <textarea value={teks} onChange={e => setTeks(e.target.value)} required maxLength={3000} rows={6} style={{ width: '100%', marginTop: 8 }} placeholder="Alhamdulillah… Aku yakin dan percaya bulan ini…" />
            <div className="modal-aksi" style={{ justifyContent: 'flex-start' }}><button className="btn utama" disabled={sibuk}>{sibuk ? 'Menyimpan…' : 'Kirim'}</button>{punya && <button type="button" className="btn" onClick={() => { setUbah(false); setTeks(punya) }}>Batal</button>}</div>
          </form>
        )}
      </div>
      <h3 className="judul-bagian" style={{ marginTop: 18 }}>Manifestasi tim {namaStudio} <span className="chip">{d.sudah}/{d.jumlahTim}</span></h3>
      <div className="mf-grid">
        {d.tim.length === 0 && <div className="redup">Belum ada anggota lain di studio ini.</div>}
        {d.tim.map(t => (
          <div key={t.id} className={`panel mf-kartu${t.isi ? '' : ' mf-kosong'}`}>
            <div className="mf-orang"><Stiker nama={t.nama} ukuran={36} /><b>{t.nama}</b></div>
            {t.isi ? <p style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{t.isi}</p> : <p className="redup" style={{ margin: '8px 0 0' }}>Belum menulis.</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
