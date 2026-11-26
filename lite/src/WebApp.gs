/**
 * Pintu masuk web app.
 *
 * Satu kode, dua deployment (lihat lite/README.md):
 *  - Publik: "Jalankan sebagai: Saya", "Akses: Siapa saja". URL ini dipasang di tombol
 *    "Pesan Sekarang" website company profile. Menampilkan form pesanan.
 *  - Admin: "Jalankan sebagai: Pengguna yang mengakses", "Akses: Siapa saja yang punya akun Google".
 *    Buka dengan ?halaman=admin. Email login dicek terhadap daftar admin_emails.
 */

function doGet(e) {
  var halaman = String((e && e.parameter && e.parameter.halaman) || '').toLowerCase();
  var b = branding_();
  var t;
  if (halaman === 'admin') {
    t = HtmlService.createTemplateFromFile('Admin');
    t.judul = 'Admin - ' + b.nama_usaha;
  } else {
    t = HtmlService.createTemplateFromFile('Publik');
    t.judul = 'Pesan - ' + b.nama_usaha;
  }
  t.branding = b;
  var out = t.evaluate()
    .setTitle(t.judul)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  // Form publik boleh disematkan (iframe) di website company profile.
  if (halaman !== 'admin') out.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return out;
}

/** Sisipkan file HTML lain (CSS/JS bersama) ke dalam template. */
function include(nama) {
  return HtmlService.createHtmlOutputFromFile(nama).getContent();
}

/** Ubah objek ke JSON yang aman disisipkan di dalam tag <script>. */
function jsonAman(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

// ---------- Data awal halaman ----------

function publikMuat() {
  var b = branding_();
  return {
    branding: b,
    menu: b.form_publik_aktif ? menuUntukPublik_() : [],
    hari_ini: hariIni_(),
  };
}

function adminMuat() {
  var email = emailPengguna_();
  if (!adalahAdmin_()) {
    return { akses: false, email: email };
  }
  var p = bacaPengaturan_();
  var pesanan = semuaPesanan_();
  return {
    akses: true,
    email: email,
    branding: branding_(),
    hari_ini: hariIni_(),
    menu: menuSemua_(),
    status: SEMUA_STATUS,
    pengaturan: {
      nama_usaha: String(p.nama_usaha || ''),
      no_wa: String(p.no_wa || ''),
      alamat: String(p.alamat || ''),
      kapasitas_harian: Number(p.kapasitas_harian) || 0,
      form_publik_aktif: nilaiYa(p.form_publik_aktif),
      logo_url: String(p.logo_url || ''),
      warna_utama: warnaAman(p.warna_utama, WARNA_BAWAAN),
      pesan_terima_kasih: String(p.pesan_terima_kasih || ''),
      admin_emails: daftarAdmin_().join(', '),
    },
    url_publik: String(p.url_publik || ''),
    upgrade: {
      alasan: infoUpgrade(jumlahPesanan7Hari_(pesanan), selTerpakai_()),
      url: String(p.url_info_laravel || ''),
    },
  };
}

/** Admin mengubah pengaturan dari halaman web. admin_emails hanya bisa diubah di sheet. */
function adminSimpanPengaturan(data) {
  wajibAdmin_();
  var kap = parseInt(data.kapasitas_harian, 10);
  if (!(kap >= 0)) throw new Error('Kapasitas harian harus angka 0 atau lebih.');
  if (data.no_wa && !normalisasiNoHp(data.no_wa)) throw new Error('No. WhatsApp usaha tidak valid.');
  if (data.logo_url && !/^https:\/\//.test(String(data.logo_url))) throw new Error('URL logo harus diawali https://');
  var nilai = {
    nama_usaha: teksSel(String(data.nama_usaha || '').trim().slice(0, 80) || 'Dapur Nusantara'),
    no_wa: teksSel(String(data.no_wa || '').trim()),
    alamat: teksSel(String(data.alamat || '').trim().slice(0, 200)),
    kapasitas_harian: kap,
    form_publik_aktif: data.form_publik_aktif ? 'Ya' : 'Tidak',
    logo_url: teksSel(String(data.logo_url || '').trim()),
    warna_utama: teksSel(warnaAman(data.warna_utama, WARNA_BAWAAN)),
    pesan_terima_kasih: teksSel(String(data.pesan_terima_kasih || '').trim().slice(0, 300)),
  };
  denganKunci_(function () {
    var lama = bacaPengaturan_();
    Object.keys(nilai).forEach(function (k) {
      simpanPengaturan_(k, nilai[k]);
    });
    catatLog_('', 'ubah_pengaturan', 'kapasitas ' + lama.kapasitas_harian, 'kapasitas ' + kap);
  });
  return adminMuat();
}
