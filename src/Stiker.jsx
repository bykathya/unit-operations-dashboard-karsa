// Karakter kru Karsa Circle (tahap 3). Gambar di public/maskot/.
// Tiap nama selalu mendapat karakter yang sama (1–8), dihitung dari namanya.
const JUMLAH = 8

export function nomorKarakter(nama) {
  let h = 0
  for (const c of String(nama ?? '')) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return (h % JUMLAH) + 1
}

// foto = foto profil orang itu (28 Nov 2026): bila ada, dipakai menggantikan karakter.
export default function Stiker({ nama, nomor, ukuran = 150, alt, foto }) {
  if (foto) return <img className="stiker foto" src={foto} width={ukuran} height={ukuran} alt={alt ?? ''} loading="lazy" referrerPolicy="no-referrer" style={{ objectFit: 'cover', borderRadius: '50%' }} />
  const n = nomor ?? nomorKarakter(nama)
  return <img className="stiker" src={`/maskot/stiker-${n}.webp`} width={ukuran} height={ukuran} alt={alt ?? ''} loading="lazy" />
}

export function MaskotGrup({ alt = 'Kru Karsa Circle' }) {
  return <img src="/maskot/grup.webp" alt={alt} width="1200" height="600" />
}
