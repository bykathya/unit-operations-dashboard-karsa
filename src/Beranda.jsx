import { useCallback, useEffect, useState } from 'react'
import { useSegarkan } from './realtime'
import { api } from './api'
import Stiker from './Stiker'

// BERANDA per peran (adaptasi OGS HomeComposer): sapaan, "perlu perhatian", task saya, pengingat delivery H-1…5, ringkasan manajer/marketer, seri 8 minggu.
// Tanpa angka uang.
const NAMA_TAB = {}
export default function Beranda({ studioId, pindah, onOrder }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState('')
  const muat = useCallback(() => api(`/api/circle/beranda?studioId=${studioId}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId])
  useEffect(() => { setD(null); muat() }, [muat])
  useSegarkan(muat, ['orders', 'penugasan', 'tugas', 'kehadiran', 'checkin', 'diskusi', 'refleksi', 'setoran'])
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  const tgl = new Date(d.tanggal + 'T00:00:00Z').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const maks = Math.max(1, ...(d.seri ?? []).flatMap(s => [s.masuk, s.selesai]))
  const Stat = ({ l, n, tab, nada }) => <button className={'stat' + (nada ? ' ' + nada : '')} style={{ textAlign: 'left', cursor: tab ? 'pointer' : 'default' }} onClick={() => tab && pindah(tab)}><span className="redup kecil">{l}</span><b>{n}</b></button>
  // Kotak bernilai nol diringkas jadi satu baris "aman" (11 Nov 2026) — yang ada angkanya jadi menonjol, bukan lautan angka 0
  const Deret = ({ isi, nada, semuaNol, apaAdanya }) => {
    isi = isi.filter(x => x.n != null) // angka yang tidak boleh dilihat peran ini dikirim null oleh server
    const nol = (n) => n === 0 || n === '0/0' || n === '0×', ada = isi.filter(x => !nol(x.n)), kosong = isi.filter(x => nol(x.n))
    if (apaAdanya) return <div className="deret-stat">{isi.map(x => <Stat key={x.l} {...x} />)}</div> // tampil apa adanya: nol di sini = belum dikerjakan, bukan "aman"
    return <div className="deret-stat">{ada.map(x => <Stat key={x.l} {...x} nada={x.nada ?? nada} />)}{kosong.length > 0 && <div className="stat-aman"><span aria-hidden="true">✓</span> {!ada.length && semuaNol ? semuaNol : <>{ada.length ? '' : 'Semua aman: '}{kosong.map(x => x.l.toLowerCase()).join(' · ')} <b>0</b></>}</div>}</div>
  }
  return (
    <div>
      <div className="sapaan">
        <div><h2>{d.sapaan}, {d.nama.split(' ')[0]}</h2><div className="redup">{tgl}</div></div>
        <Stiker nama={d.nama} ukuran={140} />
      </div>
      {d.perhatian.length > 0 ? (
        <div className="panel"><h3 className="judul-bagian">Perlu perhatian</h3>
          {d.perhatian.map(p => <div key={p.kunci} className="meta" style={{ marginBottom: 6 }}><span className="lencana revisi">{p.jumlah}</span><span>{p.label}</span><button className="btn kecil" onClick={() => { if (p.kunci === 'lembur') { try { localStorage.setItem(`tugas-sub-${studioId}`, 'lembur') } catch { /* abaikan */ } } pindah(p.tab) }}>Buka</button></div>)}
        </div>
      ) : <div className="panel"><span>✅ Tidak ada yang perlu perhatian khusus hari ini.</span></div>}
      <h3 className="judul-bagian" style={{ marginTop: 18 }}>Tugasku</h3>
      <Deret isi={[{ l: 'Tugas aktif', n: d.tugasSaya.aktif, tab: 'tugas' }, { l: 'Lewat deadline', n: d.tugasSaya.telat ?? 0, tab: 'tugas', nada: 'waspada' }, { l: 'Selesai hari ini', n: d.tugasSaya.selesaiHariIni, tab: 'tugas' }]} semuaNol="Belum ada tugas berjalan" />
      {d.manajer && <><h3 className="judul-bagian" style={{ marginTop: 6 }}>Unit</h3>
        <Deret nada="waspada" isi={[{ l: 'Order terlambat', n: d.manajer.terlambat, tab: 'analitik' }, { l: 'Jatuh tempo ≤ 3 hari', n: d.manajer.segera, tab: 'analitik' }, { l: 'Tanpa penanggung', n: d.manajer.tanpaPenanggung, tab: 'penugasan' }, { l: 'Izin menunggu', n: d.manajer.izinMenunggu, tab: 'hadir' }, { l: 'Perlu dukungan', n: d.manajer.perluDukungan, tab: 'hadir' }]} /></>}
      {d.marketer && <><h3 className="judul-bagian" style={{ marginTop: 6 }}>Pemasaran</h3>
        <Deret isi={[{ l: 'Aktivitas hari ini', n: `${d.marketer.selesai}/${d.marketer.aktivitasHariIni}`, tab: 'marketing', nada: d.marketer.aktivitasHariIni === 0 ? 'waspada' : undefined }, { l: 'Setoran bulan ini', n: `${d.marketer.setoranBulanIni ?? 0}×`, tab: 'setoran' }]} apaAdanya /></>}
      <div className="panel"><h3 className="judul-bagian">Pengingat delivery</h3>
        <div className="chips" style={{ marginBottom: 8 }}>{[['H-1', d.delivery.h1], ['H-2', d.delivery.h2], ['H-3', d.delivery.h3], ['H-4–5', d.delivery.h4_5]].map(([l, n]) => <span key={l} className={'lencana' + (l === 'H-1' && n ? ' revisi' : '')}>{l}: {n}</span>)}</div>
        {d.delivery.daftar.length === 0 ? <div className="redup kecil">Tidak ada delivery dalam 5 hari ke depan.</div> : d.delivery.daftar.map(o => <div key={o.orderId} className="meta" style={{ marginBottom: 4 }}><span className="lencana">H-{o.sisaHari}</span><b style={{ cursor: 'pointer' }} onClick={() => onOrder?.(o.orderId)}>{o.judul}</b><span className="redup kecil">{o.klien}</span></div>)}
      </div>
      {d.seri && <div className="panel"><h3 className="judul-bagian">Order 8 minggu terakhir</h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 110 }}>
          {d.seri.map(s => <div key={s.minggu} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={`Mulai ${s.minggu}: masuk ${s.masuk}, selesai ${s.selesai}`}>
            <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 90 }}><i style={{ width: 10, height: `${(s.masuk / maks) * 100}%`, minHeight: s.masuk ? 3 : 0, background: 'var(--accent)', borderRadius: 2 }} /><i style={{ width: 10, height: `${(s.selesai / maks) * 100}%`, minHeight: s.selesai ? 3 : 0, background: 'var(--text-secondary)', borderRadius: 2 }} /></div>
            <span className="redup" style={{ fontSize: 10 }}>{s.minggu.slice(8)}/{s.minggu.slice(5, 7)}</span></div>)}
        </div>
        <div className="redup kecil" style={{ marginTop: 6 }}><i style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--accent)', borderRadius: 2 }} /> masuk &nbsp; <i style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--text-secondary)', borderRadius: 2 }} /> selesai (label = tanggal Senin)</div>
      </div>}
    </div>
  )
}
