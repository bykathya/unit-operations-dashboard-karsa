// INSTALL APP (Karsa, 28 Nov 2026): web bisa dipasang seperti aplikasi di laptop/HP.
// Chrome/Edge/Android: tombol memakai prompt bawaan. iPhone/iPad (Safari): tidak ada prompt, jadi ditampilkan petunjuk Bagikan → Tambah ke Layar Utama.
import { useEffect, useState } from 'react'

let tunda = null
const pendengar = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); tunda = e; pendengar.forEach(f => f()) })
  window.addEventListener('appinstalled', () => { tunda = null; pendengar.forEach(f => f()) })
  if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}
const sudahTerpasang = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
const iOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

/** { bisa, ios, pasang } — bisa = tombol layak ditampilkan; pasang() membuka prompt (atau mengembalikan 'ios' untuk petunjuk). */
export function usePasangAplikasi() {
  const [, paksa] = useState(0)
  useEffect(() => { const f = () => paksa(x => x + 1); pendengar.add(f); return () => pendengar.delete(f) }, [])
  const terpasang = sudahTerpasang()
  return {
    bisa: !terpasang && (!!tunda || iOS()),
    ios: iOS() && !tunda,
    async pasang() {
      if (tunda) { const e = tunda; tunda = null; await e.prompt(); await e.userChoice.catch(() => null); pendengar.forEach(f => f()); return 'prompt' }
      return 'ios'
    },
  }
}
