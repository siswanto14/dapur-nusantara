# Panduan Singkat Dapur Nusantara Lite

Aplikasi pencatatan pesanan katering Anda. Data tersimpan di Google Sheets milik
Anda sendiri.

## Dua link yang perlu Anda simpan

| Link | Untuk siapa | Isi |
|---|---|---|
| **Link Admin** | Anda dan staf yang terdaftar | Kelola pesanan, menu, rekap, pengaturan |
| **Link Form Pesanan** | Pelanggan | Sudah terpasang di tombol "Pesan Sekarang" di website Anda |

Buka Link Admin dengan akun Google yang terdaftar sebagai admin. Simpan di layar
utama HP (menu browser > Tambahkan ke layar utama) agar cepat dibuka.

## Pekerjaan sehari-hari

1. **Pesanan masuk dari form**: muncul di tab **Pesanan** dengan status **Baru**.
   Ketuk pesanan untuk melihat detail, lalu **Jadikan Dikonfirmasi**.
2. **Pesanan dari chat/telepon**: tab **+ Pesanan baru**, isi data, pilih menu dan porsi, **Simpan**.
3. **Kirim ringkasan ke pelanggan**: tombol hijau **Kirim ke WhatsApp**.
4. **Ubah status** sesuai pekerjaan: Dikonfirmasi → Diproses → Dikirim → Selesai.
   Tekan **Tandai lunas** saat pelanggan sudah membayar.
5. **Pagi hari**: buka tab **Rekap harian** untuk melihat total porsi per menu (belanja
   dan masak) dan daftar pengiriman urut jam. Tekan **Cetak** bila perlu.

## Kapasitas harian

Batas porsi per hari diatur di tab **Pengaturan**. Saat terisi 90%, muncul peringatan.
Jika melebihi batas, pesanan ditolak; admin tetap bisa menyimpan dengan mencentang
**Override kapasitas**. Pelanggan di form tidak bisa melewati batas.

## Menu dan pengaturan

- Tab **Menu**: tambah menu, ubah harga, atau jadikan **Nonaktif** jika sedang tidak
  tersedia (tidak muncul di form). Perubahan harga tidak mengubah pesanan lama.
- Tab **Pengaturan**: nama usaha, no. WhatsApp, alamat, kapasitas, logo, warna,
  buka/tutup form pesanan.
- Menambah admin: isi email di sheet **Pengaturan** baris `admin_emails`, lalu bagikan
  spreadsheet ke email itu sebagai Editor.

## Penting

- Jangan bagikan file spreadsheet ke pelanggan. Pelanggan cukup Link Form Pesanan.
- Hindari mengubah judul kolom atau menghapus sheet. Mengubah isi `Menu` dan
  `Pengaturan` langsung di spreadsheet boleh.
- Jika muncul pesan "sistem sedang sibuk", tunggu beberapa detik lalu coba lagi.

## Bantuan

Dukungan gratis **3 bulan** sejak pemasangan (perbaikan, bantuan pemakaian,
penyesuaian pengaturan). Jika usaha Anda berkembang dan butuh invoice, pajak, kurir,
atau banyak staf dengan hak berbeda, tanyakan versi lengkap Dapur Nusantara.
