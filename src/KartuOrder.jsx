import { useState } from 'react'
import { formatRp, tanggalPendek, lewatDeadline } from './format'
import { LabelKhusus } from './KolomKhusus'

// Kartu order di papan. Tombol aksi datang dari MESIN di server (o.aksi) — tampilan tidak menentukan alur.
// Tanda pembayaran di kartu (permintaan tim 9 Nov 2026): tidak perlu membuka order satu per satu. Status mengikuti termin di detail order.
const BAYAR = { LUNAS: '✓ Lunas', DP: 'DP', BELUM_LUNAS: 'Belum bayar' }
// `terbatas` (papan mode pantau marketer): hanya tombol aksi yang diizinkan server, tanpa menu ⋯ (hold, tahap opsional, pindah manual)
export default function KartuOrder({ o, tahap, tahapKartu, jenisSaatIni, tampilSub, warna, bisaUbah, terbatas = false, onAksi, onPindahManual, onOpsional, onDetail, onInvoice }) {
  const [menu, setMenu] = useState(false)
  const beda = o.nilaiDisepakati != null && o.nilaiDisepakati !== o.nilaiBersih
  const telat = lewatDeadline(o.deadline, jenisSaatIni)
  const utama = o.aksi.filter(a => a.aksi !== 'hold')
  const hold = o.aksi.find(a => a.aksi === 'hold')
  const opsional = tahap.filter(t => t.opsional)
  return (
    <div className={'kartu-order' + (telat ? ' telat' : '')}>
      <div className="baris-atas">
        <strong className="judul-order" style={onDetail ? { cursor: 'pointer' } : undefined} onClick={onDetail ? () => onDetail(o.id) : undefined} title="Buka detail order">{o.judul}</strong>
        {o.revisiKe > 0 && <span className="lencana revisi" title="Jumlah revisi">↺ {o.revisiKe}</span>}
        {onDetail && <button type="button" className="btn kecil" style={{ marginLeft: 'auto' }} onClick={() => onDetail(o.id, 'ubah')} title="Buka detail: ubah harga, klien, deadline, tim, pembayaran">✎ Ubah</button>}
        {/* Invoice langsung dari kartu (12 Nov 2026, masukan tim): membuka detail order tepat di panel "Invoice ke klien" (DP / Pelunasan) */}
        {onInvoice && !o.pekerjaanInternal && <button type="button" className="btn kecil" onClick={() => onInvoice(o.id)} title="Buat / cetak invoice DP atau pelunasan untuk order ini">🧾 Invoice</button>}
      </div>
      <div className="meta">
        {o.pekerjaanInternal ? <span className="chip sub" title="Pekerjaan internal — bukan order klien, tidak dihitung omset / order masuk">🏠 {o.pekerjaanInternal === 'PORTO' ? 'Porto' : 'Persiapan (belum order)'}</span> : <span className="chip">{o.klien}</span>}
        {/* Label tahap berwarna (12 Nov 2026, masukan tim): tahap kerja & QC/Revisi-nya punya warna sendiri */}
        {(tampilSub || warna) && tahapKartu && <span className={'chip ' + (warna ? 'tahap' : 'sub')} style={warna ? { '--c': warna } : undefined}>{tahapKartu.nama}</span>}
        {o.deadline && <span className={'tgl' + (telat ? ' merah' : '')}>⏱ {tanggalPendek(o.deadline)}</span>}
        <LabelKhusus daftar={o.khusus} />
        {/* 🌙 Lembur dari tugas ditunda yang belum diputuskan (22 Nov 2026, ATURAN LEMBUR 3D ARTIST) */}
        {o.lembur && <span className="lencana" title={o.lembur === 'CALON' ? 'Tugas ditunda diselesaikan di luar jam kerja — nilai di Tugas saya › Pekerjaanku' : 'Lembur sudah dinilai admin — menunggu persetujuan koordinator'}>🌙 Lembur</span>}
      </div>
      {o.nilaiBersih != null && !o.pekerjaanInternal && <div className="nilai">
        <b>{formatRp(o.nilaiBersih)}</b>
        {beda && <span className="redup kecil"> · disepakati {formatRp(o.nilaiDisepakati)}</span>}
        {o.statusBayar && <span className={'lencana bayar-' + o.statusBayar.toLowerCase()} title="Status pembayaran (dari termin di detail order)" style={{ marginLeft: 6 }}>{BAYAR[o.statusBayar] ?? o.statusBayar}</span>}
      </div>}
      {o.talent.length > 0 && <div className="talent">👤 {o.talent.join(', ')}</div>}
      {/* 13 Nov 2026 (laporan tim): order di Inbox belum masuk Tugas saya talent — baru masuk setelah admin klik "Mulai kerjakan" */}
      {jenisSaatIni === 'MASUK' && o.adaTalentInternal && <div className="redup kecil" title="Inbox = belum dimulai. Talent baru melihat tugas ini setelah order dipindah ke tahap kerja.">⏳ Belum di antrean talent — klik <b>Mulai kerjakan</b> agar masuk Tugas saya talent</div>}
      {o.wakilFreelance && <div className="redup kecil" title="Freelance tidak punya akun — kamu yang menggeser tahap kerjanya. QC tetap oleh koordinator.">🤝 Kamu wakil freelance di order ini</div>}
      {bisaUbah && (
        <>
          <div className="aksi-order">
            {utama.map((a, i) => (
              <button key={a.aksi} className={'btn kecil' + (i === 0 && a.aksi !== 'gagal' && a.aksi !== 'revisi_klien' ? ' utama' : a.aksi === 'gagal' || a.aksi === 'revisi_klien' ? ' bahaya' : '')} onClick={() => onAksi(o, a)}>{a.label}</button>
            ))}
            {!terbatas && <button className="btn kecil" onClick={() => setMenu(m => !m)} aria-label="Lainnya">⋯</button>}
          </div>
          {menu && !terbatas && (
            <div className="menu-kartu">
              {hold && <button className="btn kecil" onClick={() => { setMenu(false); onAksi(o, hold) }}>{hold.label}</button>}
              {opsional.length > 0 && <button className="btn kecil" onClick={() => { setMenu(false); onOpsional(o) }}>Atur tahap yang dipakai</button>}
              <label className="redup kecil">Pindahkan manual (koreksi)
                <select value={o.tahapId} onChange={e => { setMenu(false); onPindahManual(o, e.target.value) }}>
                  {tahap.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}
                </select>
              </label>
            </div>
          )}
        </>
      )}
    </div>
  )
}
