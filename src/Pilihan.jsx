import { useEffect, useState } from 'react'
import { api } from './api'

// Komponen isian bersama (10 Nov 2026, masukan tim): kategori = pilihan (bukan ketik bebas, hindari typo) dan nominal rupiah
// yang otomatis terformat + terbilang (supaya kurang/lebih angka 0 langsung ketahuan).

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']
function bagi(n) { // 0 < n < 1000
  if (n < 12) return SATUAN[n]
  if (n < 20) return SATUAN[n - 10] + ' belas'
  if (n < 100) return SATUAN[Math.floor(n / 10)] + ' puluh' + (n % 10 ? ' ' + SATUAN[n % 10] : '')
  const r = Math.floor(n / 100), s = n % 100
  return (r === 1 ? 'seratus' : SATUAN[r] + ' ratus') + (s ? ' ' + bagi(s) : '')
}
export function terbilang(n) {
  n = Math.floor(Number(n) || 0)
  if (n <= 0) return 'nol'
  const unit = [[1e12, 'triliun'], [1e9, 'miliar'], [1e6, 'juta'], [1e3, 'ribu']]
  const out = []
  for (const [nilai, nama] of unit) {
    const q = Math.floor(n / nilai); n %= nilai
    if (!q) continue
    out.push(nama === 'ribu' && q === 1 ? 'seribu' : bagi(q) + ' ' + nama)
  }
  if (n) out.push(bagi(n))
  return out.join(' ')
}

const angkaSaja = (v) => String(v ?? '').replace(/\D/g, '').slice(0, 12)
const formatAngka = (d) => (d ? Number(d).toLocaleString('id-ID') : '')
// Nilai lama berupa teks bebas ("sekitar 1-2 jt") tetap tampil apa adanya sampai pengguna mengetik angka baru
const angkaMurni = (v) => !v || /^(rp\.?\s*)?[\d.,\s]+$/i.test(String(v).trim())

/**
 * Isian ANGKA RUPIAH dengan titik ribuan (22 Nov 2026, masukan tim: "sering salah isi karena tidak ada titiknya" di desktop).
 * Pengganti langsung <input type="number">: nilai yang dikirim ke onChange tetap ANGKA MENTAH tanpa titik (bentuk event { target: { value } }),
 * jadi kode simpan tidak berubah. Tampilan: 1.500.000. `terbilang` = tulisan di bawahnya (mis. "satu juta lima ratus ribu rupiah").
 */
export function InputAngka({ value, onChange, terbilang: pakaiTerbilang = false, ...props }) {
  const v = value ?? ''
  const d = typeof v === 'number' || /^\d+\.\d+$/.test(String(v)) ? (Number.isFinite(Number(v)) ? String(Math.round(Number(v))) : '') : String(v).replace(/\D/g, '').slice(0, 13)
  return (
    <>
      <input {...props} type="text" inputMode="numeric" value={d ? Number(d).toLocaleString('id-ID') : ''} onChange={e => onChange?.({ target: { value: String(e.target.value).replace(/\D/g, '').slice(0, 13) } })} />
      {pakaiTerbilang && d && Number(d) > 0 && <span className="redup kecil" style={{ display: 'block' }}>{terbilang(d)} rupiah</span>}
    </>
  )
}
/** Isian rupiah: ketik angka → "Rp 1.500.000" + terbilang. Nilai disimpan sebagai teks "Rp 1.500.000" (kosong = ''). */
export function InputRupiah({ value, onChange, required, placeholder = 'mis. 1500000' }) {
  const lama = !angkaMurni(value)
  const d = lama ? '' : angkaSaja(value)
  return (
    <>
      <input inputMode="numeric" value={lama ? value : (d ? 'Rp ' + formatAngka(d) : '')} placeholder={placeholder} required={required}
        onChange={e => { const x = angkaSaja(e.target.value); onChange(x ? 'Rp ' + formatAngka(x) : '') }} />
      {d && <span className="redup kecil" style={{ display: 'block' }}>{terbilang(d)} rupiah</span>}
      {lama && <span className="redup kecil" style={{ display: 'block' }}>Teks lama — ketik angka untuk menggantinya dengan nominal rupiah.</span>}
    </>
  )
}

/** Kotak pilih yang bisa dicari: ketik sebagian kata (di mana pun dalam nama) → daftar menyempit; panah/Enter atau klik untuk memilih.
 *  `aksiBaru` = { label, onPilih } menambah baris "+ …" di dasar daftar (mis. kategori baru). Dipakai kategori, freelance, dst. */
export function PilihCari({ pilihan, onPilih, placeholder = 'ketik untuk mencari…', aksiBaru, kosong = 'Tidak ada yang cocok' }) {
  const [q, setQ] = useState(''), [buka, setBuka] = useState(false), [idx, setIdx] = useState(0)
  const kata = q.trim().toLowerCase()
  const cocok = pilihan.filter(p => !kata || String(p).toLowerCase().includes(kata)).sort((a, b) => {
    const aw = String(a).toLowerCase().split(/\s+/).some(w => w.startsWith(kata)), bw = String(b).toLowerCase().split(/\s+/).some(w => w.startsWith(kata))
    return (bw ? 1 : 0) - (aw ? 1 : 0) // kata yang DIAWALI ketikan naik ke atas ("a" → Animation sebelum 3D Game)
  })
  const baris = [...cocok.map(p => ({ k: p, label: p })), ...(aksiBaru ? [{ k: '__baru', label: aksiBaru.label }] : [])]
  const pilih = (b) => { setBuka(false); setQ(''); if (b.k === '__baru') aksiBaru.onPilih(q.trim()); else onPilih(b.k) }
  return (
    <div style={{ position: 'relative', minWidth: 190 }}>
      <input value={q} placeholder={placeholder} autoComplete="off"
        onChange={e => { setQ(e.target.value); setBuka(true); setIdx(0) }} onFocus={() => setBuka(true)} onBlur={() => setTimeout(() => setBuka(false), 150)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setBuka(true); setIdx(i => Math.min(i + 1, baris.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); if (buka && baris[idx]) pilih(baris[idx]) }
          else if (e.key === 'Escape') setBuka(false)
        }} />
      {buka && (
        <div style={{ position: 'absolute', zIndex: 30, left: 0, right: 0, top: '100%', marginTop: 2, maxHeight: 220, overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border-hover)', borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,.25)' }}>
          {cocok.length === 0 && <div className="redup kecil" style={{ padding: '8px 10px' }}>{kosong}</div>}
          {baris.map((b, n) => <div key={b.k} onMouseDown={e => { e.preventDefault(); pilih(b) }} onMouseEnter={() => setIdx(n)}
            style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13, background: n === idx ? 'var(--bg-card-hover)' : 'transparent', fontWeight: b.k === '__baru' ? 600 : 400, borderTop: b.k === '__baru' && cocok.length ? '1px solid var(--border)' : 'none' }}>{b.label}</div>)}
        </div>)}
    </div>
  )
}

const PISAH = ' + '
const pecah = (v) => String(v ?? '').split('+').map(x => x.trim()).filter(Boolean)

/** Pilihan kategori unit — boleh LEBIH DARI SATU (bundling, mis. "3D Modeling + Animation"). Nilai = teks "A + B".
 *  "+ Kategori baru…" (pengelola/marketer) menambah pilihan; "Atur" (pengelola) membuka layar ganti nama/hapus. */
export function PilihKategori({ studioId, value, onChange }) {
  const [d, setD] = useState(null), [atur, setAtur] = useState(false)
  const muat = () => api(`/api/circle/kategori-order?studioId=${studioId}`).then(setD).catch(() => setD({ kategori: [], bisaTambah: false }))
  useEffect(() => { if (studioId) muat() }, [studioId])
  const dipilih = pecah(value)
  const sama = (a, b) => a.toLowerCase() === b.toLowerCase()
  const daftar = d?.kategori ?? []
  const sisa = daftar.filter(k => !dipilih.some(x => sama(x, k)))
  const ubah = (arr) => onChange(arr.join(PISAH))
  async function tambah(awal = '') {
    const nama = window.prompt('Nama kategori baru (mis. 3D Modeling, Animation):', awal); if (!nama?.trim()) return
    try { const r = await api('/api/circle/kategori-order', { method: 'POST', body: { studioId, nama } }); setD(x => ({ ...x, kategori: r.kategori })); if (!dipilih.some(x => sama(x, r.nama))) ubah([...dipilih, r.nama]) } catch (e) { alert(e.message) }
  }
  return (
    <div>
      <div className="chips" style={{ marginBottom: 4 }}>
        {dipilih.map(k => <span key={k} className="chip">{k} <button type="button" className="btn kecil" style={{ padding: '0 6px' }} title="Lepas kategori ini" onClick={() => ubah(dipilih.filter(x => !sama(x, k)))}>✕</button></span>)}
        {dipilih.length === 0 && <span className="redup kecil">Belum dipilih</span>}
      </div>
      <div className="chips">
        <PilihCari pilihan={sisa} placeholder={dipilih.length ? '+ tambah kategori lagi (ketik untuk mencari)…' : 'ketik / pilih kategori…'} onPilih={v => ubah([...dipilih, v])}
          aksiBaru={d?.bisaTambah ? { label: '+ Kategori baru…', onPilih: (teks) => tambah(teks) } : undefined} />
        {d?.bisaKelola && <button type="button" className="btn kecil" onClick={() => setAtur(v => !v)}>{atur ? 'Tutup' : 'Atur daftar'}</button>}
      </div>
      {atur && d?.item && <AturKategori item={d.item} onUbah={muat} />}
    </div>
  )
}

function AturKategori({ item, onUbah }) {
  const [galat, setGalat] = useState('')
  const jalan = async (fn) => { setGalat(''); try { await fn(); onUbah() } catch (e) { setGalat(e.message) } }
  return (
    <div className="panel" style={{ marginTop: 6 }}>
      <div className="redup kecil">Daftar kategori unit ini. Ganti nama ikut mengubah order & LTK yang memakainya. Kategori yang masih dipakai tidak bisa dihapus.</div>
      {galat && <div className="galat">{galat}</div>}
      {item.length === 0 && <div className="redup kecil">Belum ada kategori.</div>}
      {item.map(k => <div key={k.id} className="meta" style={{ marginBottom: 4 }}>
        <b>{k.nama}</b><span className="redup kecil">{k.dipakai ? `dipakai ${k.dipakai}` : 'belum dipakai'}</span>
        <button type="button" className="btn kecil" onClick={() => { const n = window.prompt('Nama baru untuk kategori ini:', k.nama); if (n && n.trim() && n.trim() !== k.nama) jalan(() => api(`/api/circle/kategori-order/${k.id}`, { method: 'PATCH', body: { nama: n } })) }}>ganti nama</button>
        <button type="button" className="btn kecil" onClick={() => confirm(`Hapus kategori "${k.nama}" dari daftar?`) && jalan(() => api(`/api/circle/kategori-order/${k.id}`, { method: 'DELETE' }))}>hapus</button>
      </div>)}
    </div>
  )
}
