# Lumens — OpenAI-Compatible Inference Chat

Chat app (TanStack Start + React) yang ngobrol ke endpoint AI apa pun yang
OpenAI-compatible. Request di-proxy lewat server (`/api/*`), jadi API key
tidak pernah sampai ke browser dan tidak kena blokir CORS.

## Environment variables (wajib di-set di Vercel)

| Variable          | Isi                                              |
| ----------------- | ------------------------------------------------ |
| `OPENAI_API_KEY`  | API key endpoint kamu                            |
| `OPENAI_BASE_URL` | Base URL endpoint, contoh `https://ai.xdirga.xyz/v1` |

Tanpa keduanya, `/api/generate` dan `/api/models` balas 503 dengan pesan
yang jelas.

## Deploy ke Vercel

1. Push repo ini ke GitHub (sudah).
2. Import repo di Vercel → framework terdeteksi otomatis.
3. Di **Settings → Environment Variables**, tambah dua variable di atas
   (untuk Production; centang juga Preview/Development kalau perlu).
4. Deploy. Selesai — buka app, Test connection di Settings, pilih model,
   langsung chat.

## Develop lokal

```bash
npm install
OPENAI_API_KEY=... OPENAI_BASE_URL=... npm run dev
```

## Catatan

- Pengaturan di UI: model + parameter generation (temperature, max tokens,
  top P, penalties, streaming) + tampilan + system prompt. Base URL & API key
  hanya lewat env server.
- `src/lib/safe-url.ts` memblokir host private (localhost, 127.0.0.1, IP
  LAN) sebagai proteksi SSRF — endpoint harus publik.
