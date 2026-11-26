import { useEffect, useRef } from 'react'
import { ambilToken } from './api'

// REALTIME (SSE): server hanya memberi tahu "bagian X berubah"; komponen lalu mengambil ulang datanya lewat API biasa.
// Koneksi HANYA dibuka untuk tab yang sedang TERLIHAT (21 Okt 2026): satu koneksi stream memakan satu dari ±6 koneksi browser per alamat
// (HTTP/1.1), jadi beberapa tab yang masing-masing memegang stream membuat permintaan data biasa mengantre selamanya ("Memuat…" tak selesai).
// Tab di latar belakang menutup stream-nya; saat terlihat lagi, stream dibuka ulang dan semua bagian disegarkan sekali.
let ac = null, diminta = false, tunggu = 1000, sedangSambung = false
const ke = new EventTarget()
const SEMUA = '*'

async function sambung() {
  if (!diminta || document.hidden || sedangSambung) return
  sedangSambung = true
  ac = new AbortController()
  const ini = ac
  try {
    const r = await fetch('/api/circle/stream', { headers: { Authorization: `Bearer ${ambilToken()}` }, signal: ini.signal, credentials: 'include' })
    if (!r.ok || !r.body) throw new Error('stream')
    tunggu = 1000
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = ''
    for (;;) {
      const x = await rd.read(); if (x.done) break
      buf += dec.decode(x.value, { stream: true })
      let i
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const blok = buf.slice(0, i); buf = buf.slice(i + 2)
        if (!blok.includes('event: perubahan')) continue
        const d = blok.split('\n').find(l => l.startsWith('data: '))
        try { ke.dispatchEvent(new CustomEvent('perubahan', { detail: JSON.parse(d.slice(6)) })) } catch { /* abaikan */ }
      }
    }
  } catch { /* putus / dibatalkan */ }
  sedangSambung = false
  if (ini.signal.aborted || !diminta || document.hidden) return // dihentikan sengaja / tab disembunyikan → tidak menyambung ulang
  await new Promise(r => setTimeout(r, tunggu)); tunggu = Math.min(tunggu * 2, 30000); sambung()
}
function tutup() { try { ac?.abort() } catch { /* */ } sedangSambung = false }

// Tab disembunyikan → tutup stream (membebaskan koneksi untuk tab lain); terlihat lagi → sambung & segarkan semua bagian sekali
document.addEventListener('visibilitychange', () => {
  if (!diminta) return
  if (document.hidden) { tutup(); return }
  tunggu = 1000; sambung()
  ke.dispatchEvent(new CustomEvent('perubahan', { detail: { bagian: SEMUA } }))
})

/** Mulai (atau mulai ulang dengan token terbaru, mis. setelah menyamar). */
export function mulaiRealtime() { hentikanRealtime(); diminta = true; tunggu = 1000; sambung() }
export function hentikanRealtime() { diminta = false; tutup() }

/** Panggil `muat` (ditunda 700 ms, digabung) saat bagian yang relevan berubah. `bagian` kosong = semua perubahan. Lewati bila tab tak terlihat. */
export function useSegarkan(muat, bagian = []) {
  const fn = useRef(muat); fn.current = muat
  const kunci = bagian.join(',')
  useEffect(() => {
    let t = null
    const h = (e) => { if (bagian.length && e.detail.bagian !== SEMUA && !bagian.includes(e.detail.bagian)) return; if (document.hidden) return; clearTimeout(t); t = setTimeout(() => fn.current?.(), 700) }
    ke.addEventListener('perubahan', h)
    return () => { ke.removeEventListener('perubahan', h); clearTimeout(t) }
  }, [kunci]) // eslint-disable-line react-hooks/exhaustive-deps
}
