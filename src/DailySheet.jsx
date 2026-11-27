import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { hariIniLokal, NAMA_BULAN, bulanSekarang, geserBulan } from './api-util'
import { formatRp } from './format'
import { useSegarkan } from './realtime'
import Freelancer from './Freelancer'

// DAILY SHEET (Karsa Circle, 27 Nov 2026, pola sheet harian Mas Zakin): satu layar kerja harian studio.
// Tab: Inbox & Order Progress · Lempar Kerjaan · Database Freelance. Angka dihitung otomatis dari catatan.
// Order disimpan sebagai order biasa, jadi Progres Omset, Leaderboard, Gaji, dan Bayar freelance ikut membacanya.
const A = '/api/circle/daily-sheet'
const usd = (n) => '$' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })
const tgl = (t) => (t ? new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }) : '—')
const kunciBulan = ({ bulan, tahun }) => `${tahun}-${String(bulan).padStart(2, '0')}`
const LABEL_PROGRES = { WAITLIST: 'Waitlist', WIP: 'WIP', REVISI: 'Revisi', DONE: 'Done' }
const ARTI_PROGRES = { WAITLIST: 'antre, belum mulai', WIP: 'sedang dikerjakan', REVISI: 'klien minta revisi', DONE: 'selesai' }
const KELAS_PROGRES = { WAITLIST: '', WIP: 'bayar-dp', REVISI: 'revisi', DONE: 'bayar-lunas' }
const LABEL_INBOX = { TANYA: 'Tanya-tanya', DEAL: 'Deal', BATAL: 'Batal' }
const WARNA = ['var(--accent)', 'var(--pink)', 'var(--amber)', 'var(--cyan)', 'var(--green)', 'var(--text-muted)']
// Minggu ke berapa dalam bulan (W1 = tanggal 1–7, dst.)
const mingguKe = (t) => `W${Math.min(5, Math.ceil(Number(String(new Date(t).toISOString()).slice(8, 10)) / 7))}`

// Tabel yang di HP tampil sebagai kartu (label kolom dari judulnya)
function Tabel({ kolom, children, kosong, jumlah, lebar }) {
  return (
    <div className="ds-gulir">
      <table className="ds-tabel" style={lebar ? { minWidth: lebar } : undefined}>
        <thead><tr>{kolom.map(([k, kanan]) => <th key={k} className={kanan ? 'kanan' : ''}>{k}</th>)}</tr></thead>
        <tbody>{jumlah ? children : <tr><td colSpan={kolom.length} className="redup" style={{ textAlign: 'center', padding: 22 }}>{kosong}</td></tr>}</tbody>
      </table>
    </div>
  )
}
const Sel = ({ l, children, kanan, className = '' }) => <td data-label={l} className={`${kanan ? 'kanan ' : ''}${className}`}><div className="ds-isi">{children}</div></td>

function Batang({ data }) {
  const total = data.reduce((s, x) => s + x.v, 0)
  return (
    <>
      <div className="ds-split">{total > 0 ? data.filter(x => x.v > 0).map((x, i) => <i key={x.k} style={{ width: `${(x.v / total) * 100}%`, background: WARNA[data.indexOf(x) % WARNA.length] }} title={x.k} />) : <i style={{ width: '100%', background: 'var(--track)' }} />}</div>
      <div className="ds-legenda">
        {data.map((x, i) => (
          <div key={x.k}><span><span className="ds-titik" style={{ background: WARNA[i % WARNA.length] }} />{x.k}{x.sub && <small className="redup"> {x.sub}</small>}</span>
            <b>{usd(x.v)} <small className="redup">{total ? Math.round((x.v / total) * 100) : 0}%</small></b></div>
        ))}
      </div>
    </>
  )
}

function TabInbox({ d, studioId, akunPilih, aksi }) {
  const [form, setForm] = useState(null)
  const awalInbox = { tanggal: hariIniLokal(), akunId: akunPilih ?? '', klien: '', produk: '', agreedUsd: '', realUsd: '', status: 'TANYA', jalurBayar: d.pilihan.jalur[0] }
  const awalOrder = { tanggal: hariIniLokal(), akunId: akunPilih ?? '', klien: '', produk: '', executorId: '', talent1Id: '', talent2Id: '', deadline: '', realUsd: '', kurs: String(d.pilihan.kursBawaan), progres: 'WIP', partialUsd: '', tipUsd: '', jalurBayar: d.pilihan.jalur[0], lunas: false }
  const [f, setF] = useState(awalInbox)
  const buka = (jenis) => { setF(jenis === 'inbox' ? awalInbox : awalOrder); setForm(jenis) }
  const ubah = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const saring = (arr) => (akunPilih ? arr.filter(x => x.akunId === akunPilih) : arr)
  const order = saring(d.order), inbox = saring(d.inbox)
  const bulanIni = order.filter(o => o.bulanIni)
  const lunas = bulanIni.filter(o => o.lunas).reduce((s, o) => s + o.realUsd, 0)
  const partial = bulanIni.filter(o => !o.lunas).reduce((s, o) => s + (o.partialUsd || 0), 0)
  const tip = bulanIni.reduce((s, o) => s + (o.tipUsd || 0), 0)
  const total = lunas + partial + tip
  const masukOrder = (o) => (o.lunas ? o.realUsd : o.partialUsd || 0) + (o.tipUsd || 0)
  const rail = d.pilihan.jalur.map(j => ({ k: j, v: bulanIni.filter(o => (o.jalurBayar ?? 'Lainnya') === j).reduce((s, o) => s + masukOrder(o), 0) }))
  const perAkun = d.pilihan.akun.map(a => ({ k: a.nama, sub: a.platform, v: d.order.filter(o => o.bulanIni && o.akunId === a.id).reduce((s, o) => s + masukOrder(o), 0) }))
  const hitungProgres = (arr, p) => arr.filter(o => o.progres === p).length

  const kirim = (e) => {
    e.preventDefault()
    const body = form === 'inbox'
      ? { studioId, ...f, akunId: f.akunId || null }
      : { studioId, ...f, realUsd: Number(f.realUsd), kurs: Number(f.kurs) }
    aksi(() => api(form === 'inbox' ? `${A}/inbox` : `${A}/order`, { method: 'POST', body }), () => setForm(null))
  }
  const ubahOrder = (o, body) => aksi(() => api(`${A}/order/${o.id}`, { method: 'PATCH', body }))
  const angkaBlur = (o, k) => (e) => { const v = e.target.value; if (String(v) !== String(o[k] || '')) ubahOrder(o, { [k]: v === '' ? null : Number(v) }) }
  const rpKira = f.realUsd && f.kurs ? Number(f.realUsd) * Number(f.kurs) : null

  return (
    <>
      <div className="ringkasan">
        <div className="stat"><span className="redup kecil">Uang masuk (lunas)</span><b>{usd(lunas)}</b><span className="ds-arti">order yang sudah dibayar penuh</span></div>
        <div className="stat"><span className="redup kecil">Cicilan / DP</span><b>{usd(partial)}</b><span className="ds-arti">uang muka dari order yang belum lunas</span></div>
        <div className="stat"><span className="redup kecil">Tip / Boost</span><b>{usd(tip)}</b><span className="ds-arti">tambahan dari klien</span></div>
        <div className="stat ds-sorot"><span className="kecil">Total bulan ini</span><b>{usd(total)}</b><span className="ds-arti">jumlah ketiganya</span></div>
        <div className="stat"><span className="redup kecil">Antrean</span><b>{order.filter(o => o.progres !== 'DONE').length}</b><span className="ds-arti">{hitungProgres(order, 'WIP')} WIP · {hitungProgres(order, 'REVISI')} revisi · {hitungProgres(order, 'WAITLIST')} waitlist</span></div>
        <div className="stat"><span className="redup kecil">Done</span><b>{hitungProgres(bulanIni, 'DONE')}</b><span className="ds-arti">order selesai bulan ini</span></div>
      </div>

      <div className="ds-dua">
        <div className="panel"><h3 className="judul-bagian">Jalur bayar <span className="ds-arti">uang masuk lewat mana saja</span></h3><Batang data={rail} /></div>
        <div className="panel"><h3 className="judul-bagian">Porsi tiap akun <span className="ds-arti">akun mana yang paling banyak menghasilkan</span></h3>
          {perAkun.length ? <Batang data={perAkun} /> : <div className="redup">Belum ada akun jualan. Tambahkan di menu Akun jualan.</div>}</div>
      </div>

      <div className="panel" style={{ marginBottom: 14 }}>
        <h3 className="judul-bagian">Order per status <span className="ds-arti">WIP = sedang dikerjakan · Waitlist = antre · Done = selesai</span></h3>
        <div className="empat" style={{ marginBottom: 12 }}>
          {d.pilihan.progres.map(p => <div key={p} className="stat"><span className="kecil"><span className={`lencana ${KELAS_PROGRES[p]}`}>{LABEL_PROGRES[p]}</span></span><b>{hitungProgres(order, p)}</b></div>)}
        </div>
        <Tabel kolom={[['Akun'], ['Waitlist', 1], ['WIP', 1], ['Revisi', 1], ['Done', 1], ['Uang masuk', 1]]} jumlah={d.pilihan.akun.length} kosong="Belum ada akun jualan.">
          {d.pilihan.akun.filter(a => !akunPilih || a.id === akunPilih).map(a => {
            const o = d.order.filter(x => x.akunId === a.id)
            return <tr key={a.id}><Sel l="Akun"><b>{a.nama}</b> <small className="redup">{a.platform}</small></Sel>{d.pilihan.progres.map(p => <Sel key={p} l={LABEL_PROGRES[p]} kanan>{hitungProgres(o, p)}</Sel>)}<Sel l="Uang masuk" kanan>{usd(o.filter(x => x.bulanIni).reduce((s, x) => s + masukOrder(x), 0))}</Sel></tr>
          })}
        </Tabel>
      </div>

      {/* INBOX */}
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="toolbar"><h3 className="judul-bagian" style={{ margin: 0 }}>Inbox <span className="ds-arti">chat masuk dari calon klien · W1 = minggu ke-1</span></h3>
          {d.bolehUbah && form !== 'inbox' && <button className="btn utama" style={{ marginLeft: 'auto' }} onClick={() => buka('inbox')}>+ Tambah inbox</button>}</div>
        {form === 'inbox' && (
          <form className="ds-form" onSubmit={kirim}>
            <div className="dua">
              <label>Tanggal chat<input type="date" value={f.tanggal} onChange={ubah('tanggal')} required /></label>
              <label>Akun jualan<select value={f.akunId} onChange={ubah('akunId')}><option value="">— tanpa akun —</option>{d.pilihan.akun.map(a => <option key={a.id} value={a.id}>{a.nama} · {a.platform}</option>)}</select></label>
              <label>Nama klien<input value={f.klien} onChange={ubah('klien')} required maxLength={200} /></label>
              <label>Produk<input value={f.produk} onChange={ubah('produk')} maxLength={200} placeholder="mis. Chibi full color" /></label>
              <label>Harga yang disepakati ($)<input type="number" min="0" step="0.01" value={f.agreedUsd} onChange={ubah('agreedUsd')} /></label>
              <label>Yang benar-benar dibayar ($)<input type="number" min="0" step="0.01" value={f.realUsd} onChange={ubah('realUsd')} /></label>
              <label>Status<select value={f.status} onChange={ubah('status')}>{d.pilihan.statusInbox.map(s => <option key={s} value={s}>{LABEL_INBOX[s]}</option>)}</select></label>
              <label>Jalur bayar<select value={f.jalurBayar} onChange={ubah('jalurBayar')}>{d.pilihan.jalur.map(j => <option key={j}>{j}</option>)}</select></label>
            </div>
            <div className="modal-aksi"><button type="button" className="btn" onClick={() => setForm(null)}>Batal</button><button className="btn utama">Simpan</button></div>
          </form>
        )}
        <Tabel kolom={[['Minggu'], ['Akun'], ['Klien'], ['Produk'], ['Disepakati', 1], ['Dibayar', 1], ['Status'], ['Jalur bayar'], ...(d.bolehUbah ? [['']] : [])]} jumlah={inbox.length} kosong='Belum ada inbox bulan ini. Klik "+ Tambah inbox" untuk mencatat chat masuk.'>
          {inbox.map(x => (
            <tr key={x.id}>
              <Sel l="Minggu">{mingguKe(x.tanggal)} <small className="redup">{tgl(x.tanggal)}</small></Sel><Sel l="Akun">{x.akun}</Sel><Sel l="Klien">{x.klien}</Sel><Sel l="Produk">{x.produk ?? '—'}</Sel>
              <Sel l="Disepakati" kanan>{x.agreedUsd == null ? '—' : usd(x.agreedUsd)}</Sel><Sel l="Dibayar" kanan>{x.realUsd == null ? '—' : usd(x.realUsd)}</Sel>
              <Sel l="Status">{d.bolehUbah
                ? <select value={x.status} onChange={e => aksi(() => api(`${A}/inbox/${x.id}`, { method: 'PATCH', body: { status: e.target.value } }))}>{d.pilihan.statusInbox.map(s => <option key={s} value={s}>{LABEL_INBOX[s]}</option>)}</select>
                : LABEL_INBOX[x.status]}</Sel>
              <Sel l="Jalur bayar">{x.jalurBayar ?? '—'}</Sel>
              {d.bolehUbah && <Sel l=""><button className="btn kecil" onClick={() => { if (window.confirm(`Hapus inbox ${x.klien}?`)) aksi(() => api(`${A}/inbox/${x.id}`, { method: 'DELETE' })) }}>Hapus</button></Sel>}
            </tr>
          ))}
        </Tabel>
      </div>

      {/* ORDER */}
      <div className="panel">
        <div className="toolbar"><h3 className="judul-bagian" style={{ margin: 0 }}>Order <span className="ds-arti">order bulan ini dan order bulan lalu yang belum selesai</span></h3>
          {d.bolehUbah && form !== 'order' && <button className="btn utama" style={{ marginLeft: 'auto' }} onClick={() => buka('order')}>+ Tambah order</button>}</div>
        {form === 'order' && (
          <form className="ds-form" onSubmit={kirim}>
            <div className="dua">
              <label>Tanggal masuk<input type="date" value={f.tanggal} onChange={ubah('tanggal')} required /></label>
              <label>Akun jualan<select value={f.akunId} onChange={ubah('akunId')} required><option value="">— pilih —</option>{d.pilihan.akun.map(a => <option key={a.id} value={a.id}>{a.nama} · {a.platform}</option>)}<option value="INTERNAL">Order internal (tanpa platform)</option></select></label>
              <label>Nama klien<input value={f.klien} onChange={ubah('klien')} required maxLength={200} /></label>
              <label>Produk / jasa<input value={f.produk} onChange={ubah('produk')} required maxLength={200} placeholder="mis. Chibi full color" /></label>
              <label>Executor (admin pemegang order)<select value={f.executorId} onChange={ubah('executorId')}><option value="">—</option>{d.pilihan.anggota.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}</select></label>
              <label>Talent 1 (yang mengerjakan)<select value={f.talent1Id} onChange={ubah('talent1Id')} required><option value="">— pilih —</option>{d.pilihan.anggota.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}</select></label>
              <label>Talent 2 (opsional)<select value={f.talent2Id} onChange={ubah('talent2Id')}><option value="">—</option>{d.pilihan.anggota.filter(a => a.id !== f.talent1Id).map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}</select></label>
              <label>Deadline<input type="date" value={f.deadline} onChange={ubah('deadline')} /></label>
              <label>Nilai order ($)<input type="number" min="0.01" step="0.01" value={f.realUsd} onChange={ubah('realUsd')} required /></label>
              <label>Kurs (Rp per 1 USD)<input type="number" min="1000" max="100000" step="1" value={f.kurs} onChange={ubah('kurs')} required /></label>
              <label>Status<select value={f.progres} onChange={ubah('progres')}>{d.pilihan.progres.map(p => <option key={p} value={p}>{LABEL_PROGRES[p]} ({ARTI_PROGRES[p]})</option>)}</select></label>
              <label>Jalur bayar<select value={f.jalurBayar} onChange={ubah('jalurBayar')}>{d.pilihan.jalur.map(j => <option key={j}>{j}</option>)}</select></label>
              <label>Cicilan / DP yang sudah masuk ($)<input type="number" min="0" step="0.01" value={f.partialUsd} onChange={ubah('partialUsd')} /></label>
              <label>Tip / boost ($)<input type="number" min="0" step="0.01" value={f.tipUsd} onChange={ubah('tipUsd')} /></label>
            </div>
            <label className="ds-centang"><input type="checkbox" checked={f.lunas} onChange={ubah('lunas')} /> Klien sudah bayar lunas</label>
            <div className="redup kecil">{rpKira ? `≈ ${formatRp(rpKira)}. ` : ''}Kurs dipakai untuk gaji dan laporan dalam Rupiah; isian bawaan = kurs order terakhir.</div>
            <div className="modal-aksi"><button type="button" className="btn" onClick={() => setForm(null)}>Batal</button><button className="btn utama">Simpan</button></div>
          </form>
        )}
        <Tabel kolom={[['Klien & produk'], ['Akun'], ['Executor'], ['Talent'], ['Deadline'], ['Nilai', 1], ['Status'], ['DP ($)', 1], ['Tip ($)', 1], ['Bayar']]} lebar={1040} jumlah={order.length} kosong='Belum ada order. Klik "+ Tambah order".'>
          {order.map(o => (
            <tr key={o.id}>
              <Sel l="Klien & produk"><b>{o.klien}</b><div className="redup kecil">{o.produk} · {tgl(o.tanggal)}</div></Sel>
              <Sel l="Akun">{o.akun}</Sel>
              <Sel l="Executor">{d.bolehUbah
                ? <select value={o.executorId ?? ''} onChange={e => ubahOrder(o, { executorId: e.target.value || null })}><option value="">—</option>{d.pilihan.anggota.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}</select>
                : (o.executor ?? '—')}</Sel>
              <Sel l="Talent">{o.talent.map(t => t.nama).join(' & ') || '—'}</Sel>
              <Sel l="Deadline">{d.bolehUbah ? <input type="date" value={o.deadline ? String(o.deadline).slice(0, 10) : ''} onChange={e => ubahOrder(o, { deadline: e.target.value || null })} /> : tgl(o.deadline)}</Sel>
              <Sel l="Nilai" kanan>{usd(o.realUsd)}<div className="redup kecil">{formatRp(o.nilaiRp)}</div></Sel>
              <Sel l="Status">{d.bolehUbah
                ? <select value={o.progres} onChange={e => ubahOrder(o, { progres: e.target.value })}>{d.pilihan.progres.map(p => <option key={p} value={p}>{LABEL_PROGRES[p]}</option>)}</select>
                : <span className={`lencana ${KELAS_PROGRES[o.progres]}`}>{LABEL_PROGRES[o.progres]}</span>}</Sel>
              <Sel l="DP ($)" kanan>{d.bolehUbah ? <input className="ds-angka" type="number" min="0" step="0.01" defaultValue={o.partialUsd || ''} onBlur={angkaBlur(o, 'partialUsd')} /> : usd(o.partialUsd)}</Sel>
              <Sel l="Tip ($)" kanan>{d.bolehUbah ? <input className="ds-angka" type="number" min="0" step="0.01" defaultValue={o.tipUsd || ''} onBlur={angkaBlur(o, 'tipUsd')} /> : usd(o.tipUsd)}</Sel>
              <Sel l="Bayar">{d.bolehUbah
                ? <button className={`btn kecil ${o.lunas ? 'ds-lunas' : ''}`} onClick={() => ubahOrder(o, { lunas: !o.lunas })} title="Klik untuk mengubah">{o.lunas ? '✓ Lunas' : 'Belum lunas'}</button>
                : (o.lunas ? '✓ Lunas' : 'Belum lunas')}
                {d.bolehUbah && <select className="ds-jalur" value={o.jalurBayar ?? ''} onChange={e => ubahOrder(o, { jalurBayar: e.target.value || null })} aria-label="Jalur bayar"><option value="">jalur bayar…</option>{d.pilihan.jalur.map(j => <option key={j}>{j}</option>)}</select>}</Sel>
            </tr>
          ))}
        </Tabel>
      </div>
    </>
  )
}

function TabLempar({ d, studioId, akunPilih, aksi, pindah }) {
  const [form, setForm] = useState(false)
  const [f, setF] = useState({ orderId: '', nama: '', peran: '', fee: '' })
  const [namaFl, setNamaFl] = useState([])
  useEffect(() => { api(`/api/circle/freelancer?studioId=${studioId}`).then(x => setNamaFl((Array.isArray(x) ? x : x?.daftar ?? []).map(t => t.nama).filter(Boolean))).catch(() => {}) }, [studioId])
  const order = (akunPilih ? d.order.filter(o => o.akunId === akunPilih) : d.order)
  const brief = order.flatMap(o => o.freelance.map(fl => ({ ...fl, order: o })))
  const fee = (arr) => arr.reduce((s, x) => s + (x.fee || 0), 0)
  const lunas = brief.filter(x => x.lunas)
  const orderDipilih = order.find(o => o.id === f.orderId)
  const budget = orderDipilih ? orderDipilih.nilaiRp * 0.3 : null

  const simpan = (e) => {
    e.preventDefault()
    aksi(async () => {
      await api(`/api/circle/orders/${f.orderId}/tim`, { method: 'POST', body: { namaFreelance: f.nama.trim(), peran: f.peran || null } })
      if (f.fee !== '') {
        const ulang = await api(`${A}?studioId=${studioId}&bulan=${d.bulanKunci}`)
        const baris = ulang.order.find(o => o.id === f.orderId)?.freelance.find(x => x.nama?.toLowerCase() === f.nama.trim().toLowerCase())
        if (baris) await api(`/api/circle/orders/${f.orderId}/tim/${baris.assignmentId}`, { method: 'PATCH', body: { feeTalent: Number(f.fee) } })
      }
    }, () => { setForm(false); setF({ orderId: '', nama: '', peran: '', fee: '' }) })
  }

  return (
    <>
      <div className="ringkasan">
        <div className="stat"><span className="redup kecil">Kerjaan dilempar</span><b>{brief.length}</b><span className="ds-arti">baris freelance di order</span></div>
        <div className="stat"><span className="redup kecil">Sudah dibayar</span><b>{lunas.length}/{brief.length}</b><span className="ds-arti">{formatRp(fee(lunas))} sudah · {formatRp(fee(brief) - fee(lunas))} belum</span></div>
        <div className="stat"><span className="redup kecil">Jumlah freelancer</span><b>{new Set(brief.map(x => x.nama)).size}</b><span className="ds-arti">orang berbeda</span></div>
      </div>
      <div className="panel">
        <div className="toolbar"><h3 className="judul-bagian" style={{ margin: 0 }}>Lempar kerjaan <span className="ds-arti">maks 3 freelancer per order · fee freelancer sebaiknya maks 30% dari nilai order</span></h3>
          {d.bolehUbah && !form && <button className="btn utama" style={{ marginLeft: 'auto' }} onClick={() => setForm(true)} disabled={!order.length}>+ Lempar kerjaan</button>}</div>
        {form && (
          <form className="ds-form" onSubmit={simpan}>
            <div className="dua">
              <label>Order<select value={f.orderId} onChange={e => setF({ ...f, orderId: e.target.value })} required><option value="">— pilih order —</option>{order.filter(o => o.freelance.length < 3).map(o => <option key={o.id} value={o.id}>{o.klien} · {o.produk} ({o.akun})</option>)}</select></label>
              <label>Nama freelancer<input list="ds-fl" value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} required maxLength={200} /><datalist id="ds-fl">{namaFl.map(n => <option key={n} value={n} />)}</datalist></label>
              <label>Bagian yang dikerjakan<input value={f.peran} onChange={e => setF({ ...f, peran: e.target.value })} maxLength={60} placeholder="mis. coloring, background" /></label>
              <label>Fee yang disepakati (Rp)<input type="number" min="0" step="1000" value={f.fee} onChange={e => setF({ ...f, fee: e.target.value })} /></label>
            </div>
            {budget != null && <div className={`kecil ${f.fee && Number(f.fee) > budget ? 'galat-f' : 'redup'}`}>Batas 30% dari order ini: {formatRp(budget)}{f.fee && Number(f.fee) > budget ? ' — fee melewati 30%!' : ''}</div>}
            <div className="redup kecil">Freelancer baru otomatis masuk Database Freelance. Pembayarannya dicatat di menu Bayar freelance.</div>
            <div className="modal-aksi"><button type="button" className="btn" onClick={() => setForm(false)}>Batal</button><button className="btn utama">Simpan</button></div>
          </form>
        )}
        <Tabel kolom={[['Order'], ['Freelancer'], ['Bagian'], ['Nilai & batas 30%', 1], ['Fee', 1], ['Status bayar']]} jumlah={brief.length} kosong='Belum ada kerjaan yang dilempar. Klik "+ Lempar kerjaan".'>
          {brief.map(x => {
            const bts = x.order.nilaiRp * 0.3, lewat = (x.fee || 0) > bts
            return (
              <tr key={x.assignmentId}>
                <Sel l="Order"><b>{x.order.klien}</b><div className="redup kecil">{x.order.produk} · {x.order.akun}</div></Sel>
                <Sel l="Freelancer">{x.nama}</Sel><Sel l="Bagian">{x.peran ?? '—'}</Sel>
                <Sel l="Nilai & batas 30%" kanan>{usd(x.order.realUsd)}<div className="redup kecil">batas {formatRp(bts)}</div></Sel>
                <Sel l="Fee" kanan>{x.fee == null ? '—' : formatRp(x.fee)}{lewat && <div className="kecil galat-f">lewat 30%!</div>}</Sel>
                <Sel l="Status bayar"><span className={`lencana ${x.lunas ? 'bayar-lunas' : (x.dp ? 'bayar-dp' : 'bayar-belum_lunas')}`}>{x.lunas ? 'Sudah dibayar' : x.dp ? 'DP' : 'Belum dibayar'}</span></Sel>
              </tr>
            )
          })}
        </Tabel>
        {pindah && <div style={{ marginTop: 10 }}><button className="btn kecil" onClick={() => pindah('bayarfreelance')}>Buka Bayar freelance →</button></div>}
      </div>
    </>
  )
}

const TAB = [['inbox', 'Inbox & Order'], ['lempar', 'Lempar Kerjaan'], ['freelance', 'Database Freelance']]
const ARTI_TAB = { inbox: 'Catat chat masuk dan order, lalu lihat pendapatan per akun.', lempar: 'Kerjaan yang dilempar ke freelancer dan status bayarnya.', freelance: 'Daftar freelancer yang pernah atau bisa diajak kerja.' }

export default function DailySheet({ studioId, lingkup, pindah }) {
  const [periode, setPeriode] = useState(bulanSekarang)
  const [tab, setTab] = useState('inbox')
  const [akun, setAkun] = useState(null)
  const [d, setD] = useState(null), [galat, setGalat] = useState('')
  const bulanKunci = kunciBulan(periode)
  const muat = useCallback(() => api(`${A}?studioId=${studioId}&bulan=${bulanKunci}`).then(x => { setD({ ...x, bulanKunci }); setGalat('') }).catch(e => setGalat(e.message)), [studioId, bulanKunci])
  useEffect(() => { muat() }, [muat])
  useSegarkan(muat, ['pemasukan', 'order'])
  const aksi = async (fn, lalu) => { setGalat(''); try { await fn(); lalu?.(); await muat() } catch (e) { setGalat(e.message) } }
  const akunAda = useMemo(() => d?.pilihan.akun ?? [], [d])

  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  return (
    <div>
      <p className="redup" style={{ marginTop: -6 }}>Semua kerja harian studio di satu tempat: chat masuk, order, lempar kerjaan, dan freelancer. Angka terhitung otomatis dari catatan.</p>
      {galat && <div className="galat">{galat}</div>}
      <div className="toolbar">
        <button className="btn kecil" onClick={() => setPeriode(p => geserBulan(p, -1))} aria-label="Bulan sebelumnya">‹</button>
        <b>{NAMA_BULAN[periode.bulan - 1]} {periode.tahun}</b>
        <button className="btn kecil" onClick={() => setPeriode(p => geserBulan(p, 1))} aria-label="Bulan berikutnya">›</button>
      </div>
      <div className="subtab">{TAB.map(([k, l]) => <button key={k} className={tab === k ? 'aktif' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      <p className="ds-arti" style={{ margin: '-6px 0 12px' }}>{ARTI_TAB[tab]}</p>
      {tab !== 'freelance' && akunAda.length > 0 && (
        <div className="chips" style={{ marginBottom: 14 }}>
          <button className={`pilih ${!akun ? 'aktif' : ''}`} onClick={() => setAkun(null)}>Semua akun ({akunAda.length})</button>
          {akunAda.map(a => <button key={a.id} className={`pilih ${akun === a.id ? 'aktif' : ''}`} onClick={() => setAkun(a.id)}>{a.nama} · {a.platform}</button>)}
        </div>
      )}
      {tab === 'inbox' && <TabInbox key={akun ?? 'semua'} d={d} studioId={studioId} akunPilih={akun} aksi={aksi} />}
      {tab === 'lempar' && <TabLempar d={d} studioId={studioId} akunPilih={akun} aksi={aksi} pindah={pindah} />}
      {tab === 'freelance' && <Freelancer studioId={studioId} lingkup={lingkup} />}
    </div>
  )
}
