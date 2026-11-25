# Panduan Troubleshooting & Debugging SEKOLAHKITA

Dokumen ini berisi langkah diagnosis cepat dan solusi untuk kendala operasional maupun teknis yang paling sering ditemui saat memasang, menjalankan, dan memelihara **SEKOLAHKITA**.

---

## 1. Masalah Instalasi & Dependensi Native

### Gejala: Error kompilasi `better-sqlite3` atau `node-gyp` saat `npm install`
- **Penyebab**: Perkakas build C/C++ belum tersedia di sistem operasi atau versi Node.js tidak cocok dengan binary prebuild.
- **Solusi**:
  1. Pastikan menggunakan **Node.js v20 LTS** atau **v22 LTS** (`node -v`).
  2. Pasang perkakas build:
     - **Ubuntu/Debian**: `sudo apt install -y build-essential python3`
     - **Windows**: Instal *Visual Studio Build Tools* dengan workload *Desktop development with C++*.
  3. Hapus folder `node_modules` lalu jalankan ulang `npm install`.

---

## 2. Masalah Login, Sesi & Cookie

### Gejala: Berhasil login tetapi langsung kembali ke `/login`, atau mutasi ditolak (`403` / `401`)
- **Penyebab**:
  1. Cookie sesi aplikasi dikonfigurasi sebagai `HttpOnly; Secure; SameSite=None; Partitioned` agar aman berjalan di dalam HTTPS maupun `iframe`. Jika diakses lewat HTTP non-TLS melalui IP LAN selain `localhost`, browser modern dapat menolak penyimpanan cookie `Secure`.
  2. `SESSION_SECRET` tidak diisi di `.env`, sehingga setiap restart server menghasilkan kunci penandatangan acak baru dan memutus seluruh sesi aktif.
- **Solusi**:
  1. Tetapkan `SESSION_SECRET` tetap di berkas `.env` (minimal 32 karakter acak).
  2. Untuk akses multi-perangkat di jaringan sekolah, pasang reverse proxy HTTPS (Nginx/Caddy) dan teruskan header `Host`, `X-Forwarded-Host`, serta `X-Forwarded-Proto: https`.
  3. Untuk penggunaan di satu PC lokal, gunakan `http://localhost:3000`.

### Gejala: Lupa kata sandi akun Administrator (`admin`)
- **Solusi**:
  - Jika belum ada data penting: hentikan server, cadangkan/hapus berkas database di `DATABASE_PATH`, lalu nyalakan ulang server untuk memunculkan formulir **Pengaturan Awal Administrator** kembali.
  - Jika data produksi sudah terisi: minta akun berwenang (`SUPER_ADMIN` lain) mereset sandi melalui **Pengaturan → Pengguna**, atau setel sementara sandi baru secara langsung melalui skrip pemulihan Node.js menggunakan `hashPassword` sebelum masuk kembali.

---

## 3. Masalah Kunci API & Asisten Draf AI

### Gejala: Peringatan *"Belum ada kunci API. Fitur 'Generate' belum dapat digunakan."*
- **Penyebab**: Aplikasi memakai kebijakan **Kunci API Manual Wajib** (tidak memakai fallback environment). Selain itu, **Kunci Sekolah** hanya berlaku untuk Admin/Kepala Sekolah; **Guru / Wali Kelas** wajib mengisi **Kunci API Pribadi**.
- **Solusi**:
  1. Admin/Kepala Sekolah: buka **Pengaturan → Kunci API**, isi Kunci API, Model, dan Base URL, lalu klik **Simpan**.
  2. Guru/Wali Kelas: buka **Pengaturan → Akun Saya** (atau tab **Kunci API**), isi **Kunci API Pribadi**, lalu klik **Simpan**.

### Gejala: Error *"Base URL wajib menggunakan protokol HTTPS"* atau *"Alamat host lokal tidak diizinkan"*
- **Penyebab**: Penjaga keamanan jaringan menolak skema `http://`, IP lokal/privat (`127.0.0.1`, `192.168.x.x`), atau parameter query di dalam kolom **Base URL**.
- **Solusi**: Gunakan URL `https://` publik resmi penyedia AI (misalnya `https://generativelanguage.googleapis.com`, `https://openrouter.ai/api/v1`, `https://api.deepseek.com`, atau `https://api.groq.com/openai/v1`).

### Gejala: Error HTTP `401` / `404` / `429` saat klik *Bantu Draf AI*
- **`401 Unauthorized`**: Kunci API salah, kedaluwarsa, atau belum aktif di dashboard penyedia.
- **`404 Not Found`**: Nama **Model** atau akhiran path `/v1` pada **Base URL** tidak sesuai dokumentasi penyedia. Buka **Tutorial Singkat** dan klik **Pakai Preset Model & URL**.
- **`429 Too Many Requests`**: Kuota/limit permintaan kunci API Anda habis; tunggu beberapa saat atau ganti kunci/penyedia.
- **Gagal dekripsi setelah ganti `SESSION_SECRET`**: Simpan ulang Kunci API baru di Pengaturan agar dienkripsi ulang dengan `SESSION_SECRET` yang aktif.

---

## 4. Masalah Cetak PDF A4, Kop Surat, Stempel & Foto

### Gejala: Pratinjau PDF atau unduhan gagal memuat logo, tanda tangan, stempel, atau foto murid
- **Solusi**: Pastikan berkas aset di folder penyimpanan masih tersedia dan berformat **PNG, JPEG, atau WebP** valid (bukan ekstensi palsu yang di-rename). Unggah ulang melalui **Pengaturan → Dokumen & TTD** atau modal edit murid.

### Gejala: Kop Surat / Tanda Tangan / Stempel tidak tampil pada Biodata atau Piagam
- **Solusi**: Periksa tiga saklar cepat di bilah atas halaman **Cetak** (**Kop Surat**, **Tanda Tangan**, **Stempel**) maupun pengaturan baku pada **Pengaturan → Dokumen & TTD**.

### Gejala: Halaman PDF Rapor masih tampak terlalu padat atau bergeser di perangkat tertentu
- **Solusi**: Gunakan tombol **Preview & Simpan PDF** (bukan `Ctrl+P` langsung saat perlu ekspor arsip) agar mesin paginasi A4 memotong tepat di batas antarbaris tabel dan menyematkan catatan kaki identitas murid secara presisi di bagian paling bawah setiap halaman.

---

## 5. Masalah Database SQLite & Cadangan

### Gejala: `SQLITE_BUSY: database is locked`
- **Penyebab**: Ada proses lain (seperti skrip eksternal atau backup manual penyalinan file mentah) yang mengunci file `.db` / `.db-wal`.
- **Solusi**:
  1. Selalu gunakan menu **Pengaturan → Cadangan → Buat Cadangan Baru** atau perintah resmi `sqlite3 data/sekolahkita.db ".backup 'backup.db'"` agar mode WAL disinkronkan aman.
  2. Pastikan hanya ada satu instance server Node.js yang menulis ke file SQLite yang sama.

### Gejala: Gagal impor/restore cadangan database
- **Solusi**: Pastikan berkas berakhiran `.db` merupakan hasil cadangan SQLite SEKOLAHKITA yang valid (bukan `.xlsx` atau arsip `.zip`). Sistem memeriksa header SQLite serta integritas tabel sebelum menimpa database aktif.

---

## 6. Masalah Integrasi Dapodik & E-Rapor

### Gejala: Uji koneksi Dapodik gagal (`ECONNREFUSED` / timeout)
- **Solusi**:
  1. Pastikan aplikasi **Dapodik Desktop** terbuka dan layanan WebService pada port `5774` berjalan.
  2. Cek kecocokan **NPSN** dan **Token WebService** pada Pengaturan Dapodik.
  3. Bila SEKOLAHKITA berjalan di server terpisah atau *sandbox cloud*, alamat `http://localhost:5774` mengarah ke komputer server itu sendiri — gunakan IP LAN komputer Dapodik atau aktifkan **Mode Sandbox** + **Dry-Run** untuk simulasi aman.

---

## 7. Panduan Debugging untuk Operator & Pengembang

Gunakan langkah sistematis berikut saat menelusuri bug atau perilaku tidak terduga:

### A. Verifikasi Kode, Tipe & Pengujian Otomatis

```bash
# 1. Jalankan seluruh unit & integrasi test (auth, RBAC, enkripsi Kunci API, PDF slicing, Dapodik)
npm test

# 2. Pemeriksaan linter ESLint
npm run lint

# 3. Kompilasi penuh Next.js + pengecekan TypeScript ketat
npm run build
```

### B. Pemeriksaan Log Server & Audit Aktivitas
- **Log Konsol Node.js / Systemd**:
  ```bash
  # Jika memakai systemd
  journalctl -u sekolahkita -f
  ```
- **Inspeksi Audit Log di SQLite** (untuk melacak perubahan data, login, atau error API tanpa membuka browser):
  ```bash
  sqlite3 data/sekolahkita.db "SELECT created_at, actor_name, action, entity_type, details FROM audit_logs ORDER BY id DESC LIMIT 20;"
  ```

### C. Pemeriksaan Cepat Endpoint API (Health & Auth Guard)

```bash
# Pastikan halaman utama & auth gate merespons normal (endpoint terproteksi wajib 401 saat belum login)
curl -s -o /dev/null -w "/login:%{http_code}\n" http://localhost:3000/login
curl -s -o /dev/null -w "/api/context:%{http_code}\n" http://localhost:3000/api/context
curl -s -o /dev/null -w "/api/ai/config:%{http_code}\n" http://localhost:3000/api/ai/config
```

### D. Inspeksi Struktur Tabel Database SQLite

```bash
# Daftar seluruh tabel & kolom konfigurasi
sqlite3 data/sekolahkita.db ".tables"
sqlite3 data/sekolahkita.db "PRAGMA journal_mode;"
sqlite3 data/sekolahkita.db "SELECT id, owner_key, scope, model, base_url, updated_at FROM ai_configs;"
```
> **Catatan Keamanan Debug**: Kolom `api_key_enc` pada tabel `ai_configs` hanya menyimpan *ciphertext* terenkripsi AES-256-GCM. Jangan pernah mencetak kunci dekripsi atau variabel `.env` ke log produksi.
