import { useState, useEffect } from 'react'
import { Check, ChevronDown, ArrowRight, PartyPopper } from 'lucide-react'
import { api } from './api'

// "MULAI DI SINI" v3 (tampilan 11 Nov 2026 — dulu satu daftar panjang yang bikin malas memulai):
// cincin progres + SATU kartu "Langkah berikutnya" → langkah dikelompokkan jadi 3 tahap (yang beres dilipat) → penjelasan panjang
// dilipat ke "Cara mengisi". Data tetap dari server (wajib/disarankan/lingkup/unitSiap); marketer & talent memakai MulaiPribadi.
const TAHAP = [
  { judul: 'Siap bekerja', ket: 'Sekali di awal, supaya unit bisa menerima order.', kunci: ['tim', 'akun', 'alur'] },
  // Bio studio dulu (12 Nov 2026): saldo awal per rekening & gaji di Tutup bulan dibaca dari Bio
  { judul: 'Uang & gaji', ket: 'Bio studio sebagai sumber, lalu saldo awal kas, gaji, invoice, dan lembur.', kunci: ['bio', 'buku', 'gaji', 'penerbit', 'lembur'] },
  { judul: 'Biar makin rapi', ket: 'Penugasan otomatis, target, pembagian akun, dan data tim.', kunci: ['keahlian', 'target', 'marketer', 'adminAkun', 'telegram', 'posisi'] },
]

function Cincin({ n, total, ukuran = 76 }) {
  const r = (ukuran - 10) / 2, k = 2 * Math.PI * r, p = total ? n / total : 0
  return (
    <svg width={ukuran} height={ukuran} viewBox={`0 0 ${ukuran} ${ukuran}`} className="cincin" aria-label={`${Math.round(p * 100)}% selesai`}>
      <circle cx={ukuran / 2} cy={ukuran / 2} r={r} fill="none" stroke="var(--track)" strokeWidth="8" />
      <circle cx={ukuran / 2} cy={ukuran / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${k * p} ${k}`} transform={`rotate(-90 ${ukuran / 2} ${ukuran / 2})`} style={{ transition: 'stroke-dasharray .5s' }} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={ukuran / 4.6} fontWeight="800" fill="var(--text)">{Math.round(p * 100)}%</text>
    </svg>
  )
}

// Baris ringkas: tanda, judul + status singkat, tombol. Penjelasan panjang dilipat.
function Baris({ l, i, pindah, aksi }) {
  const [buka, setBuka] = useState(false)
  return (
    <div className={'langkah' + (l.selesai ? ' beres' : '')}>
      <span className="langkah-tanda">{l.selesai ? <Check size={14} strokeWidth={3} /> : i}</span>
      <div className="langkah-isi">
        <div className="langkah-judul">{l.judul}{l.khusus && <span className="lencana" style={{ marginLeft: 8 }}>{l.khusus}</span>}</div>
        <div className="langkah-rinci">{l.rinci}{l.ket && <> · <button className="tautan" onClick={() => setBuka(!buka)}>{buka ? 'Tutup' : 'Cara mengisi'}</button></>}</div>
        {buka && <div className="langkah-ket">{l.ket}</div>}
      </div>
      <div className="langkah-aksi">
        {aksi}
        <button className="btn kecil" onClick={() => pindah(l.tab)}>{l.tombol ?? (l.selesai ? 'Buka' : 'Isi')}</button>
      </div>
    </div>
  )
}

function KartuBerikut({ l, pindah, aksi }) {
  return (
    <div className="kartu-berikut">
      <div className="redup kecil kapital">Langkah berikutnya</div>
      <h2>{l.judul}</h2>
      <p>{l.ket}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn utama" onClick={() => pindah(l.tab)}>{l.tombol ?? 'Kerjakan sekarang'} <ArrowRight size={15} style={{ verticalAlign: '-3px' }} /></button>
        {aksi}
      </div>
    </div>
  )
}

function Kelompok({ no, judul, ket, langkah, terbuka, children }) {
  const n = langkah.filter(l => l.selesai).length, beres = n === langkah.length
  const [buka, setBuka] = useState(terbuka)
  useEffect(() => { setBuka(terbuka) }, [terbuka])
  return (
    <section className={'kelompok-langkah' + (beres ? ' beres' : '')}>
      <button className="kelompok-kepala" onClick={() => setBuka(!buka)} aria-expanded={buka}>
        <span className="langkah-tanda besar">{beres ? <Check size={16} strokeWidth={3} /> : no}</span>
        <span style={{ flex: 1, textAlign: 'left' }}><b>Tahap {no} · {judul}</b><span className="redup kecil" style={{ display: 'block' }}>{beres ? 'Beres semua 👍' : ket}</span></span>
        <span className="hitung">{n}/{langkah.length}</span>
        <ChevronDown size={18} style={{ transform: buka ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {buka && <div className="kelompok-isi">{children}</div>}
    </section>
  )
}

// Marketer & talent (11 Nov 2026): kebiasaan harian yang dicentang dari datanya sendiri + petunjuk menu yang dipakai
function MulaiPribadi({ d, pindah }) {
  const semua = d.disarankanSelesai === d.disarankanTotal
  return (
    <div className="mulai">
      <div className="mulai-pahlawan">
        <Cincin n={d.disarankanSelesai} total={d.disarankanTotal} />
        <div>
          <h2>{semua ? 'Hari ini beres semua 👍' : `Hari ini: ${d.disarankanSelesai} dari ${d.disarankanTotal} beres`}</h2>
          <p className="redup">{d.peran === 'marketer'
            ? 'Kamu memegang akun jualan: mencari klien, mencatat order, dan menjaga klien sampai pekerjaannya selesai dan dibayar.'
            : 'Kerjamu dimulai dari Tugas saya: kerjakan tugas yang diberikan, perbarui progresnya, lalu tandai selesai.'}</p>
        </div>
      </div>
      <h3 className="judul-bagian">Hari ini</h3>
      <div className="daftar-langkah">{d.disarankan.map((l, i) => <Baris key={l.kunci} l={l} i={i + 1} pindah={pindah} />)}</div>
      <h3 className="judul-bagian" style={{ marginTop: 24 }}>Menu yang kamu pakai</h3>
      <div className="kisi-panduan">
        {d.panduan.map(l => (
          <button key={l.kunci} className="kartu-panduan" onClick={() => pindah(l.tab)}>
            <b>{l.judul} <ArrowRight size={14} style={{ verticalAlign: '-2px' }} /></b>
            <span className="redup kecil">{l.ket}</span>
            {l.rinci && <span className="kecil" style={{ color: 'var(--accent-light)' }}>{l.rinci}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Mulai({ status: d, studioId, muat, pindah, bukaUnit }) {
  const [galat, setGalat] = useState('')
  useEffect(() => { muat() }, []) // eslint-disable-line react-hooks/exhaustive-deps -- segarkan centang setiap kali halaman dibuka
  const tandaiAlur = async (setuju) => { setGalat(''); try { await api('/api/circle/mulai/alur', { method: 'POST', body: { studioId, setuju } }); await muat() } catch (e) { setGalat(e.message) } }
  if (d.peran) return <MulaiPribadi d={d} pindah={pindah} />

  const semua = [...d.wajib, ...d.disarankan], per = new Map(semua.map(l => [l.kunci, l]))
  const dipetakan = new Set(TAHAP.flatMap(t => t.kunci))
  const tahap = TAHAP.map((t, i) => ({ ...t, langkah: [...t.kunci.map(k => per.get(k)).filter(Boolean), ...(i === 2 ? semua.filter(l => !dipetakan.has(l.kunci)) : [])] }))
  const nSelesai = semua.filter(l => l.selesai).length
  const berikut = tahap.flatMap(t => t.langkah).find(l => !l.selesai) // wajib dulu, lalu urutan tahap
  const tahapAktif = tahap.findIndex(t => t.langkah.some(l => !l.selesai))
  const aksiAlur = (l) => l.bisaTandai && <button className="btn kecil" onClick={() => tandaiAlur(!l.selesai)}>{l.selesai ? 'Batalkan tanda' : 'Sudah sesuai'}</button>

  return (
    <div className="mulai">
      {galat && <div className="galat blok">{galat}</div>}
      <div className="mulai-pahlawan">
        <Cincin n={nSelesai} total={semua.length} />
        <div>
          <h2>{!berikut ? 'Unit siap sepenuhnya 🎉' : d.wajibSelesai ? 'Unit sudah bisa bekerja' : 'Ayo siapkan unitmu'}</h2>
          <p className="redup">{!berikut ? 'Semua langkah beres. Terima kasih sudah menyiapkan unit dengan rapi.'
            : d.wajibSelesai ? `Tinggal ${semua.length - nSelesai} langkah lagi supaya angka & otomatisasi berjalan penuh. Kerjakan pelan-pelan, satu per satu.`
            : `Selesaikan Tahap 1 (${d.wajib.filter(l => l.selesai).length}/${d.wajib.length}) dulu. Setelah itu unit bisa menerima order dan memberi tugas.`}</p>
          {d.wajibSelesai && <button className="btn kecil" style={{ marginTop: 6 }} onClick={() => pindah('papan')}><PartyPopper size={14} style={{ verticalAlign: '-2px' }} /> Buka Produksi</button>}
        </div>
      </div>

      {berikut && <KartuBerikut l={berikut} pindah={pindah} aksi={aksiAlur(berikut)} />}

      {tahap.map((t, i) => t.langkah.length > 0 && (
        <Kelompok key={t.judul} no={i + 1} judul={t.judul} ket={t.ket} langkah={t.langkah} terbuka={i === tahapAktif}>
          {t.langkah.map((l, j) => <Baris key={l.kunci} l={l} i={j + 1} pindah={pindah} aksi={aksiAlur(l)} />)}
        </Kelompok>
      ))}

      {d.lingkup && <>
        <h3 className="judul-bagian" style={{ marginTop: 28 }}>Pengaturan circle ({d.lingkup.filter(l => l.selesai).length}/{d.lingkup.length})</h3>
        <p className="redup kecil" style={{ marginTop: 0, marginBottom: 10 }}>Berlaku untuk seluruh circle ini. {d.superAdmin ? 'Kamu Super Admin, jadi semuanya bisa kamu isi.' : 'Item bertanda Super Admin hanya bisa diisi Super Admin — minta tolong bila belum terisi.'}{d.pengingatAktif ? '' : ' Pengingat Telegram belum dinyalakan di server (OTOMASI_AKTIF).'}</p>
        <div className="daftar-langkah">{d.lingkup.map((l, i) => <Baris key={l.kunci} l={l} i={i + 1} pindah={pindah} />)}</div>

        <h3 className="judul-bagian" style={{ marginTop: 28 }}>Kesiapan semua unit ({d.unitSiap.filter(u => u.siap).length}/{d.unitSiap.length} siap)</h3>
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table><thead><tr><th>Unit</th><th>Tim terkonfirmasi</th><th>Akun jualan</th><th>Alur</th><th>Target bulan ini</th><th /></tr></thead><tbody>
            {d.unitSiap.map(u => <tr key={u.studioId}>
              <td><b>{u.nama}</b> {u.siap ? <span className="lencana jenis-SELESAI">siap</span> : <span className="lencana revisi">belum siap</span>}</td>
              <td className={u.anggota > 0 && u.timOk >= u.anggota ? '' : 'nada-bad'}>{u.timOk}/{u.anggota}</td>
              <td className={u.akun > 0 ? '' : 'nada-bad'}>{u.akun > 0 ? `${u.akun} akun` : 'belum ada'}</td>
              <td className={u.alur ? '' : 'nada-bad'}>{u.alur ? '✓' : 'belum'}</td>
              <td className={u.target ? '' : 'redup'}>{u.target ? '✓' : '—'}</td>
              <td><button className="btn kecil" onClick={() => bukaUnit(u.studioId, 'mulai')}>Buka unit</button></td></tr>)}</tbody></table>
        </div>
      </>}
    </div>
  )
}
