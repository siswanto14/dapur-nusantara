/**
 * Cek akses admin. Validasi SELALU dilakukan di server, bukan hanya di UI.
 *
 * Catatan Apps Script: email pengguna hanya terbaca jika web app dijalankan
 * sebagai "pengguna yang mengakses" (deployment Admin) atau jika yang membuka
 * adalah pemilik skrip. Di deployment Publik ("dijalankan sebagai saya")
 * email pengunjung selalu kosong, sehingga pengunjung tidak bisa menjadi admin.
 */

function emailPengguna_() {
  try {
    return String(Session.getActiveUser().getEmail() || '').toLowerCase();
  } catch (e) {
    return '';
  }
}

function daftarAdmin_() {
  var list = daftarEmail(bacaPengaturan_().admin_emails);
  var pemilik = '';
  try { pemilik = String(ss_().getOwner().getEmail() || '').toLowerCase(); } catch (e) { /* abaikan */ }
  if (pemilik && list.indexOf(pemilik) < 0) list.push(pemilik);
  return list;
}

function adalahAdmin_() {
  var email = emailPengguna_();
  return !!email && daftarAdmin_().indexOf(email) >= 0;
}

function wajibAdmin_() {
  if (!adalahAdmin_()) {
    throw new Error('Akses ditolak. Email Anda (' + (emailPengguna_() || 'tidak terbaca') +
      ') tidak terdaftar sebagai admin. Hubungi pemilik usaha.');
  }
}
