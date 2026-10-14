# Teman Akrab — Absensi Pengajian Gabungan

Aplikasi absensi pengajian empat desa dengan Next.js App Router, TypeScript, Tailwind, Drizzle ORM, dan Cloudflare D1. UI menggunakan komponen bergaya shadcn/ui dan Recharts untuk grafik.

Skema runtime ditulis dengan Drizzle di `lib/schema.ts`; migrasi SQL yang diterapkan Wrangler berada di `drizzle/`.

## Menjalankan secara lokal

Persyaratan: Node.js 20.9 atau lebih baru dan npm.

1. Pasang dependensi dengan `npm install`.
2. Buat database D1 lokal dan masukkan skema:

   ```powershell
   npm run db:migrate:local
   npm run db:seed:local
   ```

3. Salin `.dev.vars.example` menjadi `.dev.vars`, lalu isi `AUTH_SECRET`, `ADMIN_SEED_USERNAME`, dan `ADMIN_SEED_PASSWORD` memakai kredensial awal yang tercantum di PRD. Buat secret acak panjang untuk `AUTH_SECRET`; jangan masukkan `.dev.vars` ke Git.
4. Buat akun admin dari secret dengan `npm run db:seed-admin:local`.
5. Jalankan `npm run dev`, lalu masuk ke `/admin/login` memakai username dan password seed. Setelah login pertama, ganti kata sandi melalui tombol **Keamanan**.

Catatan: seeding hanya membuat akun jika tabel admin masih kosong. Kredensial hanya dibaca dari `.dev.vars` atau environment proses, tidak disimpan di source code maupun Worker.

## Cloudflare D1 dan deployment

1. Buat database D1, misalnya `npx wrangler d1 create absensi-pengajian`.
2. Isi `database_id` di `wrangler.toml` dengan ID database dari Cloudflare. Binding-nya harus tetap bernama `DB`.
3. Jalankan migrasi, seed desa, dan seed akun admin dari `.dev.vars`:

   ```powershell
   npm run db:migrate:remote
   npx wrangler d1 execute absensi-pengajian --remote --file=scripts/seed-villages.sql
   npm run db:seed-admin:remote
   ```

4. Simpan secret sesi Worker melalui Wrangler:

   ```powershell
   npx wrangler secret put AUTH_SECRET
   ```

5. Deploy dengan `npm run deploy`.

OpenNext Cloudflare memakai Worker runtime. Periksa binding dan secret sebelum membuka pendaftaran. Rate limiting absensi dan percobaan login disimpan sebagai penghitung ber-window di D1; untuk lalu lintas tinggi, tambahkan Cloudflare WAF/rate limiting di depan Worker.

## Fitur

- Form absensi publik tanpa akun peserta, dengan kelompok yang mengikuti desa terpilih.
- Penutupan otomatis form saat tidak ada kegiatan aktif, validasi server-side, pencegahan duplikat, dan rate limiting.
- Login admin dengan PBKDF2, cookie HTTP-only bertanda tangan, pembatasan lima kegagalan per 15 menit, dan pergantian kata sandi awal.
- Dashboard grafik kehadiran per desa, kelompok, dan rentang umur; tabel pencarian, pengurutan, paginasi, filter tanggal, polling 30 detik, serta ekspor CSV.
- CRUD kegiatan, desa, dan kelompok dengan satu kegiatan aktif pada satu waktu.
- Pengacakan Fisher–Yates, pembagian seimbang (opsional menyebar desa), pratinjau, simpan, cetak, dan ekspor CSV.
