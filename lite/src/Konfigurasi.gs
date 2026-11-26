/**
 * Struktur sheet dan pengaturan bawaan.
 * Nama kolom disamakan dengan tabel versi Laravel agar migrasi mudah.
 */

var SHEET = {
  MENU: 'Menu',
  PESANAN: 'Pesanan',
  ITEM: 'ItemPesanan',
  LOG: 'Log',
  REKAP: 'Rekap',
  PENGATURAN: 'Pengaturan',
};

var KOLOM = {
  Menu: ['id', 'kode', 'nama', 'kategori', 'harga', 'aktif', 'catatan'],
  Pesanan: [
    'id', 'nomor', 'nama_pelanggan', 'no_hp', 'alamat', 'tanggal_kirim', 'jam_kirim',
    'subtotal', 'diskon', 'ongkir', 'total', 'status', 'status_bayar', 'override_kapasitas',
    'catatan', 'dibuat_oleh', 'dibuat_pada', 'diubah_pada',
  ],
  ItemPesanan: ['id', 'pesanan_id', 'menu_id', 'nama_menu', 'harga_satuan', 'qty', 'jumlah'],
  Log: ['waktu', 'email', 'pesanan_id', 'aksi', 'nilai_lama', 'nilai_baru'],
  Rekap: ['tanggal', 'jumlah_pesanan', 'total_porsi', 'total_nilai', 'total_lunas', 'total_belum_bayar'],
  Pengaturan: ['kunci', 'nilai', 'keterangan'],
};

/** Pengaturan bawaan: [kunci, nilai, keterangan]. Bisa diubah di sheet Pengaturan. */
var PENGATURAN_BAWAAN = [
  ['nama_usaha', 'Dapur Nusantara', 'Nama usaha yang tampil di halaman dan pesan WhatsApp'],
  ['no_wa', '', 'No. WhatsApp usaha, contoh 081234567890'],
  ['alamat', '', 'Alamat usaha'],
  ['kapasitas_harian', 50, 'Batas total porsi per tanggal kirim. 0 = tanpa batas'],
  ['admin_emails', '', 'Email akun Google admin, pisahkan dengan koma (maks. 5 orang disarankan)'],
  ['form_publik_aktif', 'Ya', 'Ya/Tidak. Form pesanan untuk pelanggan (tombol "Pesan Sekarang")'],
  ['logo_url', '', 'URL gambar logo (opsional), misal dari website company profile'],
  ['warna_utama', '#b45309', 'Warna utama tampilan, format hex #RRGGBB'],
  ['pesan_terima_kasih', 'Terima kasih! Pesanan Anda sudah kami terima dan akan segera kami konfirmasi.',
    'Pesan setelah pelanggan mengirim form'],
  ['url_info_laravel', '', 'Tautan info versi lengkap (Laravel) untuk pemicu upgrade'],
  ['url_publik', '', 'URL web app Publik (diisi setelah deploy), dipasang di tombol "Pesan Sekarang"'],
  ['url_admin', '', 'URL web app Admin + ?halaman=admin (diisi setelah deploy)'],
  ['arsip_spreadsheet_id', '', 'Diisi otomatis saat pertama kali mengarsipkan pesanan lama'],
];

var KUNCI_CACHE_MENU = 'menu_v1';
var KUNCI_CACHE_PENGATURAN = 'pengaturan_v1';
var WARNA_BAWAAN = '#b45309';
var ZONA_WAKTU = 'Asia/Jakarta';
