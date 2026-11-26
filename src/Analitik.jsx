import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { Timeline, JenisOrder, Pipeline, PetaAlur, RekapKerja } from './Tambahan'
import { BatangHorizontal, GrafikTren } from './Grafik'
import DetailOrder from './DetailOrder'

// ANALITIK produksi (adaptasi OGS): Papan nadi, Kinerja per orang, Revisi, Tren, Kalender kerja. Tanpa angka uang.
// Manajer = Koordinator ke atas (semua orang di unit); anggota lain = "Kinerja saya" saja.
const jam = (v) => (v == null ? '—' : `${v} j`)
const tglIso = (d) => d.toISOString().slice(0, 10)
const RENTANG = [['7', '7 hari'], ['30', '30 hari'], ['90', '90 hari']]

function Muat({ url, deps = [], anak }) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const muat = useCallback(() => api(url).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [url])
  useEffect(() => { setD(null); muat() }, [muat, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
  if (galat) return <div className="galat blok">{galat}</div>
  if (!d) return <div className="redup">Memuat…</div>
  return anak(d, muat)
}

// Papan nadi bisa diklik: batang fase → daftar order di fase itu; order → detail order; kartu Macet → hanya pekerjaan macet
function Nadi({ studioId }) {
  const [fase, setFase] = useState(null)
  const [hanyaMacet, setHanyaMacet] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const barisOrder = (w, ket) => (
    <div key={w.orderId + (ket ?? '')} className="meta baris-klik" style={{ marginTop: 4 }} role="button" tabIndex={0} title="Buka detail order"
      onClick={() => setDetailId(w.orderId)} onKeyDown={e => { if (e.key === 'Enter') setDetailId(w.orderId) }}>
      <span className={`nada-${w.nada}`}>●</span><span>{w.judul}</span>{ket && <span className="redup kecil">{ket}</span>}<span className="chip sub">{w.tahap}</span><span className="redup">{w.jam} jam kerja</span>
    </div>
  )
  return <Muat url={`/api/circle/analitik/nadi?studioId=${studioId}`} anak={(d, muat) => {
    const faseBuka = d.alir.find(f => f.kunci === fase)
    const orang = hanyaMacet ? d.orang.filter(p => p.macet > 0).map(p => ({ ...p, wip: p.wip.filter(w => w.nada === 'bad'), wipLebih: 0 })) : d.orang
    return (
    <div>
      <div className="ringkasan">
        <div className="stat"><span className="redup kecil">Tahap selesai hari ini</span><b>{d.nadi.selesaiHariIni}</b></div>
        <div className="stat"><span className="redup kecil">Sedang dikerjakan</span><b>{d.nadi.wipAktif}</b></div>
        <div className="stat"><span className="redup kecil">Antre</span><b>{d.nadi.antre}</b></div>
        <div className={'stat' + (d.nadi.macet ? ' klik' : '') + (hanyaMacet ? ' aktif' : '')} title={d.nadi.macet ? (hanyaMacet ? 'Tampilkan semua pekerjaan' : 'Tampilkan hanya pekerjaan macet') : undefined}
          {...(d.nadi.macet ? { role: 'button', tabIndex: 0, onClick: () => setHanyaMacet(v => !v) } : {})}><span className="redup kecil">Macet (≥ {d.ambang.sehari} jam kerja)</span><b className={d.nadi.macet ? 'nada-bad' : ''}>{d.nadi.macet}</b>{d.nadi.macet > 0 && <span className="redup kecil">{hanyaMacet ? 'klik: tampilkan semua' : 'klik: lihat yang macet'}</span>}</div>
      </div>
      <div className="toolbar"><h3 className="judul-bagian" style={{ margin: 0 }}>Alur order terbuka</h3><button className="btn kecil" onClick={muat}>Segarkan</button></div>
      <BatangHorizontal data={d.alir.map(f => ({ label: f.label, nilai: f.jumlah, nada: f.jamTertua != null ? f.nada : undefined, ket: f.jamTertua != null ? `tertua ${f.jamTertua} jam kerja` : '' }))}
        aktif={faseBuka?.label} onKlik={(b) => { const f = d.alir.find(x => x.label === b.label); setFase(fase === f.kunci ? null : f.kunci) }} />
      {faseBuka && (
        <div className="panel" style={{ marginTop: 10 }}>
          <div className="baris-atas"><b>Order di fase {faseBuka.label} ({faseBuka.jumlah})</b><button className="btn kecil" onClick={() => setFase(null)}>Tutup</button></div>
          {(faseBuka.order ?? []).length === 0 ? <div className="redup kecil" style={{ marginTop: 6 }}>Tidak ada order di fase ini.</div> : faseBuka.order.map(w => barisOrder(w, w.klien))}
          <div className="redup kecil" style={{ marginTop: 6 }}>Klik order untuk membuka detailnya. Diurutkan dari yang paling lama di fase ini.</div>
        </div>
      )}
      <h3 className="judul-bagian" style={{ marginTop: 18 }}>Siapa mengerjakan apa{hanyaMacet && <span className="redup kecil"> · hanya yang macet <button className="btn kecil" onClick={() => setHanyaMacet(false)}>Tampilkan semua</button></span>}</h3>
      {orang.length === 0 ? <div className="kosong">{hanyaMacet ? 'Tidak ada pekerjaan macet.' : 'Belum ada tugas yang ditugaskan ke anggota di unit ini.'}</div> : orang.map(p => (
        <div className="panel" key={p.userId} style={{ marginBottom: 8 }}>
          <div className="baris-atas"><b>{p.nama}</b><span className="redup kecil">{p.jumlahWip} aktif · {p.antre} antre · {p.selesaiHariIni} selesai hari ini{p.macet ? <> · <span className="nada-bad">{p.macet} macet</span></> : null}</span></div>
          {p.wip.map(w => barisOrder(w))}
          {p.wipLebih > 0 && <div className="redup kecil">+{p.wipLebih} lainnya</div>}
        </div>
      ))}
      <p className="redup kecil">Jam dihitung sebagai jam kerja bersih (Senin–Jumat 09–17, Sabtu 09–16, minus istirahat, tanpa Minggu dan hari libur). Hijau &lt; 3,5 jam · kuning &lt; 7 jam · merah ≥ 7 jam. Batang fase, kartu Macet, dan nama order bisa diklik.</p>
      {detailId && <DetailOrder orderId={detailId} onTutup={() => { setDetailId(null); muat() }} />}
    </div>
  )}} />
}

function Kinerja({ studioId, manajer }) {
  const [hari, setHari] = useState('30')
  const sampai = new Date(), dari = new Date(sampai.getTime() - Number(hari) * 86400000)
  const q = `studioId=${studioId}&dari=${encodeURIComponent(dari.toISOString())}&sampai=${encodeURIComponent(sampai.toISOString())}`
  const pilih = <div className="tab-mini">{RENTANG.map(([k, l]) => <button key={k} className={hari === k ? 'aktif' : ''} onClick={() => setHari(k)}>{l}</button>)}</div>
  const kartu = (p) => (
    <div className="panel" key={p.userId} style={{ marginBottom: 10 }}>
      <div className="baris-atas"><b>{p.nama}</b><span className="redup kecil">{p.order} order · {p.selesai} selesai · {p.tahapSelesai} tahap</span></div>
      <div className="ringkasan" style={{ marginTop: 10, marginBottom: 6 }}>
        <div className="stat"><span className="redup kecil">Waktu produksi biasanya</span><b>{jam(p.medianProduksi)}</b></div>
        <div className="stat"><span className="redup kecil">Waktu QC biasanya</span><b>{jam(p.medianQc)}</b></div>
        <div className="stat"><span className="redup kecil">Waktu revisi biasanya</span><b>{jam(p.medianRevisi)}</b></div>
        <div className="stat"><span className="redup kecil">Waktu antre biasanya</span><b>{jam(p.medianAntre)}</b></div>
        <div className="stat"><span className="redup kecil">Tepat waktu</span><b>{p.tepatWaktu == null ? '—' : p.tepatWaktu + '%'}</b><span className="redup kecil">{p.sampelDeadline} order ber-deadline</span></div>
        <div className="stat"><span className="redup kecil">Revisi (total)</span><b>{p.revisiTotal}</b></div>
        <div className="stat"><span className="redup kecil">Aktif / antre</span><b>{p.wipAktif} / {p.antreOrder}</b></div>
      </div>
      {p.tahapSelesai > 0 && <BatangHorizontal data={[{ label: 'Produksi', nilai: p.porsiProduksi ?? 0, ket: '% tahap' }, { label: 'QC', nilai: p.porsiQc ?? 0, ket: '% tahap' }, { label: 'Revisi', nilai: p.porsiRevisi ?? 0, ket: '% tahap' }]} satuan="%" />}
      {p.perTahap.length > 0 && <table style={{ marginTop: 8 }}><thead><tr><th>Tahap</th><th className="kanan">Selesai</th><th className="kanan">Median</th></tr></thead><tbody>{p.perTahap.map(t => <tr key={t.nama}><td>{t.nama}</td><td className="kanan">{t.jumlah}</td><td className="kanan">{jam(t.medianJam)}</td></tr>)}</tbody></table>}
    </div>
  )
  return (
    <div>
      {pilih}
      {manajer
        ? <Muat url={`/api/circle/analitik/kinerja?${q}`} deps={[hari]} anak={(d) => (
            <>
              <div className="ringkasan">
                <div className="stat"><span className="redup kecil">Orang aktif</span><b>{d.total.orang}</b></div>
                <div className="stat"><span className="redup kecil">Tahap selesai</span><b>{d.total.tahap}</b></div>
                <div className="stat"><span className="redup kecil">Order selesai</span><b>{d.total.selesai}</b></div>
                <div className="stat"><span className="redup kecil">Sedang dikerjakan</span><b>{d.total.wipAktif}</b></div>
              </div>
              {d.orang.length === 0 ? <div className="kosong">Belum ada data pada rentang ini.</div> : d.orang.map(kartu)}
              <p className="redup kecil">Catatan: penugasan baru dicatat per order, jadi waktu sebuah tahap dihitung untuk semua orang yang ditugaskan di order itu. Penugasan per tahap (seperti OGS) menyusul.</p>
            </>
          )} />
        : <Muat url={`/api/circle/analitik/kinerja-saya?${q}`} deps={[hari]} anak={(d) => (d.saya ? kartu(d.saya) : <div className="kosong">Belum ada tugas atas namamu pada rentang ini.</div>)} />}
    </div>
  )
}

function Revisi({ studioId }) {
  return <Muat url={`/api/circle/analitik/revisi?studioId=${studioId}`} anak={(d) => (
    <div>
      <div className="ringkasan">
        <div className="stat"><span className="redup kecil">Order (6 bulan)</span><b>{d.ringkasan.order}</b></div>
        <div className="stat"><span className="redup kecil">Order ber-revisi</span><b>{d.ringkasan.denganRevisi}</b><span className="redup kecil">{d.ringkasan.persenDenganRevisi}%</span></div>
        <div className="stat"><span className="redup kecil">Total revisi</span><b>{d.ringkasan.totalRevisi}</b></div>
        <div className="stat"><span className="redup kecil">Rata-rata / order</span><b>{d.ringkasan.rataPerOrder}</b></div>
        <div className="stat"><span className="redup kecil">Internal / klien</span><b>{d.ringkasan.revisiInternal} / {d.ringkasan.revisiKlien}</b></div>
      </div>
      <h3 className="judul-bagian">Revisi per bulan</h3>
      {d.perBulan.length ? <GrafikTren titik={d.perBulan.map(b => ({ kunci: b.bulan, order: b.order, revisi: b.totalRevisi }))} seri={[{ k: 'order', label: 'Order masuk', warna: 'var(--seri-1)' }, { k: 'revisi', label: 'Total revisi', warna: 'var(--seri-2)' }]} formatKunci={(k) => k.slice(2)} /> : <div className="kosong">Belum ada data.</div>}
      <h3 className="judul-bagian" style={{ marginTop: 18 }}>Order dengan revisi terbanyak</h3>
      {d.teratas.length === 0 ? <div className="kosong">Belum ada order yang direvisi.</div> : (
        <table><thead><tr><th>Order</th><th>Klien</th><th className="kanan">Internal</th><th className="kanan">Klien</th><th className="kanan">Total</th></tr></thead>
          <tbody>{d.teratas.map(o => <tr key={o.orderId}><td><b>{o.judul}</b></td><td>{o.klien}</td><td className="kanan">{o.revisiInternal}</td><td className="kanan">{o.revisiKlien}</td><td className="kanan"><b>{o.total}</b></td></tr>)}</tbody></table>
      )}
    </div>
  )} />
}

function Tren({ studioId }) {
  const [grain, setGrain] = useState('minggu')
  return (
    <div>
      <div className="tab-mini">{[['minggu', 'Per minggu'], ['bulan', 'Per bulan']].map(([k, l]) => <button key={k} className={grain === k ? 'aktif' : ''} onClick={() => setGrain(k)}>{l}</button>)}</div>
      <Muat url={`/api/circle/analitik/tren?studioId=${studioId}&grain=${grain}`} deps={[grain]} anak={(d) => (
        <GrafikTren titik={d.titik} seri={[{ k: 'masuk', label: 'Order masuk', warna: 'var(--seri-1)' }, { k: 'selesai', label: 'Order selesai', warna: 'var(--seri-3)' }, { k: 'revisi', label: 'Revisi', warna: 'var(--seri-2)' }]} formatKunci={(k) => (grain === 'bulan' ? k.slice(2) : k.slice(5))} />
      )} />
    </div>
  )
}

function Peringatan({ studioId }) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')
  const muat = useCallback(() => api(`/api/circle/otomasi/peringatan?studioId=${studioId}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId])
  useEffect(() => { setD(null); muat() }, [muat])
  if (!d) return galat ? <div className="galat blok">{galat}</div> : <div className="redup">Memuat…</div>
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      {info && <div className="chip" style={{ display: 'inline-block', marginBottom: 10 }}>{info}</div>}
      <h3 className="judul-bagian">Deadline mendekat tanpa penanggung jawab</h3>
      {d.deadlineTanpaPenanggung.length === 0 ? <div className="kosong">Tidak ada. Semua order yang H-1/H-0 sudah ada penanggung jawabnya.</div> : <table><thead><tr><th>Order</th><th>Tahap</th><th>Deadline</th><th>Saran penugasan</th></tr></thead>
        <tbody>{d.deadlineTanpaPenanggung.map(o => <tr key={o.orderId}><td><b>{o.judul}</b><div className="redup kecil">{o.klien}</div></td><td>{o.tahap}</td><td className="nada-bad">{o.label} · {o.deadline}</td><td>{o.saran.length ? o.saran.map(s => `${s.nama} (antrean ${s.antrean})`).join(', ') : <span className="redup">isi keahlian & kesulitan</span>}</td></tr>)}</tbody></table>}
      <h3 className="judul-bagian" style={{ marginTop: 18 }}>QC macet (≥ 3 hari)</h3>
      <div className="toolbar"><button className="btn utama" onClick={async () => { setGalat(''); try { const h = await api('/api/circle/otomasi/eskalasi', { method: 'POST', body: { studioId } }); setInfo(h.dibuat ? `${h.dibuat} diskusi otomatis dibuat (lihat menu Diskusi).` : 'Tidak ada yang perlu dieskalasi sekarang.'); muat() } catch (e) { setGalat(e.message) } }}>Eskalasi sekarang</button><span className="redup kecil">Membuat diskusi otomatis ke koordinator + penanggung jawab. Sekali per order; ulang setelah 7 hari.</span></div>
      {d.qcMacet.length === 0 ? <div className="kosong">Tidak ada order yang macet di QC.</div> : <table><thead><tr><th>Order</th><th>Tahap</th><th className="kanan">Lama</th><th>Status</th></tr></thead>
        <tbody>{d.qcMacet.map(o => <tr key={o.orderId}><td><b>{o.judul}</b><div className="redup kecil">{o.klien}</div></td><td>{o.tahap}</td><td className="kanan nada-bad">{o.umurHari} hari</td><td>{o.sudahDiskusi ? 'Diskusi terbuka' : o.perluEskalasi ? 'Perlu eskalasi' : 'Menunggu masa tunggu'}</td></tr>)}</tbody></table>}
      <p className="redup kecil" style={{ marginTop: 10 }}>Pemeriksaan yang sama dapat dijalankan otomatis tiap pagi (08.30 WIB) oleh bot Telegram bila diaktifkan admin server (OTOMASI_AKTIF=1).</p>
    </div>
  )
}

function Kalender() {
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [f, setF] = useState({ tanggal: tglIso(new Date()), nama: '' })
  const [galat, setGalat] = useState('')
  return <Muat url={`/api/circle/kalender/libur?tahun=${tahun}`} deps={[tahun]} anak={(d, muat) => (
    <div>
      <div className="toolbar"><button className="btn kecil" onClick={() => setTahun(tahun - 1)}>←</button><b>{tahun}</b><button className="btn kecil" onClick={() => setTahun(tahun + 1)}>→</button></div>
      <p className="redup">Jam kerja bersih: Senin–Jumat 09–17, Sabtu 09–16, dikurangi istirahat; Minggu dan hari libur di bawah dihitung 0. Dipakai untuk semua durasi di Analitik.</p>
      {galat && <div className="galat">{galat}</div>}
      {d.bisaUbah && (
        <form className="panel" style={{ marginBottom: 12 }} onSubmit={async e => { e.preventDefault(); setGalat(''); try { await api('/api/circle/kalender/libur', { method: 'POST', body: f }); setF({ ...f, nama: '' }); muat() } catch (er) { setGalat(er.message) } }}>
          <div className="dua"><label>Tanggal<input type="date" value={f.tanggal} onChange={e => setF({ ...f, tanggal: e.target.value })} required /></label><label>Nama libur<input value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} required maxLength={80} /></label></div>
          <button className="btn utama">+ Tambah hari libur</button>
        </form>
      )}
      {d.libur.length === 0 ? <div className="kosong">Belum ada hari libur tercatat untuk {tahun}.{d.bisaUbah ? '' : ' Super Admin yang mengaturnya.'}</div> : (
        <table><tbody>{d.libur.map(l => <tr key={l.id}><td>{new Date(l.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</td><td><b>{l.nama}</b></td>{d.bisaUbah && <td className="kanan"><button className="btn kecil" onClick={async () => { if (confirm('Hapus hari libur ini?')) { await api('/api/circle/kalender/libur/' + l.id, { method: 'DELETE' }); muat() } }}>Hapus</button></td>}</tr>)}</tbody></table>
      )}
    </div>
  )} />
}

export default function Analitik({ studioId, manajer }) {
  const TAB = manajer ? [['nadi', 'Kondisi hari ini'], ['peringatan', 'Peringatan'], ['kinerja', 'Kinerja'], ['revisi', 'Revisi'], ['tren', 'Tren'], ['timeline', 'Jadwal order'], ['peta', 'Order per tahap'], ['rekapkerja', 'Rekap kerja'], ['pipeline', 'Nilai order aktif'], ['jenis', 'Jenis order'], ['kalender', 'Kalender kerja']] : [['kinerja', 'Kinerja saya'], ['timeline', 'Jadwal order'], ['rekapkerja', 'Rekap kerja saya'], ['kalender', 'Kalender kerja']]
  const [sub, setSub] = useState(TAB[0][0])
  return (
    <div>
      <div className="tab-mini">{TAB.map(([k, l]) => <button key={k} className={sub === k ? 'aktif' : ''} onClick={() => setSub(k)}>{l}</button>)}</div>
      {sub === 'nadi' && <Nadi studioId={studioId} />}
      {sub === 'peringatan' && <Peringatan studioId={studioId} />}
      {sub === 'kinerja' && <Kinerja studioId={studioId} manajer={manajer} />}
      {sub === 'revisi' && <Revisi studioId={studioId} />}
      {sub === 'tren' && <Tren studioId={studioId} />}
      {sub === 'timeline' && <Timeline studioId={studioId} />}
      {sub === 'peta' && <PetaAlur studioId={studioId} />}
      {sub === 'rekapkerja' && <RekapKerja studioId={studioId} manajer={manajer} />}
      {sub === 'pipeline' && <Pipeline studioId={studioId} />}
      {sub === 'jenis' && <JenisOrder studioId={studioId} />}
      {sub === 'kalender' && <Kalender />}
    </div>
  )
}
