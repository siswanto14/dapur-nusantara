/**
 * Akses data Google Sheets. Setiap sheet dibaca sekali dengan getValues()
 * lalu dipetakan ke objek berdasarkan baris judul (baris 1).
 */

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(nama) {
  var sh = ss_().getSheetByName(nama);
  if (!sh) throw new Error('Sheet "' + nama + '" tidak ada. Jalankan menu Dapur Nusantara > Siapkan sheet.');
  return sh;
}

/** Nilai sel ke bentuk yang aman dikirim ke browser (tanpa objek Date). */
function nilaiBersih_(kolom, v) {
  if (v instanceof Date) {
    if (kolom === 'jam_kirim') return Utilities.formatDate(v, ZONA_WAKTU, 'HH:mm');
    if (kolom === 'tanggal_kirim' || kolom === 'tanggal') return Utilities.formatDate(v, ZONA_WAKTU, 'yyyy-MM-dd');
    return Utilities.formatDate(v, ZONA_WAKTU, 'yyyy-MM-dd HH:mm');
  }
  if (kolom === 'no_hp' && typeof v === 'number') return '0' + v; // nomor yang terlanjur jadi angka
  return v;
}

/** Baca seluruh sheet sebagai array objek. Properti _baris = nomor baris di sheet. */
function bacaSemua_(nama) {
  var sh = sheet_(nama);
  var nilai = sh.getDataRange().getValues();
  if (nilai.length < 2) return [];
  var judul = nilai[0].map(String);
  var hasil = [];
  for (var r = 1; r < nilai.length; r++) {
    var baris = nilai[r];
    if (baris.join('') === '') continue;
    var o = { _baris: r + 1 };
    for (var c = 0; c < judul.length; c++) {
      if (judul[c]) o[judul[c]] = nilaiBersih_(judul[c], baris[c]);
    }
    hasil.push(o);
  }
  return hasil;
}

function barisDariObjek_(nama, obj) {
  return KOLOM[nama].map(function (k) { return obj[k] === undefined ? '' : obj[k]; });
}

/** Nilai hasil bacaSemua_ untuk ditulis kembali: teks tetap teks, waktu tetap waktu. */
function nilaiTulisUlang_(kolom, v) {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') return v;
  if (kolom === 'dibuat_pada' || kolom === 'diubah_pada' || kolom === 'waktu') return v;
  return teksSel(v);
}

function tambahBaris_(nama, objList) {
  if (!objList.length) return;
  var sh = sheet_(nama);
  var rows = objList.map(function (o) { return barisDariObjek_(nama, o); });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function ubahBaris_(nama, nomorBaris, obj) {
  var sh = sheet_(nama);
  var row = barisDariObjek_(nama, obj);
  sh.getRange(nomorBaris, 1, 1, row.length).setValues([row]);
}

/** Ubah satu kolom saja pada baris tertentu. */
function ubahSel_(nama, nomorBaris, kolom, nilai) {
  var c = KOLOM[nama].indexOf(kolom);
  if (c < 0) throw new Error('Kolom tidak dikenal: ' + kolom);
  sheet_(nama).getRange(nomorBaris, c + 1).setValue(nilai);
}

/** Hapus banyak baris (nomor baris sheet), dari bawah ke atas agar indeks tidak bergeser. */
function hapusBaris_(nama, nomorBarisList) {
  var sh = sheet_(nama);
  nomorBarisList.slice().sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
}

function idBerikut_(list) {
  var maks = 0;
  list.forEach(function (o) { var n = Number(o.id) || 0; if (n > maks) maks = n; });
  return maks + 1;
}

/** Jalankan fungsi di dalam kunci skrip agar dua penyimpanan tidak bentrok. */
function denganKunci_(fn) {
  var kunci = LockService.getScriptLock();
  if (!kunci.tryLock(20000)) {
    throw new Error('Sistem sedang sibuk menyimpan pesanan lain. Silakan coba lagi sebentar.');
  }
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    kunci.releaseLock();
  }
}

function catatLog_(pesananId, aksi, lama, baru) {
  tambahBaris_(SHEET.LOG, [{
    waktu: new Date(),
    email: emailPengguna_() || 'publik',
    pesanan_id: pesananId,
    aksi: aksi,
    nilai_lama: teksSel(lama),
    nilai_baru: teksSel(baru),
  }]);
}

function sekarang_() {
  return new Date();
}

function hariIni_() {
  return Utilities.formatDate(new Date(), ZONA_WAKTU, 'yyyy-MM-dd');
}

// ---------- Pengaturan ----------

function bacaPengaturan_() {
  var cache = CacheService.getScriptCache();
  var ada = cache.get(KUNCI_CACHE_PENGATURAN);
  if (ada) return JSON.parse(ada);
  var hasil = {};
  PENGATURAN_BAWAAN.forEach(function (p) { hasil[p[0]] = p[1]; });
  bacaSemua_(SHEET.PENGATURAN).forEach(function (r) {
    if (r.kunci) hasil[String(r.kunci).trim()] = r.nilai;
  });
  cache.put(KUNCI_CACHE_PENGATURAN, JSON.stringify(hasil), 300);
  return hasil;
}

function simpanPengaturan_(kunci, nilai) {
  var baris = bacaSemua_(SHEET.PENGATURAN).filter(function (r) { return r.kunci === kunci; })[0];
  if (baris) {
    ubahSel_(SHEET.PENGATURAN, baris._baris, 'nilai', nilai);
  } else {
    tambahBaris_(SHEET.PENGATURAN, [{ kunci: kunci, nilai: nilai, keterangan: '' }]);
  }
  CacheService.getScriptCache().remove(KUNCI_CACHE_PENGATURAN);
}

/** Pengaturan yang aman ditampilkan ke browser (termasuk halaman publik). */
function branding_() {
  var p = bacaPengaturan_();
  return {
    nama_usaha: String(p.nama_usaha || 'Dapur Nusantara'),
    no_wa: String(p.no_wa || ''),
    alamat: String(p.alamat || ''),
    logo_url: /^https:\/\//.test(String(p.logo_url || '')) ? String(p.logo_url) : '',
    warna_utama: warnaAman(p.warna_utama, WARNA_BAWAAN),
    pesan_terima_kasih: String(p.pesan_terima_kasih || ''),
    form_publik_aktif: nilaiYa(p.form_publik_aktif),
  };
}
