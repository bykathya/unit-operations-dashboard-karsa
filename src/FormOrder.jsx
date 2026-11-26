import { useEffect, useState } from 'react'
import { api } from './api'
import { PilihKategori, InputRupiah, InputAngka } from './Pilihan'

// Akun jualan WAJIB dipilih (fee platform menentukan nilai bersih; Penjualan & Laporan Mingguan membaca platform akun).
// 'INTERNAL' = order internal tanpa platform (akun sistem "Order Internal", fee 0).
export function useAkunOrder(studioId) {
  const [akun, setAkun] = useState(null)
  useEffect(() => { api(`/api/circle/marketing/akun?studioId=${studioId}`).then(d => setAkun((d.akun ?? []).filter(a => a.namaAkun !== 'Order Internal'))).catch(() => setAkun([])) }, [studioId])
  return akun
}
// Daftar nama freelance yang pernah dicatat (LTK / data freelancer unit) untuk saran isian — tanpa data rekening (9 Nov 2026)
export function useFreelancer(studioId) {
  const [d, setD] = useState([])
  useEffect(() => { api(`/api/circle/ltk/opsi?studioId=${studioId}`).then(x => setD((x.pihak ?? []).filter(p => p.jenisPihak === 'FREELANCE'))).catch(() => setD([])) }, [studioId])
  return d
}
// Direktori klien unit (10 Nov 2026): saran nama klien + info repeat order; gagal (mis. peran tanpa akses) → daftar kosong, ketik bebas tetap bisa
export function useKlien(studioId) {
  const [d, setD] = useState([])
  useEffect(() => { api(`/api/circle/klien?studioId=${studioId}`).then(x => setD(x.klien ?? [])).catch(() => setD([])) }, [studioId])
  return d
}
// Kurs bawaan form USD (13 Nov 2026): kurs Laporan Mingguan TERBARU unit (menu Keuangan) — satu sumber kurs; tetap bisa diganti per order.
// `isi(setF)`: isi kurs ke state form bila masih kosong (belum diketik pengguna).
export function useKurs(studioId, setF) {
  const [k, setK] = useState(null)
  useEffect(() => { if (!studioId) return; api(`/api/circle/kurs?studioId=${studioId}`).then(x => setK(x)).catch(() => setK({ kurs: 16000, dari: 'bawaan' })) }, [studioId])
  useEffect(() => { if (k && setF) setF(f => (f.kurs === '' || f.kurs == null ? { ...f, kurs: String(Math.round(k.kurs)) } : f)) }, [k]) // eslint-disable-line react-hooks/exhaustive-deps
  return k
}
export const KetKurs = ({ k }) => (k ? <span className="redup kecil">{k.dari === 'laporan' ? `kurs dari Laporan Mingguan terbaru (${k.periode}) · ubah di menu Keuangan` : 'kurs bawaan — belum ada Laporan Mingguan'}</span> : null)
export function PilihAkun({ akun, value, onChange }) {
  return (
    <label>Akun jualan<select value={value} onChange={e => onChange(e.target.value)} required>
      <option value="">— pilih akun —</option>
      {(akun ?? []).map(a => <option key={a.id} value={a.id}>{a.platform} · {a.namaAkun}</option>)}
      <option value="INTERNAL">Order internal (tanpa platform, fee 0)</option>
    </select>{akun && akun.length === 0 && <span className="redup kecil">Belum ada akun jualan — isi di menu Akun jualan, atau pilih order internal.</span>}</label>
  )
}

export const TIPE = [
  { v: 'INTERNAL_JRU_LAIN', l: 'Circle / studio lain' },
  { v: 'INTERNAL_EKOSISTEM', l: 'Internal ekosistem' },
  { v: 'EKSTERNAL', l: 'Eksternal' },
]

// Tempel banyak: satu order per baris — Judul, Klien, Nilai, Deadline. Pemisah: Tab (salin dari spreadsheet), "|", ";", atau 2+ spasi.
// Baris berspasi biasa juga dibaca (9 Nov 2026, laporan tim Langit): tanggal (dd/mm[/yy]) & nilai (Rp …/angka) dikenali di mana pun,
// sisanya = Judul + Klien (kata terakhir = klien). Hasil bacaan ditampilkan sebelum disimpan supaya bisa diperiksa.
const POLA_TGL = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$|^\d{4}-\d{2}-\d{2}$/
const keTanggal = (t, tahun) => {
  const m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (m) return `${m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : tahun}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
}
const angkaUang = (t) => Number(String(t).replace(/[^\d]/g, '')) || 0
const tampakUang = (t) => /^rp\.?\s*[\d.,]+$/i.test(t) || /^\d{1,3}([.,]\d{3})+$/.test(t) || /^\d{4,}$/.test(t)
function urai(teks) {
  const tahun = new Date().getFullYear()
  return teks.split('\n').map(b => b.trim()).filter(Boolean).map(b => {
    let bagian = b.split(/\t|\s*\|\s*|\s*;\s*| {2,}/).map(x => x.trim()).filter(Boolean)
    let deadline = null, nilai = 0
    if (bagian.length >= 2) {
      const sisa = []
      for (const x of bagian) { if (!deadline && POLA_TGL.test(x)) deadline = keTanggal(x, tahun); else if (!nilai && tampakUang(x)) nilai = angkaUang(x); else sisa.push(x) }
      if (sisa.length >= 2) return { judul: sisa[0], klien: sisa[1], nilaiDisepakati: nilai, deadline }
      deadline = null; nilai = 0 // kolom tidak lengkap (mis. dua spasi tak sengaja) → baca ulang kata per kata
    }
    // satu spasi: gabungkan "Rp 650.000" lalu kenali token tanggal & uang
    const token = b.replace(/\bRp\.?\s+(?=\d)/gi, 'Rp').split(/\s+/)
    const kata = []
    for (const x of token) { if (!deadline && POLA_TGL.test(x)) deadline = keTanggal(x, tahun); else if (!nilai && tampakUang(x)) nilai = angkaUang(x); else kata.push(x) }
    const klien = kata.length >= 2 ? kata.pop() : ''
    return { judul: kata.join(' '), klien, nilaiDisepakati: nilai, deadline }
  })
}

export default function FormOrder({ studioId, anggota, marketer, bisaFee, onTutup, onSimpan }) {
  const [mode, setMode] = useState('satu')
  const [f, setF] = useState({ judul: '', klien: '', tipeKlien: 'INTERNAL_JRU_LAIN', nilaiDisepakati: '', deadline: '', talentUserId: '', mataUang: 'IDR', nilaiUsd: '', kurs: '', akunId: '', kategori: '', feeTalent: '', marketerId: '' })
  const akun = useAkunOrder(studioId)
  const kurs = useKurs(studioId, setF)
  const freelancer = useFreelancer(studioId)
  const klienDir = useKlien(studioId)
  const [tempel, setTempel] = useState('')
  const [galat, setGalat] = useState('')
  const [proses, setProses] = useState(false)
  const baris = mode === 'banyak' ? urai(tempel) : []
  // nama klien yang tampak nominal ('Rp 650.000') = salah baca tempelan → dilewati & ditandai merah (laporan tim 10 Nov 2026)
  const klienNominal = (k) => /^(rp\.?\s*)?\d[\d.,\s]*$/i.test(String(k ?? '').trim()) || /\brp\.?\s*\d/i.test(String(k ?? ''))
  const sah = baris.filter(b => b.judul && b.klien && !klienNominal(b.klien))

  async function simpan(e) {
    e.preventDefault()
    setProses(true); setGalat('')
    try {
      if (mode === 'satu') {
        await api('/api/circle/orders', { method: 'POST', body: { studioId, ...f, internal: undefined, pekerjaanInternal: f.internal || undefined, marketerId: f.marketerId || undefined, ...(f.mataUang === 'USD' ? { nilaiUsd: Number(f.nilaiUsd), kurs: Number(f.kurs) } : { mataUang: 'IDR', nilaiUsd: undefined, kurs: undefined }), talentUserId: f.talentUserId && f.talentUserId !== '__freelance' ? f.talentUserId : undefined, namaFreelance: f.talentUserId === '__freelance' ? (f.namaFreelance || '').trim() || undefined : undefined, deadline: f.deadline || undefined, kategori: f.kategori || undefined, feeTalent: bisaFee && f.talentUserId && String(f.feeTalent).replace(/[^\d]/g, '') ? Number(String(f.feeTalent).replace(/[^\d]/g, '')) : undefined } })
      } else {
        for (const b of sah) await api('/api/circle/orders', { method: 'POST', body: { studioId, tipeKlien: 'INTERNAL_JRU_LAIN', akunId: f.akunId, ...b } })
      }
      onSimpan()
    } catch (err) { setGalat(err.message); setProses(false) }
  }

  return (
    <div className="modal-latar" onClick={onTutup}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={simpan}>
        <h3>Tambah order</h3>
        <div className="tab-mini">
          <button type="button" className={mode === 'satu' ? 'aktif' : ''} onClick={() => setMode('satu')}>Satu order</button>
          <button type="button" className={mode === 'banyak' ? 'aktif' : ''} onClick={() => setMode('banyak')}>Tempel banyak</button>
        </div>
        {mode === 'satu' ? (
          <>
            <label>Judul / nama karakter<input value={f.judul} onChange={e => setF({ ...f, judul: e.target.value })} autoFocus required /></label>
            {/* Pekerjaan internal (20 Nov 2026, masukan tim): porto / persiapan sebelum klien order — kerja nyata tanpa klien & uang,
                tidak dihitung order klien (omset, order masuk, laporan grup). Hanya pengelola/admin (bisaFee). */}
            {bisaFee && <label className="centang" style={{ margin: '4px 0' }}><input type="checkbox" checked={!!f.internal} onChange={e => setF({ ...f, internal: e.target.checked ? 'PORTO' : '' })} /> Pekerjaan internal — tanpa klien &amp; uang (porto / persiapan sebelum klien order)</label>}
            {f.internal && <label>Jenis<select value={f.internal} onChange={e => setF({ ...f, internal: e.target.value })}><option value="PORTO">Porto</option><option value="PERSIAPAN">Persiapan (belum order — dijadikan order klien saat klien memesan)</option></select><span className="redup kecil">Tetap di Produksi & antrean talent, tidak dihitung omset / order masuk / laporan ke grup.</span></label>}
            {!f.internal && <>
            <div className="dua">
              <label>Klien (circle / studio)<input list="daftar-klien" value={f.klien} onChange={e => setF({ ...f, klien: e.target.value })} required autoComplete="off" placeholder="ketik untuk mencari klien yang sudah ada" />
                <datalist id="daftar-klien">{klienDir.map(k => <option key={k.id} value={k.nama}>{[k.panggilan, k.asal, k.jumlahOrder ? `${k.jumlahOrder}× order` : null].filter(Boolean).join(' · ')}</option>)}</datalist>
                {(() => { const k = klienDir.find(x => x.nama.toLowerCase() === f.klien.trim().toLowerCase()); return f.klien.trim() && (k ? <span className="redup kecil">{k.jumlahOrder > 0 ? `Klien repeat — sudah ${k.jumlahOrder}× order di kita.` : 'Klien sudah ada di direktori.'}</span> : <span className="redup kecil">Klien baru — otomatis masuk direktori klien.</span>) })()}</label>
              <label>Jenis klien<select value={f.tipeKlien} onChange={e => setF({ ...f, tipeKlien: e.target.value })}>{TIPE.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select></label>
            </div>
            <PilihAkun akun={akun} value={f.akunId} onChange={v => setF({ ...f, akunId: v })} />
            {/* Marketer pemegang (18 Nov 2026): dipilih pengelola/Admin Market; kosong = otomatis (kamu, bila kamu marketer) */}
            {marketer?.length > 0 && <label>Marketer pemegang<select value={f.marketerId} onChange={e => setF({ ...f, marketerId: e.target.value })}>
              <option value="">— otomatis (pencatat bila marketer) —</option>
              {marketer.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select><span className="redup kecil">Marketer yang mengabari klien order ini (Update klien, cicilan, laporan per marketer).</span></label>}
            <div className="tab-mini" style={{ marginBottom: 2 }}><button type="button" className={f.mataUang === 'IDR' ? 'aktif' : ''} onClick={() => setF({ ...f, mataUang: 'IDR' })}>Rupiah</button><button type="button" className={f.mataUang === 'USD' ? 'aktif' : ''} onClick={() => setF({ ...f, mataUang: 'USD' })}>USD (Fiverr/Etsy/Vgen)</button></div>
            </>}
            <div className="dua">
              {!f.internal && (f.mataUang === 'IDR'
                ? <label>Nilai disepakati (Rp)<InputAngka terbilang value={f.nilaiDisepakati} onChange={e => setF({ ...f, nilaiDisepakati: e.target.value.replace(/[^\d]/g, '') })} /></label>
                : <label>Nilai kotor (USD) × kurs<div className="chips"><input inputMode="decimal" style={{ width: 110 }} value={f.nilaiUsd} onChange={e => setF({ ...f, nilaiUsd: e.target.value.replace(/[^\d.]/g, '') })} placeholder="USD" required /><span>×</span><input inputMode="numeric" style={{ width: 90 }} value={f.kurs} onChange={e => setF({ ...f, kurs: e.target.value.replace(/[^\d]/g, '') })} placeholder="kurs" required /></div>
                  <span className="redup kecil">= Rp {Math.round((Number(f.nilaiUsd) || 0) * (Number(f.kurs) || 0)).toLocaleString('id-ID')}</span><KetKurs k={kurs} /></label>)}
              <label>Deadline<input type="date" value={f.deadline} onChange={e => setF({ ...f, deadline: e.target.value })} /></label>
            </div>
            <label>Talent<select value={f.talentUserId} onChange={e => setF({ ...f, talentUserId: e.target.value, ...(e.target.value !== '__freelance' ? { namaFreelance: '' } : {}) })}>
              <option value="">— belum ditentukan —</option>
              {anggota.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
              <option value="__freelance">+ Freelance (tulis nama)…</option>
            </select></label>
            {f.talentUserId === '__freelance' && <label>Nama freelance<input list="daftar-freelance" value={f.namaFreelance ?? ''} onChange={e => setF({ ...f, namaFreelance: e.target.value })} placeholder="ketik nama / pilih dari daftar" maxLength={200} required />
              <datalist id="daftar-freelance">{freelancer.map(p => <option key={p.nama} value={p.nama}>{[p.skill, p.kontak].filter(Boolean).join(' · ')}</option>)}</datalist>
              <span className="redup kecil">Freelance tidak perlu akun. Marketer pemegang order bisa menggeser tahap kerjanya; QC tetap koordinator.</span></label>}
            {/* Sekalian lengkap seperti detail order (13 Nov 2026, masukan tim): fee talent (pengelola saja) & kategori */}
            {bisaFee && !f.internal && f.talentUserId && <label>Fee talent (Rp, opsional)<InputRupiah value={f.feeTalent} onChange={v => setF({ ...f, feeTalent: v })} placeholder="kosongkan bila belum tahu" /></label>}
            <div className="isian">Kategori (opsional)<PilihKategori studioId={studioId} value={f.kategori} onChange={v => setF({ ...f, kategori: v })} /></div>
          </>
        ) : (
          <>
            <PilihAkun akun={akun} value={f.akunId} onChange={v => setF({ ...f, akunId: v })} />
            <label>Satu order per baris: <code>Judul · Klien · Nilai · Deadline</code> <span className="redup kecil">(pisahkan dengan Tab, |, atau ;)</span>
              <textarea rows={8} value={tempel} onChange={e => setTempel(e.target.value)} placeholder={'Hifumi\tCRS\t200000\t04/10\nPindlebear\tRUMSAS\t200000\t10/10'} />
            </label>
            {baris.length > 0 && <table className="kecil" style={{ marginBottom: 6 }}><thead><tr><th>Judul</th><th>Klien</th><th className="kanan">Nilai</th><th>Deadline</th></tr></thead>
              <tbody>{baris.slice(0, 30).map((b, i) => <tr key={i} className={b.judul && b.klien && !klienNominal(b.klien) ? '' : 'redup'}><td>{b.judul || '—'}</td><td>{b.klien ? (klienNominal(b.klien) ? <span className="nada-bad">{b.klien} — tampak nominal, bukan nama klien</span> : b.klien) : <span className="nada-bad">klien kosong</span>}</td><td className="kanan">{b.nilaiDisepakati ? 'Rp ' + b.nilaiDisepakati.toLocaleString('id-ID') : '—'}</td><td>{b.deadline ?? '—'}</td></tr>)}</tbody></table>}
            <p className="redup kecil">Periksa tabel di atas: bila judul/klien tertukar, pisahkan kolom dengan Tab (salin dari spreadsheet) atau tanda | — contoh: <code>Blue (Aura) | Abstraclab | 650000 | 14/10/26</code>.</p>
            <p className="redup kecil">{sah.length} order siap ditambahkan{baris.length > sah.length ? ` · ${baris.length - sah.length} baris dilewati (judul/klien kosong atau klien tampak nominal)` : ''}. Semua masuk ke Inbox.</p>
          </>
        )}
        {galat && <div className="galat">{galat}</div>}
        <div className="modal-aksi">
          <button type="button" className="btn" onClick={onTutup}>Batal</button>
          <button className="btn utama" disabled={proses || (!f.akunId && !(mode === 'satu' && f.internal)) || (mode === 'banyak' && sah.length === 0)}>{proses ? 'Menyimpan…' : mode === 'banyak' ? `Tambah ${sah.length} order` : 'Tambah ke Inbox'}</button>
        </div>
      </form>
    </div>
  )
}
