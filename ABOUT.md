# Tentang SEKOLAHKITA

**SEKOLAHKITA** adalah platform Sistem Informasi Manajemen Sekolah dan Administrasi Guru Terpadu berbasis Kurikulum Merdeka yang dirancang khusus untuk kebutuhan satuan pendidikan di Indonesia (khususnya jenjang SD/MI serta sekolah berasrama).

---

## 1. Visi & Filosofi Desain

Banyak aplikasi administrasi sekolah bergantung penuh pada server awan eksternal, biaya langganan berulang, atau koneksi internet stabil sepanjang hari. **SEKOLAHKITA** dibangun dengan tiga prinsip utama:

1. **Kedaulatan Data Lokal (*Offline-First*)**  
   Seluruh data murid, nilai, presensi, arsip foto, dan konfigurasi tersimpan pada database lokal **SQLite** dengan mode **WAL (*Write-Ahead Logging*)**, sehingga sekolah memiliki kendali penuh atas data dan pencadangannya.
2. **Alur Kerja Guru & Tata Usaha Indonesia**  
   Struktur data, penomoran NIS/NISN, format tanggal baku Indonesia (KBBI), komponen Kurikulum Merdeka (CP, TP/ATP, KKTP, RPM, 8 Dimensi Profil Lulusan), lembar cetak Rapor A4, hingga sinkronisasi WebService **Dapodik** dan **E-Rapor** dirancang selaras dengan praktik administrasi sekolah di Indonesia.
3. **Aman Secara Bawaan (*Secure by Default*)**  
   Tidak ada kata sandi statis bawaan (*no hardcoded password*), pemisahan hak akses berbasis peran dan cakupan rombel/mata pelajaran, enkripsi kredensial di server, serta pencatatan aktivitas pada log audit.

---

## 2. Peran Pengguna & Hak Akses (9 Peran RBAC)

Aplikasi menyediakan 9 peran sistem yang dapat disesuaikan izinnya melalui matriks **Peran & Izin** di menu Pengaturan:

| Kode Peran | Nama Peran | Fokus Tanggung Jawab Utama |
| :--- | :--- | :--- |
| `SUPER_ADMIN` | Super Administrator | Pengelolaan penuh sistem, peran & izin, cadangan database, dan konfigurasi sekolah. |
| `ADMIN_SEKOLAH` | Administrator Sekolah | Manajemen operasional data pokok, pengguna, jadwal, dokumen cetak, dan kunci AI sekolah. |
| `KEPALA_SEKOLAH` | Kepala Sekolah | Pemantauan beranda eksekutif, persetujuan dinas luar, dokumen pengesahan rapor/piagam, dan leger. |
| `OPERATOR_SEKOLAH` | Operator Sekolah | Sinkronisasi Dapodik, impor/ekspor Excel E-Rapor, pengelolaan rombel, dan data murid. |
| `WALI_KELAS` | Wali Kelas | Pengelolaan kelas binaan, presensi harian, catatan wali kelas, leger, dan cetak rapor kelasnya. |
| `GURU` | Guru Mata Pelajaran | Perencanaan CP/TP/RPM, jurnal mengajar, serta asesmen formatif & sumatif pada mapel/kelasnya. |
| `WALI_ASUH` | Wali Asuh / Keasramaan | Pencatatan indikator, predikat, dan cetak Rapor Keasramaan murid asrama. |
| `BENDAHARA` | Bendahara | Akses rekap administrasi dan laporan disiplin/TPP tenaga pendidik. |
| `TATA_USAHA` | Staff Tata Usaha | Pencatatan buku tamu, administrasi surat dinas luar, arsip biodata murid, dan layanan cetak. |

Selain peran kustom, akun non-admin mendukung mode cakupan data (`ALL`, `ASSIGNED`, atau `CUSTOM`) agar guru hanya mengakses rombel dan mata pelajaran yang menjadi tanggung jawabnya.

---

## 3. Arsitektur Teknologi

| Lapisan | Teknologi |
| :--- | :--- |
| **Framework Web & API** | Next.js 15 (App Router), React 19, TypeScript |
| **Antarmuka & Animasi** | Tailwind CSS v4, Lucide React Icons, Framer Motion (`motion/react`) |
| **Basis Data & ORM** | SQLite (`better-sqlite3` mode WAL) + Drizzle ORM |
| **Validasi & Keamanan** | Zod Schema, `scrypt` password hashing, HMAC-SHA256 session cookie, AES-256-GCM key encryption |
| **Ekspor Dokumen & Excel** | `jspdf` + `html-to-image` (Preview PDF A4 & unduh langsung), `exceljs` |
| **Asisten AI Fleksibel** | Mesin REST ganda manual: Google Gemini Native API & OpenAI-Compatible (`/chat/completions`) |

---

## 4. Konteks & Lisensi

- **Versi Paket**: `0.1.0`
- **Lisensi Perangkat Lunak**: **MIT License** — bebas digunakan, dimodifikasi, dan didistribusikan sesuai ketentuan pada berkas [`LICENSE`](./LICENSE).
- **Kredit & Pemeliharaan**: Dikembangkan untuk mendukung digitalisasi administrasi sekolah yang ringkas, cepat, dan mudah dipelihara secara mandiri.
