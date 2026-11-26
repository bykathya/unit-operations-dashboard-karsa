import { useEffect, useState } from 'react'
import { useSegarkan } from './realtime'
import DetailOrder from './DetailOrder'
import UpdateKlien from './UpdateKlien'
import { LemburMenunggu } from './Kehadiran'
import BayarFreelance from './BayarFreelance'
import MkProspek from './marketing/MkProspek'
import { LabelKhusus } from './KolomKhusus'
import LemburDinilai from './LemburTunda'
import { useTanyaAntrean, perluTanyaAntrean } from './TanyaAntrean'
import { api } from './api'
import { tanggalPendek, lewatDeadline } from './format'

// Tampilan talent (Kader / Karyawan / Magang): HANYA tugasnya sendiri — tanpa nilai uang, tanpa data orang lain.
function Pekerjaanku({ studioId, nama, sembunyiKosong = false }) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [antreanMuat, setAntrean] = useState(null) // null = belum termuat (cegah daftar berkedip)
  const antrean = antreanMuat ?? []
  const muatAntrean = () => api(`/api/circle/antrean-saya?studioId=${studioId}`).then(setAntrean).catch(() => setAntrean([]))
  useEffect(() => { muatAntrean() }, [studioId]) // eslint-disable-line react-hooks/exhaustive-deps
  const muat = () => api(`/api/circle/tugas-saya?studioId=${studioId}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message))
  useEffect(() => { setD(null); muat() }, [studioId])
  useSegarkan(() => { muat(); muatAntrean() }, ['orders', 'penugasan', 'tugas'])

  async function jalankan(t, a) {
    setSibuk(t.id)
    try { const r = await api(`/api/circle/tugas/${t.id}/aksi`, { method: 'POST', body: { aksi: a.aksi } }); if (r?.lembur) alert('🌙 Tercatat sebagai lembur (tugas ditunda dikerjakan di luar jam kerja). Admin menilai hasilnya, koordinator menyetujui.') }
    catch (e) { alert(e.message) }   // mis. koordinator sudah memindahkan — muat ulang menampilkan keadaan terbaru
    setSibuk(null); muat()
  }
  if (galat) return <div className="galat blok">{galat}</div>
  if (!d) return <div className="redup tengah">Memuat tugasmu…</div>
  const aktif = d.tugas.filter(t => t.jenis !== 'SELESAI')
  // 📁 Folder proyek (Google Drive) order itu — update harian & file final talent di sini (12 Nov 2026, masukan tim)
  const Folder = ({ url }) => url ? <a className="btn kecil" href={url} target="_blank" rel="noreferrer noopener" title="Buka folder proyek (Google Drive)">📁 Folder</a> : null
  const bukaDetail = (id) => (e) => { if (!e.target.closest('button,input,label,select,a')) setDetailId(id) }
  const Baris = ({ t }) => (
    <div className={'tugas' + (lewatDeadline(t.deadline, t.jenis) ? ' telat' : '')} style={{ cursor: 'pointer' }} onClick={bukaDetail(t.id)} title="Klik untuk membuka detail order">
      <div><strong>{t.judul}</strong>{t.ditunda && <span className="lencana" style={{ marginLeft: 6 }} title="Admin menunda pekerjaan ini — bukan untuk hari ini">⏸ ditunda</span>}<div className="redup kecil">{t.klien}{t.ditunda ? ' · prioritas berikutnya / bisa untuk lembur' : ''}</div></div>
      <div className="tugas-kanan">
        <LabelKhusus daftar={t.khusus} />
        <Folder url={t.folder} />
        <span className={'tahap-lencana jenis-' + t.jenis}>{t.tahap}</span>
        {t.revisiKe > 0 && <span className="lencana revisi">↺ {t.revisiKe}</span>}
        <span className={'tgl' + (lewatDeadline(t.deadline, t.jenis) ? ' merah' : '')}>⏱ {tanggalPendek(t.deadline)}</span>
        {t.aksi?.map(a => <button key={a.aksi} className="btn kecil utama" disabled={sibuk === t.id} onClick={() => jalankan(t, a)}>{sibuk === t.id ? '…' : a.label}</button>)}
      </div>
    </div>
  )
  // Antreanku = daftar utama giliranmu (urut, dengan ⏳ on progress & centang Selesai). "Tugasku" hanya memuat yang TIDAK punya baris antrean (mis. tugas fase klien marketer).
  const lainnya = aktif.filter(t => !antrean.some(a => a.orderId === t.id))
  if (sembunyiKosong && aktif.length === 0 && antrean.length === 0) return null // admin tanpa tugas talent: cukup Kurasi & Invoice di atas
  return (
    <>
      <div className="ringkasan">
        <div className="stat"><span className="redup kecil">Tugas aktif</span><b>{d.ringkas.aktif}</b></div>
        <div className="stat"><span className="redup kecil">Selesai bulan ini</span><b>{d.ringkas.selesaiBulanIni}</b></div>
      </div>
      {antrean.length > 0 && (
        <div className="panel">
          <h3 className="judul-bagian">Antreanku{nama ? ` · ${nama}` : ''}</h3>
          <div className="redup kecil" style={{ marginBottom: 6 }}>Giliranmu sekarang. Centang <b>Selesai</b> bila rampung — order otomatis lanjut ke tahap berikutnya. 🔥 = kerjakan lebih dulu.</div>
          {antrean.map(a => {
            const t = d.tugas.find(x => x.id === a.orderId), lanjut = t?.aksi?.find(x => x.aksi === 'lanjut')
            return (
              <div className="tugas" key={a.id} style={{ cursor: 'pointer' }} onClick={bukaDetail(a.orderId)} title="Klik untuk membuka detail order">
                <div>
                  <b>{a.nomor}.</b> {a.mendesak && <span className="lencana" title="Ditandai mendesak — kerjakan lebih dulu">🔥 Mendesak</span>} <strong>{a.judul}</strong>
                  <div className="redup kecil">{a.klien} · {a.tahap}{t?.deadline ? ` · ⏱ ${tanggalPendek(t.deadline)}` : ''}</div>
                  {/* catatan proyek terbaru, mis. feedback klien yang diteruskan admin (16 Nov 2026, masukan tim) */}
                  {a.catatanTerbaru && <div className="kecil" style={{ marginTop: 2 }} title={`Catatan proyek oleh ${a.catatanTerbaru.nama}`}>💬 {a.catatanTerbaru.isi.length > 140 ? a.catatanTerbaru.isi.slice(0, 140) + '…' : a.catatanTerbaru.isi} <span className="redup">· {a.catatanTerbaru.nama}, {tanggalPendek(a.catatanTerbaru.waktu)}</span></div>}
                </div>
                <div className="tugas-kanan">
                  <LabelKhusus daftar={a.khusus} />
                  <Folder url={t?.folder ?? a.folder} />
                  <span title="Sedang dikerjakan">⏳ On progress</span>
                  <button className="btn kecil" title={a.mendesak ? 'Cabut tanda mendesak' : 'Tandai mendesak'} onClick={() => api(`/api/circle/penugasan/${a.id}/mendesak`, { method: 'POST' }).then(muatAntrean).catch(er => alert(er.message))}>{a.mendesak ? 'Cabut mendesak' : '🔥 Tandai mendesak'}</button>
                  <label className="centang" style={{ margin: 0 }} title={lanjut ? `Selesai → ${lanjut.label}` : 'Penutupan tahap ini dilakukan admin'}>
                    <input type="checkbox" checked={false} disabled={!lanjut || sibuk === t?.id} onChange={() => confirm(`Tandai "${a.judul}" selesai?\n\nOrder otomatis pindah: ${lanjut.label}.`) && jalankan(t, lanjut)} /> Selesai
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {antreanMuat && (lainnya.length > 0 || antrean.length === 0) && (
        <div className="panel" style={{ marginTop: antrean.length ? 14 : 0 }}>
          <h3 className="judul-bagian">Tugasku{antrean.length === 0 && nama ? ` · ${nama}` : ''}</h3>
          {lainnya.length === 0 ? <div className="kosong">Belum ada tugas aktif. 🎉</div> : lainnya.map(t => <Baris key={t.id} t={t} />)}
        </div>
      )}
      {/* "Ordermu di tahap lain" (Inbox/QC/Hold/klien) dihapus 11 Nov 2026: bukan giliranmu & tak ada yang bisa dilakukan → hanya mengganggu.
          Begitu order masuk tahap kerjamu, otomatis muncul di Antreanku. Pemantauan order ada di Produksi. */}
      {/* "Selesai bulan ini" (order Done) dipindah ke menu Tugas selesai (20 Nov 2026, masukan tim): Tugas saya = Antreanku & Tugasku saja */}
      {detailId && <DetailOrder orderId={detailId} onTutup={() => setDetailId(null)} />}
    </>
  )
}

const rp = (n) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'))
const jamWib = (t) => t ? new Date(t).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

// TUGAS ADMIN (12 Nov 2026, masukan tim): pengelola order melihat pekerjaan hariannya sendiri — kartu yang menunggu dikurasi (QC) dan order
// yang hasilnya sudah lewat QC tetapi belum dibuatkan invoice penuh. Admin per akun hanya melihat order akunnya (disaring server).
function TugasAdmin({ studioId, onJumlah }) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(null)
  const [detail, setDetail] = useState(null)
  const muat = () => api(`/api/circle/tugas-admin?studioId=${studioId}`).then(x => { setD(x); setGalat(''); onJumlah?.(x.ringkas) }).catch(e => setGalat(e.message))
  useEffect(() => { setD(null); muat() }, [studioId]) // eslint-disable-line react-hooks/exhaustive-deps
  useSegarkan(() => muat(), ['orders', 'tagihan', 'tugas'])
  const [pilih, setPilih] = useState({}) // orderId → tahapId tujuan
  const [tanyaAntrean, modalAntrean] = useTanyaAntrean()
  const [segarLembur, setSegarLembur] = useState(0)
  // 🌙 Tandai lembur (22 Nov 2026): tugas DITUNDA sudah diselesaikan talent, tetapi baru dikirim di jam kerja → admin menandainya lembur
  async function tandaiLembur(o) {
    if (!confirm(`Hitung "${o.tandaiLembur.tahap} – ${o.judul}" sebagai lembur? Setelah itu isi penilaiannya di bagian 🌙 Lembur perlu dinilai.`)) return
    try { await api('/api/circle/lembur/calon', { method: 'POST', body: { penugasanId: o.tandaiLembur.penugasanId } }); setSegarLembur(x => x + 1); muat() } catch (e) { alert(e.message) }
  }
  // Setelah dikurasi: pilih tahap tujuan dari alur. Tujuan = saran mesin ("QC lolos") → aksi biasa; tahap lain (mis. kembali ke Colouring
  // untuk revisi, atau Hold) → pindah manual pengelola. Kembali ke langkah kerja dihitung satu putaran revisi (server).
  async function pindahkan(o) {
    const lolos = o.aksi.find(a => a.aksi === 'lanjut'), ke = pilih[o.id] ?? lolos?.ke
    if (!ke) return
    const tujuan = d.tahap.find(t => t.id === ke), nama = tujuan?.nama ?? ''
    // Lolos QC ke tahap kerja berikutnya & ada talent berakun → pilih Masuk antrean / Tunda, sama dengan Produksi (16 Nov 2026, masukan tim)
    let antrean = true
    if (perluTanyaAntrean({ adaTalentInternal: o.adaTalentInternal, jenisTujuan: tujuan?.jenis })) { antrean = await tanyaAntrean({ judul: o.judul, talent: o.tim, tujuan: nama }); if (antrean === null) return }
    else if (!confirm(`Pindahkan "${o.judul}" ke ${nama}?`)) return
    setSibuk(o.id)
    const tunda = antrean === false ? { antrean: false } : {}
    try {
      if (lolos && ke === lolos.ke) await api(`/api/circle/orders/${o.id}/aksi`, { method: 'POST', body: { aksi: 'lanjut', ...tunda } })
      else await api(`/api/circle/orders/${o.id}/tahap`, { method: 'PATCH', body: { tahapId: ke, ...tunda } })
    } catch (e) { alert(e.message) }
    setSibuk(null); muat()
  }
  const labelTujuan = (o, t, iSekarang, i) => {
    const lolos = o.aksi.find(a => a.aksi === 'lanjut')
    if (lolos?.ke === t.id) return `✓ Lolos → ${t.nama}`
    if (i < iSekarang && ['KERJA', 'REVISI_INTERNAL'].includes(t.jenis)) return `↺ Revisi: ${t.nama}`
    return `→ ${t.nama}`
  }
  if (galat) return <div className="galat">{galat}</div>
  if (!d) return <div className="redup tengah">Memuat tugas admin…</div>
  const buka = (id, fokus = null) => (e) => { if (!e.target.closest('button,a')) setDetail({ id, fokus }) }
  return (
    <>
      <div className="ringkasan">
        <div className="stat"><span className="redup kecil">Menunggu dikurasi (QC)</span><b>{d.ringkas.qc}</b>{d.ringkas.qcHariIni > 0 && <span className="redup kecil">{d.ringkas.qcHariIni} masuk hari ini</span>}</div>
        {!d.hanyaQc && <div className="stat"><span className="redup kecil">Perlu dibuatkan invoice</span><b>{d.ringkas.invoice}</b></div>}
        {d.lemburAktif && <div className="stat"><span className="redup kecil">🌙 Lembur perlu dinilai</span><b>{d.ringkas.lembur}</b></div>}
      </div>
      <div className="panel">
        <h3 className="judul-bagian">Kurasi hari ini (QC)</h3>
        <div className="redup kecil" style={{ marginBottom: 6 }}>Hasil yang sudah diselesaikan talent dan menunggu dicek (tahap – order – talent), terbaru di atas. Setelah dikurasi pilih tujuannya: <b>✓ Lolos</b> ke tahap berikutnya atau <b>↺ Revisi</b> kembali ke talent. Klik kartu untuk membuka detail order.</div>
        {d.qc.length === 0 ? <div className="kosong">Tidak ada kartu di QC 🎉</div> : d.qc.map(o => (
          <div className="tugas" key={o.id} style={{ cursor: 'pointer' }} onClick={buka(o.id)} title="Klik untuk membuka detail order">
            <div>
              <strong>{o.asal || o.tahap}</strong> – {o.judul}{o.oleh ? ` – ${o.oleh}` : ''}{o.hariIni && <span className="lencana" style={{ marginLeft: 6 }}>hari ini</span>}{o.lembur && <span className="lencana" style={{ marginLeft: 6 }} title="Tugas ditunda yang diselesaikan di luar jam kerja">🌙 Lembur</span>} <LabelKhusus daftar={o.khusus} />
              <div className="redup kecil">{o.klien} · masuk QC {jamWib(o.masuk)}{o.tim.length ? ` · tim: ${o.tim.join(', ')}` : ''}</div>
            </div>
            <div className="tugas-kanan">
              {o.revisiKe > 0 && <span className="lencana revisi">↺ {o.revisiKe}</span>}
              {o.folder && <a className="btn kecil" href={o.folder} target="_blank" rel="noreferrer noopener" title="Buka folder proyek (Google Drive)">📁 Folder</a>}
              {o.tandaiLembur && <button className="btn kecil" onClick={() => tandaiLembur(o)} title="Tugas ini ditunda admin — hitung sebagai lembur bila dikerjakan di luar jam kerja">🌙 Tandai lembur</button>}
              {(() => { const iS = d.tahap.findIndex(t => t.id === o.tahapId), lolos = o.aksi.find(a => a.aksi === 'lanjut'); return (
                <select value={pilih[o.id] ?? lolos?.ke ?? ''} onChange={e => setPilih({ ...pilih, [o.id]: e.target.value })} title="Hasil kurasi: lanjut ke tahap berikutnya atau kembali untuk revisi" style={{ maxWidth: 220 }}>
                  {!lolos && <option value="">— pilih tahap —</option>}
                  {d.tahap.map((t, i) => t.id !== o.tahapId && (!d.hanyaQc || lolos?.ke === t.id || (i < iS && ['KERJA', 'REVISI_INTERNAL'].includes(t.jenis))) && <option key={t.id} value={t.id}>{labelTujuan(o, t, iS, i)}</option>)}
                </select>) })()}
              <button className="btn kecil utama" disabled={sibuk === o.id} onClick={() => pindahkan(o)}>{sibuk === o.id ? '…' : 'Pindahkan'}</button>
            </div>
          </div>
        ))}
      </div>
      {d.lemburAktif && <LemburDinilai studioId={studioId} segarkan={segarLembur} onUbah={muat} />}
      {!d.hanyaQc && <div className="panel">
        <h3 className="judul-bagian">Perlu dibuatkan invoice</h3>
        <div className="redup kecil" style={{ marginBottom: 6 }}>Project sudah Done (≤ 30 hari terakhir), belum lunas, dan harganya belum seluruhnya ditagih. Klik untuk membuka Pembayaran &amp; invoice.</div>
        {d.invoice.length === 0 ? <div className="kosong">Semua sudah ditagih 🎉</div> : d.invoice.map(o => (
          <div className="tugas" key={o.id} style={{ cursor: 'pointer' }} onClick={buka(o.id, 'invoice')} title="Klik untuk membuat invoice">
            <div>
              <strong>{o.judul}</strong>
              <div className="redup kecil">{o.klien} · {o.tahap} · harga {rp(o.harga)}{o.sudahDitagih > 0 ? ` · sudah ditagih ${rp(o.sudahDitagih)}` : ''}</div>
            </div>
            <div className="tugas-kanan">
              <span className="tgl">belum ditagih <b>{rp(o.belumDitagih)}</b></span>
              <button className="btn kecil utama" onClick={() => setDetail({ id: o.id, fokus: 'invoice' })}>🧾 Buat invoice</button>
            </div>
          </div>
        ))}
      </div>}
      {detail && <DetailOrder orderId={detail.id} fokus={detail.fokus} onTutup={() => { setDetail(null); muat() }} />}
      {modalAntrean}
    </>
  )
}

// TUGAS SAYA = satu pintu kerja harian sesuai peran (12 Nov 2026, masukan tim: menu jangan terlalu banyak). Talent: Pekerjaanku (antrean).
// Admin/koordinator/marketer: Update klien DULU lalu Pekerjaanku (masukan tim: tukar tempat). Untuk pengelola order, Pekerjaanku berisi
// Kurasi QC + Perlu invoice (TugasAdmin), lalu antrean kerjanya sendiri bila ia juga ditugaskan.
// Prospek (13 Nov 2026, masukan tim: tidak perlu pindah-pindah menu untuk mencatat chat baru) = komponen yang SAMA dengan Marketing → Prospek.
// Koordinator: tab Bayar freelance = ajuan pembayaran dari admin, tinggal transfer & klik Sudah dibayar (16 Nov 2026, masukan tim)
export default function TugasSaya({ studioId, nama, updateKlien = false, admin = false, koordinator = false, kurasiQc = false }) {
  const kunci = `tugas-sub-${studioId}`
  const [sub, setSubState] = useState(() => { try { const v = localStorage.getItem(kunci); return ['kerja', 'prospek', 'bayar', 'lembur'].includes(v) ? v : 'klien' } catch { return 'klien' } })
  const setSub = (v) => { setSubState(v); try { localStorage.setItem(kunci, v) } catch { /* abaikan */ } }
  const [terlewat, setTerlewat] = useState(null)
  const [jmlAdmin, setJmlAdmin] = useState(null)
  const [jmlAjuan, setJmlAjuan] = useState(null)
  useEffect(() => { if (koordinator) api(`/api/circle/bayar-freelance?studioId=${studioId}&ajuan=1`).then(x => setJmlAjuan(x.ringkas.ajuan)).catch(() => setJmlAjuan(null)) }, [studioId, koordinator])
  // Lembur menunggu persetujuan (18 Nov 2026, audit alur): dulu hanya di Kehadiran › Jam kerja & lembur → mudah terlupa sampai slip Final
  const [jmlLembur, setJmlLembur] = useState(null)
  useEffect(() => { if (koordinator) api(`/api/circle/lembur/menunggu?studioId=${studioId}`).then(x => setJmlLembur(x.jumlah)).catch(() => setJmlLembur(null)) }, [studioId, koordinator])
  useEffect(() => { if (admin) api(`/api/circle/tugas-admin?studioId=${studioId}`).then(x => setJmlAdmin(x.ringkas)).catch(() => setJmlAdmin(null)) }, [studioId, admin])
  useEffect(() => { if (!updateKlien) return; let b = 2; try { b = Number(localStorage.getItem('uo-batas-update')) || 2 } catch { /* bawaan */ } api(`/api/circle/update-klien?studioId=${studioId}&batas=${b}`).then(x => setTerlewat(x.ringkasan?.terlewat ?? 0)).catch(() => setTerlewat(null)) }, [studioId, updateKlien, sub])
  // PM/QC (18 Nov 2026): Kurasi QC di atas antrean kerjanya sendiri (tanpa bagian invoice)
  const kerja = admin
    ? <><TugasAdmin studioId={studioId} onJumlah={setJmlAdmin} /><div style={{ marginTop: 14 }}><Pekerjaanku studioId={studioId} nama={nama} sembunyiKosong /></div></>
    : kurasiQc ? <><TugasAdmin studioId={studioId} /><div style={{ marginTop: 14 }}><Pekerjaanku studioId={studioId} nama={nama} /></div></>
    : <Pekerjaanku studioId={studioId} nama={nama} />
  if (!updateKlien) return kerja
  return (
    <div>
      <div className="chips" style={{ marginBottom: 12 }}>
        <button type="button" className={'btn kecil' + (sub === 'klien' ? ' utama' : '')} onClick={() => setSub('klien')}>Update klien{terlewat ? ` · ${terlewat} terlewat` : ''}</button>
        <button type="button" className={'btn kecil' + (sub === 'prospek' ? ' utama' : '')} onClick={() => setSub('prospek')}>Prospek</button>
        <button type="button" className={'btn kecil' + (sub === 'kerja' ? ' utama' : '')} onClick={() => setSub('kerja')}>Pekerjaanku{admin && jmlAdmin ? ` · ${jmlAdmin.qc} QC · ${jmlAdmin.invoice} invoice${jmlAdmin.lembur ? ` · 🌙 ${jmlAdmin.lembur} lembur` : ''}` : ''}</button>
        {koordinator && <button type="button" className={'btn kecil' + (sub === 'bayar' ? ' utama' : '')} onClick={() => setSub('bayar')}>Bayar freelance{jmlAjuan ? ` · ${jmlAjuan}` : ''}</button>}
        {koordinator && <button type="button" className={'btn kecil' + (sub === 'lembur' ? ' utama' : '')} onClick={() => setSub('lembur')}>Lembur{jmlLembur ? ` · ${jmlLembur}` : ''}</button>}
      </div>
      {sub === 'klien' ? <UpdateKlien key={studioId} studioId={studioId} /> : sub === 'prospek' ? <MkProspek key={studioId} studioId={studioId} /> : sub === 'bayar' && koordinator ? <BayarFreelance key={studioId} studioId={studioId} hanyaAjuan onJumlah={setJmlAjuan} /> : sub === 'lembur' && koordinator ? <LemburMenunggu key={studioId} studioId={studioId} onJumlah={setJmlLembur} /> : kerja}
    </div>
  )
}
