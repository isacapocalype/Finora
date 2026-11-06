# DESIGN.md — FINORA
## Modern Personal Finance Tracker

**Design Version:** 1.0  
**Product:** Finora  
**Design Style:** Modern Glassmorphism  
**Primary Colors:** White, Purple, Lavender  
**Platform:** Desktop & Mobile Web

---

# 1. Design Philosophy

Finora menggunakan konsep desain modern glassmorphism dengan tampilan bersih, elegan, minimalis, dan profesional.

Pengalaman pengguna harus terasa:
- Clean — tampilan tidak ramai.
- Modern — menggunakan komponen UI modern.
- Soft — warna lembut dan tidak menyilaukan.
- Intuitive — navigasi mudah dipahami.
- Responsive — nyaman digunakan di semua ukuran layar.

Desain tidak boleh terlalu banyak menggunakan efek blur, gradient, atau dekorasi yang mengganggu keterbacaan informasi keuangan.

# 2. Color System

## Primary Palette

| Token | Hex | Penggunaan |
|---|---|---|
| Primary | #7C3AED | Tombol utama, active state |
| Primary Hover | #6D28D9 | Hover tombol |
| Purple Light | #EDE9FE | Background aksen |
| Lavender | #C4B5FD | Decorative accent |
| White | #FFFFFF | Card dan surface |
| Background | #F8F7FC | Background utama |

## Neutral Palette

| Token | Hex | Penggunaan |
|---|---|---|
| Text Primary | #25213A | Judul dan teks utama |
| Text Secondary | #817B91 | Deskripsi |
| Text Muted | #A6A1B2 | Informasi tambahan |
| Border | #ECE8F3 | Garis pembatas |
| Surface | #FFFFFF | Card |
| Glass | rgba(255,255,255,0.72) | Glass surface |

## Semantic Colors

| Status | Color | Background |
|---|---|---|
| Success | #16A34A | #DCFCE7 |
| Danger | #EF4444 | #FEE2E2 |
| Warning | #F59E0B | #FEF3C7 |
| Info | #3B82F6 | #DBEAFE |

Penggunaan:
- Hijau untuk transaksi berhasil dan tabungan.
- Merah untuk utang dan pengeluaran.
- Kuning untuk jatuh tempo.
- Biru untuk informasi.

# 3. Typography

Gunakan font **Plus Jakarta Sans** sebagai font utama.

Fallback:
`Inter, sans-serif`

| Element | Size | Weight |
|---|---:|---:|
| Dashboard Title | 26px | 700 |
| Page Title | 24px | 700 |
| Section Title | 18px | 600 |
| Card Value | 26px | 700 |
| Body | 14px | 400 |
| Caption | 12px | 400 |
| Button | 14px | 600 |

Typography harus konsisten dan mudah dibaca.

# 4. Glassmorphism System

## Glass Card

Karakteristik:
- Background putih transparan.
- Backdrop blur.
- Border putih transparan.
- Shadow lembut.
- Border radius 18px.

CSS reference:

```css
.glass-card {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.85);
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(91, 63, 140, 0.06);
}
```

## Background

Gunakan background putih lavender dengan dekorasi gradient radial yang sangat halus.

```css
body {
  background:
    radial-gradient(
      circle at 10% 10%,
      rgba(196,181,253,0.18),
      transparent 35%
    ),
    radial-gradient(
      circle at 90% 80%,
      rgba(167,139,250,0.12),
      transparent 35%
    ),
    #F8F7FC;
}
```

# 5. Layout System

## Desktop Layout

Ukuran referensi:
- Sidebar: 250px.
- Main content: fleksibel.
- Content padding: 32px.
- Card gap: 20px.
- Maximum content width: 1440px.

Struktur:

```text
┌─────────────────────────────────────────────────────────┐
│ SIDEBAR     │ HEADER                                    │
│             ├───────────────────────────────────────────┤
│ Logo        │                                           │
│             │ Dashboard                                 │
│ Dashboard   │                                           │
│ Utang       │ ┌─────────┐ ┌─────────┐ ┌──────────────┐ │
│ Piutang     │ │ Utang   │ │ Piutang │ │ Tabungan     │ │
│ Tabungan   │ │         │ │         │ │              │ │
│ Riwayat     │ └─────────┘ └─────────┘ └──────────────┘ │
│             │                                           │
│ Pengaturan  │ ┌─────────────────────┐ ┌───────────────┐ │
│             │ │ Grafik Keuangan     │ │ Quick Action  │ │
│             │ │                     │ │               │ │
│             │ └─────────────────────┘ └───────────────┘ │
│             │                                           │
│             │ ┌───────────────────────────────────────┐ │
│             │ │ Transaksi Terbaru                     │ │
│             │ └───────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Mobile Layout

Breakpoint:
- Mobile: max-width 767px.
- Tablet: 768px–1023px.
- Desktop: min-width 1024px.

Mobile:
- Sidebar disembunyikan.
- Bottom navigation digunakan.
- Konten menggunakan satu kolom.
- Card dapat menggunakan horizontal scrolling jika diperlukan.
- Form menggunakan full-width modal atau bottom sheet.

# 6. Navigation Design

## Sidebar

Logo:
- Icon dompet atau wallet.
- Nama Finora.
- Logo berwarna ungu.

Menu:

| Icon | Menu |
|---|---|
| Layout Dashboard | Dashboard |
| Arrow Down Left | Utang |
| Arrow Up Right | Piutang |
| Piggy Bank | Tabungan |
| History | Riwayat |
| Settings | Pengaturan |

Active state:
- Background lavender.
- Icon ungu.
- Text ungu.
- Border radius 12px.

Bottom section:
- User avatar.
- Nama pengguna.
- Email.
- Logout.

## Mobile Navigation

Navigasi bawah terdiri dari:
- Home.
- Utang.
- Piutang.
- Tabungan.
- Lainnya.

Gunakan icon Lucide dan label pendek.

# 7. Dashboard Design

## Header

Bagian atas berisi:
- Sapaan pengguna.
- Tanggal saat ini.
- Notifikasi.
- Avatar profil.

Contoh:

"Selamat pagi 👋"
"Berikut ringkasan keuanganmu hari ini."

## Summary Cards

Tampilkan empat kartu:

### Card 1 — Total Utang
- Icon wallet.
- Label Total Utang.
- Nominal.
- Jumlah utang aktif.
- Aksen merah muda.

### Card 2 — Total Piutang
- Icon hand-coins.
- Label Total Piutang.
- Nominal.
- Jumlah piutang aktif.
- Aksen biru muda.

### Card 3 — Total Tabungan
- Icon piggy-bank.
- Label Total Tabungan.
- Nominal saldo.
- Aksen ungu.

### Card 4 — Target Tabungan
- Icon target.
- Label Target Tabungan.
- Total target aktif.
- Aksen lavender.

Semua kartu menggunakan glass card.

## Financial Overview

Grafik perkembangan keuangan:
- Chart.js.
- Line chart.
- Periode mingguan dan bulanan.
- Tooltip ketika grafik disentuh.
- Grid minimalis.
- Warna ungu sebagai warna utama.

## Quick Actions

Tombol:
- + Tambah Utang.
- + Tambah Piutang.
- + Tambah Tabungan.

Gunakan tombol ungu solid untuk aksi utama dan tombol putih dengan border untuk aksi sekunder.

## Recent Transactions

Tabel berisi:
- Nama transaksi.
- Kategori.
- Tanggal.
- Nominal.
- Status.

Gunakan badge status dengan background pastel.

# 8. Utang Page Design

Header:
- Judul "Manajemen Utang".
- Deskripsi singkat.
- Tombol "+ Tambah Utang".

Summary:
- Total utang.
- Sudah dibayar.
- Sisa utang.

Table:
- Pemberi pinjaman.
- Nominal.
- Terbayar.
- Sisa.
- Jatuh tempo.
- Status.
- Action.

Action:
- Detail.
- Edit.
- Hapus.
- Bayar.

Form tambah utang:
- Nama pemberi pinjaman.
- Nominal.
- Tanggal transaksi.
- Jatuh tempo.
- Catatan.

Payment modal:
- Nominal pembayaran.
- Tanggal pembayaran.
- Catatan.
- Tombol simpan pembayaran.

# 9. Piutang Page Design

Header:
- Judul "Manajemen Piutang".
- Tombol "+ Tambah Piutang".

Summary:
- Total piutang.
- Sudah dikembalikan.
- Belum dikembalikan.

Table:
- Nama peminjam.
- Nominal.
- Sudah dikembalikan.
- Sisa piutang.
- Tanggal pengembalian.
- Status.
- Action.

Form tambah piutang:
- Nama peminjam.
- Nominal pinjaman.
- Tanggal pinjaman.
- Tanggal pengembalian.
- Catatan.

Payment modal:
- Nominal pengembalian.
- Tanggal.
- Catatan.

# 10. Tabungan Page Design

Header:
- Judul "Tabungan".
- Deskripsi.
- Tombol "+ Buat Tabungan".

Savings cards:

Setiap card menampilkan:
- Icon tabungan.
- Nama target.
- Saldo terkumpul.
- Target nominal.
- Progress bar.
- Persentase.
- Tanggal target.
- Tombol Setor.
- Tombol Tarik.
- Tombol Detail.

Progress bar:
- Gradient ungu.
- Background lavender.
- Height 8px.
- Border radius 100px.

Detail tabungan:
- Target nominal.
- Saldo saat ini.
- Total setoran.
- Total penarikan.
- Riwayat transaksi.
- Grafik perkembangan.

Form tabungan:
- Nama tabungan.
- Target nominal.
- Tanggal mulai.
- Target selesai.
- Deskripsi.

# 11. History Page Design

Header:
- Judul "Riwayat Transaksi".
- Deskripsi.

Filter:
- Semua transaksi.
- Utang.
- Piutang.
- Tabungan.
- Rentang tanggal.

List transaksi:
- Icon kategori.
- Nama transaksi.
- Deskripsi.
- Tanggal.
- Nominal.
- Jenis transaksi.

Gunakan tanda plus dan minus sesuai konteks transaksi.

# 12. Settings Page Design

Section:
- Profil pengguna.
- Informasi akun.
- Preferensi mata uang.
- Pengaturan tampilan.
- Keamanan akun.
- Logout.

Default currency:
IDR — Rupiah Indonesia.

# 13. Component Library

Seluruh komponen harus reusable.

## Buttons

Primary:
- Background: #7C3AED.
- Text: White.
- Radius: 12px.
- Height: 44px.

Secondary:
- Background: White.
- Border: #ECE8F3.
- Text: #25213A.

Danger:
- Background: #FEE2E2.
- Text: #DC2626.

## Inputs

- Background putih.
- Border #EAE5F5.
- Border radius 12px.
- Padding 12px 14px.
- Focus border ungu.
- Focus ring lavender.

## Modal

- Background putih.
- Border radius 20px.
- Shadow lembut.
- Overlay rgba(30,20,50,0.35).
- Animasi fade dan scale.

## Badge

Status:
- Lunas: hijau.
- Belum dibayar: merah muda.
- Sebagian: kuning.
- Aktif: ungu.
- Jatuh tempo: oranye.

## Empty State

Ketika belum ada data:
- Icon ilustrasi sederhana.
- Judul informatif.
- Deskripsi singkat.
- Tombol untuk membuat data pertama.

# 14. Interaction & Animation

Gunakan animasi sederhana:

- Card hover: translateY(-3px).
- Button hover: sedikit perubahan warna.
- Modal: fade-in dan scale.
- Sidebar: smooth transition.
- Progress bar: animasi pengisian.
- Toast: slide-in dari kanan.

Durasi:
- Hover: 180ms.
- Modal: 220ms.
- Transition: 200ms.

Hindari animasi berlebihan.

# 15. Responsive Rules

Desktop:
- Sidebar fixed.
- Dashboard grid 4 kolom.
- Grafik dan quick actions 2 kolom.
- Tabel tampil lengkap.

Tablet:
- Sidebar compact.
- Dashboard grid 2 kolom.
- Konten menyesuaikan lebar.

Mobile:
- Bottom navigation fixed.
- Dashboard grid 2 kolom untuk summary cards jika cukup.
- Tabel berubah menjadi card list.
- Modal memenuhi sebagian besar layar.
- Tombol aksi mudah dijangkau.
- Tidak boleh ada horizontal overflow.

# 16. Accessibility

- Kontras teks harus memadai.
- Setiap input mempunyai label.
- Tombol mempunyai nama yang jelas.
- Status tidak hanya dibedakan dengan warna.
- Navigasi mendukung keyboard.
- Focus state harus terlihat.
- Gunakan semantic HTML.

# 17. CSS Architecture

Gunakan CSS variables untuk konsistensi.

```css
:root {
  --primary: #7C3AED;
  --primary-hover: #6D28D9;

  --purple-light: #EDE9FE;
  --lavender: #C4B5FD;

  --background: #F8F7FC;
  --surface: #FFFFFF;

  --text-primary: #25213A;
  --text-secondary: #817B91;

  --border: #ECE8F3;

  --success: #16A34A;
  --danger: #EF4444;
  --warning: #F59E0B;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-xl: 24px;

  --shadow-card:
    0 8px 32px rgba(91,63,140,0.06);

  --transition: 200ms ease;
}
```

Struktur stylesheet:
- variables.css
- reset.css
- layout.css
- components.css
- dashboard.css
- pages.css
- responsive.css

# 18. Design Quality Checklist

- [ ] Konsistensi warna putih dan ungu.
- [ ] Glassmorphism tidak berlebihan.
- [ ] Typography konsisten.
- [ ] Sidebar berfungsi.
- [ ] Bottom navigation berfungsi.
- [ ] Seluruh card konsisten.
- [ ] Modal dan form seragam.
- [ ] Responsive desktop.
- [ ] Responsive tablet.
- [ ] Responsive mobile.
- [ ] Loading state.
- [ ] Empty state.
- [ ] Error state.
- [ ] Success notification.
- [ ] Accessibility dasar.

# 19. Final Design Direction

Finora harus memiliki tampilan seperti aplikasi SaaS keuangan premium.

Referensi karakter visual:
- Clean dashboard.
- White & purple interface.
- Soft glass cards.
- Minimalist financial charts.
- Rounded UI components.
- Elegant typography.
- Subtle lavender gradients.

**Final Design Identity:**

FINORA — Manage Money, Build Your Future.

Desain harus mengutamakan keterbacaan nominal, kemudahan pencatatan, dan navigasi yang sederhana. Seluruh halaman harus mengikuti design system yang sama.