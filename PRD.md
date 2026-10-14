# PRD — Website Absensi Kehadiran Pengajian 4 Desa Gabungan

| Item | Detail |
|---|---|
| Nama Produk | Absensi Pengajian Gabungan |
| Cakupan Wilayah | Bandara, Cengkareng, Kalideres, Cipondoh |
| Versi Dokumen | 1.0 (Draft) |
| Tanggal | 14 Oktober 2026 |

---

## 1. Latar Belakang

Pengajian gabungan melibatkan jamaah dari 4 desa dengan banyak kelompok. Pencatatan kehadiran secara manual menyulitkan rekap, dan pembagian kelompok saat acara membutuhkan cara yang adil dan cepat. Website ini menyediakan pendaftaran/absensi online oleh peserta, serta dashboard bagi admin untuk memantau kehadiran dan **membagi peserta ke dalam kelompok secara acak (random)**.

## 2. Tujuan

1. Mempermudah peserta mengisi absensi kehadiran lewat HP.
2. Menyediakan data kehadiran per desa, per kelompok, dan per umur secara real-time.
3. Mendukung pembagian kelompok acak yang adil berdasarkan peserta yang hadir.
4. Memberi admin kendali penuh atas data kegiatan, desa, dan kelompok.

### Indikator Keberhasilan
- Peserta dapat menyelesaikan form dalam < 1 menit.
- Dashboard menampilkan data kehadiran terbaru tanpa perlu refresh manual yang berlebihan (< 5 detik setelah submit).
- Pembagian kelompok acak selesai < 5 detik untuk 1.000 peserta.

## 3. Pengguna

| Peran | Deskripsi | Hak Akses |
|---|---|---|
| Peserta | Jamaah dari 4 desa | Mengisi form absensi (tanpa login) |
| Admin | Pengurus/panitia | Login, dashboard, kelola kegiatan, desa, kelompok, pembagian acak |

## 4. Ruang Lingkup

### In Scope
- Halaman pendaftaran/absensi peserta
- Halaman login admin
- Dashboard grafik kehadiran
- Manajemen kegiatan, desa, dan kelompok
- Fitur pembagian kelompok acak
- Ekspor data (CSV)

### Out of Scope (fase ini)
- Login/akun untuk peserta
- Notifikasi WhatsApp/email
- Absensi via QR code (dapat dipertimbangkan di fase berikutnya)

## 5. Spesifikasi Teknis

| Aspek | Pilihan |
|---|---|
| Framework | Next.js (App Router) + React |
| Bahasa | TypeScript |
| Database | SQLite → menggunakan **Cloudflare D1** (database SQLite-compatible yang berjalan di Cloudflare) |
| ORM | Drizzle ORM (dukungan D1 baik, type-safe) |
| Deploy | Cloudflare Workers/Pages menggunakan adapter `@opennextjs/cloudflare` |
| UI | Tailwind CSS + shadcn/ui |
| Grafik | Recharts |
| Validasi | Zod + React Hook Form |
| Autentikasi Admin | Session berbasis cookie (HTTP-only, signed JWT) |

> **Catatan penting:** File SQLite biasa (`.db`) tidak bisa ditulis di lingkungan Cloudflare Workers karena tidak ada filesystem persisten. Karena itu, SQLite diimplementasikan melalui **Cloudflare D1**. Untuk pengembangan lokal tetap memakai SQLite lewat `wrangler dev`.

## 6. Fitur & Kebutuhan Fungsional

### 6.1 Halaman Pendaftaran / Absensi Peserta (`/`)

**Field form**

| Field | Tipe | Aturan |
|---|---|---|
| Nama Lengkap | Text | Wajib, 3–100 karakter |
| Desa | Dropdown | Wajib; sumber data dari tabel desa (Bandara, Cengkareng, Kalideres, Cipondoh) |
| Kelompok | Dropdown dependen | Wajib; opsi **hanya** menampilkan kelompok milik desa yang dipilih; nonaktif sebelum desa dipilih |
| Umur | Number | Wajib, 5–100 |
| Pekerjaan | Text | Wajib, maks. 100 karakter |
| Tombol **Kirim** | Button | Menyimpan data, menampilkan halaman/pesan sukses |

**Aturan bisnis**
- Absensi terikat pada **kegiatan aktif** (event yang sedang dibuka admin). Jika tidak ada kegiatan aktif, form ditutup dengan pesan informatif.
- Pencegahan duplikat: kombinasi nama (case-insensitive) + desa + kelompok + kegiatan tidak boleh tercatat dua kali; tampilkan pesan "Anda sudah tercatat hadir".
- Tombol Kirim menampilkan loading state dan dinonaktifkan saat proses berlangsung.
- Tampilan mobile-first dan responsif.
- Perlindungan spam: rate limiting per IP (Cloudflare) dan opsional Cloudflare Turnstile.

### 6.2 Halaman Login Admin (`/admin/login`)

- Input username dan password.
- Akun awal (seed) — **hanya untuk setup awal**:
  - Username: `temanakrab@gencar.id`
  - Password: `temanakrab123`
- Password **wajib disimpan dalam bentuk hash** (bcrypt/argon2, atau PBKDF2 via Web Crypto yang kompatibel dengan Workers), tidak boleh ditulis plain-text di source code. Kredensial awal dimasukkan lewat environment secret (`ADMIN_SEED_USERNAME`, `ADMIN_SEED_PASSWORD`) saat proses seeding.
- Disarankan ada fitur ganti password dan mengganti password default setelah login pertama.
- Pembatasan percobaan login (maks. 5 gagal / 15 menit).
- Semua route `/admin/*` dan API admin dilindungi middleware.

### 6.3 Dashboard Admin (`/admin/dashboard`)

Filter global: **pilih kegiatan** (default: kegiatan aktif) dan rentang tanggal.

| Komponen | Isi |
|---|---|
| Kartu ringkasan | Total hadir, jumlah per desa, jumlah kelompok hadir, rata-rata umur |
| Grafik kehadiran **per desa** | Bar chart / pie chart (4 desa) |
| Grafik kehadiran **per kelompok** | Bar chart, dapat difilter berdasarkan desa |
| Grafik kehadiran **per umur** | Bar chart berdasarkan rentang umur: ≤12, 13–17, 18–25, 26–35, 36–45, 46–60, >60 |
| Tabel daftar hadir | Kolom: nama, desa, kelompok, umur, pekerjaan, waktu absen; pencarian, sorting, paginasi |
| Ekspor | Unduh CSV daftar hadir |

Data grafik diperbarui otomatis (polling tiap 30 detik) dan dapat di-refresh manual.

### 6.4 Manajemen Kegiatan (`/admin/kegiatan`)

Halaman ini berisi tiga bagian (tab):

**a. Input Acara Kegiatan**
- Field: nama kegiatan, tanggal, waktu, lokasi, deskripsi (opsional), status (Draft / Aktif / Selesai).
- Fungsi: tambah, ubah, hapus, dan aktifkan kegiatan.
- Hanya **satu** kegiatan boleh berstatus Aktif pada satu waktu (membuka form absensi peserta).

**b. Input Desa**
- Field: nama desa.
- Fungsi: tambah, ubah, hapus (hapus diblokir jika sudah memiliki kelompok atau data absensi; gunakan opsi nonaktifkan).
- Data awal: Bandara, Cengkareng, Kalideres, Cipondoh.

**c. Input Kelompok**
- Field: nama kelompok, desa (pilih dari daftar desa).
- Fungsi: tambah, ubah, hapus/nonaktifkan.
- Nama kelompok unik dalam satu desa.

### 6.5 Pembagian Kelompok Acak (`/admin/kegiatan/[id]/pembagian`)

> **Asumsi:** "Kelompok" pada form pendaftaran adalah kelompok asal peserta. "Pembagian kelompok acak" adalah pembagian peserta hadir ke dalam **kelompok kegiatan** (misal kelompok diskusi/halaqah) pada hari acara. Mohon konfirmasi bila maksudnya berbeda.

**Alur**
1. Admin memilih kegiatan, lalu memasukkan **jumlah kelompok** atau **jumlah anggota per kelompok**.
2. Opsi **pemerataan**: acak murni, atau acak dengan distribusi seimbang (peserta dari desa yang sama disebar merata ke setiap kelompok kegiatan agar tercampur).
3. Sistem mengacak peserta yang sudah hadir (algoritma Fisher–Yates) lalu membaginya.
4. Admin melihat pratinjau, dapat **acak ulang**, lalu **simpan** hasilnya.
5. Hasil dapat dilihat sebagai tabel per kelompok, dicetak, dan diekspor CSV.

**Aturan**
- Hanya peserta berstatus hadir pada kegiatan tersebut yang diikutkan.
- Hasil yang sudah disimpan terkunci; mengacak ulang perlu konfirmasi dan menimpa hasil lama.
- Selisih jumlah anggota antar kelompok maksimal 1 orang.

## 7. Model Data (SQLite / D1)

```
admins
- id (PK)
- username (unique)
- password_hash
- created_at

events
- id (PK)
- name
- event_date
- event_time
- location
- description
- status            -- draft | active | finished
- created_at

villages
- id (PK)
- name (unique)
- is_active

groups
- id (PK)
- village_id (FK -> villages.id)
- name
- is_active
- UNIQUE (village_id, name)

attendances
- id (PK)
- event_id (FK -> events.id)
- full_name
- village_id (FK -> villages.id)
- group_id (FK -> groups.id)
- age
- occupation
- created_at
- UNIQUE (event_id, lower(full_name), village_id, group_id)

event_groups                -- kelompok hasil pembagian acak
- id (PK)
- event_id (FK -> events.id)
- name                      -- contoh: "Kelompok 1"

event_group_members
- id (PK)
- event_group_id (FK -> event_groups.id)
- attendance_id (FK -> attendances.id, unique)
```

Index disarankan: `attendances(event_id)`, `attendances(village_id)`, `attendances(group_id)`, `groups(village_id)`.

## 8. Endpoint API (Ringkas)

| Method | Path | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/public/active-event` | Publik | Cek kegiatan aktif |
| GET | `/api/public/villages` | Publik | Daftar desa |
| GET | `/api/public/groups?villageId=` | Publik | Kelompok berdasarkan desa |
| POST | `/api/public/attendance` | Publik | Kirim absensi |
| POST | `/api/admin/login` / `logout` | Admin | Autentikasi |
| GET | `/api/admin/stats?eventId=` | Admin | Data grafik dashboard |
| GET | `/api/admin/attendances` | Admin | Daftar hadir (filter, paginasi) |
| GET | `/api/admin/attendances/export` | Admin | Ekspor CSV |
| CRUD | `/api/admin/events` | Admin | Kelola kegiatan |
| CRUD | `/api/admin/villages` | Admin | Kelola desa |
| CRUD | `/api/admin/groups` | Admin | Kelola kelompok |
| POST | `/api/admin/events/[id]/shuffle` | Admin | Pratinjau pembagian acak |
| POST | `/api/admin/events/[id]/shuffle/save` | Admin | Simpan hasil pembagian |

## 9. Kebutuhan Non-Fungsional

- **Performa:** halaman publik dimuat < 2 detik pada jaringan 4G.
- **Keamanan:** hash password, cookie HTTP-only + Secure + SameSite, validasi input server-side (Zod), proteksi CSRF, query terparameter (ORM), rate limiting, secret disimpan di Cloudflare secrets.
- **Ketersediaan:** memanfaatkan jaringan edge Cloudflare.
- **Kompatibilitas:** Chrome, Safari, Firefox versi terbaru; mobile-first.
- **Privasi:** data peserta hanya diakses admin; tidak ada data sensitif selain nama, umur, dan pekerjaan; hanya dikumpulkan seperlunya.
- **Backup:** ekspor CSV rutin dan fitur D1 Time Travel/backup.

## 10. Struktur Halaman

```
/                               -> Form absensi peserta
/sukses                         -> Konfirmasi setelah kirim
/admin/login                    -> Login admin
/admin/dashboard                -> Grafik & tabel kehadiran
/admin/kegiatan                 -> Tab: Acara | Desa | Kelompok
/admin/kegiatan/[id]/pembagian  -> Pembagian kelompok acak
```

## 11. Alur Utama

**Peserta:** buka website → isi nama → pilih desa → pilih kelompok (terfilter) → isi umur & pekerjaan → Kirim → konfirmasi hadir.

**Admin:** login → buat kegiatan & aktifkan → peserta mengisi absensi → pantau dashboard → tutup kegiatan → jalankan pembagian kelompok acak → simpan/cetak hasil.

## 12. Rencana Deployment (Cloudflare)

1. Buat database D1 (`wrangler d1 create absensi-pengajian`).
2. Jalankan migrasi Drizzle dan seed data awal (4 desa, akun admin).
3. Konfigurasikan `wrangler.toml` dengan binding D1 dan secrets (`AUTH_SECRET`, `ADMIN_SEED_*`).
4. Build menggunakan `@opennextjs/cloudflare`, lalu deploy lewat `wrangler deploy`.
5. Hubungkan domain kustom dan aktifkan HTTPS (otomatis oleh Cloudflare).
6. CI/CD via GitHub Actions (opsional).

## 13. Milestone

| Fase | Pekerjaan | Estimasi |
|---|---|---|
| 1 | Setup project, skema DB, seed, autentikasi admin | 2 hari |
| 2 | Form absensi peserta + validasi | 2 hari |
| 3 | Manajemen kegiatan, desa, kelompok | 3 hari |
| 4 | Dashboard grafik + tabel + ekspor | 3 hari |
| 5 | Pembagian kelompok acak | 2 hari |
| 6 | Pengujian, perbaikan, deploy ke Cloudflare | 2 hari |

Total estimasi: ± 14 hari kerja.

## 14. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Absensi ganda / data palsu | Validasi duplikat, Turnstile, rate limiting |
| Salah ketik nama | Normalisasi nama (trim, kapitalisasi); admin dapat mengedit data |
| Kredensial default lemah | Hash password, wajib ganti setelah login pertama |
| Keterbatasan SQLite di Cloudflare | Menggunakan D1 |
| Lonjakan akses saat acara | Edge Cloudflare + endpoint ringan |

## 15. Pertanyaan Terbuka

1. Apakah "kelompok" pembagian acak adalah kelompok baru lintas desa (kelompok diskusi), atau hanya pengacakan di dalam kelompok yang sudah ada?
2. Apakah peserta boleh absen tanpa batas waktu, atau perlu jam buka/tutup form per kegiatan?
3. Apakah diperlukan lebih dari satu akun admin (misal admin per desa)?
4. Apakah perlu field tambahan (jenis kelamin, nomor HP)? Hal ini berpengaruh pada pembagian yang seimbang.
