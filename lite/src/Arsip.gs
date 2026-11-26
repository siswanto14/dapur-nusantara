/**
 * Arsip pesanan lama: memindahkan pesanan Selesai/Dibatalkan dengan tanggal kirim
 * lebih dari 12 bulan lalu (beserta itemnya) ke spreadsheet arsip terpisah,
 * agar file utama tidak mendekati batas 10 juta sel.
 */

function arsipkanPesananLama() {
  var ui = SpreadsheetApp.getUi();
  var batas = tambahHari(hariIni_(), -365);
  var jawab = ui.alert('Arsipkan pesanan lama',
    'Pesanan Selesai/Dibatalkan dengan tanggal kirim sebelum ' + formatTanggal(batas) +
    ' akan dipindahkan ke file arsip. Lanjutkan?', ui.ButtonSet.YES_NO);
  if (jawab !== ui.Button.YES) return;
  var jumlah = arsipkanSebelum_(batas);
  ui.alert(jumlah ? jumlah + ' pesanan dipindahkan ke file arsip.' : 'Tidak ada pesanan yang perlu diarsipkan.');
}

function arsipkanSebelum_(batas) {
  return denganKunci_(function () {
    var semuaP = bacaSemua_(SHEET.PESANAN);
    var lama = semuaP.filter(function (p) {
      return String(p.tanggal_kirim) < batas && (p.status === STATUS.SELESAI || p.status === STATUS.DIBATALKAN);
    });
    if (!lama.length) return 0;
    var ids = {};
    lama.forEach(function (p) { ids[String(p.id)] = true; });
    var semuaI = bacaSemua_(SHEET.ITEM);
    var itemLama = semuaI.filter(function (it) { return ids[String(it.pesanan_id)]; });

    var arsip = bukaArsip_();
    salinKeArsip_(arsip, SHEET.PESANAN, lama);
    salinKeArsip_(arsip, SHEET.ITEM, itemLama);

    tulisUlang_(SHEET.PESANAN, semuaP.filter(function (p) { return !ids[String(p.id)]; }));
    tulisUlang_(SHEET.ITEM, semuaI.filter(function (it) { return !ids[String(it.pesanan_id)]; }));
    catatLog_('', 'arsip_pesanan', '', lama.length + ' pesanan sebelum ' + batas);
    return lama.length;
  });
}

function bukaArsip_() {
  var id = String(bacaPengaturan_().arsip_spreadsheet_id || '');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* buat baru di bawah */ }
  }
  var arsip = SpreadsheetApp.create('Arsip - ' + ss_().getName());
  [SHEET.PESANAN, SHEET.ITEM].forEach(function (nama) {
    var sh = arsip.insertSheet(nama);
    sh.getRange(1, 1, 1, KOLOM[nama].length).setValues([KOLOM[nama]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  var awal = arsip.getSheets()[0];
  if (KOLOM[awal.getName()] === undefined) arsip.deleteSheet(awal);
  simpanPengaturan_('arsip_spreadsheet_id', arsip.getId());
  return arsip;
}

function salinKeArsip_(arsip, nama, list) {
  if (!list.length) return;
  var sh = arsip.getSheetByName(nama);
  var rows = list.map(function (o) {
    return KOLOM[nama].map(function (k) {
      return nilaiTulisUlang_(k, o[k]);
    });
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

/** Tulis ulang isi sheet (selain judul) dengan daftar objek yang tersisa. */
function tulisUlang_(nama, list) {
  var sh = sheet_(nama);
  var lebar = KOLOM[nama].length;
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  if (!list.length) return;
  var rows = list.map(function (o) {
    return KOLOM[nama].map(function (k) {
      return nilaiTulisUlang_(k, o[k]);
    });
  });
  sh.getRange(2, 1, rows.length, lebar).setValues(rows);
}
