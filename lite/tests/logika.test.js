// Uji logika murni (src/Logika.gs). Jalankan: cd lite && npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./muat-logika');

test('format rupiah dan tanggal', () => {
  assert.equal(L.formatRupiah(1250000), 'Rp1.250.000');
  assert.equal(L.formatRupiah(0), 'Rp0');
  assert.equal(L.formatRupiah('35000.6'), 'Rp35.001');
  assert.equal(L.formatTanggal('2026-11-27'), '27/11/2026');
});

test('validasi tanggal dan jam', () => {
  assert.ok(L.tanggalValid('2026-02-28'));
  assert.ok(!L.tanggalValid('2026-02-30'));
  assert.ok(!L.tanggalValid('27/11/2026'));
  assert.ok(L.jamValid('09:30'));
  assert.ok(!L.jamValid('24:00'));
  assert.equal(L.tambahHari('2026-12-31', 1), '2027-01-01');
  assert.equal(L.tambahHari('2026-03-01', -1), '2026-02-28');
});

test('nomor pesanan urut per tanggal kirim', () => {
  assert.equal(L.buatNomorPesanan('2026-11-27', []), 'DN-20261127-001');
  const ada = ['DN-20261127-001', 'DN-20261127-002', 'DN-20261128-005'];
  assert.equal(L.buatNomorPesanan('2026-11-27', ada), 'DN-20261127-003');
  assert.equal(L.buatNomorPesanan('2026-11-28', ada), 'DN-20261128-006');
  assert.equal(L.buatNomorPesanan('2026-11-29', ada), 'DN-20261129-001');
});

test('normalisasi no HP ke format wa.me', () => {
  assert.equal(L.normalisasiNoHp('0812-3456-7890'), '6281234567890');
  assert.equal(L.normalisasiNoHp('+62 812 3456 7890'), '6281234567890');
  assert.equal(L.normalisasiNoHp('81234567890'), '6281234567890');
  assert.equal(L.normalisasiNoHp('123'), '');
});

test('status: maju satu langkah atau batal, Selesai/Dibatalkan final', () => {
  assert.deepEqual(L.statusBerikutnya('Baru'), ['Dikonfirmasi', 'Dibatalkan']);
  assert.deepEqual(L.statusBerikutnya('Dikirim'), ['Selesai', 'Dibatalkan']);
  assert.deepEqual(L.statusBerikutnya('Selesai'), []);
  assert.deepEqual(L.statusBerikutnya('Dibatalkan'), []);
  assert.ok(L.bolehUbahStatus('Diproses', 'Dibatalkan'));
  assert.ok(!L.bolehUbahStatus('Baru', 'Selesai'));
  assert.ok(!L.bolehUbahStatus('Selesai', 'Dibatalkan'));
});

const MENU = [
  { id: 1, nama: 'Nasi Kotak Ayam', harga: 35000, aktif: true },
  { id: 2, nama: 'Es Teh', harga: 5000, aktif: true },
  { id: 3, nama: 'Tumpeng', harga: 75000, aktif: false },
];

test('susun item: harga dari menu (snapshot), qty digabung', () => {
  const items = L.susunItem([{ menu_id: 1, qty: 10 }, { menu_id: 2, qty: '5' }, { menu_id: 1, qty: 2, harga: 1 }], MENU, true);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { menu_id: 1, nama_menu: 'Nasi Kotak Ayam', harga_satuan: 35000, qty: 12, jumlah: 420000 });
  assert.throws(() => L.susunItem([{ menu_id: 3, qty: 1 }], MENU, true), /tidak tersedia/);
  assert.equal(L.susunItem([{ menu_id: 3, qty: 1 }], MENU, false)[0].jumlah, 75000);
  assert.throws(() => L.susunItem([], MENU, true), /minimal satu menu/);
  assert.throws(() => L.susunItem([{ menu_id: 9, qty: 1 }], MENU, true), /tidak ditemukan/);
});

test('hitung total: subtotal - diskon + ongkir', () => {
  const items = [{ jumlah: 420000, qty: 12 }, { jumlah: 25000, qty: 5 }];
  assert.deepEqual(L.hitungTotal(items, 20000, 15000), { subtotal: 445000, diskon: 20000, ongkir: 15000, total: 440000, porsi: 17 });
  assert.throws(() => L.hitungTotal(items, 500000, 0), /Diskon/);
  assert.equal(L.hitungTotal(items, -5, -5).total, 445000);
});

test('kapasitas: peringatan di 90%, tolak di atas 100%', () => {
  assert.equal(L.cekKapasitas(30, 10, 50).level, 'aman');
  assert.equal(L.cekKapasitas(40, 5, 50).level, 'peringatan');
  const pas = L.cekKapasitas(40, 10, 50);
  assert.equal(pas.level, 'peringatan');
  assert.equal(pas.melebihi, false);
  const lebih = L.cekKapasitas(40, 11, 50);
  assert.equal(lebih.level, 'penuh');
  assert.equal(lebih.melebihi, true);
  assert.equal(lebih.sisa, 10);
  assert.equal(L.cekKapasitas(1000, 1000, 0).melebihi, false, 'kapasitas 0 berarti tanpa batas');
});

const PESANAN = [
  { id: 1, nomor: 'DN-20261127-001', tanggal_kirim: '2026-11-27', jam_kirim: '11:00', status: 'Baru', status_bayar: 'Lunas', total: 100000, nama_pelanggan: 'A' },
  { id: 2, nomor: 'DN-20261127-002', tanggal_kirim: '2026-11-27', jam_kirim: '09:00', status: 'Diproses', status_bayar: 'Belum Bayar', total: 50000, nama_pelanggan: 'B' },
  { id: 3, nomor: 'DN-20261127-003', tanggal_kirim: '2026-11-27', jam_kirim: '08:00', status: 'Dibatalkan', status_bayar: 'Belum Bayar', total: 70000, nama_pelanggan: 'C' },
  { id: 5, nomor: 'DN-20261127-004', tanggal_kirim: '2026-11-27', jam_kirim: '', status: 'Baru', status_bayar: 'Belum Bayar', total: 0, nama_pelanggan: 'E' },
  { id: 4, nomor: 'DN-20261128-001', tanggal_kirim: '2026-11-28', jam_kirim: '10:00', status: 'Baru', status_bayar: 'Belum Bayar', total: 30000, nama_pelanggan: 'D' },
];
const ITEM = [
  { pesanan_id: 1, nama_menu: 'Nasi Kotak Ayam', qty: 2 },
  { pesanan_id: 1, nama_menu: 'Es Teh', qty: 2 },
  { pesanan_id: 2, nama_menu: 'Nasi Kotak Ayam', qty: 1 },
  { pesanan_id: 3, nama_menu: 'Nasi Kotak Ayam', qty: 50 },
  { pesanan_id: 4, nama_menu: 'Es Teh', qty: 6 },
];

test('porsi terpakai mengabaikan pesanan batal dan pesanan yang sedang diedit', () => {
  assert.equal(L.porsiTerpakai('2026-11-27', PESANAN, ITEM), 5);
  assert.equal(L.porsiTerpakai('2026-11-27', PESANAN, ITEM, 1), 1);
});

test('rekap harian: produksi, pengiriman urut jam, pendapatan', () => {
  const r = L.hitungRekap('2026-11-27', PESANAN, ITEM);
  assert.equal(r.jumlah_pesanan, 3);
  assert.equal(r.total_porsi, 5);
  assert.deepEqual(r.produksi, [{ nama_menu: 'Es Teh', porsi: 2 }, { nama_menu: 'Nasi Kotak Ayam', porsi: 3 }]);
  assert.deepEqual(r.pengiriman.map((p) => p.nama_pelanggan), ['B', 'A', 'E'], 'tanpa jam di akhir');
  assert.equal(r.total_nilai, 150000);
  assert.equal(r.total_lunas, 100000);
  assert.equal(r.total_belum_bayar, 50000);
});

test('pesan WhatsApp berisi ringkasan dan link wa.me ter-encode', () => {
  const p = { nomor: 'DN-20261127-001', nama_pelanggan: 'Ibu Sari', tanggal_kirim: '2026-11-27', jam_kirim: '11:00', alamat: 'Jl. Merdeka',
    subtotal: 445000, diskon: 20000, ongkir: 15000, total: 440000, status: 'Baru', status_bayar: 'Belum Bayar', catatan: '' };
  const pesan = L.buatPesanWa(p, [{ nama_menu: 'Nasi Kotak Ayam', qty: 12, jumlah: 420000 }], 'Katering Bu Ani');
  assert.match(pesan, /\*Katering Bu Ani\*/);
  assert.match(pesan, /Kirim: 27\/11\/2026 jam 11:00/);
  assert.match(pesan, /Nasi Kotak Ayam x12 = Rp420\.000/);
  assert.match(pesan, /Diskon: -Rp20\.000/);
  assert.match(pesan, /\*Total: Rp440\.000\*/);
  const link = L.buatLinkWa('0812 3456 7890', pesan);
  assert.ok(link.startsWith('https://wa.me/6281234567890?text=*Katering%20Bu%20Ani*%0APesanan'));
});

test('validasi pesanan publik lebih ketat dan mengabaikan diskon/ongkir', () => {
  const dasar = { nama_pelanggan: ' Budi ', no_hp: '0812345678', alamat: 'Jl. A', tanggal_kirim: '2026-11-28', jam_kirim: '10:00', diskon: 99999, ongkir: 5 };
  const v = L.validasiPesanan(dasar, { publik: true, hariIni: '2026-11-27' });
  assert.equal(v.nama_pelanggan, 'Budi');
  assert.equal(v.diskon, 0);
  assert.equal(v.ongkir, 0);
  assert.throws(() => L.validasiPesanan({ ...dasar, tanggal_kirim: '2026-11-27' }, { publik: true, hariIni: '2026-11-27' }), /paling cepat untuk besok/);
  assert.throws(() => L.validasiPesanan({ ...dasar, alamat: '' }, { publik: true, hariIni: '2026-11-27' }), /Alamat/);
  assert.throws(() => L.validasiPesanan({ ...dasar, no_hp: 'abc' }, {}), /No. HP/);
  assert.equal(L.validasiPesanan({ ...dasar, alamat: '' }, {}).diskon, 99999, 'admin boleh tanpa alamat dan memberi diskon');
});

test('info upgrade muncul saat > 100 pesanan/hari selama 7 hari atau sel hampir penuh', () => {
  assert.deepEqual(L.infoUpgrade([120, 130, 101, 150, 200, 101, 102], 1000), ['Pesanan Anda di atas 100 per hari selama seminggu terakhir.']);
  assert.deepEqual(L.infoUpgrade([120, 130, 100, 150, 200, 101, 102], 1000), []);
  assert.equal(L.infoUpgrade([0, 0, 0, 0, 0, 0, 0], 8500000).length, 1);
});

test('utilitas: warna, ya/tidak, daftar email, teks sel', () => {
  assert.equal(L.warnaAman('#1d4ed8', '#000000'), '#1d4ed8');
  assert.equal(L.warnaAman('red;}body{', '#000000'), '#000000');
  assert.ok(L.nilaiYa('Ya') && L.nilaiYa(true) && !L.nilaiYa('Tidak') && !L.nilaiYa(''));
  assert.deepEqual(L.daftarEmail('A@x.com, b@y.co.id\nbukan-email'), ['a@x.com', 'b@y.co.id']);
  assert.equal(L.teksSel('=HYPERLINK("x")'), '\'=HYPERLINK("x")');
  assert.equal(L.teksSel(''), '');
});
