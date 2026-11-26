/**
 * Pesanan: buat, ubah, status, status bayar, kapasitas.
 */

function pesananBersih_(p) {
  return {
    id: Number(p.id),
    nomor: String(p.nomor || ''),
    nama_pelanggan: String(p.nama_pelanggan || ''),
    no_hp: String(p.no_hp || ''),
    alamat: String(p.alamat || ''),
    tanggal_kirim: String(p.tanggal_kirim || ''),
    jam_kirim: String(p.jam_kirim || ''),
    subtotal: keRupiah(p.subtotal),
    diskon: keRupiah(p.diskon),
    ongkir: keRupiah(p.ongkir),
    total: keRupiah(p.total),
    status: String(p.status || STATUS.BARU),
    status_bayar: String(p.status_bayar || 'Belum Bayar'),
    override_kapasitas: p.override_kapasitas === true || nilaiYa(p.override_kapasitas),
    catatan: String(p.catatan || ''),
    dibuat_oleh: String(p.dibuat_oleh || ''),
    dibuat_pada: String(p.dibuat_pada || ''),
    diubah_pada: String(p.diubah_pada || ''),
    _baris: p._baris,
  };
}

function itemBersih_(it) {
  return {
    id: Number(it.id),
    pesanan_id: Number(it.pesanan_id),
    menu_id: Number(it.menu_id),
    nama_menu: String(it.nama_menu || ''),
    harga_satuan: keRupiah(it.harga_satuan),
    qty: Number(it.qty) || 0,
    jumlah: keRupiah(it.jumlah),
    _baris: it._baris,
  };
}

function semuaPesanan_() {
  return bacaSemua_(SHEET.PESANAN).filter(function (p) { return p.id !== ''; }).map(pesananBersih_);
}

function semuaItem_() {
  return bacaSemua_(SHEET.ITEM).filter(function (it) { return it.id !== ''; }).map(itemBersih_);
}

/** Inti penyimpanan pesanan, dipakai admin dan form publik. Harus dipanggil di dalam kunci. */
function simpanPesananInti_(input, opsi) {
  var data = validasiPesanan(input, { publik: opsi.publik, hariIni: hariIni_() });
  var pengaturan = bacaPengaturan_();
  var pesananList = semuaPesanan_();
  var itemList = semuaItem_();
  var lama = null;

  if (input.id) {
    lama = pesananList.filter(function (p) { return String(p.id) === String(input.id); })[0];
    if (!lama) throw new Error('Pesanan tidak ditemukan.');
    if (STATUS_BISA_DIEDIT.indexOf(lama.status) < 0) {
      throw new Error('Pesanan berstatus ' + lama.status + ' tidak bisa diubah lagi.');
    }
  }

  // Item baru dari menu aktif; saat edit, menu lama yang kini nonaktif tetap boleh dipakai.
  var items = susunItem(input.items, menuSemua_(), !!opsi.publik);
  if (!opsi.publik) {
    var aktif = {};
    menuSemua_().forEach(function (m) { aktif[m.id] = m.aktif; });
    var menuLama = {};
    if (lama) itemList.forEach(function (it) { if (it.pesanan_id === lama.id) menuLama[it.menu_id] = true; });
    items.forEach(function (it) {
      if (!aktif[it.menu_id] && !menuLama[it.menu_id]) throw new Error('Menu "' + it.nama_menu + '" sedang nonaktif.');
    });
  }
  var hitung = hitungTotal(items, data.diskon, data.ongkir);

  var override = !opsi.publik && !!input.override_kapasitas;
  var terpakai = porsiTerpakai(data.tanggal_kirim, pesananList, itemList, lama ? lama.id : null);
  var kap = cekKapasitas(terpakai, hitung.porsi, pengaturan.kapasitas_harian);
  if (kap.melebihi && !override) {
    if (opsi.publik) {
      throw new Error('Maaf, kuota pesanan untuk ' + formatTanggal(data.tanggal_kirim) +
        ' sudah penuh. Silakan pilih tanggal lain atau hubungi kami lewat WhatsApp.');
    }
    throw new Error('Kapasitas ' + formatTanggal(data.tanggal_kirim) + ' terlampaui (' + kap.total + ' dari ' +
      kap.kapasitas + ' porsi). Centang "Override kapasitas" jika tetap ingin menyimpan.');
  }

  var waktu = sekarang_();
  var email = opsi.publik ? 'publik' : emailPengguna_();
  var pesanan = {
    nama_pelanggan: teksSel(data.nama_pelanggan),
    no_hp: teksSel(data.no_hp),
    alamat: teksSel(data.alamat),
    tanggal_kirim: teksSel(data.tanggal_kirim),
    jam_kirim: teksSel(data.jam_kirim),
    subtotal: hitung.subtotal,
    diskon: hitung.diskon,
    ongkir: hitung.ongkir,
    total: hitung.total,
    override_kapasitas: kap.melebihi && override ? 'Ya' : '',
    catatan: teksSel(data.catatan),
    diubah_pada: waktu,
  };

  if (lama) {
    pesanan.id = lama.id;
    pesanan.nomor = lama.nomor;
    pesanan.status = lama.status;
    pesanan.status_bayar = lama.status_bayar;
    pesanan.dibuat_oleh = lama.dibuat_oleh;
    pesanan.dibuat_pada = lama.dibuat_pada;
    ubahBaris_(SHEET.PESANAN, lama._baris, pesanan);
    hapusBaris_(SHEET.ITEM, itemList.filter(function (it) { return it.pesanan_id === lama.id; })
      .map(function (it) { return it._baris; }));
    catatLog_(lama.id, 'ubah_pesanan', formatRupiah(lama.total), formatRupiah(hitung.total));
  } else {
    pesanan.id = idBerikut_(pesananList);
    pesanan.nomor = buatNomorPesanan(data.tanggal_kirim, pesananList.map(function (p) { return p.nomor; }));
    pesanan.status = STATUS.BARU;
    pesanan.status_bayar = 'Belum Bayar';
    pesanan.dibuat_oleh = email || 'admin';
    pesanan.dibuat_pada = waktu;
    tambahBaris_(SHEET.PESANAN, [pesanan]);
    catatLog_(pesanan.id, opsi.publik ? 'buat_pesanan_publik' : 'buat_pesanan', '', pesanan.nomor);
  }

  var idItem = idBerikut_(itemList);
  tambahBaris_(SHEET.ITEM, items.map(function (it, i) {
    return {
      id: idItem + i,
      pesanan_id: pesanan.id,
      menu_id: it.menu_id,
      nama_menu: teksSel(it.nama_menu),
      harga_satuan: it.harga_satuan,
      qty: it.qty,
      jumlah: it.jumlah,
    };
  }));
  if (kap.melebihi && override) catatLog_(pesanan.id, 'override_kapasitas', kap.kapasitas, kap.total);

  var hasil = {
    id: pesanan.id, nomor: pesanan.nomor, nama_pelanggan: data.nama_pelanggan, no_hp: data.no_hp,
    alamat: data.alamat, tanggal_kirim: data.tanggal_kirim, jam_kirim: data.jam_kirim,
    subtotal: hitung.subtotal, diskon: hitung.diskon, ongkir: hitung.ongkir, total: hitung.total,
    status: pesanan.status, status_bayar: pesanan.status_bayar, catatan: data.catatan,
  };
  return { pesanan: hasil, items: items, kapasitas: kap, pesan_wa: buatPesanWa(hasil, items, pengaturan.nama_usaha) };
}

// ---------- API admin (dipanggil dari browser lewat google.script.run) ----------

function adminDaftarPesanan(filter) {
  wajibAdmin_();
  filter = filter || {};
  var cari = String(filter.cari || '').toLowerCase().trim();
  var itemPer = {};
  semuaItem_().forEach(function (it) {
    (itemPer[it.pesanan_id] = itemPer[it.pesanan_id] || []).push(it);
  });
  var nama = bacaPengaturan_().nama_usaha;
  var list = semuaPesanan_().filter(function (p) {
    if (filter.tanggal && p.tanggal_kirim !== filter.tanggal) return false;
    if (filter.status && p.status !== filter.status) return false;
    if (cari && (p.nama_pelanggan + ' ' + p.nomor + ' ' + p.no_hp).toLowerCase().indexOf(cari) < 0) return false;
    return true;
  });
  list.sort(function (a, b) {
    return b.tanggal_kirim.localeCompare(a.tanggal_kirim) || a.jam_kirim.localeCompare(b.jam_kirim) ||
      a.nomor.localeCompare(b.nomor);
  });
  var batas = Math.min(Number(filter.batas) || 300, 1000);
  return {
    total: list.length,
    pesanan: list.slice(0, batas).map(function (p) {
      var items = itemPer[p.id] || [];
      p.items = items;
      p.porsi = items.reduce(function (s, it) { return s + it.qty; }, 0);
      p.status_berikut = statusBerikutnya(p.status);
      p.bisa_edit = STATUS_BISA_DIEDIT.indexOf(p.status) >= 0;
      p.link_wa = normalisasiNoHp(p.no_hp) ? buatLinkWa(p.no_hp, buatPesanWa(p, items, nama)) : '';
      delete p._baris;
      return p;
    }),
  };
}

function adminSimpanPesanan(data) {
  wajibAdmin_();
  return denganKunci_(function () { return simpanPesananInti_(data, { publik: false }); });
}

function adminUbahStatus(id, statusBaru) {
  wajibAdmin_();
  return denganKunci_(function () {
    var p = semuaPesanan_().filter(function (x) { return String(x.id) === String(id); })[0];
    if (!p) throw new Error('Pesanan tidak ditemukan.');
    if (!bolehUbahStatus(p.status, statusBaru)) {
      throw new Error('Status ' + p.status + ' tidak bisa diubah ke ' + statusBaru + '.');
    }
    ubahSel_(SHEET.PESANAN, p._baris, 'status', statusBaru);
    ubahSel_(SHEET.PESANAN, p._baris, 'diubah_pada', sekarang_());
    catatLog_(p.id, 'ubah_status', p.status, statusBaru);
    return { id: p.id, status: statusBaru, status_berikut: statusBerikutnya(statusBaru) };
  });
}

function adminUbahStatusBayar(id, statusBayar) {
  wajibAdmin_();
  if (STATUS_BAYAR.indexOf(statusBayar) < 0) throw new Error('Status bayar tidak dikenal.');
  return denganKunci_(function () {
    var p = semuaPesanan_().filter(function (x) { return String(x.id) === String(id); })[0];
    if (!p) throw new Error('Pesanan tidak ditemukan.');
    if (p.status_bayar === statusBayar) return { id: p.id, status_bayar: statusBayar };
    ubahSel_(SHEET.PESANAN, p._baris, 'status_bayar', statusBayar);
    ubahSel_(SHEET.PESANAN, p._baris, 'diubah_pada', sekarang_());
    catatLog_(p.id, 'ubah_status_bayar', p.status_bayar, statusBayar);
    return { id: p.id, status_bayar: statusBayar };
  });
}

/** Info kapasitas untuk ditampilkan di form saat tanggal/porsi berubah. */
function adminCekKapasitas(tanggal, porsi, kecualiId) {
  wajibAdmin_();
  if (!tanggalValid(tanggal)) return null;
  var terpakai = porsiTerpakai(tanggal, semuaPesanan_(), semuaItem_(), kecualiId);
  return cekKapasitas(terpakai, porsi, bacaPengaturan_().kapasitas_harian);
}

// ---------- API publik ----------

function publikKirimPesanan(data) {
  var b = branding_();
  if (!b.form_publik_aktif) throw new Error('Form pesanan sedang ditutup. Silakan hubungi kami lewat WhatsApp.');
  data = data || {};
  if (data.situs_web) throw new Error('Pesanan tidak bisa diproses.'); // jebakan bot (honeypot)
  delete data.id;
  delete data.override_kapasitas;
  var hasil = denganKunci_(function () { return simpanPesananInti_(data, { publik: true }); });
  return {
    nomor: hasil.pesanan.nomor,
    total: hasil.pesanan.total,
    items: hasil.items,
    pesan: b.pesan_terima_kasih,
    link_wa: normalisasiNoHp(b.no_wa) ? buatLinkWa(b.no_wa, 'Halo, saya baru memesan lewat form.\n\n' + hasil.pesan_wa) : '',
  };
}
