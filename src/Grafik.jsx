import { useState } from 'react'

// Grafik ringan (SVG/HTML, tanpa library) — warna dari token tema, tooltip saat hover, legenda, dan tampilan tabel.
// Aturan: satu sumbu, garis tipis, grid pelan, teks memakai warna teks (bukan warna seri).

/** Batang horizontal sederhana (mis. jumlah per fase). data: [{label, nilai, nada?, ket?}] */
// onKlik (opsional): baris jadi tombol (mis. membuka daftar order di fase itu); `aktif` = label baris yang sedang dibuka
export function BatangHorizontal({ data, satuan = '', onKlik, aktif }) {
  const maks = Math.max(1, ...data.map(d => d.nilai))
  return (
    <div className="gf-batang">
      {data.map(d => (
        <div className={'gf-baris' + (onKlik ? ' gf-klik' : '') + (aktif === d.label ? ' aktif' : '')} key={d.label} title={`${d.label}: ${d.nilai}${satuan}${d.ket ? ' · ' + d.ket : ''}${onKlik ? ' — klik untuk melihat order' : ''}`}
          {...(onKlik ? { role: 'button', tabIndex: 0, onClick: () => onKlik(d), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onKlik(d) } } } : {})}>
          <span className="gf-label">{d.label}</span>
          <span className="gf-trek"><i style={{ width: `${(d.nilai / maks) * 100}%`, background: d.nada ? `var(--nada-${d.nada})` : 'var(--seri-1)' }} /></span>
          <b className="gf-nilai">{d.nilai}{satuan}</b>
          {d.ket && <span className="redup kecil gf-ket">{d.ket}</span>}
        </div>
      ))}
    </div>
  )
}

/** Grafik garis/batang per periode. titik: [{kunci, <seri>...}], seri: [{k, label, warna}] */
export function GrafikTren({ titik, seri, tinggi = 190, formatKunci = (k) => k.slice(5) }) {
  const [tabel, setTabel] = useState(false)
  const [aktif, setAktif] = useState(null)
  const lebar = 640, kiri = 34, bawah = 26, atas = 10, kanan = 18
  const maks = Math.max(1, ...titik.flatMap(t => seri.map(s => t[s.k] ?? 0)))
  const langkah = maks <= 5 ? 1 : maks <= 10 ? 2 : maks <= 25 ? 5 : Math.ceil(maks / 5)
  const puncak = Math.ceil(maks / langkah) * langkah
  const x = (i) => kiri + (titik.length === 1 ? 0 : (i / (titik.length - 1)) * (lebar - kiri - kanan))
  const y = (v) => atas + (1 - v / puncak) * (tinggi - atas - bawah)
  const garis = []; for (let v = 0; v <= puncak; v += langkah) garis.push(v)
  return (
    <div className="gf-tren">
      <div className="gf-kepala">
        <div className="gf-legenda">{seri.map(s => <span key={s.k}><i style={{ background: s.warna }} />{s.label}</span>)}</div>
        <button className="btn kecil" onClick={() => setTabel(!tabel)}>{tabel ? 'Grafik' : 'Tabel'}</button>
      </div>
      {tabel ? (
        <table><thead><tr><th>Periode</th>{seri.map(s => <th key={s.k} className="kanan">{s.label}</th>)}</tr></thead>
          <tbody>{titik.map(t => <tr key={t.kunci}><td>{t.kunci}</td>{seri.map(s => <td key={s.k} className="kanan">{t[s.k] ?? 0}</td>)}</tr>)}</tbody></table>
      ) : (
        <svg viewBox={`0 0 ${lebar} ${tinggi}`} className="gf-svg" role="img" aria-label="Grafik tren" onMouseLeave={() => setAktif(null)}>
          {garis.map(v => <g key={v}><line x1={kiri} x2={lebar - kanan} y1={y(v)} y2={y(v)} className="gf-grid" /><text x={kiri - 6} y={y(v) + 4} textAnchor="end" className="gf-teks">{v}</text></g>)}
          {titik.map((t, i) => (i % Math.ceil(titik.length / 8) === 0 || i === titik.length - 1) && <text key={t.kunci} x={x(i)} y={tinggi - 8} textAnchor={i === titik.length - 1 ? 'end' : 'middle'} className="gf-teks">{formatKunci(t.kunci)}</text>)}
          {seri.map(s => (
            <g key={s.k}>
              <polyline fill="none" stroke={s.warna} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={titik.map((t, i) => `${x(i)},${y(t[s.k] ?? 0)}`).join(' ')} />
              {titik.map((t, i) => <circle key={t.kunci} cx={x(i)} cy={y(t[s.k] ?? 0)} r={aktif === i ? 5 : 3.5} fill={s.warna} stroke="var(--bg-card)" strokeWidth="2" />)}
            </g>
          ))}
          {titik.map((t, i) => <rect key={'h' + t.kunci} x={x(i) - (lebar - kiri - kanan) / titik.length / 2} y={atas} width={(lebar - kiri - kanan) / titik.length} height={tinggi - atas - bawah} fill="transparent" onMouseEnter={() => setAktif(i)} />)}
          {aktif != null && <line x1={x(aktif)} x2={x(aktif)} y1={atas} y2={tinggi - bawah} className="gf-kursor" />}
        </svg>
      )}
      {!tabel && aktif != null && (
        <div className="gf-tip"><b>{titik[aktif].kunci}</b>{seri.map(s => <span key={s.k}><i style={{ background: s.warna }} />{s.label}: <b>{titik[aktif][s.k] ?? 0}</b></span>)}</div>
      )}
    </div>
  )
}
