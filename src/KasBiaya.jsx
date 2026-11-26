import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { NAMA_BULAN, bulanSekarang, geserBulan, hariIniLokal } from './api-util'
import PilihRekening, { namaRekening } from './PilihRekening'
import { useKurs, KetKurs } from './FormOrder'
import { InputAngka } from './Pilihan'

// BIAYA & KAS (adaptasi OGS; MODE BAYANGAN — tidak menulis ke Laporan Omset Ekosistem). Per unit: Biaya (persetujuan + pembayaran),
// Pendapatan (penarikan → transfer → konfirmasi, dana tertahan), Saldo platform. Super Admin: Kas pusat (dompet, mutasi tempel,
// rekonsiliasi, saldo bank). Tanpa unggahan berkas — hanya tautan. Nomor rekening lengkap tidak disimpan (4 digit akhir).
const rp = (n) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'))
const tgl = (d) => (d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const kunciBulan = (p) => `${p.tahun}-${String(p.bulan).padStart(2, '0')}`
const LABEL = { MENUNGGU: 'Menunggu', DISETUJUI: 'Disetujui', DITOLAK: 'Ditolak', BELUM: 'Belum dibayar', SEBAGIAN: 'Sebagian', LUNAS: 'Lunas', SELESAI: 'Selesai', DITRANSFER: 'Terkirim', DIKONFIRMASI: 'Dikonfirmasi', TERTAHAN: 'Tertahan', DILEPAS: 'Dilepas', COCOK: 'Cocok', ABAIKAN: 'Diabaikan' }
const Lencana = ({ s }) => <span className={'lencana' + (['DITOLAK', 'BELUM'].includes(s) ? ' revisi' : '')}>{LABEL[s] ?? s}</span>

function useBulan() { const [p, setP] = useState(bulanSekarang()); return [p, setP, <div className="toolbar" key="b"><button className="btn kecil" onClick={() => setP(geserBulan(p, -1))}>←</button><b>{NAMA_BULAN[p.bulan - 1]} {p.tahun}</b><button className="btn kecil" onClick={() => setP(geserBulan(p, 1))}>→</button></div>] }
function PilihUnit({ unit, studioId, setStudioId }) { return <label style={{ maxWidth: 320 }}>Unit<select value={studioId} onChange={e => setStudioId(e.target.value)}>{unit.map(s => <option key={s.id} value={s.id}>{s.nama.trim()}</option>)}</select></label> }
const aksi = async (fn, setGalat, muat) => { setGalat(''); try { await fn(); muat?.() } catch (e) { setGalat(e.message) } }

// ── BIAYA ──
function Biaya({ studioId }) {
  const [p, , navBulan] = useBulan()
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const [f, setF] = useState({ kategori: '', tanggal: hariIniLokal(), jumlah: '', deskripsi: '', jatuhTempo: '', freelancer: '', linkInvoice: '', rekeningId: null })
  const [form, setForm] = useState(false), [ubahId, setUbahId] = useState(null) // ubahId: biaya yang sedang diubah (form yang sama dengan Catat biaya)
  const muat = useCallback(() => api(`/api/circle/kas/biaya?studioId=${studioId}&bulan=${kunciBulan(p)}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, p])
  useEffect(() => { setD(null); muat() }, [muat])
  const B = (id, jalur, method = 'POST', body) => aksi(() => api(`/api/circle/kas/biaya/${id}${jalur}`, { method, body }), setGalat, muat)
  return (
    <div>
      {navBulan}
      {galat && <div className="galat blok">{galat}</div>}
      {!d ? (galat ? null : <div className="redup">Memuat…</div>) : <>
        <div className="ringkasan">
          <div className="stat"><span className="redup kecil">Total biaya</span><b>{rp(d.ringkasan.total)}</b></div>
          <div className="stat"><span className="redup kecil">Sudah dibayar</span><b>{rp(d.ringkasan.dibayar)}</b></div>
          <div className="stat"><span className="redup kecil">Belum dibayar</span><b className={d.ringkasan.belumDibayar ? 'nada-warn' : ''}>{rp(d.ringkasan.belumDibayar)}</b></div>
          <div className="stat"><span className="redup kecil">Disetujui / menunggu</span><b>{d.ringkasan.disetujui} / {d.ringkasan.menunggu}</b></div>
        </div>
        {!form ? <div className="toolbar"><button className="btn utama" onClick={() => setForm(true)}>+ Catat biaya</button></div> : (
          <form className="panel" style={{ marginBottom: 14 }} onSubmit={e => { e.preventDefault(); aksi(async () => { await api(ubahId ? `/api/circle/kas/biaya/${ubahId}` : '/api/circle/kas/biaya', { method: ubahId ? 'PATCH' : 'POST', body: { ...(ubahId ? {} : { studioId }), ...f, jumlah: Number(f.jumlah), jatuhTempo: f.jatuhTempo || (ubahId ? null : undefined), linkInvoice: f.linkInvoice || (ubahId ? null : undefined), freelancer: f.freelancer || (ubahId ? null : undefined) } }); setForm(false); setUbahId(null); setF({ ...f, jumlah: '', deskripsi: '', freelancer: '', linkInvoice: '', jatuhTempo: '' }) }, setGalat, muat) }}>
            <div className="dua">
              <label>Kategori<input list="kat-biaya" value={f.kategori} onChange={e => setF({ ...f, kategori: e.target.value })} required maxLength={60} /><datalist id="kat-biaya">{d.kategori.map(k => <option key={k.id} value={k.nama} />)}</datalist></label>
              <label>Jumlah (Rp)<InputAngka terbilang value={f.jumlah} onChange={e => setF({ ...f, jumlah: e.target.value })} required /></label>
              <label>Tanggal<input type="date" value={f.tanggal} onChange={e => setF({ ...f, tanggal: e.target.value })} required /></label>
              <label>Jatuh tempo<input type="date" value={f.jatuhTempo} onChange={e => setF({ ...f, jatuhTempo: e.target.value })} /></label>
              <label>Freelancer (opsional)<input value={f.freelancer} onChange={e => setF({ ...f, freelancer: e.target.value })} maxLength={80} /></label>
              <label>Tautan invoice (http…)<input value={f.linkInvoice} onChange={e => setF({ ...f, linkInvoice: e.target.value })} placeholder="https://…" /></label>
              <label>Dibayar dari rekening<PilihRekening daftar={d.rekening} value={f.rekeningId} onChange={v => setF({ ...f, rekeningId: v })} /></label>
            </div>
            <label>Deskripsi<input value={f.deskripsi} onChange={e => setF({ ...f, deskripsi: e.target.value })} maxLength={500} /></label>
            <div className="modal-aksi"><button type="button" className="btn" onClick={() => { setForm(false); setUbahId(null) }}>Batal</button><button className="btn utama">{ubahId ? 'Simpan perubahan' : 'Simpan'}</button></div>
          </form>
        )}
        {d.biaya.length === 0 ? <div className="kosong">Belum ada biaya di bulan ini.</div> : (
          <table><thead><tr><th>Tanggal</th><th>Biaya</th><th className="kanan">Jumlah</th><th>Persetujuan</th><th>Pembayaran</th><th /></tr></thead>
            <tbody>{d.biaya.map(b => (
              <tr key={b.id}>
                <td>{tgl(b.tanggal)}{b.jatuhTempo && b.statusBayar !== 'LUNAS' && <div className="redup kecil">tempo {tgl(b.jatuhTempo)}</div>}</td>
                <td><b>{b.kategori}</b>{b.terkunci && ' 🔒'}<div className="redup kecil">{b.deskripsi}{b.freelancer ? ` · ${b.freelancer}` : ''}{b.linkInvoice && <> · <a href={b.linkInvoice} target="_blank" rel="noreferrer noopener">invoice</a></>}</div></td>
                <td className="kanan">{rp(b.jumlah)}{b.statusBayar === 'SEBAGIAN' && <div className="redup kecil">dibayar {rp(b.jumlahDibayar)}</div>}</td>
                <td><Lencana s={b.persetujuan} />{d.bisaSetuju && !(b.terkunci || b.assignmentId) && <div style={{ marginTop: 4 }}>{b.persetujuan !== 'DISETUJUI' && <button className="btn kecil" onClick={() => B(b.id, '/setuju', 'POST', { status: 'DISETUJUI' })}>Setujui</button>} {b.persetujuan !== 'DITOLAK' && <button className="btn kecil" onClick={() => B(b.id, '/setuju', 'POST', { status: 'DITOLAK' })}>Tolak</button>}</div>}</td>
                <td><Lencana s={b.statusBayar} />{d.rekening?.length > 0 && <div style={{ marginTop: 4 }}>{(b.terkunci || b.assignmentId) ? <span className="redup kecil">{namaRekening(d.rekening, b.rekeningId) ?? 'rekening belum dipilih'}</span> : <PilihRekening kecil daftar={d.rekening} value={b.rekeningId} kosong="dari rekening…" onChange={v => B(b.id, '', 'PATCH', { rekeningId: v })} />}</div>}{!(b.terkunci || b.assignmentId) && <div style={{ marginTop: 4 }}>{b.statusBayar !== 'LUNAS' && <button className="btn kecil" onClick={() => B(b.id, '/bayar', 'POST', { status: 'LUNAS', dibayarPada: hariIniLokal() })}>Lunas</button>} {b.statusBayar === 'LUNAS' && <button className="btn kecil" onClick={() => B(b.id, '/bayar', 'POST', { status: 'BELUM' })}>Batalkan</button>}</div>}</td>
                <td className="kanan">{b.assignmentId ? <span className="redup kecil">dari Bayar freelance</span> : d.bisaSetuju && <><button className="btn kecil" onClick={() => B(b.id, '/kunci', 'POST', { terkunci: !(b.terkunci || b.assignmentId) })}>{b.terkunci ? 'Buka kunci' : 'Kunci'}</button> {!(b.terkunci || b.assignmentId) && <button className="btn kecil" onClick={() => confirm('Hapus biaya ini?') && B(b.id, '', 'DELETE')}>Hapus</button>}</>}{!(b.terkunci || b.assignmentId) && <> <button className="btn kecil" title="Ubah biaya ini" onClick={() => { setF({ kategori: b.kategori, tanggal: b.tanggal, jumlah: String(b.jumlah), deskripsi: b.deskripsi ?? '', jatuhTempo: b.jatuhTempo ?? '', freelancer: b.freelancer ?? '', linkInvoice: b.linkInvoice ?? '', rekeningId: b.rekeningId ?? null }); setUbahId(b.id); setForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Ubah</button></>}</td>
              </tr>
            ))}</tbody></table>
        )}
      </>}
    </div>
  )
}

// ── PENDAPATAN ──
function Pendapatan({ studioId }) {
  const [p, , navBulan] = useBulan()
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const [ubahWd, setUbahWd] = useState(null) // id penarikan yang sedang diubah (form yang sama dengan + Penarikan)
  const [wd, setWd] = useState({ tanggal: hariIniLokal(), jumlah: '', dariPlatform: 'fiverr', bankTujuan: '', atasNama: '', rekeningId: null, catatan: '' })
  const [hd, setHd] = useState({ tanggal: hariIniLokal(), jumlah: '', bank: '', atasNama: '', dariPlatform: 'lainnya' })
  const [buka, setBuka] = useState('')
  const muat = useCallback(() => api(`/api/circle/kas/pendapatan?studioId=${studioId}&bulan=${kunciBulan(p)}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, p])
  useEffect(() => { setD(null); muat() }, [muat])
  const K = (jalur, method = 'POST', body) => aksi(() => api(`/api/circle/kas${jalur}`, { method, body }), setGalat, muat)
  if (!d) return galat ? <div className="galat blok">{galat}</div> : <div className="redup">Memuat…</div>
  return (
    <div>
      {navBulan}
      {galat && <div className="galat blok">{galat}</div>}
      <div className="ringkasan">
        <div className="stat"><span className="redup kecil">Ditarik (WD) bulan ini</span><b>{rp(d.ringkasan.ditarik)}</b></div>
        <div className="stat" title="Uang yang sudah ditarik dari platform tetapi masih di rekening pribadi seseorang (belum di rekening unit)"><span className="redup kecil">Dana tertahan (rekening pribadi)</span><b className={d.ringkasan.tertahan ? 'nada-warn' : ''}>{rp(d.ringkasan.tertahan)}</b></div>
      </div>
      {d.ringkasan.omzetBersihOrder != null && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h4 className="judul-bagian">Ke mana omset order bulan ini?</h4>
          <div className="ringkasan">
            <div className="stat"><span className="redup kecil">Omset bersih order (perkiraan)</span><b>{rp(d.ringkasan.omzetBersihOrder)}</b></div>
            <div className="stat"><span className="redup kecil">Sudah ditarik (WD)</span><b>{rp(d.ringkasan.ditarik)}</b></div>
            <div className="stat" title={d.ringkasan.saldoPlatform?.bulan ? `Isian tab Saldo platform bulan ${d.ringkasan.saldoPlatform.bulan}` : 'Tab Saldo platform belum diisi'}><span className="redup kecil">Masih di saldo platform</span><b>{rp(d.ringkasan.saldoPlatform?.jumlah ?? 0)}</b><span className="redup kecil">{d.ringkasan.saldoPlatform?.diperbarui ? `diperbarui ${tgl(String(d.ringkasan.saldoPlatform.diperbarui).slice(0, 10))}` : 'belum diisi'}</span></div>
            <div className="stat"><span className="redup kecil">Ditahan di rekening pribadi</span><b>{rp(d.ringkasan.tertahan)}</b></div>
            <div className="stat"><span className="redup kecil">Belum dibayar klien</span><b>{rp(d.ringkasan.belumDibayar?.jumlah ?? 0)}</b>{d.ringkasan.belumDibayar?.jumlah > 0 && <span className="redup kecil">{rp(d.ringkasan.belumDibayar.sudahDelivery)} sudah dikirim · {rp(d.ringkasan.belumDibayar.masihDikerjakan)} masih dikerjakan</span>}</div>
            {d.ringkasan.manualUsaha > 0 && <div className="stat"><span className="redup kecil">Pendapatan usaha (dicatat di Rincian)</span><b>{rp(d.ringkasan.manualUsaha)}</b></div>}
            <div className="stat"><span className="redup kecil">Belum terjelaskan</span><b className={Math.abs(d.ringkasan.selisih) > 0.02 * (d.ringkasan.omzetBersihOrder || 1) ? 'nada-warn' : ''}>{rp(d.ringkasan.selisih)}</b></div>
          </div>
          <div className="redup kecil">Omset bersih = nilai order yang masuk bulan ini setelah potongan platform. Uangnya bisa sudah ditarik (WD — termasuk cicilan klien Komunitas/Internal yang otomatis tercatat), masih di <b>Saldo platform</b> (isi seminggu sekali di tab Saldo platform), ditahan di rekening pribadi, atau <b>belum dibayar klien</b> (piutang, lihat menu Belum dibayar klien). "Belum terjelaskan" = sisanya — perkiraan, karena WD & saldo platform bisa berisi uang order bulan lain. Angka besar yang terus ada = periksa.</div>
        </div>
      )}
      <div className="toolbar"><button className="btn" onClick={() => { if (ubahWd) { setUbahWd(null); setWd(v => ({ ...v, tanggal: hariIniLokal(), jumlah: '' })); setBuka('wd') } else setBuka(buka === 'wd' ? '' : 'wd') }}>+ Penarikan</button><button className="btn" onClick={() => setBuka(buka === 'hd' ? '' : 'hd')}>+ Dana tertahan</button></div>
      {buka === 'wd' && <form className="panel" style={{ marginBottom: 12 }} onSubmit={e => { e.preventDefault(); K(ubahWd ? `/penarikan/${ubahWd}` : '/penarikan', ubahWd ? 'PATCH' : 'POST', { ...(ubahWd ? {} : { studioId }), ...wd, catatan: wd.catatan?.trim() || null, jumlah: Number(wd.jumlah), ...(wd.rekeningId ? { bankTujuan: undefined, atasNama: undefined } : {}) }).then(() => { setBuka(''); setUbahWd(null) }) }}>
        <div className="dua"><label>Tanggal<input type="date" value={wd.tanggal} onChange={e => setWd({ ...wd, tanggal: e.target.value })} required /></label><label>Jumlah (Rp)<InputAngka terbilang value={wd.jumlah} onChange={e => setWd({ ...wd, jumlah: e.target.value })} required /></label>
          <label>Dari platform<select value={wd.dariPlatform} onChange={e => setWd({ ...wd, dariPlatform: e.target.value })}>{d.platform.map(x => <option key={x} value={x}>{x === 'komunitas' ? 'komunitas / WhatsApp' : x}</option>)}</select></label><label>Masuk ke rekening<PilihRekening daftar={d.rekening} value={wd.rekeningId} kosong="— rekening lain (isi manual) —" onChange={v => setWd({ ...wd, rekeningId: v })} /></label>
          {!wd.rekeningId && <><label>Bank tujuan<input value={wd.bankTujuan} onChange={e => setWd({ ...wd, bankTujuan: e.target.value })} required maxLength={80} /></label><label>Atas nama<input value={wd.atasNama} onChange={e => setWd({ ...wd, atasNama: e.target.value })} required maxLength={80} /></label></>}</div>
        {/* Dari klien / keterangan (12 Nov 2026, masukan tim): terutama komunitas/WhatsApp — ikut tampil di Rincian Tutup bulan */}
        <label>Dari klien / keterangan{wd.dariPlatform === 'komunitas' ? '' : ' (opsional)'}<input list="klien-wd" value={wd.catatan ?? ''} onChange={e => setWd({ ...wd, catatan: e.target.value })} maxLength={200} placeholder="mis. nama klien / order" required={wd.dariPlatform === 'komunitas'} /><datalist id="klien-wd">{(d.klien ?? []).map(k => <option key={k} value={k} />)}</datalist></label>
        {wd.rekeningId && <div className="redup kecil" style={{ marginBottom: 8 }}>Bank & atas nama diisi otomatis dari Bio studio Ekosistem.</div>}
        <button className="btn utama">{ubahWd ? 'Simpan perubahan' : 'Simpan penarikan'}</button>{ubahWd && <button type="button" className="btn" style={{ marginLeft: 6 }} onClick={() => { setBuka(''); setUbahWd(null) }}>Batal</button>}</form>}
      {buka === 'hd' && <form className="panel" style={{ marginBottom: 12 }} onSubmit={e => { e.preventDefault(); K('/tertahan', 'POST', { studioId, ...hd, jumlah: Number(hd.jumlah) }).then(() => setBuka('')) }}>
        <div className="dua"><label>Tanggal<input type="date" value={hd.tanggal} onChange={e => setHd({ ...hd, tanggal: e.target.value })} required /></label><label>Jumlah (Rp)<InputAngka terbilang value={hd.jumlah} onChange={e => setHd({ ...hd, jumlah: e.target.value })} required /></label>
          <label>Dari platform<select value={hd.dariPlatform} onChange={e => setHd({ ...hd, dariPlatform: e.target.value })}>{d.platform.map(x => <option key={x} value={x}>{x === 'komunitas' ? 'komunitas / WhatsApp' : x}</option>)}</select></label><label>Bank tempat ditahan<input value={hd.bank} onChange={e => setHd({ ...hd, bank: e.target.value })} required maxLength={80} /></label><label>Atas nama<input value={hd.atasNama} onChange={e => setHd({ ...hd, atasNama: e.target.value })} required maxLength={80} /></label></div>
        <button className="btn utama">Simpan dana tertahan</button></form>}
      {d.ringkasan.tanpaRekening?.jumlahItem > 0 && <div className="panel" style={{ borderLeft: '4px solid var(--amber)', marginBottom: 12 }}><b>{d.ringkasan.tanpaRekening.jumlahItem} pemasukan ({rp(d.ringkasan.tanpaRekening.jumlah)}) belum dipilih rekeningnya.</b> <span className="redup">Pilih di baris bertanda "rekening belum dipilih" di bawah supaya Kas per rekening di Tutup bulan tepat.</span></div>}
      <h3 className="judul-bagian">Pemasukan: penarikan dari platform & cicilan klien</h3>
      <div className="redup kecil" style={{ marginBottom: 6 }}>Cicilan dari klien order akun <b>Komunitas/Internal</b> (uang langsung ke rekening unit) otomatis tercatat di sini begitu ditandai diterima di detail order. Order Fiverr/Etsy/Vgen/Upwork dicatat saat WD dari platform.</div>
      {d.penarikan.length === 0 ? <div className="kosong">Belum ada penarikan.</div> : <table><thead><tr><th>Nomor</th><th>Tanggal</th><th>Platform → bank</th><th className="kanan">Jumlah</th><th /></tr></thead>
        <tbody>{d.penarikan.map(w => <tr key={w.id}><td><b>{w.nomor}</b></td><td>{tgl(w.tanggal)}</td><td>{w.dariCicilan ? 'cicilan klien' : w.dariPlatform} → {w.rekeningId ? <b>{namaRekening(d.rekening, w.rekeningId)}</b> : w.dariCicilan ? <span className="nada-warn">rekening belum dipilih</span> : <>{w.bankTujuan} ({w.atasNama})</>}{w.dariCicilan && <span className="lencana" style={{ marginLeft: 6 }} title="Dibuat otomatis saat cicilan order ditandai diterima — jumlah & tanggal mengikuti cicilan di detail order">otomatis dari cicilan</span>}{w.catatan && <div className="redup kecil">{w.catatan}</div>}{!w.rekeningId && d.rekening?.length > 0 && w.status === 'MENUNGGU' && <div style={{ marginTop: 4 }}><PilihRekening kecil daftar={d.rekening} value={null} kosong="pilih rekening…" onChange={v => v && K(`/penarikan/${w.id}`, 'PATCH', { rekeningId: v })} /></div>}</td><td className="kanan">{rp(w.jumlah)}</td>
          <td className="kanan">{w.status === 'MENUNGGU' && !w.dariCicilan && <><button className="btn kecil" title="Ubah penarikan ini" onClick={() => { setWd({ tanggal: w.tanggal, jumlah: String(w.jumlah), dariPlatform: w.dariPlatform, bankTujuan: w.bankTujuan ?? '', atasNama: w.atasNama ?? '', rekeningId: w.rekeningId ?? null, catatan: w.catatan ?? '' }); setUbahWd(w.id); setBuka('wd'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Ubah</button> <button className="btn kecil" onClick={() => confirm('Hapus penarikan?') && K(`/penarikan/${w.id}`, 'DELETE')}>Hapus</button></>}</td></tr>)}</tbody></table>}
      {d.manual?.length > 0 && <><h3 className="judul-bagian" style={{ marginTop: 16 }}>Pemasukan yang dicatat di Rincian (Tutup bulan)</h3>
        <div className="redup kecil" style={{ marginBottom: 6 }}>Dicatat manual lewat "Tambah entri manual". Untuk uang dari klien/platform, lebih baik catat lewat <b>+ Penarikan</b> di atas (isi "Dari klien / keterangan") supaya terlihat di sini dan di Rincian sekaligus.</div>
        <table><thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th className="kanan">Jumlah</th></tr></thead><tbody>{d.manual.map(m => <tr key={m.id}><td>{tgl(m.tanggal)}</td><td>{m.kategori}</td><td>{m.deskripsi}</td><td className="kanan">{rp(m.jumlah)}</td></tr>)}</tbody></table></>}
      <h3 className="judul-bagian" style={{ marginTop: 16 }}>Dana tertahan (di rekening pribadi)</h3>
      <div className="redup kecil" style={{ marginBottom: 6 }}>Uang yang sudah ditarik dari platform tetapi masih di rekening pribadi seseorang. Klik <b>Lepas</b> setelah dipindah ke rekening unit → tercatat sebagai WD. Bukan untuk invoice yang belum dibayar (itu ada di menu Belum dibayar klien), bukan untuk saldo di Fiverr/Etsy (itu di tab Saldo platform).</div>
      {d.tertahan.length === 0 ? <div className="kosong">Tidak ada dana tertahan.</div> : <table><thead><tr><th>Nomor</th><th>Tanggal</th><th>Ditahan di</th><th className="kanan">Jumlah</th><th>Status</th><th /></tr></thead>
        <tbody>{d.tertahan.map(h => <tr key={h.id}><td><b>{h.nomor}</b></td><td>{tgl(h.tanggal)}</td><td>{h.bank} ({h.atasNama})</td><td className="kanan">{rp(h.jumlah)}</td><td><Lencana s={h.status} /></td>
          <td className="kanan">{h.status === 'TERTAHAN' && <><button className="btn kecil utama" onClick={() => confirm('Dana ini sudah cair? Akan dicatat sebagai penarikan (WD).') && K(`/tertahan/${h.id}/lepas`, 'POST', {})}>Lepas</button> <button className="btn kecil" onClick={() => confirm('Hapus?') && K(`/tertahan/${h.id}`, 'DELETE')}>Hapus</button></>}</td></tr>)}</tbody></table>}
      <p className="redup kecil" style={{ marginTop: 10 }}>Mode bayangan: catatan ini tidak mengubah Laporan Omset di Management Dashboard. Setiap penarikan (WD) dihitung sebagai pemasukan di Buku Besar studio ini. Tiap studio mandiri — tidak ada kas pusat.</p>
    </div>
  )
}

// ── SALDO PLATFORM ──
function SaldoPlatform({ studioId }) {
  const [p, , navBulan] = useBulan()
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const muat = useCallback(() => api(`/api/circle/kas/saldo-platform?studioId=${studioId}&bulan=${kunciBulan(p)}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, p])
  useEffect(() => { setD(null); muat() }, [muat])
  const kurs = useKurs(studioId)
  return (
    <div>
      {navBulan}
      <p className="redup">Saldo di akun platform (belum dicairkan) pada bulan ini, per platform. PayPal, Vgen, Fiverr, Etsy, dan Upwork diisi dalam USD, otomatis dikali kurs Rp {kurs ? Math.round(kurs.kurs).toLocaleString('id-ID') : '…'} dan disimpan dalam Rupiah. <KetKurs k={kurs} /></p>
      {galat && <div className="galat blok">{galat}</div>}
      {d && d.saldo.map(s => <SaldoBaris key={s.platform} s={s} kurs={kurs?.kurs} simpan={(jumlah) => aksi(() => api('/api/circle/kas/saldo-platform', { method: 'PUT', body: { studioId, bulan: kunciBulan(p), platform: s.platform, jumlah: Number(jumlah) } }), setGalat, muat)} />)}
      {d && <div className="redup" style={{ marginTop: 8 }}>Total: <b>{rp(d.saldo.reduce((a, x) => a + x.jumlah, 0))}</b></div>}
      {d && <div className="redup kecil" style={{ marginTop: 6 }}>{d.diperbarui ? <>Terakhir diperbarui <b>{tgl(String(d.diperbarui).slice(0, 10))}</b>{(Date.now() - new Date(d.diperbarui)) > 7 * 86400000 && <span className="nada-warn"> — sudah lebih dari 7 hari</span>}. </> : <span className="nada-warn">Belum diisi bulan ini. </span>}Perbarui seminggu sekali (bareng Laporan Mingguan) dan setiap kali WD — angka ini dipakai di Pendapatan untuk menjelaskan omset yang belum ditarik.</div>}
    </div>
  )
}
// Platform berbasis dolar diisi dalam USD × kurs Laporan Mingguan terbaru (14 Nov 2026, masukan tim); tersimpan dalam Rupiah seperti dulu.
const PLATFORM_USD = ['paypal', 'vgen', 'fiverr', 'etsy', 'upwork']
function SaldoBaris({ s, simpan, kurs }) {
  const k = PLATFORM_USD.includes(s.platform) && kurs > 0 ? kurs : null
  const awal = () => (k ? (s.jumlah ? String(Math.round((s.jumlah / k) * 100) / 100) : '0') : String(s.jumlah))
  const [v, setV] = useState(awal)
  useEffect(() => setV(awal()), [s.jumlah, k]) // eslint-disable-line react-hooks/exhaustive-deps
  const rupiah = k ? Math.round((Number(v) || 0) * k) : Number(v)
  return (
    <div className="toolbar"><span style={{ minWidth: 100, textTransform: 'capitalize' }}><b>{s.platform}</b></span>
      {k && <span className="redup">$</span>}
      <input inputMode="decimal" style={{ maxWidth: 160 }} value={v} placeholder={k ? 'USD' : 'Rp'} onChange={e => setV(e.target.value.replace(/[^\d.]/g, ''))} />
      {k && <span className="redup kecil">= {rp(rupiah)}</span>}
      <button className="btn kecil" disabled={rupiah === s.jumlah} onClick={() => simpan(rupiah)}>Simpan</button>
    </div>
  )
}

// ── KAS PUSAT (Super Admin): dompet, mutasi tempel, rekonsiliasi, saldo bank ──
function KasPusat() {
  const [p, , navBulan] = useBulan()
  const [dompet, setDompet] = useState([])
  const [dompetId, setDompetId] = useState('')
  const [status, setStatus] = useState('BELUM')
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const [info, setInfo] = useState('')
  const [tempel, setTempel] = useState('')
  const [fd, setFd] = useState({ kode: '', nama: '', tipe: 'BANK', akhiran: '', pemegang: '' })
  const [calon, setCalon] = useState({})
  const [saldoBank, setSaldoBank] = useState(null)
  const [fsb, setFsb] = useState({ namaRekening: '', jumlah: '' })
  const bulan = kunciBulan(p)
  const muatDompet = useCallback(() => api('/api/circle/kas/dompet').then(x => { setDompet(x); setDompetId(v => v || x[0]?.id || '') }).catch(e => setGalat(e.message)), [])
  const muat = useCallback(() => { api(`/api/circle/kas/mutasi?bulan=${bulan}${dompetId ? `&dompetId=${dompetId}` : ''}&status=${status}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)); api(`/api/circle/kas/saldo-bank?bulan=${bulan}`).then(setSaldoBank).catch(() => {}) }, [bulan, dompetId, status])
  useEffect(() => { muatDompet() }, [muatDompet])
  useEffect(() => { muat() }, [muat])
  const urai = (teks) => teks.split('\n').map(b => b.trim()).filter(Boolean).map(b => { const [tanggal, arah, jumlah, kategori, deskripsi] = b.split(/\t|\||;/).map(x => x?.trim()); return { tanggal, arah: (arah ?? '').toUpperCase(), jumlah: Number(String(jumlah ?? '').replace(/[^\d.]/g, '')), kategori: kategori || undefined, deskripsi: deskripsi || undefined } })
  const J = (fn, pesan) => aksi(async () => { const h = await fn(); if (pesan) setInfo(typeof pesan === 'function' ? pesan(h) : pesan); muat() }, setGalat)
  return (
    <div>
      {galat && <div className="galat blok">{galat}</div>}
      {info && <div className="chip" style={{ display: 'inline-block', marginBottom: 10 }}>{info}</div>}
      <h3 className="judul-bagian">Dompet kas</h3>
      <p className="redup kecil">Hanya 4 digit terakhir rekening yang disimpan — nomor lengkap tidak pernah disimpan di web circle.</p>
      {dompet.length > 0 && <table><tbody>{dompet.map(x => <tr key={x.id}><td><b>{x.kode}</b></td><td>{x.nama}</td><td>{x.tipe}</td><td>{x.pemegang ?? '—'}</td><td>{x.akhiran ? '••••' + x.akhiran : '—'}</td></tr>)}</tbody></table>}
      <form className="toolbar" style={{ marginTop: 8 }} onSubmit={e => { e.preventDefault(); J(() => api('/api/circle/kas/dompet', { method: 'PUT', body: fd }), 'Dompet disimpan').then(() => { setFd({ kode: '', nama: '', tipe: 'BANK', akhiran: '', pemegang: '' }); muatDompet() }) }}>
        <input style={{ width: 100 }} placeholder="Kode" value={fd.kode} onChange={e => setFd({ ...fd, kode: e.target.value })} required /><input style={{ width: 160 }} placeholder="Nama" value={fd.nama} onChange={e => setFd({ ...fd, nama: e.target.value })} required />
        <select style={{ width: 110 }} value={fd.tipe} onChange={e => setFd({ ...fd, tipe: e.target.value })}><option>BANK</option><option>EWALLET</option></select><input style={{ width: 130 }} placeholder="Pemegang" value={fd.pemegang} onChange={e => setFd({ ...fd, pemegang: e.target.value })} /><input style={{ width: 90 }} placeholder="4 digit" maxLength={4} value={fd.akhiran} onChange={e => setFd({ ...fd, akhiran: e.target.value })} /><button className="btn kecil utama">+ Dompet</button>
      </form>
      <h3 className="judul-bagian" style={{ marginTop: 20 }}>Mutasi &amp; pencocokan saldo</h3>
      {navBulan}
      <div className="toolbar">
        <select style={{ width: 'auto' }} value={dompetId} onChange={e => setDompetId(e.target.value)}><option value="">Semua dompet</option>{dompet.map(x => <option key={x.id} value={x.id}>{x.nama}</option>)}</select>
        <div className="tab-mini" style={{ margin: 0 }}>{[['BELUM', 'Belum cocok'], ['COCOK', 'Cocok'], ['ABAIKAN', 'Diabaikan'], ['', 'Semua']].map(([k, l]) => <button key={k} className={status === k ? 'aktif' : ''} onClick={() => setStatus(k)}>{l}</button>)}</div>
        <button className="btn kecil utama" onClick={() => J(() => api('/api/circle/kas/rekon/otomatis', { method: 'POST', body: { bulan } }), (h) => `Otomatis: ${h.cocok} dicocokkan, ${h.diabaikan} diabaikan`)}>Rekon otomatis bulan ini</button>
      </div>
      {d && <div className="ringkasan"><div className="stat"><span className="redup kecil">Belum cocok</span><b className={d.ringkasan.belum ? 'nada-warn' : ''}>{d.ringkasan.belum}</b><span className="redup kecil">{rp(d.ringkasan.jumlahBelum)}</span></div><div className="stat"><span className="redup kecil">Cocok</span><b>{d.ringkasan.cocok}</b></div><div className="stat"><span className="redup kecil">Diabaikan</span><b>{d.ringkasan.diabaikan}</b></div></div>}
      {d && (d.mutasi.length === 0 ? <div className="kosong">Tidak ada mutasi pada filter ini.</div> : (
        <table><thead><tr><th>Tanggal</th><th>Uraian</th><th className="kanan">Jumlah</th><th>Status</th><th /></tr></thead>
          <tbody>{d.mutasi.map(m => (
            <tr key={m.id}><td>{tgl(m.tanggal)}<div className="redup kecil">{m.dompet?.kode}</div></td>
              <td>{m.deskripsi ?? '—'}<div className="redup kecil">{m.kategori ?? m.tipe}{m.internal ? ' · internal' : ''}{m.catatanRekon ? ` · ${m.catatanRekon}` : ''}</div>
                {calon[m.id] && (calon[m.id].length === 0 ? <div className="redup kecil">Tidak ada kandidat pasangan.</div> : calon[m.id].map(k => <div key={k.id} className="meta"><span className="chip sub">{k.tipe}</span><span>{k.label}</span><span className="redup">{tgl(k.tanggal)} · {rp(k.jumlah)}</span><button className="btn kecil utama" onClick={() => J(() => api(`/api/circle/kas/mutasi/${m.id}/cocok`, { method: 'POST', body: { tipe: k.tipe, id: k.id } }), 'Dicocokkan')}>Cocokkan</button></div>))}</td>
              <td className="kanan"><b className={m.arah === 'CR' ? 'nada-ok' : ''}>{m.arah === 'CR' ? '+' : '−'}{rp(m.jumlah)}</b></td><td><Lencana s={m.rekonStatus} /></td>
              <td className="kanan">{m.rekonStatus === 'BELUM' && <><button className="btn kecil" onClick={() => api(`/api/circle/kas/mutasi/${m.id}/kandidat`).then(x => setCalon({ ...calon, [m.id]: x })).catch(e => setGalat(e.message))}>Kandidat</button> <button className="btn kecil" onClick={() => { const c = prompt('Alasan diabaikan:'); if (c) J(() => api(`/api/circle/kas/mutasi/${m.id}/abaikan`, { method: 'POST', body: { catatan: c } })) }}>Abaikan</button> <button className="btn kecil" onClick={() => confirm('Hapus mutasi?') && J(() => api(`/api/circle/kas/mutasi/${m.id}`, { method: 'DELETE' }))}>Hapus</button></>}{m.rekonStatus !== 'BELUM' && <button className="btn kecil" onClick={() => J(() => api(`/api/circle/kas/mutasi/${m.id}/lepas`, { method: 'POST' }))}>Lepas</button>}</td></tr>
          ))}</tbody></table>
      ))}
      <h3 className="judul-bagian" style={{ marginTop: 20 }}>Tempel mutasi bank</h3>
      <p className="redup kecil">Satu baris per mutasi: <code>tanggal(YYYY-MM-DD) | CR/DB | jumlah | kategori | uraian</code> (pemisah | ; atau tab). Mengimpor ulang baris yang sama tidak menggandakan.</p>
      <textarea rows={5} value={tempel} onChange={e => setTempel(e.target.value)} placeholder={'2026-10-12 | CR | 2900000 | Pemasukan | Transfer Keiko\n2026-10-13 | DB | 500000 | Biaya | Sewa'} />
      <div className="toolbar" style={{ marginTop: 8 }}><span className="redup kecil">{urai(tempel).length} baris terbaca</span><button className="btn utama" disabled={!dompetId || !tempel.trim()} onClick={() => J(() => api('/api/circle/kas/mutasi/impor', { method: 'POST', body: { dompetId, baris: urai(tempel) } }), (h) => `${h.baru} baru, ${h.duplikat} sudah ada`).then(() => setTempel(''))}>Impor ke dompet terpilih</button></div>
      <h3 className="judul-bagian" style={{ marginTop: 20 }}>Saldo bank bulan ini</h3>
      {saldoBank && <>{saldoBank.saldo.length > 0 && <table><tbody>{saldoBank.saldo.map(s => <tr key={s.namaRekening}><td>{s.namaRekening}</td><td className="kanan">{rp(s.jumlah)}</td></tr>)}<tr><td><b>Total</b></td><td className="kanan"><b>{rp(saldoBank.total)}</b></td></tr></tbody></table>}</>}
      <form className="toolbar" style={{ marginTop: 8 }} onSubmit={e => { e.preventDefault(); J(() => api('/api/circle/kas/saldo-bank', { method: 'PUT', body: { bulan, namaRekening: fsb.namaRekening, jumlah: Number(fsb.jumlah) } }), 'Saldo bank disimpan').then(() => setFsb({ namaRekening: '', jumlah: '' })) }}>
        <input style={{ width: 200 }} placeholder="Nama rekening" value={fsb.namaRekening} onChange={e => setFsb({ ...fsb, namaRekening: e.target.value })} required /><input style={{ width: 150 }} type="number" min="0" placeholder="Saldo (Rp)" value={fsb.jumlah} onChange={e => setFsb({ ...fsb, jumlah: e.target.value })} required /><button className="btn kecil utama">Simpan</button>
      </form>
    </div>
  )
}

export default function KasBiaya({ unit, superAdmin, unitAwal }) {
  const [sub, setSub] = useState('biaya')
  // Ikut unit yang dipilih di sidebar (11 Nov 2026; dulu selalu unit pertama di daftar → bisa tertukar)
  const [studioId, setStudioId] = useState(unitAwal ?? unit[0]?.id ?? '')
  useEffect(() => { if (unitAwal) setStudioId(unitAwal) }, [unitAwal])
  const TAB = [['biaya', 'Biaya'], ['pendapatan', 'Pendapatan'], ['saldo', 'Saldo platform']] // tab "Kas pusat" disembunyikan 10 Nov 2026: Ekosistem tiap studio mandiri, tak ada kas pusat (kode KasPusat & endpoint dibiarkan)
  return (
    <div>
      <div className="tab-mini">{TAB.map(([k, l]) => <button key={k} className={sub === k ? 'aktif' : ''} onClick={() => setSub(k)}>{l}</button>)}</div>
      {sub !== 'pusat' && unit.length > 1 && <PilihUnit unit={unit} studioId={studioId} setStudioId={setStudioId} />}
      {sub === 'biaya' && studioId && <Biaya key={studioId} studioId={studioId} />}
      {sub === 'pendapatan' && studioId && <Pendapatan key={studioId} studioId={studioId} />}
      {sub === 'saldo' && studioId && <SaldoPlatform key={studioId} studioId={studioId} />}
      {sub === 'pusat' && <KasPusat />}
    </div>
  )
}
