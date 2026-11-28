import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { InputRupiah } from './Pilihan'
import { cetakSlip, cetakBanyak } from './slipPdf'
import { webPusat } from './api-util'

// PENGGAJIAN (10 Nov 2026): koordinator memecah THP Bio menjadi RINCIAN TETAP sekali, lalu tiap bulan "Siapkan slip" (gaji pokok + komponen tetap + lembur presensi otomatis),
// menambah bonus/komisi/potongan/baris tambahan, Final → Dibayar, dan mengunduh slip PDF. Angka bulan lalu tidak diketik ulang.
const rp = (n) => 'Rp ' + Math.round(n ?? 0).toLocaleString('id-ID')
const NAMA_BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const ang = (v) => Number(String(v ?? '').replace(/\D/g, '')) || 0
const aksi = async (fn, setGalat, muat) => { setGalat(''); try { await fn(); await muat?.() } catch (e) { setGalat(e.message) } }

function Rincian({ b, studioId, onTutup, onSimpan }) {
  const [k, setK] = useState(b.rincian.map(x => ({ nama: x.nama, jumlah: x.jumlah }))), [galat, setGalat] = useState('')
  const sum = k.reduce((s, x) => s + ang(x.jumlah), 0), pokok = b.thpBio - sum
  return (
    <div className="panel" style={{ marginTop: 8 }}>
      <b>Rincian gaji tetap — {b.nama}</b>
      <div className="redup kecil">THP dari Financial Forecasting: <b>{rp(b.thpBio)}</b>. Pecah jadi komponen; sisanya otomatis menjadi gaji pokok. Total tetap sama dengan THP ini.</div>
      {galat && <div className="galat blok">{galat}</div>}
      {k.map((x, i) => (
        <div className="chips" key={i} style={{ marginTop: 6 }}>
          <input placeholder="Nama komponen (mis. Tunjangan makan)" value={x.nama} onChange={e => setK(k.map((y, j) => j === i ? { ...y, nama: e.target.value } : y))} />
          <InputRupiah value={x.jumlah} onChange={v => setK(k.map((y, j) => j === i ? { ...y, jumlah: v } : y))} />
          <button className="btn kecil" onClick={() => setK(k.filter((_, j) => j !== i))}>Hapus</button>
        </div>))}
      <div className="toolbar" style={{ marginTop: 8 }}>
        <button className="btn" onClick={() => setK([...k, { nama: '', jumlah: '' }])} disabled={k.length >= 12}>+ Komponen</button>
        <span className={pokok < 0 ? 'galat' : 'redup'}>Gaji pokok: <b>{rp(pokok)}</b></span>
        <button className="btn utama" disabled={pokok < 0} onClick={() => aksi(async () => { await api('/api/circle/gaji/rincian', { method: 'PUT', body: { studioId, userId: b.userId, komponen: k.map(x => ({ nama: x.nama, jumlah: ang(x.jumlah) })) } }); await onSimpan(); onTutup() }, setGalat)}>Simpan rincian</button>
        <button className="btn" onClick={onTutup}>Batal</button>
      </div>
    </div>
  )
}

function Slip({ b, muat, setGalat }) {
  const s = b.slip, draft = s.status === 'DRAFT'
  const [f, setF] = useState({ bonus: s.bonus, komisi: s.komisi, shu: s.shu, potongan: s.potongan, catatan: s.catatan ?? '' }), [bn, setBn] = useState({ nama: '', jumlah: '' })
  const [tg, setTg] = useState({ tanggalBayar: s.tanggalBayar ?? '', tanggalBayarShu: s.tanggalBayarShu ?? '' })
  useEffect(() => { setTg({ tanggalBayar: s.tanggalBayar ?? '', tanggalBayarShu: s.tanggalBayarShu ?? '' }) }, [s.tanggalBayar, s.tanggalBayarShu])
  const tampilTgl = (v) => v ? new Date(v + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—'
  useEffect(() => { setF({ bonus: s.bonus, komisi: s.komisi, shu: s.shu, potongan: s.potongan, catatan: s.catatan ?? '' }) }, [s.bonus, s.komisi, s.shu, s.potongan, s.catatan])
  const simpan = () => aksi(() => api(`/api/circle/gaji/${s.id}`, { method: 'PATCH', body: { bonus: ang(f.bonus), komisi: ang(f.komisi), shu: ang(f.shu), potongan: ang(f.potongan), catatan: f.catatan || null } }), setGalat, muat)
  return (
    <div style={{ marginTop: 8 }}>
      <table><tbody>
        <tr><td>Gaji pokok</td><td style={{ textAlign: 'right' }}>{rp(s.gajiPokok)}</td><td /></tr>
        {s.baris.map(t => <tr key={t.id}><td>{t.nama}{t.tetap && <span className="redup kecil"> · tetap</span>}</td><td style={{ textAlign: 'right' }}>{rp(t.jumlah)}</td>
          <td>{draft && !t.tetap && <button className="btn kecil" onClick={() => aksi(() => api(`/api/circle/gaji/baris/${t.id}`, { method: 'DELETE' }), setGalat, muat)}>Hapus</button>}</td></tr>)}
        <tr><td>Lembur presensi (otomatis)</td><td style={{ textAlign: 'right' }}>{rp(s.lembur)}</td><td /></tr>
        <tr style={{ fontWeight: 700 }}><td>Diterima (THP)</td><td style={{ textAlign: 'right' }}>{rp(s.thp)}</td><td /></tr></tbody></table>
      {draft && <>
        <div className="chips" style={{ marginTop: 8 }}>
          {[['bonus', 'Bonus'], ['komisi', 'Komisi'], ['shu', 'SHU'], ['potongan', 'Potongan']].map(([k, l]) => <label key={k} className="redup kecil">{l}<InputRupiah value={f[k]} onChange={v => setF({ ...f, [k]: v })} /></label>)}
          <input placeholder="Catatan (tampil di slip)" value={f.catatan} onChange={e => setF({ ...f, catatan: e.target.value })} />
          <button className="btn" onClick={simpan}>Simpan angka</button></div>
        <form className="chips" style={{ marginTop: 6 }} onSubmit={e => { e.preventDefault(); aksi(async () => { await api(`/api/circle/gaji/${s.id}/baris`, { method: 'POST', body: { nama: bn.nama, jumlah: ang(bn.jumlah) } }); setBn({ nama: '', jumlah: '' }) }, setGalat, muat) }}>
          <input placeholder="Baris tambahan bulan ini (mis. Uang lembur luar)" value={bn.nama} onChange={e => setBn({ ...bn, nama: e.target.value })} required /><InputRupiah value={bn.jumlah} onChange={v => setBn({ ...bn, jumlah: v })} /><button className="btn">+ Tambah</button></form></>}
      {s.status === 'DIBAYAR'
        ? <div className="redup kecil" style={{ marginTop: 8 }}>Dibayar pada <b>{tampilTgl(s.tanggalBayar)}</b>{s.shu > 0 && s.tanggalBayarShu && <> · SHU pada <b>{tampilTgl(s.tanggalBayarShu)}</b></>}</div>
        : <div className="chips" style={{ marginTop: 8 }}>
          <label className="redup kecil">Tanggal gajian<input type="date" value={tg.tanggalBayar} onChange={e => setTg({ ...tg, tanggalBayar: e.target.value })} /></label>
          <label className="redup kecil">Tanggal SHU (bila beda)<input type="date" value={tg.tanggalBayarShu} onChange={e => setTg({ ...tg, tanggalBayarShu: e.target.value })} /></label>
          <button className="btn" onClick={() => aksi(() => api(`/api/circle/gaji/${s.id}/tanggal`, { method: 'PATCH', body: { tanggalBayar: tg.tanggalBayar || undefined, tanggalBayarShu: tg.tanggalBayarShu } }), setGalat, muat)}>Simpan tanggal</button></div>}
      <div className="toolbar" style={{ marginTop: 8 }}>
        <button className="btn" onClick={() => cetakSlip(s.id)}>🖨 Slip PDF</button>
        {draft && <button className="btn utama" onClick={() => aksi(() => api(`/api/circle/gaji/${s.id}/final`, { method: 'POST' }), setGalat, muat)}>Finalkan</button>}
        {s.status === 'FINAL' && <><button className="btn utama" onClick={() => aksi(() => api(`/api/circle/gaji/${s.id}/dibayar`, { method: 'POST', body: { tanggalBayar: tg.tanggalBayar || undefined } }), setGalat, muat)}>Tandai dibayar</button>
          <button className="btn" onClick={() => aksi(() => api(`/api/circle/gaji/${s.id}/buka`, { method: 'POST' }), setGalat, muat)}>Buka kembali</button></>}
      </div>
    </div>
  )
}

export default function Gaji({ studioId }) {
  const skrg = new Date(Date.now() + 7 * 3600000), [bulan, setBulan] = useState(skrg.getUTCMonth() + 1), [tahun, setTahun] = useState(skrg.getUTCFullYear())
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [ok, setOk] = useState(''), [rinci, setRinci] = useState(null), [buka, setBuka] = useState(null)
  const muat = useCallback(() => api(`/api/circle/gaji?studioId=${studioId}&bulan=${bulan}&tahun=${tahun}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, bulan, tahun])
  useEffect(() => { setD(null); muat() }, [muat])
  const siapkan = () => aksi(async () => { const r = await api('/api/circle/gaji/siapkan', { method: 'POST', body: { studioId, bulan, tahun } }); setOk(r.message ?? ''); if (r.data?.dilewati?.length) setOk(`${r.message}: ${r.data.dilewati.map(x => `${x.nama} (${x.alasan})`).join('; ')}`) }, setGalat, muat)
  const p = d?.peringatan, r = d?.ringkas
  return (
    <div>
      <div className="redup kecil" style={{ marginBottom: 8 }}>Gaji dikelola di sini oleh Koordinator. THP tiap orang diambil dari Financial Forecasting di web pusat (pos Gaji, Makan, Transport, Komunikasi). Bonus, komisi, dan lembur ditambahkan otomatis di slip. Di sini THP bisa dipecah jadi rincian, tidak perlu diketik ulang tiap bulan.</div>
      <div className="toolbar">
        <select value={bulan} onChange={e => setBulan(Number(e.target.value))}>{NAMA_BLN.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}</select>
        <select value={tahun} onChange={e => setTahun(Number(e.target.value))}>{[0, 1, 2].map(i => <option key={i} value={skrg.getUTCFullYear() - i}>{skrg.getUTCFullYear() - i}</option>)}</select>
        <button className="btn utama" onClick={siapkan}>Siapkan slip</button>
        {r?.draft > 0 && <button className="btn" onClick={() => aksi(() => api('/api/circle/gaji/final-semua', { method: 'POST', body: { studioId, bulan, tahun } }), setGalat, muat)}>Finalkan semua draft</button>}
      </div>
      {galat && <div className="galat blok">{galat}</div>}
      {ok && <div className="ok blok">{ok}</div>}
      {p?.tanpaThp.length > 0 && <div className="nada-warn kecil">THP belum diisi di Financial Forecasting: {p.tanpaThp.join(', ')}. <a href={webPusat('financial-forecasting')} target="_blank" rel="noreferrer">Isi di web pusat ↗</a></div>}
      {p?.rincianMelebihi.length > 0 && <div className="nada-warn kecil">Rincian melebihi THP: {p.rincianMelebihi.join(', ')} — perbaiki rincian.</div>}
      {p?.perluSegarkan.length > 0 && <div className="nada-warn kecil">Slip draft berbeda dari Bio/rincian terbaru ({p.perluSegarkan.join(', ')}) — klik "Siapkan slip" untuk menyegarkan.</div>}
      {p?.lemburMenunggu > 0 && <div className="nada-warn kecil">{p.lemburMenunggu} lembur sampai bulan ini masih menunggu persetujuan (Tugas saya › Lembur). Setujui sebelum Final supaya ikut slip ini — yang disetujui sesudah Final masuk slip bulan berikutnya sebagai susulan.</div>}
      {p?.lemburSusulan > 0 && <div className="redup kecil">{p.lemburSusulan} lembur bulan sebelumnya yang belum terbayar akan ikut slip ini sebagai <b>lembur susulan</b> saat "Siapkan slip".</div>}
      {r && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
        <div className="stat"><span className="redup kecil">Total THP bulan ini</span><b>{rp(r.totalThp)}</b></div>
        <div className="stat"><span className="redup kecil">Draft / Final / Dibayar</span><b>{r.draft} / {r.final} / {r.dibayar}</b></div></div>}
      {!d ? (galat ? null : <div className="redup">Memuat…</div>) : d.baris.length === 0 ? <div className="kosong">Belum ada anggota di unit ini.</div> : d.baris.map(b => (
        <div className="panel" key={b.userId}>
          <div className="meta"><b>{b.nama}</b>{b.posisi && <span className="chip sub">{b.posisi}</span>}<span className="redup kecil">THP Bio {b.thpBio ? rp(b.thpBio) : 'belum diisi'}</span>
            {b.slip && <span className={'lencana' + (b.slip.status === 'DIBAYAR' ? ' jenis-SELESAI' : '')}>{b.slip.status === 'DRAFT' ? 'Draft' : b.slip.status === 'FINAL' ? 'Final' : 'Dibayar'}</span>}</div>
          <div className="redup kecil">Rincian tetap: {b.rincian.length ? b.rincian.map(x => `${x.nama} ${rp(x.jumlah)}`).join(' · ') + ` · Gaji pokok ${rp(b.gajiPokokDasar)}` : 'belum dipecah (seluruh THP jadi gaji pokok)'}</div>
          <div className="toolbar" style={{ marginTop: 6 }}>
            {b.thpBio > 0 && <button className="btn kecil" onClick={() => setRinci(rinci === b.userId ? null : b.userId)}>Atur rincian</button>}
            {b.slip && <button className="btn kecil" onClick={() => setBuka(buka === b.userId ? null : b.userId)}>{buka === b.userId ? 'Tutup slip' : 'Buka slip'}</button>}
          </div>
          {rinci === b.userId && <Rincian b={b} studioId={studioId} onTutup={() => setRinci(null)} onSimpan={muat} />}
          {b.slip && buka === b.userId && <Slip b={b} muat={muat} setGalat={setGalat} />}
        </div>))}
      {d?.baris.some(b => b.slip) && <div className="toolbar" style={{ marginTop: 8 }}><button className="btn" onClick={() => { const ids = d.baris.filter(b => b.slip && b.slip.status !== 'DRAFT').map(b => b.slip.id); ids.length ? cetakBanyak(ids, `Slip gaji ${NAMA_BLN[bulan - 1]} ${tahun}`) : setGalat('Belum ada slip final bulan ini') }}>Unduh semua slip final</button></div>}
      <Mentor studioId={studioId} bulan={`${tahun}-${String(bulan).padStart(2, '0')}`} />
    </div>
  )
}

// MENTOR (Karsa Circle, tahap 6): tanpa akun, cukup nama + honor bulanan; centang kalau honor bulan ini sudah dibayar.
function Mentor({ studioId, bulan }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [f, setF] = useState({ nama: '', honor: '' }), [ubah, setUbah] = useState(null)
  const muat = useCallback(() => api(`/api/circle/mentor?studioId=${studioId}&bulan=${bulan}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, bulan])
  useEffect(() => { muat() }, [muat])
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h3 className="judul-bagian">Mentor</h3>
      <p className="redup kecil" style={{ marginTop: 0 }}>Mentor tidak punya akun web. Cukup catat nama dan honor bulanannya; centang kalau honor bulan ini sudah dibayar (ikut dihitung di Arus Kas).</p>
      {galat && <div className="galat blok">{galat}</div>}
      {!d ? <div className="redup">Memuat…</div> : d.mentor.length === 0 ? <div className="kosong">Belum ada mentor.</div> : (
        <table><thead><tr><th>Nama</th><th className="kanan">Honor / bulan</th><th>Bulan ini</th><th /></tr></thead><tbody>
          {d.mentor.map(m => ubah?.id === m.id ? (
            <tr key={m.id}><td><input value={ubah.nama} onChange={e => setUbah({ ...ubah, nama: e.target.value })} /></td><td><InputRupiah value={ubah.honor} onChange={v => setUbah({ ...ubah, honor: v })} /></td><td />
              <td className="kanan"><button className="btn kecil utama" onClick={() => aksi(async () => { await api(`/api/circle/mentor/${m.id}`, { method: 'PATCH', body: { nama: ubah.nama, honor: ang(ubah.honor) } }); setUbah(null) }, setGalat, muat)}>Simpan</button> <button className="btn kecil" onClick={() => setUbah(null)}>Batal</button></td></tr>
          ) : (
            <tr key={m.id}><td><b>{m.nama}</b></td><td className="kanan">{rp(m.honor)}</td>
              <td><label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, margin: 0 }}><input type="checkbox" style={{ width: 'auto' }} checked={m.dibayar} onChange={e => aksi(() => api(`/api/circle/mentor/${m.id}/bayar`, { method: 'PUT', body: { bulan, dibayar: e.target.checked } }), setGalat, muat)} /> {m.dibayar ? `Sudah dibayar (${rp(m.jumlahDibayar)})` : 'Belum'}</label></td>
              <td className="kanan"><button className="btn kecil" onClick={() => setUbah({ id: m.id, nama: m.nama, honor: String(m.honor) })}>Ubah</button> <button className="btn kecil" onClick={() => confirm(`Hapus mentor ${m.nama}?`) && aksi(() => api(`/api/circle/mentor/${m.id}`, { method: 'DELETE' }), setGalat, muat)}>Hapus</button></td></tr>
          ))}
        </tbody></table>
      )}
      <form className="toolbar" style={{ marginTop: 10 }} onSubmit={e => { e.preventDefault(); aksi(async () => { await api('/api/circle/mentor', { method: 'POST', body: { studioId, nama: f.nama, honor: ang(f.honor) } }); setF({ nama: '', honor: '' }) }, setGalat, muat) }}>
        <input value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} placeholder="Nama mentor" maxLength={100} required aria-label="Nama mentor" />
        <InputRupiah value={f.honor} onChange={v => setF({ ...f, honor: v })} placeholder="Honor per bulan" aria-label="Honor per bulan" />
        <button className="btn utama">+ Tambah mentor</button>
      </form>
    </div>
  )
}
