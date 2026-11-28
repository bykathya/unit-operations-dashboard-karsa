import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

// INFO & KALENDER (Karsa, 27 Nov 2026): postingan Info & Dokumen dari web pusat yang ditujukan ke kita (pengumuman, event, kontrak,
// dokumen & Drive) + kalender bulan ini (acara circle, event dari web pusat, hari libur). Untuk semua anggota.
const JENIS = { SEMUA: 'Semua', PENGUMUMAN: 'Pengumuman', EVENT: 'Event', KONTRAK: 'Kontrak', DOKUMEN: 'Dokumen & Drive' }
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
  const warnaAcara = (a) => (a.dariPusat ? 'var(--pink-candy)' : 'var(--accent)')
  return (
    <div className="kal-wrap">
      <div className="kartu kal">
        {galat && <div className="galat">{galat}</div>}
        <div className="kal-head">
          <button type="button" className="tombol k" onClick={() => geser(-1)} aria-label="Bulan sebelumnya">‹</button>
          <h2>{BULAN[m - 1]} {y}</h2>
          <button type="button" className="tombol k" onClick={() => geser(1)} aria-label="Bulan berikutnya">›</button>
          {d.bisaKelola && !form && <button type="button" className="tombol k hitam" style={{ marginLeft: 'auto' }} onClick={() => { setF({ ...f, tanggal: pilih }); setForm(true) }}>+ Tambah acara</button>}
        </div>
        <div className="kal-grid">
          {HARI.map(h => <div key={h} className="nm">{h}</div>)}
          {Array.from({ length: kosong }).map((_, i) => <div key={`k${i}`} className="kk kosong-sel" />)}
          {d.hari.map(h => (
            <button key={h.tanggal} type="button" className={`kk${h.tanggal === pilih ? ' pilih' : ''}${h.tanggal === hariIni() ? ' hariini' : ''}${h.jenis === 'LIBUR' ? ' libur' : ''}`} onClick={() => setPilih(h.tanggal)} aria-label={`${Number(h.tanggal.slice(8))} ${BULAN[m - 1]}${h.acara.length ? `, ${h.acara.length} acara` : ''}`}>
              <span className="tg">{Number(h.tanggal.slice(8))}</span>
              <span className="titik-ev">{h.jenis === 'LIBUR' && <i style={{ background: '#111' }} />}{h.acara.slice(0, 3).map(a => <i key={a.id} style={{ background: warnaAcara(a) }} />)}</span>
              {(h.acara[0] || h.label) && <span className="lbl-ev">{h.acara[0]?.judul ?? h.label}</span>}
            </button>
          ))}
        </div>
        <div className="legenda-ev"><span><i style={{ background: 'var(--accent)' }} />Acara circle</span><span><i style={{ background: 'var(--pink-candy)' }} />Event dari web pusat</span><span><i style={{ background: '#111' }} />Hari libur</span></div>
      </div>
      <div className="kal-sisi">
        {form && (
          <form className="kartu" style={{ padding: 18, margin: 0 }} onSubmit={simpan}>
            <h3 style={{ margin: '0 0 10px' }}>Acara baru</h3>
            <div className="dua">
              <label>Judul<input value={f.judul} onChange={e => setF({ ...f, judul: e.target.value })} required maxLength={160} placeholder="mis. Rapat bulanan circle" /></label>
              <label>Tanggal<input type="date" value={f.tanggal} onChange={e => setF({ ...f, tanggal: e.target.value })} required /></label>
              <label>Jam (opsional)<input type="time" value={f.mulai} onChange={e => setF({ ...f, mulai: e.target.value })} /></label>
              <label>Tempat / tautan (opsional)<input value={f.lokasi} onChange={e => setF({ ...f, lokasi: e.target.value })} maxLength={160} /></label>
            </div>
            <div className="modal-aksi"><button type="button" className="tombol k" onClick={() => setForm(false)}>Batal</button><button className="tombol k p">Simpan</button></div>
          </form>
        )}
        <div className="kartu" style={{ padding: 18, margin: 0 }}>
          <h3 style={{ margin: '0 0 10px' }}>{tglPanjang(pilih)}</h3>
          {!terpilih || (!terpilih.acara.length && terpilih.jenis !== 'LIBUR') ? <p className="kosong" style={{ margin: 0 }}>Tidak ada acara di tanggal ini.</p> : (
            <>
              {terpilih.jenis === 'LIBUR' && <div className="ev"><span className="pita-ev" style={{ background: '#111' }} /><div><small>Hari libur</small><b>{terpilih.label || 'Libur'}</b></div></div>}
              {terpilih.acara.map(a => (
                <div key={a.id} className="ev"><span className="pita-ev" style={{ background: warnaAcara(a) }} />
                  <div><small>{[a.dariPusat ? 'Event dari web pusat' : 'Acara circle', a.mulai, a.berulang ? 'berulang' : null].filter(Boolean).join(' · ')}</small><b>{a.judul}</b>
                    {a.lokasi && (/^https?:\/\//.test(a.lokasi) ? <small><a href={a.lokasi} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text)', fontWeight: 600 }}>Buka tautan →</a></small> : <small>📍 {a.lokasi}</small>)}</div></div>
              ))}
            </>
          )}
        </div>
        <div className="kartu" style={{ padding: 18, margin: 0 }}>
          <h3 style={{ margin: '0 0 10px' }}>Semua acara {BULAN[m - 1]}</h3>
          {daftar.length === 0 ? <p className="kosong" style={{ margin: 0 }}>Belum ada acara bulan ini.</p> : daftar.map(h => (
            <button key={h.tanggal} type="button" className="baris-ev" onClick={() => setPilih(h.tanggal)}>
              <b>{Number(h.tanggal.slice(8))}</b><span>{[...(h.jenis === 'LIBUR' ? [h.label || 'Hari libur'] : []), ...h.acara.map(a => a.judul)].join(' · ')}</span>
              <i style={{ background: h.jenis === 'LIBUR' ? '#111' : warnaAcara(h.acara[0] ?? {}) }} />
            </button>
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
    <div className="kd">
      <p className="sub" style={{ marginTop: 0 }}>Pengumuman dari Kepala Circle dan koordinator, plus kalender acara: event, deadline, hari libur, dan pengingat.</p>
      <div className="chips"><button className={tab === 'info' ? 'on' : ''} onClick={() => setTab('info')}>Pengumuman ({info?.length ?? 0})</button><button className={tab === 'kalender' ? 'on' : ''} onClick={() => setTab('kalender')}>Kalender</button></div>
      {tab === 'kalender' ? <Kalender /> : (
        <>
          {galat && <div className="galat">{galat}</div>}
          {info?.length > 0 && (
            <div className="kartu tab-info" style={{ padding: 14, marginBottom: 0 }}>
              {Object.entries(JENIS).map(([k, v]) => <button key={k} type="button" className={jenis === k ? 'on' : ''} onClick={() => setJenis(k)}>{v}{k === 'SEMUA' ? ` (${info.length})` : ''}</button>)}
              <input placeholder="Cari pengumuman, kontrak, tautan…" value={cari} onChange={e => setCari(e.target.value)} aria-label="Cari info" />
            </div>
          )}
          {!info ? <p className="kosong">{galat ? '' : 'Memuat…'}</p> : tampil.length === 0 ? (
            <div className="kartu" style={{ marginTop: 12, padding: 32, textAlign: 'center' }}><b>Belum ada pengumuman{info.length ? ' yang cocok' : ''}.</b><p className="kosong" style={{ margin: '6px 0 0' }}>Pengumuman dari Kepala Circle dan koordinator studiomu akan muncul di sini.</p></div>
          ) : tampil.map(a => (
            <article key={a.id} className="post">
              <div className="meta"><span className={`lbl-j j-${a.jenis ?? 'PENGUMUMAN'}`}>{JENIS[a.jenis] ?? 'Pengumuman'}</span><span>{a.pembuat} · {new Date(a.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
              <h3>{a.judul}</h3>
              {a.konten && <p>{a.konten}</p>}
              {(a.tanggalEvent || a.tautan) && <div className="meta">{a.tanggalEvent && <span>📅 {tglPanjang(a.tanggalEvent)}{a.jamEvent ? ` · ${a.jamEvent}` : ''}</span>}{a.tautan && <a href={a.tautan} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text)', fontWeight: 600 }}>Buka tautan →</a>}</div>}
            </article>
          ))}
        </>
      )}
    </div>
  )
}
