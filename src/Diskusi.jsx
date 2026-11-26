import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { useSegarkan } from './realtime'

// DISKUSI KEPUTUSAN (adaptasi OGS): thread per topik/order, peserta, pesan berbalas dengan @sebut, keputusan dengan ringkasan.
// Hanya tautan (tanpa lampiran berkas). Diskusi otomatis ("QC macet") ditulis oleh Otomasi.
const waktu = (d) => new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const STATUS = { TERBUKA: 'Terbuka', DIPUTUSKAN: 'Diputuskan', DIBATALKAN: 'Dibatalkan' }
const aksi = async (fn, setGalat, muat) => { setGalat(''); try { await fn(); muat?.() } catch (e) { setGalat(e.message) } }

function Baru({ studioId, onSelesai, onBatal }) {
  const [opsi, setOpsi] = useState(null)
  const [f, setF] = useState({ judul: '', deskripsi: '', orderId: '', peserta: [], pesanAwal: '', tautan: '' })
  const [galat, setGalat] = useState('')
  useEffect(() => { api(`/api/circle/diskusi/opsi?studioId=${studioId}`).then(setOpsi).catch(e => setGalat(e.message)) }, [studioId])
  const toggle = (id) => setF(v => ({ ...v, peserta: v.peserta.includes(id) ? v.peserta.filter(x => x !== id) : [...v.peserta, id] }))
  return (
    <form className="panel" onSubmit={e => { e.preventDefault(); aksi(async () => { const d = await api('/api/circle/diskusi', { method: 'POST', body: { studioId, ...f, orderId: f.orderId || undefined, tautan: f.tautan.trim() ? f.tautan.split(/\s+/) : [] } }); onSelesai(d.id) }, setGalat) }}>
      <h3 className="judul-bagian">Diskusi baru</h3>
      {galat && <div className="galat">{galat}</div>}
      <label>Judul<input value={f.judul} onChange={e => setF({ ...f, judul: e.target.value })} required maxLength={200} /></label>
      <label>Terkait order (opsional)<select value={f.orderId} onChange={e => setF({ ...f, orderId: e.target.value })}><option value="">— tidak terkait order —</option>{opsi?.order.map(o => <option key={o.id} value={o.id}>{o.judul} · {o.klien}</option>)}</select></label>
      <label>Deskripsi<textarea rows={2} value={f.deskripsi} onChange={e => setF({ ...f, deskripsi: e.target.value })} maxLength={2000} /></label>
      <div className="redup kecil" style={{ marginBottom: 6 }}>Peserta (pilih minimal satu)</div>
      <div className="chips" style={{ marginBottom: 10 }}>{opsi?.anggota.map(a => <button type="button" key={a.id} className={'pilih' + (f.peserta.includes(a.id) ? ' aktif' : '')} onClick={() => toggle(a.id)}>{a.nama}</button>)}</div>
      <label>Pesan pembuka (opsional)<textarea rows={2} value={f.pesanAwal} onChange={e => setF({ ...f, pesanAwal: e.target.value })} maxLength={2000} /></label>
      <label>Tautan (http…, pisahkan dengan spasi, maks 5)<input value={f.tautan} onChange={e => setF({ ...f, tautan: e.target.value })} placeholder="https://drive.google.com/…" /></label>
      <div className="modal-aksi"><button type="button" className="btn" onClick={onBatal}>Batal</button><button className="btn utama" disabled={!f.peserta.length}>Mulai diskusi</button></div>
    </form>
  )
}

function Detail({ id, studioId, onUbah }) {
  const [d, setD] = useState(null)
  const [opsi, setOpsi] = useState(null)
  const [galat, setGalat] = useState('')
  const [isi, setIsi] = useState('')
  const [tautan, setTautan] = useState('')
  const [induk, setInduk] = useState(null)
  const [sebut, setSebut] = useState([])
  const muat = useCallback(() => api(`/api/circle/diskusi/${id}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [id])
  useEffect(() => { setD(null); muat(); api(`/api/circle/diskusi/opsi?studioId=${studioId}`).then(setOpsi).catch(() => {}) }, [muat, studioId])
  useSegarkan(muat, ['diskusi'])
  const kirim = (e) => { e.preventDefault(); aksi(async () => { await api(`/api/circle/diskusi/${id}/pesan`, { method: 'POST', body: { isi, indukId: induk?.id, sebut, tautan: tautan.trim() ? tautan.split(/\s+/) : [] } }); setIsi(''); setTautan(''); setInduk(null); setSebut([]) }, setGalat, () => { muat(); onUbah() }) }
  if (!d) return galat ? <div className="galat blok">{galat}</div> : <div className="redup">Memuat…</div>
  const tutup = d.status !== 'TERBUKA'
  const Pesan = ({ m, anak }) => (
    <div style={{ padding: '8px 0', borderTop: anak ? 'none' : '1px solid var(--border)', marginLeft: anak ? 22 : 0 }}>
      <div className="redup kecil"><b className={m.otomatis ? 'nada-warn' : ''}>{m.nama}</b> · {waktu(m.waktu)}{m.sebut.length > 0 && <> · menyebut {m.sebut.join(', ')}</>}</div>
      {m.dihapus ? <i className="redup">pesan dihapus</i> : <div style={{ whiteSpace: 'pre-wrap' }}>{m.isi}</div>}
      {m.tautan.map(t => <div key={t}><a href={t} target="_blank" rel="noreferrer noopener" className="kecil">{t}</a></div>)}
      {!m.dihapus && <div style={{ marginTop: 2 }}>{!anak && !tutup && <button className="btn kecil" onClick={() => setInduk(m)}>Balas</button>} {m.userId === d.saya && <button className="btn kecil" onClick={() => aksi(() => api(`/api/circle/diskusi/${id}/pesan/${m.id}`, { method: 'DELETE' }), setGalat, muat)}>Hapus</button>}</div>}
    </div>
  )
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      <div className="baris-atas"><h3 style={{ margin: 0 }}>{d.judul}</h3><span className={'tahap-lencana' + (d.status === 'TERBUKA' ? '' : ' jenis-SELESAI')}>{STATUS[d.status]}</span></div>
      <div className="meta" style={{ margin: '6px 0' }}>{d.otomatis && <span className="lencana revisi">otomatis</span>}{d.order && <span className="chip">{d.order.judul}</span>}<span className="redup">dibuat {d.dibuatOleh} · {waktu(d.createdAt)}</span></div>
      {d.deskripsi && <p className="redup" style={{ whiteSpace: 'pre-wrap' }}>{d.deskripsi}</p>}
      {d.tautan.map(t => <div key={t}><a href={t} target="_blank" rel="noreferrer noopener" className="kecil">{t}</a></div>)}
      <div className="redup kecil" style={{ margin: '8px 0' }}>Peserta: {d.peserta.map(p => <span key={p.userId} className="chip sub" style={{ marginRight: 4 }}>{p.nama}{p.peran === 'PEMILIK' ? ' ★' : ''}{d.bisaKelola && !tutup && p.peran !== 'PEMILIK' && <button className="btn kecil" style={{ marginLeft: 4, padding: '0 5px' }} onClick={() => aksi(() => api(`/api/circle/diskusi/${id}/peserta/${p.userId}`, { method: 'DELETE' }), setGalat, muat)}>✕</button>}</span>)}
        {d.bisaKelola && !tutup && opsi && <select style={{ width: 'auto', marginLeft: 6 }} value="" onChange={e => e.target.value && aksi(() => api(`/api/circle/diskusi/${id}/peserta`, { method: 'POST', body: { userIds: [e.target.value] } }), setGalat, muat)}><option value="">+ peserta</option>{opsi.anggota.filter(a => !d.peserta.some(p => p.userId === a.id)).map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}</select>}</div>
      {tutup && <div className="panel" style={{ marginBottom: 10 }}><b>{d.status === 'DIPUTUSKAN' ? 'Keputusan' : 'Dibatalkan'}</b>{d.status === 'DIPUTUSKAN' ? <> oleh {d.diputuskanOleh}, {waktu(d.diputuskanPada)}<div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{d.ringkasanKeputusan}</div></> : <> oleh {d.dibatalkanOleh}</>}</div>}
      <div>{d.pesan.length === 0 ? <div className="kosong">Belum ada pesan.</div> : d.pesan.map(m => <div key={m.id}><Pesan m={m} />{m.balasan.map(b => <Pesan key={b.id} m={b} anak />)}</div>)}</div>
      {!tutup && (
        <form onSubmit={kirim} style={{ marginTop: 12 }}>
          {induk && <div className="chip sub" style={{ marginBottom: 6 }}>Membalas {induk.nama} <button type="button" className="btn kecil" onClick={() => setInduk(null)}>✕</button></div>}
          <textarea rows={2} value={isi} onChange={e => setIsi(e.target.value)} placeholder="Tulis pesan…" maxLength={2000} />
          <div className="toolbar" style={{ marginTop: 6 }}>
            <input style={{ flex: 1, minWidth: 160 }} value={tautan} onChange={e => setTautan(e.target.value)} placeholder="Tautan (opsional, http…)" />
            {opsi && <select style={{ width: 'auto' }} value="" onChange={e => e.target.value && setSebut(s => [...new Set([...s, e.target.value])])}><option value="">@ sebut…</option>{opsi.anggota.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}</select>}
            {sebut.map(s => <span key={s} className="chip sub">@{opsi?.anggota.find(a => a.id === s)?.nama}</span>)}
            <button className="btn utama" disabled={!isi.trim() && !tautan.trim()}>Kirim</button>
          </div>
        </form>
      )}
      {d.bisaKelola && !tutup && (
        <div className="toolbar" style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => { const r = prompt('Ringkasan keputusan:'); if (r?.trim()) aksi(() => api(`/api/circle/diskusi/${id}/putuskan`, { method: 'POST', body: { ringkasan: r } }), setGalat, () => { muat(); onUbah() }) }}>✓ Putuskan</button>
          <button className="btn" onClick={() => confirm('Batalkan diskusi ini?') && aksi(() => api(`/api/circle/diskusi/${id}/batalkan`, { method: 'POST' }), setGalat, () => { muat(); onUbah() })}>Batalkan</button>
        </div>
      )}
    </div>
  )
}

export default function Diskusi({ studioId, onBaca }) {
  const [daftar, setDaftar] = useState(null)
  const [status, setStatus] = useState('TERBUKA')
  const [pilih, setPilih] = useState(null)
  const [baru, setBaru] = useState(false)
  const [galat, setGalat] = useState('')
  const muat = useCallback(() => api(`/api/circle/diskusi?studioId=${studioId}&status=${status}`).then(x => { setDaftar(x); setGalat(''); onBaca?.() }).catch(e => setGalat(e.message)), [studioId, status, onBaca])
  useEffect(() => { setDaftar(null); setPilih(null); muat() }, [muat])
  useSegarkan(muat, ['diskusi'])
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      <div className="toolbar">
        <div className="tab-mini" style={{ margin: 0 }}>{[['TERBUKA', 'Terbuka'], ['DIPUTUSKAN', 'Diputuskan'], ['DIBATALKAN', 'Dibatalkan']].map(([k, l]) => <button key={k} className={status === k ? 'aktif' : ''} onClick={() => setStatus(k)}>{l}</button>)}</div>
        <button className="btn utama" onClick={() => { setBaru(true); setPilih(null) }}>+ Diskusi baru</button>
      </div>
      <div className="diskusi-grid">
        <div>
          {!daftar ? <div className="redup">Memuat…</div> : daftar.length === 0 ? <div className="kosong">Tidak ada diskusi {STATUS[status].toLowerCase()}.</div> : daftar.map(d => (
            <div key={d.id} className={'panel diskusi-kartu' + (pilih === d.id ? ' aktif' : '')} onClick={() => { setPilih(d.id); setBaru(false) }}>
              <div className="baris-atas"><b>{d.judul}</b>{d.belumDibaca > 0 && <span className="hitung" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>{d.belumDibaca}</span>}</div>
              <div className="redup kecil">{d.otomatis ? '🤖 otomatis · ' : ''}{d.order ? d.order.judul + ' · ' : ''}{d.jumlahPeserta} peserta</div>
              {d.pesanTerakhir && <div className="redup kecil" style={{ marginTop: 3 }}><b>{d.pesanTerakhir.nama}:</b> {d.pesanTerakhir.isi}</div>}
            </div>
          ))}
        </div>
        <div>
          {baru ? <Baru studioId={studioId} onBatal={() => setBaru(false)} onSelesai={(id) => { setBaru(false); setStatus('TERBUKA'); setPilih(id); muat() }} /> : pilih ? <Detail key={pilih} id={pilih} studioId={studioId} onUbah={muat} /> : <div className="kosong">Pilih diskusi di kiri, atau buat yang baru.</div>}
        </div>
      </div>
    </div>
  )
}
