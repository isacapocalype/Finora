# Finora

Finora adalah aplikasi pencatatan keuangan pribadi untuk mengelola utang, piutang, target tabungan, dan riwayat transaksi. Aplikasi berjalan **tanpa login dan tanpa server**: seluruh data disimpan di perangkat melalui IndexedDB, sehingga bisa dibuka langsung kapan saja.

Dibangun tanpa framework frontend: HTML5, CSS3, dan vanilla JavaScript (ES Modules), lalu dikemas menjadi aplikasi Android dengan Capacitor.

## Fitur

- **Tanpa akun**: aplikasi langsung membuka dashboard, tidak ada halaman masuk, registrasi, atau reset password.
- **Penyimpanan lokal**: seluruh catatan tersimpan di penyimpanan aplikasi pada perangkat.
- **Dashboard**: total utang/piutang tersisa, total tabungan, target tabungan, grafik perkembangan, komposisi utang–piutang, dan aktivitas terbaru.
- **Utang**: tambah, lihat detail, edit, hapus, catat pembayaran, filter, dan pencarian.
- **Piutang**: tambah, lihat detail, edit, hapus, catat pengembalian, filter, dan pencarian.
- **Tabungan**: buat target, setor, tarik, edit, hapus, progres target, dan riwayat transaksi per target.
- **Riwayat**: filter kategori dan tanggal, pencarian, sorting, dan pagination. Riwayat dibentuk otomatis dari data utang, piutang, dan tabungan.
- **Pengaturan**: ubah nama profil yang dipakai pada sapaan dashboard dan sidebar.
- **Android**: status bar native, tombol kembali, dan splash screen.
- **Responsif** untuk desktop, tablet, dan ponsel.

Pembayaran utang, pengembalian piutang, serta setoran/penarikan tabungan ditulis dalam satu transaksi IndexedDB. Saldo dan status tidak pernah tersimpan setengah jalan, dan nominal tidak dapat melebihi sisa atau saldo yang tersedia.

## Teknologi

| Bagian | Teknologi |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 |
| Logika | Vanilla JavaScript (ES Modules) |
| Penyimpanan | IndexedDB (`finora-local`) |
| Grafik | Chart.js 4.4.7 |
| Ikon | Lucide 1.69.0 |
| Font | Plus Jakarta Sans |
| Aplikasi Android | Capacitor 8 |
| Build APK | GitHub Actions |

## Struktur Project

```text
.
├── index.html
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
│       ├── index.js
│       ├── local.js
│       ├── storage/
│       │   ├── db.js
│       │   └── id.js
│       ├── components/
│       └── services/
├── android/
├── scripts/
│   └── build-www.mjs
├── .github/workflows/android-release.yml
└── tests/
```

## Penyimpanan Data

Database lokal bernama `finora-local` (versi 1) berisi tabel:

- `profiles`
- `debts` dan `debt_payments`
- `receivables` dan `receivable_payments`
- `savings` dan `savings_transactions`

Semua baris memakai `user_id = 'local-device'`. Profil awal bernama **Pengguna Finora** dan dapat diubah dari halaman Pengaturan.

Data hanya tersimpan di perangkat. Tidak ada sinkronisasi, cadangan cloud, atau pengiriman data ke internet. Menghapus aplikasi atau membersihkan data aplikasi akan menghapus seluruh catatan secara permanen. Pindahkan data secara manual jika ingin berpindah perangkat.

## Menjalankan Secara Lokal

Gunakan Node.js 22 atau lebih baru.

```bash
npm install
npm run dev
```

Buka `http://localhost:4173`. Aplikasi memerlukan origin HTTP (bukan `file://`) agar ES Module dan IndexedDB dapat berjalan.

## Pengujian

```bash
npm test
```

Perintah tersebut menjalankan:

| Perintah | Cakupan |
|---|---|
| `npm run test:storage` | CRUD utang, piutang, tabungan, profil, riwayat, dashboard, dan transaksi IndexedDB dengan `fake-indexeddb`. |
| `npm run test:utils` | Validasi nominal, tanggal, format mata uang, dan utilitas lain. |
| `npm run test:structure` | Kelengkapan berkas, impor JavaScript, struktur halaman, serta tidak adanya sisa modul login/cloud. |

## Build Web dan Android

```bash
npm run build
npx cap sync android
```

`npm run build` membuat bundle jembatan Capacitor lalu menyalin aplikasi ke `www/`. Setelah `npx cap sync android`, buka project `android/` di Android Studio atau build langsung:

```bash
cd android
./gradlew assembleDebug
```

APK debug dihasilkan di:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Rilis APK Otomatis

Workflow `.github/workflows/android-release.yml` berjalan saat tag `v*` dibuat atau lewat **Actions → Android Release APK → Run workflow**. Workflow akan:

1. Memasang dependensi dengan `npm ci`.
2. Menjalankan seluruh tes.
3. Membangun aset web dan menyinkronkan project Android.
4. Membuat APK debug.
5. Mengunggah APK beserta checksum SHA-256 sebagai artifact dan ke GitHub Release.

Contoh merilis versi baru:

```bash
git tag v2.0.0
git push origin v2.0.0
```

Versi aplikasi Android saat ini adalah `versionCode 2` / `versionName "2.0"`.

## Pemasangan APK

1. Unduh `app-debug.apk` dari GitHub Release.
2. Izinkan pemasangan dari sumber tidak dikenal pada perangkat Android.
3. Buka file APK dan pasang aplikasi.

Opsional, verifikasi unduhan:

```bash
sha256sum -c app-debug.apk.sha256
```

APK debug ditandatangani dengan kunci debug. Jika kunci dari build sebelumnya berbeda, Android dapat menolak pembaruan; hapus aplikasi lama terlebih dahulu. Menghapus aplikasi juga menghapus data lokalnya.

## Batasan

- Tidak ada login, sinkronisasi antarperangkat, atau cadangan otomatis.
- Data bergantung pada penyimpanan aplikasi Android. Pengguna bertanggung jawab menjaga perangkat dan melakukan pencatatan ulang bila data hilang.
- Build saat ini adalah APK debug untuk pemasangan langsung (sideload), bukan untuk Play Store.

Versi cloud sebelumnya tetap dapat dipulihkan dari riwayat Git (commit `6e6504b`) bila suatu saat diperlukan.
