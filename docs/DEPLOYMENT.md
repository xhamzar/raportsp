# Panduan Deployment Produksi SEKOLAHKITA (Node.js Standalone)

Dokumen ini menjelaskan langkah pemasangan dan pemeliharaan **SEKOLAHKITA** pada server sekolah lokal maupun VPS berbasis Node.js.

## 1. Prasyarat Lingkungan

- **Node.js**: v20 LTS atau v22 LTS.
- **Sistem Operasi**: Linux (Ubuntu 22.04/24.04 LTS disarankan) atau Windows Server.
- **Penyimpanan**: Minimal 2 GB ruang kosong untuk database SQLite WAL dan arsip cadangan berkala.
- **Kompilasi Native**: `better-sqlite3` membutuhkan perkakas build C/C++ standar (`build-essential` + `python3` di Linux) saat instalasi dependensi.

## 2. Variabel Lingkungan Wajib (`.env`)

Buat berkas `.env` di direktori akar proyek (jangan pernah commit rahasia ke Git):

```env
NODE_ENV=production
PORT=3000
DATABASE_PATH=./data/sekolahkita.db
# Opsional: sandi awal administrator otomatis saat server pertama kali menyala
# ADMIN_BOOTSTRAP_PASSCODE=SandiKuatSekolah2026!
# Opsional: hanya diisi jika fitur Asisten AI Kurikulum diaktifkan di Pengaturan Sekolah
# GEMINI_API_KEY=
```

## 3. Build & Menjalankan Mode Standalone

1. Pasang seluruh dependensi produksi dan build aplikasi Next.js:

   ```bash
   npm ci
   npm run build
   ```

2. Salin aset statis dan folder `public` ke dalam hasil build standalone:

   ```bash
   cp -r public .next/standalone/public
   cp -r .next/static .next/standalone/.next/static
   ```

3. Jalankan server produksi di port `3000` (atau menggunakan PM2 / systemd):

   ```bash
   PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js
   ```

   Contoh unit **systemd** (`/etc/systemd/system/sekolahkita.service`):

   ```ini
   [Unit]
   Description=SEKOLAHKITA School Management Server
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/opt/sekolahkita
   Environment=NODE_ENV=production
   Environment=PORT=3000
   EnvironmentFile=/opt/sekolahkita/.env
   ExecStart=/usr/bin/node /opt/sekolahkita/.next/standalone/server.js
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

## 4. Reverse Proxy HTTPS & Keamanan Cookie

Karena cookie sesi menggunakan `HttpOnly; Secure; SameSite=None; Partitioned`, akses melalui jaringan sekolah dianjurkan melewati reverse proxy HTTPS (Nginx atau Caddy):

- Teruskan header `Host`, `X-Forwarded-Host`, dan `X-Forwarded-Proto: https` agar validasi origin mutasi (`POST`/`PUT`/`PATCH`/`DELETE`) berjalan mulus.
- Aktifkan TLS (Let's Encrypt atau sertifikat intranet sekolah) pada port `443`.
- Header keamanan (`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, dan `Content-Security-Policy`) telah disematkan langsung di `next.config.ts`.

## 5. Koneksi WebService Dapodik Lokal

- Pastikan aplikasi **Dapodik Desktop** berjalan pada port standar `5774` di komputer operator atau jaringan lokal sekolah.
- Pada menu **Dapodik & E-Rapor**, isi URL WebService (misal `http://192.168.8.114:5774` atau `http://localhost:5774`), NPSN 8 digit, serta Token WebService dari menu Pengaturan WebService di Dapodik.
- Untuk pengujian tanpa server Dapodik aktif, gunakan mode **Sandbox** dan aktifkan opsi **Dry-Run** sebelum melakukan pengiriman nilai (`postMatevRapor` → `postNilai?table=rapor`).

## 6. Cadangan Database SQLite Berkala

Database berjalan dalam mode **WAL (`journal_mode = WAL`, `synchronous = NORMAL`)**. Gunakan fitur **Unduh Cadangan SQLite** di menu **Pengaturan & Cadangan** atau jadwalkan salinan aman via `sqlite3 .backup` setiap hari:

```bash
0 2 * * * sqlite3 /opt/sekolahkita/data/sekolahkita.db ".backup '/var/backups/sekolahkita/db-$(date +\%F).db'"
```
