# Teman Akrab — Absensi Pengajian Gabungan

Aplikasi absensi pengajian empat desa dengan Next.js App Router, TypeScript, Tailwind, Drizzle ORM, dan Turso (libSQL). UI menggunakan komponen bergaya shadcn/ui dan Recharts untuk grafik.

Skema runtime ditulis dengan Drizzle di `lib/schema.ts`; SQL untuk menyiapkan Turso berada di `drizzle/` dan dijalankan oleh `scripts/migrate-turso.mjs`.

## Menjalankan secara lokal

Persyaratan: Node.js 20.9 atau lebih baru dan npm.

1. Pasang dependensi dengan `npm install`.
2. Isi `.env.local` dengan kredensial Turso dan konfigurasi aplikasi:

   ```powershell
   TURSO_DATABASE_URL=libsql://<nama-database>-<organisasi>.turso.io
   TURSO_AUTH_TOKEN=<token-database>
   AUTH_SECRET=<secret-acak-panjang>
   ADMIN_SEED_USERNAME=<username-admin>
   ADMIN_SEED_PASSWORD=<password-minimal-10-karakter>
   ```

3. Terapkan skema dan salin data dari `absensi-pengajian.sqlite` (jika file tersedia):

   ```powershell
   npm run db:migrate
   ```

   Migrasi dapat dijalankan ulang; baris yang sudah ada di Turso tidak ditimpa. Jika file SQLite lokal tidak tersedia, empat desa awal akan dimasukkan.

4. Buat akun admin awal, lalu jalankan aplikasi:

   ```powershell
   npm run db:seed-admin
   npm run dev
   ```

   Masuk ke `/admin/login`. Setelah login pertama, ganti kata sandi melalui tombol **Keamanan**. Seeding admin hanya membuat akun jika tabel `admins` masih kosong.

## Deployment Cloudflare

Tambahkan nilai `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, dan `AUTH_SECRET` sebagai Worker secrets melalui Wrangler, lalu deploy:

   ```powershell
   npx wrangler secret put TURSO_DATABASE_URL
   npx wrangler secret put TURSO_AUTH_TOKEN
   npx wrangler secret put AUTH_SECRET
   npm run deploy
   ```

Untuk preview lokal Wrangler, letakkan variabel yang sama di `.dev.vars`. `.env.local` dipakai oleh Next.js lokal dan perintah migrasi. Jangan commit file yang berisi token atau secret. Rate limiting absensi dan percobaan login disimpan sebagai penghitung ber-window di Turso.

## Fitur

- Form absensi publik tanpa akun peserta, dengan kelompok yang mengikuti desa terpilih.
- Pencatatan jenis kelamin untuk membantu pembagian peserta yang seimbang.
- Penutupan otomatis form saat tidak ada kegiatan aktif, validasi server-side, pencegahan duplikat, dan rate limiting.
- Login admin dengan PBKDF2, cookie HTTP-only bertanda tangan, pembatasan lima kegagalan per 15 menit, dan pergantian kata sandi awal.
- Dashboard grafik kehadiran per desa, kelompok, dan rentang umur; tabel pencarian, pengurutan, paginasi, filter tanggal, polling 30 detik, serta ekspor CSV.
- CRUD kegiatan, desa, dan kelompok dengan satu kegiatan aktif pada satu waktu.
- Pengacakan Fisher–Yates, pembagian laki-laki/perempuan semerata mungkin (opsional menyebar desa), ubah nama kelompok, pratinjau, simpan, cetak, dan ekspor CSV.
