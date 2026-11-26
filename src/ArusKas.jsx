import { Fragment, useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { NAMA_BULAN, bulanSekarang, geserBulan, hariIniLokal } from './api-util'
import PilihRekening from './PilihRekening'
import { InputAngka } from './Pilihan'
import { ItemTetap } from './BukuBesar'
import { useSegarkan } from './realtime'

// ARUS KAS (Karsa Circle, tahap 5, 26 Nov 2026): satu layar sederhana ala spreadsheet Financial Forecasting, untuk Koordinator unit.
// Tidak punya data sendiri (kecuali Jadwal): membaca Pemasukan (order), Buku besar (pengeluaran, biaya rutin, kas per rekening),
// Saldo platform, dan Progres Omset (target). Mode bayangan tetap: tidak menulis ke Laporan Omset Ekosistem.
const rp = (n) => (n == null ? '—' : (n < 0 ? '−' : '') + 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID'))
const usd = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }))
const kunciBulan = (p) => `${p.tahun}-${String(p.bulan).padStart(2, '0')}`
const RUTIN = (b) => b.sumber === 'BIO' || b.sumber === 'ITEM_TETAP'
const NAMA_PLATFORM = { paypal: 'PayPal', vgen: 'VGen', fiverr: 'Fiverr', etsy: 'Etsy', upwork: 'Upwork', komunitas: 'Komunitas / WhatsApp', lainnya: 'Lainnya' }
const TAB = [['ringkas', 'Ringkasan'], ['keluar', 'Uang keluar'], ['masuk', 'Uang masuk'], ['simpanan', 'Simpanan'], ['jadwal', 'Jadwal']]

function Baris({ label, nilai, kuat }) {
  return <div className="meta" style={{ justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}><span style={kuat ? { fontWeight: 700 } : undefined}>{label}</span><span style={kuat ? { fontWeight: 700 } : undefined}>{nilai}</span></div>
}

export default function ArusKas({ studioId }) {
  const [p, setP] = useState(bulanSekarang)
  const [tab, setTab] = useState('ringkas')
  const [d, setD] = useState(null), [galat, setGalat] = useState('')
  const bulan = kunciBulan(p)

  const muat = useCallback(async () => {
    try {
      const q = `studioId=${studioId}&bulan=${bulan}`
      const [masuk, rinci, ringkas, platform, rek, jual, jadwal] = await Promise.all([
        api(`/api/circle/pemasukan?${q}`),
        api(`/api/circle/buku/rincian?${q}`),
        api(`/api/circle/buku/ringkasan?${q}`),
        api(`/api/circle/kas/saldo-platform?${q}`),
        api(`/api/circle/buku/rekening?studioId=${studioId}`),
        api(`/api/circle/penjualan?studioId=${studioId}&tahun=${p.tahun}&bulan=${p.bulan}`).catch(() => null),
        api(`/api/circle/jadwal?${q}`),
      ])
      setD({ masuk, rinci, ringkas, platform, rek, jual, jadwal }); setGalat('')
    } catch (e) { setGalat(e.message) }
  }, [studioId, bulan, p.tahun, p.bulan])
  useEffect(() => { setD(null); muat() }, [muat])
  useSegarkan(muat, ['pemasukan', 'orders'])
  const jalankan = async (fn) => { setGalat(''); try { await fn(); await muat() } catch (e) { setGalat(e.message) } }

  return (
    <div>
      <div className="toolbar">
        <button className="btn kecil" onClick={() => setP(geserBulan(p, -1))} aria-label="Bulan sebelumnya">‹</button>
        <b>{NAMA_BULAN[p.bulan - 1]} {p.tahun}</b>
        <button className="btn kecil" onClick={() => setP(geserBulan(p, 1))} aria-label="Bulan berikutnya">›</button>
      </div>
      <div className="tab-mini" role="tablist" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {TAB.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'aktif' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {galat && <div className="galat blok">{galat}</div>}
      {!d ? <div className="redup">Memuat…</div> : (
        <>
          {tab === 'ringkas' && <Ringkasan d={d} />}
          {tab === 'keluar' && <UangKeluar d={d} studioId={studioId} bulan={bulan} p={p} jalankan={jalankan} />}
          {tab === 'masuk' && <UangMasuk d={d} />}
          {tab === 'simpanan' && <Simpanan d={d} studioId={studioId} bulan={bulan} jalankan={jalankan} />}
          {tab === 'jadwal' && <Jadwal d={d} studioId={studioId} bulan={bulan} jalankan={jalankan} />}
        </>
      )}
    </div>
  )
}

// ── angka bersama ──
function hitung(d) {
  const keluarBaris = d.rinci.baris.filter(b => b.arus === 'EXPENSE')
  const keluar = keluarBaris.reduce((s, b) => s + b.jumlah, 0)
  const belumBayar = keluarBaris.filter(b => RUTIN(b) && !b.dibayar)
  const pendapatan = d.masuk.baris.reduce((s, b) => s + (b.nilaiRp ?? 0), 0)
  const platform = d.platform.saldo.filter(x => x.jumlah)
  const totalPlatform = platform.reduce((s, x) => s + x.jumlah, 0)
  const rekening = d.ringkas.rekening?.daftar ?? []
  const totalKas = rekening.length ? rekening.reduce((s, r) => s + (r.akhir ?? 0), 0) : (d.ringkas.kasAkhir ?? 0)
  return { keluarBaris, keluar, belumBayar, pendapatan, laba: pendapatan - keluar, platform, totalPlatform, rekening, totalKas }
}

function Ringkasan({ d }) {
  const h = hitung(d)
  const t = d.jual?.total
  const belumLunas = d.masuk.baris.filter(b => !b.lunas)
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div style={{ background: '#111111', color: '#f3f0e8', border: '1.5px solid var(--line)', borderRadius: 'var(--radius)', padding: '20px 22px', display: 'grid', gap: 8 }}>
          <div className="meta" style={{ justifyContent: 'space-between', fontWeight: 600 }}><span>Perkiraan pengeluaran</span><span>{rp(h.keluar)}</span></div>
          <div className="meta" style={{ justifyContent: 'space-between', fontWeight: 600 }}><span>Perkiraan pendapatan</span><span>{rp(h.pendapatan)}</span></div>
          <div className="meta" style={{ justifyContent: 'space-between', fontWeight: 700, fontSize: 18, borderTop: '1px solid #4a4a45', paddingTop: 8 }}>
            <span>Laba</span><span style={{ color: h.laba < 0 ? 'var(--pink-candy)' : 'var(--accent)' }}>{rp(h.laba)}</span>
          </div>
          {h.laba < 0 && <span className="kecil" style={{ color: '#c9c4b5' }}>Masih minus, belum untung.</span>}
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="stat" style={{ background: 'var(--accent)', color: '#111' }}><span className="kecil">Total kas (rekening)</span><b>{rp(h.totalKas)}</b></div>
          <div className="stat" style={{ background: 'var(--pink-candy)', color: '#111' }}><span className="kecil">Total kekayaan (kas + saldo platform)</span><b>{rp(h.totalKas + h.totalPlatform)}</b></div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div className="panel">
          <h3 className="judul-bagian">Catatan</h3>
          <Baris label="Pengeluaran sudah dibayar" nilai={rp(h.keluar - h.belumBayar.reduce((s, b) => s + b.jumlah, 0))} />
          <Baris label="Biaya rutin belum dibayar" nilai={`${h.belumBayar.length} · ${rp(h.belumBayar.reduce((s, b) => s + b.jumlah, 0))}`} />
          <Baris label="Pemasukan belum lunas" nilai={`${belumLunas.length} · ${rp(belumLunas.reduce((s, b) => s + (b.nilaiRp ?? 0), 0))}`} />
          <Baris label="Target omset bulan ini" nilai={t?.targetUsd ? `${usd(t.aktualUsd)} dari ${usd(t.targetUsd)} (${t.persen}%)` : 'belum diisi'} />
        </div>
        <div className="panel">
          <h3 className="judul-bagian">Total kas studio</h3>
          <div className="redup kecil" style={{ fontWeight: 600 }}>Masih di platform (belum ditarik)</div>
          {h.platform.length ? h.platform.map(x => <Baris key={x.platform} label={NAMA_PLATFORM[x.platform] ?? x.platform} nilai={rp(x.jumlah)} />) : <div className="redup kecil">Belum diisi — isi di tab Simpanan.</div>}
          <div className="redup kecil" style={{ fontWeight: 600, marginTop: 10 }}>Di rekening</div>
          {h.rekening.length ? h.rekening.map(r => <Baris key={r.id} label={r.nama} nilai={rp(r.akhir)} />) : <Baris label="Kas" nilai={rp(h.totalKas)} />}
          <div className="meta" style={{ justifyContent: 'space-between', background: 'var(--accent)', color: '#111', border: '1.5px solid var(--line)', borderRadius: 'var(--pill)', padding: '8px 16px', marginTop: 10, fontWeight: 700 }}>
            <span>Total kekayaan</span><span>{rp(h.totalKas + h.totalPlatform)}</span>
          </div>
        </div>
      </div>
      <p className="redup kecil" style={{ marginTop: 10 }}>Pendapatan = pemasukan order bulan ini (Rupiah dari kurs saat dicatat). Pengeluaran = biaya rutin, gaji, dan biaya lain bulan ini.</p>
    </div>
  )
}

function UangKeluar({ d, studioId, bulan, p, jalankan }) {
  const h = hitung(d)
  const [rekeningId, setRekeningId] = useState(null)
  const [form, setForm] = useState(false), [atur, setAtur] = useState(false)
  const [kat, setKat] = useState([])
  const [f, setF] = useState({ kategoriId: '', tanggal: hariIniLokal(), deskripsi: '', jumlah: '', rekeningId: null })
  useEffect(() => { api('/api/circle/buku/kategori').then(x => setKat(x.kategori.filter(k => k.arus === 'EXPENSE'))).catch(() => {}) }, [])
  const ditutup = d.rinci.ditutup
  const grup = new Map(); for (const b of h.keluarBaris) { const g = grup.get(b.kategori) ?? []; g.push(b); grup.set(b.kategori, g) }
  const perluRek = d.rek.length > 0
  const bayar = (b, ya) => jalankan(() => ya
    ? api('/api/circle/buku/bayar-rutin', { method: 'POST', body: { studioId, bulan, tanggal: hariIniLokal(), rekeningId, baris: [{ sumber: b.sumber, sumberId: b.sumberId }] } })
    : api('/api/circle/buku/bayar-rutin/batal', { method: 'POST', body: { studioId, bulan, sumber: b.sumber, sumberId: b.sumberId } }))
  return (
    <div>
      <p className="redup" style={{ marginTop: 0 }}>Total uang keluar bulan ini <b>{rp(h.keluar)}</b>. Centang biaya rutin kalau sudah dibayar.</p>
      {!ditutup && perluRek && h.belumBayar.length > 0 && (
        <label className="isian-sebaris" style={{ marginBottom: 10 }}>Dibayar dari rekening<PilihRekening daftar={d.rek} value={rekeningId} kosong="— pilih rekening —" onChange={setRekeningId} /></label>
      )}
      <div className="toolbar">
        {!ditutup && !form && <button className="btn utama" onClick={() => { setF({ ...f, kategoriId: f.kategoriId || kat[0]?.id || '' }); setForm(true) }}>+ Catat pengeluaran lain</button>}
        <button className="btn" onClick={() => setAtur(!atur)}>{atur ? 'Tutup biaya rutin' : 'Atur biaya rutin'}</button>
      </div>
      {form && (
        <form className="panel" style={{ marginBottom: 12 }} onSubmit={e => { e.preventDefault(); jalankan(async () => { await api('/api/circle/buku/entri', { method: 'POST', body: { studioId, ...f, jumlah: Number(f.jumlah) } }); setForm(false); setF({ ...f, deskripsi: '', jumlah: '' }) }) }}>
          <div className="dua">
            <label>Untuk apa<input value={f.deskripsi} onChange={e => setF({ ...f, deskripsi: e.target.value })} required maxLength={255} placeholder="mis. beli plugin" /></label>
            <label>Kelompok<select value={f.kategoriId} onChange={e => setF({ ...f, kategoriId: e.target.value })} required>{kat.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}</select></label>
            <label>Tanggal<input type="date" value={f.tanggal} onChange={e => setF({ ...f, tanggal: e.target.value })} required /></label>
            <label>Jumlah (Rp)<InputAngka value={f.jumlah} onChange={e => setF({ ...f, jumlah: e.target.value })} required /></label>
            {perluRek && <label>Dari rekening<PilihRekening daftar={d.rek} value={f.rekeningId} kosong="— pilih rekening —" onChange={v => setF({ ...f, rekeningId: v })} /></label>}
          </div>
          <div className="modal-aksi"><button type="button" className="btn" onClick={() => setForm(false)}>Batal</button><button className="btn utama">Simpan</button></div>
        </form>
      )}
      {atur && <div style={{ marginBottom: 14 }}><ItemTetap studioId={studioId} p={p} /></div>}
      {h.keluarBaris.length === 0 ? <div className="kosong">Belum ada uang keluar di bulan ini.</div> : (
        <table>
          <thead><tr><th>Untuk apa</th><th className="kanan">Jumlah</th><th>Status</th></tr></thead>
          <tbody>
            {[...grup.entries()].map(([g, isi]) => (
              <Fragment key={g}>
                <tr><td colSpan={3} style={{ background: 'var(--bg-surface)', fontWeight: 600 }}>{g}<span className="redup kecil" style={{ float: 'right' }}>{rp(isi.reduce((s, b) => s + b.jumlah, 0))}</span></td></tr>
                {isi.map((b, i) => (
                  <tr key={(b.sumberId ?? b.id ?? '') + i}>
                    <td>{RUTIN(b) && !ditutup && (b.dibayar ? b.bisaBatal !== false : true)
                      ? <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, margin: 0, cursor: 'pointer' }}>
                          <input type="checkbox" style={{ width: 'auto' }} checked={!!b.dibayar} disabled={!b.dibayar && perluRek && !rekeningId}
                            title={!b.dibayar && perluRek && !rekeningId ? 'Pilih rekening dulu di atas' : ''}
                            onChange={e => bayar(b, e.target.checked)} aria-label={`${b.deskripsi} sudah dibayar`} /> {b.deskripsi}</label>
                      : b.deskripsi}</td>
                    <td className="kanan">{rp(b.jumlah)}</td>
                    <td>{RUTIN(b) ? (b.dibayar ? <span className="lencana jenis-SELESAI">Sudah dibayar</span> : <span className="lencana revisi">Belum</span>) : <span className="lencana">Tercatat</span>}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
      <p className="redup kecil" style={{ marginTop: 8 }}>Gaji diambil dari Penggajian. Biaya rutin (langganan, sewa, dll.) diatur lewat tombol "Atur biaya rutin" dan otomatis muncul tiap bulan.</p>
    </div>
  )
}

function UangMasuk({ d }) {
  const per = new Map()
  for (const b of d.masuk.baris) {
    const x = per.get(b.akun) ?? { akun: b.akun, usd: 0, rpk: 0, order: 0, lunas: 0 }
    x.usd += b.nilaiUsd ?? 0; x.rpk += b.nilaiRp ?? 0; x.order += 1; if (b.lunas) x.lunas += 1; per.set(b.akun, x)
  }
  const baris = [...per.values()].sort((a, b) => b.rpk - a.rpk)
  const totUsd = baris.reduce((s, x) => s + x.usd, 0), totRp = baris.reduce((s, x) => s + x.rpk, 0)
  const minggu = d.jual?.periode ?? []
  const maks = Math.max(1, ...minggu.map(m => m.aktual))
  return (
    <div>
      {baris.length === 0 ? <div className="kosong">Belum ada pemasukan di bulan ini. Catat di menu Pemasukan.</div> : (
        <table>
          <thead><tr><th>Dari mana</th><th>Keadaan</th><th className="kanan">Dolar</th><th className="kanan">Rupiah</th></tr></thead>
          <tbody>
            {baris.map(x => <tr key={x.akun}><td><b>{x.akun}</b></td><td>{x.order} order · {x.lunas === x.order ? 'semua lunas' : `${x.order - x.lunas} belum lunas`}</td><td className="kanan">{usd(Math.round(x.usd * 100) / 100)}</td><td className="kanan">{rp(x.rpk)}</td></tr>)}
            <tr><td colSpan={2}><b>Total uang masuk</b></td><td className="kanan"><b>{usd(Math.round(totUsd * 100) / 100)}</b></td><td className="kanan"><b>{rp(totRp)}</b></td></tr>
          </tbody>
        </table>
      )}
      {minggu.length > 0 && (
        <div className="panel" style={{ marginTop: 14 }}>
          <h3 className="judul-bagian">Per minggu (omset bersih)</h3>
          {minggu.map(m => (
            <div key={m.index} style={{ display: 'grid', gridTemplateColumns: '6em 1fr 6em', gap: 10, alignItems: 'center', marginBottom: 6 }}>
              <span className="kecil">Minggu {m.index}</span>
              <div className="gf-trek"><i style={{ width: `${(m.aktual / maks) * 100}%`, background: 'var(--accent)' }} /></div>
              <span className="kanan kecil">{m.aktual ? usd(m.aktual) : '—'}</span>
            </div>
          ))}
        </div>
      )}
      <p className="redup kecil" style={{ marginTop: 8 }}>Diambil dari menu Pemasukan. Rupiah dihitung dari kurs yang diisi saat mencatat.</p>
    </div>
  )
}

function Simpanan({ d, studioId, bulan, jalankan }) {
  const h = hitung(d)
  const [ubah, setUbah] = useState(null)
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div className="panel">
          <h3 className="judul-bagian">Masih di platform</h3>
          <p className="redup kecil" style={{ marginTop: 0 }}>Uang hasil penjualan yang belum ditarik. Perbarui seminggu sekali.</p>
          {d.platform.saldo.map(x => (
            <div key={x.platform} className="meta" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{NAMA_PLATFORM[x.platform] ?? x.platform}</span>
              {ubah?.platform === x.platform
                ? <form className="meta" onSubmit={e => { e.preventDefault(); jalankan(async () => { await api('/api/circle/kas/saldo-platform', { method: 'PUT', body: { studioId, bulan, platform: x.platform, jumlah: Number(ubah.jumlah || 0) } }); setUbah(null) }) }}>
                    <InputAngka style={{ width: 140 }} value={ubah.jumlah} onChange={e => setUbah({ ...ubah, jumlah: e.target.value })} autoFocus />
                    <button className="btn kecil utama">Simpan</button><button type="button" className="btn kecil" onClick={() => setUbah(null)}>Batal</button>
                  </form>
                : <span className="meta"><b>{rp(x.jumlah)}</b><button className="btn kecil" onClick={() => setUbah({ platform: x.platform, jumlah: x.jumlah || '' })}>Ubah</button></span>}
            </div>
          ))}
        </div>
        <div className="panel">
          <h3 className="judul-bagian">Di rekening</h3>
          <p className="redup kecil" style={{ marginTop: 0 }}>Saldo akhir tiap rekening studio (saldo awal bulan + uang masuk − uang keluar).</p>
          {h.rekening.length ? h.rekening.map(r => <Baris key={r.id} label={r.nama} nilai={rp(r.akhir)} />) : <div className="redup kecil">Studio ini belum punya rekening di Bio studio. Koordinator menambahkannya di web pusat.</div>}
        </div>
      </div>
      <div className="stat" style={{ marginTop: 14, background: 'var(--accent)', color: '#111' }}><span className="kecil">Total simpanan studio</span><b>{rp(h.totalKas + h.totalPlatform)}</b></div>
      <p className="redup kecil" style={{ marginTop: 8 }}>Saldo awal rekening tiap bulan diisi di menu Tutup bulan.</p>
    </div>
  )
}

function Jadwal({ d, studioId, bulan, jalankan }) {
  const j = d.jadwal
  const [f, setF] = useState({ hari: '1', tugas: '' })
  return (
    <div>
      <p className="redup" style={{ marginTop: 0 }}>Hal-hal yang rutin dikerjakan tiap bulan. Centang kalau sudah.</p>
      {j.item.length === 0 ? <div className="kosong">Belum ada jadwal. {j.bisaUbah ? 'Tambahkan di bawah, mis. "Tgl 25 · transfer gaji".' : ''}</div> : (
        <table><tbody>
          {j.item.map((x, i) => (
            <tr key={x.id}>
              <td style={{ width: '7em', whiteSpace: 'nowrap' }}>{i === 0 || j.item[i - 1].hari !== x.hari ? <b>Tgl {x.hari}</b> : ''}</td>
              <td><label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, margin: 0, cursor: j.bisaUbah ? 'pointer' : 'default' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={x.selesai} disabled={!j.bisaUbah} onChange={e => jalankan(() => api(`/api/circle/jadwal/${x.id}/centang`, { method: 'PUT', body: { bulan, selesai: e.target.checked } }))} />
                <span style={x.selesai ? { textDecoration: 'line-through', color: 'var(--text-muted)' } : undefined}>{x.tugas}</span></label>
                {x.selesai && x.oleh && <span className="redup kecil"> · {x.oleh}</span>}</td>
              <td className="kanan">{j.bisaUbah && <button className="btn kecil" onClick={() => confirm(`Hapus jadwal "${x.tugas}"?`) && jalankan(() => api(`/api/circle/jadwal/${x.id}`, { method: 'DELETE' }))}>Hapus</button>}</td>
            </tr>
          ))}
        </tbody></table>
      )}
      {j.bisaUbah && (
        <form className="toolbar" style={{ marginTop: 12 }} onSubmit={e => { e.preventDefault(); jalankan(async () => { await api('/api/circle/jadwal', { method: 'POST', body: { studioId, hari: Number(f.hari), tugas: f.tugas } }); setF({ ...f, tugas: '' }) }) }}>
          <label className="isian-sebaris">Tanggal<input type="number" min="1" max="31" style={{ width: 70 }} value={f.hari} onChange={e => setF({ ...f, hari: e.target.value })} required /></label>
          <input style={{ flex: 1, minWidth: 200 }} value={f.tugas} onChange={e => setF({ ...f, tugas: e.target.value })} placeholder="mis. bayar langganan Adobe" maxLength={200} required aria-label="Tugas" />
          <button className="btn utama">+ Tambah</button>
        </form>
      )}
    </div>
  )
}
