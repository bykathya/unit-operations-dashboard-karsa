import { useCallback, useEffect, useState } from 'react'
import { api, pulihkanSesi, keluar, ambilIdentitas, sedangMenyamar, mulaiMenyamar, akhiriMenyamar } from './api'
import { mulaiRealtime, hentikanRealtime, useSegarkan } from './realtime'
import Login from './Login'
import Papan from './Papan'
import Freelancer from './Freelancer'
import Klien from './Klien'
import UpdateKlien from './UpdateKlien'
import TugasSaya from './TugasSaya'
import Alur from './Alur'
import Tim from './Tim'
import Marketing from './marketing/Marketing'
import Keuangan from './Keuangan'
import Akun from './Akun'
import Mulai from './Mulai'
import Analitik from './Analitik'
import KasBiaya from './KasBiaya'
import BukuBesar from './BukuBesar'
import Penugasan from './Penugasan'
import Diskusi from './Diskusi'
import Kaizen from './Kaizen'
import Kehadiran from './Kehadiran'
import Ltk from './Ltk' // menu LTK disembunyikan 10 Nov 2026 (masukan tim: yang dicatat hanya order deal; lempar ada di produksi). Fitur & data utuh — kembalikan dengan menambah ['ltk', 'Lempar-Terima (LTK)'] ke daftar tab
import Beranda from './Beranda'
import Penjualan from './Penjualan'
import { Menyamar } from './Tambahan'
import Manajemen from './Manajemen'
import SlipSaya from './SlipSaya'
import Gaji from './Gaji'
import BayarFreelance from './BayarFreelance'
import { AturKolomKhusus } from './KolomKhusus'
import Laporan from './Laporan'
import { Setoran, Pembayaran } from './Tambahan'
import Tagihan from './Tagihan'
import MenuSisi, { pisahLabel } from './MenuSisi'
import { Sun, Moon, LogOut, UserRound, Menu as IkonMenu } from 'lucide-react'

function useTema() {
  const [tema, setTema] = useState(() => document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'))
  useEffect(() => { document.documentElement.setAttribute('data-theme', tema); try { localStorage.setItem('circle-tema', tema) } catch { /* abaikan */ } }, [tema])
  return [tema, () => setTema(t => (t === 'dark' ? 'light' : 'dark'))]
}

export default function App() {
  const [user, setUser] = useState(null)
  const [siap, setSiap] = useState(false)
  const [saya, setSaya] = useState(null)
  const [menyamar, setMenyamar] = useState(null) // { nama } saat Super Admin menyamar
  const [bukaMenyamar, setBukaMenyamar] = useState(false)
  const [studioId, setStudioId] = useState(null)
  const [tab, setTab] = useState('beranda')
  const [galat, setGalat] = useState('')
  const [menu, setMenu] = useState(false)
  const [mulai, setMulai] = useState(null)
  const [belumDibaca, setBelumDibaca] = useState(0)
  const [identitas, setIdentitas] = useState(null)
  const [tema, gantiTema] = useTema()

  useEffect(() => {
    ambilIdentitas().then(setIdentitas).catch(e => setGalat(e.message))
    pulihkanSesi().then(async ok => { if (ok) await muatSaya(); setSiap(true) })
  }, [])
  // Etalase tiap circle: judul tab + warna aksen mengikuti circle di alamat ini (dari data Ekosistem, bukan kode).
  useEffect(() => {
    if (!identitas || identitas.aud !== 'circle') return
    document.title = `${identitas.nama} · Unit Operations`
    if (/^#[0-9a-f]{6}$/i.test(identitas.warna ?? '')) {
      const r = document.documentElement.style
      r.setProperty('--accent', identitas.warna); r.setProperty('--accent-hover', identitas.warna)
      r.setProperty('--accent-light', identitas.warna); r.setProperty('--accent-subtle', identitas.warna + '22')
      r.setProperty('--accent-glow', identitas.warna + '40')
      // teks di atas warna aksen: putih atau gelap, mana yang kontrasnya lebih baik (luminans WCAG)
      const [R, G, B] = [1, 3, 5].map(i => parseInt(identitas.warna.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      const lum = 0.2126 * R + 0.7152 * G + 0.0722 * B
      r.setProperty('--on-accent', lum > 0.4 ? '#101214' : '#ffffff')
    }
  }, [identitas])

  async function muatSaya() {
    try {
      const d = await api('/api/circle/saya')
      setUser(d.user); setSaya(d); setGalat('')
      const simpan = localStorage.getItem('circle-studio')
      setStudioId(d.studios.find(s => s.id === simpan)?.id ?? d.studios[0]?.id ?? null)
    } catch (e) { setGalat(e.message) }
  }

  const kelolaAktif = saya?.studios.find(s => s.id === studioId)?.mode === 'kelola'
  // "Mulai di sini" untuk semua peran (11 Nov 2026): koordinator = kesiapan unit; marketer/talent = panduan kerja pribadi. Pindah otomatis hanya untuk koordinator.
  const muatMulai = useCallback(() => (studioId ? api(`/api/circle/mulai?studioId=${studioId}`).then(d => { setMulai(d); return d }).catch(() => null) : Promise.resolve(null)), [studioId])
  useEffect(() => {
    setMulai(null)
    if (!studioId || !saya) return
    muatMulai().then(d => { if (d && kelolaAktif) setTab(t => ((t === 'papan' || t === 'beranda') && !d.wajibSelesai ? 'mulai' : t)) })
  }, [studioId, kelolaAktif, !!saya]) // eslint-disable-line react-hooks/exhaustive-deps

  async function mulaiSebagai(x) { setBukaMenyamar(false); mulaiMenyamar(x.accessToken); setMenyamar({ nama: x.user.nama }); setTab('beranda'); await muatSaya(); mulaiRealtime() }
  async function selesaiMenyamar() { akhiriMenyamar(); setMenyamar(null); setTab('beranda'); await muatSaya(); mulaiRealtime() }
  useEffect(() => { const h = () => { setMenyamar(null); muatSaya() }; window.addEventListener('menyamar-berakhir', h); return () => window.removeEventListener('menyamar-berakhir', h) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const muatBelumDibaca = useCallback(() => api('/api/circle/diskusi/belum-dibaca').then(d => setBelumDibaca(d.belumDibaca)).catch(() => {}), [])
  useSegarkan(muatBelumDibaca, ['diskusi'])
  useEffect(() => { if (!user) return; mulaiRealtime(); return () => hentikanRealtime() }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!user) return; muatBelumDibaca(); const t = setInterval(muatBelumDibaca, 60000); return () => clearInterval(t) }, [user, muatBelumDibaca])

  if (!siap) return <div className="redup tengah">Memuat…</div>
  if (!user) return <Login identitas={identitas} onMasuk={() => muatSaya()} />

  const studio = saya?.studios.find(s => s.id === studioId)
  const lingkup = studio?.circle?.nama ?? studio?.rumahUsaha?.nama ?? studio?.induk?.nama ?? 'studio ini'
  const kelola = studio?.mode === 'kelola'
  const marketer = !!studio?.marketer
  // Tab sesuai peran: koordinator (kelola) = semuanya; marketer = Marketing + Tugas saya; selain itu = Tugas saya saja
  const tabDiskusi = ['diskusi', belumDibaca > 0 ? `Diskusi (${belumDibaca})` : 'Diskusi']
  const tabPanduan = ['mulai', mulai?.peran && mulai.disarankanSelesai < mulai.disarankanTotal ? 'Mulai di sini ●' : 'Mulai di sini']
  const daftarTab0 = kelola
    ? [['beranda', 'Beranda'], ['mulai', mulai?.wajibSelesai ? (mulai.disarankanSelesai < mulai.disarankanTotal || (mulai.atasan && mulai.unitSiap?.some(u => !u.siap)) ? 'Mulai di sini ●' : 'Mulai di sini ✓') : 'Mulai di sini'], ['papan', 'Produksi'], ['marketing', 'Marketing'], ['tagihan', 'Tagihan'], ['setoran', 'Setoran marketer'], ['pembayaran', 'Belum dibayar klien'], ['bayarfreelance', 'Bayar freelance'], ['penjualan', 'Penjualan'], ['keuangan', 'Keuangan'], ['kas', 'Biaya & Kas'], ['buku', 'Tutup bulan'], ['analitik', 'Analitik'], ['kaizen', 'Evaluasi & Perbaikan'], ['tugas', 'Tugas saya'], ['laporan', 'Laporan tim'], ['hadir', 'Kehadiran'], ['penugasan', 'Penugasan'], ['akun', 'Akun jualan'], ['tim', 'Tim'], ['gaji', 'Penggajian'], ['alur', 'Alur'], ['updateklien', 'Update klien'], ['klien', 'Klien'], ['freelancer', 'Freelancer']]
    // Marketer (bukan Koordinator): hanya uang order/prospek miliknya sendiri — Tagihan & Penjualan (gabungan order semua orang) disembunyikan; server juga menolaknya
    // Marketer juga mendapat Produksi mode PANTAU (27 Okt 2026): papan lihat saja, nilai uang hanya order miliknya (server yang menyaring)
    : marketer ? [['beranda', 'Beranda'], tabPanduan, ['marketing', 'Marketing'], ['papan', 'Produksi'], ['updateklien', 'Update klien'], ['klien', 'Klien'], ['setoran', 'Setoran'], ['pembayaran', 'Belum dibayar klien'], ['tugas', 'Tugas saya'], ['laporan', 'Tugas selesai'], ['hadir', 'Kehadiran'], ['analitik', 'Kinerja saya']] : [['beranda', 'Beranda'], tabPanduan, ['tugas', 'Tugas saya'], ['laporan', 'Tugas selesai'], ['hadir', 'Kehadiran'], ['analitik', 'Kinerja saya']]
  // PEMILIK unit (penerima SHU) tanpa peran pengelola: MODE LIHAT SAJA — tab pengaturan unit disembunyikan; server menolak semua perubahan
  const lihatSaja = !!studio?.lihatSaja
  const TAB_PENGATURAN = ['mulai', 'gaji', 'akun', 'tim', 'alur', 'penugasan', 'setoran', 'tugas']
  // ADMIN MARKET (akses kelola order tanpa menjadi Koordinator): menu khusus Koordinator (CEO unit) disembunyikan — server juga menolaknya
  const adminMarket = !!studio?.adminMarket
  const TAB_KOORDINATOR = ['mulai', 'gaji', 'keuangan', 'kas', 'buku', 'kaizen']
  const daftarTab1 = lihatSaja ? daftarTab0.filter(([k]) => !TAB_PENGATURAN.includes(k)) : adminMarket ? daftarTab0.filter(([k]) => !TAB_KOORDINATOR.includes(k)) : daftarTab0
  // Update klien pindah ke dalam Tugas saya (12 Nov 2026, masukan tim); pemilik unit (lihat saja, tanpa Tugas saya) tetap punya menunya
  const daftarTab = [...daftarTab1.filter(([k]) => lihatSaja || k !== 'updateklien'), ...(saya?.atasan ? [['manajemen', 'Manajemen']] : []), ['slip', 'Slip saya'], tabDiskusi]
  const tabAktif = daftarTab.some(([k]) => k === tab) ? tab : daftarTab[0][0]
  const perCircle = Object.entries((saya?.studios ?? []).reduce((a, s) => { const k = s.circle?.nama ?? s.rumahUsaha?.nama ?? s.induk?.nama ?? 'Lainnya'; (a[k] ??= []).push(s); return a }, {}))

  return (
    <div className={'app' + (menyamar ? ' menyamar' : '')}>
      {menyamar && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'var(--red)', color: '#fff', padding: '6px 12px', textAlign: 'center', fontSize: 13 }}>Mode menyamar: kamu melihat sebagai <b>{menyamar.nama}</b> (sesi 30 menit, tercatat). <button className="btn kecil" style={{ color: 'var(--text)', marginLeft: 8 }} onClick={selesaiMenyamar}>Kembali ke akunku</button></div>}
      <div className="bar-ponsel">
        <button className="btn-ikon" onClick={() => setMenu(true)} aria-label="Buka menu"><IkonMenu size={20} /></button>
        <div className="logo"><span>{(identitas?.nama ?? 'K')[0]}</span> {identitas?.nama ?? 'Unit Operations'}</div>
      </div>
      {menu && <div className="sisi-latar" onClick={() => setMenu(false)} />}
      <aside className={'sisi' + (menu ? ' buka' : '')}>
        <div className="logo"><span>{(identitas?.nama ?? 'K')[0]}</span> {identitas?.nama ?? 'Unit Operations'}</div>
        <label className="sisi-studio">Unit
          <select className="pilih-studio" value={studioId ?? ''} onChange={e => { setStudioId(e.target.value); try { localStorage.setItem('circle-studio', e.target.value) } catch { /* abaikan */ } }}>
            {perCircle.map(([c, daftar]) => <optgroup key={c} label={c}>{daftar.map(s => <option key={s.id} value={s.id}>{s.nama.trim()}</option>)}</optgroup>)}
          </select>
        </label>
        <MenuSisi daftar={daftarTab} aktif={tabAktif} pilih={k => { setTab(k); setMenu(false) }} />
        <div className="spasi" />
        <div className="sisi-bawah">
          {saya?.superAdmin && !menyamar && <button className="btn kecil" onClick={() => setBukaMenyamar(true)} title="Lihat web ini sebagai orang lain (tercatat)"><UserRound size={14} aria-hidden="true" /> Masuk sebagai…</button>}
          <div className="profil-sisi">
            <span className="avatar" aria-hidden="true">{(user.nama ?? '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase()}</span>
            <span className="nama">{user.nama}</span>
            <button className="btn-ikon" onClick={gantiTema} title={tema === 'dark' ? 'Mode terang' : 'Mode gelap'} aria-label={tema === 'dark' ? 'Mode terang' : 'Mode gelap'}>{tema === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
            <button className="btn-ikon" onClick={async () => { await keluar(); setUser(null); setSaya(null) }} title="Keluar" aria-label="Keluar"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      {bukaMenyamar && <div className="modal-latar" onClick={() => setBukaMenyamar(false)}><div className="modal lebar" onClick={e => e.stopPropagation()}><div className="baris-atas"><h3 style={{ margin: 0 }}>Masuk sebagai</h3><button className="btn kecil" onClick={() => setBukaMenyamar(false)}>Tutup</button></div><Menyamar onMulai={mulaiSebagai} /></div></div>}
      <div className="isi">
      <main>
        {studio && tabAktif !== 'beranda' && <header className="kepala-halaman"><h1>{pisahLabel(daftarTab.find(([k]) => k === tabAktif)?.[1] ?? '').teks}</h1><span className="redup">{studio.nama.trim()} · {lingkup}</span></header>}
        {lihatSaja && <div className="panel" style={{ borderLeft: '4px solid var(--accent)', marginBottom: 12 }}><b>Mode lihat — pemilik unit.</b> <span className="redup">Kamu bisa melihat proses & keuangan {studio?.nama?.trim()}, tetapi tidak bisa mengisi atau mengubah apa pun. Perubahan dilakukan koordinator unit.</span></div>}
        {galat && <div className="galat blok">{galat}</div>}
        {saya && saya.studios.length === 0 && <div className="kosong">Akunmu belum terhubung ke studio mana pun. Hubungi koordinator unitmu.</div>}
        {studioId && tabAktif === 'mulai' && (mulai ? <Mulai status={mulai} studioId={studioId} muat={muatMulai} pindah={setTab} bukaUnit={(id, tab) => { setStudioId(id); setTab(tab) }} /> : <div className="redup">Memuat…</div>)}
        {studioId && tabAktif === 'kas' && <KasBiaya unit={(saya?.studios ?? []).filter(s => s.mode === 'kelola')} superAdmin={!!saya?.superAdmin} unitAwal={studioId} />}
        {studioId && tabAktif === 'buku' && <BukuBesar unit={(saya?.studios ?? []).filter(s => s.mode === 'kelola')} superAdmin={!!saya?.superAdmin} unitAwal={studioId} />}
        {studioId && tabAktif === 'penugasan' && <Penugasan unit={(saya?.studios ?? []).filter(s => s.mode === 'kelola')} />}
        {studioId && tabAktif === 'hadir' && <Kehadiran key={studioId} studioId={studioId} manajer={kelola && !adminMarket} lihatSaja={lihatSaja} userId={user.id} />}
        {studioId && tabAktif === 'beranda' && <Beranda key={studioId} studioId={studioId} pindah={setTab} onOrder={() => setTab(kelola || marketer ? 'papan' : 'tugas')} />}
        {studioId && tabAktif === 'laporan' && <Laporan key={studioId} studioId={studioId} manajer={kelola} />}
        {studioId && tabAktif === 'ltk' && <Ltk key={studioId} studioId={studioId} onOrder={() => setTab('papan')} />}
        {studioId && tabAktif === 'penjualan' && <Penjualan key={studioId} studioId={studioId} atasan={!!saya?.atasan || (kelola && !lihatSaja && !adminMarket)} />}
        {tabAktif === 'manajemen' && saya?.atasan && <Manajemen />}
        {tabAktif === 'slip' && <SlipSaya />}
        {studioId && tabAktif === 'pembayaran' && <Pembayaran key={studioId} studioId={studioId} />}
        {studioId && tabAktif === 'bayarfreelance' && <BayarFreelance key={studioId} studioId={studioId} />}
        {studioId && tabAktif === 'setoran' && <Setoran key={studioId} studioId={studioId} />}
        {studioId && tabAktif === 'gaji' && <Gaji key={studioId} studioId={studioId} />}
        {studioId && tabAktif === 'tagihan' && <Tagihan key={studioId} studioId={studioId} />}
        {studioId && tabAktif === 'kaizen' && <Kaizen key={studioId} />}
        {studioId && tabAktif === 'diskusi' && <Diskusi key={studioId} studioId={studioId} onBaca={muatBelumDibaca} />}
        {studioId && tabAktif === 'analitik' && <Analitik key={studioId} studioId={studioId} manajer={kelola} />}
        {studioId && tabAktif === 'akun' && <Akun key={studioId} studioId={studioId} />}
        {studioId && tabAktif === 'tugas' && <TugasSaya key={studioId} studioId={studioId} nama={user.nama} updateKlien={(kelola || marketer) && !lihatSaja} admin={kelola && !lihatSaja} koordinator={kelola && !lihatSaja && !adminMarket} kurasiQc={!!studio?.pmqc} />}
        {studioId && tabAktif === 'papan' && <Papan key={studioId} studioId={studioId} />}
        {studioId && tabAktif === 'marketing' && <Marketing key={studioId} studioId={studioId} manajer={kelola} />}
        {studioId && tabAktif === 'keuangan' && <Keuangan unit={(saya?.studios ?? []).filter(s => s.mode === 'kelola')} />}
        {studioId && tabAktif === 'updateklien' && <UpdateKlien key={studioId} studioId={studioId} />}
        {studioId && tabAktif === 'klien' && <Klien studioId={studioId} />}
        {studioId && tabAktif === 'freelancer' && <Freelancer studioId={studioId} lingkup={lingkup} />}
        {studioId && tabAktif === 'tim' && <Tim key={studioId} studioId={studioId} />}
        {studioId && tabAktif === 'alur' && <Alur key={studioId} studioId={studioId} />}
        {studioId && tabAktif === 'alur' && <AturKolomKhusus key={'kk' + studioId} studioId={studioId} />}
      </main>
      </div>
    </div>
  )
}
