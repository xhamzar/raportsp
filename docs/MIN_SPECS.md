# Spesifikasi Minimum & Rekomendasi Sistem

Dokumen ini merangkum kebutuhan perangkat keras, perangkat lunak, jaringan, dan kapasitas penyimpanan untuk menjalankan **SEKOLAHKITA** secara optimal di lingkungan sekolah.

---

## 1. Spesifikasi Server / Komputer Host

Karena SEKOLAHKITA berjalan pada runtime Node.js dengan database lokal SQLite WAL, aplikasi tetap ringan bahkan pada perangkat sekolah standar.

| Komponen | Spesifikasi Minimum (Sekolah Kecil / Uji Coba) | Spesifikasi Rekomendasi (Produksi LAN Sekolah) |
| :--- | :--- | :--- |
| **CPU / Prosesor** | 2 vCPU / Dual-Core x86_64 atau ARM64 (≥ 1.8 GHz) | 4 vCPU / Quad-Core (Intel Core i3/i5 Gen-10+ atau setara) |
| **RAM** | 2 GB (termasuk build & runtime) | 4 GB – 8 GB |
| **Penyimpanan** | 2 GB ruang kosong (HDD/SSD) | ≥ 10 GB SSD/NVMe (untuk DB WAL, foto murid, dan arsip backup) |
| **Sistem Operasi** | Windows 10/11 (64-bit), Ubuntu 20.04+, Debian 11+, atau macOS 12+ | Ubuntu 22.04 / 24.04 LTS Server atau Windows Server 2019/2022 |
| **Node.js** | v20.11 LTS | v20 LTS terbaru atau v22 LTS |
| **Jaringan** | Luring penuh (`localhost`) untuk operator tunggal | LAN Gigabit / Wi-Fi sekolah stabil + reverse proxy HTTPS untuk multi-guru |

---

## 2. Spesifikasi Perangkat Klien (Guru, Wali Kelas & Operator)

Pengguna mengakses aplikasi melalui peramban web modern tanpa perlu memasang perangkat lunak tambahan:

| Komponen | Minimum | Rekomendasi |
| :--- | :--- | :--- |
| **Peramban Web** | Google Chrome 110+, Microsoft Edge 110+, Firefox 115+, atau Safari 16.4+ | Chrome / Edge versi stabil terbaru (optimal untuk pratinjau & ekspor PDF A4) |
| **Resolusi Layar** | 1280 × 720 px (atau layar ponsel 360 px untuk input cepat) | ≥ 1366 × 768 px atau 1920 × 1080 px (ideal untuk matriks nilai & pratinjau rapor) |
| **RAM Perangkat Klien** | 4 GB | 8 GB (mempercepat render PDF banyak murid sekaligus satu kelas) |

---

## 3. Estimasi Kapasitas Database & Penyimpanan

| Skala Sekolah | Perkiraan Jumlah Murid | Perkiraan Ukuran SQLite + Foto + Aset | Rekomendasi Frekuensi Cadangan |
| :--- | :--- | :--- | :--- |
| **Kecil** | 50 – 200 murid | ~15 MB – 60 MB | Mingguan + sebelum bagi rapor |
| **Menengah** | 200 – 700 murid | ~60 MB – 250 MB | Harian / 2 kali seminggu |
| **Besar** | 700 – 2.000 murid | ~250 MB – 800 MB | Harian otomatis (`cron` + `sqlite3 .backup`) |

---

## 4. Kebutuhan Koneksi Internet

- **Mode Luring (Offline)**: Beranda, Data Murid, Kurikulum manual, Jadwal & Bel, Jurnal Mengajar, Presensi, Penilaian, Leger Excel, dan **Cetak PDF A4** bekerja **100% tanpa koneksi internet**.
- **Memerlukan Jaringan Lokal (LAN)**: Sinkronisasi **WebService Dapodik** pada port `5774` apabila server aplikasi dan komputer Dapodik berada di perangkat berbeda dalam satu jaringan sekolah.
- **Memerlukan Internet**: Hanya saat menggunakan fitur opsional **Asisten Draf AI** (menghubungi API eksternal Google Gemini / OpenRouter / DeepSeek / Groq / OpenAI) serta pembaruan paket saat instalasi awal.
