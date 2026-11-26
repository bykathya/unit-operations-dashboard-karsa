import { Fragment, useCallback, useEffect, useState } from 'react'
import { api } from './api'
import TombolUnduh from './TombolUnduh'
import { useKurs } from './FormOrder'
import { unduhCsv } from './api-util'
import { NAMA_BULAN, bulanSekarang, geserBulan, hariIniLokal } from './api-util'
import { InputAngka } from './Pilihan'

// KEUANGAN di web circle: omset mingguan, rekap & peringkat, pengeluaran, kas — data Ekosistem yang sama (tidak ada salinan).
// Angka uang unit di luar wilayah perannya datang sebagai null dan tampil "—" (aturan penyamaran Ekosistem).
const PLATFORM = [['omsetFiverr', 'Fiverr'], ['omsetEtsy', 'Etsy'], ['omsetUpwork', 'Upwork'], ['omsetVgen', 'VGen'], ['omsetKomunitas', 'Komunitas'], ['omsetLainnya', 'Lainnya']]
const KATEGORI = [['BEBAN_ORANG', 'Beban orang'], ['OPERASIONAL', 'Operasional'], ['SUBSCRIPTION', 'Subscription'], ['SUPPORT', 'Support'], ['LAINNYA', 'Lainnya']]
const rp = (n) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'))
const usd = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const tgl = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const senin = (iso) => { const d = new Date(iso + 'T00:00:00Z'); const g = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - g); return d.toISOString().slice(0, 10) }
const tambahHari = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const KOSONG = { omsetFiverr: '', omsetEtsy: '', omsetUpwork: '', omsetVgen: '', omsetKomunitas: '', omsetLainnya: '', kurs: 16000, kendala: '', skorSemangat: '' }

// ── Pengeluaran per item untuk satu unit dalam satu minggu (total laporan dihitung server dari daftar ini) ──
function Pengeluaran({ studioId, awal, onUbah }) {
  const akhir = tambahHari(awal, 6)
  const [daftar, setDaftar] = useState([])
  const [f, setF] = useState({ kategori: 'OPERASIONAL', nama: '', jumlah: '', tanggal: awal })
  const [galat, setGalat] = useState('')
  const [peringatan, setPeringatan] = useState('')
  const muat = useCallback(() => api(`/api/circle/keuangan/pengeluaran?studioId=${studioId}&dari=${awal}&sampai=${akhir}`).then(setDaftar).catch(e => setGalat(e.message)), [studioId, awal, akhir])
  useEffect(() => { setF(x => ({ ...x, tanggal: awal })); muat() }, [muat, awal])
  async function tambah(e) {
    e.preventDefault(); setGalat('')
    try { const baru = await api('/api/circle/keuangan/pengeluaran', { method: 'POST', body: { studioId, ...f, jumlah: Number(f.jumlah) } }); setPeringatan(baru?.peringatan ?? ''); setF(x => ({ ...x, nama: '', jumlah: '' })); await muat(); onUbah() } catch (er) { setGalat(er.message) }
  }
  async function hapus(id) {
    if (!confirm('Hapus item pengeluaran ini?')) return
    try { await api('/api/circle/keuangan/pengeluaran/' + id, { method: 'DELETE' }); await muat(); onUbah() } catch (er) { setGalat(er.message) }
  }
  const total = daftar.reduce((a, p) => a + p.jumlah, 0)
  return (
    <div>
      <h4 className="judul-bagian">Pengeluaran minggu ini · {rp(total)}</h4>
      {daftar.length === 0 ? <div className="kosong">Belum ada item pengeluaran pada minggu ini.</div> : (
        <table><tbody>{daftar.map(p => (
          <tr key={p.id}><td>{tgl(p.tanggal)}</td><td>{p.nama}<div className="redup kecil">{KATEGORI.find(k => k[0] === p.kategori)?.[1] ?? 'Data lama'}</div></td><td className="kanan">{rp(p.jumlah)}</td><td className="kanan"><button className="btn kecil" onClick={() => hapus(p.id)}>Hapus</button></td></tr>
        ))}</tbody></table>
      )}
      <form onSubmit={tambah} style={{ marginTop: 10 }}>
        <div className="dua">
          <label>Nama<input value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} required placeholder="mis. Langganan Adobe" /></label>
          <label>Jumlah (Rp)<InputAngka terbilang value={f.jumlah} onChange={e => setF({ ...f, jumlah: e.target.value })} required /></label>
          <label>Kategori<select value={f.kategori} onChange={e => setF({ ...f, kategori: e.target.value })}>{KATEGORI.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label>Tanggal<input type="date" min={awal} max={akhir} value={f.tanggal} onChange={e => setF({ ...f, tanggal: e.target.value })} required /></label>
        </div>
        {galat && <div className="galat">{galat}</div>}
        {peringatan && <div className="kecil" style={{ color: 'var(--amber)', margin: '6px 0' }}>⚠️ {peringatan}</div>}
        <button className="btn" type="submit">+ Catat pengeluaran</button>
      </form>
    </div>
  )
}

// ── Form laporan mingguan (baru / ubah) ──
function FormLaporan({ unit, awalDefault, laporan, onSelesai, onBatal }) {
  const ubah = !!laporan
  const [studioId, setStudioId] = useState(laporan?.studioId ?? unit[0]?.id ?? '')
  const [awal, setAwal] = useState(laporan ? laporan.periodeAwal.slice(0, 10) : awalDefault)
  const [f, setF] = useState(laporan ? { ...KOSONG, ...Object.fromEntries(Object.keys(KOSONG).map(k => [k, laporan[k] ?? ''])) } : { ...KOSONG, kurs: '' })
  const kursLalu = useKurs(studioId, ubah ? null : setF) // laporan baru: kurs terisi dari laporan sebelumnya (13 Nov 2026), tinggal diganti bila berubah
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [tersimpan, setTersimpan] = useState(laporan ?? null)
  const totalUsd = PLATFORM.reduce((a, [k]) => a + (Number(f[k]) || 0), 0)

  async function simpan(e) {
    e.preventDefault(); setSibuk(true); setGalat('')
    const body = { ...Object.fromEntries(PLATFORM.map(([k]) => [k, Number(f[k]) || 0])), kurs: Number(f.kurs) || 16000, kendala: f.kendala || undefined, skorSemangat: f.skorSemangat ? Number(f.skorSemangat) : undefined }
    try {
      const hasil = ubah || tersimpan
        ? await api('/api/circle/keuangan/laporan/' + (tersimpan?.id ?? laporan.id), { method: 'PUT', body })
        : await api('/api/circle/keuangan/laporan', { method: 'POST', body: { studioId, periodeAwal: awal, ...body } })
      setTersimpan(hasil)
      if (ubah) onSelesai()
    } catch (er) { setGalat(er.message) } finally { setSibuk(false) }
  }
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <h3 className="judul-bagian">{ubah ? 'Ubah laporan mingguan' : 'Isi laporan mingguan'}</h3>
      <form onSubmit={simpan}>
        {!ubah && !tersimpan && (
          <div className="dua">
            <label>Unit<select value={studioId} onChange={e => setStudioId(e.target.value)}>{unit.map(s => <option key={s.id} value={s.id}>{s.nama.trim()}</option>)}</select></label>
            <label>Minggu mulai (Senin)<input type="date" value={awal} onChange={e => setAwal(senin(e.target.value))} required /></label>
          </div>
        )}
        <div className="redup kecil" style={{ marginBottom: 8 }}>Omset per platform (USD) — isi 0 bila tidak ada pemasukan. Hitung yang sudah diterima/selesai.</div>
        <div className="dua">
          {PLATFORM.map(([k, l]) => <label key={k}>{l}<input type="number" min="0" step="0.01" value={f[k]} placeholder="0.00" onChange={e => setF({ ...f, [k]: e.target.value })} /></label>)}
        </div>
        <div className="dua">
          <label>Kurs (Rp/USD)<InputAngka value={f.kurs} onChange={e => setF({ ...f, kurs: e.target.value })} />{!ubah && kursLalu?.dari === 'laporan' && <span className="redup kecil">dari laporan sebelumnya — kurs ini dipakai semua form order USD</span>}</label>
          <label>Skor semangat (1–5)<select value={f.skorSemangat} onChange={e => setF({ ...f, skorSemangat: e.target.value })}><option value="">Otomatis</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{['😞', '😐', '🙂', '😄', '🔥'][n - 1]} {n}</option>)}</select></label>
        </div>
        <label>Kendala / catatan<textarea rows={2} value={f.kendala} onChange={e => setF({ ...f, kendala: e.target.value })} placeholder="Opsional" /></label>
        <div className="redup" style={{ marginBottom: 10 }}>Total: <b>{usd(totalUsd)}</b> ≈ <b>{rp(totalUsd * (Number(f.kurs) || 0))}</b></div>
        {galat && <div className="galat">{galat}</div>}
        <div className="modal-aksi">
          {onBatal && <button type="button" className="btn" onClick={onBatal}>{tersimpan && !ubah ? 'Tutup' : 'Batal'}</button>}
          <button className="btn utama" disabled={sibuk}>{sibuk ? 'Menyimpan…' : tersimpan && !ubah ? 'Simpan perubahan' : 'Simpan laporan'}</button>
        </div>
      </form>
      {tersimpan && !ubah && <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <div className="redup kecil" style={{ marginBottom: 8 }}>✓ Laporan tersimpan ke Management Dashboard. Lanjut catat pengeluaran minggu ini:</div>
        <Pengeluaran studioId={tersimpan.studioId} awal={senin(tersimpan.periodeAwal.slice(0, 10))} onUbah={() => {}} />
        <div className="modal-aksi"><button className="btn utama" onClick={onSelesai}>Selesai</button></div>
      </div>}
    </div>
  )
}

// ── Tab: Minggu ini ──
function MingguIni({ bisaIsi, unitIsi }) {
  const [data, setData] = useState(null)
  const [galat, setGalat] = useState('')
  const [form, setForm] = useState(false)
  const muat = useCallback(() => api('/api/circle/keuangan/status').then(setData).catch(e => setGalat(e.message)), [])
  useEffect(() => { muat() }, [muat])
  if (galat) return <div className="galat blok">{galat}</div>
  if (!data) return <div className="redup">Memuat…</div>
  const sudah = data.filter(s => s.sudahLapor).length
  return (
    <div>
      <div className="ringkasan">
        <div className="stat"><span className="redup kecil">Sudah lapor minggu ini</span><b>{sudah} / {data.length}</b></div>
        <div className="stat"><span className="redup kecil">Omset minggu ini</span><b>{usd(data.some(s => s.laporanTerakhir?.totalUsd == null && s.sudahLapor) ? null : data.reduce((a, s) => a + (s.laporanTerakhir?.totalUsd ?? 0), 0))}</b></div>
      </div>
      {bisaIsi && !form && <div className="toolbar"><button className="btn utama" onClick={() => setForm(true)}>+ Isi laporan mingguan</button></div>}
      {form && <FormLaporan unit={unitIsi.filter(u => !data.find(d => d.id === u.id)?.sudahLapor).length ? unitIsi.filter(u => !data.find(d => d.id === u.id)?.sudahLapor) : unitIsi} awalDefault={senin(hariIniLokal())} onSelesai={() => { setForm(false); muat() }} onBatal={() => { setForm(false); muat() }} />}
      <table>
        <thead><tr><th>#</th><th>Unit</th><th>Status</th><th className="kanan">Omset minggu</th><th className="kanan">Omset bulan ini</th><th className="kanan">Kas</th></tr></thead>
        <tbody>{data.map((s, i) => (
          <tr key={s.id}>
            <td>{s.sudahLapor ? i + 1 : '·'}</td>
            <td><b>{s.nama.trim()}</b>{s.hitungDiEkosistem === false && <span className="lencana" style={{ marginLeft: 6 }}>kolaborasi</span>}</td>
            <td>{s.sudahLapor ? <span className="chip">Sudah lapor</span> : <span className="lencana revisi">Belum</span>}</td>
            <td className="kanan">{s.sudahLapor ? usd(s.laporanTerakhir?.totalUsd) : '—'}</td>
            <td className="kanan">{usd(s.omsetBulanIni)}</td>
            <td className="kanan">{rp(s.kasLive)}</td>
          </tr>
        ))}</tbody>
      </table>
      <p className="redup kecil" style={{ marginTop: 10 }}>Urutan = omset bulan berjalan di circle ini. "—" berarti angka unit itu di luar wilayah perananmu.</p>
    </div>
  )
}

// ── Tab: Rekap bulanan + peringkat ──
function Bulanan() {
  const [p, setP] = useState(bulanSekarang())
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  useEffect(() => { setD(null); api(`/api/circle/keuangan/bulanan?bulan=${p.bulan}&tahun=${p.tahun}`).then(setD).catch(e => setGalat(e.message)) }, [p])
  const maks = d ? Math.max(1, ...d.studios.map(s => s.totalUsd ?? 0)) : 1
  return (
    <div>
      <div className="toolbar">
        <button className="btn kecil" onClick={() => setP(geserBulan(p, -1))}>←</button>
        <b>{NAMA_BULAN[p.bulan - 1]} {p.tahun}</b>
        <button className="btn kecil" onClick={() => setP(geserBulan(p, 1))}>→</button>
      </div>
      {galat && <div className="galat blok">{galat}</div>}
      {!d ? <div className="redup">Memuat…</div> : <>
        <div className="ringkasan">
          <div className="stat"><span className="redup kecil">Omset</span><b>{usd(d.summary.grandTotalUsd)}</b><span className="redup kecil">≈ {rp(d.summary.grandTotalIdr)}</span></div>
          <div className="stat"><span className="redup kecil">Pengeluaran</span><b>{rp(d.summary.grandTotalPengeluaran)}</b></div>
          <div className="stat"><span className="redup kecil">Kas</span><b>{rp(d.summary.grandTotalKas)}</b></div>
          <div className="stat"><span className="redup kecil">Sudah lapor</span><b>{d.summary.sudahLapor} / {d.summary.totalStudio}</b></div>
        </div>
        <h3 className="judul-bagian">Peringkat omset</h3>
        <table>
          <thead><tr><th>#</th><th>Unit</th><th className="kanan">Omset</th><th className="kanan">Pengeluaran</th><th className="kanan">Kas</th><th className="kanan">Semangat</th><th className="kanan">Laporan</th></tr></thead>
          <tbody>{d.studios.map(s => (
            <tr key={s.id}>
              <td><b>{s.peringkat}</b></td>
              <td><b>{s.nama.trim()}</b>
                <div className="stat progres" style={{ border: 0, padding: 0, background: 'none' }}><div className="bar"><i style={{ width: `${s.totalUsd == null ? 0 : (s.totalUsd / maks) * 100}%` }} /></div></div></td>
              <td className="kanan">{usd(s.totalUsd)}</td>
              <td className="kanan">{rp(s.totalPengeluaran)}</td>
              <td className="kanan">{rp(s.kasAkhir)}</td>
              <td className="kanan">{s.avgSemangat ?? '—'}</td>
              <td className="kanan">{s.jumlahLaporan}×</td>
            </tr>
          ))}</tbody>
        </table>
      </>}
    </div>
  )
}

// ── Tab: Riwayat laporan (ubah / hapus) ──
function Riwayat({ bisaIsi }) {
  const [daftar, setDaftar] = useState(null)
  const [galat, setGalat] = useState('')
  const [edit, setEdit] = useState(null)
  const muat = useCallback(() => api('/api/circle/keuangan/laporan').then(setDaftar).catch(e => setGalat(e.message)), [])
  useEffect(() => { muat() }, [muat])
  async function hapus(l) {
    if (!confirm(`Hapus laporan ${l.studio.nama.trim()} minggu ${tgl(l.periodeAwal)}?`)) return
    try { await api('/api/circle/keuangan/laporan/' + l.id, { method: 'DELETE' }); muat() } catch (e) { setGalat(e.message) }
  }
  if (!daftar) return galat ? <div className="galat blok">{galat}</div> : <div className="redup">Memuat…</div>
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      {edit && <FormLaporan unit={[]} laporan={edit} onSelesai={() => { setEdit(null); muat() }} onBatal={() => setEdit(null)} />}
      {daftar.length === 0 ? <div className="kosong">Belum ada laporan.</div> : (
        <table>
          <thead><tr><th>Minggu</th><th>Unit</th><th className="kanan">Omset</th><th className="kanan">Pengeluaran</th><th className="kanan">Kas</th>{bisaIsi && <th />}</tr></thead>
          <tbody>{daftar.map(l => (
            <tr key={l.id}>
              <td>{tgl(l.periodeAwal)}</td><td><b>{l.studio.nama.trim()}</b></td>
              <td className="kanan">{usd(l.totalUsd)}</td><td className="kanan">{rp(l.pengeluaran)}</td><td className="kanan">{rp(l.kasSekarang)}</td>
              {bisaIsi && <td className="kanan">{l.totalUsd != null && <><button className="btn kecil" onClick={() => setEdit(l)}>Ubah</button> <button className="btn kecil" onClick={() => hapus(l)}>Hapus</button></>}</td>}
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}

// ── Tab: Kas & dana di luar kas (hanya saldo; nomor rekening tidak pernah ditampilkan di web circle) ──
function Kas({ unit }) {
  const [studioId, setStudioId] = useState(unit[0]?.id ?? '')
  const [rek, setRek] = useState([])
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')
  const [p] = useState(bulanSekarang())
  const [dana, setDana] = useState('')
  const muat = useCallback(async () => {
    if (!studioId) return
    setGalat('')
    try {
      setRek(await api('/api/circle/keuangan/saldo/' + studioId))
      const n = (await api(`/api/circle/keuangan/dana-luar-kas?bulan=${p.bulan}&tahun=${p.tahun}`)).find(x => x.studioId === studioId)
      setDana(n?.ekuitas != null ? String(n.ekuitas) : '')
    } catch (e) { setGalat(e.message) }
  }, [studioId, p])
  useEffect(() => { muat() }, [muat])
  async function simpanSaldo(r, nilai) {
    setInfo(''); setGalat('')
    try { await api(`/api/circle/keuangan/saldo/${studioId}/${r.id}`, { method: 'PUT', body: { saldo: Number(nilai) } }); setInfo('Saldo disimpan.'); muat() } catch (e) { setGalat(e.message) }
  }
  async function simpanDana() {
    setInfo(''); setGalat('')
    try { await api('/api/circle/keuangan/dana-luar-kas', { method: 'PUT', body: { studioId, bulan: p.bulan, tahun: p.tahun, ekuitas: Number(dana) || 0 } }); setInfo('Dana di luar kas disimpan.') } catch (e) { setGalat(e.message) }
  }
  const total = rek.reduce((a, r) => a + r.saldo, 0)
  return (
    <div>
      <label style={{ maxWidth: 320 }}>Unit<select value={studioId} onChange={e => setStudioId(e.target.value)}>{unit.map(s => <option key={s.id} value={s.id}>{s.nama.trim()}</option>)}</select></label>
      {galat && <div className="galat">{galat}</div>}
      {info && <div className="chip" style={{ display: 'inline-block', marginBottom: 10 }}>{info}</div>}
      <h3 className="judul-bagian">Saldo rekening · total {rp(total)}</h3>
      <p className="redup kecil">Kas laporan mingguan otomatis mengikuti jumlah saldo ini. Nomor rekening hanya dikelola di Management Dashboard.</p>
      {rek.length === 0 ? <div className="kosong">Belum ada rekening tercatat untuk unit ini (tambahkan di Bio Studio, Management Dashboard).</div> : rek.map(r => <SaldoBaris key={r.id} r={r} onSimpan={simpanSaldo} />)}
      <h3 className="judul-bagian" style={{ marginTop: 20 }}>Dana di luar kas · {NAMA_BULAN[p.bulan - 1]} {p.tahun}</h3>
      <p className="redup kecil">Saldo marketplace belum dicairkan, tabungan, deposit, dll. Catatan bulanan per unit.</p>
      <div className="toolbar"><InputAngka style={{ maxWidth: 220 }} value={dana} onChange={e => setDana(e.target.value)} placeholder="Rp" /><button className="btn" onClick={simpanDana}>Simpan</button></div>
    </div>
  )
}
function SaldoBaris({ r, onSimpan }) {
  const [v, setV] = useState(String(r.saldo))
  useEffect(() => setV(String(r.saldo)), [r.saldo])
  return <div className="toolbar"><span style={{ minWidth: 140 }}><b>{r.namaBank}</b></span><InputAngka style={{ maxWidth: 200 }} value={v} onChange={e => setV(e.target.value)} /><button className="btn kecil" disabled={Number(v) === r.saldo} onClick={() => onSimpan(r, v)}>Simpan saldo</button></div>
}

// ── Tab: Tagihan & jatuh tempo (adaptasi OGS aging piutang) — dari termin pembayaran order ──
function Tagihan({ unit }) {
  const [studioId, setStudioId] = useState(unit[0]?.id ?? '')
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  useEffect(() => { if (!studioId) return; setD(null); api(`/api/circle/piutang?studioId=${studioId}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [studioId])
  return (
    <div>
      <label style={{ maxWidth: 320 }}>Unit<select value={studioId} onChange={e => setStudioId(e.target.value)}>{unit.map(s => <option key={s.id} value={s.id}>{s.nama.trim()}</option>)}</select></label>
      {galat && <div className="galat">{galat}</div>}
      {!d ? (galat ? null : <div className="redup">Memuat…</div>) : <>
        <div className="ringkasan">
          <div className="stat"><span className="redup kecil">Total belum dibayar</span><b>{rp(d.total)}</b></div>
          {d.kelompok.map(g => <div className="stat" key={g.kunci}><span className="redup kecil">{g.label}</span><b className={g.kunci.startsWith('telat') && g.jumlah ? 'nada-bad' : ''}>{rp(g.total)}</b><span className="redup kecil">{g.jumlah} termin</span></div>)}
        </div>
        {d.baris.length > 0 && <TombolUnduh nama={'piutang-termin'} baris={[['Order', 'Klien', 'Termin', 'Jatuh tempo', 'Telat (hari)', 'Jumlah'], ...d.baris.map(b => [b.judul, b.klien, b.label, b.jatuhTempo ?? '', b.telatHari ?? 0, b.jumlah])]} cetak />}
        {d.baris.length === 0 ? <div className="kosong">Tidak ada tagihan berjalan. Termin pembayaran diisi di Detail order (klik judul order di Produksi).</div> : (
          <table><thead><tr><th>Order</th><th>Termin</th><th>Jatuh tempo</th><th className="kanan">Jumlah</th></tr></thead>
            <tbody>{d.baris.map(b => <tr key={b.id}><td><b>{b.judul}</b><div className="redup kecil">{b.klien}</div></td><td>{b.label}</td><td className={b.telatHari ? 'nada-bad' : ''}>{b.jatuhTempo ? tgl(b.jatuhTempo) : '—'}{b.telatHari ? ` · telat ${b.telatHari} hari` : ''}</td><td className="kanan">{rp(b.jumlah)}</td></tr>)}</tbody></table>
        )}
      </>}
    </div>
  )
}

// ── Tab: Bayangan omset — omset dari ORDER (otomatis) berdampingan dengan Laporan Omset (resmi, manual). Hanya tampilan: tidak menulis apa pun.
// Jembatan sebelum integrasi: bila selisih kecil & konsisten, barulah diputuskan Laporan Omset diisi otomatis dari order. ──
const nadaSelisih = (s, acuan) => (s == null ? '' : Math.abs(s) <= Math.max(1, Math.abs(acuan ?? 0) * 0.05) ? 'nada-ok' : 'nada-warn')
const tandaUsd = (n) => (n == null ? '—' : (n > 0 ? '+' : '') + usd(n))
function Bayangan({ unit }) {
  const [studioId, setStudioId] = useState(unit[0]?.id ?? '')
  const [p, setP] = useState(bulanSekarang())
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [buka, setBuka] = useState(null)
  useEffect(() => { if (!studioId) return; setD(null); api(`/api/circle/keuangan/bayangan?studioId=${studioId}&bulan=${p.bulan}&tahun=${p.tahun}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)) }, [studioId, p.bulan, p.tahun])
  const lbl = (b) => `${new Date(b.periodeAwal + 'T00:00:00Z').getUTCDate()}–${new Date(b.periodeAkhir + 'T00:00:00Z').getUTCDate()}`
  return (
    <div>
      <div className="toolbar">
        <label style={{ maxWidth: 320, margin: 0 }}>Unit<select value={studioId} onChange={e => setStudioId(e.target.value)}>{unit.map(s => <option key={s.id} value={s.id}>{s.nama.trim()}</option>)}</select></label>
        <button className="btn kecil" onClick={() => setP(geserBulan(p, -1))}>←</button><b>{NAMA_BULAN[p.bulan - 1]} {p.tahun}</b><button className="btn kecil" onClick={() => setP(geserBulan(p, 1))}>→</button>
      </div>
      <div className="redup kecil" style={{ margin: '6px 0 10px' }}>Tampilan bayangan — <b>tidak mengubah Laporan Omset</b>. Omset dari order (tanggal masuk, tanpa order batal) dibandingkan dengan Laporan Omset resmi per periode laporan. Nilai ditampilkan kotor dan bersih (setelah fee akun); lihat mana yang paling dekat dengan cara unit ini mengisi laporan.</div>
      {galat && <div className="galat">{galat}</div>}
      {!d ? (galat ? null : <div className="redup">Memuat…</div>) : <>
        <div className="ringkasan">
          <div className="stat"><span className="redup kecil">Laporan Omset ({d.total.periodeBerlaporan}/{d.total.jumlahPeriode} periode)</span><b>{usd(d.total.laporanUsd)}</b></div>
          <div className="stat"><span className="redup kecil">Order — kotor</span><b>{usd(d.total.orderKotorUsd)}</b><span className={'kecil ' + nadaSelisih(d.total.selisihKotor, d.total.laporanUsd)}>{tandaUsd(d.total.selisihKotor)} vs laporan</span></div>
          <div className="stat"><span className="redup kecil">Order — bersih</span><b>{usd(d.total.orderBersihUsd)}</b><span className={'kecil ' + nadaSelisih(d.total.selisihBersih, d.total.laporanUsd)}>{tandaUsd(d.total.selisihBersih)} vs laporan</span></div>
          <div className="stat"><span className="redup kecil">Order tercatat</span><b>{d.total.jumlahOrder}</b>{d.total.internal.jumlah > 0 && <span className="redup kecil">+{d.total.internal.jumlah} internal (tidak dibandingkan)</span>}</div>
        </div>
        <div className="redup kecil" style={{ marginBottom: 6 }}>Selisih total hanya dari periode yang sudah ada laporannya. Hijau = selisih ≤ 5%.</div>
        <TombolUnduh nama={`cek-omset-${p.tahun}-${String(p.bulan).padStart(2, '0')}`} baris={[['Periode', 'Platform', 'Laporan (USD)', 'Order kotor (USD)', 'Order bersih (USD)', 'Jumlah order', 'Selisih kotor', 'Selisih bersih'], ...d.periode.flatMap(b => b.kolom.map(k => [`${b.periodeAwal}–${b.periodeAkhir}`, k.label, k.laporan ?? '', k.orderKotor, k.orderBersih, k.jumlahOrder, k.selisihKotor ?? '', k.selisihBersih ?? '']))]} cetak />
        <table><thead><tr><th>Periode</th><th className="kanan">Laporan</th><th className="kanan">Order kotor</th><th className="kanan">Order bersih</th><th className="kanan">Selisih (kotor / bersih)</th><th></th></tr></thead>
          <tbody>{d.periode.map(b => <Fragment key={b.periodeAwal}>
            <tr><td><b>{lbl(b)}</b><div className="redup kecil">{b.jumlahOrder} order{b.internal.jumlah ? ` · ${b.internal.jumlah} internal` : ''} · kurs {Math.round(b.kurs).toLocaleString('id-ID')} ({b.kursDari})</div></td>
              <td className="kanan">{b.adaLaporan ? usd(b.laporanUsd) : <span className="redup">belum lapor</span>}</td><td className="kanan">{usd(b.orderKotorUsd)}</td><td className="kanan">{usd(b.orderBersihUsd)}</td>
              <td className="kanan">{b.adaLaporan ? <><span className={nadaSelisih(b.selisihKotor, b.laporanUsd)}>{tandaUsd(b.selisihKotor)}</span> / <span className={nadaSelisih(b.selisihBersih, b.laporanUsd)}>{tandaUsd(b.selisihBersih)}</span></> : '—'}</td>
              <td><button className="btn kecil" onClick={() => setBuka(buka === b.periodeAwal ? null : b.periodeAwal)}>{buka === b.periodeAwal ? 'Tutup' : 'Per platform'}</button></td></tr>
            {buka === b.periodeAwal && b.kolom.filter(k => k.laporan || k.orderKotor).map(k => <tr key={b.periodeAwal + k.kolom} className="redup"><td style={{ paddingLeft: 20 }}>{k.label}</td><td className="kanan">{k.laporan == null ? '—' : usd(k.laporan)}</td><td className="kanan">{usd(k.orderKotor)}</td><td className="kanan">{usd(k.orderBersih)}</td><td className="kanan">{k.laporan == null ? '—' : `${tandaUsd(k.selisihKotor)} / ${tandaUsd(k.selisihBersih)}`}</td><td className="kecil">{k.jumlahOrder} order</td></tr>)}
          </Fragment>)}</tbody></table>
        <div className="redup kecil" style={{ marginTop: 8 }}>Selisih besar biasanya karena: order belum dicatat di web circle, akun jualan order salah (mis. masih "Order internal"), kurs berbeda, atau laporan diisi dari nilai bersih platform.</div>
      </>}
    </div>
  )
}

export default function Keuangan({ unit }) {
  const [sub, setSub] = useState('minggu')
  const [galat, setGalat] = useState('')
  const [bisaIsi] = useState(true)
  const TAB = [['minggu', 'Minggu ini'], ['bulanan', 'Rekap & peringkat'], ['riwayat', 'Riwayat'], ['bayangan', 'Cek omset'], ['tagihan', 'Tagihan'], ['kas', 'Kas & dana']]
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      <div className="tab-mini">{TAB.map(([k, l]) => <button key={k} className={sub === k ? 'aktif' : ''} onClick={() => setSub(k)}>{l}</button>)}</div>
      {sub === 'minggu' && <MingguIni bisaIsi={bisaIsi} unitIsi={unit} />}
      {sub === 'bulanan' && <Bulanan />}
      {sub === 'riwayat' && <Riwayat bisaIsi={bisaIsi} />}
      {sub === 'bayangan' && <Bayangan unit={unit} />}
      {sub === 'tagihan' && <Tagihan unit={unit} />}
      {sub === 'kas' && <Kas unit={unit} />}
    </div>
  )
}
