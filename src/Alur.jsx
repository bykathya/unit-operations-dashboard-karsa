import { useEffect, useState } from 'react'
import { api } from './api'

const LABEL = { MASUK: 'Inbox', KERJA: 'Pengerjaan', QC: 'QC', REVISI_INTERNAL: 'Revisi internal', PREVIEW_KLIEN: 'Preview klien', REVISI_KLIEN: 'Revisi klien', MENUNGGU_KLIEN: 'Menunggu klien', FINALISASI: 'Finalisasi', DELIVERY: 'Delivery', HOLD: 'Hold', SELESAI: 'Selesai' }
// Jenis "tengah" bisa diganti satu sama lain (9 Nov 2026) — juga untuk langkah yang sudah dipakai order (status order tetap Proses).
// Inbox, Selesai, dan gerbang QC/Revisi internal tetap terkunci.
const JENIS_TENGAH = ['KERJA', 'PREVIEW_KLIEN', 'REVISI_KLIEN', 'MENUNGGU_KLIEN', 'FINALISASI', 'DELIVERY', 'HOLD']
// Siapa memegang tiap JENIS tahap — sama untuk SEMUA studio (nama & jumlah tahap bebas diatur studio; yang tetap adalah jenisnya). 10 Nov 2026.
const PEMEGANG = {
  MASUK: ['Admin', 'Inbox: admin menugaskan talent lalu memindahkan kartu ke pengerjaan. Bukan antrean talent.'],
  KERJA: ['Antrean talent', 'Pengerjaan: masuk Tugas saya & Antrean talent yang ditugaskan.'],
  QC: ['Admin', 'Kurasi/QC oleh admin. Bukan antrean talent.'],
  REVISI_INTERNAL: ['Antrean talent', 'Revisi dari hasil QC: masuk antrean talent.'],
  PREVIEW_KLIEN: ['Admin/marketer (klien)', 'Menunjukkan hasil ke klien. Bukan antrean talent.'],
  REVISI_KLIEN: ['Antrean talent', 'Revisi dari klien: masuk antrean talent.'],
  MENUNGGU_KLIEN: ['Admin/marketer (klien)', 'Menunggu respons klien. Bukan antrean talent.'],
  FINALISASI: ['Antrean talent', 'Talent menyiapkan file siap kirim: masuk antrean talent.'],
  DELIVERY: ['Admin/marketer (klien)', 'Admin mengirim ke klien & menunggu klien menerima. Bukan antrean talent.'],
  HOLD: ['Admin', 'Ditahan (menunggu kejelasan). Bukan antrean talent.'],
  SELESAI: ['Selesai', 'Pekerjaan selesai.'],
}
const INGIN_OPSIONAL = ['PREVIEW_KLIEN', 'REVISI_KLIEN', 'KERJA', 'QC', 'REVISI_INTERNAL']

// Editor alur per studio: NAMA langkah bebas diubah (diksi 3D ≠ ilustrasi), JENIS langkah adalah mesinnya.
export default function Alur({ studioId }) {
  const [data, setData] = useState(null)
  const [langkah, setLangkah] = useState([])
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')
  const [simpan, setSimpan] = useState(false)

  const muat = () => api(`/api/circle/templat?studioId=${studioId}`).then(d => { setData(d); setLangkah(d.langkah); setGalat('') }).catch(e => setGalat(e.message))
  useEffect(() => { setData(null); muat() }, [studioId])

  const ubah = (i, patch) => setLangkah(l => l.map((x, n) => (n === i ? { ...x, ...patch } : x)))
  const geser = (i, arah) => setLangkah(l => { const n = [...l]; const j = i + arah; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n })
  const hapus = (i) => setLangkah(l => { const x = l[i]; const hilang = new Set([x.id ?? x.kunci]); return l.filter(y => !hilang.has(y.id ?? y.kunci) && !hilang.has(y.indukId)) })
  function tambahKerja(denganQc) {
    const nama = window.prompt('Nama tahap pengerjaan baru (mis. Coloring, Modeling, Rigging):')
    if (!nama?.trim()) return
    const kunci = 'baru:' + Math.random().toString(36).slice(2, 7)
    const baru = [{ kunci, nama: nama.trim(), jenis: 'KERJA', opsional: false, aktifBawaan: true, order: 0 }]
    if (denganQc) baru.push({ kunci: kunci + ':qc', nama: `QC: ${nama.trim()}`, jenis: 'QC', indukId: kunci, opsional: false, aktifBawaan: true, order: 0 }, { kunci: kunci + ':ri', nama: `Revisi: ${nama.trim()}`, jenis: 'REVISI_INTERNAL', indukId: kunci, opsional: false, aktifBawaan: true, order: 0 })
    // sisip sebelum langkah akhir pengerjaan: sebelum Preview klien / Hold / Selesai pertama
    setLangkah(l => { const i = l.findIndex(x => ['PREVIEW_KLIEN', 'REVISI_KLIEN', 'HOLD', 'SELESAI'].includes(x.jenis)); const n = [...l]; n.splice(i < 0 ? n.length : i, 0, ...baru); return n })
  }
  async function kirim(badan) {
    setSimpan(true); setGalat(''); setInfo('')
    try {
      const hasil = await api(`/api/circle/templat?studioId=${studioId}`, { method: 'PUT', body: badan })
      setInfo(hasil?.orderDipindah ? `Templat diterapkan. ${hasil.orderDipindah} order dipindahkan otomatis ke langkah yang paling mirip.` : 'Alur tersimpan.'); await muat()
    } catch (e) { setGalat(e.message) } finally { setSimpan(false) }
  }
  const simpanSunting = () => kirim({ langkah: langkah.map((l, i) => ({ id: l.id, kunci: l.kunci, nama: l.nama, jenis: l.jenis, indukId: l.indukId ?? null, urutan: i + 1, opsional: !!l.opsional, aktifBawaan: l.aktifBawaan ?? true })) })
  const adaOrder = langkah.some(l => l.order > 0)

  if (galat && !data) return <div className="galat blok">{galat}</div>
  if (!data) return <div className="redup tengah">Memuat alur…</div>
  const nama = Object.fromEntries(langkah.map(l => [l.id ?? l.kunci, l.nama]))

  return (
    <div className="panel">
      <h3 className="judul-bagian">Alur proses studio ini</h3>
      <div className="panel" style={{ marginBottom: 10 }}>
        <b>Alur tiap studio boleh berbeda — aturannya sama.</b> Nama dan jumlah tahap pengerjaan bebas kamu atur sesuai studio; yang tetap adalah <b>jenis</b> tahap, karena jenis menentukan <b>siapa yang memegang</b> kartunya:
        <div className="kecil" style={{ marginTop: 6 }}>🛠 <b>Antrean talent</b> (muncul di Tugas saya talent): <b>Pengerjaan, Revisi, Finalisasi</b> · <b>Admin</b>: Inbox, QC, Hold · <b>Admin/marketer (klien)</b>: Preview klien, Menunggu client, Delivery. Lencana di setiap langkah di bawah menunjukkan pemegangnya.</div>
      </div>
      {/* QC semua (12 Nov 2026, masukan tim): hasil talent selalu dicek admin di QC dulu */}
      <label className="panel centang" style={{ marginBottom: 10, alignItems: 'flex-start', gap: 10, flexDirection: 'row', display: 'flex' }}>
        <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={!!data.qcSemua} disabled={simpan || !langkah.some(l => l.jenis === 'QC')} onChange={async e => { setGalat(''); setInfo(''); try { const h = await api('/api/circle/templat/qc-semua', { method: 'PUT', body: { studioId, aktif: e.target.checked } }); setData(d => ({ ...d, qcSemua: h.qcSemua })); setInfo(h.qcSemua ? 'Semua hasil talent kini masuk QC dulu.' : 'Hasil talent kembali mengikuti urutan alur.') } catch (er) { setGalat(er.message) } }} />
        <span><b>Hasil talent selalu dicek admin (QC) dulu</b><span className="redup kecil" style={{ display: 'block', fontWeight: 400 }}>Kalau dicentang, setiap kali talent menandai selesai — di tahap Pengerjaan, <b>Revisi klien</b>, maupun <b>Finalisasi</b> — kartu masuk QC dulu. Setelah admin klik "QC lolos", kartu lanjut ke langkah berikutnya (mis. Revisi klien → Preview klien, Finalisasi → Delivery).{langkah.some(l => l.jenis === 'QC') ? '' : ' Alur ini belum punya langkah QC — tambahkan "Tahap pengerjaan (dengan QC)" dulu.'}</span></span>
      </label>
      <p className="redup kecil">Ubah <b>nama</b> langkah sesuai diksi studio. <b>Jenis</b> langkah (pengerjaan, preview klien, menunggu klien, revisi klien, dll.) menentukan aturan alurnya dan siapa yang menggeser — pilih di kotak kiri. Inbox, Selesai, dan gerbang QC tidak bisa diganti. Perubahan tidak mengganggu order yang sedang berjalan.</p>

      <p className="redup kecil"><b>Boleh dilewati</b> = tahap ini tidak wajib; tiap order bisa memilih memakainya atau melewatinya (mis. QC atau Preview klien untuk order kecil). <b>Otomatis dipakai di order baru</b> = order baru langsung melewati tahap ini; kalau tidak dicentang, tahap ini dilewati dulu dan baru dipakai bila diaktifkan lewat menu ⋯ di kartu order. Tahap yang tidak dicentang "boleh dilewati" selalu dipakai di semua order.</p>
      <div className="alur-daftar">
        {langkah.map((l, i) => (
          <div key={l.id ?? l.kunci} className={'alur-baris' + (l.indukId ? ' gerbang' : '')}>
            {JENIS_TENGAH.includes(l.jenis)
              ? <select className={'tahap-lencana jenis-' + l.jenis.split('_')[0]} style={{ width: 'auto' }} value={l.jenis} onChange={e => ubah(i, { jenis: e.target.value })} title="Jenis langkah menentukan aturannya: Preview klien & Menunggu klien = bagian marketer, Pengerjaan = bagian talent" aria-label="Jenis langkah">{JENIS_TENGAH.map(j => <option key={j} value={j}>{LABEL[j]}</option>)}</select>
              : <span className={'tahap-lencana jenis-' + l.jenis.split('_')[0]}>{LABEL[l.jenis] ?? l.jenis}</span>}
            <input value={l.nama} onChange={e => ubah(i, { nama: e.target.value })} aria-label="Nama langkah" />
            {PEMEGANG[l.jenis] && <span className={'lencana' + (PEMEGANG[l.jenis][0] === 'Antrean talent' ? ' revisi' : '')} title={PEMEGANG[l.jenis][1]}>{PEMEGANG[l.jenis][0] === 'Antrean talent' ? '🛠 ' : ''}{PEMEGANG[l.jenis][0]}</span>}
            {l.indukId && <span className="redup kecil">menjaga: {nama[l.indukId]}</span>}
            {INGIN_OPSIONAL.includes(l.jenis) && (
              <label className="centang kecil" title="Tahap ini tidak wajib di semua order: tiap order bisa memilih memakainya atau melewatinya (lewat menu ⋯ di kartu order → Atur tahap yang dipakai)"><input type="checkbox" checked={!!l.opsional} onChange={e => ubah(i, { opsional: e.target.checked })} /> boleh dilewati</label>
            )}
            {l.opsional && <label className="centang kecil" title="Dicentang: order baru langsung memakai tahap ini. Tidak dicentang: di order baru tahap ini dilewati dulu, dan baru dipakai kalau diaktifkan lewat kartu order."><input type="checkbox" checked={l.aktifBawaan ?? true} onChange={e => ubah(i, { aktifBawaan: e.target.checked })} /> otomatis dipakai di order baru</label>}
            <span className="spasi" />
            {l.order > 0 && <span className="lencana" title="Order yang memakai langkah ini">{l.order} order</span>}
            <button className="btn kecil" onClick={() => geser(i, -1)} disabled={i === 0} aria-label="Naik">↑</button>
            <button className="btn kecil" onClick={() => geser(i, 1)} disabled={i === langkah.length - 1} aria-label="Turun">↓</button>
            <button className="btn kecil" onClick={() => hapus(i)} disabled={l.order > 0 || ['MASUK', 'SELESAI'].includes(l.jenis)} title={l.order > 0 ? 'Masih dipakai order' : 'Hapus'}>✕</button>
          </div>
        ))}
      </div>

      <div className="alur-aksi">
        <button className="btn" onClick={() => tambahKerja(true)}>+ Tahap pengerjaan (dengan QC)</button>
        <button className="btn" onClick={() => tambahKerja(false)}>+ Tahap pengerjaan (tanpa QC)</button>
        <span className="spasi" />
        <button className="btn utama" onClick={simpanSunting} disabled={simpan}>{simpan ? 'Menyimpan…' : 'Simpan alur'}</button>
      </div>
      {galat && <div className="galat" style={{ marginTop: 10 }}>{galat}</div>}
      {info && <div className="ok-info">{info}</div>}

      <h3 className="judul-bagian" style={{ marginTop: 22 }}>Mulai dari templat</h3>
      <p className="redup kecil">{adaOrder ? 'Sudah ada order di alur ini. Kamu tetap bisa ganti templat: order akan dipindahkan otomatis ke langkah baru yang paling mirip (mis. "Pengerjaan" → langkah pengerjaan pertama), riwayatnya tercatat, dan tidak ada order yang hilang.' : 'Menerapkan templat mengganti seluruh alur studio ini.'}</p>
      <div className="alur-preset">
        {data.preset.map(p => (
          <button key={p.kunci} className="btn" disabled={simpan} onClick={() => window.confirm(adaOrder ? `Ganti alur studio ini dengan templat "${p.kunci}"?\n\n${langkah.reduce((n, l) => n + (l.order || 0), 0)} order yang sudah ada akan dipindahkan otomatis ke langkah baru yang paling mirip. Riwayat tercatat. Lanjutkan?` : `Ganti alur studio ini dengan templat "${p.kunci}"?`) && kirim({ preset: p.kunci, ...(adaOrder ? { pindahkanOrder: true } : {}) })}>
            <b>{p.kunci}</b><span className="redup kecil"> — {p.label.split(' — ')[1] ?? p.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
