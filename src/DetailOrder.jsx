import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { PilihKategori, InputRupiah, PilihCari, InputAngka } from './Pilihan'
import { cetakInvoice } from './Tagihan'
import { IsianKhusus } from './KolomKhusus'
import { useAkunOrder, PilihAkun, useFreelancer, useKurs, useKlien } from './FormOrder'

// Detail order (adaptasi OGS: halaman detail proyek). Semua orang yang berhak melihat order: info, tim, riwayat tahap,
// item (tanpa harga), catatan proyek. Koordinator ke atas: + harga, nilai, termin pembayaran, fee tim. Tanpa unggahan berkas.
const rp = (n) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'))
const tgl = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const tglJam = (d) => (d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')

function Item({ d, muat, setGalat }) {
  const [edit, setEdit] = useState(null)
  // Order USD (13 Nov 2026, masukan tim): harga item & add-on diketik dalam USD, disimpan dalam Rupiah memakai kurs order ini;
  // nilai USD order ikut bertambah sebesar add-on.
  const kurs = d.mataUang?.mataUang === 'USD' && d.mataUang.kurs > 0 ? d.mataUang.kurs : null
  const usd = (rpx) => `$${(Math.round((rpx / kurs) * 100) / 100).toLocaleString('en-US')}`
  const uang = (rpx) => (kurs ? <>{usd(rpx)} <span className="redup kecil">{rp(rpx)}</span></> : rp(rpx))
  const keRp = (x) => (kurs ? Math.round(Number(x.hargaUsd || 0) * kurs) : Number(x.hargaSatuan || 0))
  const mulai = () => setEdit(d.item.map(i => ({ jenis: i.jenis, nama: i.nama, jumlah: i.jumlah, hargaSatuan: i.hargaSatuan ?? 0, hargaUsd: kurs ? String(Math.round(((i.hargaSatuan ?? 0) / kurs) * 100) / 100) : '' })))
  const ubah = (i, p) => setEdit(e => e.map((x, n) => (n === i ? { ...x, ...p } : x)))
  const total = edit ? edit.reduce((a, i) => a + Number(i.jumlah) * keRp(i), 0) : d.item.reduce((a, i) => a + i.jumlah * (i.hargaSatuan ?? 0), 0)
  // Add-on menambah nilai order (13 Nov 2026, masukan tim): beri tahu dulu berapa nilai order bergeser
  const addon = (xs, rpOf) => xs.filter(i => i.jenis === 'ADDON').reduce((a, i) => a + Number(i.jumlah) * rpOf(i), 0)
  async function simpan() {
    const delta = addon(edit, keRp) - addon(d.item, i => i.hargaSatuan ?? 0)
    if (delta && !confirm(`Nilai order ${delta > 0 ? 'bertambah' : 'berkurang'} ${kurs ? `${usd(Math.abs(delta))} (${rp(Math.abs(delta))})` : rp(Math.abs(delta))} karena add-on (jadi ${kurs ? `${usd(d.uang.nilaiKotor + delta)} · ` : ''}${rp(d.uang.nilaiKotor + delta)}). Nilai bersih & status bayar ikut dihitung ulang. Lanjut?`)) return
    setGalat('')
    try { await api(`/api/circle/orders/${d.id}/item`, { method: 'PUT', body: { item: edit.map(x => ({ jenis: x.jenis, nama: x.nama, jumlah: Number(x.jumlah), hargaSatuan: keRp(x) })) } }); setEdit(null); muat() } catch (e) { setGalat(e.message) }
  }
  async function samakan() { if (!confirm('Ubah nilai order menjadi total item? Nilai bersih dihitung ulang dari fee akun.')) return; setGalat(''); try { await api(`/api/circle/orders/${d.id}/samakan-nilai`, { method: 'POST' }); muat() } catch (e) { setGalat(e.message) } }
  const baruBaris = (jenis) => setEdit([...edit, { jenis, nama: '', jumlah: 1, hargaSatuan: 0, hargaUsd: '' }])
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="baris-atas"><h4 className="judul-bagian" style={{ margin: 0 }}>Item &amp; add-on</h4>{d.bisaUbahOrder && !edit && <button className="btn kecil" onClick={mulai}>{d.item.length ? 'Ubah' : '+ Tambah'}</button>}</div>
      {!edit ? (d.item.length === 0 ? <div className="redup kecil">Belum ada item.</div> : (
        <table><tbody>{d.item.map(i => <tr key={i.id}><td>{i.jenis === 'ADDON' ? <span className="chip sub">add-on</span> : null} {i.nama}</td><td className="kanan">×{i.jumlah}</td>{d.bisaUbahOrder && <td className="kanan">{uang(i.hargaSatuan)}</td>}{d.bisaUbahOrder && <td className="kanan"><b>{uang(i.jumlah * i.hargaSatuan)}</b></td>}</tr>)}</tbody></table>
      )) : (
        <div>
          {/* "Item pokok" vs "Add-on" (14 Nov 2026, kasus tim: Accessories tercatat sebagai Item sehingga nilai tidak bertambah) */}
          <div className="redup kecil" style={{ marginBottom: 6 }}><b>Item pokok</b> = rincian harga yang sudah termasuk nilai order (tidak mengubah nilai). <b>Add-on</b> = tambahan di luar harga → nilai order bertambah.</div>
          {kurs && <div className="redup kecil" style={{ marginBottom: 6 }}>Order USD: isi harga dalam USD, otomatis dikali kurs order ini (Rp {Math.round(kurs).toLocaleString('id-ID')}).</div>}
          {edit.map((x, i) => (
            <div key={i} className="toolbar" style={{ marginBottom: 6 }}>
              <select style={{ width: 110 }} value={x.jenis} onChange={e => ubah(i, { jenis: e.target.value })}><option value="ITEM">Item pokok</option><option value="ADDON">Add-on</option></select>
              <input style={{ flex: 1, minWidth: 140 }} placeholder="Nama" value={x.nama} onChange={e => ubah(i, { nama: e.target.value })} />
              <input style={{ width: 64 }} type="number" min="1" value={x.jumlah} onChange={e => ubah(i, { jumlah: e.target.value })} />
              {kurs
                ? <><input style={{ width: 110 }} inputMode="decimal" placeholder="Harga (USD)" value={x.hargaUsd} onChange={e => ubah(i, { hargaUsd: e.target.value.replace(/[^\d.]/g, '') })} /><span className="redup kecil">{rp(keRp(x))}</span></>
                : <InputAngka style={{ width: 130 }} placeholder="Harga (Rp)" value={x.hargaSatuan} onChange={e => ubah(i, { hargaSatuan: e.target.value })} />}
              <button className="btn kecil" onClick={() => setEdit(edit.filter((_, n) => n !== i))}>✕</button>
            </div>
          ))}
          <div className="toolbar"><button className="btn kecil" title="Rincian harga pokok — tidak mengubah nilai order" onClick={() => baruBaris('ITEM')}>+ Item pokok</button><button className="btn kecil" title="Tambahan di luar harga pokok — menambah nilai order" onClick={() => baruBaris('ADDON')}>+ Add-on</button><span className="spasi" /><b>{uang(total)}</b><button className="btn kecil" onClick={() => setEdit(null)}>Batal</button><button className="btn kecil utama" onClick={simpan}>Simpan</button></div>
        </div>
      )}
      {d.bisaUbahOrder && !edit && d.item.length > 0 && <div className="redup kecil" style={{ marginTop: 8 }}>{d.uang.totalAddon > 0 && <>Nilai order {kurs ? `${usd(d.uang.nilaiKotor)} · ` : ''}{rp(d.uang.nilaiKotor)} sudah termasuk add-on {kurs ? `${usd(d.uang.totalAddon)} · ` : ''}{rp(d.uang.totalAddon)}. </>}Total item {rp(d.uang.totalItem)}{d.uang.selisihItem ? <> · selisih dengan nilai order <b className={d.uang.selisihItem ? 'nada-warn' : ''}>{rp(d.uang.selisihItem)}</b> <button className="btn kecil" onClick={samakan}>Samakan nilai order</button></> : d.uang.selisihItem === 0 ? ' · sama dengan nilai order' : ''}</div>}
    </div>
  )
}

// Tim per tahap (10 Nov 2026, permintaan tim 3D): siapa mengerjakan tahap apa. Kosong = semua tahap kerja. Revisi & QC mengikuti tahap induknya.
function TahapTim({ d, t, muat, setGalat }) {
  const [buka, setBuka] = useState(false), [ids, setIds] = useState(t.tahapKerjaIds ?? [])
  const opsi = d.tahapKerja ?? []
  const nama = (t.tahapKerjaIds ?? []).map(i => opsi.find(o => o.id === i)?.nama).filter(Boolean)
  const simpan = async () => { setGalat(''); try { await api(`/api/circle/orders/${d.id}/tim/${t.id}`, { method: 'PATCH', body: { tahapKerjaIds: ids } }); setBuka(false); muat() } catch (e) { setGalat(e.message) } }
  return (
    <>
      <span className="redup kecil" title="Tahap yang dikerjakan orang ini">🛠 {nama.length ? nama.join(', ') : 'semua tahap'}</span>
      <button className="btn kecil" title="Atur tahap yang dikerjakan" onClick={() => { setIds(t.tahapKerjaIds ?? []); setBuka(v => !v) }}>tahap</button>
      {buka && <div className="panel" style={{ width: '100%', marginTop: 6 }}>
        <div className="redup kecil" style={{ marginBottom: 4 }}>Pilih tahap yang dikerjakan {t.nama}. Kosongkan semua = ia mengerjakan semua tahap. QC & revisi ikut tahap induknya. Antrean langsung menyesuaikan.</div>
        <div className="chips">{opsi.map(o => <label key={o.id} className="centang" style={{ margin: 0 }}><input type="checkbox" checked={ids.includes(o.id)} onChange={e => setIds(e.target.checked ? [...ids, o.id] : ids.filter(x => x !== o.id))} /> {o.nama}</label>)}</div>
        <div className="chips" style={{ marginTop: 6 }}><button className="btn kecil utama" onClick={simpan}>Simpan</button><button className="btn kecil" onClick={() => setBuka(false)}>Batal</button></div>
      </div>}
    </>
  )
}

// INVOICE PER ORDER (12 Nov 2026, masukan tim): Invoice DP / Pelunasan langsung dari order — terbit (Ditagih) & siap cetak, tanpa
// menyusun tagihan manual. Saat klien membayar, tandai Lunas di menu Tagihan → otomatis tercatat sebagai cicilan order ini.
function InvoiceOrder({ d, muatOrder, setGalat, fokus }) {
  const [x, setX] = useState(null), [f, setF] = useState({ jenis: 'DP', jumlah: '', keterangan: '' })
  const muat = useCallback(() => api(`/api/circle/orders/${d.id}/invoice`).then(setX).catch(() => setX(false)), [d.id])
  useEffect(() => { muat() }, [muat])
  const ref = useRef(null)
  useEffect(() => { if (fokus && x) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [fokus, !!x]) // dibuka dari tombol 🧾 Invoice di kartu
  if (x === false || x === null) return null // bukan pengelola unit (invoice hanya Koordinator/admin) atau masih memuat
  const isiBawaan = (jenis) => jenis === 'DP' ? Math.round(Math.min(x.belumDitagih, x.harga / 2)) : jenis === 'PELUNASAN' ? Math.round(x.belumDitagih) : ''
  // ✓ Sudah dibayar langsung dari order (12 Nov 2026, masukan tim): invoice → Lunas → otomatis tercatat sebagai DP/cicilan/pelunasan di daftar atas
  const sudahBayar = async (i) => { const t = window.prompt(`Tanggal ${i.nomor} (${i.keterangan}) dibayar klien (YYYY-MM-DD):`, new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)); if (!t) return; setGalat(''); try { await api(`/api/circle/tagihan/${i.id}/lunas`, { method: 'POST', body: { tanggal: t.trim() } }); await muat(); muatOrder() } catch (e) { setGalat(e.message) } }
  // Batalkan invoice yang belum dibayar (17 Nov 2026, masukan tim: klien cancel padahal invoice DP sudah terbit)
  const batalInv = async (i) => { if (!confirm(`Batalkan ${i.nomor} (${i.keterangan})?\n\nInvoice tidak dihitung lagi sebagai tagihan; nomornya tetap tercatat.`)) return; setGalat(''); try { await api(`/api/circle/tagihan/${i.id}/batal`, { method: 'POST', body: {} }); await muat(); muatOrder() } catch (e) { setGalat(e.message) } }
  const jml = Number(String(f.jumlah).replace(/\D/g, ''))
  const cetak = async (id) => { setGalat(''); try { cetakInvoice(await api(`/api/circle/tagihan/${id}`)) } catch (e) { setGalat(e.message) } }
  const terbit = async () => { setGalat(''); try { await api(`/api/circle/orders/${d.id}/invoice`, { method: 'POST', body: { jenis: f.jenis, jumlah: jml || isiBawaan(f.jenis) || undefined, keterangan: f.keterangan || undefined } }); setF({ jenis: 'PELUNASAN', jumlah: '', keterangan: '' }); await muat(); muatOrder() } catch (e) { setGalat(e.message) } }
  return (
    <div ref={ref} style={{ marginTop: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8, scrollMarginTop: 16 }}>
      <b>② Dengan invoice</b> <span className="redup kecil">Harga {rp(x.harga)} · sudah ditagih {rp(x.sudahDitagih)}{x.dibayarTanpaInvoice > 0 ? ` · sudah dibayar tanpa invoice ${rp(x.dibayarTanpaInvoice)}` : ''} · belum ditagih {rp(x.belumDitagih)}</span>
      {x.invoice.length > 0 && <table style={{ marginTop: 6 }}><tbody>{x.invoice.map(i => <tr key={i.id}><td><b>{i.nomor}</b> <span className="redup kecil">{i.keterangan}</span></td><td className="kanan">{rp(i.jumlah)}</td><td><span className={'lencana' + (i.status === 'LUNAS' ? ' jenis-SELESAI' : '')}>{i.labelStatus}</span></td><td className="kanan"><button className="btn kecil" onClick={() => cetak(i.id)}>🖨 Cetak</button>{i.status === 'DITAGIH' && <> <button className="btn kecil utama" onClick={() => sudahBayar(i)} title="Klien sudah membayar invoice ini — otomatis tercatat sebagai pembayaran order">✓ Sudah dibayar</button></>}{['DRAFT', 'DITAGIH'].includes(i.status) && <> <button className="btn kecil" onClick={() => batalInv(i)} title="Klien batal / salah terbit: invoice dibatalkan (nomor tetap tercatat), tidak dihitung sebagai tagihan">Batalkan</button></>}</td></tr>)}</tbody></table>}
      {x.belumDitagih > 0.5 && <div className="toolbar" style={{ marginTop: 6 }}>
        <select style={{ width: 'auto' }} value={f.jenis} onChange={e => setF({ ...f, jenis: e.target.value, jumlah: isiBawaan(e.target.value) ? 'Rp ' + isiBawaan(e.target.value).toLocaleString('id-ID') : '' })}><option value="DP">DP</option><option value="CICILAN">Cicilan</option><option value="PELUNASAN">Pelunasan</option><option value="LAIN">Lainnya…</option></select>
        {f.jenis === 'LAIN' && <input style={{ width: 150 }} placeholder="keterangan (mis. Termin 2)" value={f.keterangan} onChange={e => setF({ ...f, keterangan: e.target.value })} maxLength={60} />}
        <div style={{ minWidth: 190 }}><InputRupiah value={f.jumlah || (isiBawaan(f.jenis) ? 'Rp ' + isiBawaan(f.jenis).toLocaleString('id-ID') : '')} onChange={v => setF({ ...f, jumlah: v })} placeholder="Jumlah ditagih (Rp)" /></div>
        <button className="btn kecil utama" onClick={terbit}>Terbitkan invoice</button>
      </div>}
      <div className="redup kecil">Pilih DP / Cicilan / Pelunasan → <b>Terbitkan invoice</b> → <b>Cetak</b>. Saat klien membayar, klik <b>✓ Sudah dibayar</b> di invoice itu — otomatis tercatat di daftar pembayaran di atas, tidak perlu diketik ulang.</div>
    </div>
  )
}

function Termin({ d, muat, setGalat, fokus }) {
  // "Termin" diganti istilah "Cicilan" (10 Nov 2026, masukan tim: kurang familiar); nama dipilih dari daftar (tak perlu mengetik), jumlah berformat rupiah
  const sudahCicilan = d.termin.filter(t => /^cicilan/i.test(t.label)).length
  const hariIniWib = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
  // 12 Nov 2026 (masukan tim): tanggal = TANGGAL DITERIMA → cicilan langsung tercatat dibayar (tanpa klik "Tandai dibayar" lagi); "belum diterima" = jatuh tempo
  const [f, setF] = useState({ label: d.termin.some(t => t.label === 'DP') ? '__cicilan' : 'DP', lainnya: '', jumlah: '', tanggal: hariIniWib, diterima: true })
  const [edit, setEdit] = useState(null) // ubah cicilan yang sudah ada (10 Nov 2026, permintaan tim): nama, jumlah, jatuh tempo
  const jalankan = async (fn) => { setGalat(''); try { await fn(); muat() } catch (e) { setGalat(e.message) } }
  const hariIni = new Date().toISOString().slice(0, 10)
  const angka = Number(String(f.jumlah).replace(/\D/g, ''))
  const labelFinal = f.label === '__cicilan' ? `Cicilan ${sudahCicilan + 1}` : f.label === '__lain' ? f.lainnya.trim() : f.label
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <h4 className="judul-bagian">Pembayaran dari klien</h4>
      <div className="ringkasan" style={{ marginBottom: 8 }}>
        <div className="stat"><span className="redup kecil">Nilai bersih</span><b>{rp(d.uang.nilaiBersih)}</b></div>
        <div className="stat"><span className="redup kecil">Diterima</span><b>{rp(d.uang.diterima)}</b></div>
        <div className="stat"><span className="redup kecil">Sisa tagihan</span><b className={d.uang.sisaTagihan ? 'nada-warn' : ''}>{rp(d.uang.sisaTagihan)}</b></div>
        <div className="stat"><span className="redup kecil">Status</span><b>{{ LUNAS: 'Lunas', DP: 'DP / sebagian', BELUM_LUNAS: 'Belum lunas' }[d.uang.statusBayar]}</b></div>
      </div>
      {/* Kas dari cicilan (18 Nov 2026): order Komunitas/Internal → cicilan diterima otomatis masuk Pendapatan; marketplace dicatat saat WD */}
      <div className="redup kecil" style={{ marginBottom: 6 }}>{['Komunitas', 'Internal'].includes(d.akun?.platform)
        ? <>Uang klien order ini langsung ke rekening unit: cicilan yang ditandai diterima <b>otomatis tercatat di Biaya &amp; Kas → Pendapatan</b> (koordinator memilih rekeningnya). Tidak perlu dicatat lagi sebagai penarikan.</>
        : <>Order {d.akun?.platform ?? 'marketplace'}: "diterima/lunas" = sudah dibayar di platform. Uangnya masuk kas saat <b>WD</b> dari saldo platform (dicatat di Biaya &amp; Kas → Pendapatan).</>}</div>
      {d.termin.length > 0 && <table><thead><tr><th>Cicilan</th><th>Jatuh tempo</th><th className="kanan">Jumlah</th><th>Dibayar</th><th /></tr></thead>
        <tbody>{d.termin.map(t => {
          const telat = !t.dibayarPada && t.jatuhTempo && t.jatuhTempo < hariIni
          if (edit?.id === t.id) {
            const angkaE = Number(String(edit.jumlah).replace(/\D/g, ''))
            return <tr key={t.id}><td colSpan={5}>
              <div className="chips">
                <input list="nama-cicilan" style={{ width: 150 }} value={edit.label} onChange={e => setEdit({ ...edit, label: e.target.value })} maxLength={60} placeholder="nama cicilan" />
                <datalist id="nama-cicilan"><option value="DP" /><option value="Cicilan 1" /><option value="Cicilan 2" /><option value="Cicilan 3" /><option value="Pelunasan" /></datalist>
                <div style={{ minWidth: 190 }}><InputRupiah value={edit.jumlah} onChange={v => setEdit({ ...edit, jumlah: v })} placeholder="Jumlah (Rp)" /></div>
                <input style={{ width: 150 }} type="date" value={edit.jatuhTempo} onChange={e => setEdit({ ...edit, jatuhTempo: e.target.value })} title="Jatuh tempo (opsional)" />
                <button className="btn kecil utama" disabled={!angkaE || !edit.label.trim()} onClick={() => jalankan(async () => { await api(`/api/circle/orders/${d.id}/termin/${t.id}`, { method: 'PATCH', body: { label: edit.label.trim(), jumlah: angkaE, jatuhTempo: edit.jatuhTempo || null } }); setEdit(null) })}>Simpan</button>
                <button className="btn kecil" onClick={() => setEdit(null)}>Batal</button>
              </div>
              {t.dibayarPada && <div className="redup kecil">Cicilan ini sudah ditandai dibayar — mengubah jumlah juga mengubah angka "Diterima" dan status bayar order.</div>}
            </td></tr>
          }
          return <tr key={t.id}><td><b>{t.label}</b></td><td className={telat ? 'nada-bad' : ''}>{t.jatuhTempo ? tgl(t.jatuhTempo) : '—'}{telat ? ' · telat' : ''}</td><td className="kanan">{rp(t.jumlah)}</td>
            <td>{t.dibayarPada ? <span className="chip">✓ {tgl(t.dibayarPada)}</span> : <button className="btn kecil" onClick={() => jalankan(() => api(`/api/circle/orders/${d.id}/termin/${t.id}`, { method: 'PATCH', body: { dibayarPada: hariIni } }))}>Tandai dibayar</button>}</td>
            <td className="kanan"><button className="btn kecil" onClick={() => setEdit({ id: t.id, label: t.label, jumlah: 'Rp ' + Math.round(t.jumlah).toLocaleString('id-ID'), jatuhTempo: t.jatuhTempo ? String(t.jatuhTempo).slice(0, 10) : '' })}>Ubah</button> {t.dibayarPada && <button className="btn kecil" onClick={() => jalankan(() => api(`/api/circle/orders/${d.id}/termin/${t.id}`, { method: 'PATCH', body: { dibayarPada: null } }))}>Batalkan</button>} <button className="btn kecil" onClick={() => confirm('Hapus cicilan ini?') && jalankan(() => api(`/api/circle/orders/${d.id}/termin/${t.id}`, { method: 'DELETE' }))}>Hapus</button></td></tr>
        })}</tbody></table>}
      {/* Dua jalur (12 Nov 2026, masukan tim): ① tanpa invoice (lunas penuh langsung / catat manual) · ② dengan invoice (DP/Cicilan/Pelunasan → cetak → Sudah dibayar) */}
      <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
        <b>① Tanpa invoice</b> <span className="redup kecil">klien langsung bayar</span>
        {d.uang.sisaTagihan > 0 && <div className="toolbar" style={{ marginTop: 6 }}><button type="button" className="btn kecil utama" onClick={() => confirm(`Catat LUNAS PENUH: pelunasan ${rp(d.uang.sisaTagihan)} diterima hari ini?`) && jalankan(() => api(`/api/circle/orders/${d.id}/termin`, { method: 'POST', body: { label: 'Pelunasan', jumlah: Math.round(d.uang.sisaTagihan), dibayarPada: hariIniWib } }))}>✓ Lunas penuh</button><span className="redup kecil">Klien langsung bayar penuh? Satu klik — tak perlu mengisi cicilan.</span></div>}
        <details style={{ marginTop: 6 }}><summary className="redup kecil" style={{ cursor: 'pointer' }}>Catat DP / cicilan tanpa invoice…</summary>
      <form className="toolbar" style={{ marginTop: 8 }} onSubmit={e => { e.preventDefault(); jalankan(async () => { await api(`/api/circle/orders/${d.id}/termin`, { method: 'POST', body: { label: labelFinal, jumlah: angka, ...(f.diterima ? { dibayarPada: f.tanggal || hariIniWib } : { jatuhTempo: f.tanggal || undefined }) } }); setF({ label: f.label === 'Pelunasan' ? 'Pelunasan' : '__cicilan', lainnya: '', jumlah: '', tanggal: hariIniWib, diterima: true }) }) }}>
        <select style={{ width: 'auto' }} value={f.label} onChange={e => setF({ ...f, label: e.target.value })} title="Jenis pembayaran">
          <option value="DP">DP</option>
          <option value="__cicilan">Cicilan {sudahCicilan + 1}</option>
          <option value="Pelunasan">Pelunasan</option>
          <option value="__lain">Lainnya (ketik nama)…</option>
        </select>
        {f.label === '__lain' && <input style={{ width: 150 }} placeholder="nama pembayaran" value={f.lainnya} onChange={e => setF({ ...f, lainnya: e.target.value })} maxLength={60} required />}
        <div style={{ minWidth: 190 }}><InputRupiah value={f.jumlah} onChange={v => setF({ ...f, jumlah: v })} placeholder="Jumlah diterima (Rp)" required /></div>
        {d.uang.sisaTagihan > 0 && <button type="button" className="btn kecil" title="Isi jumlah dengan sisa tagihan" onClick={() => setF({ ...f, jumlah: 'Rp ' + Math.round(d.uang.sisaTagihan).toLocaleString('id-ID') })}>= sisa {rp(d.uang.sisaTagihan)}</button>}
        <select style={{ width: 'auto' }} value={f.diterima ? '1' : '0'} onChange={e => setF({ ...f, diterima: e.target.value === '1' })} title="Uangnya sudah masuk?"><option value="1">sudah diterima tgl</option><option value="0">belum, jatuh tempo tgl</option></select>
        <input style={{ width: 150 }} type="date" value={f.tanggal} onChange={e => setF({ ...f, tanggal: e.target.value })} title={f.diterima ? 'Tanggal uang diterima' : 'Jatuh tempo (opsional)'} />
        <button className="btn kecil utama" disabled={!angka || !labelFinal}>+ Cicilan</button>
      </form>
        </details>
      </div>
      <InvoiceOrder d={d} muatOrder={muat} setGalat={setGalat} fokus={fokus} />
      <UangMasuk d={d} muat={muat} setGalat={setGalat} />
      <div className="redup kecil">Cicilan = jumlah yang DITERIMA studio (setelah potongan platform). Isi DP / Cicilan / Pelunasan dengan tanggal uangnya diterima — langsung tercatat dibayar & status bayar order mengikuti otomatis. Pilih "belum, jatuh tempo" hanya untuk cicilan yang masih ditunggu. Tips klien atau uang cair yang berbeda (mis. refund sebagian) diisi di "Uang masuk sebenarnya".</div>
    </div>
  )
}

// Uang masuk sebenarnya (10 Nov 2026, masukan tim): bila uang yang cair beda dari perkiraan (potongan platform tetap, uang masuk kadang lebih/kurang),
// isi di sini — status Lunas lalu mengikuti uang nyata. Kosong = pakai perkiraan nilai bersih.
function UangMasuk({ d, muat, setGalat }) {
  const [v, setV] = useState(d.uang.uangMasukRiil != null ? 'Rp ' + Math.round(d.uang.uangMasukRiil).toLocaleString('id-ID') : '')
  const angka = String(v).replace(/\D/g, '')
  const lama = d.uang.uangMasukRiil != null ? String(Math.round(d.uang.uangMasukRiil)) : ''
  const simpan = async (nilai) => { setGalat(''); try { await api(`/api/circle/orders/${d.id}`, { method: 'PATCH', body: { uangMasukRiil: nilai } }); muat() } catch (e) { setGalat(e.message) } }
  return (
    <div className="isian" style={{ marginTop: 10 }}>
      Uang masuk sebenarnya (setelah potongan platform) <span className="redup kecil">— perkiraan sistem: {rp(d.uang.nilaiBersih)}{d.uang.nilaiBersih != null && d.uang.nilaiKotor != null && d.uang.nilaiKotor > 0 ? ` (${Math.round((1 - d.uang.nilaiBersih / d.uang.nilaiKotor) * 100)}% potongan)` : ''}</span>
      <div className="chips"><div style={{ minWidth: 190 }}><InputRupiah value={v} onChange={setV} placeholder="isi bila uang yang cair beda" /></div>
        <button type="button" className="btn kecil utama" disabled={angka === lama} onClick={() => simpan(angka === '' ? null : Number(angka))}>Simpan</button>
        {d.uang.uangMasukRiil != null && <button type="button" className="btn kecil" onClick={() => { setV(''); simpan(null) }}>Pakai perkiraan lagi</button>}</div>
      <span className="redup kecil">Isi hanya bila uang yang benar-benar cair berbeda dari perkiraan. Status Lunas lalu mengikuti angka ini.</span>
    </div>
  )
}

function PokokToggle({ d, muat, setGalat }) {
  const [buka, setBuka] = useState(false)
  return buka ? <EditPokok d={d} muat={muat} setGalat={setGalat} onSelesai={() => setBuka(false)} /> : <div style={{ marginTop: 10 }}><button className="btn kecil" onClick={() => setBuka(true)}>✎ Ubah order & harga (judul, klien, deadline, akun, nilai)</button>{d.akun && <span className="redup kecil"> · akun {d.akun.platform} · {d.akun.namaAkun}</span>}{d.mataUang?.mataUang === 'USD' && <span className="redup kecil"> · USD {d.mataUang.nilaiUsd} × Rp {Math.round(d.mataUang.kurs).toLocaleString('id-ID')}</span>}</div>
}

function EditPokok({ d, muat, setGalat, onSelesai }) {
  const m = d.mataUang ?? { mataUang: 'IDR' }
  const akunAwal = d.akun?.namaAkun === 'Order Internal' ? 'INTERNAL' : (d.akun?.id ?? '')
  const [f, setF] = useState({ judul: d.judul, klien: d.klien, deadline: d.deadline ? String(d.deadline).slice(0, 10) : '', mataUang: m.mataUang, nilaiUsd: m.nilaiUsd ?? '', kurs: m.kurs ?? '', akunId: akunAwal, marketerId: d.marketer?.id ?? '', nilai: d.uang?.nilaiKotor != null ? 'Rp ' + Math.round(d.uang.nilaiKotor).toLocaleString('id-ID') : '' })
  const [info, setInfo] = useState('')
  const akun = useAkunOrder(d.studioId)
  useKurs(d.studioId, setF) // order Rupiah yang diubah ke USD: kurs terisi dari Laporan Mingguan terbaru
  const simpan = async (e) => { e.preventDefault(); setGalat(''); setInfo(''); try {
    const body = { judul: f.judul, klien: f.klien, deadline: f.deadline || null, mataUang: f.mataUang, ...(f.mataUang === 'USD' ? { nilaiUsd: Number(f.nilaiUsd), kurs: Number(f.kurs) } : {}), ...(d.uang && f.nilai !== '' && Number(String(f.nilai).replace(/\D/g, '')) !== Math.round(d.uang.nilaiKotor ?? -1) ? { nilaiKotor: Number(String(f.nilai).replace(/\D/g, '')) } : {}), ...(f.akunId && f.akunId !== akunAwal ? { akunId: f.akunId } : {}), ...(d.pilihanMarketer && f.marketerId !== (d.marketer?.id ?? '') ? { marketerId: f.marketerId || null } : {}) }
    const x = await api(`/api/circle/orders/${d.id}`, { method: 'PATCH', body }); if (x?.peringatan) setInfo(x.peringatan); else onSelesai(); muat() } catch (er) { setGalat(er.message) } }
  return (
    <form onSubmit={simpan} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <b className="kecil">Ubah data order</b>
      <div className="dua"><label>Judul<input value={f.judul} onChange={e => setF({ ...f, judul: e.target.value })} required maxLength={200} /></label><label>Klien<input value={f.klien} onChange={e => setF({ ...f, klien: e.target.value })} required maxLength={200} /></label>
        <label>Deadline<input type="date" value={f.deadline} onChange={e => setF({ ...f, deadline: e.target.value })} /></label>
        <label>Mata uang<select value={f.mataUang} onChange={e => setF({ ...f, mataUang: e.target.value })}><option value="IDR">Rupiah</option><option value="USD">USD</option></select></label></div>
      {d.uang && <div className="isian">Nilai order / harga kesepakatan (Rp)<InputRupiah value={f.nilai} onChange={v => setF({ ...f, nilai: v })} />
        <span className="redup kecil">Ubah di sini bila harga disepakati ulang. Nilai bersih (setelah potongan platform) &amp; status bayar dihitung ulang otomatis; jumlah termin tidak berubah.</span></div>}
      <PilihAkun akun={akun} value={f.akunId} onChange={v => setF({ ...f, akunId: v })} />
      {f.akunId !== akunAwal && <div className="redup kecil">Ganti akun: nilai bersih dihitung ulang dari fee akun baru, tercatat di audit.</div>}
      {/* Marketer pemegang (18 Nov 2026): pengelola/Admin Market menetapkan/mengganti; tercatat di audit */}
      {d.pilihanMarketer && <label>Marketer pemegang<select value={f.marketerId} onChange={e => setF({ ...f, marketerId: e.target.value })}>
        <option value="">— tanpa pemegang —</option>
        {d.marketer && !d.pilihanMarketer.some(m => m.id === d.marketer.id) && <option value={d.marketer.id}>{d.marketer.nama} (bukan marketer unit lagi)</option>}
        {d.pilihanMarketer.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
      </select><span className="redup kecil">Pemegang mengabari klien (Update klien), mengubah data & cicilan order ini, dan menggeser tahap order freelance.</span></label>}
      {f.mataUang === 'USD' && <div className="chips"><label style={{ margin: 0 }}>Nilai kotor USD<input type="number" min="0" step="0.01" style={{ width: 120 }} value={f.nilaiUsd} onChange={e => setF({ ...f, nilaiUsd: e.target.value })} /></label><label style={{ margin: 0 }}>Kurs (Rp/USD)<input type="number" min="1000" style={{ width: 110 }} value={f.kurs} onChange={e => setF({ ...f, kurs: e.target.value })} /></label></div>}
      {info && <div className="redup kecil" style={{ color: 'var(--red)' }}>{info}</div>}
      <div className="chips" style={{ marginTop: 6 }}><button className="btn kecil utama">Simpan perubahan</button><button type="button" className="btn kecil" onClick={onSelesai}>Tutup</button></div>
    </form>
  )
}

function Audit({ daftar }) {
  if (!daftar?.length) return null
  return (
    <details style={{ marginTop: 10 }}><summary className="kecil"><b>Riwayat perubahan</b> <span className="redup">({daftar.length})</span></summary>
      {daftar.map(a => <div key={a.id} className="redup kecil" style={{ marginTop: 3 }}>{new Date(a.waktu).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · <b>{a.nama}</b> · {a.aksi}{a.field ? ` · ${a.field}` : ''}{a.dari != null || a.ke != null ? `: ${a.dari ?? '∅'} → ${a.ke ?? '∅'}` : ''}</div>)}
    </details>
  )
}

// FOLDER PROYEK (12 Nov 2026, masukan tim): satu folder Google Drive per order (isi: Brief · Update harian & backup · File final) — talent
// selalu update di folder yang sama, jadi admin tidak perlu backup/bank file manual. Disimpan di `tautan[0]`; tautan lama lainnya tetap terlihat.
function FolderProyek({ d, muat, setGalat }) {
  const folder = d.tautan?.[0] ?? '', lain = (d.tautan ?? []).slice(1)
  const [edit, setEdit] = useState(false), [teks, setTeks] = useState(folder)
  const simpan = async () => { setGalat(''); try { await api(`/api/circle/orders/${d.id}/tautan`, { method: 'PUT', body: { tautan: [teks.trim(), ...lain].filter(Boolean) } }); setEdit(false); muat() } catch (e) { setGalat(e.message) } }
  if (!folder && !lain.length && !d.bisaUbahTautan) return null
  return (
    <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--hover-overlay)' }}>
      <b>📁 Folder proyek (Google Drive)</b>
      {!edit ? <div className="toolbar" style={{ marginTop: 6, marginBottom: 0 }}>
        {folder ? <a className="btn kecil utama" href={folder} target="_blank" rel="noreferrer noopener">Buka folder</a> : <span className="redup kecil">Belum ada folder. Admin membuat 1 folder Drive (isi: Brief · Update harian &amp; backup · File final) lalu menempel tautannya di sini.</span>}
        {d.bisaUbahTautan && <button className="btn kecil" onClick={() => { setTeks(folder); setEdit(true) }}>{folder ? 'Ganti tautan' : '+ Tempel tautan folder'}</button>}
      </div> : <div className="toolbar" style={{ marginTop: 6, marginBottom: 0 }}>
        <input style={{ flex: 1, minWidth: 220 }} value={teks} onChange={e => setTeks(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
        <button className="btn kecil" onClick={() => setEdit(false)}>Batal</button><button className="btn kecil utama" onClick={simpan}>Simpan</button>
      </div>}
      {lain.length > 0 && <div className="redup kecil" style={{ marginTop: 6 }}>Tautan lain: {lain.map((t, k) => <a key={t} href={t} target="_blank" rel="noreferrer noopener" style={{ marginRight: 8 }}>tautan {k + 2}</a>)}</div>}
    </div>
  )
}

const LABEL_FL = ' · freelance'
function TimKelola({ d, muat, setGalat }) {
  const freelancer = useFreelancer(d.studioId)
  const [profil, setProfil] = useState({ kategori: d.profil?.kategori ?? '' })
  const jalan = async (fn, selesai) => { setGalat(''); try { await fn(); selesai?.(); muat() } catch (e) { setGalat(e.message) } }
  const belum = (d.anggotaUnit ?? []).filter(a => !d.tim.some(t => t.nama === a.nama))
  const pilihanTim = [...belum.map(a => a.nama), ...freelancer.filter(p => !d.tim.some(t => t.nama === p.nama)).map(p => `${p.nama}${LABEL_FL}`)]
  const tambah = (body) => jalan(() => api(`/api/circle/orders/${d.id}/tim`, { method: 'POST', body }))
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div className="redup kecil" style={{ marginBottom: 6 }}>Talent yang dipilih saat membuat order sudah masuk daftar di atas dan otomatis mendapat tugas begitu order masuk tahap kerja. Untuk menambah orang lain, ketik namanya di kotak di bawah — talent tim (Artist) dan freelance ada di satu kotak. Dua talent bisa bekerja bersamaan (keduanya "semua tahap") atau bergantian (atur lewat tombol <b>tahap</b>). Bila talent tidak melanjutkan, klik <b>⏹ Berhenti</b> lalu tambahkan penggantinya.</div>
      <div className="toolbar">
        {/* Satu kotak cari untuk talent tim & freelance (12 Nov 2026, permintaan tim): ketik nama → pilih → langsung ditugaskan */}
        <div style={{ width: 280 }}><PilihCari pilihan={pilihanTim} placeholder="+ tambah talent / freelance — ketik nama…" kosong="Tidak ada nama yang cocok"
          onPilih={(label) => { const t = belum.find(a => a.nama === label), f = freelancer.find(p => `${p.nama}${LABEL_FL}` === label); if (t) tambah({ userId: t.id }); else if (f) tambah({ namaFreelance: f.nama }) }}
          aksiBaru={{ label: '+ Freelance baru (nama yang diketik)', onPilih: (q) => { if (q) tambah({ namaFreelance: q.slice(0, 200) }); else setGalat('Ketik nama freelance dulu') } }} /></div>
      </div>
      <div className="toolbar">
        <div className="isian" style={{ margin: 0 }}>Kategori<PilihKategori studioId={d.studioId} value={profil.kategori} onChange={v => setProfil({ ...profil, kategori: v })} /></div>
        <button className="btn kecil" onClick={() => jalan(() => api(`/api/circle/orders/${d.id}/profil`, { method: 'PATCH', body: { kategori: profil.kategori } }))}>Simpan kategori</button>
        {/* "Selesaikan semua tahap" disembunyikan 12 Nov 2026 (masukan tim): membingungkan — menutup tugas talent tanpa memindah order. Endpoint tetap ada. */}
      </div>
    </div>
  )
}

// PEKERJAAN INTERNAL (20 Nov 2026, masukan tim): porto / persiapan = kerja tanpa klien & uang — bukan order klien. Persiapan yang akhirnya
// dipesan → "Jadikan order klien" (klien, akun, nilai; mulai dihitung order masuk hari itu). Order Rp0 tanpa cicilan bisa ditandai internal.
const NAMA_INTERNAL = { PORTO: 'Porto', PERSIAPAN: 'Persiapan (belum order)' }
function PanelInternal({ d, muat, setGalat }) {
  const [f, setF] = useState(null)
  const akun = useAkunOrder(d.studioId)
  const klienDir = useKlien(d.studioId)
  const kirim = async (body) => { setGalat(''); try { await api(`/api/circle/orders/${d.id}`, { method: 'PATCH', body }); setF(null); muat() } catch (e) { setGalat(e.message) } }
  if (d.pekerjaanInternal) return (
    <div className="panel" style={{ borderLeft: '4px solid var(--accent)', marginBottom: 12 }}>
      <b>🏠 Pekerjaan internal — {NAMA_INTERNAL[d.pekerjaanInternal]}.</b> <span className="redup">Tetap di Produksi &amp; antrean talent, tetapi bukan order klien: tidak dihitung omset, order masuk, maupun laporan ke grup.</span>
      {d.bisaKelola && !f && <div style={{ marginTop: 6 }}><button className="btn kecil utama" onClick={() => setF({ klien: '', akunId: '', nilai: '' })}>Jadikan order klien</button> <span className="redup kecil">— klien akhirnya memesan pekerjaan ini</span></div>}
      {f && <form style={{ marginTop: 8 }} onSubmit={e => { e.preventDefault(); kirim({ pekerjaanInternal: null, klien: f.klien, akunId: f.akunId, nilaiKotor: Number(String(f.nilai ?? '').replace(/\D/g, '')) || 0 }) }}>
        <div className="dua"><label>Klien<input list="klien-jadi-order" value={f.klien} onChange={e => setF({ ...f, klien: e.target.value })} required /><datalist id="klien-jadi-order">{klienDir.map(k => <option key={k.id} value={k.nama} />)}</datalist></label>
          <label>Nilai disepakati (Rp)<InputRupiah value={f.nilai} onChange={v => setF({ ...f, nilai: v })} /></label></div>
        <PilihAkun akun={akun} value={f.akunId} onChange={v => setF({ ...f, akunId: v })} />
        <div className="redup kecil" style={{ marginBottom: 6 }}>Mulai hari ini dihitung sebagai order masuk (omset, laporan & kabar "New Order" ke grup).</div>
        <button className="btn kecil utama" disabled={!f.akunId}>Simpan jadi order klien</button> <button type="button" className="btn kecil" onClick={() => setF(null)}>Batal</button>
      </form>}
    </div>)
  // order klien bernilai 0 & tanpa cicilan → boleh ditandai sebagai pekerjaan internal (mis. porto yang terlanjur dicatat sebagai order)
  if (d.bisaKelola && d.status !== 'BATAL' && (d.uang?.nilaiKotor ?? 0) === 0 && !(d.termin ?? []).length) return (
    <div className="redup kecil" style={{ marginBottom: 10 }}>Order ini bernilai Rp0. Bukan pesanan klien? Tandai sebagai pekerjaan internal:{' '}
      <a href="#" onClick={e => { e.preventDefault(); confirm('Tandai sebagai Porto? Order ini tidak lagi dihitung sebagai order klien.') && kirim({ pekerjaanInternal: 'PORTO' }) }}>Porto</a> ·{' '}
      <a href="#" onClick={e => { e.preventDefault(); confirm('Tandai sebagai Persiapan (belum order)? Bisa dijadikan order klien nanti.') && kirim({ pekerjaanInternal: 'PERSIAPAN' }) }}>Persiapan</a></div>)
  return null
}
// BUKA KEMBALI UNTUK REVISI (20 Nov 2026, masukan tim): klien sudah complete lalu minta revisi → order YANG SAMA dibuka kembali (juga dari
// arsip Order selesai). Omset tetap terhitung sekali (dari tanggal masuk); Revisi klien menambah hitungan revisi.
function BukaRevisi({ d, muat, setGalat }) {
  const bawaan = d.tahapBuka.find(t => t.jenis === 'REVISI_KLIEN') ?? d.tahapBuka[0]
  const [ke, setKe] = useState(bawaan?.id ?? '')
  if (!d.tahapBuka.length) return null
  const buka = async () => {
    const t = d.tahapBuka.find(x => x.id === ke); if (!t || !confirm(`Buka kembali "${d.judul}" ke ${t.nama}?\n\nOrder yang sama — omset tidak dihitung ulang. Tanggal selesainya dikosongkan dan diisi lagi saat Done.`)) return
    setGalat(''); try { await api(`/api/circle/orders/${d.id}/tahap`, { method: 'PATCH', body: { tahapId: ke } }); muat() } catch (e) { setGalat(e.message) }
  }
  return (
    <div className="panel" style={{ marginBottom: 12 }}><b>Klien minta revisi setelah selesai?</b> <span className="redup kecil">Buka kembali order ini — jangan buat kartu baru supaya omset tidak dobel.</span>
      <div className="chips" style={{ marginTop: 6 }}><select value={ke} onChange={e => setKe(e.target.value)} style={{ width: 'auto' }}>{d.tahapBuka.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}</select><button className="btn kecil utama" onClick={buka}>↺ Buka kembali untuk revisi</button></div>
    </div>)
}

export default function DetailOrder({ orderId, onTutup, fokus }) {
  const [d, setD] = useState(null)
  const [galat, setGalat] = useState('')
  const [catatan, setCatatan] = useState('')
  // Tab (12 Nov 2026, masukan tim): tombol Ubah → Data order; tombol Invoice → Pembayaran & invoice; dibuka dari tempat lain → Semua
  const [tab, setTab] = useState(fokus === 'invoice' ? 'bayar' : fokus === 'ubah' ? 'data' : 'semua')
  const internal = !!d?.pekerjaanInternal // pekerjaan internal (porto / persiapan): tanpa uang → tanpa tab Pembayaran & invoice
  const lihatData = tab !== 'bayar' || internal, lihatBayar = tab !== 'data' && !internal
  const muat = useCallback(() => api(`/api/circle/orders/${orderId}/detail`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [orderId])
  useEffect(() => { muat() }, [muat])
  async function kirimCatatan(e) { e.preventDefault(); setGalat(''); try { await api(`/api/circle/orders/${orderId}/catatan`, { method: 'POST', body: { isi: catatan } }); setCatatan(''); muat() } catch (er) { setGalat(er.message) } }
  // Batalkan (pengelola / marketer pemegang) & pulihkan (pengelola) — 9 Nov 2026
  async function batalkan() { if (!confirm('Apakah yakin akan menghapus order ini?')) return; setGalat(''); try { await api(`/api/circle/orders/${orderId}/batal`, { method: 'POST', body: {} }); alert('Order dihapus.'); onTutup() } catch (er) { setGalat(er.message); alert('Order belum bisa dihapus: ' + er.message) } } // alert: tombol ada di bawah, galat di atas tak terlihat; cukup konfirmasi (10 Nov 2026, masukan tim)
  // Cancel klien (10 Nov 2026, masukan tim): klien batal tetapi pekerjaan sudah jalan — order ditutup, tetap dihitung, ditandai Cancel
  async function cancelKlien() { const alasan = window.prompt('Alasan klien membatalkan order ini?'); if (!alasan?.trim()) return; const n = window.prompt('Nilai riil yang tetap dibayar klien (Rp).\n• Kosongkan bila nilai order tidak berubah\n• Isi 0 bila klien tidak membayar apa pun — invoice order ini yang belum dibayar ikut dibatalkan\n• Isi sebagian untuk partial refund', ''); if (n === null) return; const angka = String(n).replace(/[^\d]/g, ''); setGalat(''); try { await api(`/api/circle/orders/${orderId}/cancel-klien`, { method: 'POST', body: { alasan, nilaiRiil: angka === '' ? undefined : Number(angka) } }); alert('Order ditutup sebagai Cancel klien.'); muat() } catch (er) { setGalat(er.message); alert('Order belum bisa di-Cancel: ' + er.message) } }
  async function pulihkan() { if (!confirm('Pulihkan order ini ke papan?')) return; setGalat(''); try { await api(`/api/circle/orders/${orderId}/pulihkan`, { method: 'POST' }); muat() } catch (er) { setGalat(er.message) } }
  async function hapusCatatan(id) { try { await api(`/api/circle/orders/${orderId}/catatan/${id}`, { method: 'DELETE' }); muat() } catch (er) { setGalat(er.message) } }
  return (
    <div className="modal-latar" onClick={onTutup}>
      <div className="modal lebar" onClick={e => e.stopPropagation()}>
        <div className="baris-atas"><h3 style={{ margin: 0 }}>{d?.judul ?? 'Detail order'}</h3><button className="btn kecil" onClick={onTutup}>Tutup</button></div>
        {galat && <div className="galat blok">{galat}</div>}
        {!d ? (galat ? null : <div className="redup" style={{ padding: 20 }}>Memuat…</div>) : <>
          <div className="meta" style={{ margin: '8px 0 12px' }}>
            <span className="chip">{d.klien}</span>{d.tahap && <span className="tahap-lencana">{d.tahap.nama}</span>}
            {d.akun && <span className="chip sub">{d.akun.platform} · {d.akun.namaAkun}</span>}
            {d.revisiKe > 0 && <span className="lencana revisi">↺ {d.revisiKe} revisi</span>}
            {d.deadline && <span className="redup">⏱ deadline {tgl(d.deadline)}</span>}
            {d.marketer && <span className="redup">marketer: {d.marketer.nama}</span>}
          </div>
          {(d.termin || d.uang) && !internal && <div className="chips" style={{ marginBottom: 10 }}>{[['data', 'Data order'], ['bayar', 'Pembayaran & invoice'], ['semua', 'Semua']].map(([k, l]) => <button key={k} type="button" className={'btn kecil' + (tab === k ? ' utama' : '')} onClick={() => setTab(k)}>{l}</button>)}</div>}
          {d.cancelKlien && <div className="panel" style={{ borderLeft: '4px solid var(--red)', marginBottom: 12 }}><b>Cancel klien.</b> <span className="redup">Pekerjaan yang sudah jalan tetap dihitung. Alasan: {d.alasanCancel}</span></div>}
          {d.status === 'BATAL' && <div className="panel" style={{ borderLeft: '4px solid var(--red)', marginBottom: 12 }}><b>Order ini dihapus.</b> <span className="redup">Tidak tampil di papan dan tidak dihitung.</span>{d.bisaKelola && <> <button className="btn kecil" onClick={pulihkan}>Pulihkan</button></>}</div>}
          <PanelInternal d={d} muat={muat} setGalat={setGalat} />
          {d.tahapBuka?.length > 0 && d.bisaKelola && <BukaRevisi key={d.status} d={d} muat={muat} setGalat={setGalat} />}
          {d.catatan && <p className="redup" style={{ marginBottom: 10 }}>{d.catatan}</p>}
          {/* Urutan (12 Nov 2026, masukan tim): Ubah order & harga dulu, lalu Tim + tambah talent */}
          {lihatData && d.bisaUbahOrder && <div className="panel" style={{ marginBottom: 12 }}><PokokToggle d={d} muat={muat} setGalat={setGalat} /></div>}
          {lihatData && <div className="panel" style={{ marginBottom: 12 }}>
            <h4 className="judul-bagian">Talent</h4>{/* "Talent", bukan "Tim" (13 Nov 2026, masukan tim): yang mengerjakan belum tentu tim sendiri */}
            {d.tim.length === 0 ? <div className="redup kecil">Belum ada yang ditugaskan.</div> : d.tim.map(t => <div key={t.id} className={'meta' + (t.berhentiPada ? ' redup' : '')}><b>{t.nama}</b>{t.berhentiPada && <span className="lencana" title={t.alasanBerhenti ?? ''}>⏹ berhenti {new Date(t.berhentiPada).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}{t.alasanBerhenti ? ` · ${t.alasanBerhenti}` : ''}</span>}{t.peran && <span className="chip sub">{t.peran}</span>}{t.eksternal && <span className="lencana">freelancer</span>}{d.timFee && <span className="redup">fee {rp(d.timFee.find(x => x.id === t.id)?.feeTalent)}</span>}{d.bisaKelola && !t.eksternal && !t.berhentiPada && (d.tahapKerja?.length ?? 0) > 1 && <TahapTim d={d} t={t} muat={muat} setGalat={setGalat} />}{d.bisaKelola && d.timFee && <button className="btn kecil" title="Isi / ubah fee talent di order ini" onClick={() => { const lama = d.timFee.find(x => x.id === t.id)?.feeTalent; const n = prompt(`Fee untuk ${t.nama} di order ini (Rp, kosongkan untuk menghapus fee):`, lama ?? ''); if (n === null) return; const angka = String(n).replace(/[^\d]/g, ''); api(`/api/circle/orders/${d.id}/tim/${t.id}`, { method: 'PATCH', body: { feeTalent: angka === '' ? null : Number(angka) } }).then(muat).catch(e => setGalat(e.message)) }}>ubah fee</button>}{d.bisaKelola && !t.berhentiPada && <button className="btn kecil" title="Talent tidak melanjutkan: keluar dari antrean & tidak menerima tahap berikutnya; nama, fee & riwayat tetap tercatat" onClick={() => { const alasan = prompt(`${t.nama} berhenti dari order ini?\n\nTugasnya yang sedang berjalan ditutup (tidak dihitung selesai) dan ia tidak menerima tahap berikutnya. Nama, fee, dan riwayatnya tetap tercatat. Tambahkan talent pengganti lewat kotak di bawah.\n\nAlasan (opsional):`, ''); if (alasan === null) return; api(`/api/circle/orders/${d.id}/tim/${t.id}/berhenti`, { method: 'POST', body: { alasan } }).then(muat).catch(e => setGalat(e.message)) }}>⏹ Berhenti</button>}{d.bisaKelola && t.berhentiPada && <button className="btn kecil" title="Kembalikan talent ini ke order" onClick={() => api(`/api/circle/orders/${d.id}/tim/${t.id}/aktifkan`, { method: 'POST' }).then(muat).catch(e => setGalat(e.message))}>Aktifkan lagi</button>}{d.bisaKelola && <button className="btn kecil" title={t.eksternal ? 'Hapus freelance dari tim order (salah input)' : 'Hapus dari tim order (salah input)'} onClick={() => confirm(`Hapus ${t.nama} dari order ini? Pakai ini hanya untuk salah input — fee & riwayatnya ikut terhapus.\nKalau ia berhenti di tengah jalan, pakai "⏹ Berhenti".`) && api(`/api/circle/orders/${d.id}/tim/${t.id}`, { method: 'DELETE' }).then(muat).catch(e => setGalat(e.message))}>✕</button>}</div>)}
            {d.bisaKelola && <TimKelola key={d.profil?.kategori ?? ''} d={d} muat={muat} setGalat={setGalat} />}
            <Audit daftar={d.audit} />
          </div>}
          {lihatData && <IsianKhusus d={d} muat={muat} setGalat={setGalat} />}
          {lihatData && <Item d={d} muat={muat} setGalat={setGalat} />}
          {lihatBayar && d.termin && <Termin d={d} muat={muat} setGalat={setGalat} fokus={fokus === 'invoice' && tab === 'bayar'} />}
          {lihatBayar && !d.termin && d.uang && <div className="panel" style={{ marginBottom: 12 }}><h4 className="judul-bagian">Nilai order (milikmu)</h4><div className="ringkasan"><div className="stat"><span className="redup kecil">Nilai bersih</span><b>{rp(d.uang.nilaiBersih)}</b></div><div className="stat"><span className="redup kecil">Diterima</span><b>{rp(d.uang.diterima)}</b></div><div className="stat"><span className="redup kecil">Sisa</span><b>{rp(d.uang.sisaTagihan)}</b></div></div></div>}
          {lihatData && <><div className="panel" style={{ marginBottom: 12 }}>
            <h4 className="judul-bagian">Riwayat tahap</h4>
            {d.riwayat.length === 0 ? <div className="redup kecil">Belum ada riwayat (order lama).</div> : <table><tbody>{d.riwayat.map((r, i) => <tr key={i}><td><b>{r.nama}</b></td><td className="redup">{tglJam(r.mulai)}</td><td className="redup">{r.selesai ? '→ ' + tglJam(r.selesai) : <span className="chip">berjalan</span>}</td><td className="redup kecil">{r.oleh ?? ''}</td></tr>)}</tbody></table>}
          </div>
          <div className="panel">
            <h4 className="judul-bagian">Catatan proyek</h4>
            <FolderProyek key={(d.tautan ?? []).join('|')} d={d} muat={muat} setGalat={setGalat} />
            <form className="toolbar" onSubmit={kirimCatatan}><input style={{ flex: 1 }} placeholder="Tulis update (progres harian, arahan klien, revisi, dll.)" value={catatan} onChange={e => setCatatan(e.target.value)} maxLength={1000} /><button className="btn kecil utama" disabled={!catatan.trim()}>Kirim</button></form>
            {d.catatanProyek.length === 0 ? <div className="redup kecil">Belum ada catatan.</div> : d.catatanProyek.map(c => <div key={c.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}><div className="redup kecil">{c.nama} · {tglJam(c.createdAt)} {(c.milikku || d.bisaKelola) && <button className="btn kecil" onClick={() => hapusCatatan(c.id)}>hapus</button>}</div><div>{c.isi}</div></div>)}
          </div>
          </>}
          {lihatData && d.bisaUbahOrder && !['BATAL', 'SELESAI'].includes(d.status) && <div style={{ textAlign: 'right' }}>{!internal && <button className="btn kecil" style={{ marginRight: 8 }} onClick={cancelKlien} title="Klien batal tetapi pekerjaan sudah dikerjakan: order ditutup & tetap dihitung (beda dengan Hapus order)">Klien batal (Cancel)</button>}<button className="btn kecil bahaya" onClick={batalkan} title="Untuk order salah input atau uji coba. Tidak bisa bila sudah ada termin dibayar. Masih bisa dipulihkan lewat daftar order dihapus.">Hapus order</button></div>}
        </>}
      </div>
    </div>
  )
}
