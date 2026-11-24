# SEKOLAHKITA — Sistem Informasi Manajemen Sekolah Kurikulum Merdeka

**SEKOLAHKITA** adalah aplikasi administrasi akademik, kesiswaan, presensi, penilaian Kurikulum Merdeka, pencetakan rapor A4, dan integrasi Dapodik/E-Rapor berbasis web lokal (*offline-first*) yang dirancang khusus untuk satuan pendidikan di Indonesia (default awal: **SD Negeri Nusantara 01**, NPSN `20104567`, sistem guru kelas).

---

## 1. Catatan Arsitektur & Lingkungan Eksekusi

Lingkungan *sandbox* Node.js pada AI Studio menjalankan **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4** dengan database lokal **SQLite (`better-sqlite3`) + Drizzle ORM**. Oleh karena itu:
- Seluruh layanan *backend*, validasi Zod, kontrol akses RBAC, pemrosesan Excel (`exceljs`), cadangan SQLite, dan integrasi Dapodik berjalan secara utuh melalui API Routes Next.js (`app/api/*`) dan `lib/server/*`.
- Untuk pemaketan aplikasi desktop Windows/Linux secara luring menggunakan **Tauri** di luar AI Studio, jalankan Next.js dengan mode `output: 'standalone'` sebagai *sidecar* Node.js lokal yang diarahkan oleh `tauri.conf.json` (`http://127.0.0.1:3000`).

---

## 2. Fitur Utama yang Tersedia

1. **Keamanan & RBAC 8 Peran**:
   - Pengaturan sandi Administrator awal (*First-Run Bootstrap*) tanpa kata sandi bawaan yang tertanam (*no hardcoded password*).
   - 8 Peran RBAC: `Super Administrator`, `Administrator Sekolah`, `Kepala Sekolah`, `Operator Sekolah`, `Wali Kelas`, `Guru Mata Pelajaran`, `Bendahara`, dan `Staff Tata Usaha`.
   - Sesi cookie terenkripsi HMAC (`HttpOnly`, `SameSite=None`, `Secure`) serta pencatatan `audit_logs`.
2. **Dasbor & Manajemen Data Pokok**:
   - Identitas Satuan Pendidikan (NPSN, Kepala Sekolah, logo, pengaturan fitur sekolah, Tahun Ajaran & Semester aktif, Kalender Pendidikan & Ruang Kelas).
   - Manajemen Rombel & Kenaikan Kelas (`1 A` – `6 A`, Fase A–C).
   - Manajemen Data Murid lengkap (NISN 10 digit, mutasi, catatan kesiswaan, template & impor-ekspor `.xlsx`).
   - Manajemen Guru & Tenaga Kependidikan (NUPTK, NIP, penugasan jam mengajar).
3. **Kurikulum Merdeka & KBM**:
   - Mata Pelajaran Intrakurikuler, Capaian Pembelajaran (CP), Alur Tujuan Pembelajaran (TP/ATP), KKTP, dan Generator Rencana Pembelajaran Mendalam (RPM) dengan opsional Asisten Draf AI (`@google/genai`, tanpa mengirim data pribadi murid).
   - Jadwal Pelajaran Mingguan dengan deteksi bentrok jadwal guru antar rombel + simulasi bel sekolah Web Audio API.
   - Jurnal Mengajar Harian Guru.
4. **Asesmen, Presensi & Rapor A4**:
   - Asesmen Sumatif (bobot LM/STS/SAS dapat diatur dan otomatis menghitung ulang nilai, remedial KKTP, pengayaan, template & impor Excel).
   - Asesmen Formatif berbasis TP, Kokurikuler (8 Dimensi Profil Lulusan), Ekstrakurikuler, dan Catatan Wali Kelas.
   - Presensi Harian Murid & Guru (peringatan otomatis jika bertepatan hari libur kalender, aksi cepat *Hadir Semua*, unduh rekap `.xlsx`).
   - Leger Kelas `.xlsx` dan **Cetak Rapor A4** (satuan atau massal seluruh kelas via CSS `@media print`).
5. **Integrasi Dapodik, E-Rapor & Cadangan SQLite**:
   - Konfigurasi WebService Dapodik (`localhost:5774`), uji koneksi, pemetaan ID eksternal tanpa menimpa ID lokal, **Mode Sandbox**, serta alur 2 tahap **MATEV → Nilai Akhir** dengan opsi **Dry-Run**.
   - Impor/Ekspor Excel E-Rapor dengan pemetaan nomor kolom fleksibel dan pratinjau sebelum simpan.
   - Snapshot cadangan database SQLite (`.db`) dengan checksum SHA-256, unduh, dan pemulihan aman.

---

## 3. Menjalankan Secara Lokal

```bash
# 1. Instal dependensi
npm install

# 2. Salin variabel lingkungan (opsional)
cp .env.example .env

# 3. Jalankan server pengembangan (port 3000)
npm run dev

# 4. Jalankan pengujian unit & integrasi
npm test

# 5. Bangun versi produksi
npm run build
npm run start
```

### Pengaturan Pertama Kali (First-Run Setup)
Saat membuka `/login` pertama kali, aplikasi mendeteksi akun administrator belum memiliki kata sandi (`bootstrapRequired: true`) dan menampilkan formulir **Pengaturan Awal Administrator** untuk menetapkan kata sandi Anda secara langsung (opsional: atur `ADMIN_BOOTSTRAP_PASSCODE` pada `.env` jika diperlukan otorisasi tambahan).

---

## 4. Panduan Pemaketan Desktop Tauri (Luring Penuh)

Untuk memaketkan SEKOLAHKITA menjadi aplikasi desktop Windows (`.msi`/`.exe`) atau Linux (`.AppImage`/`.deb`) dengan Tauri v2:
1. Bangun aplikasi Next.js standalone: `npm run build` (menghasilkan `.next/standalone/server.js`).
2. Siapkan folder `src-tauri/` dengan `tauri-plugin-shell` untuk menjalankan binary Node.js lokal dengan `PORT=3000`, `HOSTNAME=127.0.0.1`, dan `DATABASE_PATH` mengarah ke direktori data aplikasi pengguna (`app_data_dir`).
3. Arahkan `frontendDist` / `devUrl` di `tauri.conf.json` ke `http://127.0.0.1:3000`.
