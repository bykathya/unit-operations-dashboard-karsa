import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import Stiker from './Stiker'

// TIM (Karsa Circle, tahap 6, 26 Nov 2026): kartu poster tiap anggota studio; klik untuk bio. Tanpa angka uang.
// Isi bio diisi sendiri di Profil saya. Tautan NDA hanya dikirim server ke orangnya sendiri & Koordinator unit (yang juga bisa mengubahnya).
const STATUS = { JOMBLO: 'Jomblo', TAKEN: 'Taken', RAHASIA: 'Rahasia 🤫' }

function Foto({ a, besar }) {
  const ukuran = besar ? 160 : 120
  return a.fotoUrl
    ? <img src={a.fotoUrl} alt={`Foto ${a.nama}`} referrerPolicy="no-referrer" style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', display: 'block', borderBottom: '1.5px solid var(--line)' }} />
    : <div style={{ aspectRatio: '3 / 4', display: 'grid', placeItems: 'center', background: 'var(--pink-candy)', borderBottom: '1.5px solid var(--line)' }}><Stiker nama={a.nama} ukuran={ukuran} alt="" /></div>
}

function Bio({ a, studioId, onTutup, onSimpan }) {
  const [nda, setNda] = useState(null), [galat, setGalat] = useState('')
  useEffect(() => { const k = (e) => e.key === 'Escape' && onTutup(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onTutup])
  const isian = [['Keahlian', a.keahlian], ['Zodiak', a.zodiak], ['Ulang tahun', a.ulangTahun ? new Date(`2000-${a.ulangTahun.slice(3)}-${a.ulangTahun.slice(0, 2)}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' }) : null], ['Paling aktif', a.jamAktif], ['Status', STATUS[a.status]]].filter(([, v]) => v)
  const simpanNda = async (e) => { e.preventDefault(); setGalat(''); try { await api(`/api/circle/tim-kartu/${a.userId}/nda`, { method: 'PUT', body: { studioId, ndaUrl: nda } }); setNda(null); onSimpan() } catch (er) { setGalat(er.message) } }
  return (
    <div className="modal-latar" onClick={e => e.target === e.currentTarget && onTutup()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="bio-judul" style={{ maxWidth: 520, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 40%) 1fr' }}>
          <Foto a={a} besar />
          <div style={{ padding: 18, display: 'grid', gap: 6, alignContent: 'start' }}>
            <div className="redup kecil">{a.peran}</div>
            <h2 id="bio-judul" style={{ margin: 0 }}>{a.nama}</h2>
            {a.bio && <p style={{ margin: '4px 0 0' }}>{a.bio}</p>}
          </div>
        </div>
        <div style={{ padding: 18, display: 'grid', gap: 8 }}>
          {isian.length === 0 && !a.instagram && <div className="redup">{a.saya ? 'Kamu belum mengisi profil. Isi di menu Profil saya.' : 'Belum mengisi profil.'}</div>}
          {isian.map(([l, v]) => <div key={l} className="meta" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}><span className="redup">{l}</span><b>{v}</b></div>)}
          {a.instagram && <div className="meta" style={{ justifyContent: 'space-between' }}><span className="redup">Instagram</span><a href={`https://instagram.com/${a.instagram}`} target="_blank" rel="noopener noreferrer"><b>@{a.instagram}</b></a></div>}
          {'ndaUrl' in a && (
            <div className="panel" style={{ marginTop: 6, background: 'var(--accent-subtle)' }}>
              <div className="meta" style={{ justifyContent: 'space-between' }}><b>NDA</b><span className="redup kecil">hanya terlihat oleh {a.saya ? 'kamu' : a.nama.split(' ')[0]} dan koordinator</span></div>
              {nda == null ? <div className="meta" style={{ marginTop: 6 }}>
                {a.ndaUrl ? <a className="btn kecil" href={a.ndaUrl} target="_blank" rel="noopener noreferrer">Buka NDA (Google Drive)</a> : <span className="redup">Belum ada tautan NDA.</span>}
                {a.ndaBisaUbah && <button className="btn kecil" onClick={() => setNda(a.ndaUrl ?? '')}>{a.ndaUrl ? 'Ubah tautan' : 'Isi tautan'}</button>}
              </div> : <form className="meta" style={{ marginTop: 6 }} onSubmit={simpanNda}>
                <input type="url" value={nda} onChange={e => setNda(e.target.value)} placeholder="https://drive.google.com/…" style={{ flex: 1, minWidth: 180 }} aria-label="Tautan NDA" />
                <button className="btn kecil utama">Simpan</button><button type="button" className="btn kecil" onClick={() => setNda(null)}>Batal</button>
              </form>}
              {galat && <div className="galat">{galat}</div>}
            </div>
          )}
          <div className="modal-aksi"><button className="btn" onClick={onTutup} autoFocus>Tutup</button></div>
        </div>
      </div>
    </div>
  )
}

export default function TimKartu({ studioId }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [buka, setBuka] = useState(null)
  const muat = useCallback(() => api(`/api/circle/tim-kartu?studioId=${studioId}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId])
  useEffect(() => { setD(null); muat() }, [muat])
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  const a = buka && d.anggota.find(x => x.userId === buka)
  return (
    <div>
      <p className="redup" style={{ marginTop: 0 }}>Klik kartu untuk melihat bionya. Bio diisi sendiri di menu Profil saya.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14 }}>
        {d.anggota.map(x => (
          <button key={x.userId} onClick={() => setBuka(x.userId)} style={{ textAlign: 'left', padding: 0, background: 'var(--bg-card)', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden', color: 'var(--text)', cursor: 'pointer', font: 'inherit' }}>
            <Foto a={x} />
            <div style={{ padding: '10px 12px' }}>
              <b style={{ fontFamily: 'var(--font-judul)' }}>{x.nama}</b>
              <div className="redup kecil">{x.peran}{x.saya ? ' · kamu' : ''}</div>
            </div>
          </button>
        ))}
      </div>
      {a && <Bio a={a} studioId={studioId} onTutup={() => setBuka(null)} onSimpan={muat} />}
    </div>
  )
}
