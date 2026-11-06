# ANTI_AI_SLOP.md
# FINORA — Anti AI Slop & Engineering Quality Rules

**Project:** Finora Personal Finance Tracker  
**Version:** 1.0  
**Document Type:** Engineering Quality Standard  
**Applies To:** All AI Coding Agents and Developers

---

# 1. PURPOSE

Dokumen ini dibuat untuk mencegah AI menghasilkan kode dan desain berkualitas rendah (AI Slop).

AI Slop adalah hasil pengerjaan yang terlihat selesai di permukaan, tetapi sebenarnya:
- Kode tidak terstruktur.
- Banyak fungsi tidak bekerja.
- UI terlihat generik.
- Tombol hanya dekorasi.
- Data tidak benar-benar tersimpan.
- Database tidak aman.
- Banyak kode duplikat.
- Menggunakan data dummy untuk menyamarkan fitur yang belum selesai.
- Mengabaikan dokumentasi project.
- Mengklaim pekerjaan selesai tanpa pengujian.

**Prinsip utama:**

Build real functionality, not fake progress.

Setiap baris kode harus memiliki tujuan yang jelas. Setiap fitur harus benar-benar bekerja. Setiap desain harus memiliki alasan UX.

# 2. ABSOLUTE RULES

Aturan berikut bersifat WAJIB dan tidak boleh dilanggar.

## 2.1 No Fake Functionality

DILARANG:
- Membuat tombol yang tidak memiliki fungsi.
- Membuat form yang tidak menyimpan data.
- Membuat transaksi yang hanya mengubah tampilan.
- Membuat grafik dengan angka statis pada aplikasi final.
- Membuat menu navigasi yang tidak bisa dibuka.
- Membuat fitur yang hanya menampilkan alert palsu.
- Menggunakan setTimeout untuk berpura-pura sedang memproses transaksi.
- Menampilkan notifikasi sukses sebelum database mengonfirmasi keberhasilan.

Jika fitur belum tersedia, tampilkan status yang jujur atau jangan tampilkan sebagai fitur aktif.

## 2.2 No Mock Data in Production

Jangan menggunakan:
- Hardcoded nominal keuangan.
- Dummy transaction.
- Fake user profile.
- Static dashboard statistics.
- Fake chart data.
- Fake payment history.

Data contoh hanya diperbolehkan dalam environment pengembangan dan harus dipisahkan secara jelas dari data produksi.

Dashboard harus mengambil data aktual dari Supabase.

Jika database kosong, tampilkan empty state yang benar.

## 2.3 No Placeholder Implementation

DILARANG meninggalkan kode seperti:

```javascript
// TODO: implement later
```

```javascript
function saveDebt() {
  // Coming soon
}
```

```javascript
function handlePayment() {
  alert("Payment successful");
}
```

Jangan menyatakan fitur selesai jika implementasinya masih berupa placeholder.

Jika ada fitur yang terblokir, dokumentasikan alasan dan tandai sebagai BLOCKED.

# 3. CODE QUALITY RULES

## 3.1 Clean Architecture

Pisahkan tanggung jawab kode.

Contoh:

```text
assets/js/
├── config/
│   └── supabase.js
│
├── services/
│   ├── debt.service.js
│   ├── receivable.service.js
│   └── savings.service.js
│
├── modules/
│   ├── auth.js
│   ├── dashboard.js
│   ├── debts.js
│   ├── receivables.js
│   ├── savings.js
│   └── history.js
│
├── components/
│   ├── modal.js
│   ├── toast.js
│   └── navigation.js
│
└── utils/
    ├── currency.js
    ├── date.js
    └── validation.js
```

Jangan mencampurkan:
- Database queries.
- UI rendering.
- Business logic.
- Input validation.

dalam satu fungsi besar.

## 3.2 No Spaghetti Code

DILARANG:
- Satu file berisi seluruh aplikasi.
- Fungsi terlalu panjang tanpa alasan.
- Nested conditional berlebihan.
- Variabel dengan nama tidak jelas.
- Duplikasi kode.
- Manipulasi DOM yang tidak terkontrol.
- Global variables yang tidak diperlukan.

Gunakan nama yang menjelaskan tujuan.

Buruk:

```javascript
function x(a, b) {
  return a - b;
}
```

Baik:

```javascript
function calculateRemainingDebt(
  totalDebt,
  totalPaid
) {
  return totalDebt - totalPaid;
}
```

## 3.3 No Unnecessary Dependencies

Gunakan teknologi yang sudah ditentukan dalam PRD.

Stack:
- HTML5.
- CSS3.
- Vanilla JavaScript.
- Supabase.
- Chart.js.
- Lucide Icons.

Jangan menambahkan framework hanya karena AI lebih mudah menggunakannya.

Jangan memasang library untuk fungsi sederhana yang dapat ditangani JavaScript native.

Setiap dependency baru harus memiliki alasan teknis.

# 4. UI/UX ANTI-GENERIC RULES

## 4.1 No Generic AI Dashboard

Hindari desain dashboard yang terlihat seperti template AI generik.

DILARANG:
- Terlalu banyak gradient.
- Semua card menggunakan warna berbeda tanpa alasan.
- Border dan shadow berlebihan.
- Terlalu banyak glass effect.
- Terlalu banyak elemen dekoratif.
- Ukuran font tidak konsisten.
- Layout penuh dengan card yang tidak berguna.
- Icon yang tidak sesuai konteks.
- Tombol dengan gaya berbeda-beda.
- Informasi penting tenggelam oleh dekorasi.

## 4.2 Follow Design System

Seluruh UI wajib mengikuti `DESIGN.md`.

Gunakan:
- White and purple palette.
- Soft lavender background.
- Subtle glassmorphism.
- Consistent spacing.
- Consistent typography.
- Rounded components.
- Minimalist icons.

Glassmorphism hanya digunakan untuk meningkatkan kualitas visual, bukan mengurangi keterbacaan.

## 4.3 Visual Hierarchy

Informasi harus memiliki prioritas visual.

Urutan prioritas dashboard:

1. Kondisi keuangan utama.
2. Jumlah utang dan piutang.
3. Saldo tabungan.
4. Target tabungan.
5. Grafik.
6. Riwayat transaksi.

Nominal keuangan harus lebih mudah terlihat dibanding dekorasi.

## 4.4 No Random Icons

Setiap icon harus sesuai makna.

Contoh:
- Utang: HandCoins atau Wallet.
- Piutang: HandCoins.
- Tabungan: PiggyBank.
- Riwayat: History.
- Pengaturan: Settings.
- Tambah transaksi: Plus.

Gunakan Lucide Icons secara konsisten.

# 5. FINANCIAL LOGIC INTEGRITY

Bagian ini sangat penting karena Finora mengelola data keuangan.

AI tidak boleh membuat asumsi perhitungan tanpa memahami business logic.

## 5.1 Precision

Jangan menggunakan floating-point untuk menyimpan nilai uang di database.

Gunakan PostgreSQL:

```sql
NUMERIC(15,2)
```

Hindari penggunaan JavaScript floating-point secara langsung untuk operasi finansial yang membutuhkan presisi.

Gunakan integer dalam satuan terkecil yang relevan atau strategi decimal yang konsisten saat melakukan perhitungan di frontend.

## 5.2 Debt Integrity

Sisa utang:

```text
Remaining Debt = Total Debt - Total Paid
```

Validasi:
- Pembayaran harus lebih besar dari nol.
- Pembayaran tidak boleh melebihi sisa.
- Tidak boleh ada pembayaran ganda akibat double click.
- Status lunas hanya ketika sisa utang nol.

## 5.3 Receivable Integrity

Sisa piutang:

```text
Remaining Receivable =
Total Receivable - Total Received
```

Validasi:
- Pengembalian harus lebih besar dari nol.
- Tidak boleh melebihi sisa piutang.
- Status lunas hanya ketika sisa piutang nol.

## 5.4 Savings Integrity

Saldo:

```text
Balance = Total Deposits - Total Withdrawals
```

Validasi:
- Setoran harus positif.
- Penarikan harus positif.
- Penarikan tidak boleh melebihi saldo.
- Saldo tidak boleh negatif.

## 5.5 Atomic Transactions

Semua operasi finansial yang melibatkan lebih dari satu perubahan database wajib menggunakan transaksi atomik melalui PostgreSQL function/RPC.

Jangan melakukan beberapa query terpisah tanpa perlindungan konsistensi.

Contoh:
1. Validasi data.
2. Kunci atau amankan record terkait.
3. Validasi ulang saldo terkini.
4. Simpan transaksi.
5. Perbarui saldo atau agregat.
6. Commit.

Jika gagal, rollback seluruh operasi.

# 6. DATABASE & SECURITY RULES

## 6.1 Supabase Security

DILARANG:
- Menaruh Service Role Key di frontend.
- Mematikan RLS untuk mempermudah coding.
- Membuat policy yang mengizinkan semua pengguna membaca semua data.
- Mengandalkan filter user_id di JavaScript sebagai pengamanan utama.
- Menganggap hidden UI sebagai security.

Semua tabel yang berisi data pengguna wajib memiliki RLS.

## 6.2 User Isolation

Pengguna A hanya boleh mengakses data miliknya sendiri.

Pengujian wajib:
- User A tidak dapat membaca utang User B.
- User A tidak dapat mengubah piutang User B.
- User A tidak dapat menghapus tabungan User B.
- User A tidak dapat menambahkan pembayaran ke utang User B.

Validasi harus dilakukan di database.

## 6.3 Data Integrity

Gunakan:
- Foreign keys.
- Unique constraints jika dibutuhkan.
- Check constraints.
- Not null constraints.
- Indexes.
- Proper timestamps.

Jangan mengandalkan frontend untuk menjaga integritas database.

# 7. ERROR HANDLING

Jangan menyembunyikan error.

Buruk:

```javascript
try {
  await saveData();
} catch (error) {
  console.log(error);
}
```

Baik:

```javascript
try {
  await saveData();

  showToast(
    "Data berhasil disimpan",
    "success"
  );

} catch (error) {
  console.error(
    "Failed to save data:",
    error
  );

  showToast(
    "Data gagal disimpan. Silakan coba lagi.",
    "error"
  );
}
```

Ketentuan:
- Berikan pesan yang mudah dipahami.
- Simpan detail teknis di console atau logging yang aman.
- Jangan membocorkan informasi sensitif.
- Jangan menampilkan sukses jika request gagal.
- Sediakan retry jika sesuai.

# 8. LOADING, EMPTY & ERROR STATES

Setiap halaman yang mengambil data dari Supabase wajib mempunyai tiga kondisi:

### Loading State

Ketika data sedang dimuat:
- Tampilkan skeleton.
- Hindari halaman kosong.
- Jangan menampilkan angka palsu.

### Empty State

Ketika belum ada transaksi:
- Tampilkan ilustrasi atau icon sederhana.
- Berikan penjelasan.
- Sediakan tombol untuk menambahkan data.

### Error State

Ketika request gagal:
- Tampilkan pesan error.
- Sediakan tombol coba lagi.
- Jangan mengganti error dengan data dummy.

# 9. FORM VALIDATION

Semua form wajib memiliki validasi.

Validasi minimum:
- Field wajib tidak boleh kosong.
- Nominal harus valid.
- Nominal harus lebih besar dari nol.
- Tanggal harus valid.
- Format data harus sesuai.
- Pembayaran tidak melebihi sisa.
- Penarikan tidak melebihi saldo.

Validasi frontend memberikan pengalaman pengguna yang baik.

Validasi database menjaga keamanan dan integritas data.

Keduanya wajib digunakan.

# 10. RESPONSIVE QUALITY

Jangan menganggap responsive hanya dengan menambahkan:

```css
@media (max-width: 768px) {
  /* responsive */
}
```

Setiap halaman harus benar-benar diperiksa pada:

| Device | Width |
|---|---:|
| Small Mobile | 320px |
| Mobile | 375px |
| Large Mobile | 430px |
| Tablet | 768px |
| Laptop | 1024px |
| Desktop | 1440px |

Pastikan:
- Tidak ada horizontal overflow.
- Tombol dapat disentuh dengan nyaman.
- Modal tidak keluar layar.
- Tabel memiliki alternatif tampilan mobile.
- Bottom navigation tidak menutupi konten.
- Text tidak terpotong secara tidak sengaja.

# 11. PERFORMANCE RULES

AI harus memperhatikan:
- Query database yang efisien.
- Hindari query berulang yang tidak diperlukan.
- Gunakan pagination untuk data besar.
- Gunakan index pada kolom pencarian dan foreign key yang relevan.
- Hindari rendering seluruh halaman untuk perubahan kecil.
- Hindari pemuatan library berulang.
- Optimalkan asset.
- Hindari event listener duplikat.

Jangan melakukan optimasi prematur yang membuat kode sulit dipahami.

# 12. CODE REVIEW BEFORE COMPLETION

Sebelum menyatakan suatu phase selesai, AI harus melakukan pemeriksaan:

### Functionality
- [ ] Semua tombol berfungsi.
- [ ] Semua form berfungsi.
- [ ] CRUD benar-benar terhubung ke Supabase.
- [ ] Data dapat dimuat kembali setelah refresh.
- [ ] Tidak ada fitur palsu.

### Code Quality
- [ ] Tidak ada placeholder.
- [ ] Tidak ada fungsi duplikat yang tidak perlu.
- [ ] Tidak ada error JavaScript.
- [ ] Tidak ada query yang tidak digunakan.
- [ ] Struktur kode konsisten.

### Security
- [ ] RLS aktif.
- [ ] Tidak ada Service Role Key di frontend.
- [ ] User isolation diuji.
- [ ] Validasi database tersedia.

### UI/UX
- [ ] Sesuai DESIGN.md.
- [ ] Responsive.
- [ ] Loading state tersedia.
- [ ] Empty state tersedia.
- [ ] Error state tersedia.

### Financial Accuracy
- [ ] Pembayaran benar.
- [ ] Pengembalian benar.
- [ ] Setoran benar.
- [ ] Penarikan benar.
- [ ] Tidak terjadi saldo negatif.
- [ ] Tidak terjadi transaksi ganda.

# 13. ANTI-HALLUCINATION RULES

AI DILARANG:

- Mengaku sudah menguji kode jika belum menjalankan pengujian.
- Mengklaim database berhasil terhubung tanpa verifikasi.
- Menganggap fitur berfungsi hanya karena tidak ada error visual.
- Mengarang hasil query.
- Mengarang struktur tabel yang belum dibuat.
- Mengatakan deployment berhasil tanpa memeriksa hasil deployment.
- Menandai task Completed tanpa bukti implementasi.

Jika tidak dapat menguji sesuatu, tuliskan secara jujur:

`NOT VERIFIED — membutuhkan pengujian manual atau akses tambahan.`

# 14. CHANGE MANAGEMENT

Sebelum mengubah arsitektur atau struktur database:

1. Periksa implementasi saat ini.
2. Identifikasi dampak perubahan.
3. Periksa ketergantungan antarfitur.
4. Pertahankan data yang sudah ada.
5. Hindari perubahan destruktif.
6. Buat migration SQL jika diperlukan.
7. Uji perubahan.

Jangan menghapus tabel, kolom, atau file hanya karena AI merasa tidak membutuhkannya.

Jangan menimpa kode yang sudah bekerja tanpa alasan yang jelas.

# 15. AI SELF-REVIEW PROTOCOL

Setelah menyelesaikan setiap task, AI wajib menjawab pertanyaan berikut:

1. Apakah implementasi sesuai PRD?
2. Apakah implementasi mengikuti DESIGN.md?
3. Apakah kode benar-benar berfungsi?
4. Apakah database menyimpan data dengan benar?
5. Apakah security sudah diperhatikan?
6. Apakah ada placeholder?
7. Apakah ada bug yang belum diselesaikan?
8. Apakah pengujian benar-benar dijalankan?

Jika terdapat jawaban yang belum memenuhi standar, jangan tandai task sebagai selesai.

# 16. DEFINITION OF DONE

Sebuah fitur hanya boleh dianggap selesai jika:

- Implementasi tersedia.
- UI sudah terhubung dengan logic.
- Logic sudah terhubung dengan database.
- Validasi berfungsi.
- Error handling tersedia.
- Security diperiksa.
- Pengujian berhasil.
- Tidak ada placeholder.
- Dokumentasi diperbarui.

Visual appearance alone does not mean a feature is complete.

# 17. FINAL COMMAND TO AI AGENT

You are not here to generate impressive-looking code quickly.

You are here to build a reliable, maintainable, secure, and fully functional financial application.

Prioritize engineering quality over code volume.

Never sacrifice financial accuracy for implementation speed.

Never sacrifice security for convenience.

Never sacrifice usability for visual decoration.

Do not generate unnecessary components, abstractions, dependencies, or features.

Read the existing project before modifying it.

Implement only what is needed, but implement it properly.

When something is uncertain, investigate before making assumptions.

When something is broken, fix the root cause instead of hiding the error.

When something is incomplete, report it honestly.

**Build Finora like a real production product, not an AI-generated demo.**