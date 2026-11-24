# Dapur Nusantara

Sistem manajemen pemesanan catering untuk Dapur Nusantara, dibangun dengan
Laravel 12, Livewire 4 (Volt + Flux), Tailwind CSS 4, dan MySQL.

Repositori ini berisi kerangka **Tahap 0**: instalasi framework, autentikasi
dasar (login, registrasi, lupa password, verifikasi email, pengaturan profil),
peran pengguna `admin` dan `staff`, serta struktur folder untuk modul berikutnya.

## Prasyarat

| Perangkat | Versi minimum |
|-----------|---------------|
| PHP       | 8.2 (disarankan 8.3+) dengan ekstensi `pdo_mysql`, `mbstring`, `openssl`, `xml`, `curl`, `zip` |
| Composer  | 2.x |
| Node.js   | 20+ (dengan npm) |
| MySQL     | 8.0 (MariaDB 10.6+ juga bisa) |

Di Windows, cara termudah memakai [Laragon](https://laragon.org) atau XAMPP
yang sudah membawa PHP dan MySQL.

## Menjalankan di server lokal

```bash
# 1. Clone dan masuk ke folder proyek
git clone https://github.com/<akun-anda>/<nama-repo>.git dapur-nusantara
cd dapur-nusantara

# 2. Instal dependensi
composer install
npm install

# 3. Siapkan file environment
cp .env.example .env        # Windows: copy .env.example .env
php artisan key:generate
```

4. Buat database kosong di MySQL:

```sql
CREATE DATABASE dapur_nusantara CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

5. Sesuaikan koneksi di `.env` bila perlu (`DB_HOST`, `DB_PORT`,
   `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`), lalu jalankan migrasi dan
   seeder:

```bash
php artisan migrate --seed
```

6. Jalankan aplikasi:

```bash
composer run dev
```

Perintah di atas menyalakan web server, queue worker, log viewer, dan Vite
sekaligus. Buka <http://localhost:8000>.

Bila ingin menjalankannya terpisah: `php artisan serve` di satu terminal dan
`npm run dev` di terminal lain. Untuk mode produksi, ganti `npm run dev`
dengan `npm run build`.

### Akun admin awal

Seeder membuat satu akun admin dari nilai di `.env`:

| Variabel         | Bawaan                       |
|------------------|------------------------------|
| `ADMIN_EMAIL`    | `admin@dapurnusantara.test`  |
| `ADMIN_PASSWORD` | `password`                   |

Ganti password ini sebelum aplikasi dipakai di luar komputer lokal.
Pengguna yang mendaftar lewat halaman registrasi otomatis berperan `staff`.

## Menjalankan tes

```bash
php artisan test
```

Tes memakai SQLite in-memory (lihat `phpunit.xml`), jadi tidak menyentuh
database MySQL lokal. Format kode dicek dengan `vendor/bin/pint`.

## Struktur folder

```
app/
├── Enums/UserRole.php                 # Peran pengguna: admin, staff
├── Http/Middleware/EnsureUserHasRole  # Middleware `role:admin` / `role:admin,staff`
├── Livewire/                          # Kelas komponen Livewire
├── Models/                            # Model Eloquent
└── Services/                          # Logika bisnis bersama (harga, jadwal, invoice)
resources/views/
├── components/layouts/                # Layout aplikasi dan halaman auth
└── livewire/
    ├── auth/  settings/               # Bawaan starter kit
    ├── pesanan/                       # Modul pemesanan
    ├── menu/                          # Menu dan paket catering
    ├── pelanggan/                     # Data pelanggan perusahaan
    ├── dapur/                         # Produksi dan jadwal masak
    ├── pengiriman/                    # Kurir dan pengiriman
    └── laporan/                       # Laporan penjualan
```

Contoh membatasi rute untuk admin saja:

```php
Route::middleware(['auth', 'role:admin'])->group(function () {
    // ...
});
```

## Catatan teknis

- Zona waktu bawaan `Asia/Jakarta` dan locale `id` (atur lewat `APP_TIMEZONE`
  dan `APP_LOCALE` di `.env`).
- `config/livewire.php` mengarahkan layout full-page Livewire ke
  `components.layouts.app`, karena Livewire 4 secara bawaan mencari
  `layouts::app`.
