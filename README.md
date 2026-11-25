# SEKOLAHKITA — Sistem Informasi Manajemen Sekolah Kurikulum Merdeka

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/Database-SQLite%20WAL-003B57)](https://www.sqlite.org/)

**SEKOLAHKITA** adalah aplikasi manajemen sekolah, administrasi guru, penilaian Kurikulum Merdeka, pencetakan dokumen resmi A4, serta integrasi Dapodik & E-Rapor berbasis web lokal (*offline-first*) untuk satuan pendidikan di Indonesia.

---

## Sorotan Utama

- **Siap Luring dengan SQLite WAL**: Data tersimpan lokal dalam satu basis data cepat tanpa ketergantungan server eksternal.
- **Keamanan & RBAC 9 Peran + Cakupan Kelas/Mapel**: Kontrol izin terperinci per modul, bootstrap kata sandi admin pertama kali (*no hardcoded credentials*), cookie sesi aman, serta log audit.
- **Kurikulum Merdeka & Asisten AI Manual (BYO Key)**: Pengelolaan CP, TP/ATP, KKTP, RPM, plus asisten draf AI dengan **Kunci API manual** (mendukung Google Gemini native dan penyedia kompatibel OpenAI seperti OpenRouter, DeepSeek, Groq) terenkripsi AES-256-GCM di server.
- **Pusat Cetak A4 & Preview PDF Gaya Google Drive**: Pratinjau interaktif (zoom, navigasi halaman, unduh PDF A4 Potret/Lanskap otomatis tanpa memotong baris tabel, cetak langsung), stempel sekolah 3 cm, tanda tangan kepala sekolah, dan saklar Kop Surat.
- **Integrasi Dapodik & E-Rapor Excel**: Dukungan WebService Dapodik (`MATEV` → `Nilai Akhir`, Mode Sandbox & Dry-Run) serta impor/ekspor `.xlsx` via ExcelJS.

---

## Daftar Dokumentasi

Seluruh dokumentasi disusun modular agar mudah dibaca oleh operator sekolah maupun pengembang:

| Dokumen | Deskripsi Singkat |
| :--- | :--- |
| [`ABOUT.md`](./ABOUT.md) | Visi produk, filosofi *offline-first*, daftar 9 peran RBAC, dan arsitektur teknologi. |
| [`LICENSE`](./LICENSE) | Teks resmi lisensi sumber terbuka **MIT License**. |
| [`docs/FEATURES.md`](./docs/FEATURES.md) | Rincian lengkap seluruh fitur dan modul aplikasi dari Beranda hingga Cadangan SQLite. |
| [`docs/INSTALLATION.md`](./docs/INSTALLATION.md) | Panduan instalasi lokal, variabel `.env`, bootstrap akun admin, dan pengaturan Kunci API manual. |
| [`docs/MIN_SPECS.md`](./docs/MIN_SPECS.md) | Spesifikasi minimum & rekomendasi perangkat keras, perangkat lunak, serta estimasi kapasitas sekolah. |
| [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md) | Solusi kendala umum (instalasi, sesi login, Kunci API, cetak PDF, SQLite, Dapodik) dan panduan *debugging*. |
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Panduan deployment produksi Node.js standalone, systemd, reverse proxy HTTPS, dan jadwal backup. |

---

## Mulai Cepat (Quick Start)

Pastikan **Node.js v20 LTS / v22 LTS** dan perkakas build C/C++ standar (untuk modul native `better-sqlite3`) sudah terpasang.

```bash
# 1. Pasang dependensi
npm install

# 2. Siapkan variabel lingkungan (opsional untuk pengembangan lokal)
cp .env.example .env

# 3. Jalankan server pengembangan di http://localhost:3000
npm run dev
```

Saat membuka aplikasi pertama kali di `/login`, sistem mendeteksi akun administrator belum memiliki kata sandi dan menampilkan formulir **Pengaturan Awal Administrator** untuk menetapkan sandi Anda secara aman.

### Perintah Penting

| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server pengembangan Next.js pada port `3000`. |
| `npm run build` | Mengompilasi build produksi dan verifikasi tipe TypeScript. |
| `npm run start` | Menjalankan hasil build produksi pada port `3000`. |
| `npm run lint` | Menjalankan pemeriksaan ESLint seluruh berkas proyek. |
| `npm test` | Menjalankan rangkaian pengujian unit & integrasi (`tests/*.test.ts`). |

---

## Lisensi

Proyek ini dirilis di bawah lisensi [**MIT License**](./LICENSE).
