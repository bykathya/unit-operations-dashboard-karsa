import { Fragment, useCallback, useEffect, useState } from 'react'
import { api } from './api'
import TombolUnduh from './TombolUnduh'
import { unduhCsv, NAMA_BULAN, bulanSekarang, geserBulan, hariIniLokal } from './api-util'
import PilihRekening from './PilihRekening'
import { InputAngka } from './Pilihan'

// BUKU BESAR & TUTUP BULAN (adaptasi OGS Finance V2/V4; MODE BAYANGAN — tidak menulis ke Laporan Omset Ekosistem).
// Ringkasan laba-rugi + kas per unit, rincian ledger, item tetap bulanan, ringkasan semua unit, pemetaan kategori biaya → buku besar.
const rp = (n) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'))
const tgl = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '—')
const kunciBulan = (p) => `${p.tahun}-${String(p.bulan).padStart(2, '0')}`
// Kategori yang hanya diisi lewat Bio studio (dibaca otomatis) — tidak ditawarkan sebagai biaya rutin circle agar tidak dobel
const KATEGORI_BIO = ['Langganan & Tools', 'Iuran & Kontribusi', 'Biaya Rutin Lainnya']
const SUMBER = { WD: 'Penarikan', TRANSFER: 'Transfer', BIAYA: 'Biaya', MANUAL: 'Manual', ITEM_TETAP: 'Biaya rutin', BIO: 'Dari Bio studio' }
const jalankan = async (fn, setGalat, muat) => { setGalat(''); try { await fn(); muat?.() } catch (e) { setGalat(e.message) } }
function Bulan({ p, setP }) { return <div className="toolbar"><button className="btn kecil" onClick={() => setP(geserBulan(p, -1))}>←</button><b>{NAMA_BULAN[p.bulan - 1]} {p.tahun}</b><button className="btn kecil" onClick={() => setP(geserBulan(p, 1))}>→</button></div> }

function Ringkasan({ studioId, p, ke }) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')
  const bulan = kunciBulan(p)
  const muat = useCallback(() => api(`/api/circle/buku/ringkasan?studioId=${studioId}&bulan=${bulan}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, bulan])
  useEffect(() => { setD(null); setInfo(''); muat() }, [muat])
  if (galat && !d) return <div className="galat blok">{galat}</div>
  if (!d) return <div className="redup">Memuat…</div>
  const tutup = () => confirm(`Tutup buku ${NAMA_BULAN[p.bulan - 1]} ${p.tahun}? Angka bulan itu dikunci (tidak berubah lagi) dan kas akhir disimpan.${d.menungguPersetujuan.jumlahItem ? `\n\n${d.menungguPersetujuan.jumlahItem} biaya masih MENUNGGU persetujuan dan TIDAK ikut dihitung.` : ''}${d.takTerpetakan.jumlahItem ? `\n${d.takTerpetakan.jumlahItem} biaya disetujui belum dipetakan ke kategori buku besar dan TIDAK ikut dihitung.` : ''}`) && jalankan(async () => { const h = await api('/api/circle/buku/tutup', { method: 'POST', body: { studioId, bulan } }); setInfo(`Bulan ditutup. Kas akhir ${rp(h.kasAkhir)}.`) }, setGalat, muat)
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      {info && <div className="chip" style={{ display: 'inline-block', marginBottom: 10 }}>{info}</div>}
      <div className="toolbar"><span className={'tahap-lencana' + (d.status === 'DITUTUP' ? ' jenis-SELESAI' : '')}>{d.status === 'DITUTUP' ? '🔒 Ditutup' : 'Berjalan'}</span>{d.status === 'DITUTUP' && <span className="redup kecil">oleh {d.ditutupOleh} · {new Date(d.ditutupPada).toLocaleDateString('id-ID')}</span>}<span className="spasi" />
        {d.status !== 'DITUTUP' && d.bisaTutup && <button className="btn utama" onClick={tutup}>Tutup bulan</button>}
        {d.status === 'DITUTUP' && d.bisaBukaLagi && <button className="btn" onClick={() => confirm('Buka lagi bulan ini? Snapshot dihapus dan data dihitung langsung lagi.') && jalankan(() => api('/api/circle/buku/buka-lagi', { method: 'POST', body: { studioId, bulan } }), setGalat, muat)}>Buka lagi</button>}</div>
      <div className="ringkasan">
        <div className="stat"><span className="redup kecil">Pemasukan</span><b>{rp(d.masuk)}</b></div>
        <div className="stat"><span className="redup kecil">Pengeluaran</span><b>{rp(d.keluar)}</b><span className="redup kecil">tetap {rp(d.tetap)} · variabel {rp(d.variabel)}</span></div>
        <div className="stat"><span className="redup kecil">Hasil (laba/rugi)</span><b className={d.hasil < 0 ? 'nada-bad' : 'nada-ok'}>{rp(d.hasil)}</b></div>
        <div className="stat"><span className="redup kecil">Kas awal</span><b>{rp(d.kasAwal)}</b><span className="redup kecil">{d.kasAwalDari}</span></div>
        <div className="stat"><span className="redup kecil">Kas akhir</span><b>{rp(d.kasAkhir)}</b></div>
        <div className="stat"><span className="redup kecil">Dana tertahan</span><b>{rp(d.tertahan.jumlah)}</b><span className="redup kecil">{d.tertahan.jumlahItem} catatan · belum dihitung</span></div>
      </div>
      {/* Pemasukan belum dicatat (12 Nov 2026): beban dari Bio (gaji, SHU, langganan) otomatis terhitung, jadi tanpa catatan penarikan Hasil tampak minus besar */}
      {d.status !== 'DITUTUP' && d.masuk === 0 && d.keluar > 0 && (
        <div className="panel" style={{ marginBottom: 12, borderColor: 'var(--amber)', background: 'var(--amber-subtle)' }}>
          <b>⚠️ Pemasukan bulan ini belum dicatat.</b> Gaji, SHU, dan biaya rutin dari Bio studio sudah otomatis terhitung, jadi Hasil terlihat minus. Catat uang masuk di <b>Biaya &amp; Kas → Pendapatan → + Penarikan</b> (atau entri manual di Rincian untuk uang yang tidak lewat platform) supaya laba rugi bulan ini bermakna.
        </div>
      )}
      {/* Sebelum tutup bulan (18 Nov 2026): saldo platform ≤ 7 hari & pemasukan dari cicilan sudah berekening */}
      {d.status !== 'DITUTUP' && ((d.pendapatanTanpaRekening ?? 0) > 0 || !d.saldoPlatformDiperbarui || Date.now() - new Date(d.saldoPlatformDiperbarui) > 7 * 86400000) && (
        <div className="panel" style={{ marginBottom: 12, borderColor: 'var(--amber)' }}>
          {(d.pendapatanTanpaRekening ?? 0) > 0 && <div>⚠️ <b>{d.pendapatanTanpaRekening} pemasukan</b> bulan ini belum dipilih rekeningnya — masuk baris "Belum dipilih" di Kas per rekening. Pilih di <b>Biaya &amp; Kas → Pendapatan</b>.</div>}
          {(!d.saldoPlatformDiperbarui || Date.now() - new Date(d.saldoPlatformDiperbarui) > 7 * 86400000) && <div className="redup">ℹ️ Saldo platform (Fiverr/Etsy/Vgen/Upwork) bulan ini {d.saldoPlatformDiperbarui ? 'terakhir diperbarui lebih dari 7 hari lalu' : 'belum diisi'} — perbarui di <b>Biaya &amp; Kas → Saldo platform</b> supaya Pendapatan bisa menjelaskan omset yang belum ditarik.</div>}
        </div>
      )}
      {d.status !== 'DITUTUP' && (d.menungguPersetujuan.jumlahItem > 0 || d.takTerpetakan.jumlahItem > 0) && (
        <div className="panel" style={{ marginBottom: 12, borderColor: 'var(--amber)' }}>
          {d.menungguPersetujuan.jumlahItem > 0 && <div>⚠️ <b>{d.menungguPersetujuan.jumlahItem} biaya</b> ({rp(d.menungguPersetujuan.jumlah)}) masih menunggu persetujuan — belum dihitung. Setujui di <b>Biaya &amp; Kas → Biaya</b>.</div>}
          {d.takTerpetakan.jumlahItem > 0 && <div>⚠️ <b>{d.takTerpetakan.jumlahItem} biaya disetujui</b> ({rp(d.takTerpetakan.jumlah)}) belum dipasangkan ke kategori laporan keuangan — belum dihitung. Pasangkan di tab <b>Atur kategori</b>.</div>}
        </div>
      )}
      {d.status !== 'DITUTUP' && d.kasAwalDari.startsWith('belum') && d.bisaTutup && !d.rekening?.daftar.length && <KasAwal studioId={studioId} bulan={bulan} muat={muat} />}
      <KasRekening studioId={studioId} bulan={bulan} r={d.rekening} bisa={d.bisaTutup} ditutup={d.status === 'DITUTUP'} muat={muat} />
      <h3 className="judul-bagian">Per kategori</h3>
      {d.perKategori.length === 0 ? <div className="kosong">Belum ada pemasukan/pengeluaran tercatat bulan ini.</div> : <table><tbody>{d.perKategori.map(k => <tr key={k.kategori}><td>{k.kategori} {k.sifat && <span className="chip sub">{k.sifat.toLowerCase()}</span>}</td><td className="kanan"><b className={k.arus === 'INCOME' ? 'nada-ok' : ''}>{k.arus === 'INCOME' ? '+' : '−'}{rp(k.jumlah)}</b></td></tr>)}</tbody></table>}
      <p className="redup kecil" style={{ marginTop: 10 }}>Pemasukan = penarikan (WD) yang dicatat + entri manual masuk. Pengeluaran = biaya yang DISETUJUI dan sudah dipasangkan kategorinya + biaya rutin + entri manual. Kas akhir = kas awal + pemasukan − pengeluaran. Mode bayangan: tidak mengubah Laporan Omset Ekosistem.</p>
    </div>
  )
}
// ── Kas per rekening (12 Nov 2026, masukan tim): rekening dari Bio studio Ekosistem; saldo dihitung dari catatan circle ──
function KasRekening({ studioId, bulan, r, bisa, ditutup, muat }) {
  const [galat, setGalat] = useState('')
  const [awal, setAwal] = useState(null) // { id: '...' } saat sedang mengisi saldo awal
  const [pd, setPd] = useState(null)
  const [info, setInfo] = useState('')
  if (!r) return null
  if (!r.daftar.length) return <div className="panel" style={{ marginBottom: 14 }}><h3 className="judul-bagian">Kas per rekening</h3><div className="redup">Unit ini belum punya rekening di <b>Bio studio Ekosistem → Rekening Bank</b>. Tambahkan di sana (Koordinator), nanti otomatis muncul di sini dan bisa dipilih saat mencatat biaya, penarikan, dan entri.</div></div>
  const bulanIni = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7) === bulan
  const lain = r.belumDipilih, adaLain = [lain.awal, lain.masuk, lain.keluar, lain.akhir, lain.kini ?? 0].some(v => Math.round(v) !== 0)
  const total = (f) => r.daftar.reduce((a, x) => a + x[f], 0) + (adaLain ? lain[f] : 0)
  const Baris = ({ nama, x, bio }) => <tr><td><b>{nama}</b></td><td className="kanan">{rp(x.awal)}</td><td className="kanan nada-ok">{x.masuk ? '+' + rp(x.masuk) : '—'}</td><td className="kanan">{x.keluar ? '−' + rp(x.keluar) : '—'}</td>
    <td className="kanan">{x.pindahMasuk || x.pindahKeluar ? <>{x.pindahMasuk ? '+' + rp(x.pindahMasuk) : ''} {x.pindahKeluar ? '−' + rp(x.pindahKeluar) : ''}</> : '—'}</td><td className="kanan"><b>{rp(x.akhir)}</b></td>
    {bulanIni && <td className="kanan">{rp(x.kini)}</td>}
    {bulanIni && <td className="kanan">{bio == null ? '' : <>{rp(bio)}{Math.round(bio - x.kini) !== 0 && <div className="kecil nada-warn">selisih {rp(x.kini - bio)}</div>}</>}</td>}</tr>
  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div className="baris-atas"><h3 className="judul-bagian" style={{ margin: 0 }}>Kas per rekening</h3>
        {!ditutup && bisa && <span className="toolbar" style={{ margin: 0 }}>{r.bisaIsiAwal && <button className="btn kecil" onClick={() => setAwal(awal ? null : Object.fromEntries(r.daftar.map(x => [x.id, String(x.awal || '')])))}>Atur saldo awal</button>}{r.daftar.length > 1 && <button className="btn kecil" onClick={() => setPd(pd ? null : { tanggal: hariIniLokal(), dariId: r.daftar[0].id, keId: r.daftar[1].id, jumlah: '', catatan: '' })}>⇄ Pindah dana</button>}</span>}</div>
      <div className="redup kecil" style={{ margin: '4px 0 10px' }}>Rekening diambil dari Bio studio Ekosistem. Saldo dihitung dari catatan di web circle (saldo awal {r.awalDari}). Pilih rekening saat mencatat biaya, penarikan, dan entri manual supaya terlihat rekening mana yang bertambah/berkurang.</div>
      {galat && <div className="galat">{galat}</div>}
      {awal && <form className="panel" style={{ marginBottom: 10 }} onSubmit={e => { e.preventDefault(); jalankan(async () => { await api('/api/circle/buku/saldo-awal-rekening', { method: 'PUT', body: { studioId, bulan, saldo: Object.fromEntries(Object.entries(awal).map(([k, v]) => [k, Number(v || 0)])) } }); setAwal(null) }, setGalat, muat) }}>
        <b>Saldo awal per rekening</b> <span className="redup kecil">— saldo di awal bulan ini. Bulan berikutnya otomatis dari tutup bulan.</span>
        <div className="toolbar" style={{ marginTop: 8 }}>{r.daftar.map(x => <label key={x.id} className="isian-sebaris">{x.nama}<InputAngka style={{ width: 160 }} value={awal[x.id] ?? ''} onChange={e => setAwal({ ...awal, [x.id]: e.target.value })} /></label>)}</div>
        <div className="toolbar"><button type="button" className="btn kecil" onClick={() => setAwal(Object.fromEntries(r.daftar.map(x => [x.id, String(x.saldoBio ?? 0)])))} title="Mengisi kotak dengan saldo yang tercatat di Bio Ekosistem sekarang — periksa lagi bila bulan ini sudah ada transaksi">Isi dari saldo Bio Ekosistem</button><button className="btn kecil utama">Simpan</button></div>
      </form>}
      {pd && <form className="panel" style={{ marginBottom: 10 }} onSubmit={e => { e.preventDefault(); jalankan(async () => { await api('/api/circle/buku/pindah', { method: 'POST', body: { studioId, ...pd, jumlah: Number(pd.jumlah) } }); setPd(null) }, setGalat, muat) }}>
        <b>Pindah dana antar rekening</b> <span className="redup kecil">— mis. tarik tunai, pindah bank. Total kas tidak berubah.</span>
        <div className="toolbar" style={{ marginTop: 8 }}>
          <label className="isian-sebaris">Tanggal<input type="date" value={pd.tanggal} onChange={e => setPd({ ...pd, tanggal: e.target.value })} required /></label>
          <label className="isian-sebaris">Dari<PilihRekening daftar={r.daftar} value={pd.dariId} kosong="— pilih —" onChange={v => setPd({ ...pd, dariId: v })} /></label>
          <label className="isian-sebaris">Ke<PilihRekening daftar={r.daftar} value={pd.keId} kosong="— pilih —" onChange={v => setPd({ ...pd, keId: v })} /></label>
          <label className="isian-sebaris">Jumlah (Rp)<InputAngka style={{ width: 150 }} value={pd.jumlah} onChange={e => setPd({ ...pd, jumlah: e.target.value })} required /></label>
          <label className="isian-sebaris">Catatan<input style={{ width: 200 }} value={pd.catatan} onChange={e => setPd({ ...pd, catatan: e.target.value })} maxLength={255} /></label>
          <button className="btn kecil utama" style={{ alignSelf: 'flex-end' }}>Simpan</button></div>
      </form>}
      <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Rekening</th><th className="kanan">Saldo awal</th><th className="kanan">Masuk</th><th className="kanan">Keluar</th><th className="kanan">Pindah</th><th className="kanan">Saldo akhir</th>{bulanIni && <th className="kanan" title="Hanya catatan bertanggal sampai hari ini — biaya rutin (gaji, SHU, Bio) bertanggal 26 belum memotong">Saldo hari ini</th>}{bulanIni && <th className="kanan">Saldo di Bio Ekosistem</th>}</tr></thead>
        <tbody>{r.daftar.map(x => <Baris key={x.id} nama={x.nama} x={x} bio={x.saldoBio} />)}{adaLain && <Baris nama={<span className="redup">Belum dipilih rekeningnya</span>} x={lain} bio={null} />}
          <tr><td><b>Total</b></td><td className="kanan">{rp(total('awal'))}</td><td className="kanan">{rp(total('masuk'))}</td><td className="kanan">{rp(total('keluar'))}</td><td /><td className="kanan"><b>{rp(total('akhir'))}</b></td>{bulanIni && <td className="kanan">{rp(total('kini'))}</td>}{bulanIni && <td className="kanan">{rp(r.daftar.reduce((a, x) => a + (x.saldoBio ?? 0), 0))}</td>}</tr></tbody></table></div>
      {adaLain && <div className="redup kecil" style={{ marginTop: 6 }}>"Belum dipilih" = catatan tanpa rekening + kas awal yang belum dibagi ke rekening. Pilih rekeningnya di Biaya, Penarikan, atau Rincian supaya angka per rekening lengkap.</div>}
      {bulanIni && (() => {
        const beda = r.daftar.filter(x => x.adaAwal && Math.round(x.kini) !== Math.round(x.saldoBio ?? 0)), tanpaAwal = r.daftar.filter(x => !x.adaAwal)
        const samakan = () => confirm(`Perbarui saldo di Bio studio Ekosistem dengan SALDO HARI INI dari circle? (biaya yang tanggalnya belum tiba, mis. gaji tgl 26, belum memotong)\n\n${beda.map(x => `• ${x.nama}: ${rp(x.saldoBio)} → ${rp(x.kini)}`).join('\n')}${tanpaAwal.length ? `\n\nDilewati (saldo awal belum diisi): ${tanpaAwal.map(x => x.nama).join(', ')}.` : ''}${adaLain ? `\n\nCatatan: ${rp(lain.kini)} masih "belum dipilih" rekeningnya dan TIDAK ikut disalin.` : ''}\n\nKas di laporan mingguan Ekosistem ikut menyesuaikan. Saldo lama tetap tersimpan sebagai jejak.`)
          && jalankan(async () => { const x = await api('/api/circle/buku/samakan-bio', { method: 'POST', body: { studioId, bulan } }); setInfo(x.diubah ? `Saldo ${x.diubah} rekening di Bio Ekosistem sudah diperbarui.` : 'Saldo Bio sudah sama.') }, setGalat, muat)
        return <div className="toolbar" style={{ marginTop: 8, alignItems: 'center' }}>
          {bisa && <button className="btn kecil utama" disabled={!beda.length} onClick={samakan} title={beda.length ? 'Salin saldo akhir circle ke Bio studio Ekosistem' : 'Saldo Bio sudah sama dengan circle'}>Perbarui saldo Bio dari circle{beda.length ? ` (${beda.length})` : ''}</button>}
          {bisa && tanpaAwal.length > 0 && <span className="kecil nada-warn">{tanpaAwal.length === r.daftar.length ? 'Isi saldo awal dulu (Atur saldo awal) sebelum memperbarui Bio.' : `${tanpaAwal.map(x => x.nama).join(', ')} belum punya saldo awal — tidak ikut diperbarui.`}</span>}
          <span className="redup kecil">{r.bioDisamakan ? `Terakhir diperbarui ${new Date(r.bioDisamakan.pada).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} oleh ${r.bioDisamakan.oleh}. ` : ''}Saldo di Bio Ekosistem tidak berubah sendiri — {bisa ? 'cek selisihnya, lalu tekan tombol ini bila angka circle sudah benar' : 'Koordinator yang memperbaruinya'}.</span>
          {info && <span className="chip">{info}</span>}
        </div>
      })()}
      {r.pindah.length > 0 && <><h4 className="judul-bagian" style={{ marginTop: 12 }}>Pindah dana bulan ini</h4>
        {r.pindah.map(x => <div key={x.id} className="meta" style={{ marginBottom: 4 }}><span>{tgl(x.tanggal)}</span><b>{x.dari} → {x.ke}</b><span>{rp(x.jumlah)}</span>{x.catatan && <span className="redup">{x.catatan}</span>}{!ditutup && bisa && <button className="btn kecil" onClick={() => confirm('Hapus catatan pindah dana ini?') && jalankan(() => api(`/api/circle/buku/pindah/${x.id}`, { method: 'DELETE' }), setGalat, muat)}>Hapus</button>}</div>)}</>}
    </div>
  )
}
function KasAwal({ studioId, bulan, muat }) {
  const [v, setV] = useState('')
  const [galat, setGalat] = useState('')
  return <div className="panel" style={{ marginBottom: 12 }}><b>Kas awal belum ada.</b> <span className="redup kecil">Isi sekali untuk bulan pertama (setelah itu otomatis dari bulan yang ditutup).</span>
    <div className="toolbar" style={{ marginTop: 8 }}><InputAngka placeholder="Kas awal (Rp)" style={{ maxWidth: 200 }} value={v} onChange={e => setV(e.target.value)} /><button className="btn kecil utama" disabled={v === ''} onClick={() => jalankan(() => api('/api/circle/buku/kas-awal', { method: 'PUT', body: { studioId, bulan, jumlah: Number(v) } }), setGalat, muat)}>Simpan</button></div>{galat && <div className="galat">{galat}</div>}</div>
}

function Rincian({ studioId, p }) {
  const [d, setD] = useState(null)
  const [kat, setKat] = useState([])
  const [f, setF] = useState({ kategoriId: '', tanggal: hariIniLokal(), deskripsi: '', jumlah: '', rekeningId: null })
  const [rek, setRek] = useState([])
  const [galat, setGalat] = useState('')
  // Tandai biaya rutin dibayar (12 Nov 2026, masukan tim): centang baris rutin → tanggal & rekening → memotong saldo rekening itu
  const [pilih, setPilih] = useState(new Set()), [byr, setByr] = useState({ tanggal: hariIniLokal(), rekeningId: null })
  const bulan = kunciBulan(p)
  const muat = useCallback(() => api(`/api/circle/buku/rincian?studioId=${studioId}&bulan=${bulan}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, bulan])
  useEffect(() => { setD(null); muat(); api('/api/circle/buku/kategori').then(x => { setKat(x.kategori); setF(v => ({ ...v, kategoriId: v.kategoriId || x.kategori[0]?.id })) }).catch(() => {}); api(`/api/circle/buku/rekening?studioId=${studioId}`).then(setRek).catch(() => {}) }, [muat, studioId])
  if (!d) return galat ? <div className="galat blok">{galat}</div> : <div className="redup">Memuat…</div>
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      <TombolUnduh nama={`rincian-${bulan}`} baris={[['Tanggal', 'Sumber', 'Kategori', 'Arus', 'Deskripsi', 'Rekening', 'Jumlah'], ...d.baris.map(b => [b.tanggal, b.sumber, b.kategori, b.arus === 'INCOME' ? 'Masuk' : 'Keluar', b.deskripsi, b.rekening ?? '', b.jumlah])]} cetak />
      {!d.ditutup && (
        <form className="panel" style={{ marginBottom: 12 }} onSubmit={e => { e.preventDefault(); jalankan(async () => { await api('/api/circle/buku/entri', { method: 'POST', body: { studioId, ...f, jumlah: Number(f.jumlah) } }); setF({ ...f, deskripsi: '', jumlah: '' }) }, setGalat, muat) }}>
          <b>Tambah entri manual</b>
          {kat.find(k => k.id === f.kategoriId)?.arus === 'INCOME' && <div className="nada-warn kecil" style={{ marginTop: 4 }}>Uang dari klien/platform (termasuk komunitas/WhatsApp) sebaiknya dicatat di <b>Biaya & Kas → Pendapatan → + Penarikan</b> (isi "Dari klien / keterangan") — otomatis masuk ke Rincian ini. Entri manual di sini tetap tampil di halaman Pendapatan.</div>}
          <div className="dua" style={{ marginTop: 8 }}>
            <label>Kategori<select value={f.kategoriId} onChange={e => setF({ ...f, kategoriId: e.target.value })}>{kat.map(k => <option key={k.id} value={k.id}>{k.arus === 'INCOME' ? '＋ ' : '－ '}{k.nama}</option>)}</select></label>
            <label>Tanggal<input type="date" value={f.tanggal} onChange={e => setF({ ...f, tanggal: e.target.value })} required /></label>
            <label>Deskripsi<input value={f.deskripsi} onChange={e => setF({ ...f, deskripsi: e.target.value })} required maxLength={255} /></label>
            <label>Jumlah (Rp)<InputAngka terbilang value={f.jumlah} onChange={e => setF({ ...f, jumlah: e.target.value })} required /></label>
            <label>Rekening (masuk ke / keluar dari)<PilihRekening daftar={rek} value={f.rekeningId} onChange={v => setF({ ...f, rekeningId: v })} /></label>
          </div>
          <button className="btn utama">+ Tambah</button>
        </form>
      )}
      {!d.ditutup && (pilih.size > 0 || d.baris.filter(b => (b.sumber === 'BIO' || b.sumber === 'ITEM_TETAP') && !b.dibayar).length > 0) && <div className="panel" id="panel-bayar-rutin" style={{ marginBottom: 12, ...(pilih.size ? { position: 'sticky', top: 8, zIndex: 5, borderColor: 'var(--accent)', boxShadow: 'var(--shadow)' } : {}) }}>
        {/* 12 Nov 2026 (masukan tim): centang di baris hanya MEMILIH — panel ini menempel di atas saat ada pilihan supaya tombol Tandai dibayar terlihat */}
        <b>{pilih.size ? `${pilih.size} biaya rutin dipilih — isi tanggal & rekening, lalu klik Tandai dibayar` : 'Biaya rutin yang sudah dibayar'}</b> <span className="redup kecil">{pilih.size ? 'Saldo rekening yang dipilih langsung terpotong pada tanggal itu.' : 'Centang "pilih" di baris rutin (gaji, langganan, iuran, dll.) yang sudah keluar, isi tanggal & rekeningnya, lalu klik Tandai dibayar. Yang belum ditandai tetap dihitung sebagai perkiraan tgl 26.'}</span>
        <div className="toolbar" style={{ marginTop: 8 }}>
          <button type="button" className="btn kecil" onClick={() => setPilih(new Set(d.baris.filter(b => (b.sumber === 'BIO' || b.sumber === 'ITEM_TETAP') && !b.dibayar).map(b => `${b.sumber}|${b.sumberId}`)))}>Pilih semua yang belum dibayar</button>
          <label className="isian-sebaris">Tanggal bayar<input type="date" value={byr.tanggal} onChange={e => setByr({ ...byr, tanggal: e.target.value })} /></label>
          {rek.length > 0 && <label className="isian-sebaris">Dari rekening (wajib)<PilihRekening daftar={rek} value={byr.rekeningId} kosong="— pilih rekening —" onChange={v => setByr({ ...byr, rekeningId: v })} /></label>}
          {pilih.size > 0 && <button type="button" className="btn kecil" onClick={() => setPilih(new Set())}>Batal pilih</button>}
          <button type="button" className="btn kecil utama" disabled={!pilih.size || (rek.length > 0 && !byr.rekeningId)} title={rek.length > 0 && !byr.rekeningId ? 'Pilih rekening dulu' : ''} onClick={() => jalankan(async () => { await api('/api/circle/buku/bayar-rutin', { method: 'POST', body: { studioId, bulan, tanggal: byr.tanggal, rekeningId: byr.rekeningId, baris: [...pilih].map(k => ({ sumber: k.split('|')[0], sumberId: k.slice(k.indexOf('|') + 1) })) } }); setPilih(new Set()) }, setGalat, muat)}>✓ Tandai dibayar ({pilih.size})</button>
        </div></div>}
      {d.baris.length === 0 ? <div className="kosong">Belum ada baris.</div> : (
        <table><thead><tr><th>Tanggal</th><th>Uraian</th><th>Kategori</th><th>Sumber</th><th>Status</th><th>Rekening</th><th className="kanan">Jumlah</th><th /></tr></thead>
          <tbody>{d.baris.map((b, i) => <tr key={b.id ?? i}><td>{tgl(b.tanggal)}</td><td>{b.deskripsi}{b.diubahBulanIni && <span className="chip sub" style={{ marginLeft: 6 }}>diubah bulan ini</span>}</td><td>{b.kategori}</td><td><span className="chip sub">{SUMBER[b.sumber] ?? b.sumber}</span>{b.terkunci && ' 🔒'}</td><td>{(b.sumber === 'BIO' || b.sumber === 'ITEM_TETAP') && (b.dibayar
              ? <span className="chip">✓ dibayar{b.bisaBatal && !d.ditutup && <> · <a href="#" title="Ubah tanggal / rekening bayar" onClick={e => { e.preventDefault(); setPilih(new Set([`${b.sumber}|${b.sumberId}`])); setByr({ tanggal: b.tanggal, rekeningId: b.rekeningId ?? null }); setTimeout(() => document.getElementById('panel-bayar-rutin')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }}>ubah</a> · <a href="#" onClick={e => { e.preventDefault(); confirm('Batalkan tanda dibayar?') && jalankan(() => api('/api/circle/buku/bayar-rutin/batal', { method: 'POST', body: { studioId, bulan, sumber: b.sumber, sumberId: b.sumberId } }), setGalat, muat) }}>batal</a></>}</span>
              : !d.ditutup ? <label style={{ flexDirection: 'row', alignItems: 'center', gap: 4, margin: 0 }} className="kecil"><input type="checkbox" style={{ width: 'auto' }} checked={pilih.has(`${b.sumber}|${b.sumberId}`)} onChange={e => { const n = new Set(pilih); e.target.checked ? n.add(`${b.sumber}|${b.sumberId}`) : n.delete(`${b.sumber}|${b.sumberId}`); setPilih(n) }} /> <span className="redup">belum ·</span> pilih</label> : <span className="redup kecil">belum</span>)}</td><td>{b.rekening ?? <span className="redup kecil">—</span>}</td>
            <td className="kanan"><b className={b.arus === 'INCOME' ? 'nada-ok' : ''}>{b.arus === 'INCOME' ? '+' : '−'}{rp(b.jumlah)}</b></td>
            <td className="kanan">{b.sumber === 'MANUAL' && !b.terkunci && <button className="btn kecil" onClick={() => confirm('Hapus entri ini?') && jalankan(() => api(`/api/circle/buku/entri/${b.id}`, { method: 'DELETE' }), setGalat, muat)}>Hapus</button>}
              {/* Baris otomatis dari menu lain diubah di sumbernya (satu sumber data; 17 Nov 2026, masukan tim) */}
              {!d.ditutup && b.sumber !== 'MANUAL' && <span className="redup kecil" title="Baris ini dibuat otomatis — ubah atau hapus di menu sumbernya supaya datanya tetap cocok">{SUMBER_UBAH[b.sumber === 'BIAYA' && b.dariFreelance ? 'FREELANCE' : b.sumber] ?? ''}</span>}</td></tr>)}</tbody></table>
      )}
      <p className="redup kecil" style={{ marginTop: 8 }}>Total: pemasukan {rp(d.masuk)} · tetap {rp(d.tetap)} · variabel {rp(d.variabel)}</p>
    </div>
  )
}

export function ItemTetap({ studioId, p }) {
  const [d, setD] = useState(null)
  const [kat, setKat] = useState([])
  const [f, setF] = useState({ kategoriId: '', nama: '', jumlahBawaan: '', global: false, rekeningId: null })
  const [rek, setRek] = useState([])
  const [galat, setGalat] = useState('')
  const bulan = kunciBulan(p)
  const muat = useCallback(() => api(`/api/circle/buku/item-tetap?studioId=${studioId}&bulan=${bulan}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, bulan])
  useEffect(() => { setD(null); muat(); api('/api/circle/buku/kategori').then(x => { const t = x.kategori.filter(k => k.sifat === 'TETAP' && !KATEGORI_BIO.includes(k.nama)); setKat(t); setF(v => ({ ...v, kategoriId: v.kategoriId || '' })) }).catch(() => {}); api(`/api/circle/buku/rekening?studioId=${studioId}`).then(setRek).catch(() => {}) }, [muat, studioId])
  if (!d) return galat ? <div className="galat blok">{galat}</div> : <div className="redup">Memuat…</div>
  // Gaji/SHU tidak ditawarkan bila sudah diambil dari Bio studio (12 Nov 2026)
  const katBoleh = kat.filter(k => !((['Biaya Gaji & Uang Makan', 'Dignity'].includes(k.nama) && d.gajiBio?.orang.length) || (k.nama === 'SHU' && d.gajiBio?.shu)))
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      <p className="redup">Biaya tetap bulanan yang TIDAK ada di Bio studio, dikelompokkan per kategori. Gaji (THP), SHU, langganan, iuran, kontribusi, coworking & entertainment diambil otomatis dari Bio studio — lihat bagian di bawah, tidak perlu diketik lagi. Jumlah bulan ini bisa diubah per bulan tanpa mengubah jumlah bawaan. Ikut dihitung saat tutup bulan.</p>
      {d.item.length === 0 ? <div className="kosong">Belum ada biaya rutin.</div> : <table><thead><tr><th>Item</th>{rek.length > 0 && <th>Dibayar dari</th>}<th className="kanan">Bawaan</th><th className="kanan">Bulan ini</th><th /></tr></thead>
        {/* Per kategori (12 Nov 2026, masukan tim): tiap kategori jadi satu bagian + subtotal — mis. Gaji, SHU, Dignity */}
        {[...d.item.reduce((m, i) => m.set(i.kategori, [...(m.get(i.kategori) ?? []), i]), new Map())].map(([kategori, daftar]) => <tbody key={kategori}>
          <tr className="baris-kelompok"><td colSpan={rek.length > 0 ? 3 : 2}><b>{kategori}</b> <span className="redup kecil">· {daftar.length} item</span></td><td className="kanan"><b>{rp(daftar.filter(i => !i.diabaikan).reduce((a, i) => a + i.jumlahBulanIni, 0))}</b></td><td /></tr>
          {daftar.map(i => <ItemBaris key={i.id} i={i} ditutup={d.ditutup} rek={rek} bisa={d.bisaBuat} bisaHapus={!d.ditutup && (i.global ? d.bisaBuatGlobal : d.bisaBuat)}
            hapus={() => confirm(`Hapus biaya rutin "${i.nama}"?\n\nTidak dihitung lagi mulai bulan yang belum ditutup. Bulan yang sudah ditutup tidak berubah.`) && jalankan(() => api(`/api/circle/buku/item-tetap/${i.id}`, { method: 'PATCH', body: { aktif: false } }), setGalat, muat)}
            ubahRek={(v) => jalankan(() => api(`/api/circle/buku/item-tetap/${i.id}`, { method: 'PATCH', body: { rekeningId: v } }), setGalat, muat)} simpan={(jumlah) => jalankan(() => api(`/api/circle/buku/item-tetap/${i.id}/bulan`, { method: 'PUT', body: { studioId, bulan, jumlah: Number(jumlah) } }), setGalat, muat)} />)}
        </tbody>)}
        <tbody><tr><td colSpan={rek.length > 0 ? 3 : 2}><b>Total biaya rutin (diisi di circle)</b></td><td className="kanan"><b>{rp(d.item.filter(i => !i.diabaikan).reduce((a, i) => a + i.jumlahBulanIni, 0))}</b></td><td /></tr></tbody></table>}
      {(d.gajiBio?.orang.length > 0 || d.gajiBio?.shu > 0) && <div className="panel" style={{ marginTop: 12 }}>
        <h3 className="judul-bagian">Gaji, Dignity & SHU dari Bio studio · {rp(d.gajiBio.orang.reduce((a, o) => a + o.jumlah, 0) + d.gajiBio.shu)}/bulan</h3>
        <div className="redup kecil">Gaji = THP di Bio studio (orang aktif). Bila slip Penggajian bulan ini sudah dibuat, angka slip yang dipakai (sudah termasuk bonus, lembur & potongan). SHU = total SHU di Bio. Otomatis ikut Tutup bulan — tidak perlu diketik di tabel atas.</div>
        {/* Per kelompok (12 Nov 2026, masukan tim): Gaji · Dignity · SHU, masing-masing dengan subtotal */}
        <table>{[['Gaji', d.gajiBio.orang.filter(o => !o.dignity)], ['Dignity', d.gajiBio.orang.filter(o => o.dignity)]].filter(([, l]) => l.length).map(([judul, l]) => <tbody key={judul}>
          <tr className="baris-kelompok"><td><b>{judul}</b> <span className="redup kecil">· {l.length} orang</span></td><td className="kanan"><b>{rp(l.reduce((a, o) => a + o.jumlah, 0))}</b></td></tr>
          {l.map(o => <tr key={o.userId}><td>{o.nama}{o.dari === 'slip' && <span className="redup kecil"> · slip {o.status === 'DRAFT' ? 'draft' : o.status === 'FINAL' ? 'final' : 'dibayar'}</span>}</td><td className="kanan">{rp(o.jumlah)}</td></tr>)}
        </tbody>)}
          {d.gajiBio.shu > 0 && <tbody><tr className="baris-kelompok"><td><b>SHU</b> <span className="redup kecil">· total SHU di Bio</span></td><td className="kanan"><b>{rp(d.gajiBio.shu)}</b></td></tr></tbody>}</table>
        <a className="kecil" href={`https://app.domain-anda.com/unit-usaha?autoStudio=${studioId}`} target="_blank" rel="noreferrer">Ubah THP / SHU di Bio studio ↗</a></div>}
      {d.dariBio?.length > 0 && <div className="panel" style={{ marginTop: 12 }}>
        <h3 className="judul-bagian">Dari Bio studio · {rp(d.dariBio.filter(x => !x.dobel).reduce((a, x) => a + x.jumlah, 0))}/bulan</h3>
        <div className="redup kecil">Langganan, iuran, kontribusi & coworking diisi <b>sekali</b> di Bio studio (Management Dashboard → Unit Usaha → Bio Studio → Pengeluaran Rutin) lalu otomatis ikut dihitung di sini — tidak perlu diketik lagi sebagai biaya rutin. Gaji, SHU, Dignity & uang saku tetap diisi di tabel di atas.</div>
        <table><tbody>{d.dariBio.map(x => <tr key={x.id} className={x.dobel ? 'redup' : ''}><td>{x.nama}<span className="redup kecil"> · {x.jenis}</span>{x.dobel && <span className="nada-warn kecil"> · sama dengan item di atas, tidak dihitung dobel — hapus salah satunya</span>}</td><td className="kanan">{rp(x.jumlah)}</td></tr>)}</tbody></table>
        <a className="kecil" href={`https://app.domain-anda.com/unit-usaha?autoStudio=${studioId}`} target="_blank" rel="noreferrer">Ubah di Bio studio ↗</a></div>}
      {d.bisaBuatGlobal && <p className="redup kecil" style={{ marginTop: 6 }}>Butuh kategori baru (mis. Dignity)? Tambahkan di tab <b>Atur kategori</b> sebagai pengeluaran bersifat <b>tetap</b>, lalu pilih saat menambah biaya rutin.</p>}
      {d.bisaBuat && (
        <form className="toolbar" style={{ marginTop: 12 }} onSubmit={e => { e.preventDefault(); jalankan(async () => { await api('/api/circle/buku/item-tetap', { method: 'POST', body: { studioId: f.global ? undefined : studioId, kategoriId: f.kategoriId, nama: f.nama, jumlahBawaan: Number(f.jumlahBawaan || 0), rekeningId: f.global ? undefined : f.rekeningId } }); setF({ ...f, nama: '', jumlahBawaan: '' }) }, setGalat, muat) }}>
          <select required style={{ width: 'auto' }} value={f.kategoriId} onChange={e => setF({ ...f, kategoriId: e.target.value })}><option value="">— kategori —</option>{katBoleh.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}</select>
          <input style={{ width: 180 }} placeholder="Nama item" value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} required maxLength={100} />
          <InputAngka style={{ width: 140 }} placeholder="Jumlah bawaan" value={f.jumlahBawaan} onChange={e => setF({ ...f, jumlahBawaan: e.target.value })} />
          {rek.length > 0 && !f.global && <PilihRekening daftar={rek} value={f.rekeningId} kosong="dibayar dari…" style={{ width: 'auto' }} onChange={v => setF({ ...f, rekeningId: v })} />}
          {d.bisaBuatGlobal && <label style={{ flexDirection: 'row', alignItems: 'center', margin: 0 }}><input type="checkbox" style={{ width: 'auto' }} checked={f.global} onChange={e => setF({ ...f, global: e.target.checked })} /> semua unit</label>}
          <button className="btn kecil utama">+ Biaya rutin</button>
        </form>
      )}
    </div>
  )
}
function ItemBaris({ i, ditutup, simpan, rek, bisa, ubahRek, bisaHapus, hapus }) {
  const [v, setV] = useState(String(i.jumlahBulanIni))
  useEffect(() => setV(String(i.jumlahBulanIni)), [i.jumlahBulanIni])
  return <tr className={i.diabaikan ? 'redup' : ''}><td><b style={i.diabaikan ? { textDecoration: 'line-through' } : undefined}>{i.nama}</b>{i.diabaikan && <span className="kecil nada-warn"> · tidak dihitung (diambil dari Bio) — boleh dihapus</span>}{i.global && <span className="chip sub" style={{ marginLeft: 6 }}>semua unit</span>}{i.catatan && <div className="redup kecil">{i.catatan}</div>}</td>{rek.length > 0 && <td>{i.global ? <span className="redup kecil">—</span> : bisa && !ditutup ? <PilihRekening kecil daftar={rek} value={i.rekeningId} kosong="pilih…" onChange={ubahRek} /> : (rek.find(r => r.id === i.rekeningId)?.nama ?? '—')}</td>}<td className="kanan">{rp(i.jumlahBawaan)}</td>
    <td className="kanan">{ditutup ? <b>{rp(i.jumlahBulanIni)}</b> : <><InputAngka style={{ width: 130, display: 'inline-block' }} value={v} onChange={e => setV(e.target.value)} /> <button className="btn kecil" disabled={Number(v) === i.jumlahBulanIni} onClick={() => simpan(v)}>Simpan</button></>}</td>
    <td className="kanan">{bisaHapus && <button className="btn kecil" title="Hapus biaya rutin ini" onClick={hapus}>Hapus</button>}</td></tr>
}

function SemuaUnit({ p, ke }) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const bulan = kunciBulan(p)
  useEffect(() => { setD(null); api(`/api/circle/buku/ringkasan-circle?bulan=${bulan}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [bulan])
  if (!d) return galat ? <div className="galat blok">{galat}</div> : <div className="redup">Memuat…</div>
  return (
    <div>
      <div className="ringkasan">
        <div className="stat"><span className="redup kecil">Status bulan</span><b>{{ DITUTUP: '🔒 Ditutup', SEBAGIAN: 'Sebagian', BERJALAN: 'Berjalan' }[d.statusCircle]}</b><span className="redup kecil">{d.unitDitutup}/{d.unitTotal} unit ditutup</span></div>
        <div className="stat"><span className="redup kecil">Pemasukan</span><b>{rp(d.total.masuk)}</b></div>
        <div className="stat"><span className="redup kecil">Pengeluaran</span><b>{rp(d.total.keluar)}</b></div>
        <div className="stat"><span className="redup kecil">Hasil</span><b className={d.total.hasil < 0 ? 'nada-bad' : 'nada-ok'}>{rp(d.total.hasil)}</b></div>
        <div className="stat"><span className="redup kecil">Kas akhir</span><b>{rp(d.total.kasAkhir)}</b></div>
      </div>
      {d.unit.length === 0 ? <div className="kosong">Tidak ada unit dalam wewenangmu.</div> : <table><thead><tr><th>Unit</th><th>Status</th><th className="kanan">Pemasukan</th><th className="kanan">Pengeluaran</th><th className="kanan">Hasil</th><th className="kanan">Kas akhir</th><th /></tr></thead>
        <tbody>{d.unit.map(u => <tr key={u.studioId}><td><b>{u.nama.trim()}</b></td><td>{u.status === 'DITUTUP' ? '🔒 Ditutup' : 'Berjalan'}</td><td className="kanan">{rp(u.masuk)}</td><td className="kanan">{rp(u.keluar)}</td><td className={'kanan ' + (u.hasil < 0 ? 'nada-bad' : '')}>{rp(u.hasil)}</td><td className="kanan">{rp(u.kasAkhir)}</td>
          <td className="kanan">{(u.menunggu > 0 || u.takTerpetakan > 0) && <span className="lencana revisi" title="Ada biaya yang belum dihitung">⚠ {u.menunggu + u.takTerpetakan}</span>}</td></tr>)}</tbody></table>}
    </div>
  )
}

function Pemetaan() {
  const [biaya, setBiaya] = useState(null)
  const [kat, setKat] = useState([])
  const [baru, setBaru] = useState({ nama: '', arus: 'EXPENSE', sifat: 'VARIABEL' })
  const [nb, setNb] = useState({ nama: '', khusus: false })
  const [galat, setGalat] = useState('')
  const muat = useCallback(() => { api('/api/circle/kas/kategori-biaya').then(setBiaya).catch(e => setGalat(e.message)); api('/api/circle/buku/kategori').then(x => setKat(x.kategori)).catch(() => {}) }, [])
  useEffect(() => { muat() }, [muat])
  if (!biaya) return galat ? <div className="galat blok">{galat}</div> : <div className="redup">Memuat…</div>
  const ledgerExp = kat.filter(k => k.arus === 'EXPENSE')
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      <p className="redup">Biaya yang DISETUJUI hanya masuk ke laporan keuangan bila kategorinya dipasangkan ke kategori laporan keuangan. Kategori yang belum dipasangkan dilaporkan sebagai peringatan, bukan dihitung diam-diam.</p>
      <h3 className="judul-bagian">Kategori biaya → kategori laporan keuangan</h3>
      {biaya.kategori.length === 0 ? <div className="kosong">Belum ada kategori biaya.</div> : <table><tbody>{biaya.kategori.map(k => <tr key={k.id}><td><b>{k.nama}</b>{k.khususManajemen && <span className="chip sub" style={{ marginLeft: 6 }}>khusus manajemen</span>}</td>
        <td><select disabled={!biaya.bisaUbah} value={k.kategoriLedgerId ?? ''} onChange={e => jalankan(() => api('/api/circle/kas/kategori-biaya', { method: 'POST', body: { nama: k.nama, khususManajemen: k.khususManajemen, aktif: k.aktif, kategoriLedgerId: e.target.value || null } }), setGalat, muat)}><option value="">— belum dipetakan —</option>{ledgerExp.map(l => <option key={l.id} value={l.id}>{l.nama} ({l.sifat.toLowerCase()})</option>)}</select></td></tr>)}</tbody></table>}
      {biaya.bisaUbah ? <>
        <form className="toolbar" style={{ marginTop: 10 }} onSubmit={e => { e.preventDefault(); jalankan(async () => { await api('/api/circle/kas/kategori-biaya', { method: 'POST', body: { nama: nb.nama, khususManajemen: nb.khusus } }); setNb({ nama: '', khusus: false }) }, setGalat, muat) }}>
          <input style={{ width: 200 }} placeholder="Kategori biaya baru" value={nb.nama} onChange={e => setNb({ ...nb, nama: e.target.value })} required maxLength={60} /><label style={{ flexDirection: 'row', alignItems: 'center', margin: 0 }}><input type="checkbox" style={{ width: 'auto' }} checked={nb.khusus} onChange={e => setNb({ ...nb, khusus: e.target.checked })} /> khusus manajemen</label><button className="btn kecil utama">+ Kategori biaya</button></form>
        <h3 className="judul-bagian" style={{ marginTop: 20 }}>Kategori laporan keuangan</h3>
        <table><tbody>{kat.map(k => <tr key={k.id}><td>{k.nama}</td><td className="redup">{k.arus === 'INCOME' ? 'pemasukan' : `pengeluaran ${k.sifat?.toLowerCase()}`}</td></tr>)}</tbody></table>
        <form className="toolbar" style={{ marginTop: 10 }} onSubmit={e => { e.preventDefault(); jalankan(async () => { await api('/api/circle/buku/kategori', { method: 'POST', body: baru }); setBaru({ ...baru, nama: '' }) }, setGalat, muat) }}>
          <input style={{ width: 200 }} placeholder="Kategori laporan keuangan baru" value={baru.nama} onChange={e => setBaru({ ...baru, nama: e.target.value })} required maxLength={80} />
          <select style={{ width: 'auto' }} value={baru.arus} onChange={e => setBaru({ ...baru, arus: e.target.value })}><option value="EXPENSE">Pengeluaran</option><option value="INCOME">Pemasukan</option></select>
          {baru.arus === 'EXPENSE' && <select style={{ width: 'auto' }} value={baru.sifat} onChange={e => setBaru({ ...baru, sifat: e.target.value })}><option value="VARIABEL">Variabel</option><option value="TETAP">Tetap</option></select>}
          <button className="btn kecil utama">+ Kategori</button></form>
      </> : <p className="redup kecil">Pengaturan kategori hanya dapat diubah Super Admin / Kepala Ekosistem.</p>}
    </div>
  )
}

// Laba rugi 12 bulan + proyeksi (adaptasi OGS KaizenFinanceStudioPlService). Memakai tahun dari pilihan bulan.
function LabaRugi({ studioId, tahun }) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  useEffect(() => { setD(null); api(`/api/circle/buku/laba-rugi?studioId=${studioId}&tahun=${tahun}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [studioId, tahun])
  if (galat) return <div className="galat blok">{galat}</div>
  if (!d) return <div className="redup">Memuat…</div>
  const sel = (n) => <td style={{ textAlign: 'right', whiteSpace: 'nowrap', color: n < 0 ? 'var(--red)' : undefined }}>{n === 0 ? <span className="redup">·</span> : Math.round(n).toLocaleString('id-ID')}</td>
  const baris = (r, k) => <tr key={k + r.kategori}><td>{r.kategori}{r.sifat === 'TETAP' && <span className="redup kecil"> · tetap</span>}</td>{r.sel.map((n, i) => <Fragment key={i}>{sel(n)}</Fragment>)}{sel(r.total)}</tr>
  const tebal = (label, arr, total) => <tr style={{ fontWeight: 700 }}><td>{label}</td>{arr.map((n, i) => <Fragment key={i}>{sel(n)}</Fragment>)}{sel(total)}</tr>
  return (
    <div>
      <div className="redup kecil" style={{ marginBottom: 8 }}>Dalam Rupiah, {tahun}. Bulan yang sudah ditutup memakai angka yang dikunci; bulan berjalan dihitung langsung. {d.marginPersen != null && <>Margin setahun: <b>{d.marginPersen}%</b>.</>} <TombolUnduh nama={`laba-rugi-${tahun}`} baris={[['Kategori', ...d.bulan, 'Total'], ...d.pendapatan.map(r => ['Pendapatan: ' + r.kategori, ...r.sel, r.total]), ['Total pendapatan', ...d.totalMasuk, d.jumlah.masuk], ...d.pengeluaran.map(r => ['Pengeluaran: ' + r.kategori, ...r.sel, r.total]), ['Total pengeluaran', ...d.totalKeluar, d.jumlah.keluar], ['Laba rugi', ...d.labaRugi, d.jumlah.labaRugi], ['Kas akhir', ...d.kasAkhir, '']]} cetak /></div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        <table><thead><tr><th>Kategori</th>{d.bulan.map((b, i) => <th key={b} style={{ textAlign: 'right' }}>{NAMA_BULAN[i].slice(0, 3)}{d.status[i] === 'DITUTUP' ? ' 🔒' : ''}</th>)}<th style={{ textAlign: 'right' }}>Total</th></tr></thead>
          <tbody>
            <tr><td colSpan={14}><b>Pendapatan</b></td></tr>{d.pendapatan.map(r => baris(r, 'i'))}{tebal('Total pendapatan', d.totalMasuk, d.jumlah.masuk)}
            <tr><td colSpan={14}><b>Pengeluaran</b></td></tr>{d.pengeluaran.map(r => baris(r, 'e'))}{tebal('Total pengeluaran', d.totalKeluar, d.jumlah.keluar)}
            {tebal('Laba rugi', d.labaRugi, d.jumlah.labaRugi)}
            <tr><td>Kas akhir bulan</td>{d.kasAkhir.map((n, i) => <Fragment key={i}>{sel(n)}</Fragment>)}<td /></tr>
          </tbody></table>
      </div>
      {d.proyeksi && <div className="panel"><h3 className="judul-bagian">Proyeksi 3 bulan</h3>
        <div className="redup kecil" style={{ marginBottom: 6 }}>{d.proyeksi.catatan}</div>
        <table><thead><tr><th>Bulan</th><th style={{ textAlign: 'right' }}>Masuk</th><th style={{ textAlign: 'right' }}>Keluar</th><th style={{ textAlign: 'right' }}>Laba rugi</th><th style={{ textAlign: 'right' }}>Kas akhir</th></tr></thead>
          <tbody>{d.proyeksi.bulan.map(b => <tr key={b.bulan}><td>{b.bulan}</td>{sel(b.masuk)}{sel(b.keluar)}{sel(b.labaRugi)}{sel(b.kasAkhir)}</tr>)}</tbody></table></div>}
    </div>
  )
}

// Rencana keuangan (audit OGS FinanceV4 Rencana): struktur biaya tetap + forecast kas 3 skenario; asumsi bisa ditimpa untuk simulasi (tidak disimpan).
function Rencana({ studioId }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [n, setN] = useState(6), [ov, setOv] = useState({ masuk: '', variabel: '', tetap: '' }), [terap, setTerap] = useState({})
  useEffect(() => { setD(null); const q = Object.entries(terap).filter(([, v]) => v !== '').map(([k, v]) => `&${k}=${v}`).join(''); api(`/api/circle/buku/rencana?studioId=${studioId}&n=${n}${q}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [studioId, n, terap])
  if (!d) return galat ? <div className="galat blok">{galat}</div> : <div className="redup">Memuat…</div>
  const sk = [['pesimis', 'Pesimis (−20%)'], ['dasar', 'Dasar'], ['optimis', 'Optimis (+20%)']]
  return (
    <div>
      <div className="panel"><h3 className="judul-bagian">Asumsi per bulan</h3>
        <div className="dua">{[['masuk', 'Pemasukan'], ['variabel', 'Biaya harian (variabel)'], ['tetap', 'Biaya rutin (tetap)']].map(([k, l]) => <label key={k}>{l} (Rp) <span className="redup kecil">sekarang {rp(d.asumsi[k])} · {d.sumberAsumsi[k]}</span><InputAngka value={ov[k]} onChange={e => setOv({ ...ov, [k]: e.target.value })} placeholder="kosong = pakai data" /></label>)}</div>
        <div className="chips"><button className="btn utama" onClick={() => setTerap({ ...ov })}>Simulasikan</button><button className="btn" onClick={() => { setOv({ masuk: '', variabel: '', tetap: '' }); setTerap({}) }}>Pakai data</button>
          <select value={n} onChange={e => setN(Number(e.target.value))}>{[3, 6, 9, 12].map(x => <option key={x} value={x}>{x} bulan</option>)}</select><span className="redup kecil">Kas awal {rp(d.kasAwal)}</span></div></div>
      {galat && <div className="galat blok">{galat}</div>}
      <div className="panel" style={{ overflowX: 'auto' }}><h3 className="judul-bagian">Perkiraan kas</h3>
        <table><thead><tr><th>Bulan</th>{sk.map(([k, l]) => <th key={k} style={{ textAlign: 'right' }}>{l}</th>)}</tr></thead><tbody>
          {d.skenario.dasar.bulan.map((b, i) => <tr key={b.bulan}><td>{b.bulan}</td>{sk.map(([k]) => { const x = d.skenario[k].bulan[i]; return <td key={k} style={{ textAlign: 'right', color: x.minus ? 'var(--red)' : undefined }}>{rp(x.kasAkhir)}<div className="redup kecil">{x.hasil >= 0 ? '+' : '−'}{rp(Math.abs(x.hasil))}</div></td> })}</tr>)}</tbody></table>
        <div className="redup kecil" style={{ marginTop: 6 }}>{sk.map(([k, l]) => d.skenario[k].bulanKasHabis ? `${l}: kas habis di ${d.skenario[k].bulanKasHabis}. ` : '').join('') || 'Dalam periode ini kas tidak habis di skenario mana pun.'} Biaya tetap tidak ikut turun di skenario pesimis.</div>
        <TombolUnduh nama={`rencana-kas-${d.bulan}`} baris={[['Bulan', ...sk.map(([, l]) => l)], ...d.skenario.dasar.bulan.map((b, i) => [b.bulan, ...sk.map(([k]) => d.skenario[k].bulan[i].kasAkhir)])]} cetak /></div>
      <div className="panel"><h3 className="judul-bagian">Rincian biaya rutin bulan ini · {rp(d.totalTetapItem)}</h3>
        {d.struktur.length === 0 ? <div className="redup kecil">Belum ada biaya rutin (isi di tab Biaya rutin).</div> : d.struktur.map(k => <div key={k.kategori} style={{ marginBottom: 6 }}><div className="meta"><b>{k.kategori}</b><span className="lencana">{rp(k.jumlah)}</span></div><div className="redup kecil">{k.item.map(i => `${i.nama} ${rp(i.jumlah)}${i.global ? ' (semua unit)' : ''}`).join(' · ')}</div></div>)}</div>
    </div>
  )
}

// Tempat mengubah/menghapus baris Rincian yang dibuat otomatis (Rincian hanya menghapus entri MANUAL)
const SUMBER_UBAH = { FREELANCE: 'batalkan di Bayar freelance', BIAYA: 'ubah/hapus di Biaya & Kas', WD: 'ubah di Biaya & Kas › Pendapatan', ITEM_TETAP: 'ubah di tab Biaya rutin' }

export default function BukuBesar({ unit, superAdmin, unitAwal }) {
  const [sub, setSub] = useState('ringkasan')
  // Ikut unit yang dipilih di sidebar (11 Nov 2026; dulu selalu unit pertama di daftar → bisa tertukar)
  const [studioId, setStudioId] = useState(unitAwal ?? unit[0]?.id ?? '')
  useEffect(() => { if (unitAwal) setStudioId(unitAwal) }, [unitAwal])
  const [p, setP] = useState(bulanSekarang())
  const TAB = [['ringkasan', 'Ringkasan & tutup'], ['rincian', 'Rincian'], ['labarugi', 'Laba rugi'], ['rencana', 'Rencana'], ['tetap', 'Biaya rutin'], ['semua', 'Semua unit'], ...(superAdmin ? [['pemetaan', 'Atur kategori']] : [])]
  const perluUnit = ['ringkasan', 'rincian', 'tetap', 'labarugi', 'rencana'].includes(sub)
  return (
    <div>
      <div className="tab-mini">{TAB.map(([k, l]) => <button key={k} className={sub === k ? 'aktif' : ''} onClick={() => setSub(k)}>{l}</button>)}</div>
      {sub !== 'pemetaan' && sub !== 'rencana' && <Bulan p={p} setP={setP} />}
      {perluUnit && unit.length > 1 && <label style={{ maxWidth: 320 }}>Unit<select value={studioId} onChange={e => setStudioId(e.target.value)}>{unit.map(s => <option key={s.id} value={s.id}>{s.nama.trim()}</option>)}</select></label>}
      {sub === 'ringkasan' && studioId && <Ringkasan key={studioId + kunciBulan(p)} studioId={studioId} p={p} />}
      {sub === 'rincian' && studioId && <Rincian key={studioId} studioId={studioId} p={p} />}
      {sub === 'labarugi' && studioId && <LabaRugi key={studioId + p.tahun} studioId={studioId} tahun={p.tahun} />}
      {sub === 'rencana' && studioId && <Rencana key={studioId} studioId={studioId} />}
      {sub === 'tetap' && studioId && <ItemTetap key={studioId} studioId={studioId} p={p} />}
      {sub === 'semua' && <SemuaUnit p={p} />}
      {sub === 'pemetaan' && <Pemetaan />}
    </div>
  )
}
