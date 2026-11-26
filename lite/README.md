# Dapur Nusantara Lite

Edisi ringan sistem pemesanan katering Dapur Nusantara, dibangun dengan
**Google Apps Script** dan **Google Sheets** sebagai database. Berjalan di akun
Google milik klien tanpa biaya hosting. Lite dipasang sebagai bonus paket website
company profile dan menjadi jalur *upgrade* ke versi Laravel.

Spesifikasi: PRD Lite Version (revisi 3, 26 Nov 2026).

## Isi folder

```
lite/
├── src/                  # kode yang di-push ke Apps Script (clasp rootDir)
│   ├── appsscript.json   # manifest: zona waktu Asia/Jakarta, runtime V8
│   ├── Logika.gs         # aturan bisnis murni (diuji di Node.js)
│   ├── Konfigurasi.gs    # struktur sheet dan pengaturan bawaan
│   ├── Data.gs           # baca/tulis sheet, LockService, cache pengaturan
│   ├── Akses.gs          # cek admin di server
│   ├── Menu.gs, Pesanan.gs, Rekap.gs, Arsip.gs
│   ├── Setup.gs          # menu "Dapur Nusantara" di spreadsheet
│   ├── WebApp.gs         # doGet + API untuk halaman
│   ├── Publik.html       # form pesanan pelanggan (tombol "Pesan Sekarang")
│   ├── Admin.html        # halaman admin
│   └── Gaya.html, Umum.html  # CSS dan JS bersama
├── tests/                # node --test (logika + alur lengkap di atas tiruan Apps Script)
├── alat/pratinjau.js     # pratinjau halaman di browser tanpa akun Google
└── PANDUAN-KLIEN.md      # panduan pemakaian 1 halaman untuk klien
```

## Fitur

| Fitur | Keterangan |
|---|---|
| Menu | Kode, nama, kategori, harga, aktif/nonaktif. Kelola di halaman admin atau langsung di sheet `Menu`. |
| Pesanan | Multi-item, nomor otomatis `DN-YYYYMMDD-001` per tanggal kirim, diskon dan ongkir, harga disalin ke `ItemPesanan` (snapshot). Bisa diubah selama status Baru/Dikonfirmasi. |
| Form publik | Untuk tombol "Pesan Sekarang" di website company profile. Status awal Baru, harga selalu dari server, paling cepat untuk besok, ada jebakan bot. Bisa disematkan lewat iframe. |
| Status | Baru → Dikonfirmasi → Diproses → Dikirim → Selesai, plus Dibatalkan sebelum Selesai. Bayar: Belum Bayar / Lunas. Semua perubahan masuk sheet `Log`. |
| Kapasitas | Satu angka global `kapasitas_harian` (bawaan **50 porsi/hari**). Peringatan di 90%, ditolak di atas 100% kecuali admin centang "Override kapasitas" (tercatat di `Log`). Form publik tidak bisa override. |
| Rekap harian | Ringkasan, daftar produksi dapur per menu, daftar pengiriman urut jam, pendapatan lunas/belum bayar. Bisa dicetak. Trigger harian pukul 05.00 WIB mengisi sheet `Rekap`. |
| WhatsApp | Tombol `wa.me` berisi ringkasan pesanan (tanpa API berbayar), untuk admin ke pelanggan dan pelanggan ke usaha. |
| Branding | Nama usaha, logo, warna utama dari sheet `Pengaturan`. |
| Info upgrade | Muncul di halaman admin jika pesanan > 100/hari selama 7 hari atau sel spreadsheet ≥ 80% batas. |
| Arsip | Menu spreadsheet "Arsipkan pesanan lama" memindahkan pesanan Selesai/Dibatalkan > 12 bulan ke file arsip. |

Tidak termasuk Lite (hanya versi Laravel): invoice PDF, pajak PBJT, kurir,
pembayaran sebagian, kapasitas per tanggal, peran admin/staf.

## Panduan pemasangan (untuk penjual, target < 30 menit)

Pemasangan dilakukan **di akun Google milik klien** (atau akun yang nanti
diserahkan ke klien), supaya data tetap milik klien.

### Cara A: dari template (disarankan setelah template pertama jadi)

1. Buka spreadsheet template Dapur Nusantara Lite, pilih **File > Buat salinan**.
   Skrip ikut tersalin. Beri nama misal `Pesanan - Katering Bu Ani`.
2. Lanjut ke langkah 3 di Cara B.

### Cara B: dari kode di repo ini (membuat template pertama)

1. Buat Google Sheets baru, buka **Ekstensi > Apps Script**.
2. Pasang kode dengan [clasp](https://github.com/google/clasp):
   ```bash
   npm install -g @google/clasp
   clasp login
   cd lite
   cp .clasp.json.example .clasp.json   # isi scriptId dari Apps Script > Setelan project
   clasp push
   ```
   Tanpa clasp: buat file dengan nama yang sama di editor Apps Script lalu salin isi
   setiap file di `src/` (file `.html` dibuat lewat **+ > HTML**, tanpa ekstensi di nama).
   Aktifkan "Tampilkan file manifes appsscript.json" di Setelan project lalu salin isinya.
3. Muat ulang spreadsheet. Muncul menu **Dapur Nusantara**. Jalankan:
   1. **Siapkan sheet** (izinkan akses saat diminta). Email Anda otomatis jadi admin.
   2. **Isi data contoh** (opsional, untuk demo).
   3. **Pasang rekap otomatis tiap pagi**.
4. Isi sheet **Pengaturan**: `nama_usaha`, `no_wa`, `alamat`, `kapasitas_harian`,
   `admin_emails` (email Google admin lain, pisahkan koma), `logo_url`, `warna_utama`.
   Jika data contoh dipakai, hapus baris contoh di `Menu`, `Pesanan`, dan `ItemPesanan`
   sebelum serah terima, lalu isi menu klien.
5. **Deploy dua kali** dari editor Apps Script (**Deploy > Deployment baru > Aplikasi web**):

   | Deployment | Jalankan sebagai | Yang memiliki akses | Dipakai untuk |
   |---|---|---|---|
   | **Publik** | Saya (pemilik) | Siapa saja | Form pesanan, tombol "Pesan Sekarang" |
   | **Admin** | Pengguna yang mengakses aplikasi web | Siapa saja yang memiliki Akun Google | Halaman admin, buka dengan `?halaman=admin` |

   Dua deployment diperlukan karena Apps Script hanya memberi tahu email pengguna jika
   skrip berjalan sebagai pengguna itu. Di deployment Publik email pengunjung selalu
   kosong, jadi pengunjung tidak mungkin menjadi admin.
6. Salin URL deployment Publik ke `url_publik` dan URL Admin + `?halaman=admin` ke
   `url_admin` di sheet Pengaturan.
7. **Bagikan spreadsheet (Editor) hanya ke email admin** yang ada di `admin_emails`.
   Deployment Admin berjalan sebagai admin yang login, jadi admin perlu akses edit.
   Jangan bagikan file ke pelanggan; pelanggan cukup URL Publik.
8. Pasang URL Publik di tombol **"Pesan Sekarang"** website company profile.
   Bisa juga disematkan:
   ```html
   <iframe src="URL_PUBLIK" style="width:100%;min-height:900px;border:0"></iframe>
   ```
   URL Apps Script panjang; gunakan pemendek URL atau QR code untuk brosur.
9. Uji: kirim satu pesanan dari URL Publik, lalu buka URL Admin dan konfirmasi pesanan itu.
10. Serahkan [PANDUAN-KLIEN.md](PANDUAN-KLIEN.md) ke klien. Masa dukungan gratis
    **3 bulan** sejak tanggal pemasangan.

Setiap kali kode diubah, perbarui deployment yang ada (**Deploy > Kelola deployment >
Edit > Versi baru**) agar URL tidak berubah.

### Catatan keamanan

- Admin divalidasi di server pada setiap panggilan, bukan hanya di tampilan.
- Input pengguna disimpan sebagai teks (diawali `'`) sehingga tidak bisa menjadi rumus.
- Jangan menyimpan data sensitif (nomor rekening pelanggan, KTP) di Lite.
- Sheet `Log`, `Rekap`, dan `ItemPesanan` diberi proteksi "peringatan" supaya tidak
  terubah tanpa sengaja. Kolom status memakai validasi data.

### Keterbatasan Apps Script

Kuota akun Gmail gratis (bisa berubah sewaktu-waktu): waktu eksekusi 6 menit per
panggilan, sekitar 30 eksekusi bersamaan, setiap panggilan server 1 sampai 3 detik.
Lite cocok sampai sekitar 150 pesanan/hari dan 5 admin. Di atas itu, tawarkan versi Laravel.

## Pengembangan

```bash
cd lite
npm test                 # 26 tes: logika + alur lengkap (siapkan sheet, pesanan, kapasitas, status, rekap, arsip)
npm run pratinjau        # http://localhost:8080/ dan http://localhost:8080/?halaman=admin
```

Pratinjau memakai tiruan Apps Script dengan data contoh di memori, jadi halaman bisa
dicoba tanpa akun Google. Tambahkan `&email=orang@gmail.com` untuk melihat tampilan
akses ditolak.

Nama kolom sheet sengaja disamakan dengan tabel versi Laravel (`menus`, `orders`,
`order_items`) untuk jalur migrasi lewat ekspor CSV di fase berikutnya.
