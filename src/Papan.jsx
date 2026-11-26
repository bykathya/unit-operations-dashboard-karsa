import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSegarkan } from './realtime'
import { api } from './api'
import { formatRp } from './format'
import KartuOrder from './KartuOrder'
import DetailOrder from './DetailOrder'
import FormOrder from './FormOrder'
import { useTanyaAntrean, perluTanyaAntrean } from './TanyaAntrean'

// Kolom papan = FASE makro dari server (Antrian, Produksi, QC, Revisi, Klien, Finalisasi, Delivery, Hold, Selesai — acuan OGS);
// langkah mikro (Sketch, QC: Sketch, …) tampil sebagai label di kartu.

// Kartu ringkasan per bulan (16 Nov 2026, masukan tim): bawaan bulan berjalan dari papan; bulan lain lewat GET /papan/ringkasan
// (rumus sama: nilaiBulanIni). Kolom papan tidak ikut berubah — tetap order yang aktif sekarang.
const bulanKini = () => { const d = new Date(Date.now() + 7 * 3600000); return d.toISOString().slice(0, 7) }
const NAMA_BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
function RingkasanBulan({ studioId, rKini, akunId = '' }) {
  const [bulan, setBulan] = useState(bulanKini()), [r, setR] = useState(null), [galat, setGalat] = useState('')
  const kini = bulan === bulanKini(), pakaiKini = kini && !akunId // satu akun jualan dipilih → ringkasan dihitung server untuk akun itu
  useEffect(() => { if (pakaiKini) { setR(null); return } setR(null); api(`/api/circle/papan/ringkasan?studioId=${studioId}&bulan=${bulan}${akunId ? `&akunId=${encodeURIComponent(akunId)}` : ''}`).then(x => { setR(x.ringkasan); setGalat('') }).catch(e => setGalat(e.message)) }, [studioId, bulan, pakaiKini, akunId, rKini])
  const label = kini ? 'bulan ini' : NAMA_BLN[Number(bulan.slice(5)) - 1] + ' ' + bulan.slice(0, 4)
  return (
    <>
      <div className="chips" style={{ marginBottom: 6 }}><span className="redup kecil">Ringkasan bulan</span>
        <input type="month" style={{ width: 'auto' }} value={bulan} max={bulanKini()} onChange={e => e.target.value && setBulan(e.target.value)} />
        {!kini && <button className="btn kecil" onClick={() => setBulan(bulanKini())}>bulan ini</button>}</div>
      {galat && <div className="galat">{galat}</div>}
      {pakaiKini ? <Ringkasan r={rKini} label={label} /> : r ? <Ringkasan r={r} label={label} /> : <div className="redup kecil">Memuat…</div>}
    </>
  )
}

// urutan kolom Done & Cancel: tanggal selesai terbaru di atas (server mengisi updatedAt bila tanggal selesai lama kosong)
const terbaruSelesai = (a, b) => String(b.tanggalSelesai ?? '').localeCompare(String(a.tanggalSelesai ?? ''))

function Ringkasan({ r, label = 'bulan ini' }) {
  // Mode pantau (marketer): server tidak mengirim total uang unit → hanya jumlah order
  if (r.total == null) return <div className="ringkasan">{[[`Order masuk ${label}`, r.jumlahMasukBulanIni], [`Selesai ${label}`, r.jumlahSelesai]].map(([l, v]) => <div key={l} className="stat"><span className="redup kecil">{l}</span><b>{v}</b></div>)}</div>
  const kartu = [
    // "Selesai bulan ini" = isi kolom Done (termasuk order masuk bulan lalu); nilai uang = order yang MASUK bulan ini
    [`Order masuk ${label}`, r.jumlahMasukBulanIni], [`Selesai ${label}`, r.jumlahSelesai],
    // Nilai dipecah tiga (14 Nov 2026, masukan tim): Done · sudah Delivery (belum Done) · masih dikerjakan
    [`Nilai order masuk ${label}`, formatRp(r.total)], ['…sudah selesai (Done)', formatRp(r.done)],
    ...(r.delivery != null ? [['…sudah Delivery, belum Done', formatRp(r.delivery)], ['…masih dikerjakan', formatRp(r.dikerjakan)]] : [['…yang belum selesai', formatRp(r.belumSelesai)]]),
  ]
  const persen = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0
  return (
    <div className="ringkasan">
      {kartu.map(([l, v]) => <div key={l} className="stat"><span className="redup kecil">{l}</span><b>{v}</b></div>)}
      <div className="stat progres"><span className="redup kecil">Progres nilai</span><div className="bar"><i style={{ width: persen + '%' }} /></div><b>{persen}%</b></div>
      {/* Fee freelance (20 Nov 2026, masukan tim): dari fee di Tim order order yang masuk bulan ini; hanya tampil bila ada freelance */}
      {r.freelance && <div className="stat" title="Jumlah fee freelance di Tim order, untuk order yang MASUK bulan ini. Pembayarannya di menu Bayar freelance (biaya Fee Freelance di laba rugi tercatat pada tanggal bayar).">
        <span className="redup kecil">Fee freelance (order {label})</span><b>{formatRp(r.freelance.fee)}</b>
        <span className="redup kecil">{r.freelance.belum > 0 ? <>belum dibayar {formatRp(r.freelance.belum)}</> : 'semua sudah dibayar'}{r.freelance.tanpaFee > 0 && <> · <span className="nada-warn">{r.freelance.tanpaFee} freelance belum diisi fee</span></>}</span>
      </div>}
    </div>
  )
}

// ORDER SELESAI / ARSIP (16 Nov 2026, masukan tim): kolom Done di papan hanya bulan berjalan; order selesai bulan-bulan sebelumnya dicari di
// sini (per bulan selesai + cari judul/klien) lalu dibuka detailnya (folder proyek, pembayaran, riwayat). Tidak ada data yang terhapus.
function DaftarSelesai({ studioId, onDetail, onTutup }) {
  const [bulan, setBulan] = useState(''), [cari, setCari] = useState(''), [kata, setKata] = useState('')
  const [d, setD] = useState(null), [galat, setGalat] = useState('')
  useEffect(() => { const t = setTimeout(() => setKata(cari.trim()), 350); return () => clearTimeout(t) }, [cari])
  useEffect(() => {
    setD(null)
    api(`/api/circle/orders-selesai?studioId=${studioId}${bulan ? `&bulan=${bulan}` : ''}${kata ? `&cari=${encodeURIComponent(kata)}` : ''}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message))
  }, [studioId, bulan, kata])
  const tgl = (v) => v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="baris-atas"><b>Order selesai (semua bulan)</b><button className="btn kecil" onClick={onTutup}>Tutup</button></div>
      <p className="redup kecil">Kolom Done di papan hanya berisi order yang selesai bulan ini. Order yang selesai bulan-bulan sebelumnya tetap tersimpan — cari di sini, lalu klik untuk membuka detail order (folder proyek, pembayaran, riwayat).</p>
      <div className="toolbar">
        <input className="cari" placeholder="Cari judul atau klien…" value={cari} onChange={e => setCari(e.target.value)} />
        <label className="redup kecil" style={{ margin: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>bulan selesai
          <input type="month" style={{ width: 'auto' }} value={bulan} onChange={e => setBulan(e.target.value)} /></label>
        {bulan && <button className="btn kecil" onClick={() => setBulan('')}>semua bulan</button>}
      </div>
      {galat && <div className="galat">{galat}</div>}
      {!d ? <div className="redup kecil">Memuat…</div> : d.order.length === 0 ? <div className="redup kecil" style={{ marginTop: 6 }}>Tidak ada order selesai yang cocok.</div> : (
        <div style={{ overflowX: 'auto' }}><table>
          <thead><tr><th>Selesai</th><th>Klien · order</th><th>Akun</th><th>Talent</th><th>Bayar</th><th></th></tr></thead>
          <tbody>{d.order.map(o => (
            <tr key={o.id} className="baris-klik" onClick={() => onDetail(o.id)} title="Buka detail order">
              <td className="kecil">{tgl(o.selesai)}</td>
              <td><b>{o.klien}</b>{o.panggilan && <div className="redup kecil">{o.panggilan}</div>}<div className="redup kecil">{o.judul}</div></td>
              <td className="redup kecil">{o.akun ?? '—'}</td>
              <td className="kecil">{o.talent.join(', ') || '—'}</td>
              <td className="kecil">{o.statusBayar === 'LUNAS' ? '✓ Lunas' : o.statusBayar === 'DP' ? 'DP' : 'Belum bayar'}</td>
              <td>{o.folder && <a className="btn kecil" href={o.folder} target="_blank" rel="noreferrer noopener" onClick={e => e.stopPropagation()}>📁 Folder</a>}</td>
            </tr>
          ))}</tbody>
        </table>{d.order.length >= 200 && <div className="redup kecil">Menampilkan 200 terbaru — persempit dengan bulan atau kata kunci.</div>}</div>
      )}
    </div>
  )
}

// Order yang dibatalkan (90 hari) — bisa dibuka & dipulihkan pengelola (9 Nov 2026)
function DaftarBatal({ studioId, onDetail, onTutup }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState('')
  const muat = useCallback(() => api(`/api/circle/orders-batal?studioId=${studioId}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId])
  useEffect(() => { muat() }, [muat])
  const pulihkan = async (id) => { if (!confirm('Pulihkan order ini ke papan?')) return; try { await api(`/api/circle/orders/${id}/pulihkan`, { method: 'POST' }); muat(); onTutup?.(true) } catch (e) { alert(e.message) } }
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="baris-atas"><b>Order dibatalkan (90 hari terakhir)</b><button className="btn kecil" onClick={() => onTutup?.(false)}>Tutup</button></div>
      {galat && <div className="galat">{galat}</div>}
      {!d ? <div className="redup kecil">Memuat…</div> : d.order.length === 0 ? <div className="redup kecil" style={{ marginTop: 6 }}>Tidak ada order yang dibatalkan.</div> : d.order.map(o => (
        <div key={o.id} className="meta baris-klik" style={{ marginTop: 6 }} onClick={() => onDetail(o.id)} title="Buka detail order">
          <b>{o.judul}</b><span className="chip">{o.klien}</span><span className="redup kecil">{o.alasan ?? '—'}{o.oleh ? ` · oleh ${o.oleh}` : ''}</span>
          {d.bisaPulihkan && <button className="btn kecil" onClick={e => { e.stopPropagation(); pulihkan(o.id) }}>Pulihkan</button>}
        </div>
      ))}
    </div>
  )
}

function ModalOpsional({ order, tahap, onTutup, onSimpan }) {
  const opsional = tahap.filter(t => t.opsional)
  const [aktif, setAktif] = useState(new Set(order.tahapAktif))
  const [galat, setGalat] = useState('')
  const ubah = (id) => setAktif(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  async function simpan() {
    try { await api(`/api/circle/orders/${order.id}/opsional`, { method: 'PATCH', body: { tahapAktif: [...aktif] } }); onSimpan() }
    catch (e) { setGalat(e.message) }
  }
  return (
    <div className="modal-latar" onClick={onTutup}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Tahap yang dipakai · {order.judul}</h3>
        <p className="redup kecil">Centang tahap yang dipakai untuk order ini, hilangkan centang untuk melewatinya. Perubahan hanya berlaku untuk order ini; tahap yang sedang dikerjakan tidak bisa dilewati.</p>
        {opsional.map(t => <label key={t.id} className="centang"><input type="checkbox" checked={aktif.has(t.id)} onChange={() => ubah(t.id)} /> {t.nama}</label>)}
        {galat && <div className="galat">{galat}</div>}
        <div className="modal-aksi"><button className="btn" onClick={onTutup}>Batal</button><button className="btn utama" onClick={simpan}>Simpan</button></div>
      </div>
    </div>
  )
}

export default function Papan({ studioId }) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const [form, setForm] = useState(false)
  const [opsional, setOpsional] = useState(null)
  const [detailId, setDetailId] = useState(null), [detailFokus, setDetailFokus] = useState(null)
  const kunciTampilan = `papan-tampilan-${studioId}`
  const [tampilan, setTampilanState] = useState(() => { try { return localStorage.getItem(kunciTampilan) || 'fase' } catch { return 'fase' } })
  const setTampilan = (v) => { setTampilanState(v); try { localStorage.setItem(kunciTampilan, v) } catch { /* abaikan */ } }
  const [cari, setCari] = useState('')
  // lihat per akun jualan / market (20 Nov 2026, masukan tim/Keiko) — diingat per perangkat & per unit
  const kunciAkun = 'uo-papan-akun-' + studioId
  const [akunLihat, setAkunLihatS] = useState(() => { try { return localStorage.getItem(kunciAkun) ?? '' } catch { return '' } })
  const setAkunLihat = (v) => { setAkunLihatS(v); try { v ? localStorage.setItem(kunciAkun, v) : localStorage.removeItem(kunciAkun) } catch { /* abaikan */ } }
  useEffect(() => { try { setAkunLihatS(localStorage.getItem(kunciAkun) ?? '') } catch { setAkunLihatS('') } }, [kunciAkun])
  const [tanpaMarketer, setTanpaMarketer] = useState(false) // saringan order tanpa marketer pemegang (18 Nov 2026)
  const [lihatBatal, setLihatBatal] = useState(false)
  const [lihatSelesai, setLihatSelesai] = useState(false)

  const muat = useCallback(async () => {
    try { setD(await api(`/api/circle/papan?studioId=${studioId}`)); setGalat('') } catch (e) { setGalat(e.message) }
  }, [studioId])
  useEffect(() => { setD(null); muat() }, [muat])
  useSegarkan(muat, ['orders', 'penugasan', 'tugas'])

  // Masuk antrean talent atau ditunda (12 Nov 2026, masukan tim): pengelola yang memindah kartu ke tahap KERJA/Revisi/Finalisasi
  // (dan order punya talent internal) memilih — pekerjaan langsung masuk Antreanku talent, atau ditunda (tetap di Tugasku: besok / lembur).
  const [tanyaAntrean, modalAntrean] = useTanyaAntrean()
  async function kirimAksi(o, a, antrean) {
    try { await api(`/api/circle/orders/${o.id}/aksi`, { method: 'POST', body: { aksi: a.aksi, ...(antrean === false ? { antrean: false } : {}) } }) } catch (e) { alert(e.message) }
    muat()
  }
  async function aksi(o, a) {
    const tujuan = a.ke ? d.tahap.find(t => t.id === a.ke) : null
    if (!d.pantau && !d.terbatas && tujuan && a.aksi !== 'hold' && perluTanyaAntrean({ adaTalentInternal: o.adaTalentInternal, jenisTujuan: tujuan.jenis })) {
      const masuk = await tanyaAntrean({ judul: o.judul, talent: o.talent, tujuan: tujuan.nama }); if (masuk === null) return
      return kirimAksi(o, a, masuk)
    }
    kirimAksi(o, a)
  }
  async function pindahManual(o, tahapId) {
    const tujuan = d.tahap.find(t => t.id === tahapId)
    let nilaiRiil
    if (tujuan.jenis === 'SELESAI') {
      const jawab = window.prompt(`Pindah "${o.judul}" ke ${tujuan.nama}.\nNilai riil (Rp) — kosongkan jika sama (${formatRp(o.nilaiBersih)}):`, '')
      if (jawab === null) return
      const angka = jawab.replace(/[^\d]/g, '')
      if (angka) nilaiRiil = Number(angka)
    }
    let antrean
    if (perluTanyaAntrean({ adaTalentInternal: o.adaTalentInternal, jenisTujuan: tujuan.jenis })) { antrean = await tanyaAntrean({ judul: o.judul, talent: o.talent, tujuan: tujuan.nama }); if (antrean === null) return }
    try { await api(`/api/circle/orders/${o.id}/tahap`, { method: 'PATCH', body: { tahapId, nilaiRiil, ...(antrean === false ? { antrean: false } : {}) } }) } catch (e) { alert(e.message) }
    muat()
  }

  const orders = useMemo(() => {
    if (!d) return []
    const q = cari.trim().toLowerCase()
    const akunSah = akunLihat && (d.akunPilihan ?? []).some(a => a.id === akunLihat) ? akunLihat : ''
    const dasar = d.orders.filter(o => (!tanpaMarketer || !o.marketer) && (!akunSah || o.akunId === akunSah))
    return q ? dasar.filter(o => `${o.judul} ${o.klien} ${o.talent.join(' ')}`.toLowerCase().includes(q)) : dasar
  }, [d, cari, tanpaMarketer, akunLihat])

  if (galat) return <div className="galat blok">{galat}</div>
  if (!d) return <div className="redup tengah">Memuat papan…</div>
  const akunAktif = akunLihat && (d.akunPilihan ?? []).some(x => x.id === akunLihat) ? akunLihat : ''

  const langkah = Object.fromEntries(d.tahap.map(t => [t.id, t]))
  // Warna tahap kerja (12 Nov 2026, masukan tim): KERJA/FINALISASI berurutan dapat --tahap-1..8; QC & Revisi internal ikut induknya
  const urutKerja = d.tahap.filter(t => ['KERJA', 'FINALISASI'].includes(t.jenis))
  const warna = {}; urutKerja.forEach((t, i) => { warna[t.id] = `var(--tahap-${(i % 8) + 1})` })
  for (const t of d.tahap) if (!warna[t.id] && t.indukId && warna[t.indukId] && ['QC', 'REVISI_INTERNAL'].includes(t.jenis)) warna[t.id] = warna[t.indukId]
  // Tampilan "Per tahap" (opsional): satu kolom per tahap rinci, urut alur; tahap opsional yang tidak dipakai & kosong disembunyikan
  const kolomTahap = d.tahap.filter(t => !t.opsional || t.aktifBawaan || orders.some(o => !o.cancelKlien && o.tahapId === t.id)).map(t => ({ kunci: t.id, tahapId: t.id, jenis: [t.jenis], steps: [t], judul: t.nama, warna: warna[t.id] }))
  const kolomFase = d.fase.map(f => ({ kunci: f.kunci, jenis: f.jenis, steps: f.langkah.map(id => langkah[id]), judul: f.langkah.length === 1 ? langkah[f.langkah[0]].nama : f.label }))
  const kolom = tampilan === 'tahap' ? kolomTahap : kolomFase

  return (
    <>
      {d.pantau && <div className="panel" style={{ borderLeft: '4px solid var(--accent)', marginBottom: 12 }}><b>Mode pantau.</b> <span className="redup">Kamu bisa memantau alur semua order unit ini. Nilai uang hanya tampil untuk order yang kamu pegang. Tombol muncul untuk fase klien (preview, menunggu klien, delivery) dan untuk tahap kerja order yang kamu pegang bila dikerjakan freelance; QC tetap oleh koordinator.</span></div>}
      <RingkasanBulan key={studioId} studioId={studioId} rKini={d.ringkasan} akunId={akunAktif} />
      <div className="toolbar">
        <input className="cari" placeholder="Cari judul, klien, atau talent…" value={cari} onChange={e => setCari(e.target.value)} />
        {!d.pantau && d.bisaTambah !== false && <button className="btn utama" onClick={() => setForm(true)}>+ Tambah order</button>}
        {(d.akunPilihan ?? []).length > 1 && <select style={{ width: 'auto', maxWidth: 240 }} value={akunAktif} onChange={e => setAkunLihat(e.target.value)} title="Lihat progres satu akun jualan (market) saja — kolom & ringkasan bulan ikut akun ini">
          <option value="">Semua akun jualan</option>{d.akunPilihan.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}</select>}
        {!d.pantau && !d.terbatas && d.orders.some(o => !o.marketer) && <button className={'btn kecil' + (tanpaMarketer ? ' utama' : '')} onClick={() => setTanpaMarketer(v => !v)} title="Order yang belum punya marketer pemegang — tetapkan di detail order (✎ Ubah)">Tanpa marketer ({d.orders.filter(o => !o.marketer).length})</button>}
        <span className="tukar-tampilan" title="Per fase = kolom besar (Produksi, QC, Revisi…); Per tahap = satu kolom per tahap rinci dari menu Alur">{[['fase', 'Per fase'], ['tahap', 'Per tahap']].map(([k, l]) => <button key={k} type="button" className={tampilan === k ? 'aktif' : ''} onClick={() => setTampilan(k)}>{l}</button>)}</span>
        <button className="btn kecil" onClick={() => setLihatSelesai(v => !v)} title="Order yang selesai bulan-bulan sebelumnya">{lihatSelesai ? 'Sembunyikan order selesai' : 'Order selesai (arsip)'}</button>
        <button className="btn kecil" onClick={() => setLihatBatal(v => !v)}>{lihatBatal ? 'Sembunyikan order dibatalkan' : 'Order dibatalkan'}</button>
      </div>
      {lihatSelesai && <DaftarSelesai studioId={studioId} onDetail={setDetailId} onTutup={() => setLihatSelesai(false)} />}
      {lihatBatal && <DaftarBatal studioId={studioId} onDetail={setDetailId} onTutup={(diubah) => { if (diubah) muat(); else setLihatBatal(false) }} />}
      <div className="papan">
        {kolom.map(k => {
          const isi = orders.filter(o => !o.cancelKlien && (k.tahapId ? o.tahapId === k.tahapId : k.jenis.includes(langkah[o.tahapId]?.jenis)))
          // Inbox: order yang baru masuk paling atas (13 Nov 2026, masukan tim); kolom lain tetap urut deadline
          if (k.jenis.includes('MASUK') && k.jenis.length === 1) isi.sort((a, b) => String(b.tanggalMasuk ?? '').localeCompare(String(a.tanggalMasuk ?? '')))
          // Done: yang paling baru selesai di atas (20 Nov 2026, masukan tim) — sama dengan arsip Order selesai
          else if (k.jenis.every(j => j === 'SELESAI')) isi.sort(terbaruSelesai)
          const jumlah = isi.reduce((a, o) => a + o.nilaiBersih, 0)
          return (
            <section key={k.kunci} className={'kolom fase-' + (k.tahapId ? k.steps[0].jenis.toLowerCase() : k.kunci) + (k.warna ? ' bertanda' : '')} style={k.warna ? { '--c': k.warna } : undefined}>
              <header><b>{k.judul}</b><span className="hitung">{isi.length}</span></header>
              <div className="redup kecil sub">{d.pantau ? (k.kunci === 'selesai' ? 'bulan ini' : '\u00a0') : formatRp(jumlah)}{!d.pantau && k.kunci === 'selesai' ? ' · bulan ini' : ''}</div>
              <div className="isi-kolom">
                {isi.map(o => (
                  <KartuOrder key={o.id} o={o} tahap={d.tahap} tahapKartu={langkah[o.tahapId]} jenisSaatIni={langkah[o.tahapId]?.jenis}
                    tampilSub={k.steps.length > 1} warna={warna[o.tahapId]} bisaUbah={(!d.pantau && !d.terbatas) || o.aksi.length > 0} terbatas={!!d.pantau || !!d.terbatas} onAksi={aksi} onPindahManual={pindahManual} onOpsional={setOpsional} onDetail={!d.pantau || o.milikSaya ? (id, f) => { setDetailFokus(f ?? null); setDetailId(id) } : undefined} onInvoice={!d.pantau && !d.terbatas ? (id) => { setDetailFokus('invoice'); setDetailId(id) } : undefined} />
                ))}
                {isi.length === 0 && <div className="kosong">Kosong</div>}
              </div>
            </section>
          )
        })}
        {orders.some(o => o.cancelKlien) && (() => { const isi = orders.filter(o => o.cancelKlien).sort(terbaruSelesai); return (
          <section key="cancel" className="kolom fase-cancel">
            <header><b>Cancel</b><span className="hitung">{isi.length}</span></header>
            <div className="redup kecil sub">{d.pantau ? '\u00a0' : formatRp(isi.reduce((a, o) => a + o.nilaiBersih, 0))} · klien batal, tetap dihitung</div>
            <div className="isi-kolom">
              {isi.map(o => <KartuOrder key={o.id} o={o} tahap={d.tahap} tahapKartu={langkah[o.tahapId]} jenisSaatIni={langkah[o.tahapId]?.jenis} tampilSub={false} warna={warna[o.tahapId]} bisaUbah={(!d.pantau && !d.terbatas) || o.aksi.length > 0} terbatas={!!d.pantau || !!d.terbatas} onAksi={aksi} onPindahManual={pindahManual} onOpsional={setOpsional} onDetail={!d.pantau || o.milikSaya ? (id, f) => { setDetailFokus(f ?? null); setDetailId(id) } : undefined} onInvoice={!d.pantau && !d.terbatas ? (id) => { setDetailFokus('invoice'); setDetailId(id) } : undefined} />)}
            </div>
          </section>) })()}
      </div>
      {form && <FormOrder studioId={studioId} anggota={d.anggota} marketer={d.pilihanMarketer} bisaFee={!d.pantau} onTutup={() => setForm(false)} onSimpan={() => { setForm(false); muat() }} />}
      {opsional && <ModalOpsional order={opsional} tahap={d.tahap} onTutup={() => setOpsional(null)} onSimpan={() => { setOpsional(null); muat() }} />}
      {modalAntrean}
      {detailId && <DetailOrder orderId={detailId} fokus={detailFokus} onTutup={() => { setDetailId(null); setDetailFokus(null); muat() }} />}
    </>
  )
}
