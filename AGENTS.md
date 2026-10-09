# Lumens / XDIRGA TOOLS — repo notes

TanStack Start app (React + TypeScript + Tailwind + shadcn). Production:
`https://lumens-sigma.vercel.app` (Vercel project `lumens-sigma`, repo
`sherlymakeup/lumens`, branch `main` — kerja langsung di main).

## Alur kerja wajib

1. **TDD ketat**: tulis/ubah test dulu (`tests/*.test.mjs`, `node --test`),
   baru implementasi. Jangan klaim "tested" tanpa test yang jalan.
2. `npx tsc --noEmit` harus bersih.
3. `npx vite build` untuk verifikasi production build — JANGAN edit
   `src/routeTree.gen.ts` manual, file itu di-regenerate otomatis oleh build.
4. **Hapus `.vercel/`** (`rm -rf .vercel`) SETELAH build verifikasi,
   SEBELUM push — build artifact ikut ke-upload kalau lupa.
5. Push HANYA file yang berubah via `~/workspace/skills/github/bin/gh_push_smart.py`.
6. Verifikasi live di production untuk fitur runtime-sensitive (bukan cuma HTTP 200).

## Konvensi

- Secrets HANYA via env server (Vercel). Nol input key di UI, nol di localStorage.
- Semua URL user-controlled yang di-fetch server-side wajib lewat
  `assertPublicConnectorUrl` / `normalizeBaseUrl` di `src/lib/safe-url.ts`
  (blokir localhost, IP privat, metadata host).
- i18n: semua string user-facing via `src/lib/i18n.ts` (`useStrings()`),
  key `StringKey` — ID dan EN wajib lengkap dua-duanya.
- Error handling: fetch pakai `AbortSignal.timeout`, `response.json()` pakai
  `.catch(() => null)`, jangan bocorkan raw error DB ke client.
- Mobile-first: user utama pakai Android — tombol penting harus reachable
  tanpa hover (`md:opacity-0 md:group-hover:opacity-100` untuk hover-reveal desktop).
- Estimasi effort dalam MENIT. Bahasa: Indonesia kasual, panggil user "bos".
