import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

// INFO & KALENDER (Karsa, 27 Nov 2026): postingan Info & Dokumen dari web pusat yang ditujukan ke kita (pengumuman, event, kontrak,
// dokumen & Drive) + kalender bulan ini (acara circle, event dari web pusat, hari libur). Untuk semua anggota.
const JENIS = { SEMUA: 'Semua', PENGUMUMAN: 'Pengumuman', EVENT: 'Event', KONTRAK: 'Kontrak', DOKUMEN: 'Dokumen & Drive' }
const KELAS = { PENGUMUMAN: 'bayar-lunas', EVENT: 'revisi', KONTRAK: 'bayar-dp', DOKUMEN: '' }
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const tglPanjang = (t) => new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const hariIni = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)

function Kalender() {
  const [bulan, setBulan] = useState(hariIni().slice(0, 7)), [d, setD] = useState(null), [pilih, setPilih] = useState(hariIni()), [galat, setGalat] = useState('')
  const [form, setForm] = useState(false), [f, setF] = useState({ judul: '', tanggal: '', mulai: '', lokasi: '' })
  const muat = useCallback(() => api(`/api/circle/kalender?bulan=${bulan}`).then(setD).catch(e => setGalat(e.message)), [bulan])
  useEffect(() => { muat() }, [muat])
  const geser = (n) => { const [y, m] = bulan.split('-').map(Number); setBulan(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)) }
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  const [y, m] = bulan.split('-').map(Number)
  const kosong = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const terpilih = d.hari.find(h => h.tanggal === pilih)
  const daftar = d.hari.filter(h => h.acara.length || h.jenis === 'LIBUR' || h.jenis === 'WFA')
  const simpan = async (e) => {
    e.preventDefault(); setGalat('')
    try { await api('/api/circle/kalender/acara', { method: 'POST', body: { judul: f.judul, tanggal: f.tanggal, mulai: f.mulai || undefined, lokasi: f.lokasi || undefined, seharian: !f.mulai } }); setForm(false); setF({ judul: '', tanggal: '', mulai: '', lokasi: '' }); muat() } catch (er) { setGalat(er.message) }
  }
  return (
    <div className="ik-kal">
      <div className="panel">
        {galat && <div className="galat">{galat}</div>}
        <div className="toolbar"><button className="btn kecil" onClick={() => geser(-1)} aria-label="Bulan sebelumnya">‹</button><b>{BULAN[m - 1]} {y}</b><button className="btn kecil" onClick={() => geser(1)} aria-label="Bulan berikutnya">›</button>
          {d.bisaKelola && !form && <button className="btn utama kecil" style={{ marginLeft: 'auto' }} onClick={() => { setF({ ...f, tanggal: pilih }); setForm(true) }}>+ Tambah acara</button>}</div>
        <div className="ik-grid">
          {HARI.map(h => <div key={h} className="ik-nm">{h}</div>)}
          {Array.from({ length: kosong }).map((_, i) => <div key={`k${i}`} />)}
          {d.hari.map(h => (
            <button key={h.tanggal} type="button" className={`ik-hari${h.tanggal === pilih ? ' pilih' : ''}${h.tanggal === hariIni() ? ' kini' : ''}${h.jenis === 'LIBUR' ? ' libur' : ''}`} onClick={() => setPilih(h.tanggal)} aria-label={`${Number(h.tanggal.slice(8))} ${BULAN[m - 1]}${h.acara.length ? `, ${h.acara.length} acara` : ''}`}>
              <span>{Number(h.tanggal.slice(8))}</span>
              {h.acara.length > 0 && <i>{h.acara.slice(0, 3).map(a => <b key={a.id} className={a.dariPusat ? 'pusat' : ''} />)}</i>}
            </button>
          ))}
        </div>
        <div className="redup kecil" style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}><span><b className="ik-titik" /> acara circle</span><span><b className="ik-titik pusat" /> event dari web pusat</span><span><span className="ik-kotak libur" /> hari libur</span></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {form && (
          <form className="panel" onSubmit={simpan}>
            <h3 className="judul-bagian">Acara baru</h3>
            <div className="dua">
              <label>Judul<input value={f.judul} onChange={e => setF({ ...f, judul: e.target.value })} required maxLength={160} placeholder="mis. Rapat bulanan circle" /></label>
              <label>Tanggal<input type="date" value={f.tanggal} onChange={e => setF({ ...f, tanggal: e.target.value })} required /></label>
              <label>Jam (opsional)<input type="time" value={f.mulai} onChange={e => setF({ ...f, mulai: e.target.value })} /></label>
              <label>Tempat / tautan (opsional)<input value={f.lokasi} onChange={e => setF({ ...f, lokasi: e.target.value })} maxLength={160} /></label>
            </div>
            <div className="modal-aksi"><button type="button" className="btn" onClick={() => setForm(false)}>Batal</button><button className="btn utama">Simpan</button></div>
          </form>
        )}
        <div className="panel">
          <h3 className="judul-bagian">{tglPanjang(pilih)}</h3>
          {!terpilih || (!terpilih.acara.length && terpilih.jenis !== 'LIBUR') ? <div className="redup">Tidak ada acara.</div> : (
            <>
              {terpilih.jenis === 'LIBUR' && <div className="meta"><span className="lencana">Libur{terpilih.label ? ` · ${terpilih.label}` : ''}</span></div>}
              {terpilih.acara.map(a => <div key={a.id} className="ik-ev"><b>{a.judul}</b><div className="redup kecil">{[a.mulai, a.dariPusat ? 'dari web pusat' : 'acara circle', a.berulang ? 'berulang' : null].filter(Boolean).join(' · ')}</div>{a.lokasi && (/^https?:\/\//.test(a.lokasi) ? <a className="kecil" href={a.lokasi} target="_blank" rel="noopener noreferrer">Buka tautan →</a> : <div className="kecil">📍 {a.lokasi}</div>)}</div>)}
            </>
          )}
        </div>
        <div className="panel">
          <h3 className="judul-bagian">Bulan ini</h3>
          {daftar.length === 0 ? <div className="redup">Belum ada acara atau hari libur bulan ini.</div> : daftar.map(h => (
            <div key={h.tanggal} className="meta" style={{ marginBottom: 4 }}><b>{Number(h.tanggal.slice(8))} {BULAN[m - 1].slice(0, 3)}</b>
              {h.jenis === 'LIBUR' && <span className="lencana">Libur{h.label ? ` · ${h.label}` : ''}</span>}
              {h.acara.map(a => <span key={a.id} className="chip sub">{a.judul}{a.mulai ? ` ${a.mulai}` : ''}</span>)}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function InfoKalender() {
  const [tab, setTab] = useState('info'), [jenis, setJenis] = useState('SEMUA'), [cari, setCari] = useState('')
  const [info, setInfo] = useState(null), [galat, setGalat] = useState('')
  useEffect(() => { api('/api/circle/info').then(setInfo).catch(e => setGalat(e.message)) }, [])
  const tampil = (info ?? []).filter(a => (jenis === 'SEMUA' || a.jenis === jenis) && (!cari || `${a.judul} ${a.konten} ${a.tautan ?? ''}`.toLowerCase().includes(cari.toLowerCase())))
  return (
    <div>
      <p className="redup" style={{ marginTop: -6 }}>Pengumuman, event, kontrak, dan dokumen dari Kepala Circle dan Koordinator, ditambah kalender acara.</p>
      <div className="subtab"><button className={tab === 'info' ? 'aktif' : ''} onClick={() => setTab('info')}>Info & Dokumen</button><button className={tab === 'kalender' ? 'aktif' : ''} onClick={() => setTab('kalender')}>Kalender</button></div>
      {tab === 'kalender' ? <Kalender /> : (
        <>
          {galat && <div className="galat">{galat}</div>}
          <div className="chips" style={{ marginBottom: 12 }}>
            {Object.entries(JENIS).map(([k, v]) => <button key={k} className={`pilih ${jenis === k ? 'aktif' : ''}`} onClick={() => setJenis(k)}>{v}{k === 'SEMUA' && info ? ` (${info.length})` : ''}</button>)}
            <input className="cari" placeholder="Cari…" value={cari} onChange={e => setCari(e.target.value)} aria-label="Cari info" style={{ flex: '1 1 180px' }} />
          </div>
          {!info ? <div className="redup">{galat ? '' : 'Memuat…'}</div> : tampil.length === 0 ? <div className="kosong">Belum ada info{info.length ? ' yang cocok' : ''}.</div> : tampil.map(a => (
            <article key={a.id} className="panel">
              <div className="meta" style={{ flexWrap: 'wrap' }}><span className={`lencana ${KELAS[a.jenis] ?? ''}`}>{JENIS[a.jenis] ?? 'Pengumuman'}</span><span className="redup kecil">{a.pembuat} · {new Date(a.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
              <h3 style={{ margin: '6px 0' }}>{a.judul}</h3>
              {a.tanggalEvent && <div className="kecil" style={{ fontWeight: 600 }}>📅 {tglPanjang(a.tanggalEvent)}{a.jamEvent ? ` · ${a.jamEvent}` : ''}</div>}
              {a.konten && <p style={{ whiteSpace: 'pre-wrap', margin: '6px 0' }}>{a.konten}</p>}
              {a.tautan && <a href={a.tautan} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>Buka tautan →</a>}
            </article>
          ))}
        </>
      )}
    </div>
  )
}
