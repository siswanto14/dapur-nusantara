/**
 * Rekap harian: dihitung langsung per tanggal (bukan seluruh data),
 * dan disalin ke sheet Rekap oleh trigger harian.
 */

function adminRekap(tanggal) {
  wajibAdmin_();
  if (!tanggalValid(tanggal)) throw new Error('Tanggal tidak valid.');
  var rekap = hitungRekap(tanggal, semuaPesanan_(), semuaItem_());
  var kap = cekKapasitas(rekap.total_porsi, 0, bacaPengaturan_().kapasitas_harian);
  rekap.kapasitas = kap;
  return rekap;
}

/** Tulis atau perbarui satu baris di sheet Rekap. */
function tulisRekap_(rekap) {
  var ada = bacaSemua_(SHEET.REKAP).filter(function (r) { return String(r.tanggal) === rekap.tanggal; })[0];
  var obj = {
    tanggal: teksSel(rekap.tanggal),
    jumlah_pesanan: rekap.jumlah_pesanan,
    total_porsi: rekap.total_porsi,
    total_nilai: rekap.total_nilai,
    total_lunas: rekap.total_lunas,
    total_belum_bayar: rekap.total_belum_bayar,
  };
  if (ada) ubahBaris_(SHEET.REKAP, ada._baris, obj);
  else tambahBaris_(SHEET.REKAP, [obj]);
}

/** Dijalankan trigger harian (pagi): perbarui rekap kemarin dan hari ini. */
function perbaruiRekapHarian() {
  denganKunci_(function () {
    var pesanan = semuaPesanan_();
    var item = semuaItem_();
    var hari = hariIni_();
    [tambahHari(hari, -1), hari].forEach(function (t) { tulisRekap_(hitungRekap(t, pesanan, item)); });
  });
}

/** Perbarui rekap untuk tanggal yang dipilih di halaman admin. */
function adminSimpanRekap(tanggal) {
  wajibAdmin_();
  if (!tanggalValid(tanggal)) throw new Error('Tanggal tidak valid.');
  denganKunci_(function () { tulisRekap_(hitungRekap(tanggal, semuaPesanan_(), semuaItem_())); });
  return true;
}

/** Jumlah pesanan aktif per hari untuk 7 hari terakhir (pemicu info upgrade). */
function jumlahPesanan7Hari_(pesanan) {
  var hari = hariIni_();
  var hitung = {};
  pesanan.forEach(function (p) { if (pesananAktif(p)) hitung[p.tanggal_kirim] = (hitung[p.tanggal_kirim] || 0) + 1; });
  var hasil = [];
  for (var i = 6; i >= 0; i--) hasil.push(hitung[tambahHari(hari, -i)] || 0);
  return hasil;
}

function selTerpakai_() {
  return ss_().getSheets().reduce(function (s, sh) { return s + sh.getMaxRows() * sh.getMaxColumns(); }, 0);
}
