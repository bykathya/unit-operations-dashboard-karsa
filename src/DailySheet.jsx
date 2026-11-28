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

  const namaAkunPilih = akunPilih ? d.pilihan.akun.find(a => a.id === akunPilih)?.nama : null
  const target = akunPilih ? d.target?.akun?.[akunPilih] ?? null : d.target?.unitUsd ?? null
  const tercapai = target > 0 ? Math.round((total / target) * 100) : 0
  const simpanTarget = (e) => {
    const v = Number(e.target.value || 0); if (v === Number(target || 0)) return
    const t = d.target
    aksi(() => akunPilih
      ? api('/api/circle/penjualan/target', { method: 'PUT', body: { akunId: akunPilih, tahun: t.tahun, bulan: t.bulan, targetUsd: v } })
      : api('/api/circle/kaizen/target', { method: 'PUT', body: { studioId, tahun: t.tahun, bulan: t.bulan, targetUsd: v } }))
  }
  const totalRail = rail.reduce((s, x) => s + x.v, 0), totalAkun = perAkun.reduce((s, x) => s + x.v, 0)
  const WARNA_AKUN = ['var(--accent)', 'var(--pink-candy)', 'var(--kd-kuning)', '#111111', '#ffffff']
  let sudut = 0
  const donat = totalAkun > 0 ? `conic-gradient(${perAkun.map((x, i) => { const a = sudut; sudut += (x.v / totalAkun) * 360; return `${WARNA_AKUN[i % WARNA_AKUN.length]} ${a}deg ${sudut}deg` }).join(', ')})` : 'var(--track)'
  const pipa = [['WIP', 'var(--pink-candy)'], ['REVISI', 'var(--kd-kuning)'], ['WAITLIST', 'var(--bg-card)'], ['DONE', 'var(--accent)']]
  const totalOrder = order.length

  return (
    <>
      <div className="ds-atas">
        <div className="kartu ds-kotak">
          <small className="kosong">Order Auto-Counter · hitungan otomatis</small>
          <h2>{namaAkunPilih ?? 'Semua akun'}{!namaAkunPilih && d.namaStudio ? ` ${d.namaStudio}` : ''}</h2>
          <div className="ds-enam">
            <div><span>Realized Earn (Inbox)<small>uang yang sudah dibayar klien</small></span><b>{usd(lunas)}</b><small>{formatRp(lunas * d.pilihan.kursBawaan)}</small></div>
            <div><span>Boost / Tip<small>tip tambahan dari klien</small></span><b>{usd(tip)}</b><small>{formatRp(tip * d.pilihan.kursBawaan)}</small></div>
            <div><span>Partial (Order Progress)<small>cicilan / DP yang masuk</small></span><b>{usd(partial)}</b><small>{formatRp(partial * d.pilihan.kursBawaan)}</small></div>
            <div className="pink"><span>Milestone Total<small>jumlah ketiganya</small></span><b>{usd(total)}</b><small>{formatRp(total * d.pilihan.kursBawaan)}</small></div>
            <div><span>Queue<small>order yang belum selesai</small></span><b>{order.filter(o => o.progres !== 'DONE').length}</b><small>{hitungProgres(order, 'WIP')} WIP · {hitungProgres(order, 'REVISI')} Rev</small></div>
            <div className="lime"><span>Done<small>order selesai</small></span><b>{hitungProgres(bulanIni, 'DONE')}</b></div>
          </div>
          <div className="ds-target">
            <div className="baris" style={{ justifyContent: 'space-between' }}><b>Target bulanan</b><b>{tercapai}% tercapai</b></div>
            <div className="baris">
              {d.target?.bolehUbah && d.bolehUbah
                ? <input key={`${akunPilih}-${target}`} type="number" min="0" step="1" defaultValue={target ?? ''} placeholder="0" onBlur={simpanTarget} aria-label="Target bulanan (USD)" />
                : <b style={{ fontFamily: 'var(--font-judul)' }}>{target ? usd(target) : '—'}</b>}
              <small className="kosong">$ · {formatRp((target || 0) * d.pilihan.kursBawaan)}</small>
            </div>
            <div className="bar"><i style={{ width: `${Math.min(100, tercapai)}%` }} /></div>
          </div>
        </div>
        <div className="ds-kanan">
          <div className="kartu ds-kotak">
            <div className="baris" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h2>Payment Rail Split</h2><small className="kosong">uang masuk lewat mana saja</small></div><b>{usd(totalRail)}</b></div>
            <div className="ds-rail">{totalRail > 0 ? rail.filter(x => x.v > 0).map((x, i) => <i key={x.k} style={{ width: `${(x.v / totalRail) * 100}%`, background: WARNA_AKUN[rail.indexOf(x) % WARNA_AKUN.length] }} title={x.k} />) : null}</div>
            <div className="ds-rail-k">{rail.map(x => <div key={x.k}><span>{x.k}</span><b>{usd(x.v)}</b><small>{totalRail ? Math.round((x.v / totalRail) * 100) : 0}%</small></div>)}</div>
          </div>
          <div className="kartu ds-kotak">
            <div className="baris" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h2>Account Earnings Contribution</h2><small className="kosong">porsi omset tiap akun</small></div><span className="chip">{perAkun.length} Akun</span></div>
            {perAkun.length ? (
              <div className="ds-donat-w">
                <div className="ds-donat" style={{ background: donat }} />
                <div className="ds-akun-l">{perAkun.map((x, i) => <div key={x.k}><span><i style={{ background: WARNA_AKUN[i % WARNA_AKUN.length] }} />{x.k} <small className="kosong">{x.sub}</small></span><b>{usd(x.v)} <small className="kosong">({totalAkun ? Math.round((x.v / totalAkun) * 100) : 0}%)</small></b></div>)}</div>
              </div>
            ) : <p className="kosong">Belum ada akun jualan. Tambahkan di menu Akun jualan.</p>}
          </div>
        </div>
      </div>

      <div className="kartu ds-kotak">
        <div className="baris" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h2>Order Pipeline &amp; Status</h2><small className="kosong">WIP = sedang dikerjakan · Waitlist = antre · Done = selesai</small></div><span className="chip">{totalOrder} Total Order</span></div>
        <div className="ds-pipa">{pipa.map(([p, w]) => { const n = hitungProgres(order, p); return <div key={p} style={{ background: w }}><span>{LABEL_PROGRES[p]}<small>{totalOrder ? Math.round((n / totalOrder) * 100) : 0}% share</small></span><b>{n}</b></div> })}</div>
        <Tabel kolom={[['Akun'], ['WIP', 1], ['Revisi', 1], ['Waitlist', 1], ['Done', 1], ['Realized Earn', 1]]} jumlah={d.pilihan.akun.length} kosong="Belum ada akun jualan.">
          {d.pilihan.akun.filter(a => !akunPilih || a.id === akunPilih).map((a, i) => {
            const o = d.order.filter(x => x.akunId === a.id)
            return <tr key={a.id}><Sel l="Akun"><span className="ds-titik" style={{ background: WARNA_AKUN[d.pilihan.akun.indexOf(a) % WARNA_AKUN.length], border: '1.5px solid var(--line)' }} /> {a.nama} <small className="redup">{a.platform}</small></Sel>{['WIP', 'REVISI', 'WAITLIST', 'DONE'].map(p => <Sel key={p} l={LABEL_PROGRES[p]} kanan>{hitungProgres(o, p)}</Sel>)}<Sel l="Realized Earn" kanan>{usd(o.filter(x => x.bulanIni).reduce((s, x) => s + masukOrder(x), 0))}</Sel></tr>
          })}
        </Tabel>
      </div>

      {/* INBOX */}
      <div className="kartu ds-kotak">
        <div className="baris" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h2>Inbox Progress (W1–W4)</h2><small className="kosong">Chat masuk dari calon klien per minggu · W1 = minggu ke-1</small></div>
          {d.bolehUbah && form !== 'inbox' && <button className="tombol hitam" onClick={() => buka('inbox')}>+ Tambah Inbox</button>}</div>
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
      <div className="kartu ds-kotak">
        <div className="baris" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h2>Order Progress</h2><small className="kosong">Order bulan ini dan order bulan lalu yang belum selesai</small></div>
          {d.bolehUbah && form !== 'order' && <button className="tombol hitam" onClick={() => buka('order')}>+ Tambah Order</button>}</div>
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


// ── Tab 4: Performa, Bonus & Lembur ──────────────────────────────────────────────────────────────
function Pil({ isi, jenis }) { return <span className={`lencana ${jenis}`}>{isi}</span> }
function TabPerforma({ studioId, bulanKunci }) {
  const [d, setD] = useState(null), [galat, setGalat] = useState(''), [info, setInfo] = useState('')
  const [form, setForm] = useState(false)
  const [lf, setLf] = useState({ userId: '', tanggal: hariIniLokal(), catatan: '', durasiJam: '', fee: '' })
  const [nilai, setNilai] = useState({})
  const muat = useCallback(() => api(`${A}/performa?studioId=${studioId}&bulan=${bulanKunci}`).then(x => { setD(x); setGalat('') }).catch(e => setGalat(e.message)), [studioId, bulanKunci])
  useEffect(() => { muat() }, [muat])
  useSegarkan(muat, ['pemasukan', 'order', 'lembur'])
  const aksi = async (fn, lalu) => { setGalat(''); setInfo(''); try { const r = await fn(); lalu?.(r); await muat() } catch (e) { setGalat(e.message) } }
  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  const dis = !d.bolehUbah
  const simpanSetelan = (k) => (e) => { const v = e.target.value; if (String(v) !== String(d.setelan[k])) aksi(() => api(`${A}/performa`, { method: 'PUT', body: { studioId, bulan: bulanKunci, setelan: { [k]: Number(v) || 0 } } })) }
  const simpanOrang = (o, jenis, k) => (e) => { const v = e.target.value; if (String(v) === String(o[k] ?? '')) return; aksi(() => api(`${A}/performa`, { method: 'PUT', body: { studioId, bulan: bulanKunci, orang: [{ userId: o.userId, jenis, akunId: o.akunId, targetUsd: o.targetUsd, persen: o.persen, [k]: k === 'akunId' ? v || null : Number(v) || 0 }] } })) }
  const tambahAdmin = (userId) => userId && aksi(() => api(`${A}/performa`, { method: 'PUT', body: { studioId, bulan: bulanKunci, orang: [{ userId, jenis: 'ADMIN', targetUsd: 0, persen: 0 }] } }))
  const kirimSlip = () => aksi(() => api(`${A}/performa/slip`, { method: 'POST', body: { studioId, bulan: bulanKunci } }), (r) => setInfo([
    r.masuk.length ? `Masuk slip: ${r.masuk.join(', ')}.` : 'Belum ada slip yang diperbarui.',
    r.belumSlip.length ? ` Belum punya slip bulan ini (klik "Siapkan slip" di Penggajian dulu): ${r.belumSlip.join(', ')}.` : '',
    r.sudahFinal.length ? ` Slip sudah final, tidak diubah: ${r.sudahFinal.join(', ')}.` : '',
  ].join('')))
  const sum = (arr) => arr.reduce((s, a) => s + (Number(a.persen) || 0), 0)
  const Bonus = ({ v }) => (v == null ? <><Pil isi="SEMANGAT" jenis="bayar-dp" /><div className="redup kecil">Rp 0</div></> : <Pil isi={formatRp(v)} jenis="bayar-lunas" />)
  const Komisi = ({ v }) => (v == null ? <Pil isi="KEJAR BONUS DULU YA!" jenis="revisi" /> : <Pil isi={formatRp(v)} jenis="bayar-lunas" />)
  const inAngka = (o, jenis, k, lebar = 90) => <input className="ds-angka" style={{ width: lebar }} type="number" min="0" step="any" defaultValue={o[k] || ''} placeholder="0" disabled={dis} onBlur={simpanOrang(o, jenis, k)} />
  const kursRp = d.setelan.kurs
  const belumAdmin = d.anggota.filter(a => !d.admin.some(x => x.userId === a.id))
  const setujui = (l) => {
    const v = nilai[l.id] ?? (l.nilaiUsulan ?? '')
    aksi(() => api(`/api/circle/lembur/${l.id}/setujui`, { method: 'POST', body: { studioId, nilai: v === '' ? null : Number(v) } }))
  }
  const tolak = (l) => { const alasan = window.prompt('Alasan menolak lembur ini?'); if (alasan) aksi(() => api(`/api/circle/lembur/${l.id}/tolak`, { method: 'POST', body: { studioId, catatan: alasan } })) }
  const kirimLembur = (e) => { e.preventDefault(); aksi(() => api(`${A}/lembur`, { method: 'POST', body: { studioId, ...lf } }), () => { setForm(false); setLf({ userId: '', tanggal: hariIniLokal(), catatan: '', durasiJam: '', fee: '' }) }) }
  const LABEL_LEMBUR = { MENUNGGU: ['Menunggu', 'bayar-dp'], DISETUJUI: ['Disetujui', 'bayar-lunas'], DITOLAK: ['Ditolak', 'bayar-belum_lunas'] }

  return (
    <>
      {galat && <div className="galat">{galat}</div>}
      {info && <div className="ok-info" style={{ marginBottom: 12 }}>{info}</div>}
      {dis && <div className="ok-info" style={{ marginBottom: 12 }}>Mode lihat saja: target, dana bonus, dan komisi hanya bisa diubah Koordinator.</div>}
      <div className="panel" style={{ marginBottom: 14 }}>
        <h3 className="judul-bagian">Cara hitung</h3>
        <div className="ds-rumus">
          <div><Pil isi="BONUS" jenis="bayar-lunas" /> Kalau pendapatan belum sampai target → "SEMANGAT". Kalau sudah sampai → dana bonus × persentase orang itu.</div>
          <div><Pil isi="KOMISI" jenis="revisi" /> (Pendapatan − target) × {d.setelan.komisiPersen}% × kurs. Kalau belum lewat target → "KEJAR BONUS DULU YA!".</div>
          <div className="redup kecil">Pendapatan = uang masuk order bulan ini (lunas, DP, dan tip). Target 0 artinya belum diisi, jadi belum ada bonus.</div>
        </div>
        <div className="isian-sebaris" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
          <label>Komisi (%)<input type="number" min="0" max="100" step="any" defaultValue={d.setelan.komisiPersen} disabled={dis} onBlur={simpanSetelan('komisiPersen')} style={{ width: 90 }} /></label>
          <label>Kurs (Rp per 1 USD)<input type="number" min="1000" step="1" defaultValue={kursRp} disabled={dis} onBlur={simpanSetelan('kurs')} style={{ width: 120 }} /></label>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="toolbar"><h3 className="judul-bagian" style={{ margin: 0 }}>Performa admin marketing <span className="ds-arti">pendapatan dari akun yang dipegang · total persentase {sum(d.admin)}%</span></h3>
          <label className="kecil" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>Dana bonus admin (Rp)<input type="number" min="0" step="1000" defaultValue={d.setelan.poolAdmin || ''} placeholder="0" disabled={dis} onBlur={simpanSetelan('poolAdmin')} style={{ width: 130 }} /></label></div>
        <Tabel kolom={[['Nama admin'], ['Akun'], ['Pendapatan', 1], ['Target ($)', 1], ['Persentase (%)', 1], ['Bonus'], [`Komisi (${d.setelan.komisiPersen}%)`]]} jumlah={d.admin.length} kosong="Belum ada admin. Tambahkan di bawah.">
          {d.admin.map(o => (
            <tr key={o.userId}>
              <Sel l="Nama admin"><b>{o.nama}</b></Sel>
              <Sel l="Akun">{dis ? (d.akun.find(a => a.id === o.akunId)?.nama ?? '—') : <select defaultValue={o.akunId ?? ''} onChange={simpanOrang(o, 'ADMIN', 'akunId')}><option value="">— pilih akun —</option>{d.akun.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}</select>}</Sel>
              <Sel l="Pendapatan" kanan>{usd(o.pendapatanUsd)}<div className="redup kecil">{formatRp(o.pendapatanUsd * kursRp)}</div></Sel>
              <Sel l="Target ($)" kanan>{inAngka(o, 'ADMIN', 'targetUsd')}</Sel>
              <Sel l="Persentase (%)" kanan>{inAngka(o, 'ADMIN', 'persen', 70)}</Sel>
              <Sel l="Bonus"><Bonus v={o.bonus} /></Sel>
              <Sel l="Komisi"><Komisi v={o.komisi} /></Sel>
            </tr>
          ))}
        </Tabel>
        {!dis && belumAdmin.length > 0 && <div style={{ marginTop: 10 }}><select value="" onChange={e => tambahAdmin(e.target.value)}><option value="">+ Tambah admin…</option>{belumAdmin.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}</select></div>}
      </div>

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="toolbar"><h3 className="judul-bagian" style={{ margin: 0 }}>Performa artist produksi <span className="ds-arti">pendapatan dari order yang dikerjakan (dibagi rata kalau berdua) · total persentase {sum(d.artis)}%</span></h3>
          <label className="kecil" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>Dana bonus artist (Rp)<input type="number" min="0" step="1000" defaultValue={d.setelan.poolArtis || ''} placeholder="0" disabled={dis} onBlur={simpanSetelan('poolArtis')} style={{ width: 130 }} /></label></div>
        <Tabel kolom={[['Nama artist'], ['Peran'], ['Order', 1], ['Pendapatan', 1], ['Target ($)', 1], ['Persentase (%)', 1], ['Bonus'], [`Komisi (${d.setelan.komisiPersen}%)`]]} jumlah={d.artis.length} kosong="Belum ada yang mengerjakan order bulan ini.">
          {d.artis.map(o => (
            <tr key={o.userId}>
              <Sel l="Nama artist"><b>{o.nama}</b></Sel><Sel l="Peran">{o.peran ?? '—'}</Sel><Sel l="Order" kanan>{o.jumlahOrder}</Sel>
              <Sel l="Pendapatan" kanan>{usd(o.pendapatanUsd)}<div className="redup kecil">{formatRp(o.pendapatanUsd * kursRp)}</div></Sel>
              <Sel l="Target ($)" kanan>{inAngka(o, 'ARTIS', 'targetUsd')}</Sel>
              <Sel l="Persentase (%)" kanan>{inAngka(o, 'ARTIS', 'persen', 70)}</Sel>
              <Sel l="Bonus"><Bonus v={o.bonus} /></Sel>
              <Sel l="Komisi"><Komisi v={o.komisi} /></Sel>
            </tr>
          ))}
        </Tabel>
        {!dis && <div className="toolbar" style={{ marginTop: 12 }}><button className="btn utama" onClick={kirimSlip}>Masukkan bonus & komisi ke slip gaji</button><span className="redup kecil">Mengisi bonus dan komisi di slip gaji bulan ini yang masih draft. Bisa diulang kalau angkanya berubah.</span></div>}
      </div>

      <div className="panel">
        <div className="toolbar"><h3 className="judul-bagian" style={{ margin: 0 }}>Catatan lembur <span className="ds-arti">lembur = fee pekerjaan, nilainya ditentukan Koordinator saat menyetujui</span></h3>
          {d.bolehCatatLembur && !form && <button className="btn utama" style={{ marginLeft: 'auto' }} onClick={() => setForm(true)}>+ Catat lembur</button>}</div>
        {d.modeLembur !== 'PER_PROYEK' && d.modeLembur !== 'PER_LEVEL' && <div className="galat-f kecil" style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>Aturan lembur unit ini belum "per pekerjaan", jadi fee lembur dari sini belum ikut slip.{d.bolehUbah && <button type="button" className="btn kecil" onClick={() => aksi(() => api('/api/circle/lembur/aturan', { method: 'PUT', body: { studioId, mode: 'PER_PROYEK' } }))}>Jadikan per pekerjaan</button>}{!d.bolehUbah && ' Minta Koordinator mengubahnya.'}</div>}
        {form && (
          <form className="ds-form" onSubmit={kirimLembur}>
            <div className="dua">
              <label>Nama<select value={lf.userId} onChange={e => setLf({ ...lf, userId: e.target.value })} required><option value="">— pilih —</option>{d.anggota.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}</select></label>
              <label>Tanggal<input type="date" value={lf.tanggal} onChange={e => setLf({ ...lf, tanggal: e.target.value })} required /></label>
              <label>Catatan pekerjaan<input value={lf.catatan} onChange={e => setLf({ ...lf, catatan: e.target.value })} required maxLength={300} placeholder="mis. revisi mendadak klien Rina" /></label>
              <label>Durasi (jam, boleh kosong)<input type="number" min="0" max="24" step="0.5" value={lf.durasiJam} onChange={e => setLf({ ...lf, durasiJam: e.target.value })} /></label>
              <label>Usulan fee (Rp)<input type="number" min="0" step="1000" value={lf.fee} onChange={e => setLf({ ...lf, fee: e.target.value })} required /></label>
            </div>
            <div className="modal-aksi"><button type="button" className="btn" onClick={() => setForm(false)}>Batal</button><button className="btn utama">Simpan</button></div>
          </form>
        )}
        <Tabel kolom={[['Nama'], ['Tanggal'], ['Catatan pekerjaan'], ['Durasi', 1], ['Fee lembur', 1], ['Persetujuan']]} jumlah={d.lembur.length} kosong="Belum ada catatan lembur bulan ini.">
          {d.lembur.map(l => (
            <tr key={l.id}>
              <Sel l="Nama">{l.nama}</Sel><Sel l="Tanggal">{tgl(l.tanggalKerja)}</Sel><Sel l="Catatan pekerjaan">{l.catatan ?? '—'}</Sel>
              <Sel l="Durasi" kanan>{l.durasiJam ? `${l.durasiJam} jam` : '—'}</Sel>
              <Sel l="Fee lembur" kanan>{d.bolehUbah && l.status === 'MENUNGGU' && l.userId !== d.saya
                ? <input className="ds-angka" style={{ width: 110 }} type="number" min="0" step="1000" defaultValue={l.nilaiUsulan ?? l.nilaiProyek ?? ''} onChange={e => setNilai({ ...nilai, [l.id]: e.target.value })} />
                : formatRp(l.nilaiProyek ?? l.nilaiUsulan ?? 0)}</Sel>
              <Sel l="Persetujuan">{d.bolehUbah && l.status === 'MENUNGGU' && l.userId !== d.saya
                ? <span style={{ display: 'inline-flex', gap: 6 }}><button className="btn kecil utama" onClick={() => setujui(l)}>Setujui</button><button className="btn kecil" onClick={() => tolak(l)}>Tolak</button></span>
                : <Pil isi={(LABEL_LEMBUR[l.status] ?? [l.status])[0]} jenis={(LABEL_LEMBUR[l.status] ?? [])[1] ?? ''} />}
                {l.penggajianId && <div className="redup kecil">sudah di slip</div>}</Sel>
            </tr>
          ))}
        </Tabel>
      </div>
    </>
  )
}

const TAB = [['inbox', 'Inbox & Order Progress'], ['lempar', 'Lempar Kerjaan'], ['freelance', 'Database Freelance'], ['performa', 'Performa, Bonus & Lembur']]
const ARTI_TAB = { inbox: 'Catat chat masuk dan order, lalu lihat pendapatan per akun.', lempar: 'Kerjaan yang dilempar ke freelancer dan status bayarnya.', freelance: 'Daftar freelancer yang pernah atau bisa diajak kerja.', performa: 'Target dan bonus admin & artist, komisi, serta catatan lembur.' }

export default function DailySheet({ studioId, lingkup, pindah, namaStudio }) {
  const [periode, setPeriode] = useState(bulanSekarang)
  const [tab, setTab] = useState('inbox')
  const [akun, setAkun] = useState(null)
  const [d, setD] = useState(null), [galat, setGalat] = useState('')
  const bulanKunci = kunciBulan(periode)
  const muat = useCallback(() => api(`${A}?studioId=${studioId}&bulan=${bulanKunci}`).then(x => { setD({ ...x, bulanKunci, namaStudio }); setGalat('') }).catch(e => setGalat(e.message)), [studioId, bulanKunci, namaStudio])
  useEffect(() => { muat() }, [muat])
  useSegarkan(muat, ['pemasukan', 'order'])
  const aksi = async (fn, lalu) => { setGalat(''); try { await fn(); lalu?.(); await muat() } catch (e) { setGalat(e.message) } }
  const akunAda = useMemo(() => d?.pilihan.akun ?? [], [d])

  if (!d) return <div className="redup">{galat || 'Memuat…'}</div>
  return (
    <div className="kd">
      <p className="sub" style={{ marginTop: 0 }}>Semua kerja harian studio di satu tempat: chat masuk, order, lempar kerjaan, freelancer, target, bonus, dan lembur. Angka terhitung otomatis dari catatan.</p>
      {galat && <div className="galat">{galat}</div>}
      <div className="toolbar">
        <button className="btn kecil" onClick={() => setPeriode(p => geserBulan(p, -1))} aria-label="Bulan sebelumnya">‹</button>
        <b>{NAMA_BULAN[periode.bulan - 1]} {periode.tahun}</b>
        <button className="btn kecil" onClick={() => setPeriode(p => geserBulan(p, 1))} aria-label="Bulan berikutnya">›</button>
      </div>
      <div className="chips" style={{ marginBottom: 8 }}>{TAB.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      <p className="kosong" style={{ margin: '0 0 12px' }}>{ARTI_TAB[tab]}</p>
      {(tab === 'inbox' || tab === 'lempar') && akunAda.length > 0 && (
        <div className="chips akun" style={{ marginBottom: 14 }}>
          <button className={!akun ? 'on' : ''} onClick={() => setAkun(null)}>Semua Akun ({akunAda.length})</button>
          {akunAda.map(a => <button key={a.id} className={akun === a.id ? 'on' : ''} onClick={() => setAkun(a.id)}>{a.nama} · {a.platform}</button>)}
        </div>
      )}
      {tab === 'inbox' && <TabInbox key={akun ?? 'semua'} d={d} studioId={studioId} akunPilih={akun} aksi={aksi} />}
      {tab === 'lempar' && <TabLempar d={d} studioId={studioId} akunPilih={akun} aksi={aksi} pindah={pindah} />}
      {tab === 'freelance' && <Freelancer studioId={studioId} lingkup={lingkup} />}
      {tab === 'performa' && <TabPerforma key={bulanKunci} studioId={studioId} bulanKunci={bulanKunci} />}
    </div>
  )
}
