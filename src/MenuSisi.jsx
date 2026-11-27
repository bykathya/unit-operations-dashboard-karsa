import { House, Rocket, SquareKanban, ListChecks, ClipboardList, CalendarCheck, MessagesSquare, Megaphone, MessageSquareText, Contact, FileText, CreditCard, HandCoins, TrendingUp, Wallet, Coins, BookCheck, Banknote, Receipt, ChartColumn, Lightbulb, Users, UserCog, UserRoundSearch, Building2, Store, Workflow, Circle, BadgeDollarSign } from 'lucide-react'

// Sidebar berkelompok + ikon (11 Nov 2026, permintaan user: menu panjang polos bikin malas). Isi & urutan tab tetap dari App.jsx
// (per peran); di sini hanya dikelompokkan & diberi ikon. Kelompok kosong tidak tampil.
const IKON = {
  beranda: House, info: CalendarCheck, mulai: Rocket, papan: SquareKanban, tugas: ListChecks, laporan: ClipboardList, hadir: CalendarCheck, diskusi: MessagesSquare,
  marketing: Megaphone, updateklien: MessageSquareText, klien: Contact, tagihan: FileText, pembayaran: CreditCard, bayarfreelance: BadgeDollarSign, setoran: HandCoins,
  penjualan: TrendingUp, keuangan: Wallet, kas: Coins, buku: BookCheck, gaji: Banknote, slip: Receipt,
  analitik: ChartColumn, kaizen: Lightbulb, tim: Users, penugasan: UserCog, freelancer: UserRoundSearch, manajemen: Building2,
  akun: Store, alur: Workflow, manifest: Lightbulb, sop: BookCheck, pemasukan: ClipboardList, arus: Wallet, kru: Users, profil: UserCog,
}
const KELOMPOK = [
  ['', ['beranda', 'info', 'mulai']],
  ['Kerja harian', ['hadir', 'tugas', 'papan', 'laporan', 'diskusi']], // urutan hari kerja (13 Nov 2026, masukan tim): presensi dulu, lalu tugas, papan, laporan
  ['Penjualan & klien', ['marketing', 'updateklien', 'klien', 'tagihan', 'pembayaran', 'setoran']],
  ['Uang', ['pemasukan', 'penjualan', 'arus', 'keuangan', 'kas', 'bayarfreelance', 'buku', 'gaji', 'slip']],
  ['Tim & kinerja', ['kru', 'manifest', 'sop', 'profil', 'analitik', 'kaizen', 'tim', 'penugasan', 'freelancer', 'manajemen']],
  ['Pengaturan', ['akun', 'alur']],
]

// Label lama membawa penanda di ujungnya ("Mulai di sini ●", "Diskusi (3)") → dipisah jadi titik/angka
export function pisahLabel(l) {
  const m = String(l).match(/^(.*?)\s*(?:(●)|(✓)|\((\d+)\))?$/)
  return { teks: m[1], titik: !!m[2], centang: !!m[3], angka: m[4] ? Number(m[4]) : 0 }
}

export default function MenuSisi({ daftar, aktif, pilih }) {
  const ada = new Map(daftar)
  const dipakai = new Set(KELOMPOK.flatMap(([, k]) => k))
  const kelompok = KELOMPOK.map(([judul, kunci]) => [judul, kunci.filter(k => ada.has(k))])
  const sisa = daftar.filter(([k]) => !dipakai.has(k)).map(([k]) => k) // tab baru yang belum dipetakan tetap tampil
  if (sisa.length) kelompok.push(['Lainnya', sisa])
  const ringkas = daftar.length <= 9 // menu pendek (talent): judul kelompok berisi 1 item malah memberatkan → tanpa judul, tetap urut per kelompok
  return (
    <nav className="menu">
      {kelompok.filter(([, k]) => k.length).map(([judul, kunci]) => (
        <div key={judul || 'utama'} className="menu-kelompok">
          {judul && !ringkas && <div className="menu-judul">{judul}</div>}
          {kunci.map(k => {
            const Ikon = IKON[k] ?? Circle, { teks, titik, angka } = pisahLabel(ada.get(k))
            return (
              <button key={k} className={aktif === k ? 'aktif' : ''} onClick={() => pilih(k)} aria-label={angka ? `${teks} (${angka} baru)` : titik ? `${teks} (belum selesai)` : teks} aria-current={aktif === k ? 'page' : undefined}>
                <Ikon size={17} strokeWidth={aktif === k ? 2.2 : 1.8} aria-hidden="true" />
                <span className="menu-teks">{teks}</span>
                {angka > 0 && <span className="menu-angka">{angka}</span>}
                {titik && <span className="menu-titik" title="Masih ada langkah yang belum selesai" />}
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
