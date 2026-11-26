import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { hariIniLokal } from './api-util'
import TombolUnduh from './TombolUnduh'
import Refleksi from './Refleksi'
import { RiwayatLogin, Pengingat, ProfilSaya } from './Tambahan'
import { unduhCsv } from './api-util'
import { InputAngka } from './Pilihan'

// KEHADIRAN (adaptasi OGS): presensi hari ini, izin, check-in harian (pribadi), kalender; koordinator: roster, kotak izin, rekap, terlambat.
const K = '/api/circle/kehadiran'
const aksi = async (fn, setGalat, muat) => { setGalat(''); try { await fn(); muat?.() } catch (e) { setGalat(e.message) } }
const tglPendek = (t) => new Date(t + 'T00:00:00Z').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const bulanIni = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7)

const LABEL_STATUS_LEMBUR = { CALON: 'menunggu penilaian admin', MENUNGGU: 'menunggu persetujuan', DISETUJUI: 'disetujui', DITOLAK: 'ditolak' }

function HariIni({ studioId }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [mode, setMode] = useState('WFO'), [lok, setLok] = useState('RUMAH_KOS'), [kel, setKel] = useState('ISTIRAHAT')
  const [lm, setLm] = useState({ tanggal: hariIniLokal(), mulai: '', selesai: '', catatan: '', orderId: '', levelId: '', progresAwal: '', progresAkhir: '' })
  const [cekLok, setCekLok] = useState(false), [infoMasuk, setInfoMasuk] = useState('')
  const [ol, setOl] = useState(null) // pilihan order untuk lembur (wajib bila aturan unit "per project")
  const muat = useCallback(() => api(`${K}/hari-ini${studioId ? `?studioId=${studioId}` : ''}`).then(setD).catch(e => setGalat(e.message)), [studioId]) // jam kerja unit di sidebar (16 Nov 2026)
  useEffect(() => { muat() }, [muat])
  useEffect(() => { if (studioId) api(`${K}/order-lembur?studioId=${studioId}`).then(setOl).catch(() => setOl(null)) }, [studioId])
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  // studioId = unit yang sedang dipilih: lembur dicatat ke unit ini (Payroll unit itu yang membayarnya)
  const catat = (body) => aksi(() => api(`${K}/catat`, { method: 'POST', body: { ...body, studioId } }), setGalat, muat)
  // Presensi datang (20 Nov 2026): unit dengan lokasi kantor → baca lokasi browser dulu (server menghitung jarak; titik tidak disimpan)
  const bacaLokasi = () => new Promise(ok => { if (!navigator.geolocation) return ok(null); navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lng: p.coords.longitude, akurasi: Math.round(p.coords.accuracy) }), () => ok(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }) })
  async function datang() {
    setGalat(''); setInfoMasuk('')
    let lokasi = null
    if (d.kantor) { setCekLok(true); lokasi = await bacaLokasi(); setCekLok(false) }
    try {
      const r = await api(`${K}/catat`, { method: 'POST', body: { jenis: 'MASUK', modeKerja: mode, ...(mode === 'WFA' ? { lokasiWfa: lok } : {}), ...(lokasi ? { lokasi } : {}), studioId } })
      if (r?.cekLokasi) setInfoMasuk(r.cekLokasi === 'COCOK' ? `✓ Lokasi cocok dengan kantor (±${r.jarakMeter} m) — tercatat WFO.` : r.cekLokasi === 'DI_LUAR' ? `Di luar kantor (±${r.jarakMeter} m) — tercatat WFA.` : `Lokasi tidak terbaca — tercatat ${r.modeKerja} sesuai pilihanmu (ditandai untuk koordinator).`)
      muat()
    } catch (e) { if (/presensi ini WFA/.test(e.message)) setMode('WFA'); setGalat(e.message) }
  }
  return (
    <div>
      {galat && <div className="galat">{galat}</div>}{infoMasuk && <div className="ok">{infoMasuk}</div>}
      <div className="panel">
        <h3 className="judul-bagian">{tglPendek(d.tanggal)} · {d.labelStatus}</h3>
        <div className="redup kecil">Jam resmi: {d.jamResmi ?? 'libur'}{d.jamIstirahat ? ` · istirahat ${d.jamIstirahat}` : ''}</div>
        <div className="statistik" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
          <div className="stat"><span className="redup kecil">Masuk</span><b>{d.masuk ?? '—'}</b></div>
          <div className="stat"><span className="redup kecil">Pulang{d.pulangOtomatis ? ' (otomatis)' : ''}</span><b>{d.pulang ?? '—'}</b></div>
          <div className="stat"><span className="redup kecil">Jam kerja bersih</span><b>{d.labelKerja}</b></div>
          <div className="stat"><span className="redup kecil">Keluar</span><b>{d.labelKeluar}</b></div>
          <div className="stat"><span className="redup kecil">Lembur</span><b>{d.labelLembur}</b></div>
        </div>
        {d.pulangOtomatis && <div className="redup kecil">Pulang dicatat otomatis oleh sistem (belum presensi pulang sampai batas unit) — jam kerja dihitung sampai jam pulang resmi, tanpa lembur.</div>}
        {d.sesi !== 'pulang' && d.pulangOtomatisJam && <div className="redup kecil">Lupa presensi pulang? Unit ini menutup presensi otomatis pukul {d.pulangOtomatisJam} (dihitung sampai jam pulang resmi).</div>}
        {d.istirahatOtomatis && <div className="redup kecil">Istirahat resmi {d.istirahatOtomatis.jadwal} dipotong otomatis ({d.istirahatOtomatis.label}).</div>}
        {d.sesi === 'belum_hadir' && d.jenisHari !== 'LIBUR' && d.jenisHari !== 'LIBUR_MINGGU' && (
          <div style={{ marginTop: 10 }}>
            <div className="chips">{['WFO', 'WFA'].map(m => <button key={m} className={'pilih' + (mode === m ? ' aktif' : '')} onClick={() => setMode(m)}>{m}</button>)}
              {mode === 'WFA' && <select value={lok} onChange={e => setLok(e.target.value)}>{Object.entries(d.pilihan.lokasiWfa).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
              <button className="btn utama" disabled={cekLok} onClick={datang}>{cekLok ? 'Membaca lokasi…' : 'Presensi datang'}</button></div>
            {d.kantor && <div className="redup kecil" style={{ marginTop: 6 }}>📍 Unit ini memakai lokasi kantor{d.kantor.label ? ` (${d.kantor.label})` : ''}: presensi di dalam radius {d.kantor.radius} m otomatis <b>WFO</b>, di luar kantor <b>WFA</b>. Izinkan akses lokasi saat diminta browser — titik lokasimu tidak disimpan, hanya hasilnya. Bila lokasi tidak terbaca, pilihan WFO/WFA di atas yang dipakai dan ditandai untuk koordinator.</div>}
          </div>)}
        {d.sesi === 'hadir' && (
          <div className="chips" style={{ marginTop: 10 }}>
            <select value={kel} onChange={e => setKel(e.target.value)}>{Object.entries(d.pilihan.keluar).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <button className="btn" onClick={() => catat({ jenis: 'KELUAR', jenisKeluar: kel })}>Keluar sementara</button>
            <button className="btn utama" onClick={() => { if (confirm('Catat pulang sekarang?')) catat({ jenis: 'PULANG' }) }}>Presensi pulang</button>
          </div>)}
        {d.sesi === 'keluar_sementara' && <div style={{ marginTop: 10 }}><button className="btn utama" onClick={() => catat({ jenis: 'KEMBALI' })}>Kembali</button></div>}
        {d.pasanganKeluar.length > 0 && <div className="redup kecil" style={{ marginTop: 8 }}>{d.pasanganKeluar.map((p, i) => <div key={i}>{p.label}: {p.keluar} → {p.kembali ?? 'berjalan'} ({p.menit} mnt)</div>)}</div>}
        {d.cutiDisetujui && <div className="redup kecil" style={{ marginTop: 8 }}>Izin disetujui: {d.cutiDisetujui.label} ({d.cutiDisetujui.labelDurasi})</div>}
      </div>
      {/* Lembur = fee pekerjaan di luar jam kantor (keputusan user 10 Nov 2026): bisa dicatat kapan saja, tanpa menunggu presensi pulang */}
      {(
        <div className="panel">
          <h3 className="judul-bagian">Catat lembur</h3>
          {ol?.dariTunda ? <div className="redup kecil" style={{ marginBottom: 4 }}>🌙 Unit ini menghitung lembur <b>hanya dari tugas yang ditunda admin</b> (ada di Tugas saya › Tugasku, bertanda ⏸). Kerjakan di luar jam kerja lalu klik <b>Siap QC / selesai</b> — lembur tercatat otomatis, dinilai admin, lalu disetujui koordinator. Tugas di Antreanku yang belum selesai bukan lembur.</div>
          : <div className="redup kecil" style={{ marginBottom: 4 }}>Untuk pekerjaan di luar jam kantor — boleh dicatat kapan saja (pilih tanggal pekerjaannya). Menunggu persetujuan koordinator unit sebelum dihitung di gaji.{ol && !ol.jamWajib ? ' Jam tidak wajib.' : ''}</div>}
          {d.lembur.map(l => <div key={l.id} className="redup kecil">{l.sumber === 'TUNDA' ? `🌙 Tugas ditunda (selesai ${l.selesai})` : `${l.sumber === 'OTOMATIS' ? 'Otomatis' : 'Manual'}: ${l.mulai}–${l.selesai} (${l.label})`} {l.catatan} · <b className={l.status === 'DITOLAK' ? 'nada-warn' : ''}>{LABEL_STATUS_LEMBUR[l.status] ?? l.status}</b>{l.catatanPeninjau ? ` — ${l.catatanPeninjau}` : ''}</div>)}
          {!ol?.dariTunda && <div className="chips" style={{ marginTop: 6 }}>
            <label className="isian-sebaris">Tanggal pekerjaan<input type="date" value={lm.tanggal} max={hariIniLokal()} onChange={e => setLm({ ...lm, tanggal: e.target.value })} /></label>
            <label className="isian-sebaris">Jam mulai{ol?.jamWajib ? '' : ' (opsional)'}<input type="time" value={lm.mulai} onChange={e => setLm({ ...lm, mulai: e.target.value })} /></label>
            <label className="isian-sebaris">Jam selesai{ol?.jamWajib ? '' : ' (opsional)'}<input type="time" value={lm.selesai} onChange={e => setLm({ ...lm, selesai: e.target.value })} /></label>
            {ol && (ol.wajibOrder || ol.order.length > 0) && <select value={lm.orderId} onChange={e => setLm({ ...lm, orderId: e.target.value })} title={ol.wajibOrder ? 'Unit ini memakai lembur per project — pilih order yang dilemburkan' : 'Opsional'}><option value="">{ol.wajibOrder ? '— pilih order (wajib) —' : '— order (opsional) —'}</option>{ol.order.map(o => <option key={o.id} value={o.id}>{o.ditunda ? '⏸ ' : ''}{o.judul} · {o.klien}{o.ditunda ? ' (ditunda, bisa untuk lembur)' : ''}</option>)}</select>}
            {ol?.wajibLevel && <>
              <select value={lm.levelId} onChange={e => setLm({ ...lm, levelId: e.target.value })} title="Level pekerjaan yang dilemburkan"><option value="">— pilih level (wajib) —</option>{ol.level.map(l => <option key={l.id} value={l.id}>{l.nama}{l.produk ? ` — ${l.produk}` : ''}{l.keterangan ? ` · ${l.keterangan}` : ''}</option>)}</select>
              {ol.tahap?.length > 0 && <select value="" onChange={e => e.target.value !== '' && setLm({ ...lm, progresAwal: e.target.value })} title="Pilih tahap awal (mengisi angka progres)"><option value="">Awal: pilih tahap…</option>{ol.tahap.map(t => <option key={t.id} value={t.persen}>{t.nama} ({t.persen}%)</option>)}</select>}
              <input inputMode="numeric" style={{ width: 90 }} placeholder="Progres awal %" value={lm.progresAwal} onChange={e => setLm({ ...lm, progresAwal: e.target.value.replace(/[^\d]/g, '') })} />
              {ol.tahap?.length > 0 && <select value="" onChange={e => e.target.value !== '' && setLm({ ...lm, progresAkhir: e.target.value })} title="Pilih tahap akhir (mengisi angka progres)"><option value="">Akhir: pilih tahap…</option>{ol.tahap.map(t => <option key={t.id} value={t.persen}>{t.nama} ({t.persen}%)</option>)}</select>}
              <input inputMode="numeric" style={{ width: 90 }} placeholder="Progres akhir %" value={lm.progresAkhir} onChange={e => setLm({ ...lm, progresAkhir: e.target.value.replace(/[^\d]/g, '') })} />
            </>}
            <input placeholder="Catatan (wajib)" value={lm.catatan} onChange={e => setLm({ ...lm, catatan: e.target.value })} maxLength={300} />
            <button className="btn" onClick={() => aksi(async () => { await api(`${K}/lembur`, { method: 'POST', body: { ...lm, orderId: lm.orderId || undefined, levelId: lm.levelId || undefined, progresAwal: lm.progresAwal === '' ? undefined : Number(lm.progresAwal), progresAkhir: lm.progresAkhir === '' ? undefined : Number(lm.progresAkhir), studioId } }); setLm({ tanggal: hariIniLokal(), mulai: '', selesai: '', catatan: '', orderId: '', levelId: '', progresAwal: '', progresAkhir: '' }) }, setGalat, muat)}>Simpan</button>
          </div>}
        </div>)}
    </div>
  )
}

function Riwayat() {
  const [r, setR] = useState(null), [galat, setGalat] = useState('')
  useEffect(() => { api(`${K}/riwayat?hari=31`).then(setR).catch(e => setGalat(e.message)) }, [])
  if (!r) return <div className="redup">{galat || 'Memuat…'}</div>
  return <div className="panel"><TombolUnduh nama={'riwayat-kehadiran'} baris={[['Tanggal', 'Status', 'Mode', 'Masuk', 'Pulang', 'Kerja bersih', 'Lembur'], ...r.map(x => [x.tanggal, x.labelStatus, x.modeKerja ?? '', x.masuk ?? '', x.pulang ?? '', x.labelKerja, x.labelLembur])]} cetak /><table><thead><tr><th>Tanggal</th><th>Status</th><th>Masuk</th><th>Pulang</th><th>Kerja</th><th>Lembur</th></tr></thead><tbody>
    {r.filter(x => x.status !== 'libur').map(x => <tr key={x.tanggal}><td>{tglPendek(x.tanggal)}</td><td>{x.labelStatus}{x.modeKerja ? ` · ${x.modeKerja}` : ''}</td><td>{x.masuk ?? '—'}</td><td>{x.pulang ?? '—'}{x.pulangOtomatis && <span className="redup kecil" title="Dicatat sistem: belum presensi pulang sampai batas unit"> · otomatis</span>}</td><td>{x.masuk ? x.labelKerja : '—'}{x.lupaPulang && <span className="redup kecil"> · minta koordinator mengoreksi</span>}</td><td>{x.labelLembur !== '0 mnt' ? x.labelLembur : '—'}</td></tr>)}
  </tbody></table></div>
}

function Izin() {
  const [d, setD] = useState(null), [galat, setGalat] = useState('')
  const [f, setF] = useState({ jenis: 'SAKIT', mulai: '', selesai: '', durasi: 'SEHARI', alasan: '' })
  const muat = useCallback(() => api(`${K}/cuti`).then(setD).catch(e => setGalat(e.message)), [])
  useEffect(() => { muat() }, [muat])
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  return (
    <div>
      {galat && <div className="galat">{galat}</div>}
      <form className="panel" onSubmit={e => { e.preventDefault(); aksi(async () => { await api(`${K}/cuti`, { method: 'POST', body: { ...f, selesai: f.selesai || f.mulai } }); setF({ ...f, alasan: '' }) }, setGalat, muat) }}>
        <h3 className="judul-bagian">Ajukan izin</h3>
        <div className="chips">
          <select value={f.jenis} onChange={e => setF({ ...f, jenis: e.target.value })}>{Object.entries(d.pilihan.jenis).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select value={f.durasi} onChange={e => setF({ ...f, durasi: e.target.value })}>{Object.entries(d.pilihan.durasi).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input type="date" value={f.mulai} onChange={e => setF({ ...f, mulai: e.target.value })} required /> <span className="redup kecil">s/d</span> <input type="date" value={f.selesai} min={f.mulai} onChange={e => setF({ ...f, selesai: e.target.value })} />
        </div>
        <label>Alasan<textarea rows={2} value={f.alasan} onChange={e => setF({ ...f, alasan: e.target.value })} maxLength={500} required /></label>
        <button className="btn utama">Ajukan</button>
      </form>
      <div className="panel"><h3 className="judul-bagian">Pengajuanku</h3>
        {d.cuti.length === 0 && <div className="redup">Belum ada pengajuan.</div>}
        {d.cuti.map(c => <div key={c.id} className="meta" style={{ marginBottom: 6 }}><span className="lencana">{c.status}</span><span>{c.label} · {tglPendek(c.mulai)}{c.selesai !== c.mulai ? ` – ${tglPendek(c.selesai)}` : ''} · {c.labelDurasi}</span><span className="redup">{c.alasan}</span>{c.catatanPeninjau && <span className="redup">({c.ditinjauOleh}: {c.catatanPeninjau})</span>}
          {c.status === 'MENUNGGU' && <button className="btn kecil" onClick={() => aksi(() => api(`${K}/cuti/${c.id}/batal`, { method: 'POST' }), setGalat, muat)}>Batalkan</button>}</div>)}
      </div>
    </div>
  )
}

function CheckIn() {
  const [d, setD] = useState(null), [galat, setGalat] = useState('')
  const [f, setF] = useState({ emosi: '', intensitas: 3, kejernihan: 3, fokusPikiran: '', kebutuhan: '' })
  const muat = useCallback(() => api('/api/circle/checkin/hari-ini').then(setD).catch(e => setGalat(e.message)), [])
  useEffect(() => { muat() }, [muat])
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  const Pil = ({ nama, pil }) => <select value={f[nama]} onChange={e => setF({ ...f, [nama]: e.target.value })} required><option value="">— pilih —</option>{Object.entries(pil).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
  return (
    <div>
      {galat && <div className="galat">{galat}</div>}
      <div className="redup kecil" style={{ marginBottom: 8 }}>Check-in bersifat pribadi. Koordinator hanya melihat siapa yang mengisi dan ringkasan tim, bukan jawabanmu.</div>
      {d.hariIni ? (
        <div className="panel"><h3 className="judul-bagian">Check-in hari ini</h3>{d.hariIni.status === 'DILEWATI' ? <div className="redup">Kamu melewatinya hari ini.</div> : <div>Perasaan: <b>{d.hariIni.labelEmosi}</b> · intensitas {d.hariIni.intensitas}/5 · pikiran jernih {d.hariIni.kejernihan}/5 · kebutuhan: {d.hariIni.kebutuhan}</div>}</div>
      ) : !d.hariKerja ? <div className="redup">Hari libur — tidak perlu check-in.</div> : (
        <form className="panel" onSubmit={e => { e.preventDefault(); aksi(() => api('/api/circle/checkin', { method: 'POST', body: { ...f, intensitas: Number(f.intensitas), kejernihan: Number(f.kejernihan) } }), setGalat, muat) }}>
          <h3 className="judul-bagian">Bagaimana kondisimu hari ini?</h3>
          <label>Perasaan<Pil nama="emosi" pil={d.pilihan.emosi} /></label>
          <label>Intensitas perasaan ({f.intensitas}/5)<input type="range" min="1" max="5" value={f.intensitas} onChange={e => setF({ ...f, intensitas: e.target.value })} /></label>
          <label>Kejernihan pikiran ({f.kejernihan}/5)<input type="range" min="1" max="5" value={f.kejernihan} onChange={e => setF({ ...f, kejernihan: e.target.value })} /></label>
          <label>Yang paling memenuhi pikiran<Pil nama="fokusPikiran" pil={d.pilihan.fokusPikiran} /></label>
          <label>Yang kamu butuhkan hari ini<Pil nama="kebutuhan" pil={d.pilihan.kebutuhan} /></label>
          <div className="modal-aksi"><button type="button" className="btn" onClick={() => aksi(() => api('/api/circle/checkin/lewati', { method: 'POST' }), setGalat, muat)}>Lewati</button><button className="btn utama">Simpan</button></div>
        </form>)}
    </div>
  )
}

function Kalender() {
  const [bulan, setBulan] = useState(bulanIni()), [d, setD] = useState(null), [galat, setGalat] = useState('')
  const [f, setF] = useState({ judul: '', tanggal: '', mulai: '', selesai: '', berulang: '' })
  const muat = useCallback(() => api(`/api/circle/kalender?bulan=${bulan}`).then(setD).catch(e => setGalat(e.message)), [bulan])
  useEffect(() => { muat() }, [muat])
  const geser = (n) => { const [y, m] = bulan.split('-').map(Number); setBulan(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)) }
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  const ada = d.hari.filter(h => h.jenis !== 'KERJA' || h.acara.length)
  return (
    <div>
      {galat && <div className="galat">{galat}</div>}
      <div className="chips" style={{ marginBottom: 8 }}><button className="btn kecil" onClick={() => geser(-1)}>‹</button><b>{bulan}</b><button className="btn kecil" onClick={() => geser(1)}>›</button></div>
      <div className="panel">{ada.length === 0 && <div className="redup">Tidak ada libur atau acara bulan ini.</div>}
        {ada.map(h => <div key={h.tanggal} className="meta" style={{ marginBottom: 4 }}><b>{tglPendek(h.tanggal)}</b>{h.jenis === 'LIBUR' && <span className="lencana">Libur{h.label ? ` · ${h.label}` : ''}</span>}{h.jenis === 'WFA' && <span className="lencana">WFA{h.label ? ` · ${h.label}` : ''}</span>}
          {h.acara.map(a => <span key={a.id} className="chip sub">{a.judul}{a.mulai ? ` ${a.mulai}` : ''}{a.berulang ? ' ↻' : ''}</span>)}</div>)}</div>
      {d.bisaKelola && (
        <div className="panel"><h3 className="judul-bagian">Acara</h3>
          {d.acara.map(a => <div key={a.id} className="meta" style={{ marginBottom: 4 }}><span>{a.judul} · {tglPendek(a.tanggal)}{a.berulang ? ` · ${a.berulang.toLowerCase()}${a.berulangDihentikan ? ' (dihentikan)' : ''}` : ''}</span>
            {a.berulang && !a.berulangDihentikan && <button className="btn kecil" onClick={() => aksi(() => api(`/api/circle/kalender/acara/${a.id}/hentikan`, { method: 'POST' }), setGalat, muat)}>Hentikan ulang</button>}
            <button className="btn kecil" onClick={() => { if (confirm('Hapus acara?')) aksi(() => api(`/api/circle/kalender/acara/${a.id}`, { method: 'DELETE' }), setGalat, muat) }}>Hapus</button></div>)}
          <form onSubmit={e => { e.preventDefault(); aksi(async () => { await api('/api/circle/kalender/acara', { method: 'POST', body: { judul: f.judul, tanggal: f.tanggal, mulai: f.mulai || undefined, selesai: f.selesai || undefined, berulang: f.berulang || undefined, seharian: !f.mulai } }); setF({ judul: '', tanggal: '', mulai: '', selesai: '', berulang: '' }) }, setGalat, muat) }} className="chips" style={{ marginTop: 8 }}>
            <input placeholder="Judul acara" value={f.judul} onChange={e => setF({ ...f, judul: e.target.value })} required maxLength={160} />
            <input type="date" value={f.tanggal} onChange={e => setF({ ...f, tanggal: e.target.value })} required />
            <input type="time" value={f.mulai} onChange={e => setF({ ...f, mulai: e.target.value })} /><input type="time" value={f.selesai} onChange={e => setF({ ...f, selesai: e.target.value })} />
            <select value={f.berulang} onChange={e => setF({ ...f, berulang: e.target.value })}><option value="">Sekali</option><option value="MINGGUAN">Mingguan</option><option value="BULANAN">Bulanan</option><option value="TAHUNAN">Tahunan</option></select>
            <button className="btn utama">Tambah</button></form>
        </div>)}
    </div>
  )
}

function Tim({ studioId }) {
  const [roster, setRoster] = useState(null), [kotak, setKotak] = useState(null), [rekap, setRekap] = useState(null), [telat, setTelat] = useState(null), [ci, setCi] = useState(null)
  const [galat, setGalat] = useState(''), [bulan, setBulan] = useState(bulanIni()), [lupa, setLupa] = useState(null), [jamKoreksi, setJamKoreksi] = useState({})
  const muat = useCallback(() => {
    const q = `studioId=${studioId}`
    api(`${K}/lupa-pulang?${q}`).then(setLupa).catch(() => {})
    api(`${K}/roster?${q}`).then(setRoster).catch(e => setGalat(e.message))
    api(`${K}/kotak-cuti?${q}`).then(setKotak).catch(() => {})
    api(`${K}/rekap?${q}&bulan=${bulan}`).then(setRekap).catch(() => {})
    api(`${K}/terlambat?${q}&bulan=${bulan}`).then(setTelat).catch(() => {})
    api(`/api/circle/checkin/tim?${q}`).then(setCi).catch(() => {})
  }, [studioId, bulan])
  useEffect(() => { muat() }, [muat])
  const tinjau = (id, setuju) => { let body = {}; if (!setuju) { const c = prompt('Alasan penolakan?'); if (!c) return; body = { catatan: c } } aksi(() => api(`${K}/cuti/${id}/${setuju ? 'setujui' : 'tolak'}`, { method: 'POST', body }), setGalat, muat) }
  return (
    <div>
      {galat && <div className="galat">{galat}</div>}
      {roster && <div className="panel"><h3 className="judul-bagian">Kehadiran tim hari ini</h3>
        <div className="redup kecil">Hadir {roster.jumlah.hadir} · terlambat {roster.jumlah.terlambat} · izin {roster.jumlah.izin} · belum/tidak hadir {roster.jumlah.tidakHadir} dari {roster.jumlah.anggota}</div>
        {roster.hadir.map(x => <div key={x.userId} className="meta">{x.nama} <span className="redup">{x.masuk} · {x.modeKerja}</span>{x.cekLokasi && <span className={'lencana' + (x.cekLokasi === 'COCOK' ? '' : ' revisi')} title={x.jarakMeter != null ? `±${x.jarakMeter} m dari kantor` : 'Lokasi tidak terbaca saat presensi'}>📍 {x.labelCek}</span>}{x.terlambat && <span className="lencana revisi">telat {x.menitTerlambat} mnt</span>}</div>)}
        {roster.izin.map(x => <div key={x.userId} className="meta">{x.nama} <span className="lencana">{x.jenis}</span></div>)}
        {roster.tidakHadir.map(x => <div key={x.userId} className="meta redup">{x.nama} — belum presensi</div>)}</div>}
      {lupa?.daftar.length > 0 && <div className="panel"><h3 className="judul-bagian">Lupa presensi pulang ({lupa.daftar.length})</h3>
        <div className="redup kecil">Sesi hari lalu yang belum ada jam pulang (tidak dihitung jam kerjanya). Isi jam pulang yang benar lalu klik Koreksi.</div>
        {lupa.daftar.map(x => { const k = `${x.userId}|${x.tanggal}`; return <div key={k} className="chips" style={{ marginTop: 6 }}><span><b>{x.nama}</b> · {tglPendek(x.tanggal)} · masuk {x.masuk}</span>
          <input type="time" value={jamKoreksi[k] ?? ''} onChange={e => setJamKoreksi({ ...jamKoreksi, [k]: e.target.value })} />
          <button className="btn kecil" disabled={!jamKoreksi[k]} onClick={() => aksi(() => api(`${K}/koreksi-pulang`, { method: 'POST', body: { studioId, userId: x.userId, tanggal: x.tanggal, jam: jamKoreksi[k] } }), setGalat, muat)}>Koreksi</button></div> })}</div>}
      {kotak && <div className="panel"><h3 className="judul-bagian">Izin menunggu ({kotak.menunggu.length})</h3>
        {kotak.menunggu.length === 0 && <div className="redup">Tidak ada.</div>}
        {kotak.menunggu.map(c => <div key={c.id} className="meta" style={{ marginBottom: 6 }}><b>{c.pemohon}</b><span>{c.label} · {tglPendek(c.mulai)}{c.selesai !== c.mulai ? ` – ${tglPendek(c.selesai)}` : ''} · {c.labelDurasi}</span><span className="redup">{c.alasan}</span>
          <button className="btn kecil utama" onClick={() => tinjau(c.id, true)}>Setujui</button><button className="btn kecil" onClick={() => tinjau(c.id, false)}>Tolak</button></div>)}</div>}
      {ci && <div className="panel"><h3 className="judul-bagian">Check-in tim hari ini (ringkasan)</h3>
        <div className="redup kecil">{ci.catatan}</div>
        <div>Mengisi {ci.diisi} · melewati {ci.dilewati} · belum {ci.belum} dari {ci.anggota}</div>
        {ci.diisi > 0 && !ci.ringkasanDisembunyikan && <div className="redup kecil">Perasaan: {ci.emosi.map(e => `${e.label} (${e.jumlah})`).join(', ')}<br />Kebutuhan: {ci.kebutuhan.map(e => `${e.label} (${e.jumlah})`).join(', ')}<br />Rata-rata intensitas {ci.rataIntensitas ?? '—'}/5 · kejernihan {ci.rataKejernihan ?? '—'}/5</div>}
        {ci.belumMengisi?.length > 0 && <div className="redup kecil">Belum mengisi: {ci.belumMengisi.join(', ')}</div>}</div>}
      <div className="chips" style={{ margin: '8px 0' }}><span className="redup kecil">Bulan</span><input type="month" value={bulan} onChange={e => e.target.value && setBulan(e.target.value)} /></div>
      {rekap && <div className="panel"><h3 className="judul-bagian">Rekap {rekap.bulan} ({rekap.hariKerja} hari kerja) <TombolUnduh nama={`rekap-kehadiran-${rekap.bulan}`} baris={[['Nama', 'Hari terlambat', 'Hari tidak hadir', 'Hari izin', 'Lembur'], ...rekap.orang.map(o => [o.nama, o.hariTerlambat, o.hariTidakHadir, o.hariIzin, o.labelLembur])]} cetak /></h3><table><thead><tr><th>Nama</th><th>Terlambat</th><th>Tidak hadir</th><th>Izin</th><th>Lembur</th></tr></thead><tbody>
        {rekap.orang.map(o => <tr key={o.userId}><td>{o.nama}</td><td>{o.hariTerlambat}</td><td>{o.hariTidakHadir}</td><td>{o.hariIzin}</td><td>{o.labelLembur}</td></tr>)}</tbody></table></div>}
      {telat && telat.orang.length > 0 && <div className="panel"><h3 className="judul-bagian">Keterlambatan {telat.bulan}</h3>
        {telat.orang.map(o => <div key={o.userId} className="meta"><b>{o.nama}</b><span>{o.hariTerlambat}× · total {o.labelTotal}</span></div>)}</div>}
    </div>
  )
}

// ── Lembur unit (koordinator): aturan lembur unit sendiri + persetujuan lembur anggota. Payroll di Management Dashboard menghitung uangnya dari aturan ini. ──
const rp = (n) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'))
const isiAturan = (a) => ({ mode: a.mode, tarifPerJam: a.tarifPerJam ?? '', tarifPerHari: a.tarifPerHari ?? '', tingkat: a.tingkat?.length ? a.tingkat.map(t => ({ sampaiJam: t.sampaiJam ?? '', tarifPerJam: t.tarifPerJam })) : [{ sampaiJam: 2, tarifPerJam: '' }, { sampaiJam: '', tarifPerJam: '' }], pengaliLibur: a.pengaliLibur ?? 1, minimalMenit: a.minimalMenit ?? 0, pembulatanMenit: a.pembulatanMenit ?? 0, batasJamBulanan: a.batasJamBulanan ?? '', perluPersetujuan: a.perluPersetujuan ?? true, otomatisPerluSetuju: !!a.otomatisPerluSetuju, lemburDariTunda: !!a.lemburDariTunda, catatan: a.catatan ?? '' })

function AturanLembur({ studioId, aturan, pilihan, muat, setGalat }) {
  const [f, setF] = useState(() => isiAturan(aturan))
  const [info, setInfo] = useState('')
  const ubahT = (i, k, v) => setF({ ...f, tingkat: f.tingkat.map((t, n) => (n === i ? { ...t, [k]: v } : t)) })
  const simpan = (e) => { e.preventDefault(); setInfo(''); aksi(async () => {
    const body = { studioId, ...f, tarifPerJam: f.tarifPerJam === '' ? null : Number(f.tarifPerJam), tarifPerHari: f.tarifPerHari === '' ? null : Number(f.tarifPerHari), pengaliLibur: Number(f.pengaliLibur), minimalMenit: Number(f.minimalMenit), pembulatanMenit: Number(f.pembulatanMenit), batasJamBulanan: f.batasJamBulanan === '' ? null : Number(f.batasJamBulanan),
      tingkat: f.mode === 'BERTINGKAT' ? f.tingkat.map((t, i) => ({ sampaiJam: t.sampaiJam === '' || i === f.tingkat.length - 1 ? null : Number(t.sampaiJam), tarifPerJam: Number(t.tarifPerJam) })) : null }
    await api('/api/circle/lembur/aturan', { method: 'PUT', body }); setInfo('Aturan lembur unit disimpan.') }, setGalat, muat) }
  return (
    <form className="panel" onSubmit={simpan}>
      <h3 className="judul-bagian">Aturan lembur unit ini</h3>
      <div className="redup kecil">Aturan tiap unit boleh berbeda. Payroll di Management Dashboard menghitung uang lembur dari aturan ini, hanya untuk lembur yang <b>disetujui</b>. {aturan.tersimpan ? `Terakhir diubah ${aturan.diubahOleh ?? ''}.` : 'Belum ada aturan: lembur hanya dicatat sebagai acuan (tidak menambah gaji).'}</div>
      <label>Cara hitung<select value={f.mode} onChange={e => setF({ ...f, mode: e.target.value })}>{Object.entries(pilihan.mode).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      {f.mode === 'PER_JAM' && <label>Tarif per jam (Rp)<InputAngka value={f.tarifPerJam} onChange={e => setF({ ...f, tarifPerJam: e.target.value.replace(/[^\d]/g, '') })} required /></label>}
      {f.mode === 'PER_HARI' && <label>Tarif per hari lembur (Rp)<InputAngka value={f.tarifPerHari} onChange={e => setF({ ...f, tarifPerHari: e.target.value.replace(/[^\d]/g, '') })} required /></label>}
      {f.mode === 'BERTINGKAT' && <div>
        {f.tingkat.map((t, i) => <div key={i} className="chips" style={{ marginBottom: 4 }}>
          <span className="redup kecil">{i === 0 ? 'Jam ke-1' : `Setelah jam ke-${f.tingkat[i - 1].sampaiJam || '?'}`}{i < f.tingkat.length - 1 ? ' sampai jam ke-' : ' dan seterusnya'}</span>
          {i < f.tingkat.length - 1 && <input inputMode="decimal" style={{ width: 60 }} value={t.sampaiJam} onChange={e => ubahT(i, 'sampaiJam', e.target.value.replace(/[^\d.]/g, ''))} required />}
          <span className="redup kecil">Rp/jam</span><InputAngka style={{ width: 110 }} value={t.tarifPerJam} onChange={e => ubahT(i, 'tarifPerJam', e.target.value.replace(/[^\d]/g, ''))} required />
          {f.tingkat.length > 1 && <button type="button" className="btn kecil" onClick={() => setF({ ...f, tingkat: f.tingkat.filter((_, n) => n !== i) })}>✕</button>}
        </div>)}
        {f.tingkat.length < 5 && <button type="button" className="btn kecil" onClick={() => setF({ ...f, tingkat: [...f.tingkat.slice(0, -1), { sampaiJam: '', tarifPerJam: '' }, f.tingkat[f.tingkat.length - 1]] })}>+ Tingkat</button>}
      </div>}
      {f.mode === 'PER_LEVEL' && !f.lemburDariTunda && <div className="redup kecil" style={{ margin: '6px 0' }}>Anggota memilih <b>order</b>, <b>level</b> pekerjaan, dan progres awal–akhir (%). Uang = fee level × (progres akhir − awal), dihitung otomatis; koordinator boleh menimpa saat menyetujui. Fee level dikunci saat lembur dicatat. Isi daftar level di bawah, lalu simpan aturan ini.</div>}
      {f.mode === 'PER_PROYEK' && !f.lemburDariTunda && <div className="redup kecil" style={{ margin: '6px 0' }}>Anggota memilih <b>order</b> yang dilemburkan saat mencatat lembur manual; nilai lembur (Rp) diisi koordinator saat menyetujui. Jam tetap tercatat sebagai acuan; pengali libur &amp; batas jam tidak dipakai.</div>}
      {!['TIDAK_DIBAYAR', 'PER_PROYEK', 'PER_LEVEL'].includes(f.mode) && <div className="dua">
        <label>Pengali hari libur (×)<input inputMode="decimal" value={f.pengaliLibur} onChange={e => setF({ ...f, pengaliLibur: e.target.value.replace(/[^\d.]/g, '') })} /></label>
        <label>Batas jam per bulan<input inputMode="decimal" placeholder="tanpa batas" value={f.batasJamBulanan} onChange={e => setF({ ...f, batasJamBulanan: e.target.value.replace(/[^\d.]/g, '') })} /></label>
      </div>}
      <div className="dua">
        <label>Minimal lembur per hari (menit)<input inputMode="numeric" value={f.minimalMenit} onChange={e => setF({ ...f, minimalMenit: e.target.value.replace(/[^\d]/g, '') })} /></label>
        <label>Pembulatan ke bawah<select value={f.pembulatanMenit} onChange={e => setF({ ...f, pembulatanMenit: Number(e.target.value) })}>{pilihan.pembulatan.map(p => <option key={p} value={p}>{p ? `per ${p} menit` : 'tanpa pembulatan'}</option>)}</select></label>
      </div>
      {['PER_PROYEK', 'PER_LEVEL'].includes(f.mode) && <div style={{ margin: '6px 0' }}>
        <label className="chips"><input type="checkbox" checked={f.lemburDariTunda} onChange={e => setF({ ...f, lemburDariTunda: e.target.checked })} /> <b>Lembur hanya dari tugas yang ditunda admin</b></label>
        <div className="redup kecil">Admin menunda tugas (⏸ Tunda) → tugas masuk Tugasku talent. Bila talent menyelesaikannya di <b>luar jam kerja unit</b>, otomatis tercatat 🌙 lembur; admin mencentang tahap lembur yang sudah sesuai (nilai dihitung dari level × tahap, boleh disesuaikan), lalu kamu menyetujui di Tugas saya › Lembur. Tugas yang terlambat karena kelalaian tetap di Antreanku dan bukan lembur. Saat aktif, <b>catat lembur manual</b> dan <b>lembur otomatis dari presensi pulang</b> ditutup agar tidak dobel. Isi juga daftar level &amp; tahap lembur di bawah.</div>
      </div>}
      <label className="chips"><input type="checkbox" checked={f.perluPersetujuan} onChange={e => setF({ ...f, perluPersetujuan: e.target.checked })} /> Lembur manual perlu persetujuan koordinator</label>
      <label className="chips"><input type="checkbox" checked={f.otomatisPerluSetuju} onChange={e => setF({ ...f, otomatisPerluSetuju: e.target.checked })} /> Lembur otomatis (pulang lewat jam kerja) juga perlu persetujuan</label>
      <label>Catatan aturan<input value={f.catatan} maxLength={500} onChange={e => setF({ ...f, catatan: e.target.value })} placeholder="mis. lembur hanya untuk order mendesak" /></label>
      {info && <div className="redup kecil">{info}</div>}
      <div className="modal-aksi"><button className="btn utama">Simpan aturan</button></div>
    </form>
  )
}

// Daftar level lembur unit (mode "Per level & progres"): nama, keterangan, fee; level yang dibuang hanya dinonaktifkan (catatan lama tetap utuh)
function DaftarLevel({ studioId, setGalat }) {
  const [rows, setRows] = useState(null), [info, setInfo] = useState('')
  const muat = useCallback(() => api(`/api/circle/lembur/level?studioId=${studioId}`).then(d => setRows(d.level.filter(l => l.aktif).map(l => ({ ...l, fee: String(l.fee) })))).catch(e => setGalat(e.message)), [studioId, setGalat])
  useEffect(() => { muat() }, [muat])
  if (!rows) return null
  const ubah = (i, k, v) => setRows(rows.map((r, n) => (n === i ? { ...r, [k]: v } : r)))
  const simpan = () => { setInfo(''); aksi(async () => { await api('/api/circle/lembur/level', { method: 'PUT', body: { studioId, level: rows.map(r => ({ id: r.id, nama: r.nama, produk: r.produk || '', keterangan: r.keterangan || null, fee: Number(r.fee || 0) })) } }); setInfo('Daftar level disimpan.') }, setGalat, muat) }
  return (
    <div className="panel">
      <h3 className="judul-bagian">Daftar level lembur</h3>
      <div className="redup kecil">Contoh: Revisi Minor Rp30.000, Level 1 Rp100.000. Fee ini nilai penuh (100%) per level; yang dibayar mengikuti progres yang dikerjakan. Bila fee beda per produk (mis. 3D Printing vs 3D Game), tulis level yang sama dua kali dengan produk berbeda.</div>
      {rows.map((r, i) => <div key={r.id ?? `n${i}`} className="chips" style={{ marginBottom: 4 }}>
        <input placeholder="Nama level" style={{ width: 150 }} value={r.nama} maxLength={60} onChange={e => ubah(i, 'nama', e.target.value)} />
        <input placeholder="Produk (kosong = semua)" style={{ width: 150 }} value={r.produk ?? ''} maxLength={40} onChange={e => ubah(i, 'produk', e.target.value)} />
        <input placeholder="Keterangan (opsional)" style={{ width: 200 }} value={r.keterangan ?? ''} maxLength={120} onChange={e => ubah(i, 'keterangan', e.target.value)} />
        <span className="redup kecil">Rp</span><InputAngka style={{ width: 110 }} value={r.fee} onChange={e => ubah(i, 'fee', e.target.value.replace(/[^\d]/g, ''))} />
        <button type="button" className="btn kecil" onClick={() => setRows(rows.filter((_, n) => n !== i))}>✕</button>
      </div>)}
      <div className="chips"><button type="button" className="btn kecil" onClick={() => setRows([...rows, { id: null, nama: '', produk: '', keterangan: '', fee: '' }])}>+ Level</button><button type="button" className="btn utama kecil" onClick={simpan}>Simpan daftar level</button></div>
      {info && <div className="redup kecil">{info}</div>}
    </div>
  )
}

// Tahap pekerjaan (opsional): pilihan cepat progres, mis. Blocking 20%, Finishing 100%. Anggota tetap boleh mengetik angka.
function DaftarTahap({ studioId, setGalat }) {
  const [rows, setRows] = useState(null), [info, setInfo] = useState('')
  const muat = useCallback(() => api(`/api/circle/lembur/tahap?studioId=${studioId}`).then(d => setRows(d.tahap.map(t => ({ ...t, persen: String(t.persen) })))).catch(e => setGalat(e.message)), [studioId, setGalat])
  useEffect(() => { muat() }, [muat])
  if (!rows) return null
  const ubah = (i, k, v) => setRows(rows.map((r, n) => (n === i ? { ...r, [k]: v } : r)))
  const simpan = () => { setInfo(''); aksi(async () => { await api('/api/circle/lembur/tahap', { method: 'PUT', body: { studioId, tahap: rows.map(r => ({ nama: r.nama, persen: Number(r.persen || 0) })) } }); setInfo('Daftar tahap disimpan.') }, setGalat, muat) }
  return (
    <div className="panel">
      <h3 className="judul-bagian">Tahap pekerjaan (opsional)</h3>
      <div className="redup kecil">Pilihan cepat saat anggota mengisi progres. Persen = progres yang tercapai di akhir tahap, mis. Blocking 20%, Finishing 100%.</div>
      {rows.map((r, i) => <div key={r.id ?? `n${i}`} className="chips" style={{ marginBottom: 4 }}>
        <input placeholder="Nama tahap" style={{ width: 150 }} value={r.nama} maxLength={40} onChange={e => ubah(i, 'nama', e.target.value)} />
        <input inputMode="numeric" style={{ width: 70 }} value={r.persen} onChange={e => ubah(i, 'persen', e.target.value.replace(/[^\d]/g, ''))} /><span className="redup kecil">%</span>
        <button type="button" className="btn kecil" onClick={() => setRows(rows.filter((_, n) => n !== i))}>✕</button>
      </div>)}
      <div className="chips"><button type="button" className="btn kecil" onClick={() => setRows([...rows, { nama: '', persen: '' }])}>+ Tahap</button><button type="button" className="btn utama kecil" onClick={simpan}>Simpan daftar tahap</button></div>
      {info && <div className="redup kecil">{info}</div>}
    </div>
  )
}

// JAM KERJA UNIT (16 Nov 2026, masukan tim): Koordinator mengatur jam masuk, pulang & istirahat per hari untuk unitnya — dipakai
// presensi (jam resmi, potongan istirahat, terlambat, lembur otomatis), Kehadiran tim & Analitik. Pulang otomatis: sesi tanpa presensi pulang
// ditutup sistem pada jam batas dengan waktu pulang = jam pulang resmi (jam kerja terhitung, tidak menjadi lembur).
// LOKASI KANTOR UNIT (20 Nov 2026): Koordinator menyimpan titik kantor + radius → presensi datang di dalam radius = WFO otomatis, di luar = WFA.
// Titik bisa diambil dari lokasi perangkat sekarang (paling mudah: klik saat di kantor) atau ditempel dari Google Maps.
const bacaTitik = (teks) => { const m = String(teks).match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/) || String(teks).match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/); return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null }
function LokasiKantor({ studioId }) {
  const [d, setD] = useState(null), [f, setF] = useState(null), [galat, setGalat] = useState(''), [info, setInfo] = useState(''), [sibuk, setSibuk] = useState(false)
  const isi = (x) => { setD(x); setF({ titik: x.kantor ? `${x.kantor.lat}, ${x.kantor.lng}` : '', radius: x.kantor?.radius ?? x.radiusBawaan ?? 200, label: x.kantor?.label ?? '' }) }
  useEffect(() => { api(`${K}/lokasi-kantor?studioId=${studioId}`).then(isi).catch(e => setGalat(e.message)) }, [studioId])
  if (!f) return galat ? <div className="galat">{galat}</div> : null
  const pakaiSekarang = () => { setGalat(''); if (!navigator.geolocation) return setGalat('Browser ini tidak bisa membaca lokasi'); setSibuk(true)
    navigator.geolocation.getCurrentPosition(p => { setSibuk(false); setF(x => ({ ...x, titik: `${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}` })); setInfo(`Lokasi terbaca (akurasi ±${Math.round(p.coords.accuracy)} m) — klik Simpan.`) }, () => { setSibuk(false); setGalat('Lokasi tidak terbaca — izinkan akses lokasi di browser, atau tempel titik dari Google Maps') }, { enableHighAccuracy: true, timeout: 15000 }) }
  const simpan = () => { setInfo(''); const t = bacaTitik(f.titik); if (!t) return setGalat('Titik belum benar. Contoh: -7.005145, 110.438125 (di Google Maps: klik kanan lokasi kantor → klik angka koordinatnya untuk menyalin)')
    aksi(async () => { const r = await api(`${K}/lokasi-kantor`, { method: 'PUT', body: { studioId, ...t, radius: Number(f.radius), label: f.label } }); isi({ ...d, kantor: r.kantor }); setInfo('Lokasi kantor disimpan.') }, setGalat, () => {}) }
  const hapus = () => confirm('Hapus lokasi kantor? Presensi kembali memilih WFO/WFA sendiri.') && aksi(async () => { await api(`${K}/lokasi-kantor?studioId=${studioId}`, { method: 'DELETE' }); isi({ ...d, kantor: null }); setInfo('Lokasi kantor dihapus.') }, setGalat, () => {})
  const t = bacaTitik(f.titik)
  return (
    <div className="panel">
      <h3 className="judul-bagian">Lokasi kantor (WFO / WFA otomatis)</h3>
      <p className="redup kecil">Bila diisi, presensi datang anggota unit ini membaca lokasi perangkatnya: di dalam radius = <b>WFO</b> otomatis, di luar = <b>WFA</b>. Lokasi yang tidak terbaca atau sangat kasar (sering terjadi di PC/laptop tanpa GPS) tetap boleh memilih sendiri, dan ditandai di Kehadiran tim. Titik lokasi anggota tidak disimpan. {d.kantor ? `Terakhir diubah ${d.kantor.diubahOleh ?? ''}.` : 'Belum diisi — presensi memilih WFO/WFA sendiri.'}</p>
      {galat && <div className="galat">{galat}</div>}{info && <div className="ok">{info}</div>}
      <div className="toolbar" style={{ flexWrap: 'wrap' }}>
        <label>Titik kantor (lintang, bujur)<input value={f.titik} placeholder="-7.005145, 110.438125" onChange={e => setF({ ...f, titik: e.target.value })} /></label>
        <button type="button" className="btn kecil" disabled={sibuk} onClick={pakaiSekarang} title="Klik saat kamu sedang berada di kantor">{sibuk ? 'Membaca…' : '📍 Pakai lokasi saya sekarang'}</button>
        <label>Radius (m)<input type="number" min={50} max={2000} step={10} style={{ width: 100 }} value={f.radius} onChange={e => setF({ ...f, radius: e.target.value })} /></label>
        <label>Nama tempat (opsional)<input value={f.label} placeholder="mis. Studio Semarang" onChange={e => setF({ ...f, label: e.target.value })} /></label>
      </div>
      {t && <div className="redup kecil" style={{ marginBottom: 6 }}><a href={`https://www.google.com/maps?q=${t.lat},${t.lng}`} target="_blank" rel="noreferrer noopener">Cek titik di Google Maps ↗</a></div>}
      <button className="btn utama" onClick={simpan}>Simpan lokasi kantor</button>{d.kantor && <button className="btn" style={{ marginLeft: 8 }} onClick={hapus}>Hapus</button>}
    </div>
  )
}

function JamKerjaUnit({ studioId }) {
  const [d, setD] = useState(null), [f, setF] = useState(null), [galat, setGalat] = useState(''), [info, setInfo] = useState('')
  const isi = (x) => { setD(x); setF({ hari: Object.fromEntries(Object.keys(x.hari).map(k => [k, x.jadwal[k] ? { kerja: true, masuk: x.jadwal[k].kerja[0], pulang: x.jadwal[k].kerja[1], iMulai: x.jadwal[k].istirahat[0] === x.jadwal[k].istirahat[1] ? '' : x.jadwal[k].istirahat[0], iSelesai: x.jadwal[k].istirahat[0] === x.jadwal[k].istirahat[1] ? '' : x.jadwal[k].istirahat[1] } : { kerja: false, masuk: '09:00', pulang: '17:00', iMulai: '12:00', iSelesai: '13:00' }])), pulangOtomatis: x.pulangOtomatis, batasPulang: x.batasPulang ?? '17:30' }) }
  useEffect(() => { api(`${K}/jam-kerja?studioId=${studioId}`).then(isi).catch(e => setGalat(e.message)) }, [studioId])
  if (!f) return galat ? <div className="galat">{galat}</div> : null
  const ubah = (k, kunci, v) => setF(x => ({ ...x, hari: { ...x.hari, [k]: { ...x.hari[k], [kunci]: v } } }))
  // Salin jam Senin ke Selasa–Jumat; istirahat Jumat tidak ditimpa (biasanya lebih panjang untuk sholat Jumat)
  const samakan = (k) => setF(x => ({ ...x, hari: Object.fromEntries(Object.entries(x.hari).map(([h, v]) => [h, h === '6' || !v.kerja ? v : h === '5' ? { ...v, masuk: x.hari[k].masuk, pulang: x.hari[k].pulang } : { ...x.hari[k], kerja: true }])) }))
  const simpan = () => { setInfo(''); aksi(async () => {
    const jadwal = Object.fromEntries(Object.entries(f.hari).map(([k, v]) => [k, v.kerja ? { kerja: [v.masuk, v.pulang], istirahat: v.iMulai || v.iSelesai ? [v.iMulai, v.iSelesai] : [] } : null]))
    const r = await api(`${K}/jam-kerja`, { method: 'PUT', body: { studioId, jadwal, pulangOtomatis: f.pulangOtomatis, batasPulang: f.batasPulang } }); isi(r); setInfo('Jam kerja unit disimpan.') }, setGalat, () => {}) }
  return (
    <div className="panel">
      <h3 className="judul-bagian">Jam kerja unit</h3>
      <p className="redup kecil">Dipakai untuk presensi anggota unit ini: jam resmi, potongan istirahat otomatis, tanda terlambat, lembur otomatis, rekap Kehadiran tim, dan hitungan lama pengerjaan di Analitik. {d.diatur ? `Terakhir diubah ${d.diubahOleh ?? ''}.` : 'Belum diatur — memakai jam bawaan Ekosistem.'} Minggu & hari libur kalender selalu libur.</p>
      {galat && <div className="galat">{galat}</div>}{info && <div className="ok">{info}</div>}
      <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Hari</th><th>Kerja?</th><th>Masuk</th><th>Pulang</th><th>Istirahat mulai</th><th>Istirahat selesai</th><th /></tr></thead><tbody>
        {Object.entries(d.hari).map(([k, nama]) => { const v = f.hari[k]; return <tr key={k}>
          <td>{nama}</td>
          <td><input type="checkbox" checked={v.kerja} onChange={e => ubah(k, 'kerja', e.target.checked)} /></td>
          {['masuk', 'pulang', 'iMulai', 'iSelesai'].map(c => <td key={c}><input type="time" style={{ width: 'auto' }} disabled={!v.kerja} value={v[c]} onChange={e => ubah(k, c, e.target.value)} /></td>)}
          <td>{k === '1' && <button type="button" className="btn kecil" onClick={() => samakan('1')} title="Salin jam Senin ke Selasa–Jumat (istirahat Jumat tidak diubah)">Samakan Sel–Jum</button>}</td>
        </tr> })}
      </tbody></table></div>
      <p className="redup kecil">Istirahat boleh dikosongkan (tanpa istirahat). Jumat bisa diberi istirahat lebih panjang (sholat Jumat).</p>
      <label className="centang"><input type="checkbox" checked={f.pulangOtomatis} onChange={e => setF({ ...f, pulangOtomatis: e.target.checked })} /> Pulang otomatis bila lupa presensi pulang</label>
      {f.pulangOtomatis && <div className="chips" style={{ marginBottom: 6 }}><span className="redup kecil">ditutup otomatis pukul</span><input type="time" style={{ width: 'auto' }} value={f.batasPulang} onChange={e => setF({ ...f, batasPulang: e.target.value })} />
        <span className="redup kecil">— waktu pulang dicatat = jam pulang resmi hari itu (jam kerja terhitung, tidak menjadi lembur). Yang benar-benar lembur tetap mencatat lembur manual.</span></div>}
      <button className="btn utama" onClick={simpan}>Simpan jam kerja</button>
    </div>
  )
}

// MENUNGGU PERSETUJUAN — SEMUA BULAN (18 Nov 2026, audit alur): dulu hanya bulan yang dipilih, sehingga lembur bulan lalu tak terlihat.
// Satu komponen untuk Kehadiran › Jam kerja & lembur dan Tugas saya › Lembur (Koordinator). Yang slip bulannya sudah Final/Dibayar tetap
// bisa disetujui: masuk slip berikutnya sebagai lembur susulan.
export function LemburMenunggu({ studioId, onJumlah, onUbah }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState('')
  const muat = useCallback(() => api(`/api/circle/lembur/menunggu?studioId=${studioId}`).then(x => { setD(x); onJumlah?.(x.jumlah) }).catch(e => setGalat(e.message)), [studioId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { muat() }, [muat])
  const perProyek = d?.aturan?.mode === 'PER_PROYEK'
  const perLevel = d?.aturan?.mode === 'PER_LEVEL'
  const selesai = () => { muat(); onUbah?.() }
  const tinjau = (b, setuju) => { let body = { studioId }; if (!setuju) { const c = prompt('Alasan penolakan?'); if (!c) return; body = { ...body, catatan: c } }
    // Lembur dari tugas ditunda (22 Nov 2026): usulan admin dipakai bila koordinator mengosongkan nilai
    if (setuju && b.dariTunda && b.nilaiUsulan != null) { const n = prompt(`${b.nama} — "${b.order ?? ''}". Usulan admin${b.diusulkanOleh ? ` (${b.diusulkanOleh})` : ''}: ${rp(b.nilaiUsulan)}. Kosongkan untuk menyetujui usulan, atau isi nilai lain (Rp):`, ''); if (n === null) return; const angka = String(n).replace(/[^\d]/g, ''); if (angka !== '') body = { ...body, nilai: Number(angka) } }
    // Lembur per project (9 Nov 2026): koordinator mengisi nilai lembur order ini saat menyetujui
    else if (setuju && perProyek) { const n = prompt(`Nilai lembur untuk ${b.nama}${b.order ? ` — order "${b.order}"` : ''} (Rp, isi 0 bila tidak dibayar):`, ''); if (n === null) return; const angka = String(n).replace(/[^\d]/g, ''); if (angka === '') { setGalat('Nilai lembur wajib diisi'); return } body = { ...body, nilai: Number(angka) } }
    // Per level (9 Nov 2026): nilai otomatis dari fee level × progres; koordinator boleh menimpa
    else if (setuju && perLevel) { const n = prompt(`${b.nama} — ${b.levelNama ?? 'level?'} ${b.progresAwal ?? '?'}→${b.progresAkhir ?? '?'}%. Nilai lembur (Rp). Kosongkan untuk memakai hitungan otomatis${b.nilaiUsulan != null ? ` (${rp(b.nilaiUsulan)})` : ''}:`, ''); if (n === null) return; const angka = String(n).replace(/[^\d]/g, ''); if (angka !== '') body = { ...body, nilai: Number(angka) } }
    aksi(() => api(`/api/circle/lembur/${b.id}/${setuju ? 'setujui' : 'tolak'}`, { method: 'POST', body }), setGalat, selesai) }
  if (!d) return galat ? <div className="galat">{galat}</div> : <div className="redup">Memuat…</div>
  return (
    <div className="panel"><h3 className="judul-bagian">Lembur menunggu persetujuan ({d.baris.length})</h3>
      {galat && <div className="galat">{galat}</div>}
      <div className="redup kecil" style={{ marginBottom: 6 }}>Semua bulan. Yang slip gajinya sudah Final/Dibayar tetap bisa disetujui — otomatis masuk slip bulan berikutnya sebagai <b>lembur susulan</b>.</div>
      {d.baris.length === 0 && <div className="redup">Tidak ada.</div>}
      {d.baris.map(b => <div key={b.id} className="meta" style={{ marginBottom: 6 }}><b>{b.nama}</b><span>{tglPendek(b.tanggal)} · {b.dariTunda ? `🌙 tugas ditunda, selesai ${b.selesai} WIB` : `${b.mulai}–${b.selesai} (${b.label}) · ${b.sumber === 'OTOMATIS' ? 'otomatis' : 'manual'}`}</span>{b.slipTertutup && <span className="lencana" title="Slip bulan ini sudah difinalkan; bila disetujui, masuk slip berikutnya">→ susulan</span>}<span className="redup">{b.catatan}</span>{b.order && <span className="chip sub">order: {b.order}</span>}{b.dariTunda ? <span className="chip sub">{b.levelNama ? `${b.levelNama} · ` : ''}{b.tahapDinilai?.length ? `${b.tahapDinilai.map(t => t.nama).join(' + ')} · ` : ''}usulan {rp(b.nilaiUsulan)}{b.diusulkanOleh ? ` oleh ${b.diusulkanOleh}` : ''}</span>
          : b.levelNama && <span className="chip sub">{b.levelNama} · {b.progresAwal}→{b.progresAkhir}% · usulan {rp(b.nilaiUsulan)}</span>}
        <button className="btn kecil utama" onClick={() => tinjau(b, true)}>{perProyek && !b.dariTunda ? 'Setujui & isi nilai' : 'Setujui'}</button><button className="btn kecil" onClick={() => tinjau(b, false)}>Tolak</button></div>)}
    </div>
  )
}

function LemburUnit({ studioId }) {
  const [d, setD] = useState(null), [aturan, setAturan] = useState(null), [galat, setGalat] = useState(''), [bulan, setBulan] = useState(bulanIni())
  const muat = useCallback(() => {
    api(`/api/circle/lembur/aturan?studioId=${studioId}`).then(setAturan).catch(e => setGalat(e.message))
    api(`/api/circle/lembur/usulan?studioId=${studioId}&bulan=${bulan}`).then(setD).catch(e => setGalat(e.message))
  }, [studioId, bulan])
  useEffect(() => { muat() }, [muat])
  const perLevel = aturan?.aturan?.mode === 'PER_LEVEL'
  return (
    <div>
      {galat && <div className="galat">{galat}</div>}
      <JamKerjaUnit key={'jk' + studioId} studioId={studioId} />
      <LokasiKantor key={'lk' + studioId} studioId={studioId} />
      {perLevel && <DaftarLevel key={studioId} studioId={studioId} setGalat={setGalat} />}
      {perLevel && <DaftarTahap key={'t' + studioId} studioId={studioId} setGalat={setGalat} />}
      {aturan && <AturanLembur key={JSON.stringify(aturan.aturan)} studioId={studioId} aturan={aturan.aturan} pilihan={aturan.pilihan} muat={muat} setGalat={setGalat} />}
      <LemburMenunggu key={'m' + studioId} studioId={studioId} onUbah={muat} />
      <div className="chips" style={{ margin: '8px 0' }}><span className="redup kecil">Bulan</span><input type="month" value={bulan} onChange={e => e.target.value && setBulan(e.target.value)} /></div>
      {d && <div className="panel"><h3 className="judul-bagian">Rekap lembur {d.bulan} <TombolUnduh nama={`lembur-${d.bulan}`} baris={[['Nama', 'Jam dihitung', 'Hari', 'Perkiraan uang', 'Menunggu'], ...d.orang.map(o => [o.nama, o.jam, o.hari, o.uang, o.menunggu])]} cetak /></h3>
        <div className="redup kecil">{d.catatan}</div>
        <table><thead><tr><th>Nama</th><th>Jam dihitung</th><th>Hari</th><th>Perkiraan uang</th><th>Menunggu</th></tr></thead><tbody>
          {d.orang.map(o => <tr key={o.userId}><td>{o.nama}</td><td>{o.jam}</td><td>{o.hari}</td><td>{o.adaTarif ? rp(o.uang) : '—'}</td><td>{o.menunggu || ''}</td></tr>)}</tbody></table></div>}
    </div>
  )
}

export default function Kehadiran({ studioId, manajer, lihatSaja, userId }) {
  // pemilik (lihat saja): hanya rekap tim; lembur/pengingat/riwayat login & data pribadi orang lain tertutup
  const TAB = [['hari', 'Hari ini'], ['riwayat', 'Riwayat'], ['izin', 'Izin'], ['checkin', 'Check-in'], ['kalender', 'Kalender'], ['refleksi', 'Refleksi'], ['profil', 'Profil SDM'], ...(manajer && !lihatSaja ? [['tim', 'Tim'], ['lembur', 'Jam kerja & lembur'], ['pengingat', 'Pengingat'], ['login', 'Riwayat login']] : manajer ? [['tim', 'Tim']] : [])]
  const [sub, setSub] = useState('hari')
  return (
    <div>
      <div className="tab-mini">{TAB.map(([k, l]) => <button key={k} className={sub === k ? 'aktif' : ''} onClick={() => setSub(k)}>{l}</button>)}</div>
      {sub === 'hari' && <HariIni studioId={studioId} />}
      {sub === 'lembur' && <LemburUnit key={studioId} studioId={studioId} />}
      {sub === 'riwayat' && <Riwayat />}
      {sub === 'izin' && <Izin />}
      {sub === 'checkin' && <CheckIn />}
      {sub === 'kalender' && <Kalender />}
      {sub === 'refleksi' && <Refleksi studioId={studioId} manajer={manajer && !lihatSaja} userId={userId} />}
      {sub === 'profil' && <ProfilSaya />}
      {sub === 'pengingat' && <Pengingat studioId={studioId} />}
      {sub === 'login' && <RiwayatLogin />}
      {sub === 'tim' && <Tim studioId={studioId} />}
    </div>
  )
}
