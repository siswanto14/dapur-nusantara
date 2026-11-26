/**
 * Menu "Dapur Nusantara" di spreadsheet dan langkah pemasangan template.
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Dapur Nusantara')
    .addItem('1. Siapkan sheet', 'siapkanSheet')
    .addItem('2. Isi data contoh', 'isiDataContoh')
    .addItem('3. Pasang rekap otomatis tiap pagi', 'pasangTriggerRekap')
    .addSeparator()
    .addItem('Perbarui rekap hari ini', 'perbaruiRekapHarian')
    .addItem('Arsipkan pesanan lama (> 12 bulan)', 'arsipkanPesananLama')
    .addItem('Kosongkan cache', 'kosongkanCache')
    .addToUi();
}

/** Buat sheet yang belum ada, pasang judul kolom, validasi, dan proteksi. Aman dijalankan ulang. */
function siapkanSheet() {
  var ss = ss_();
  ss.setSpreadsheetTimeZone(ZONA_WAKTU);
  Object.keys(KOLOM).forEach(function (nama) {
    var sh = ss.getSheetByName(nama) || ss.insertSheet(nama);
    var judul = KOLOM[nama];
    var ada = sh.getRange(1, 1, 1, judul.length).getValues()[0];
    if (ada.join('') === '') {
      sh.getRange(1, 1, 1, judul.length).setValues([judul]);
    } else if (ada.join('|') !== judul.join('|')) {
      throw new Error('Judul kolom sheet "' + nama + '" berbeda dari struktur yang diharapkan: ' + judul.join(', '));
    }
    sh.getRange(1, 1, 1, judul.length).setFontWeight('bold').setBackground('#fde68a');
    sh.setFrozenRows(1);
  });

  // Pengaturan bawaan untuk kunci yang belum ada.
  var pengaturan = bacaSemua_(SHEET.PENGATURAN);
  var adaKunci = {};
  pengaturan.forEach(function (r) { adaKunci[r.kunci] = true; });
  var baru = PENGATURAN_BAWAAN.filter(function (p) { return !adaKunci[p[0]]; }).map(function (p) {
    var nilai = p[0] === 'admin_emails' ? emailPengguna_() : p[1];
    return { kunci: p[0], nilai: typeof nilai === 'string' ? teksSel(nilai) : nilai, keterangan: p[2] };
  });
  tambahBaris_(SHEET.PENGATURAN, baru);
  sheet_(SHEET.PENGATURAN).autoResizeColumns(1, 3);

  pasangValidasi_();
  pasangProteksi_();
  kosongkanCache();

  var bawaan = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembar1');
  if (bawaan && bawaan.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(bawaan);
  tampilkanPesan_('Sheet siap. Lanjutkan: isi sheet Pengaturan, lalu deploy web app (lihat panduan instalasi).');
}

function pasangValidasi_() {
  var maks = 5000;
  var p = sheet_(SHEET.PESANAN);
  var kol = function (nama) { return KOLOM.Pesanan.indexOf(nama) + 1; };
  p.getRange(2, kol('status'), maks).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(SEMUA_STATUS, true).setAllowInvalid(false).build());
  p.getRange(2, kol('status_bayar'), maks).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATUS_BAYAR, true).setAllowInvalid(false).build());
  // Catatan: jangan pakai insertCheckboxes() di baris kosong, karena nilai FALSE
  // membuat getLastRow() ikut menghitung baris kosong. Kolom ya/tidak memakai teks "Ya".
  ['subtotal', 'diskon', 'ongkir', 'total'].forEach(function (k) {
    p.getRange(2, kol(k), maks).setNumberFormat('"Rp"#,##0');
  });

  var m = sheet_(SHEET.MENU);
  m.getRange(2, KOLOM.Menu.indexOf('aktif') + 1, 500).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Ya', 'Tidak'], true).setAllowInvalid(false).build());
  m.getRange(2, KOLOM.Menu.indexOf('harga') + 1, 500).setNumberFormat('"Rp"#,##0');
  m.getRange(2, KOLOM.Menu.indexOf('harga') + 1, 500).setDataValidation(
    SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).build());

  var it = sheet_(SHEET.ITEM);
  ['harga_satuan', 'jumlah'].forEach(function (k) {
    it.getRange(2, KOLOM.ItemPesanan.indexOf(k) + 1, maks).setNumberFormat('"Rp"#,##0');
  });
  var r = sheet_(SHEET.REKAP);
  ['total_nilai', 'total_lunas', 'total_belum_bayar'].forEach(function (k) {
    r.getRange(2, KOLOM.Rekap.indexOf(k) + 1, 1000).setNumberFormat('"Rp"#,##0');
  });
}

/**
 * Sheet sistem diberi proteksi "peringatan saja": admin lain tetap bisa ditulisi
 * oleh skrip (deployment Admin berjalan sebagai admin yang login), tetapi
 * editan tangan memunculkan peringatan.
 */
function pasangProteksi_() {
  [SHEET.LOG, SHEET.REKAP, SHEET.ITEM].forEach(function (nama) {
    var sh = sheet_(nama);
    var ada = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (ada.length) return;
    sh.protect().setDescription('Sheet sistem Dapur Nusantara, diisi otomatis').setWarningOnly(true);
  });
}

function pasangTriggerRekap() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'perbaruiRekapHarian') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('perbaruiRekapHarian').timeBased().everyDays(1).atHour(5).inTimezone(ZONA_WAKTU).create();
  tampilkanPesan_('Rekap otomatis terpasang: setiap hari sekitar pukul 05.00 WIB.');
}

function kosongkanCache() {
  CacheService.getScriptCache().removeAll([KUNCI_CACHE_MENU, KUNCI_CACHE_PENGATURAN]);
}

/** Data contoh untuk demo/portofolio. Hanya mengisi sheet Menu/Pesanan yang masih kosong. */
function isiDataContoh() {
  var menuBaru = denganKunci_(function () {
    if (!bacaSemua_(SHEET.MENU).length) {
      var menu = [
        ['NSK-01', 'Nasi Kotak Ayam Bakar', 'Nasi Kotak', 35000],
        ['NSK-02', 'Nasi Kotak Rendang', 'Nasi Kotak', 40000],
        ['NSK-03', 'Nasi Kotak Ayam Geprek', 'Nasi Kotak', 30000],
        ['TMP-01', 'Tumpeng Mini', 'Tumpeng', 75000],
        ['SNK-01', 'Snack Box Tradisional', 'Snack', 15000],
        ['MNM-01', 'Es Teh Manis', 'Minuman', 5000],
      ].map(function (m, i) {
        return { id: i + 1, kode: teksSel(m[0]), nama: teksSel(m[1]), kategori: teksSel(m[2]), harga: m[3], aktif: 'Ya', catatan: '' };
      });
      tambahBaris_(SHEET.MENU, menu);
      hapusCacheMenu_();
      return true;
    }
    return false;
  });
  // Pesanan contoh memakai id menu contoh di atas, jadi hanya dibuat bersama menu contoh.
  if (menuBaru && !bacaSemua_(SHEET.PESANAN).length) {
    var besok = tambahHari(hariIni_(), 1);
    [
      { nama_pelanggan: 'Ibu Sari (PT Maju Jaya)', no_hp: '081234567801', alamat: 'Jl. Merdeka No. 10',
        tanggal_kirim: besok, jam_kirim: '11:00', items: [{ menu_id: 1, qty: 15 }, { menu_id: 6, qty: 15 }], diskon: 20000 },
      { nama_pelanggan: 'Pak Budi', no_hp: '081234567802', alamat: 'Perum Griya Asri B2',
        tanggal_kirim: besok, jam_kirim: '09:30', items: [{ menu_id: 4, qty: 2 }, { menu_id: 5, qty: 10 }], ongkir: 15000 },
      { nama_pelanggan: 'Mbak Rina', no_hp: '081234567803', alamat: 'Jl. Kenanga 5',
        tanggal_kirim: hariIni_(), jam_kirim: '12:00', items: [{ menu_id: 2, qty: 5 }] },
    ].forEach(function (d) {
      denganKunci_(function () { simpanPesananInti_(d, { publik: false }); });
    });
  }
  tampilkanPesan_(menuBaru ? 'Data contoh terisi: 6 menu dan 3 pesanan.' : 'Sheet Menu sudah berisi data, data contoh tidak ditambahkan.');
}

function tampilkanPesan_(teks) {
  try { SpreadsheetApp.getUi().alert(teks); } catch (e) { Logger.log(teks); }
}
