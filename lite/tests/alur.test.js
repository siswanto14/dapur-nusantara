// Uji alur lengkap server (semua file .gs) di atas tiruan Apps Script.
const test = require('node:test');
const assert = require('node:assert/strict');
const { buatLingkungan } = require('./tiruan-apps-script');

function siap(opsi) {
  const env = buatLingkungan(opsi);
  env.ctx.siapkanSheet();
  env.ctx.isiDataContoh();
  return env;
}

const pesananPublik = (lebih = {}) => ({
  nama_pelanggan: 'Dewi', no_hp: '081299998888', alamat: 'Jl. Melati 3', tanggal_kirim: '2026-11-28',
  jam_kirim: '10:00', items: [{ menu_id: 3, qty: 2 }], ...lebih,
});

test('siapkan sheet membuat semua sheet, pengaturan bawaan, dan pemilik jadi admin', () => {
  const env = siap();
  const nama = env.ss.getSheets().map((s) => s.getName());
  assert.deepEqual(nama.sort(), ['ItemPesanan', 'Log', 'Menu', 'Pengaturan', 'Pesanan', 'Rekap']);
  const p = env.panggil('adminMuat');
  assert.equal(p.akses, true);
  assert.equal(p.pengaturan.kapasitas_harian, 50);
  assert.equal(p.menu.length, 6);
  env.ctx.siapkanSheet(); // aman dijalankan ulang
  assert.equal(env.sheet('Pengaturan').getLastRow(), 1 + 13);
});

test('data contoh: nomor pesanan urut per tanggal, total benar, no HP tetap diawali 0', () => {
  const env = siap();
  const daftar = env.panggil('adminDaftarPesanan', {}).pesanan;
  assert.equal(daftar.length, 3);
  const besok = daftar.filter((p) => p.tanggal_kirim === '2026-11-28').map((p) => p.nomor).sort();
  assert.deepEqual(besok, ['DN-20261128-001', 'DN-20261128-002']);
  const sari = daftar.find((p) => p.nama_pelanggan.startsWith('Ibu Sari'));
  assert.equal(sari.subtotal, 15 * 35000 + 15 * 5000);
  assert.equal(sari.total, 600000 - 20000);
  assert.equal(sari.no_hp, '081234567801');
  assert.equal(sari.jam_kirim, '11:00');
  assert.ok(sari.link_wa.startsWith('https://wa.me/6281234567801?text='));
  assert.deepEqual(sari.status_berikut, ['Dikonfirmasi', 'Dibatalkan']);
});

test('form publik: status Baru, harga dari server, diskon diabaikan, tercatat di Log', () => {
  const env = siap();
  env.setEmail(''); // deployment publik: email pengunjung tidak terbaca
  const h = env.panggil('publikKirimPesanan', pesananPublik({ diskon: 50000, items: [{ menu_id: 3, qty: 2, harga: 1 }] }));
  assert.equal(h.nomor, 'DN-20261128-003');
  assert.equal(h.total, 60000);
  assert.ok(h.link_wa === '', 'no_wa usaha belum diisi, jadi tanpa link');
  env.setEmail('pemilik@contoh.id');
  const p = env.panggil('adminDaftarPesanan', { cari: 'dewi' }).pesanan[0];
  assert.equal(p.status, 'Baru');
  assert.equal(p.dibuat_oleh, 'publik');
  const log = env.sheet('Log').getDataRange().getValues().slice(1);
  assert.ok(log.some((r) => r[3] === 'buat_pesanan_publik' && r[1] === 'publik'));
});

test('form publik menolak: tanggal hari ini, menu nonaktif, bot, form ditutup', () => {
  const env = siap();
  env.setEmail('');
  assert.throws(() => env.panggil('publikKirimPesanan', pesananPublik({ tanggal_kirim: '2026-11-27' })), /paling cepat untuk besok/);
  assert.throws(() => env.panggil('publikKirimPesanan', pesananPublik({ situs_web: 'http://spam' })), /tidak bisa diproses/);
  env.setEmail('pemilik@contoh.id');
  env.panggil('adminSimpanMenu', { id: 3, kode: 'NSK-03', nama: 'Nasi Kotak Ayam Geprek', kategori: 'Nasi Kotak', harga: 30000, aktif: false });
  env.setEmail('');
  assert.throws(() => env.panggil('publikKirimPesanan', pesananPublik()), /tidak tersedia/);
  assert.equal(env.panggil('publikMuat').menu.length, 5);
  env.setEmail('pemilik@contoh.id');
  const atur = env.panggil('adminMuat').pengaturan;
  env.panggil('adminSimpanPengaturan', { ...atur, form_publik_aktif: false });
  env.setEmail('');
  assert.throws(() => env.panggil('publikKirimPesanan', pesananPublik({ items: [{ menu_id: 1, qty: 1 }] })), /ditutup/);
});

test('akses admin divalidasi di server', () => {
  const env = siap();
  env.setEmail('orang.lain@gmail.com');
  assert.equal(env.panggil('adminMuat').akses, false);
  assert.throws(() => env.panggil('adminDaftarPesanan', {}), /Akses ditolak/);
  assert.throws(() => env.panggil('adminUbahStatus', 1, 'Dikonfirmasi'), /Akses ditolak/);
  env.setEmail('');
  assert.throws(() => env.panggil('adminSimpanMenu', { nama: 'X', harga: 1 }), /Akses ditolak/);
  // Tambah admin lewat sheet Pengaturan
  const sh = env.sheet('Pengaturan');
  const baris = sh.getDataRange().getValues().findIndex((r) => r[0] === 'admin_emails') + 1;
  sh.getRange(baris, 2).setValue('pemilik@contoh.id, Staf@Gmail.com');
  env.ctx.kosongkanCache();
  env.setEmail('staf@gmail.com');
  assert.equal(env.panggil('adminMuat').akses, true);
});

test('kapasitas: peringatan 90%, tolak > 100%, override admin tercatat', () => {
  const env = siap();
  // Uji di lusa yang masih kosong (data contoh ada di hari ini dan besok).
  const lusa = '2026-11-29';
  const buat = (qty, lebih = {}) => env.panggil('adminSimpanPesanan', {
    nama_pelanggan: 'Uji', no_hp: '0811111111', tanggal_kirim: lusa, items: [{ menu_id: 1, qty }], ...lebih,
  });
  assert.equal(buat(40).kapasitas.level, 'aman');
  assert.equal(buat(5).kapasitas.level, 'peringatan');
  assert.throws(() => buat(6), /Kapasitas 29\/11\/2026 terlampaui \(51 dari 50 porsi\)/);
  const o = buat(6, { override_kapasitas: true });
  assert.equal(o.kapasitas.melebihi, true);
  const log = env.sheet('Log').getDataRange().getValues().slice(1);
  assert.ok(log.some((r) => r[3] === 'override_kapasitas'));
  env.setEmail('');
  assert.throws(() => env.panggil('publikKirimPesanan', pesananPublik({ tanggal_kirim: lusa, override_kapasitas: true })), /kuota pesanan/);
  env.setEmail('pemilik@contoh.id');
  assert.equal(env.panggil('adminCekKapasitas', lusa, 0).total, 51);
});

test('status: alur maju, batal, log, dan pesanan batal tidak dihitung di rekap/kapasitas', () => {
  const env = siap();
  const p = env.panggil('adminDaftarPesanan', { cari: 'Pak Budi' }).pesanan[0];
  assert.throws(() => env.panggil('adminUbahStatus', p.id, 'Selesai'), /tidak bisa diubah/);
  for (const s of ['Dikonfirmasi', 'Diproses']) env.panggil('adminUbahStatus', p.id, s);
  assert.throws(() => env.panggil('adminSimpanPesanan', { id: p.id, nama_pelanggan: 'x', no_hp: '0811111111', tanggal_kirim: '2026-11-28', items: [{ menu_id: 1, qty: 1 }] }), /tidak bisa diubah lagi/);
  env.panggil('adminUbahStatusBayar', p.id, 'Lunas');
  const r1 = env.panggil('adminRekap', '2026-11-28');
  assert.equal(r1.jumlah_pesanan, 2);
  assert.equal(r1.total_lunas, p.total);
  env.panggil('adminUbahStatus', p.id, 'Dibatalkan');
  assert.throws(() => env.panggil('adminUbahStatus', p.id, 'Selesai'), /tidak bisa diubah/);
  const r2 = env.panggil('adminRekap', '2026-11-28');
  assert.equal(r2.jumlah_pesanan, 1);
  assert.equal(r2.total_porsi, 30);
  assert.deepEqual(r2.produksi, [{ nama_menu: 'Es Teh Manis', porsi: 15 }, { nama_menu: 'Nasi Kotak Ayam Bakar', porsi: 15 }]);
  const log = env.sheet('Log').getDataRange().getValues().slice(1).filter((r) => r[2] === p.id);
  assert.deepEqual(log.filter((r) => r[3] === 'ubah_status').map((r) => r[5]), ['Dikonfirmasi', 'Diproses', 'Dibatalkan']);
});

test('ubah pesanan: item diganti, nomor tetap, harga snapshot tidak ikut berubah', () => {
  const env = siap();
  const p = env.panggil('adminDaftarPesanan', { cari: 'Mbak Rina' }).pesanan[0];
  env.panggil('adminSimpanMenu', { id: 2, kode: 'NSK-02', nama: 'Nasi Kotak Rendang', kategori: 'Nasi Kotak', harga: 45000, aktif: true });
  const lama = env.panggil('adminDaftarPesanan', { cari: 'Mbak Rina' }).pesanan[0];
  assert.equal(lama.total, 5 * 40000, 'harga lama tersimpan sebagai snapshot');
  const h = env.panggil('adminSimpanPesanan', {
    id: p.id, nama_pelanggan: 'Mbak Rina', no_hp: '081234567803', alamat: 'Jl. Kenanga 5', tanggal_kirim: p.tanggal_kirim,
    jam_kirim: '12:30', items: [{ menu_id: 2, qty: 3 }, { menu_id: 6, qty: 3 }], ongkir: 10000,
  });
  assert.equal(h.pesanan.nomor, p.nomor);
  assert.equal(h.pesanan.total, 3 * 45000 + 3 * 5000 + 10000);
  const baru = env.panggil('adminDaftarPesanan', { cari: 'Mbak Rina' }).pesanan[0];
  assert.equal(baru.items.length, 2);
  assert.equal(baru.jam_kirim, '12:30');
  const semuaItem = env.sheet('ItemPesanan').getDataRange().getValues().slice(1);
  assert.equal(semuaItem.filter((r) => r[1] === p.id).length, 2, 'item lama terhapus');
});

test('input berbahaya tidak menjadi rumus di sheet', () => {
  const env = siap();
  env.setEmail('');
  env.panggil('publikKirimPesanan', pesananPublik({ nama_pelanggan: '=IMPORTXML("http://x","//a")', catatan: '+62 1234' }));
  const baris = env.sheet('Pesanan').getDataRange().getValues().slice(1).pop();
  assert.equal(baris[2], '=IMPORTXML("http://x","//a")');
  assert.equal(typeof baris[2], 'string');
  assert.equal(baris[5], '2026-11-28', 'tanggal tetap teks');
});

test('rekap harian via trigger dan pemasangan trigger', () => {
  const env = siap();
  env.ctx.pasangTriggerRekap();
  env.ctx.pasangTriggerRekap();
  assert.equal(env.triggers.length, 1, 'trigger tidak dobel');
  env.setSekarang('2026-11-28T22:00:00Z'); // 29/11 pukul 05.00 WIB
  env.ctx.perbaruiRekapHarian();
  const rekap = env.sheet('Rekap').getDataRange().getValues().slice(1);
  assert.deepEqual(rekap.map((r) => r[0]), ['2026-11-28', '2026-11-29']);
  assert.equal(rekap[0][1], 2);
  env.ctx.perbaruiRekapHarian();
  assert.equal(env.sheet('Rekap').getLastRow(), 3, 'baris rekap diperbarui, bukan ditambah');
});

test('arsip memindahkan pesanan Selesai/Dibatalkan > 12 bulan beserta itemnya', () => {
  const env = siap();
  const ids = env.panggil('adminDaftarPesanan', {}).pesanan.map((p) => p.id);
  ['Dikonfirmasi', 'Diproses', 'Dikirim', 'Selesai'].forEach((s) => env.panggil('adminUbahStatus', ids[0], s));
  env.setSekarang('2028-01-10T02:00:00Z');
  const n = env.ctx.arsipkanSebelum_(env.ctx.tambahHari(env.ctx.hariIni_(), -365));
  assert.equal(n, 1);
  const sisa = env.panggil('adminDaftarPesanan', {}).pesanan;
  assert.equal(sisa.length, 2);
  const arsipId = env.panggil('adminMuat') && env.ctx.bacaPengaturan_().arsip_spreadsheet_id;
  const arsip = env.semuaSs[arsipId];
  assert.equal(arsip.getSheetByName('Pesanan').getLastRow(), 2);
  assert.ok(arsip.getSheetByName('ItemPesanan').getLastRow() >= 2);
  assert.equal(sisa[0].no_hp.startsWith('0'), true, 'no HP tetap teks setelah tulis ulang');
});

test('info upgrade muncul setelah seminggu > 100 pesanan/hari', () => {
  const env = siap({ sekarang: new Date('2026-11-27T02:00:00Z') });
  env.ctx.simpanPengaturan_('kapasitas_harian', 0);
  const sh = env.sheet('Pesanan');
  let id = 100;
  for (let d = 21; d <= 27; d++) {
    for (let i = 0; i < 101; i++) {
      id++;
      sh.getRange(sh.getLastRow() + 1, 1, 1, 12).setValues([[id, 'DN-x-' + id, 'P', "'0811", '', "'2026-11-" + d, "'10:00", 1, 0, 0, 1, 'Baru']]);
    }
  }
  const muat = env.panggil('adminMuat');
  assert.equal(muat.upgrade.alasan.length, 1);
});
