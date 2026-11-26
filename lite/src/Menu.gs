/**
 * Menu: dibaca dari sheet Menu dan disimpan di CacheService agar cepat.
 */

function menuSemua_() {
  var cache = CacheService.getScriptCache();
  var ada = cache.get(KUNCI_CACHE_MENU);
  if (ada) return JSON.parse(ada);
  var list = bacaSemua_(SHEET.MENU).filter(function (m) { return m.id !== '' && m.nama; }).map(function (m) {
    return {
      id: Number(m.id),
      kode: String(m.kode || ''),
      nama: String(m.nama),
      kategori: String(m.kategori || ''),
      harga: keRupiah(m.harga),
      aktif: m.aktif === true || nilaiYa(m.aktif),
      catatan: String(m.catatan || ''),
      _baris: m._baris,
    };
  });
  cache.put(KUNCI_CACHE_MENU, JSON.stringify(list), 600);
  return list;
}

function hapusCacheMenu_() {
  CacheService.getScriptCache().remove(KUNCI_CACHE_MENU);
}

/** Dipanggil otomatis saat sheet diedit langsung, supaya cache tidak basi. */
function onEdit(e) {
  try {
    var nama = e && e.range ? e.range.getSheet().getName() : '';
    if (nama === SHEET.MENU) hapusCacheMenu_();
    if (nama === SHEET.PENGATURAN) CacheService.getScriptCache().remove(KUNCI_CACHE_PENGATURAN);
  } catch (err) { /* abaikan */ }
}

function menuUntukPublik_() {
  return menuSemua_().filter(function (m) { return m.aktif; }).map(function (m) {
    return { id: m.id, nama: m.nama, kategori: m.kategori, harga: m.harga, catatan: m.catatan };
  });
}

/** Tambah atau ubah menu dari halaman admin. */
function adminSimpanMenu(data) {
  wajibAdmin_();
  var nama = String(data.nama || '').trim().slice(0, 100);
  var harga = keRupiah(data.harga);
  if (!nama) throw new Error('Nama menu wajib diisi.');
  if (harga < 0) throw new Error('Harga tidak boleh negatif.');
  return denganKunci_(function () {
    hapusCacheMenu_();
    var semua = bacaSemua_(SHEET.MENU);
    var kode = String(data.kode || '').trim().slice(0, 20);
    var bentrok = semua.filter(function (m) {
      return kode && String(m.kode) === kode && String(m.id) !== String(data.id || '');
    });
    if (bentrok.length) throw new Error('Kode menu "' + kode + '" sudah dipakai.');
    var obj = {
      kode: teksSel(kode),
      nama: teksSel(nama),
      kategori: teksSel(String(data.kategori || '').trim().slice(0, 50)),
      harga: harga,
      aktif: data.aktif ? 'Ya' : 'Tidak',
      catatan: teksSel(String(data.catatan || '').trim().slice(0, 200)),
    };
    if (data.id) {
      var lama = semua.filter(function (m) { return String(m.id) === String(data.id); })[0];
      if (!lama) throw new Error('Menu tidak ditemukan.');
      obj.id = lama.id;
      ubahBaris_(SHEET.MENU, lama._baris, obj);
    } else {
      obj.id = idBerikut_(semua);
      tambahBaris_(SHEET.MENU, [obj]);
    }
    hapusCacheMenu_();
    return menuSemua_();
  });
}
