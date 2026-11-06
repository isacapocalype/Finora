# PRD — Finora
## Personal Finance Tracker Website

**Versi:** 1.0  
**Status:** MVP Planning  
**Platform:** Web Application  
**Bahasa:** Indonesia

---

# 1. Deskripsi Produk

Finora adalah website pencatatan keuangan pribadi yang membantu pengguna mengelola dan memantau kondisi keuangan dalam satu tempat.

Aplikasi ini berfokus pada tiga fitur utama:

1. Pencatatan utang — mencatat uang yang harus dibayar kepada orang lain.
2. Pencatatan piutang — mencatat uang yang dipinjam orang lain dari pengguna.
3. Tabungan — mencatat target tabungan, setoran, dan perkembangan saldo.

Finora dirancang dengan antarmuka modern, sederhana, intuitif, dan mudah digunakan melalui desktop maupun smartphone.

# 2. Tujuan Produk

- Memudahkan pengguna mencatat utang dan piutang.
- Memantau jumlah utang yang belum dibayar.
- Memantau jumlah piutang yang belum dikembalikan.
- Membantu pengguna mencapai target tabungan.
- Menampilkan ringkasan kondisi keuangan secara real-time.
- Menyimpan seluruh data secara aman menggunakan Supabase.

# 3. Target Pengguna

- Individu yang ingin mengatur keuangan pribadi.
- Pengguna yang sering meminjamkan atau meminjam uang.
- Pengguna yang memiliki beberapa target tabungan.
- Pengguna yang membutuhkan pencatatan keuangan sederhana tanpa aplikasi akuntansi kompleks.

# 4. Teknologi

| Komponen | Teknologi |
|---|---|
| Frontend | HTML5 |
| Styling | CSS3 |
| Programming | Vanilla JavaScript |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Backend API | Supabase |
| Chart | Chart.js |
| Icons | Lucide Icons |
| Font | Inter / Plus Jakarta Sans |
| Hosting | Vercel / Netlify |

**Ketentuan teknologi:**
- Tidak menggunakan framework frontend seperti React, Vue, atau Angular.
- Menggunakan JavaScript murni.
- Menggunakan Supabase JavaScript Client.
- Menggunakan Supabase Row Level Security (RLS).
- Struktur kode harus modular dan mudah dikembangkan.

# 5. Desain UI/UX

## Design Concept: Modern Glassmorphism

Tema visual menggunakan kombinasi warna putih, ungu, dan lavender.

### Color Palette

| Elemen | Warna |
|---|---|
| Primary | #7C3AED |
| Primary Dark | #6D28D9 |
| Secondary | #A78BFA |
| Background | #F8F7FF |
| Surface | #FFFFFF |
| Glass | rgba(255,255,255,0.65) |
| Text Primary | #25213A |
| Text Secondary | #89849B |
| Success | #16A34A |
| Danger | #EF4444 |
| Border | #EAE5F5 |

### Karakteristik Desain

- Glassmorphism dengan transparansi lembut.
- Background putih dengan aksen gradasi ungu dan lavender.
- Card dengan sudut membulat.
- Efek blur pada elemen glass.
- Shadow lembut dan elegan.
- Ikon minimalis.
- Animasi hover dan transisi halus.
- Typography modern dan mudah dibaca.
- Layout bersih dengan whitespace yang cukup.

### Responsive Design

Desktop:
- Sidebar navigasi di sebelah kiri.
- Dashboard di area utama.
- Ringkasan keuangan berbentuk cards.
- Tabel transaksi di bawah dashboard.

Mobile:
- Navigasi menggunakan bottom navigation.
- Dashboard satu kolom.
- Card menyesuaikan lebar layar.
- Form menggunakan modal atau bottom sheet.

# 6. Struktur Halaman

## 6.1 Authentication

Halaman autentikasi terdiri dari:

- Login.
- Register.
- Logout.
- Reset password.

Setiap pengguna memiliki akun dan data keuangan pribadi yang terpisah.

## 6.2 Dashboard

Dashboard merupakan halaman utama aplikasi.

### Informasi yang ditampilkan

**Ringkasan keuangan:**
- Total utang.
- Total piutang.
- Total tabungan.
- Jumlah target tabungan.

**Visualisasi:**
- Grafik perkembangan tabungan.
- Grafik perbandingan utang dan piutang.
- Riwayat transaksi terbaru.

**Quick Actions:**
- Tambah utang.
- Tambah piutang.
- Tambah tabungan.
- Catat pembayaran.
- Catat setoran.

## 6.3 Halaman Utang

Fitur untuk mencatat uang yang dipinjam pengguna dari orang lain.

Informasi yang dicatat:
- Nama pemberi pinjaman.
- Jumlah utang.
- Tanggal utang.
- Jatuh tempo.
- Keterangan.
- Status pembayaran.

Status:
- Belum dibayar.
- Dibayar sebagian.
- Lunas.

Fitur:
- Tambah utang.
- Edit utang.
- Hapus utang.
- Catat pembayaran.
- Lihat riwayat pembayaran.
- Filter berdasarkan status.
- Pencarian nama pemberi pinjaman.

## 6.4 Halaman Piutang

Fitur untuk mencatat uang yang dipinjam orang lain dari pengguna.

Informasi yang dicatat:
- Nama peminjam.
- Nominal piutang.
- Tanggal peminjaman.
- Tanggal pengembalian.
- Keterangan.
- Status pengembalian.

Status:
- Belum dikembalikan.
- Dikembalikan sebagian.
- Lunas.

Fitur:
- Tambah piutang.
- Edit piutang.
- Hapus piutang.
- Catat pengembalian.
- Riwayat pengembalian.
- Filter status.
- Pencarian nama peminjam.

## 6.5 Halaman Tabungan

Fitur untuk mengelola tabungan dan target keuangan.

Informasi tabungan:
- Nama tabungan.
- Target nominal.
- Saldo terkumpul.
- Tanggal mulai.
- Target tanggal selesai.
- Deskripsi.

Fitur:
- Membuat target tabungan.
- Menambah setoran.
- Mengambil uang dari tabungan.
- Melihat riwayat transaksi.
- Mengedit target.
- Menghapus target.

### Progress Tabungan

Setiap tabungan memiliki progress bar berdasarkan persentase pencapaian target.

Rumus:

Persentase = (Saldo terkumpul / Target) × 100%

Contoh:
Target Rp10.000.000  
Saldo Rp4.000.000  
Progress 40%.

## 6.6 Halaman Riwayat

Menampilkan seluruh aktivitas keuangan pengguna.

Kategori:
- Penambahan utang.
- Pembayaran utang.
- Penambahan piutang.
- Pengembalian piutang.
- Setoran tabungan.
- Penarikan tabungan.

Informasi:
- Tanggal.
- Kategori.
- Deskripsi.
- Nominal.
- Jenis transaksi.

Fitur:
- Filter kategori.
- Filter tanggal.
- Pencarian transaksi.
- Urutkan berdasarkan tanggal.

## 6.7 Halaman Pengaturan

- Profil pengguna.
- Nama pengguna.
- Email.
- Pengaturan mata uang (default IDR).
- Pengaturan tema.
- Ubah password.
- Logout.

# 7. Struktur Dashboard

Contoh susunan dashboard:

1. Header dengan sapaan pengguna dan profil.
2. Ringkasan keuangan dalam empat kartu.
3. Grafik perkembangan tabungan.
4. Ringkasan utang dan piutang.
5. Target tabungan aktif.
6. Transaksi terbaru.
7. Tombol tambah transaksi.

# 8. Database Design — Supabase

Menggunakan PostgreSQL dengan relasi berdasarkan user_id.

## 8.1 Table: profiles

| Column | Type |
|---|---|
| id | UUID (PK, FK auth.users) |
| full_name | TEXT |
| created_at | TIMESTAMPTZ |

## 8.2 Table: debts

| Column | Type |
|---|---|
| id | UUID (PK) |
| user_id | UUID (FK) |
| lender_name | TEXT |
| amount | NUMERIC(15,2) |
| paid_amount | NUMERIC(15,2) |
| transaction_date | DATE |
| due_date | DATE |
| description | TEXT |
| status | TEXT |
| created_at | TIMESTAMPTZ |

## 8.3 Table: receivables

| Column | Type |
|---|---|
| id | UUID (PK) |
| user_id | UUID (FK) |
| borrower_name | TEXT |
| amount | NUMERIC(15,2) |
| received_amount | NUMERIC(15,2) |
| transaction_date | DATE |
| due_date | DATE |
| description | TEXT |
| status | TEXT |
| created_at | TIMESTAMPTZ |

## 8.4 Table: savings

| Column | Type |
|---|---|
| id | UUID (PK) |
| user_id | UUID (FK) |
| name | TEXT |
| target_amount | NUMERIC(15,2) |
| current_amount | NUMERIC(15,2) |
| start_date | DATE |
| target_date | DATE |
| description | TEXT |
| created_at | TIMESTAMPTZ |

## 8.5 Table: savings_transactions

| Column | Type |
|---|---|
| id | UUID (PK) |
| savings_id | UUID (FK) |
| user_id | UUID (FK) |
| type | TEXT |
| amount | NUMERIC(15,2) |
| description | TEXT |
| transaction_date | DATE |
| created_at | TIMESTAMPTZ |

## 8.6 Table: debt_payments

| Column | Type |
|---|---|
| id | UUID (PK) |
| debt_id | UUID (FK) |
| user_id | UUID (FK) |
| amount | NUMERIC(15,2) |
| payment_date | DATE |
| description | TEXT |
| created_at | TIMESTAMPTZ |

## 8.7 Table: receivable_payments

| Column | Type |
|---|---|
| id | UUID (PK) |
| receivable_id | UUID (FK) |
| user_id | UUID (FK) |
| amount | NUMERIC(15,2) |
| payment_date | DATE |
| description | TEXT |
| created_at | TIMESTAMPTZ |

# 9. Business Logic

### Utang

Sisa utang = Total utang - Total pembayaran.

Jika sisa utang = 0, status menjadi lunas.

### Piutang

Sisa piutang = Total piutang - Total pengembalian.

Jika sisa piutang = 0, status menjadi lunas.

### Tabungan

Saldo tabungan = Total setoran - Total penarikan.

Progress tabungan dihitung berdasarkan saldo aktual dibagi target.

### Validasi

- Nominal harus lebih besar dari nol.
- Pembayaran tidak boleh melebihi sisa utang.
- Pengembalian tidak boleh melebihi sisa piutang.
- Penarikan tidak boleh melebihi saldo tabungan.
- Semua nominal menggunakan tipe NUMERIC, bukan floating-point untuk penyimpanan database.
- Perubahan saldo harus dilakukan secara konsisten menggunakan database transaction atau RPC PostgreSQL.

# 10. Security

Keamanan data merupakan prioritas utama.

- Menggunakan Supabase Authentication.
- Mengaktifkan Row Level Security pada seluruh tabel.
- Setiap pengguna hanya dapat membaca data miliknya.
- Setiap pengguna hanya dapat mengubah dan menghapus data miliknya.
- Menggunakan auth.uid() sebagai identitas pengguna pada policy RLS.
- Tidak menaruh Supabase Service Role Key di frontend.
- Menggunakan Supabase Anon/Publishable Key dengan RLS aktif.
- Validasi data dilakukan di frontend dan database.
- Memastikan transaksi pembayaran tidak dapat dimanipulasi untuk menghasilkan saldo negatif.

# 11. MVP Scope

Tahap pertama harus fokus pada fitur inti.

### Wajib tersedia

1. Register dan login.
2. Dashboard.
3. CRUD utang.
4. CRUD piutang.
5. Pencatatan pembayaran utang.
6. Pencatatan pengembalian piutang.
7. CRUD target tabungan.
8. Setoran dan penarikan tabungan.
9. Riwayat transaksi.
10. Database Supabase.
11. RLS dan isolasi data pengguna.
12. Responsive design.

### Fitur setelah MVP

- Export laporan PDF.
- Export Excel.
- Pengingat jatuh tempo.
- Grafik keuangan lebih lengkap.
- Dark mode.
- Notifikasi.
- Pencarian dan filter lanjutan.

# 12. Struktur Folder Project

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
│   │   ├── style.css
│   │   ├── dashboard.css
│   │   └── responsive.css
│   │
│   ├── js/
│   │   ├── supabase.js
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── debts.js
│   │   ├── receivables.js
│   │   ├── savings.js
│   │   ├── history.js
│   │   └── utils.js
│   │
│   └── images/
│
└── database/
    └── schema.sql
```

# 13. Acceptance Criteria

MVP dinyatakan berhasil apabila:

- Pengguna dapat mendaftar dan login.
- Pengguna dapat membuat dan mengelola utang.
- Pengguna dapat membuat dan mengelola piutang.
- Pembayaran sebagian dan lunas dihitung dengan benar.
- Pengguna dapat membuat beberapa target tabungan.
- Setoran dan penarikan memperbarui saldo dengan benar.
- Riwayat transaksi tersimpan.
- Dashboard menampilkan data yang sesuai dengan database.
- Data antar pengguna tidak dapat diakses satu sama lain.
- Website berjalan dengan baik pada desktop dan smartphone.
- Tidak ada kesalahan perhitungan saldo akibat transaksi berulang atau bersamaan.

# 14. Development Roadmap

**Phase 1 — Foundation**
- Setup project HTML, CSS, JavaScript.
- Setup Supabase.
- Membuat database dan RLS.
- Implementasi authentication.

**Phase 2 — Core Features**
- Implementasi utang.
- Implementasi piutang.
- Implementasi tabungan.
- Implementasi riwayat pembayaran dan setoran.

**Phase 3 — Dashboard**
- Ringkasan keuangan.
- Grafik Chart.js.
- Transaksi terbaru.
- Quick actions.

**Phase 4 — UI/UX**
- Glassmorphism design.
- Responsive desktop dan mobile.
- Animasi dan interaksi.
- Validasi form.

**Phase 5 — Testing & Deployment**
- Pengujian seluruh CRUD.
- Pengujian perhitungan keuangan.
- Pengujian keamanan RLS.
- Deployment website.

---

# 15. Final Product Vision

Finora harus menjadi aplikasi pencatatan keuangan pribadi yang ringan, cepat, modern, dan mudah digunakan.

Prioritas utama adalah akurasi pencatatan, kemudahan penggunaan, keamanan data, serta desain visual yang konsisten.

**Core Stack:** HTML + CSS + Vanilla JavaScript + Supabase.

**Design:** Modern Glassmorphism, White & Purple.

**Product Goal:** Satu dashboard untuk mengelola utang, piutang, dan tabungan pribadi.