/**
 * Logika murni Dapur Nusantara Lite.
 *
 * File ini sengaja TIDAK memakai layanan Google (SpreadsheetApp, Session, dll.)
 * supaya bisa diuji di Node.js (lihat lite/tests). Semua aturan bisnis
 * (nomor pesanan, total, status, kapasitas, rekap, pesan WhatsApp) ada di sini.
 */

var STATUS = {
  BARU: 'Baru',
  DIKONFIRMASI: 'Dikonfirmasi',
  DIPROSES: 'Diproses',
  DIKIRIM: 'Dikirim',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
};

var URUTAN_STATUS = ['Baru', 'Dikonfirmasi', 'Diproses', 'Dikirim', 'Selesai'];
var SEMUA_STATUS = URUTAN_STATUS.concat(['Dibatalkan']);
var STATUS_BAYAR = ['Belum Bayar', 'Lunas'];

/** Status yang pesanannya masih boleh diubah isinya (item, tanggal, harga). */
var STATUS_BISA_DIEDIT = ['Baru', 'Dikonfirmasi'];

var BATAS_PERINGATAN_KAPASITAS = 0.9;
var BATAS_SEL_SPREADSHEET = 10000000;

/** Status berikutnya yang sah dari status sekarang. */
function statusBerikutnya(status) {
  if (status === STATUS.SELESAI || status === STATUS.DIBATALKAN) return [];
  var i = URUTAN_STATUS.indexOf(status);
  if (i < 0) return [];
  return [URUTAN_STATUS[i + 1], STATUS.DIBATALKAN];
}

function bolehUbahStatus(dari, ke) {
  return statusBerikutnya(dari).indexOf(ke) >= 0;
}

function pesananAktif(p) {
  return p.status !== STATUS.DIBATALKAN;
}

/** Ubah angka jadi bilangan bulat rupiah (tanpa desimal), nilai tidak sah jadi 0. */
function keRupiah(v) {
  var n = Number(String(v === undefined || v === null ? '' : v).replace(/[^\d.-]/g, ''));
  if (!isFinite(n)) return 0;
  return Math.round(n);
}

/** Rp1.250.000 */
function formatRupiah(n) {
  var x = keRupiah(n);
  var neg = x < 0;
  var s = String(Math.abs(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-Rp' : 'Rp') + s;
}

/** '2026-11-27' -> '27/11/2026' */
function formatTanggal(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  return m[3] + '/' + m[2] + '/' + m[1];
}

function tanggalValid(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return false;
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function jamValid(jam) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(jam || ''));
}

/** Tambah n hari ke tanggal ISO. */
function tambahHari(iso, n) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  return d.toISOString().slice(0, 10);
}

/**
 * Nomor pesanan DN-YYYYMMDD-001, urut per tanggal kirim.
 * nomorYangAda: daftar nomor pesanan yang sudah tersimpan (semua tanggal).
 */
function buatNomorPesanan(tanggalKirim, nomorYangAda) {
  var prefix = 'DN-' + String(tanggalKirim).replace(/-/g, '') + '-';
  var maks = 0;
  (nomorYangAda || []).forEach(function (n) {
    n = String(n || '');
    if (n.indexOf(prefix) === 0) {
      var urut = parseInt(n.slice(prefix.length), 10);
      if (urut > maks) maks = urut;
    }
  });
  var berikut = String(maks + 1);
  while (berikut.length < 3) berikut = '0' + berikut;
  return prefix + berikut;
}

/**
 * Normalisasi nomor HP Indonesia ke format wa.me (62xxxxxxxxxx).
 * Mengembalikan '' jika tidak terlihat seperti nomor HP.
 */
function normalisasiNoHp(no) {
  var d = String(no || '').replace(/\D/g, '');
  if (d.indexOf('0') === 0) d = '62' + d.slice(1);
  else if (d.indexOf('8') === 0) d = '62' + d;
  if (!/^62\d{8,13}$/.test(d)) return '';
  return d;
}

/**
 * Susun item pesanan dari input + daftar menu (harga diambil dari menu, bukan dari input,
 * lalu disalin sebagai snapshot). Item dengan qty sama digabung.
 */
function susunItem(inputItems, daftarMenu, hanyaAktif) {
  var menuById = {};
  daftarMenu.forEach(function (m) { menuById[String(m.id)] = m; });
  var gabung = {};
  var urutan = [];
  (inputItems || []).forEach(function (it) {
    var id = String(it.menu_id);
    var qty = parseInt(it.qty, 10);
    if (!id || !qty) return;
    if (!gabung[id]) { gabung[id] = 0; urutan.push(id); }
    gabung[id] += qty;
  });
  if (!urutan.length) throw new Error('Pilih minimal satu menu.');
  return urutan.map(function (id) {
    var menu = menuById[id];
    if (!menu) throw new Error('Menu tidak ditemukan.');
    if (hanyaAktif && !menu.aktif) throw new Error('Menu "' + menu.nama + '" sedang tidak tersedia.');
    var qty = gabung[id];
    if (qty < 1 || qty > 10000) throw new Error('Jumlah porsi "' + menu.nama + '" tidak wajar.');
    var harga = keRupiah(menu.harga);
    return {
      menu_id: menu.id,
      nama_menu: menu.nama,
      harga_satuan: harga,
      qty: qty,
      jumlah: harga * qty,
    };
  });
}

/** Total = subtotal - diskon + ongkir. Diskon tidak boleh melebihi subtotal. */
function hitungTotal(items, diskon, ongkir) {
  var subtotal = 0;
  var porsi = 0;
  items.forEach(function (it) { subtotal += keRupiah(it.jumlah); porsi += Number(it.qty) || 0; });
  var d = Math.max(0, keRupiah(diskon));
  var o = Math.max(0, keRupiah(ongkir));
  if (d > subtotal) throw new Error('Diskon tidak boleh melebihi subtotal.');
  return { subtotal: subtotal, diskon: d, ongkir: o, total: subtotal - d + o, porsi: porsi };
}

/**
 * Cek kapasitas porsi pada satu tanggal kirim.
 * terpakai: porsi pesanan aktif lain di tanggal itu; tambahan: porsi pesanan ini.
 */
function cekKapasitas(terpakai, tambahan, kapasitas) {
  kapasitas = Number(kapasitas) || 0;
  var total = (Number(terpakai) || 0) + (Number(tambahan) || 0);
  if (kapasitas <= 0) {
    return { kapasitas: 0, total: total, sisa: null, persen: 0, level: 'aman', melebihi: false };
  }
  var persen = total / kapasitas;
  var level = persen > 1 ? 'penuh' : persen >= BATAS_PERINGATAN_KAPASITAS ? 'peringatan' : 'aman';
  return {
    kapasitas: kapasitas,
    total: total,
    sisa: Math.max(0, kapasitas - (Number(terpakai) || 0)),
    persen: Math.round(persen * 100),
    level: level,
    melebihi: persen > 1,
  };
}

/** Total porsi pesanan aktif per tanggal (kecuali pesanan dengan id tertentu, untuk edit). */
function porsiTerpakai(tanggal, pesananList, itemList, kecualiId) {
  var idAktif = {};
  pesananList.forEach(function (p) {
    if (p.tanggal_kirim === tanggal && pesananAktif(p) && String(p.id) !== String(kecualiId)) {
      idAktif[String(p.id)] = true;
    }
  });
  var total = 0;
  itemList.forEach(function (it) {
    if (idAktif[String(it.pesanan_id)]) total += Number(it.qty) || 0;
  });
  return total;
}

/** Rekap satu tanggal kirim: ringkasan, produksi dapur, pengiriman, pendapatan. */
function hitungRekap(tanggal, pesananList, itemList) {
  var pesanan = pesananList.filter(function (p) { return p.tanggal_kirim === tanggal && pesananAktif(p); });
  var ids = {};
  pesanan.forEach(function (p) { ids[String(p.id)] = p; });

  var produksiMap = {};
  var totalPorsi = 0;
  itemList.forEach(function (it) {
    if (!ids[String(it.pesanan_id)]) return;
    var key = it.nama_menu;
    produksiMap[key] = (produksiMap[key] || 0) + (Number(it.qty) || 0);
    totalPorsi += Number(it.qty) || 0;
  });
  var produksi = Object.keys(produksiMap).sort().map(function (nama) {
    return { nama_menu: nama, porsi: produksiMap[nama] };
  });

  var pengiriman = pesanan.slice().sort(function (a, b) {
    var ja = a.jam_kirim || '99:99', jb = b.jam_kirim || '99:99'; // tanpa jam ditaruh paling akhir
    return String(ja).localeCompare(String(jb)) || String(a.nomor).localeCompare(String(b.nomor));
  }).map(function (p) {
    return {
      nomor: p.nomor, jam_kirim: p.jam_kirim, nama_pelanggan: p.nama_pelanggan,
      alamat: p.alamat, no_hp: p.no_hp, status: p.status, status_bayar: p.status_bayar, total: p.total,
    };
  });

  var totalNilai = 0, lunas = 0;
  pesanan.forEach(function (p) {
    totalNilai += keRupiah(p.total);
    if (p.status_bayar === 'Lunas') lunas += keRupiah(p.total);
  });

  return {
    tanggal: tanggal,
    jumlah_pesanan: pesanan.length,
    total_porsi: totalPorsi,
    total_nilai: totalNilai,
    total_lunas: lunas,
    total_belum_bayar: totalNilai - lunas,
    produksi: produksi,
    pengiriman: pengiriman,
  };
}

/** Ringkasan pesanan untuk WhatsApp. */
function buatPesanWa(pesanan, items, namaUsaha) {
  var baris = [];
  baris.push('*' + (namaUsaha || 'Dapur Nusantara') + '*');
  baris.push('Pesanan ' + pesanan.nomor);
  baris.push('');
  baris.push('Nama: ' + pesanan.nama_pelanggan);
  baris.push('Kirim: ' + formatTanggal(pesanan.tanggal_kirim) + (pesanan.jam_kirim ? ' jam ' + pesanan.jam_kirim : ''));
  if (pesanan.alamat) baris.push('Alamat: ' + pesanan.alamat);
  baris.push('');
  items.forEach(function (it) {
    baris.push('- ' + it.nama_menu + ' x' + it.qty + ' = ' + formatRupiah(it.jumlah));
  });
  baris.push('');
  baris.push('Subtotal: ' + formatRupiah(pesanan.subtotal));
  if (keRupiah(pesanan.diskon)) baris.push('Diskon: -' + formatRupiah(pesanan.diskon));
  if (keRupiah(pesanan.ongkir)) baris.push('Ongkir: ' + formatRupiah(pesanan.ongkir));
  baris.push('*Total: ' + formatRupiah(pesanan.total) + '*');
  baris.push('Status: ' + pesanan.status + ' (' + pesanan.status_bayar + ')');
  if (pesanan.catatan) { baris.push(''); baris.push('Catatan: ' + pesanan.catatan); }
  return baris.join('\n');
}

function buatLinkWa(noHp, pesan) {
  var no = normalisasiNoHp(noHp);
  return 'https://wa.me/' + no + '?text=' + encodeURIComponent(pesan);
}

/**
 * Pemicu info upgrade ke versi Laravel.
 * jumlahPerHari: jumlah pesanan 7 hari terakhir (array angka); selTerpakai: jumlah sel spreadsheet.
 */
function infoUpgrade(jumlahPerHari, selTerpakai) {
  var alasan = [];
  if (jumlahPerHari.length >= 7 && jumlahPerHari.slice(-7).every(function (n) { return n > 100; })) {
    alasan.push('Pesanan Anda di atas 100 per hari selama seminggu terakhir.');
  }
  if (selTerpakai >= BATAS_SEL_SPREADSHEET * 0.8) {
    alasan.push('Data spreadsheet sudah mendekati batas Google Sheets (' +
      Math.round(selTerpakai / BATAS_SEL_SPREADSHEET * 100) + '%).');
  }
  return alasan;
}

/** Validasi data pesanan dari form (admin maupun publik). Mengembalikan objek bersih. */
function validasiPesanan(d, opsi) {
  opsi = opsi || {};
  var bersih = function (v, maks) { return String(v === undefined || v === null ? '' : v).trim().slice(0, maks); };
  var out = {
    nama_pelanggan: bersih(d.nama_pelanggan, 100),
    no_hp: bersih(d.no_hp, 20),
    alamat: bersih(d.alamat, 300),
    tanggal_kirim: bersih(d.tanggal_kirim, 10),
    jam_kirim: bersih(d.jam_kirim, 5),
    catatan: bersih(d.catatan, 500),
    diskon: opsi.publik ? 0 : keRupiah(d.diskon),
    ongkir: opsi.publik ? 0 : keRupiah(d.ongkir),
  };
  if (!out.nama_pelanggan) throw new Error('Nama pelanggan wajib diisi.');
  if (!normalisasiNoHp(out.no_hp)) throw new Error('No. HP tidak valid. Contoh: 081234567890.');
  if (!tanggalValid(out.tanggal_kirim)) throw new Error('Tanggal kirim tidak valid.');
  if (out.jam_kirim && !jamValid(out.jam_kirim)) throw new Error('Jam kirim tidak valid. Contoh: 11:30.');
  if (opsi.publik) {
    if (!out.alamat) throw new Error('Alamat pengiriman wajib diisi.');
    if (!out.jam_kirim) throw new Error('Jam kirim wajib diisi.');
    if (opsi.hariIni && out.tanggal_kirim <= opsi.hariIni) {
      throw new Error('Pesanan lewat form paling cepat untuk besok.');
    }
  }
  return out;
}

/** Warna hex aman untuk CSS, fallback ke warna default. */
function warnaAman(w, cadangan) {
  return /^#[0-9a-fA-F]{6}$/.test(String(w || '').trim()) ? String(w).trim() : cadangan;
}

/** Nilai pengaturan ya/tidak dari sheet. */
function nilaiYa(v) {
  if (v === true) return true;
  return /^(ya|y|true|1|aktif)$/i.test(String(v || '').trim());
}

/** Daftar email admin dari teks dipisah koma/spasi/baris baru. */
function daftarEmail(teks) {
  return String(teks || '').split(/[\s,;]+/).map(function (e) { return e.trim().toLowerCase(); })
    .filter(function (e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); });
}

/** Cegah input dibaca sebagai rumus atau angka oleh Google Sheets. */
function teksSel(v) {
  var s = String(v === undefined || v === null ? '' : v);
  return s === '' ? '' : "'" + s;
}

// Ekspor untuk pengujian di Node.js (diabaikan di Apps Script).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STATUS: STATUS, SEMUA_STATUS: SEMUA_STATUS, statusBerikutnya: statusBerikutnya, bolehUbahStatus: bolehUbahStatus,
    keRupiah: keRupiah, formatRupiah: formatRupiah, formatTanggal: formatTanggal, tanggalValid: tanggalValid,
    jamValid: jamValid, tambahHari: tambahHari, buatNomorPesanan: buatNomorPesanan, normalisasiNoHp: normalisasiNoHp,
    susunItem: susunItem, hitungTotal: hitungTotal, cekKapasitas: cekKapasitas, porsiTerpakai: porsiTerpakai,
    hitungRekap: hitungRekap, buatPesanWa: buatPesanWa, buatLinkWa: buatLinkWa, infoUpgrade: infoUpgrade,
    validasiPesanan: validasiPesanan, warnaAman: warnaAman, nilaiYa: nilaiYa, daftarEmail: daftarEmail, teksSel: teksSel,
  };
}
