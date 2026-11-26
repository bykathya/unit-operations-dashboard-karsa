import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { useSegarkan } from './realtime'
import { tanggalPendek } from './format'
import TombolUnduh from './TombolUnduh'
import { useTanyaAntrean, perluTanyaAntrean } from './TanyaAntrean'
import DetailOrder from './DetailOrder'
import { LabelKhusus } from './KolomKhusus'

// UPDATE KLIEN (10 Nov 2026, permintaan tim): semua klien aktif + KAPAN terakhir dikabari, supaya tak ada klien yang terlewat tanpa kabar.
// Preview/Deliver tercentang otomatis bila order sudah melewati tahap itu; "Kata" = kabar singkat tanpa preview. Kontak dicatat dengan mengklik
// kolomnya; feedback/keterangan klien ditulis langsung di kolom Catatan (13 Nov 2026, masukan tim — tanpa form "Catat update").
const JENIS = { PREVIEW: 'Preview dikirim', KATA: 'Kata (kabar singkat, mis. masih WIP)', DELIVER: 'Deliver terkirim', CATATAN: 'Catatan' }
// Contoh kata untuk klien yang belum bisa dipreview tapi sudah ≥ beberapa hari tanpa kabar (permintaan tim: "maaf belum bisa update karena masih WIP ya")
const CONTOH_KATA = ['Maaf belum bisa update, masih WIP ya', 'Masih proses pengerjaan, update berikutnya segera', 'Sedang mengerjakan revisi, mohon ditunggu']
const POSISI_WARNA = { 'Di talent': 'jenis-KERJA', 'Di admin': 'jenis-QC', 'Di klien': 'jenis-PREVIEW', Ditahan: 'jenis-HOLD' }
const lalu = (b) => (b.belumPernah ? `belum tercatat (order masuk ${b.hariLalu} hari lalu)${b.masaTenggang ? ' — masa penyesuaian' : ''}` : b.hariLalu === 0 ? 'hari ini' : `${b.hariLalu} hari lalu`)

// Kolom catatan langsung di tabel: ketik lalu Enter / 💾. Disimpan sebagai jenis CATATAN (tidak mengubah "terakhir dikabari").
// "→ talent" (16 Nov 2026, masukan tim): catatan/feedback klien sekaligus masuk Catatan proyek order — dibaca talent di kartu Antreanku &
// detail order. Saat Revisi klien dengan talent berakun, centang "Feedback ke talent" ikut terisi; talent freelance tetap dikabari manual.
function KolomCatatan({ b, onSelesai, setGalat }) {
  const [v, setV] = useState('')
  const [keTalent, setKeTalent] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const kirim = async (e) => {
    e.preventDefault(); if (!v.trim()) return
    setSibuk(true); setGalat('')
    try { await api('/api/circle/update-klien', { method: 'POST', body: { orderId: b.id, jenis: 'CATATAN', catatan: v.trim(), ...(keTalent ? { keTalent: true } : {}) } }); setV(''); setKeTalent(false); onSelesai() } catch (er) { setGalat(er.message) }
    setSibuk(false)
  }
  return (
    <form style={{ marginTop: 2 }} onSubmit={kirim}>
      <div className="chips" style={{ flexWrap: 'nowrap' }}>
        <input list="contoh-kata-klien" style={{ minWidth: 170 }} placeholder="tulis catatan / feedback klien…" value={v} onChange={e => setV(e.target.value)} maxLength={500} />
        <button className="btn kecil" disabled={sibuk || !v.trim()} title="Simpan catatan">{sibuk ? '…' : '💾'}</button>
      </div>
      {b.talent.length > 0 && <label className="centang kecil" style={{ margin: '2px 0 0' }} title={b.adaTalentInternal ? 'Catatan ikut masuk Catatan proyek — talent melihatnya di Antreanku' : 'Talent freelance tidak punya akun: catatan masuk Catatan proyek, tetapi tetap kabari freelancer secara manual'}>
        <input type="checkbox" checked={keTalent} onChange={e => setKeTalent(e.target.checked)} /> teruskan ke talent{b.adaTalentInternal ? '' : ' (catat saja)'}</label>}
    </form>
  )
}
// Riwayat + ubah/hapus catatan (12 Nov 2026, masukan tim): hapus hanya untuk catatan manual; catatan otomatis cukup bisa diubah teksnya
function Riwayat({ id, onUbah }) {
  const [d, setD] = useState(null), [edit, setEdit] = useState(null), [galat, setGalat] = useState('')
  const muat = () => api(`/api/circle/update-klien/${id}/riwayat`).then(setD).catch(() => setD([]))
  useEffect(() => { muat() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  const jalan = async (fn) => { setGalat(''); try { await fn(); setEdit(null); await muat(); onUbah?.() } catch (e) { setGalat(e.message) } }
  if (!d) return <div className="redup kecil">Memuat…</div>
  if (!d.length) return <div className="redup kecil">Belum ada catatan update.</div>
  return <div style={{ marginTop: 4 }}>{galat && <div className="galat kecil">{galat}</div>}{d.map(x => <div key={x.id} className="redup kecil" style={{ marginBottom: 3 }}>
    {new Date(x.waktu).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · <b>{x.jenis === 'FEEDBACK_TALENT' ? 'Feedback ke talent' : x.jenis === 'CATATAN' ? '📝 Catatan' : JENIS[x.jenis] ?? x.jenis}</b>{x.otomatis ? ' (otomatis)' : ''}{x.oleh ? ` · ${x.oleh}` : ''}
    {edit?.id === x.id
      ? <span className="chips" style={{ marginTop: 2 }}><input style={{ width: 220 }} value={edit.catatan} onChange={e => setEdit({ ...edit, catatan: e.target.value })} maxLength={500} placeholder="catatan" autoFocus /><button type="button" className="btn kecil utama" onClick={() => jalan(() => api(`/api/circle/update-klien/catatan/${x.id}`, { method: 'PATCH', body: { catatan: edit.catatan } }))}>Simpan</button><button type="button" className="btn kecil" onClick={() => setEdit(null)}>Batal</button></span>
      : <>{x.catatan ? <> — “{x.catatan}”</> : ''} <a href="#" onClick={e => { e.preventDefault(); setEdit({ id: x.id, catatan: x.catatan ?? '' }) }}>ubah</a>{!x.otomatis && <> · <a href="#" onClick={e => { e.preventDefault(); confirm('Hapus catatan update ini?') && jalan(() => api(`/api/circle/update-klien/catatan/${x.id}`, { method: 'DELETE' })) }}>hapus</a></>}</>}
  </div>)}</div>
}

// Pindah tahap langsung dari tabel (12 Nov 2026, masukan tim): mis. klien ACC preview Base → pilih "Colouring" → kartu pindah di Produksi &
// masuk antrean talent. Pilihan = aksi mesin (juga untuk marketer pemegang) + semua langkah alur bagi pengelola (pindah manual).
function PindahTahap({ b, tahap, onSelesai, setGalat, tanyaAntrean }) {
  const saran = b.aksi.find(a => a.aksi === 'lanjut') ?? b.aksi[0]
  const [ke, setKe] = useState(saran?.ke ?? '')
  const [sibuk, setSibuk] = useState(false)
  const iS = tahap.findIndex(t => t.id === b.tahapId)
  const pilihan = b.bisaPindah ? tahap.map((t, i) => ({ id: t.id, label: b.aksi.find(a => a.ke === t.id)?.aksi === 'lanjut' ? `✓ ${t.nama} (berikutnya)` : i < iS && ['KERJA', 'REVISI_INTERNAL'].includes(t.jenis) ? `↺ ${t.nama}` : `→ ${t.nama}` })).filter(x => x.id !== b.tahapId)
    : b.aksi.map(a => ({ id: a.ke, label: a.label }))
  if (!pilihan.length) return null
  const nama = (id) => tahap.find(t => t.id === id)?.nama ?? b.aksi.find(a => a.ke === id)?.label ?? ''
  const kirim = async () => {
    if (!ke) return
    // Pengelola memindah ke tahap kerja & ada talent berakun → pilih Masuk antrean / Tunda (sama dengan Produksi, 16 Nov 2026)
    const tujuan = tahap.find(t => t.id === ke), a = b.aksi.find(x => x.ke === ke)
    let antrean = true
    if (b.bisaPindah && a?.aksi !== 'hold' && perluTanyaAntrean({ adaTalentInternal: b.adaTalentInternal, jenisTujuan: tujuan?.jenis })) { antrean = await tanyaAntrean({ judul: b.judul, talent: b.talent, tujuan: nama(ke) }); if (antrean === null) return }
    else if (!confirm(`Pindahkan "${b.judul}" ke ${nama(ke)}?\n\nKartu di Produksi ikut pindah.`)) return
    setSibuk(true); setGalat('')
    try {
      const tunda = antrean === false ? { antrean: false } : {}
      if (a) await api(`/api/circle/orders/${b.id}/aksi`, { method: 'POST', body: { aksi: a.aksi, ...tunda } })
      else await api(`/api/circle/orders/${b.id}/tahap`, { method: 'PATCH', body: { tahapId: ke, ...tunda } })
      onSelesai()
    } catch (e) { setGalat(e.message) }
    setSibuk(false)
  }
  return (
    <div className="chips" style={{ marginTop: 4, flexWrap: 'nowrap' }}>
      <select value={ke} onChange={e => setKe(e.target.value)} style={{ width: 'auto', maxWidth: 180 }} title="Pindahkan ke tahap berikutnya sesuai alur kerja">
        {!saran && <option value="">— pindah ke —</option>}
        {pilihan.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <button type="button" className="btn kecil" disabled={sibuk || !ke} onClick={kirim}>{sibuk ? '…' : 'Pindah'}</button>
    </div>
  )
}

export default function UpdateKlien({ studioId }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [riwayat, setRiwayat] = useState(null), [detailId, setDetailId] = useState(null)
  const [tanyaAntrean, modalAntrean] = useTanyaAntrean()
  const gulir = useRef(null) // tombol geser tabel ke samping (13 Nov 2026, masukan tim)
  const geser = (arah) => gulir.current?.scrollBy({ left: arah * 320, behavior: 'smooth' })
  const [cari, setCari] = useState(''), [hanyaTerlewat, setHanyaTerlewat] = useState(false), [tanpaMarketer, setTanpaMarketer] = useState(false)
  const [batas, setBatas] = useState(() => { try { return Number(localStorage.getItem('uo-batas-update')) || 2 } catch { return 2 } })
  // Urutan (16 Nov 2026, masukan tim): bawaan = order masuk paling lama di atas (dari server; baris tidak melompat setelah diklik);
  // pilihan kedua = paling lama belum dikabari (urutan lama). Pilihan diingat per perangkat.
  const [urut, setUrut] = useState(() => { try { return localStorage.getItem('uo-urut-update') || 'masuk' } catch { return 'masuk' } })
  const muat = useCallback(() => api(`/api/circle/update-klien?studioId=${studioId}&batas=${batas}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, batas])
  useEffect(() => { setD(null); muat() }, [muat])
  useSegarkan(muat, ['orders'])
  const ubahUrut = (v) => { setUrut(v); try { localStorage.setItem('uo-urut-update', v) } catch { /* abaikan */ } }
  const ubahBatas = (v) => { setBatas(v); try { localStorage.setItem('uo-batas-update', String(v)) } catch { /* abaikan */ } }
  if (galat && !d) return <div className="galat blok">{galat}</div>
  if (!d) return <div className="redup tengah">Memuat…</div>
  const kata = cari.trim().toLowerCase()
  const urutan = urut === 'kabar' ? [...d.baris].sort((x, y) => (Number(y.terlewat) - Number(x.terlewat)) || (y.hariLalu - x.hariLalu) || x.klien.localeCompare(y.klien, 'id')) : d.baris
  const tampil = urutan.filter(b => (!hanyaTerlewat || b.terlewat) && (!tanpaMarketer || !b.marketer) && (!kata || [b.klien, b.panggilan, b.judul, b.akun, b.status, b.marketer].some(x => String(x ?? '').toLowerCase().includes(kata))))
  // Kolom Preview/Kata/Deliver bisa diklik (12 Nov 2026, masukan tim): centang = catat kontak itu sekarang; lepas = hapus catatan MANUAL
  // terakhir jenis itu. Centang yang berasal dari Produksi (order sudah melewati Preview/Delivery) tidak bisa dilepas dari sini.
  const kotak = (b, jenis, nyala) => {
    if (!b.bisaUbah) return <span>{nyala ? '✅' : '⬜'}</span>
    const klik = async () => {
      setGalat('')
      try {
        if (!nyala) await api('/api/circle/update-klien', { method: 'POST', body: { orderId: b.id, jenis } })
        else if (b.manual[jenis]) { if (!confirm(`Lepas centang ${JENIS[jenis]}? Catatan update manual terakhir jenis ini dihapus.`)) return; await api(`/api/circle/update-klien/catatan/${b.manual[jenis]}`, { method: 'DELETE' }) }
        else return alert('Centang ini otomatis dari Produksi (order sudah melewati tahap itu), jadi tidak bisa dilepas dari sini.')
        muat()
      } catch (e) { setGalat(e.message) }
    }
    return <button type="button" className="btn-teks" style={{ fontSize: 18, cursor: 'pointer', background: 'none', border: 0 }} onClick={klik} title={nyala ? (b.manual[jenis] ? 'Klik untuk melepas centang' : 'Tercentang otomatis dari Produksi') : `Klik untuk mencatat: ${JENIS[jenis]} hari ini`}>{nyala ? '✅' : '⬜'}</button>
  }
  const isiPanggilan = async (b) => {
    const v = prompt(`Nama panggilan klien ${b.klien}:`, b.panggilan ?? ''); if (v == null) return
    setGalat(''); try { await api(`/api/circle/klien/${b.klienId}`, { method: 'PATCH', body: { panggilan: v.trim() } }); muat() } catch (e) { setGalat(e.message) }
  }
  const feedback = async (b, selesai) => { setGalat(''); try { await api('/api/circle/update-klien/feedback', { method: 'POST', body: { orderId: b.id, selesai } }); muat() } catch (e) { setGalat(e.message) } }
  const R = d.ringkasan
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      <div className="ringkasan">
        <div className="stat"><span className="redup kecil">Klien aktif</span><b>{R.aktif}</b></div>
        <div className="stat"><span className="redup kecil">Belum di-update ≥ {d.batasHari} hari</span><b className={R.terlewat ? 'nada-bad' : ''}>{R.terlewat}</b></div>
        <div className="stat"><span className="redup kecil">Di talent</span><b>{R.diTalent}</b></div>
        <div className="stat"><span className="redup kecil">Di admin</span><b>{R.diAdmin}</b></div>
        <div className="stat"><span className="redup kecil">Di klien</span><b>{R.diKlien}</b></div>
        <div className="stat"><span className="redup kecil">Ditahan</span><b>{R.ditahan}</b></div>
      </div>
      <div className="panel">
        <div className="toolbar">
          <input className="cari" placeholder="Cari klien, order, akun, atau status…" value={cari} onChange={e => setCari(e.target.value)} />
          <label className="redup kecil" style={{ margin: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>urutkan
            <select style={{ width: 'auto' }} value={urut} onChange={e => ubahUrut(e.target.value)}><option value="masuk">Order masuk paling lama</option><option value="kabar">Paling lama belum dikabari</option></select></label>
          <label className="centang" style={{ margin: 0 }}><input type="checkbox" checked={hanyaTerlewat} onChange={e => setHanyaTerlewat(e.target.checked)} /> hanya yang terlewat</label>
          {d.tahap.length > 0 && d.baris.some(b => !b.marketer) && <label className="centang" style={{ margin: 0 }} title="Order tanpa marketer pemegang — tetapkan di detail order (klik nama klien)"><input type="checkbox" checked={tanpaMarketer} onChange={e => setTanpaMarketer(e.target.checked)} /> tanpa marketer ({d.baris.filter(b => !b.marketer).length})</label>}
          <label className="redup kecil" style={{ margin: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>batas terlewat
            <select style={{ width: 'auto' }} value={batas} onChange={e => ubahBatas(Number(e.target.value))}>{[1, 2, 3, 4, 5, 7, 10, 14].map(n => <option key={n} value={n}>{n} hari</option>)}</select></label>
          <TombolUnduh nama="update-klien" baris={[['No', 'Akun', 'Klien', 'Panggilan', 'Order', 'Status', 'Posisi', 'Preview', 'Kata', 'Deliver', 'Update terakhir', 'Hari lalu', 'Terlewat', 'Feedback ke talent', 'Talent'], ...urutan.map((b, i) => [i + 1, b.akun ?? '', b.klien, b.panggilan ?? '', b.judul, b.status, b.posisi, b.preview ? 'Ya' : '', b.kata ? 'Ya' : '', b.deliver ? 'Ya' : '', b.terakhir ? tanggalPendek(b.terakhir) : 'belum pernah', b.hariLalu, b.terlewat ? 'Ya' : '', b.feedbackKeTalent == null ? '' : b.feedbackKeTalent ? 'Ya' : 'Belum', b.talent.join(', ')])]} cetak />
        </div>
        <p className="redup kecil">Satu tabel semua klien aktif dan kapan terakhir dikabari. Klik kolom <b>Preview / Kata / Deliver</b> setiap kali mengabari klien (Preview &amp; Deliver juga tercentang otomatis dari Produksi; klik lagi untuk melepas yang dicatat manual) — <b>Kata</b> = kabar singkat saat belum ada yang bisa dipreview (mis. "maaf masih WIP ya"). Feedback atau keterangan dari klien cukup ditulis di kolom <b>Catatan</b> lalu Enter; <b>riwayat</b> berisi semua catatan sebelumnya. Di kolom Status, pilih tahap lalu <b>Pindah</b> — kartu di Produksi ikut pindah. Baris merah = sudah ≥ {d.batasHari} hari tanpa kabar.</p>
        <datalist id="contoh-kata-klien">{CONTOH_KATA.map(k => <option key={k} value={k} />)}</datalist>
        <div className="chips" style={{ justifyContent: 'flex-end', marginBottom: 4 }}><span className="redup kecil">geser tabel</span><button type="button" className="btn kecil" onClick={() => geser(-1)} title="Geser ke kiri">◀</button><button type="button" className="btn kecil" onClick={() => geser(1)} title="Geser ke kanan">▶</button></div>
        {tampil.length === 0 ? <div className="kosong">{d.baris.length ? 'Tidak ada yang cocok.' : 'Belum ada order aktif.'}</div> : (
          <div ref={gulir} style={{ overflowX: 'auto' }}><table>
            <thead><tr><th>No</th><th>Akun</th><th>Klien · order</th><th>Status</th><th title="Preview sudah dikirim">Preview</th><th title={'Kabar singkat berupa kata-kata ke klien saat belum ada yang bisa dipreview (mis. "maaf masih WIP ya")'}>Kata</th><th title="Hasil akhir terkirim">Deliver</th><th>Update terakhir</th><th>Catatan</th><th title="Masukan klien sudah diteruskan ke talent (saat Revisi klien)">Feedback ke talent</th></tr></thead>
            <tbody>{tampil.map((b, i) => (
              <tr key={b.id} style={b.terlewat ? { background: 'rgba(220,60,60,.08)' } : undefined}>
                <td>{i + 1}</td>
                <td className="redup kecil">{b.akun ?? '—'}</td>
                <td><b style={{ cursor: 'pointer' }} onClick={() => setDetailId(b.id)} title="Buka detail order">{b.klien}</b>{b.panggilan && <div className="kecil">{b.panggilan}</div>}
                  {!b.panggilan && b.klienId && b.bisaUbah && <a href="#" className="kecil" style={{ marginLeft: 6 }} onClick={e => { e.preventDefault(); isiPanggilan(b) }}>+ panggilan</a>}
                  <div className="redup kecil">{b.judul}{b.talent.length ? ` · 👤 ${b.talent.join(', ')}` : ''}{d.tahap.length > 0 ? (b.marketer ? ` · 📣 ${b.marketer}` : ' · 📣 tanpa marketer') : ''}</div>
                  {b.khusus?.length > 0 && <div style={{ marginTop: 2 }}><LabelKhusus daftar={b.khusus} /></div>}
</td>
                <td><span className={'tahap-lencana ' + (POSISI_WARNA[b.posisi] ?? '')}>{b.status}</span><div className="redup kecil">{b.posisi}</div>
                  {b.bisaUbah && <PindahTahap key={b.tahapId} b={b} tahap={d.tahap} setGalat={setGalat} onSelesai={muat} tanyaAntrean={tanyaAntrean} />}</td>
                <td style={{ textAlign: 'center' }}>{kotak(b, 'PREVIEW', b.preview)}</td><td style={{ textAlign: 'center' }}>{kotak(b, 'KATA', b.kata)}</td><td style={{ textAlign: 'center' }}>{kotak(b, 'DELIVER', b.deliver)}</td>
                <td><span className={b.terlewat ? 'nada-bad' : ''}><b>{b.terakhir ? tanggalPendek(b.terakhir) : '—'}</b></span><div className={'kecil ' + (b.terlewat ? 'nada-bad' : 'redup')}>{b.terlewat ? '⚠ ' : ''}{lalu(b)}</div></td>
                <td style={{ minWidth: 220 }}>{b.catatanTerakhir && <div className="kecil">“{b.catatanTerakhir}”</div>}
                  {b.bisaUbah && <KolomCatatan b={b} setGalat={setGalat} onSelesai={muat} />}
                  <a href="#" className="kecil" onClick={e => { e.preventDefault(); setRiwayat(riwayat === b.id ? null : b.id) }}>{riwayat === b.id ? 'tutup riwayat' : `riwayat${b.jumlahCatatan ? ` (${b.jumlahCatatan})` : ''}`}</a>
                  {riwayat === b.id && <Riwayat id={b.id} onUbah={muat} />}</td>
                <td style={{ textAlign: 'center' }}>{b.feedbackKeTalent == null ? <span className="redup">—</span> : <input type="checkbox" checked={b.feedbackKeTalent} disabled={!b.bisaUbah} onChange={e => feedback(b, e.target.checked)} title="Centang bila masukan klien sudah kamu sampaikan ke talent" />}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {detailId && <DetailOrder orderId={detailId} onTutup={() => setDetailId(null)} />}
      {modalAntrean}
    </div>
  )
}
