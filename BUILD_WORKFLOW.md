# BUILD_WORKFLOW.md
# FINORA — AI Development Execution Guide

**Project:** Finora Personal Finance Tracker  
**Version:** 1.0  
**Development Mode:** Step-by-Step Implementation  
**Target:** AI Coding Agent  
**Language:** Indonesian  
**Architecture:** HTML + CSS + Vanilla JavaScript + Supabase

---

# 1. INSTRUCTIONS FOR AI AGENT

Dokumen ini merupakan panduan utama pengerjaan project Finora.

AI Agent wajib membaca dan memahami dokumen berikut sebelum memulai pengerjaan:

1. `PRD.md` — Spesifikasi produk dan kebutuhan fitur.
2. `DESIGN.md` — Panduan desain UI/UX.
3. `BUILD_WORKFLOW.md` — Urutan pengerjaan dan aturan implementasi.

Ketiga dokumen tersebut memiliki fungsi berbeda dan harus digunakan secara bersamaan.

## Aturan Utama

AI Agent WAJIB:

- Mengikuti teknologi yang ditentukan.
- Tidak mengganti stack teknologi tanpa persetujuan.
- Tidak menghilangkan fitur yang sudah ditentukan dalam PRD.
- Mengikuti design system dalam DESIGN.md.
- Membangun aplikasi secara bertahap.
- Menulis kode yang modular dan mudah dipelihara.
- Menguji setiap fitur setelah selesai dibuat.
- Memastikan seluruh data tersimpan di Supabase.
- Memastikan data setiap pengguna terisolasi.
- Tidak menggunakan data dummy sebagai pengganti database pada implementasi final.
- Tidak mengklaim fitur selesai sebelum diuji.

## Teknologi yang Tidak Boleh Diganti

| Bagian | Teknologi |
|---|---|
| HTML | HTML5 |
| CSS | CSS3 |
| JavaScript | Vanilla JavaScript |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Charts | Chart.js |
| Icons | Lucide Icons |
| Font | Plus Jakarta Sans |

Dilarang menggunakan React, Vue, Angular, Next.js, atau framework frontend lainnya.

---

# 2. PROJECT OBJECTIVE

Membangun website Finora yang dapat digunakan untuk mengelola:

1. Utang pribadi.
2. Piutang pribadi.
3. Tabungan pribadi.
4. Riwayat transaksi.
5. Ringkasan kondisi keuangan.

Website harus memiliki:

- Authentication.
- Dashboard.
- CRUD lengkap.
- Database terintegrasi.
- Perhitungan keuangan otomatis.
- Responsive design.
- Security menggunakan Supabase RLS.

Hasil akhir harus berupa aplikasi yang benar-benar berfungsi, bukan sekadar prototype atau tampilan statis.

---

# 3. DEVELOPMENT STRATEGY

Gunakan metode pengembangan bertahap.

AI tidak boleh mengerjakan seluruh aplikasi dalam satu langkah besar.

Urutan pengerjaan:

```text
PROJECT INITIALIZATION
        |
        v
PROJECT STRUCTURE
        |
        v
SUPABASE CONFIGURATION
        |
        v
DATABASE & SECURITY
        |
        v
AUTHENTICATION
        |
        v
GLOBAL UI COMPONENTS
        |
        v
DASHBOARD
        |
        v
DEBT MANAGEMENT
        |
        v
RECEIVABLE MANAGEMENT
        |
        v
SAVINGS MANAGEMENT
        |
        v
TRANSACTION HISTORY
        |
        v
SETTINGS
        |
        v
INTEGRATION TESTING
        |
        v
BUG FIXING
        |
        v
DEPLOYMENT
```

Setiap tahap harus diselesaikan dan diuji sebelum melanjutkan ke tahap berikutnya.

---

# 4. DEVELOPMENT PHASES

# PHASE 1 — PROJECT INITIALIZATION

## Tujuan

Menyiapkan fondasi project dan struktur folder.

## Tasks

1. Buat folder utama `finora`.
2. Buat file HTML utama.
3. Buat folder CSS.
4. Buat folder JavaScript.
5. Buat folder konfigurasi.
6. Siapkan file dokumentasi.
7. Pastikan project dapat dijalankan secara lokal.

## Struktur Folder

```text
finora/
│
├── index.html
├── login.html
├── register.html
│
├── pages/
│   ├── dashboard.html
│   ├── debts.html
│   ├── receivables.html
│   ├── savings.html
│   ├── history.html
│   └── settings.html
│
├── assets/
│   ├── css/
│   │   ├── variables.css
│   │   ├── reset.css
│   │   ├── layout.css
│   │   ├── components.css
│   │   ├── dashboard.css
│   │   ├── pages.css
│   │   └── responsive.css
│   │
│   ├── js/
│   │   ├── config.js
│   │   ├── supabase.js
│   │   ├── auth.js
│   │   ├── app.js
│   │   ├── dashboard.js
│   │   ├── debts.js
│   │   ├── receivables.js
│   │   ├── savings.js
│   │   ├── history.js
│   │   └── utils.js
│   │
│   └── images/
│
├── database/
│   ├── schema.sql
│   ├── policies.sql
│   └── functions.sql
│
├── PRD.md
├── DESIGN.md
└── BUILD_WORKFLOW.md
```

## Acceptance Criteria

- Struktur folder selesai.
- Seluruh file utama tersedia.
- HTML dapat dijalankan.
- CSS dan JavaScript dapat dimuat.
- Tidak terdapat error dasar.

---

# PHASE 2 — SUPABASE CONFIGURATION

## Tujuan

Menghubungkan website dengan Supabase.

## Tasks

1. Buat project Supabase.
2. Ambil Project URL.
3. Ambil Publishable Key.
4. Buat konfigurasi Supabase Client.
5. Buat fungsi koneksi.
6. Uji koneksi database.

## Implementasi

Gunakan Supabase JavaScript Client melalui CDN atau ES Modules.

Buat file:

`assets/js/supabase.js`

Tanggung jawab:
- Inisialisasi Supabase.
- Menyediakan client untuk seluruh modul.
- Menjadi pusat koneksi database.

Jangan pernah menaruh Service Role Key di frontend.

## Acceptance Criteria

- Supabase berhasil terhubung.
- Client dapat digunakan di seluruh halaman.
- Tidak ada kredensial rahasia yang terekspos.

---

# PHASE 3 — DATABASE & SECURITY

## Tujuan

Membuat database yang mendukung seluruh fitur Finora.

## Tasks

Buat tabel:

1. profiles
2. debts
3. debt_payments
4. receivables
5. receivable_payments
6. savings
7. savings_transactions

## Relasi Database

```text
auth.users
    |
    +--- profiles
    |
    +--- debts
    |       |
    |       +--- debt_payments
    |
    +--- receivables
    |       |
    |       +--- receivable_payments
    |
    +--- savings
            |
            +--- savings_transactions
```

## Security

Aktifkan RLS pada seluruh tabel.

Buat policy:

- SELECT: hanya data milik pengguna.
- INSERT: hanya dapat membuat data dengan user_id sendiri.
- UPDATE: hanya dapat memperbarui data milik sendiri.
- DELETE: hanya dapat menghapus data milik sendiri.

Gunakan `auth.uid()` untuk validasi kepemilikan data.

Pastikan relasi foreign key juga mempertimbangkan kepemilikan user agar transaksi tidak dapat dikaitkan dengan data pengguna lain.

## Database Business Logic

Gunakan PostgreSQL RPC atau database transaction untuk operasi keuangan yang membutuhkan beberapa perubahan sekaligus.

Contoh:

Ketika pengguna membayar utang:

1. Validasi pemilik utang.
2. Validasi nominal pembayaran.
3. Periksa sisa utang.
4. Simpan pembayaran.
5. Perbarui paid_amount.
6. Perbarui status.
7. Commit seluruh operasi secara atomik.

Jika salah satu proses gagal, batalkan seluruh operasi.

Lakukan pendekatan yang sama pada pengembalian piutang, setoran tabungan, dan penarikan tabungan.

## Acceptance Criteria

- Semua tabel tersedia.
- Foreign key berfungsi.
- RLS aktif.
- Pengguna tidak dapat membaca data pengguna lain.
- Operasi keuangan aman dari perubahan saldo yang tidak konsisten.

---

# PHASE 4 — AUTHENTICATION

## Tujuan

Membuat sistem akun pengguna.

## Tasks

Buat halaman:

- Login.
- Register.
- Reset Password.

Implementasikan:

- Supabase signUp.
- Supabase signInWithPassword.
- Supabase signOut.
- Supabase onAuthStateChange.
- Session persistence.

## Flow Authentication

```text
USER OPENS WEBSITE
        |
        v
CHECK AUTH SESSION
        |
        +--- Session Found
        |        |
        |        v
        |     DASHBOARD
        |
        +--- No Session
                 |
                 v
              LOGIN
                 |
                 v
          AUTHENTICATION
                 |
          +------+------+
          |             |
       SUCCESS        FAILED
          |             |
          v             v
      DASHBOARD       ERROR
```

## Acceptance Criteria

- Register berfungsi.
- Login berfungsi.
- Logout berfungsi.
- Session tersimpan.
- Halaman privat tidak bisa diakses tanpa login.
- Password reset berfungsi.

---

# PHASE 5 — GLOBAL UI COMPONENTS

## Tujuan

Membangun komponen desain yang digunakan berulang kali.

Ikuti seluruh aturan dalam `DESIGN.md`.

## Components

Buat komponen:

- Sidebar.
- Header.
- Mobile navigation.
- Summary card.
- Glass card.
- Button.
- Input.
- Select.
- Modal.
- Table.
- Badge.
- Toast notification.
- Loading state.
- Empty state.
- Confirmation dialog.

## Design Rules

- Warna utama putih dan ungu.
- Menggunakan glassmorphism.
- Border radius konsisten.
- Shadow lembut.
- Font Plus Jakarta Sans.
- Lucide Icons.
- Responsif untuk mobile dan desktop.

## Acceptance Criteria

- Semua komponen memiliki tampilan konsisten.
- Navigasi berfungsi.
- Komponen dapat digunakan ulang.
- Tidak terdapat layout overflow.
- Tampilan sesuai DESIGN.md.

---

# PHASE 6 — DASHBOARD

## Tujuan

Menampilkan ringkasan keuangan pengguna.

## Tasks

Implementasikan:

1. Total utang.
2. Total piutang.
3. Total tabungan.
4. Total target tabungan.
5. Grafik perkembangan tabungan.
6. Grafik utang dan piutang.
7. Transaksi terbaru.
8. Quick actions.

## Data Source

Semua data harus diambil dari Supabase.

Jangan menggunakan angka statis untuk dashboard final.

## Perhitungan

Total utang aktif:

SUM(amount - paid_amount)

Total piutang aktif:

SUM(amount - received_amount)

Total tabungan:

SUM(current_amount)

Total target tabungan:

SUM(target_amount)

Gunakan nilai sisa yang tidak negatif dan filter berdasarkan user yang sedang login.

## Acceptance Criteria

- Dashboard mengambil data aktual.
- Nominal ditampilkan dalam format Rupiah.
- Grafik menampilkan data aktual.
- Data diperbarui setelah transaksi.
- Empty state tersedia jika belum ada data.

---

# PHASE 7 — DEBT MANAGEMENT

## Tujuan

Mengimplementasikan manajemen utang.

## Tasks

1. Menampilkan daftar utang.
2. Membuat utang.
3. Mengedit utang.
4. Menghapus utang.
5. Melihat detail utang.
6. Mencatat pembayaran.
7. Menampilkan riwayat pembayaran.
8. Filter dan pencarian.

## Payment Logic

Contoh:

Total utang: Rp1.000.000

Pembayaran pertama: Rp300.000

Sisa: Rp700.000

Pembayaran kedua: Rp200.000

Sisa: Rp500.000

Status: Dibayar sebagian.

Pembayaran ketiga: Rp500.000

Sisa: Rp0

Status: Lunas.

Semua perubahan harus tersimpan di database.

## Acceptance Criteria

- CRUD berfungsi.
- Pembayaran sebagian berfungsi.
- Pelunasan berfungsi.
- Riwayat pembayaran tersedia.
- Tidak bisa membayar melebihi sisa utang.

---

# PHASE 8 — RECEIVABLE MANAGEMENT

## Tujuan

Mengimplementasikan manajemen piutang.

## Tasks

1. Menampilkan daftar piutang.
2. Membuat piutang.
3. Mengedit piutang.
4. Menghapus piutang.
5. Melihat detail piutang.
6. Mencatat pengembalian.
7. Menampilkan riwayat pengembalian.
8. Filter dan pencarian.

## Return Logic

Contoh:

Total piutang: Rp2.000.000

Pengembalian pertama: Rp500.000

Sisa: Rp1.500.000

Pengembalian kedua: Rp500.000

Sisa: Rp1.000.000

Pengembalian terakhir: Rp1.000.000

Sisa: Rp0

Status: Lunas.

## Acceptance Criteria

- CRUD berfungsi.
- Pengembalian sebagian berfungsi.
- Pelunasan berfungsi.
- Riwayat pengembalian tersedia.
- Tidak bisa menerima lebih dari sisa piutang.

---

# PHASE 9 — SAVINGS MANAGEMENT

## Tujuan

Mengimplementasikan fitur tabungan.

## Tasks

1. Membuat target tabungan.
2. Mengedit target.
3. Menghapus target.
4. Melihat detail tabungan.
5. Menambah setoran.
6. Melakukan penarikan.
7. Menampilkan progress.
8. Menampilkan riwayat transaksi.

## Savings Logic

Contoh:

Target: Rp10.000.000

Setoran pertama: Rp2.000.000

Setoran kedua: Rp1.000.000

Saldo: Rp3.000.000

Penarikan: Rp500.000

Saldo: Rp2.500.000

Progress: 25%.

Rumus:

Progress = (Saldo / Target) × 100%

Progress visual tidak boleh melebihi 100%, tetapi saldo aktual tetap harus ditampilkan secara akurat.

## Acceptance Criteria

- CRUD target berfungsi.
- Setoran berfungsi.
- Penarikan berfungsi.
- Saldo otomatis diperbarui.
- Riwayat transaksi tersedia.
- Tidak bisa menarik melebihi saldo.

---

# PHASE 10 — TRANSACTION HISTORY

## Tujuan

Menampilkan seluruh aktivitas keuangan.

## Tasks

Tampilkan transaksi:

- Pembuatan utang.
- Pembayaran utang.
- Pembuatan piutang.
- Pengembalian piutang.
- Setoran tabungan.
- Penarikan tabungan.

Fitur:

- Filter kategori.
- Filter tanggal.
- Search.
- Sorting.
- Pagination.

Data riwayat harus berasal dari tabel transaksi terkait.

## Acceptance Criteria

- Semua aktivitas tercatat.
- Filter bekerja.
- Urutan tanggal benar.
- Nominal benar.
- Data tidak tercampur antar pengguna.

---

# PHASE 11 — SETTINGS

## Tujuan

Membuat pengaturan akun.

## Tasks

- Menampilkan profil.
- Mengubah nama pengguna.
- Mengubah preferensi mata uang jika didukung.
- Mengubah password.
- Logout.

## Acceptance Criteria

- Profil dapat diperbarui.
- Data tersimpan.
- Logout mengakhiri session.

---

# PHASE 12 — INTEGRATION TESTING

## Tujuan

Memastikan semua modul bekerja bersama.

## Test Scenarios

### Authentication

- Register pengguna baru.
- Login.
- Logout.
- Session expiration.

### Utang

- Tambah utang.
- Bayar sebagian.
- Lunasi utang.
- Coba bayar melebihi sisa.

### Piutang

- Tambah piutang.
- Terima pembayaran sebagian.
- Lunasi piutang.
- Coba menerima lebih dari sisa.

### Tabungan

- Buat target.
- Setor uang.
- Tarik uang.
- Coba menarik melebihi saldo.

### Security

- Pengguna A tidak bisa mengakses data pengguna B.
- Pengguna A tidak bisa mengubah data pengguna B.
- Pengguna A tidak bisa menghapus data pengguna B.
- Validasi foreign key lintas pengguna.

### UI/UX

- Desktop.
- Tablet.
- Smartphone.
- Loading.
- Empty state.
- Error state.
- Success notification.

---

# PHASE 13 — BUG FIXING & OPTIMIZATION

## Tasks

- Perbaiki JavaScript errors.
- Perbaiki database errors.
- Perbaiki UI overflow.
- Optimalkan query.
- Optimalkan loading.
- Periksa keamanan.
- Periksa duplikasi transaksi.
- Periksa konsistensi saldo.

Jangan menambahkan fitur baru sebelum bug kritis diselesaikan.

---

# PHASE 14 — DEPLOYMENT

## Target

Deploy website ke Vercel atau Netlify.

## Tasks

1. Siapkan repository Git.
2. Push project.
3. Konfigurasi environment variables.
4. Deploy.
5. Konfigurasi Supabase URL dan redirect.
6. Uji authentication pada domain produksi.
7. Uji RLS.
8. Uji semua fitur.

## Environment Variables

Contoh:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

Gunakan Publishable Key sesuai konfigurasi Supabase.

Jangan pernah memasukkan Service Role Key ke environment frontend.

## Acceptance Criteria

- Website dapat diakses melalui domain.
- Authentication bekerja.
- Database terhubung.
- Seluruh fitur utama berfungsi.
- Tidak ada kredensial rahasia yang terekspos.

---

# 5. AI CODING RULES

Aturan wajib selama proses pengerjaan.

## Rule 1 — Read Before Coding

Sebelum coding, baca:
- PRD.md
- DESIGN.md
- BUILD_WORKFLOW.md

Jangan mulai implementasi tanpa memahami ketiganya.

## Rule 2 — One Phase at a Time

Kerjakan satu phase sampai selesai.

Jangan melompat ke phase berikutnya jika acceptance criteria belum terpenuhi.

## Rule 3 — No Fake Functionality

Dilarang membuat:
- Tombol tanpa fungsi.
- Form yang tidak menyimpan data.
- Grafik dengan data palsu pada versi final.
- CRUD yang hanya mengubah tampilan.
- Dashboard dengan nominal hardcoded.

## Rule 4 — Code Quality

- Gunakan ES Modules.
- Pisahkan UI dan database logic.
- Gunakan async/await.
- Gunakan try/catch.
- Gunakan fungsi reusable.
- Hindari duplikasi kode.
- Gunakan semantic HTML.
- Hindari inline JavaScript.
- Berikan komentar pada logic kompleks.

## Rule 5 — Financial Accuracy

Semua operasi keuangan wajib divalidasi di server/database.

Gunakan operasi database yang atomik untuk mencegah:
- Double payment.
- Double withdrawal.
- Saldo negatif.
- Race condition.
- Perubahan data parsial.

## Rule 6 — Responsive First

Setiap halaman wajib diuji pada:
- 375px.
- 768px.
- 1024px.
- 1440px.

## Rule 7 — Documentation

Setelah setiap phase:
- Catat file yang dibuat.
- Catat fitur yang selesai.
- Catat hasil pengujian.
- Catat bug yang ditemukan.
- Catat pekerjaan yang belum selesai.

---

# 6. DEVELOPMENT PROGRESS TRACKER

AI wajib memperbarui status pekerjaan.

| Phase | Description | Status |
|---|---|---|
| 1 | Project Initialization | Completed |
| 2 | Supabase Configuration | In Progress |
| 3 | Database & Security | Completed |
| 4 | Authentication | In Progress |
| 5 | Global UI Components | In Progress |
| 6 | Dashboard | In Progress |
| 7 | Debt Management | In Progress |
| 8 | Receivable Management | In Progress |
| 9 | Savings Management | In Progress |
| 10 | Transaction History | In Progress |
| 11 | Settings | In Progress |
| 12 | Integration Testing | In Progress |
| 13 | Bug Fixing | In Progress |
| 14 | Deployment | Blocked |

Status yang diperbolehkan:
- Pending.
- In Progress.
- Completed.
- Blocked.

Jangan menandai phase Completed jika belum diuji.

## Catatan Verifikasi — 6 November 2026

Sudah diverifikasi:

- Struktur project lengkap; seluruh halaman, CSS, modul JavaScript, dan file SQL tersedia.
- 27 file JavaScript lolos `node --check`.
- Seluruh halaman utama dan aset mengembalikan HTTP 200 dari server lokal.
- `npm test` lulus: 12 pengujian SQL, 13 pengujian utilitas, dan 9 pengujian struktur.
- SQL dijalankan pada PostgreSQL 18.6 (PGlite), mencakup constraint, trigger, RLS lintas pengguna, pembatasan role anon, view riwayat, serta RPC pembayaran/pengembalian/setoran/penarikan yang atomik.
- `README.md` berisi dokumentasi instalasi, konfigurasi Supabase, pengujian, keamanan, dan deployment.
- Perbaikan hasil review kode: pesan error autentikasi kini terlihat, scroll halaman tidak terkunci setelah modal ditutup, request riwayat yang bersamaan tidak menimpa hasil terbaru, ikon tetap dirender saat script Lucide memakai `defer`, format Rupiah konsisten, dan warna nominal utang/piutang dibedakan.

Belum diverifikasi dan menjadi alasan status di atas:

- `assets/js/config.js` masih berisi placeholder Supabase; koneksi ke project Supabase sungguhan belum diuji.
- Registrasi, login, logout, reset password, CRUD, dan pembayaran end-to-end melalui browser belum diuji karena memerlukan project Supabase aktif.
- Uji visual responsif pada 375px, 768px, 1024px, dan 1440px belum dilakukan karena tidak tersedia browser otomasi pada lingkungan ini.
- Deployment belum dilakukan; repository Git juga belum diinisialisasi.

Phase 3 ditandai Completed karena implementasi dan pengujian SQL lokal lulus. SQL tetap wajib dijalankan pada project Supabase sebelum aplikasi digunakan.

---

# 7. AI WORKING PROTOCOL

Setiap kali memulai pekerjaan, AI harus mengikuti urutan berikut:

1. Identifikasi phase yang sedang dikerjakan.
2. Baca file yang berkaitan.
3. Periksa struktur project saat ini.
4. Periksa kode yang sudah tersedia.
5. Tentukan perubahan yang dibutuhkan.
6. Implementasikan perubahan.
7. Jalankan pengujian.
8. Perbaiki error.
9. Perbarui progress tracker.
10. Berikan laporan hasil pekerjaan.

Jika ada konfigurasi yang membutuhkan input pengguna, tanyakan hanya ketika benar-benar diperlukan.

Jangan menimpa kode yang sudah berfungsi tanpa alasan.

Jika menemukan bug pada phase sebelumnya, perbaiki terlebih dahulu.

---

# 8. FIRST EXECUTION TASK

Saat AI pertama kali menerima project Finora, jangan langsung membangun seluruh website.

Mulai dengan langkah berikut:

**TASK 01 — Project Audit & Initialization**

1. Baca PRD.md.
2. Baca DESIGN.md.
3. Baca BUILD_WORKFLOW.md.
4. Periksa apakah folder project sudah tersedia.
5. Periksa apakah ada kode yang sudah dibuat.
6. Buat laporan kondisi project.
7. Siapkan struktur folder Phase 1.
8. Implementasikan fondasi HTML, CSS, dan JavaScript.
9. Uji project secara lokal.
10. Laporkan hasil.

Setelah Phase 1 berhasil, lanjutkan Phase 2 sesuai persetujuan atau instruksi pengguna.

---

# 9. FINAL DELIVERY REQUIREMENTS

Hasil akhir wajib memiliki:

- Source code lengkap.
- Struktur folder rapi.
- Database schema SQL.
- RLS policies.
- Authentication.
- Dashboard aktif.
- Modul utang.
- Modul piutang.
- Modul tabungan.
- Riwayat transaksi.
- Settings.
- Responsive design.
- Dokumentasi instalasi.
- Dokumentasi konfigurasi Supabase.
- Dokumentasi deployment.

Aplikasi harus dapat dijalankan dan dikembangkan kembali oleh developer lain.

---

# 10. FINAL INSTRUCTION TO AI

You are the lead full-stack developer responsible for implementing Finora.

Your responsibility is to transform the product specification and design documentation into a fully functional personal finance web application.

Follow these priorities:

1. Correctness of financial calculations.
2. Database integrity.
3. User data security.
4. Functional completeness.
5. UI/UX quality.
6. Maintainable code.
7. Performance.

Do not skip development phases.

Do not fabricate completed work.

Do not replace the required technology stack.

Do not use mock data as a substitute for real database functionality.

Always verify your implementation before marking a task complete.

**Start with PHASE 1 — PROJECT INITIALIZATION.**