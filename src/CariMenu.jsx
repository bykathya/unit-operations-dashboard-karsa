import { useEffect, useMemo, useRef, useState } from 'react'
import { usePasangAplikasi } from './pasangAplikasi'

// CARI MENU (Ctrl/⌘ + K) & INSTALL APP (Karsa, 28 Nov 2026).
// Cari menu yang ada di peranmu; Enter membuka, ↑↓ memilih, Esc menutup. Kata kunci tambahan supaya "kas", "order", "gaji" dll ketemu.
const KATA = {
  pemasukan: 'daily sheet order inbox chat lunas dp tip jalur bayar lempar kerjaan freelance performa bonus komisi lembur',
  info: 'pengumuman event kalender kontrak dokumen drive acara libur', manifest: 'manifest manifestasi doa syukur harapan',
  sop: 'sop aturan panduan admin akun vgen nda qc', profil: 'profil whatsapp wa bio dokumen kontrak rekening', slip: 'gaji slip', kru: 'tim anggota kartu',
  akun: 'akun jualan platform vgen ko-fi artistree', gaji: 'gaji payroll slip', mulai: 'mulai panduan', beranda: 'beranda awal',
}
const bersih = (s) => String(s ?? '').replace(/\s*\(\d+\)\s*$/, '').replace(/[•●]/g, '').trim()

export function TombolCari({ onBuka }) {
  return <button className="btn kecil cari-tombol" onClick={onBuka} title="Cari menu (Ctrl+K)">🔍 Cari menu <kbd>Ctrl K</kbd></button>
}

export function TombolPasang() {
  const { bisa, ios, pasang } = usePasangAplikasi()
  const [petunjuk, setPetunjuk] = useState(false)
  if (!bisa) return null
  return (
    <>
      <button className="btn kecil" onClick={async () => { if ((await pasang()) === 'ios') setPetunjuk(true) }} title="Pasang web ini seperti aplikasi">📲 Install App</button>
      {petunjuk && ios && (
        <div className="modal-latar" onClick={() => setPetunjuk(false)}><div className="modal" onClick={e => e.stopPropagation()}>
          <h3 style={{ marginTop: 0 }}>Pasang di iPhone / iPad</h3>
          <ol style={{ lineHeight: 1.7, paddingLeft: 20 }}><li>Buka web ini di <b>Safari</b>.</li><li>Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas).</li><li>Pilih <b>Tambah ke Layar Utama</b>, lalu <b>Tambah</b>.</li></ol>
          <div className="modal-aksi"><button className="btn utama" onClick={() => setPetunjuk(false)}>Mengerti</button></div>
        </div></div>
      )}
    </>
  )
}

export default function CariMenu({ daftar, pilih, buka, setBuka }) {
  const [q, setQ] = useState(''), [i, setI] = useState(0), input = useRef(null)
  useEffect(() => {
    const f = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setBuka(b => !b) } }
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  }, [setBuka])
  useEffect(() => { if (buka) { setQ(''); setI(0); setTimeout(() => input.current?.focus(), 0) } }, [buka])
  const hasil = useMemo(() => {
    const k = q.trim().toLowerCase()
    return daftar.map(([id, label]) => ({ id, label: bersih(label) })).filter(x => !k || `${x.label} ${KATA[x.id] ?? ''} ${x.id}`.toLowerCase().includes(k))
  }, [daftar, q])
  if (!buka) return null
  const pergi = (x) => { if (x) { pilih(x.id); setBuka(false) } }
  return (
    <div className="modal-latar" onClick={() => setBuka(false)} style={{ alignItems: 'flex-start', paddingTop: '12vh' }}>
      <div className="modal cari-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Cari menu">
        <input ref={input} className="cari" value={q} placeholder="Cari menu… (mis. daily sheet, gaji, kalender)" aria-label="Cari menu"
          onChange={e => { setQ(e.target.value); setI(0) }}
          onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(x + 1, hasil.length - 1)) } else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(x - 1, 0)) } else if (e.key === 'Enter') pergi(hasil[i]); else if (e.key === 'Escape') setBuka(false) }} />
        <div className="cari-hasil">
          {hasil.length === 0 ? <div className="redup" style={{ padding: 12 }}>Tidak ada menu yang cocok.</div> : hasil.map((x, n) => (
            <button key={x.id} type="button" className={n === i ? 'aktif' : ''} onMouseEnter={() => setI(n)} onClick={() => pergi(x)}>{x.label}</button>
          ))}
        </div>
        <div className="redup kecil" style={{ marginTop: 8 }}>↑↓ pilih · Enter buka · Esc tutup</div>
      </div>
    </div>
  )
}
