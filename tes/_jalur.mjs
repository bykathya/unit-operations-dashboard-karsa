// Lokasi repo Management Dashboard (backend + database) yang dipakai skrip uji dan demo.
// Bawaan: folder saudara ../management-dashboard di sebelah repo ini; bisa diganti lewat env DASHBOARD_DIR.
import path from 'path'
import { fileURLToPath } from 'url'
export const DASH = process.env.DASHBOARD_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../management-dashboard')
