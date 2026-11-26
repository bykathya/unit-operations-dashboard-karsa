import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import PilihRekening from './PilihRekening'
import { InputAngka } from './Pilihan'

// BAYAR FREELANCE (12 Nov 2026, masukan tim): fee freelance di Tim order = utang unit ke freelance. Catat DP / Lunas di sini →
// otomatis menjadi biaya unit (kategori Fee Freelance) di Biaya & Kas, Tutup bulan & laba rugi — tidak perlu dicatat dua kali.
const rp = (n) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'))
const angka = (v) => Number(String(v ?? '').replace(/\D/g, '')) || 0
const tg = (d) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—')
const LABEL = { BELUM_LUNAS: 'Belum dibayar', DP: 'DP', LUNAS: 'Lunas' }

// AJUAN (16 Nov 2026, masukan tim): admin menyiapkan DP/Lunas → Koordinator melihatnya di Tugas saya › Bayar freelance (hanyaAjuan),
// transfer, lalu klik "Sudah dibayar" (tercatat sebagai biaya unit seperti biasa). Ajuan tidak menyentuh kas.
export default function BayarFreelance({ studioId, onBukaOrder, hanyaAjuan = false, onJumlah }) {
  const hariIni = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
  const [semua, setSemua] = useState(false), [d, setD] = useState(null), [galat, setGalat] = useState(''), [info, setInfo] = useState('')
  const [rek, setRek] = useState([]), [form, setForm] = useState(null) // { mode: 'bayar'|'ajuan', id, jenis, jumlah, tanggal, rekeningId, catatan }
  const muat = useCallback(() => api(`/api/circle/bayar-freelance?studioId=${studioId}${semua ? '&semua=1' : ''}${hanyaAjuan ? '&ajuan=1' : ''}`).then(x => { setD(x); setGalat(''); onJumlah?.(x.ringkas.ajuan) }).catch(e => setGalat(e.message)), [studioId, semua, hanyaAjuan]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setD(null); muat(); api(`/api/circle/buku/rekening?studioId=${studioId}`).then(setRek).catch(() => {}) }, [muat, studioId])
  const jalan = async (fn) => { setGalat(''); setInfo(''); try { const r = await fn(); setInfo(r?.message ?? ''); setForm(null); await muat() } catch (e) { setGalat(e.message) } }
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  return (
    <div>
      {/* Teks diperjelas (16 Nov 2026, pertanyaan Marketer A: "ikut Tutup bulan" maksudnya apa; tombol DP/Lunas tidak terlihat oleh admin) */}
      {hanyaAjuan ? <p className="redup">Pembayaran freelance yang sudah disiapkan admin. Transfer sesuai jumlahnya, lalu klik <b>Sudah dibayar</b> — otomatis tercatat sebagai biaya unit (Fee Freelance) di Biaya &amp; Kas.</p>
        : <p className="redup">Fee freelance diisi di <b>Tim order</b> (ubah fee). Di sini dicatat pembayarannya — klik <b>DP</b> atau <b>Lunas</b> di ujung kanan baris. Setiap pembayaran otomatis menjadi biaya unit (kategori <b>Fee Freelance</b>) di Biaya &amp; Kas pada <b>bulan tanggal bayarnya</b>, jadi tidak perlu dicatat dua kali. Yang belum dibayar tetap ada di daftar ini walau sudah ganti bulan, sampai lunas.</p>}
      {!d.bisaBayar && <div className="nada-warn kecil" style={{ marginBottom: 8 }}>Pembayaran ke freelance dicatat oleh Koordinator unit karena mengeluarkan uang kas. Kamu bisa menyiapkannya: klik <b>Ajukan DP</b> atau <b>Ajukan lunas</b> — Koordinator melihatnya di Tugas saya › Bayar freelance, tinggal transfer.</div>}
      {!hanyaAjuan && <div className="toolbar">
        <div className="stat"><span className="redup kecil">Belum dibayar ke freelance</span><b className={d.ringkas.utang ? 'nada-warn' : ''}>{rp(d.ringkas.utang)}</b></div>
        {d.ringkas.ajuan > 0 && <div className="stat"><span className="redup kecil">Menunggu dibayar Koordinator</span><b>{d.ringkas.ajuan}</b></div>}
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, margin: 0 }}><input type="checkbox" style={{ width: 'auto' }} checked={semua} onChange={e => setSemua(e.target.checked)} /> tampilkan yang sudah lunas</label>
      </div>}
      {galat && <div className="galat blok">{galat}</div>}
      {info && <div className="ok blok">{info}</div>}
      {d.ringkas.tanpaFee > 0 && <div className="nada-warn kecil" style={{ marginBottom: 8 }}>{d.ringkas.tanpaFee} freelance belum diisi fee-nya — isi di Tim order (ubah fee) supaya utangnya terhitung.</div>}
      {d.baris.length === 0 ? <div className="kosong">{hanyaAjuan ? 'Tidak ada ajuan pembayaran freelance.' : semua ? 'Belum ada freelance di order unit ini.' : 'Tidak ada fee freelance yang belum dibayar.'}</div> : (
        <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Freelance</th><th>Order</th><th className="kanan">Fee</th><th className="kanan">Sudah dibayar</th><th className="kanan">Sisa</th><th>Status</th><th /></tr></thead>
          <tbody>{d.baris.map(b => <tr key={b.id}>
            <td><b>{b.nama}</b></td>
            <td>{onBukaOrder && !b.orderDihapus ? <a href="#" onClick={e => { e.preventDefault(); onBukaOrder(b.order.id) }}>{b.order.judul}</a> : b.order.judul}<div className="redup kecil">{b.order.klien}</div>
              {b.orderDihapus && <div className="kecil nada-warn" title="Ordernya sudah dihapus, tetapi fee sudah dibayar — batalkan pembayarannya bila itu salah input / uji coba (biaya Fee Freelance ikut terhapus)">order dihapus · fee sudah dibayar</div>}</td>
            <td className="kanan">{b.fee ? rp(b.fee) : <span className="nada-warn kecil">belum diisi</span>}</td>
            <td className="kanan">{rp(b.dibayar)}</td>
            <td className="kanan"><b>{rp(b.sisa)}</b></td>
            <td><span className={'lencana' + (b.status === 'LUNAS' ? ' jenis-SELESAI' : '')}>{LABEL[b.status]}</span>{b.tanggalDibayar && <div className="redup kecil">{tg(b.tanggalDibayar)}</div>}
              {b.ajuan && <div className="kecil nada-warn" title={b.ajuan.catatan ?? ''}>Diajukan {b.ajuan.jenis === 'LUNAS' ? 'lunas' : 'DP'} {rp(b.ajuan.jumlah)} · {b.ajuan.oleh}{b.ajuan.catatan ? ` — ${b.ajuan.catatan}` : ''}</div>}</td>
            <td className="kanan">
              {d.bisaBayar && b.ajuan && <><button className="btn kecil utama" onClick={() => setForm({ mode: 'bayar', id: b.id, jenis: b.ajuan.jenis, jumlah: String(b.ajuan.jumlah), tanggal: hariIni, rekeningId: null, sisa: b.sisa, nama: b.nama })}>✓ Sudah dibayar</button>{' '}
                <button className="btn kecil" onClick={() => confirm(`Tolak ajuan pembayaran untuk ${b.nama}?`) && jalan(() => api(`/api/circle/bayar-freelance/${b.id}/batal-ajuan`, { method: 'POST' }))}>Tolak</button>{' '}</>}
              {!d.bisaBayar && d.bisaAjukan && b.status !== 'LUNAS' && !b.orderDihapus && (b.ajuan
                ? <button className="btn kecil" onClick={() => confirm('Batalkan ajuan ini?') && jalan(() => api(`/api/circle/bayar-freelance/${b.id}/batal-ajuan`, { method: 'POST' }))}>Batalkan ajuan</button>
                : <>{b.fee > 0 && <button className="btn kecil utama" onClick={() => setForm({ mode: 'ajuan', id: b.id, jenis: 'LUNAS', jumlah: '', catatan: '', sisa: b.sisa, nama: b.nama })}>Ajukan lunas</button>}{' '}
                  <button className="btn kecil" onClick={() => setForm({ mode: 'ajuan', id: b.id, jenis: 'DP', jumlah: '', catatan: '', nama: b.nama })}>Ajukan DP</button></>)}
              {d.bisaBayar && !hanyaAjuan && !b.ajuan && <>
              {b.status !== 'LUNAS' && b.fee > 0 && !b.orderDihapus && <button className="btn kecil utama" onClick={() => setForm({ mode: 'bayar', id: b.id, jenis: 'LUNAS', jumlah: '', tanggal: hariIni, rekeningId: null, sisa: b.sisa, nama: b.nama })}>Lunas</button>}{' '}
              {b.status !== 'LUNAS' && !b.orderDihapus && <button className="btn kecil" onClick={() => setForm({ mode: 'bayar', id: b.id, jenis: 'DP', jumlah: '', tanggal: hariIni, rekeningId: null, nama: b.nama })}>DP</button>}{' '}
              {b.status !== 'BELUM_LUNAS' && <button className="btn kecil" onClick={() => confirm(`Batalkan pembayaran ke ${b.nama}? Biaya otomatisnya ikut dihapus.`) && jalan(() => api(`/api/circle/bayar-freelance/${b.id}/batal`, { method: 'POST' }))}>Batalkan</button>}
            </>}</td>
          </tr>)}</tbody></table></div>)}
      {form?.mode === 'ajuan' && <form className="panel" style={{ marginTop: 12 }} onSubmit={e => { e.preventDefault(); jalan(() => api(`/api/circle/bayar-freelance/${form.id}/ajukan`, { method: 'POST', body: { jenis: form.jenis, jumlah: form.jenis === 'DP' ? angka(form.jumlah) : undefined, catatan: form.catatan } })) }}>
        <b>{form.jenis === 'LUNAS' ? `Ajukan pelunasan ${form.nama} — ${rp(form.sisa)}` : `Ajukan DP untuk ${form.nama}`}</b>
        <div className="toolbar" style={{ marginTop: 8 }}>
          {form.jenis === 'DP' && <label className="isian-sebaris">Jumlah (Rp)<InputAngka style={{ width: 150 }} value={form.jumlah} onChange={e => setForm({ ...form, jumlah: e.target.value })} required /></label>}
          <label className="isian-sebaris">Catatan untuk Koordinator (opsional)<input style={{ width: 240 }} maxLength={300} placeholder="mis. transfer ke BCA a.n. Fadilah" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} /></label>
          <button className="btn utama" style={{ alignSelf: 'flex-end' }}>Kirim ajuan</button><button type="button" className="btn" style={{ alignSelf: 'flex-end' }} onClick={() => setForm(null)}>Batal</button>
        </div></form>}
      {form?.mode === 'bayar' && <form className="panel" style={{ marginTop: 12 }} onSubmit={e => { e.preventDefault(); jalan(() => api(`/api/circle/bayar-freelance/${form.id}/bayar`, { method: 'POST', body: { jenis: form.jenis, jumlah: form.jenis === 'DP' ? angka(form.jumlah) : undefined, tanggal: form.tanggal, rekeningId: form.rekeningId } })) }}>
        <b>{form.jenis === 'LUNAS' ? `Lunasi ${form.nama} — ${rp(form.sisa)}` : `DP untuk ${form.nama}`}</b>
        <div className="toolbar" style={{ marginTop: 8 }}>
          {form.jenis === 'DP' && <label className="isian-sebaris">Jumlah (Rp)<InputAngka style={{ width: 150 }} value={form.jumlah} onChange={e => setForm({ ...form, jumlah: e.target.value })} required /></label>}
          <label className="isian-sebaris">Tanggal bayar<input type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} required /></label>
          {rek.length > 0 && <label className="isian-sebaris">Dari rekening<PilihRekening daftar={rek} value={form.rekeningId} kosong="— pilih —" onChange={v => setForm({ ...form, rekeningId: v })} /></label>}
          <button className="btn utama" style={{ alignSelf: 'flex-end' }}>Simpan</button><button type="button" className="btn" style={{ alignSelf: 'flex-end' }} onClick={() => setForm(null)}>Batal</button>
        </div></form>}
    </div>
  )
}
