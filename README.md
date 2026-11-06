# Finora

Finora adalah aplikasi pencatatan keuangan pribadi untuk mengelola utang, piutang, target tabungan, dan riwayat transaksi. Seluruh data disimpan di Supabase PostgreSQL dengan isolasi data per pengguna melalui Row Level Security (RLS).

Aplikasi dibangun tanpa framework frontend: HTML5, CSS3, dan vanilla JavaScript (ES Modules).

## Fitur

- Autentikasi: registrasi, login, logout, lupa password, dan reset password melalui Supabase Auth.
- Dashboard: total utang/piutang aktif, total tabungan, total target, grafik perkembangan tabungan, komposisi utang–piutang, dan aktivitas terbaru. Semua angka berasal dari database.
- Utang: tambah, lihat detail, edit, hapus, catat pembayaran, filter, dan pencarian.
- Piutang: tambah, lihat detail, edit, hapus, catat pengembalian, filter, dan pencarian.
- Tabungan: buat target, setor, tarik, edit, hapus, progres target, dan riwayat transaksi per target.
- Riwayat: filter kategori dan tanggal, pencarian, sorting, serta pagination di sisi server.
- Pengaturan: ubah nama profil dan password.
- Responsif untuk desktop, tablet, dan ponsel.

Operasi pembayaran utang, pengembalian piutang, setoran, dan penarikan tabungan dijalankan melalui RPC PostgreSQL yang atomik. Validasi saldo, kepemilikan data, dan pembaruan status dilakukan di database, bukan hanya di browser.

## Teknologi

| Bagian | Teknologi |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 |
| Logika | Vanilla JavaScript (ES Modules) |
| Database & Auth | Supabase (PostgreSQL) |
| Grafik | Chart.js 4.4.7 |
| Ikon | Lucide 1.69.0 |
| Font | Plus Jakarta Sans |

## Struktur Project

```text
.
├── index.html
├── login.html
├── register.html
├── forgot-password.html
├── reset-password.html
├── pages/
│   ├── dashboard.html
│   ├── debts.html
│   ├── receivables.html
│   ├── savings.html
│   ├── history.html
│   └── settings.html
├── assets/
│   ├── css/
│   └── js/
│       ├── app.js
│       ├── auth.js
│       ├── config.js
│       ├── supabase.js
│       ├── components/
│       └── services/
├── database/
│   ├── schema.sql
│   ├── functions.sql
│   └── policies.sql
└── tests/
```

## Menjalankan Secara Lokal

Tidak ada proses build. Sajikan folder project melalui HTTP server agar ES Modules dapat dimuat.

```bash
npm install
npm run dev
```

Buka `http://localhost:4173`.

> Jangan membuka file HTML langsung melalui protokol `file://`; import ES Module dan Supabase Auth memerlukan origin HTTP.

## Konfigurasi Supabase

### 1. Buat project Supabase

Buat project di [Supabase Dashboard](https://supabase.com/dashboard), lalu buka **Project Settings → API** untuk memperoleh:

- Project URL
- Publishable key (atau anon key pada project lama)

Jangan pernah memakai **Service Role Key** di frontend.

### 2. Jalankan SQL database

Buka **SQL Editor** pada Supabase, lalu jalankan file berikut **secara berurutan**:

1. `database/schema.sql`
2. `database/functions.sql`
3. `database/policies.sql`

Urutan ini wajib. `functions.sql` membuat trigger untuk `auth.users`, sedangkan `policies.sql` mengaktifkan RLS dan hak akses.

### 3. Isi konfigurasi frontend

Edit `assets/js/config.js`:

```js
export const SUPABASE_URL = 'https://PROJECT_ID.supabase.co';
export const SUPABASE_ANON_KEY = 'PUBLISHABLE_KEY';
```

Atau sediakan `window.FINORA_CONFIG = { SUPABASE_URL, SUPABASE_ANON_KEY }` sebelum modul aplikasi dimuat. Nilai ini bukan rahasia; keamanan data tetap dijaga oleh RLS.

### 4. Atur URL autentikasi

Di **Authentication → URL Configuration**, atur:

- **Site URL**: `http://localhost:4173` untuk pengembangan.
- **Redirect URLs**:
  - `http://localhost:4173/pages/dashboard.html`
  - `http://localhost:4173/reset-password.html`

Tambahkan URL domain produksi dengan pola yang sama setelah deploy.

Jika email confirmation diaktifkan, pengguna harus mengonfirmasi email sebelum dapat masuk. Template email dapat disesuaikan di **Authentication → Email Templates**.

## Pengujian

```bash
npm test
```

Perintah tersebut menjalankan tiga lapisan pengujian:

| Perintah | Cakupan |
|---|---|
| `npm run test:sql` | Menjalankan `schema.sql`, `functions.sql`, dan `policies.sql` pada PGlite; menguji trigger, constraint, RLS lintas pengguna, dan RPC keuangan atomik. |
| `npm run test:utils` | Menguji format Rupiah, validasi nominal, perhitungan sisa/progres, parsing tanggal, dan escape HTML. |
| `npm run test:structure` | Memeriksa kelengkapan file, referensi aset/import, struktur halaman, tidak adanya placeholder, dan tidak adanya service role key. |

PGlite menjalankan PostgreSQL asli secara lokal tanpa memerlukan koneksi ke project Supabase. Pengujian ini memvalidasi SQL, tetapi tidak menggantikan uji koneksi dan autentikasi ke project Supabase sungguhan.

## Alur Keamanan Data

- RLS aktif pada `profiles`, `debts`, `debt_payments`, `receivables`, `receivable_payments`, `savings`, dan `savings_transactions`.
- Policy `SELECT`/`UPDATE`/`DELETE` membatasi baris berdasarkan `user_id = auth.uid()`.
- Foreign key gabungan `(id, user_id)` mencegah transaksi dikaitkan ke data pengguna lain.
- Tabel pembayaran dan transaksi tabungan hanya memberi hak `SELECT`; penulisan wajib melalui RPC `SECURITY DEFINER`.
- Trigger database menghitung ulang `paid_amount`, `received_amount`, `current_amount`, dan `status` dari tabel transaksi sehingga nilai agregat tidak dapat dipalsukan dari klien.
- `transaction_history` adalah view `security_invoker` sehingga tetap tunduk pada RLS tabel sumber.

## Deployment

Aplikasi adalah situs statis dan dapat di-deploy ke Vercel, Netlify, atau static hosting lain.

1. Deploy file statis aplikasi (`index.html`, halaman autentikasi, `pages/`, dan `assets/`). Jangan menyertakan `node_modules/` atau `tests/` pada artefak produksi.
2. Isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` pada `assets/js/config.js` (atau mekanisme runtime config yang tersedia).
3. Tambahkan domain produksi ke **Site URL** dan **Redirect URLs** Supabase.
4. Uji registrasi, login, reset password, CRUD, dan RLS pada domain produksi.
5. Pastikan Service Role Key tidak pernah masuk ke bundle frontend.

## Status Verifikasi

Yang sudah diverifikasi di lingkungan pengembangan:

- Seluruh file halaman, CSS, modul JavaScript, dan SQL tersedia serta saling terhubung.
- Seluruh modul JavaScript lolos pemeriksaan sintaks.
- SQL dijalankan pada PostgreSQL 18.6 melalui PGlite; pengujian RLS, constraint, trigger, view riwayat, dan RPC lulus.
- Pengujian utilitas dan struktur project lulus.

Yang belum diverifikasi karena memerlukan kredensial/project Supabase:

- Koneksi ke project Supabase sungguhan.
- Registrasi, login, logout, dan reset password melalui Supabase Auth.
- Alur CRUD dan pembayaran end-to-end melalui browser.
- Uji responsif visual pada perangkat/emulator nyata.
- Deployment produksi.

Isi kredensial Supabase lalu lakukan uji integrasi sebelum menganggap aplikasi siap produksi.
