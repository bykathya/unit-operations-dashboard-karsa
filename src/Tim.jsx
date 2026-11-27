import { useEffect, useState } from 'react'
import { api } from './api'
import { Manpower } from './Tambahan'

const FUNGSI = [
  { k: 'ARTIST', l: 'Artist', t: 'Pembuat karya' },
  { k: 'MARKETER', l: 'Marketer', t: 'Klien, chat, preview/delivery, pemasaran' },
  { k: 'PM_QC', l: 'PM / QC', t: 'Koordinasi, penugasan, QC' },
  { k: 'ADMIN', l: 'Admin', t: 'Administrasi keuangan/operasional (bukan pemasaran)' },
]
const BIDANG = ['3D', 'Rigging', 'Animasi', 'Ilustrasi', 'GFS', 'Desain']
const JENJANG = { KOORDINATOR: 'Koordinator', KADER: 'Kader', KARYAWAN: 'Talent', MAGANG: 'Magang' }

// Layar Tim (koordinator ke atas): konfirmasi siapa artist / marketer / PM-QC / admin. Tebakan dari posisi sudah terisi.
function Baris({ a, studioId, onSimpan, bisaUbah }) {
  // Admin Market (13 Nov 2026): fungsi Marketer/Admin terkunci — tebakan untuk fungsi itu tidak ikut, yang tersimpan tetap
  const kunci = a.kunciFungsi ?? []
  const awal = a.terkonfirmasi ? a.fungsi : [...a.saran.filter(f => !kunci.includes(f.fungsi)), ...a.fungsi.filter(f => kunci.includes(f.fungsi))]
  const [pilih, setPilih] = useState(() => Object.fromEntries(awal.map(f => [f.fungsi, f.bidang ? f.bidang.split(',') : []])))
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState('')
  const ada = (k) => k in pilih
  const toggle = (k) => bisaUbah && !kunci.includes(k) && setPilih(p => { const n = { ...p }; if (k in n) delete n[k]; else n[k] = []; return n })
  const toggleBidang = (b) => bisaUbah && setPilih(p => ({ ...p, ARTIST: p.ARTIST.includes(b) ? p.ARTIST.filter(x => x !== b) : [...p.ARTIST, b] }))
  const berubah = JSON.stringify(Object.entries(pilih).sort()) !== JSON.stringify(awal.map(f => [f.fungsi, f.bidang ? f.bidang.split(',') : []]).sort())
  const status = a.terkonfirmasi ? (berubah ? 'diubah' : 'ok') : (a.saran.length ? 'tebakan' : 'kosong')

  async function simpan() {
    setSibuk(true); setGalat('')
    try {
      await api(`/api/circle/tim/${a.userId}?studioId=${studioId}`, { method: 'PUT', body: { fungsi: Object.entries(pilih).map(([fungsi, b]) => ({ fungsi, bidang: fungsi === 'ARTIST' ? b.join(',') : null })) } })
      onSimpan()
    } catch (e) { setGalat(e.message) } finally { setSibuk(false) }
  }
  return (
    <div className={'tim-baris st-' + status}>
      <div className="tim-orang">
        <strong>{a.nama}</strong>
        <div className="redup kecil">{JENJANG[a.jenjang]} · posisi: {a.posisi || <i>belum diisi</i>}</div>
        {/* Fungsi Admin = label; akses mengelola order = daftar Admin Market (18 Nov 2026, keputusan user) */}
        {a.adminMarket ? <div className="kecil"><span className="chip">✓ akses Admin Market</span></div>
          : ada('ADMIN') && <div className="kecil nada-warn" title="Centang Admin hanya label. Supaya bisa mengelola order (papan, Mulai kerjakan, tagihan, dll.), tambahkan orang ini di bagian Admin Market di bawah.">label Admin · belum punya akses Admin Market</div>}
      </div>
      <div className="tim-fungsi">
        <div className="chips">
          {FUNGSI.map(f => { const k = bisaUbah && kunci.includes(f.k); return <button key={f.k} type="button" title={k ? `${f.l} hanya diatur Koordinator (membuka akses uang order)` : f.t} className={'pilih' + (ada(f.k) ? ' aktif' : '')} style={k ? { opacity: .55, cursor: 'not-allowed' } : undefined} disabled={k} onClick={() => toggle(f.k)}>{k ? '🔒 ' : ''}{f.l}</button> })}
        </div>
        {ada('ARTIST') && (
          <div className="chips bidang">
            <span className="redup kecil">bidang:</span>
            {BIDANG.map(b => <button key={b} type="button" className={'pilih kecil' + (pilih.ARTIST.includes(b) ? ' aktif' : '')} onClick={() => toggleBidang(b)}>{b}</button>)}
          </div>
        )}
        {galat && <div className="galat">{galat}</div>}
      </div>
      <div className="tim-aksi">
        <span className={'status-tim ' + status}>{{ ok: '✓ terkonfirmasi', tebakan: 'tebakan', kosong: 'belum diisi', diubah: 'diubah' }[status]}</span>
        {!bisaUbah && <span className="redup kecil" title="Hanya Koordinator yang bisa mengubah baris ini">🔒 diatur koordinator</span>}
        {bisaUbah && <button className="btn kecil utama" disabled={sibuk || (status === 'ok') || (status === 'kosong' && Object.keys(pilih).length === 0)} onClick={simpan}>{sibuk ? '…' : status === 'tebakan' ? 'Konfirmasi' : 'Simpan'}</button>}
      </div>
    </div>
  )
}

// Admin Market: akses kelola order untuk orang yang bukan Koordinator (dipindahkan dari halaman Produksi Ekosistem). Hanya Koordinator ke atas.
function AdminMarket({ studioId }) {
  const [d, setD] = useState(null), [pilih, setPilih] = useState(''), [galat, setGalat] = useState('')
  const muat = () => api(`/api/circle/admin-market?studioId=${studioId}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message))
  useEffect(() => { muat() }, [studioId]) // eslint-disable-line react-hooks/exhaustive-deps
  const jalan = async (fn) => { setGalat(''); try { await fn(); muat() } catch (e) { setGalat(e.message) } }
  if (!d) return galat ? null : null
  const belum = d.anggota.filter(a => !d.admin.some(x => x.userId === a.id))
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h3 className="judul-bagian">Admin Market</h3>
      <div className="redup kecil" style={{ marginBottom: 8 }}>Orang yang boleh mengelola ORDER unit ini tanpa menjadi Koordinator (mis. admin marketing): papan produksi beserta nilai uang semua order, marketing, LTK, tagihan, penjualan. Tidak termasuk keuangan unit, tutup bulan, target, serta presensi/izin/refleksi anggota, dan tidak bisa memberi akses ke orang lain. Marketer yang hanya perlu memantau alur order tidak perlu akses ini — menu Produksi (mode pantau) sudah terbuka untuknya.</div>
      {galat && <div className="galat">{galat}</div>}
      {d.admin.length === 0 ? <div className="redup kecil">Belum ada.</div> : d.admin.map(a => {
        // Admin per akun jualan (12 Nov 2026): pilih akun yang dipegang — admin hanya melihat & mengelola order dari akun itu. Kosong = semua order.
        const ubahAkun = (id) => { const baru = a.akunIds.includes(id) ? a.akunIds.filter(x => x !== id) : [...a.akunIds, id]; jalan(() => api(`/api/circle/admin-market/${a.id}/akun`, { method: 'PUT', body: { akunIds: baru } })) }
        return <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div className="meta"><b>{a.nama}</b><span className={'lencana' + (a.akunIds.length ? ' jenis-SELESAI' : '')}>{a.akunIds.length ? `memegang ${a.akunIds.length} akun` : 'semua order unit'}</span><span className="spasi" /><button className="btn kecil" onClick={() => confirm(`Cabut akses ${a.nama}?`) && jalan(() => api(`/api/circle/admin-market/${a.id}`, { method: 'DELETE' }))}>Cabut</button></div>
          {d.akun.length > 0 && <div className="chips" style={{ marginTop: 6 }}><span className="redup kecil">Akun yang dipegang:</span>{d.akun.map(k => <button key={k.id} type="button" className={'btn kecil' + (a.akunIds.includes(k.id) ? ' utama' : '')} onClick={() => ubahAkun(k.id)} title={a.akunIds.includes(k.id) ? 'Klik untuk melepas' : 'Klik untuk menugaskan'}>{a.akunIds.includes(k.id) ? '✓ ' : ''}{k.nama}{k.platform && k.platform !== k.nama ? ` · ${k.platform}` : ''}</button>)}</div>}
        </div>
      })}
      <div className="redup kecil" style={{ marginTop: 6 }}>Pilih akun jualan untuk tiap admin (mis. Admin Etsy → akun Etsy, Admin LTK → akun LTK): admin itu hanya melihat & mengelola order dari akunnya — papan Produksi, detail, tagihan, pembayaran, update klien, analitik. Tanpa pilihan = semua order unit. Koordinator selalu melihat semuanya.</div>
      <div className="chips" style={{ marginTop: 8 }}><select value={pilih} onChange={e => setPilih(e.target.value)}><option value="">+ Tambah admin market…</option>{belum.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}</select><button className="btn kecil utama" disabled={!pilih} onClick={() => jalan(async () => { await api('/api/circle/admin-market', { method: 'POST', body: { studioId, userId: pilih } }); setPilih('') })}>Tambah</button></div>
    </div>
  )
}

export default function Tim({ studioId }) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const muat = () => api(`/api/circle/tim?studioId=${studioId}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message))
  useEffect(() => { setD(null); muat() }, [studioId])

  async function terimaSemua() {
    if (!window.confirm(`Terima tebakan untuk ${d.ringkas.adaSaran} orang yang belum terkonfirmasi? Yang sudah kamu konfirmasi tidak berubah.`)) return
    setSibuk(true)
    try { await api(`/api/circle/tim/terima-saran?studioId=${studioId}`, { method: 'POST' }) } catch (e) { setGalat(e.message) }
    setSibuk(false); muat()
  }
  if (galat && !d) return <div className="galat blok">{galat}</div>
  if (!d) return <div className="redup tengah">Memuat tim…</div>
  const r = d.ringkas
  return (
    <div className="panel">
      <h3 className="judul-bagian">Tim studio · fungsi kerja</h3>
      <p className="redup kecil">Tandai fungsi tiap anggota: <b>Artist</b> (pembuat karya), <b>Marketer</b> (klien, chat, preview &amp; pengiriman), <b>PM/QC</b> (koordinasi &amp; cek), <b>Admin</b> (administrasi bukan pemasaran). Satu orang boleh lebih dari satu. Tebakan diambil dari kolom posisi — <b>periksa, terutama yang tertulis "Admin"</b> (bisa pemasaran, bisa administrasi).</p>
      <div className="tim-ringkas">
        <span><b>{r.terkonfirmasi}</b> dari {r.total} terkonfirmasi</span>
        {r.tanpaDasar > 0 && <span className="redup">· {r.tanpaDasar} belum bisa ditebak (isi manual)</span>}
        <span className="spasi" />
        {d.bisaUbah && r.adaSaran > 0 && <button className="btn" disabled={sibuk} onClick={terimaSemua}>Terima semua tebakan ({r.adaSaran})</button>}
      </div>
      {!d.bisaUbah && d.anggota.some(a => a.bisaUbah) && <p className="redup kecil">Kamu bisa mengatur fungsi Artist (dan bidangnya) serta PM/QC untuk tim produksi (Kader, Karyawan, Magang). Fungsi Marketer dan Admin, baris tim admin/marketing, dan barismu sendiri diatur koordinator (hanya bisa dilihat).</p>}
      {galat && <div className="galat" style={{ marginBottom: 10 }}>{galat}</div>}
      <div className="tim-daftar">
        {d.anggota.length === 0 && <div className="kosong">Belum ada anggota di studio ini.</div>}
        {d.anggota.map(a => <Baris key={a.userId + a.terkonfirmasi + JSON.stringify(a.fungsi)} a={a} studioId={studioId} onSimpan={muat} bisaUbah={a.bisaUbah ?? d.bisaUbah !== false} />)}
      </div>
      {d.bisaUbah !== false && <AdminMarket key={studioId} studioId={studioId} />}
      <Manpower key={'mp' + studioId} studioId={studioId} />
    </div>
  )
}
