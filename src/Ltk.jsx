import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { InputRupiah, PilihKategori, InputAngka } from './Pilihan'

// LTK — Lempar-Terima Kerjaan (adaptasi OGS LtkCase; sisi staf). TERIMA = pihak luar membawa pekerjaan (PO), LEMPAR = kita melempar keluar.
// Negosiasi dicatat; DEAL (Terima) → dikonversi jadi order di inbox Produksi.
const rp = (n) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'))
const aksi = async (fn, setGalat, muat) => { setGalat(''); try { await fn(); muat?.() } catch (e) { setGalat(e.message) } }
const waktu = (d) => new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const WARNA = { DRAFT: '', DIAJUKAN: '', NEGOSIASI: '', DEAL: 'jenis-SELESAI', DITOLAK: 'revisi', DIBATALKAN: 'revisi' }

function Form({ studioId, opsi, awal, onSelesai, onBatal }) {
  const [f, setF] = useState(awal ?? { arah: 'TERIMA', jenisPihak: 'KOMUNITAS', namaPihak: '', kontak: '', judul: '', kategori: '', deskripsi: '', anggaranCatatan: '', deadlineDiminta: '', tautan: '', akunId: '', pemasarId: '' })
  const [galat, setGalat] = useState('')
  // Bank data pihak (9 Nov 2026): nama yang pernah dicatat (LTK sebelumnya / freelancer unit) → kontak & jenis pihak terisi otomatis
  const pilihPihak = (nama) => { const p = (opsi.pihak ?? []).find(x => x.nama.toLowerCase() === nama.trim().toLowerCase()); setF(v => ({ ...v, namaPihak: nama, ...(p ? { jenisPihak: p.jenisPihak ?? v.jenisPihak, kontak: v.kontak || p.kontak || '' } : {}) })) }
  const kirim = (e) => { e.preventDefault(); aksi(async () => {
    const body = { ...f, studioId, tautanRujukan: (f.tautan ?? '').trim() ? f.tautan.trim().split(/\s+/) : [], akunId: f.akunId || null, pemasarId: f.pemasarId || null, deadlineDiminta: f.deadlineDiminta || null }
    delete body.tautan
    const d = awal ? await api(`/api/circle/ltk/${awal.id}`, { method: 'PATCH', body }) : await api('/api/circle/ltk', { method: 'POST', body })
    onSelesai(awal?.id ?? d.id)
  }, setGalat) }
  return (
    <form className="panel" onSubmit={kirim}>
      <h3 className="judul-bagian">{awal ? 'Ubah LTK' : 'LTK baru'}</h3>
      {galat && <div className="galat">{galat}</div>}
      <div className="dua">
        <label>Arah<select value={f.arah} disabled={!!awal} onChange={e => setF({ ...f, arah: e.target.value })}>{Object.entries(opsi.arah).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Jenis pihak<select value={f.jenisPihak} onChange={e => setF({ ...f, jenisPihak: e.target.value })}>{Object.entries(opsi.jenisPihak).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Nama pihak (komunitas / freelance)<input list="ltk-pihak" value={f.namaPihak} onChange={e => pilihPihak(e.target.value)} required maxLength={200} placeholder="ketik untuk mencari dari data sebelumnya" />
          <datalist id="ltk-pihak">{(opsi.pihak ?? []).map(p => <option key={p.nama} value={p.nama}>{p.kontak ?? ''}</option>)}</datalist></label>
        <label>Kontak<input value={f.kontak ?? ''} onChange={e => setF({ ...f, kontak: e.target.value })} maxLength={200} placeholder="otomatis terisi bila pihak sudah pernah dicatat" /></label>
      </div>
      <label>Judul pekerjaan<input value={f.judul} onChange={e => setF({ ...f, judul: e.target.value })} required maxLength={200} /></label>
      <div className="dua">
        <div className="isian">Kategori<PilihKategori studioId={studioId} value={f.kategori ?? ''} onChange={v => setF({ ...f, kategori: v })} /></div>
        <label>Perkiraan anggaran<InputRupiah value={f.anggaranCatatan ?? ''} onChange={v => setF({ ...f, anggaranCatatan: v })} /></label>
        <label>Deadline diminta<input type="date" value={f.deadlineDiminta ?? ''} onChange={e => setF({ ...f, deadlineDiminta: e.target.value })} /></label>
        <label>Akun jualan (untuk konversi)<select value={f.akunId ?? ''} onChange={e => setF({ ...f, akunId: e.target.value })}><option value="">— belum dipilih —</option>{opsi.akun.map(a => <option key={a.id} value={a.id}>{a.platform} · {a.namaAkun}</option>)}</select></label>
        <label>Pemasar<select value={f.pemasarId ?? ''} onChange={e => setF({ ...f, pemasarId: e.target.value })}><option value="">— tidak ada —</option>{opsi.anggota.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}</select></label>
      </div>
      <label>Deskripsi<textarea rows={3} value={f.deskripsi ?? ''} onChange={e => setF({ ...f, deskripsi: e.target.value })} maxLength={4000} /></label>
      <label>Tautan rujukan (http…, pisahkan spasi, maks 5)<input value={f.tautan ?? (f.tautanRujukan ?? []).join(' ')} onChange={e => setF({ ...f, tautan: e.target.value })} /></label>
      <div className="modal-aksi"><button type="button" className="btn" onClick={onBatal}>Batal</button><button className="btn utama">Simpan</button></div>
    </form>
  )
}

// LTK Lempar yang Deal → hubungkan ke order (yang sudah ada / baru). Pihak luar masuk tim order dengan fee = harga deal (9 Nov 2026).
function HubungkanLempar({ k, opsi, setGalat, selesai }) {
  const [order, setOrder] = useState(null), [pilih, setPilih] = useState(''), [baru, setBaru] = useState({ klien: '', akunId: k.akunId ?? '', nilai: '' })
  useEffect(() => { api(`/api/circle/ltk/${k.id}/order-lempar`).then(x => setOrder(x.order)).catch(() => setOrder([])) }, [k.id])
  const kirim = (body) => aksi(async () => { await api(`/api/circle/ltk/${k.id}/hubungkan`, { method: 'POST', body }) }, setGalat, selesai)
  return (
    <div style={{ marginTop: 12 }}>
      <b>Hubungkan ke order</b> <span className="redup kecil">— {k.namaPihak} masuk tim order dengan fee {rp(k.hargaSepakat)}, lalu alurnya terpantau di Produksi.</span>
      <div className="chips" style={{ marginTop: 8 }}>
        <select value={pilih} onChange={e => setPilih(e.target.value)} style={{ minWidth: 240 }}><option value="">— pilih order yang sudah ada —</option>{(order ?? []).map(o => <option key={o.id} value={o.id}>{o.judul} · {o.klien}</option>)}</select>
        <button className="btn utama" disabled={!pilih} onClick={() => kirim({ orderId: pilih })}>Hubungkan</button>
      </div>
      <div className="redup kecil" style={{ margin: '8px 0 4px' }}>atau buat order baru dari LTK ini:</div>
      <div className="chips">
        <input placeholder="Nama klien" value={baru.klien} onChange={e => setBaru({ ...baru, klien: e.target.value })} maxLength={200} />
        <select value={baru.akunId} onChange={e => setBaru({ ...baru, akunId: e.target.value })}><option value="">— akun jualan —</option>{opsi.akun.map(a => <option key={a.id} value={a.id}>{a.platform} · {a.namaAkun}</option>)}</select>
        <InputAngka placeholder="Nilai order ke klien (Rp)" value={baru.nilai} onChange={e => setBaru({ ...baru, nilai: e.target.value })} style={{ width: 190 }} />
        <button className="btn" disabled={!baru.klien.trim() || !baru.akunId} onClick={() => kirim({ klien: baru.klien, akunId: baru.akunId, nilai: baru.nilai === '' ? undefined : Number(baru.nilai) })}>Buat order baru</button>
      </div>
    </div>
  )
}

function Detail({ id, studioId, opsi, onUbah, onTutup, onOrder }) {
  const [k, setK] = useState(null), [galat, setGalat] = useState(''), [mode, setMode] = useState(null)
  const [deal, setDeal] = useState({ hargaSepakat: '', deadlineSepakat: '', syarat: '' }), [cat, setCat] = useState(''), [akunId, setAkunId] = useState('')
  const muat = useCallback(() => api(`/api/circle/ltk/${id}`).then(x => { setK(x); setAkunId(x.akunId ?? ''); setDeal({ hargaSepakat: x.hargaSepakat ?? '', deadlineSepakat: x.deadlineSepakat ?? '', syarat: x.syarat ?? '' }); setGalat('') }).catch(e => setGalat(e.message)), [id])
  useEffect(() => { muat() }, [muat])
  if (!k) return <div className="redup">{galat || 'Memuat…'}</div>
  const post = (jalur, body = {}) => aksi(async () => { await api(`/api/circle/ltk/${id}/${jalur}`, { method: 'POST', body }); onUbah() }, setGalat, muat)
  const akun = opsi.akun.find(a => a.id === k.akunId)
  return (
    <div>
      <button className="btn kecil" onClick={onTutup}>← Daftar</button>
      {galat && <div className="galat blok">{galat}</div>}
      <div className="panel" style={{ marginTop: 10 }}>
        <div className="meta"><b>{k.kode}</b><span className={'lencana ' + WARNA[k.status]}>{k.labelStatus}</span><span className="chip sub">{k.labelArah}</span><span className="redup kecil">{k.jenisPihak === 'KOMUNITAS' ? 'Komunitas' : 'Freelance'}: {k.namaPihak}{k.kontak ? ` · ${k.kontak}` : ''}</span></div>
        <h3 className="judul-bagian" style={{ marginTop: 6 }}>{k.judul}</h3>
        {k.deskripsi && <div style={{ whiteSpace: 'pre-wrap' }}>{k.deskripsi}</div>}
        <div className="redup kecil" style={{ marginTop: 6 }}>{[k.kategori && `Kategori: ${k.kategori}`, k.anggaranCatatan && `Anggaran: ${k.anggaranCatatan}`, k.deadlineDiminta && `Deadline diminta: ${k.deadlineDiminta}`, akun && `Akun: ${akun.namaAkun}`].filter(Boolean).join(' · ')}</div>
        {k.tautanRujukan.map(t => <div key={t} className="kecil"><a href={t} target="_blank" rel="noreferrer noopener">{t}</a></div>)}
        {(k.hargaSepakat != null || k.syarat) && <div style={{ marginTop: 8 }}><b>Kesepakatan:</b> {rp(k.hargaSepakat)}{k.deadlineSepakat ? ` · deadline ${k.deadlineSepakat}` : ''}{k.syarat ? ` · ${k.syarat}` : ''}</div>}
        {k.orderId && <div style={{ marginTop: 8 }}>✅ {k.arah === 'LEMPAR' ? 'Terhubung ke order (pihak luar tercatat di tim order).' : 'Sudah menjadi order.'} <button className="btn kecil" onClick={() => onOrder?.()}>Buka Produksi</button></div>}
      </div>
      {!k.final || (k.status === 'DEAL' && !k.orderId) ? (
        <div className="panel">
          <div className="chips">
            {k.status === 'DRAFT' && <button className="btn" onClick={() => post('ajukan')}>Ajukan</button>}
            {k.status === 'DIAJUKAN' && <button className="btn" onClick={() => post('negosiasi')}>Mulai negosiasi</button>}
            {['DRAFT', 'DIAJUKAN', 'NEGOSIASI'].includes(k.status) && <button className="btn utama" onClick={() => setMode(mode === 'deal' ? null : 'deal')} title={k.status === 'DRAFT' ? 'Kesepakatan sudah jelas? Langsung Deal tanpa Ajukan/Negosiasi' : undefined}>{k.status === 'DRAFT' ? 'Langsung Deal…' : 'Deal…'}</button>}
            {['DIAJUKAN', 'NEGOSIASI'].includes(k.status) && <button className="btn" onClick={() => confirm('Tolak LTK ini?') && post('tolak')}>Tolak</button>}
            {!k.final && <button className="btn" onClick={() => confirm('Batalkan LTK ini?') && post('batal')}>Batalkan</button>}
            {!k.orderId && !['DITOLAK', 'DIBATALKAN'].includes(k.status) && <button className="btn" onClick={() => onUbah('ubah', k)}>Ubah data</button>}
          </div>
          {mode === 'deal' && <form style={{ marginTop: 10 }} onSubmit={e => { e.preventDefault(); aksi(async () => { await api(`/api/circle/ltk/${id}/deal`, { method: 'POST', body: { hargaSepakat: Number(deal.hargaSepakat), deadlineSepakat: deal.deadlineSepakat || null, syarat: deal.syarat } }); setMode(null); onUbah() }, setGalat, muat) }}>
            <div className="dua"><label>Harga deal (Rp)<InputAngka terbilang value={deal.hargaSepakat} onChange={e => setDeal({ ...deal, hargaSepakat: e.target.value })} required /></label><label>Deadline disepakati<input type="date" value={deal.deadlineSepakat} onChange={e => setDeal({ ...deal, deadlineSepakat: e.target.value })} /></label></div>
            <label>Syarat<input value={deal.syarat} onChange={e => setDeal({ ...deal, syarat: e.target.value })} maxLength={2000} /></label><button className="btn utama">Simpan deal</button></form>}
          {k.status === 'DEAL' && !k.orderId && k.arah === 'LEMPAR' && <HubungkanLempar k={k} opsi={opsi} setGalat={setGalat} selesai={() => { onUbah(); muat() }} />}
          {k.status === 'DEAL' && !k.orderId && k.arah === 'TERIMA' && (
            <div className="chips" style={{ marginTop: 10 }}>
              <select value={akunId} onChange={e => setAkunId(e.target.value)}><option value="">— pilih akun jualan —</option>{opsi.akun.map(a => <option key={a.id} value={a.id}>{a.platform} · {a.namaAkun}</option>)}</select>
              <button className="btn utama" disabled={!akunId} onClick={() => post('konversi', { akunId })}>Konversi jadi order</button>
            </div>)}
        </div>) : null}
      <div className="panel"><h3 className="judul-bagian">Catatan & negosiasi</h3>
        {k.catatan.length === 0 && <div className="redup kecil">Belum ada catatan.</div>}
        {k.catatan.map(c => <div key={c.id} className="kecil" style={{ marginBottom: 6 }}><b>{c.penulis}</b> <span className="redup">{waktu(c.waktu)}</span><div>{c.isi}</div></div>)}
        <form className="chips" onSubmit={e => { e.preventDefault(); aksi(async () => { await api(`/api/circle/ltk/${id}/catatan`, { method: 'POST', body: { isi: cat } }); setCat('') }, setGalat, muat) }}><input placeholder="Tulis catatan…" value={cat} onChange={e => setCat(e.target.value)} maxLength={2000} required style={{ flex: 1 }} /><button className="btn kecil">Kirim</button></form>
        {k.bisaDihapus && <button className="btn kecil" style={{ marginTop: 10 }} onClick={() => confirm('Hapus LTK ini?') && aksi(async () => { await api(`/api/circle/ltk/${id}`, { method: 'DELETE' }); onTutup(true) }, setGalat)}>Hapus LTK</button>}
      </div>
    </div>
  )
}

export default function Ltk({ studioId, onOrder }) {
  const [opsi, setOpsi] = useState(null), [d, setD] = useState(null), [galat, setGalat] = useState('')
  const [lihat, setLihat] = useState('daftar'), [id, setId] = useState(null), [edit, setEdit] = useState(null), [status, setStatus] = useState(''), [arah, setArah] = useState('')
  const muat = useCallback(() => api(`/api/circle/ltk?studioId=${studioId}${status ? `&status=${status}` : ''}${arah ? `&arah=${arah}` : ''}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, status, arah])
  useEffect(() => { api(`/api/circle/ltk/opsi?studioId=${studioId}`).then(setOpsi).catch(e => setGalat(e.message)) }, [studioId])
  useEffect(() => { muat() }, [muat])
  if (!opsi) return <div className="redup">{galat || 'Memuat…'}</div>
  if (lihat === 'form') return <Form studioId={studioId} opsi={opsi} awal={edit} onBatal={() => setLihat(id ? 'detail' : 'daftar')} onSelesai={(i) => { setId(i); setLihat('detail'); muat() }} />
  if (lihat === 'detail') return <Detail key={id} id={id} studioId={studioId} opsi={opsi} onOrder={onOrder} onTutup={(h) => { setLihat('daftar'); muat() }} onUbah={(j, k) => { if (j === 'ubah') { setEdit(k); setLihat('form') } else muat() }} />
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      <div className="toolbar"><button className="btn utama" onClick={() => { setEdit(null); setId(null); setLihat('form') }}>+ LTK baru</button>
        <select value={arah} onChange={e => setArah(e.target.value)}><option value="">Semua arah</option>{Object.entries(opsi.arah).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select value={status} onChange={e => setStatus(e.target.value)}><option value="">Semua status{d ? ` (${Object.values(d.hitung).reduce((a, b) => a + b, 0)})` : ''}</option>{Object.entries(opsi.status).map(([k, l]) => <option key={k} value={k}>{l}{d?.hitung[k] ? ` (${d.hitung[k]})` : ''}</option>)}</select></div>
      {!d ? <div className="redup">Memuat…</div> : d.kasus.length === 0 ? <div className="kosong">Belum ada LTK. Catat pekerjaan yang dibawa komunitas/freelance (Terima) atau yang kita lempar keluar (Lempar).</div> : (
        <div className="panel"><table><thead><tr><th>Kode</th><th>Pihak</th><th>Judul</th><th>Status</th><th style={{ textAlign: 'right' }}>Harga deal</th></tr></thead><tbody>
          {d.kasus.map(k => <tr key={k.id} style={{ cursor: 'pointer' }} onClick={() => { setId(k.id); setLihat('detail') }}><td>{k.kode}</td><td>{k.namaPihak}<div className="redup kecil">{k.jenisPihak === 'KOMUNITAS' ? 'Komunitas' : 'Freelance'}</div></td><td>{k.judul}</td><td><span className={'lencana ' + WARNA[k.status]}>{k.labelStatus}</span></td><td style={{ textAlign: 'right' }}>{k.hargaSepakat != null ? rp(k.hargaSepakat) : '—'}</td></tr>)}
        </tbody></table></div>)}
    </div>
  )
}
