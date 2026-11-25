# Dokumentasi Fitur & Modul SEKOLAHKITA

Dokumen ini merangkum seluruh kemampuan fungsional yang tersedia pada **SEKOLAHKITA** beserta pemetaan modul dan kontrol aksesnya.

---

## 1. Keamanan, Autentikasi & RBAC

- **First-Run Administrator Bootstrap**: Tidak ada kata sandi bawaan di kode sumber. Saat database baru dipasang dan akun `admin` belum memiliki hash sandi, `/login` menampilkan formulir pembuatan kata sandi awal (dapat dikunci opsional melalui `ADMIN_BOOTSTRAP_PASSCODE` di `.env`).
- **Autentikasi Sesi Aman**: Kata sandi di-hash dengan `crypto.scryptSync` + salt acak 16-byte; sesi disimpan di tabel `user_sessions` menggunakan hash HMAC-SHA256 dan cookie `HttpOnly; Secure; SameSite=None; Partitioned`.
- **9 Peran RBAC Dinamis & Matriks Izin**: Izin dikelola per modul dan aksi (`read`, `create`, `update`, `delete`, `export`, `approve`) lewat menu **Pengaturan → Peran & Izin**. Izin inti `SUPER_ADMIN` dikunci permanen agar tidak terkunci keluar.
- **Cakupan Data Berbasis Rombel & Mapel**:
  - `ALL`: Mengakses seluruh rombel dan mata pelajaran sekolah.
  - `ASSIGNED`: Terbatas pada rombel/mapel di mana guru ditugaskan sebagai Wali Kelas, pengampu mapel, atau terdaftar di jadwal.
  - `CUSTOM`: Pemilihan manual daftar rombel dan mapel tertentu untuk setiap akun.
- **Audit Logs**: Mencatat perubahan krusial (login, manajemen pengguna/peran, perubahan Kunci API, pemulihan database, generasi draf AI).

---

## 2. Beranda & Data Pokok Sekolah

- **Beranda Eksekutif (`/dashboard`)**: Ringkasan jumlah murid aktif, rombel, pendidik, persentase kehadiran harian, jadwal pelajaran hari ini, aktivitas terbaru, dan kartu Aksi Cepat.
- **Sekolah & Kalender (`/sekolah`)**:
  - Identitas satuan pendidikan (Nama Sekolah, NPSN, Jenjang, Naungan, Alamat lengkap, Kepala Sekolah & NIP, Logo Sekolah).
  - Pengaktifan fitur modular sekolah (Asisten AI Kurikulum, Modul Keasramaan).
  - Manajemen Tahun Ajaran, Semester aktif (Ganjil/Genap beserta Tanggal Bagi Rapor), dan Kalender Pendidikan (hari libur memicu peringatan otomatis di Presensi).
  - Data sarana ruang kelas dan fasilitas sekolah.
- **Rombongan Belajar (`/kelas`)**: Pengelolaan tingkat kelas, Fase Kurikulum Merdeka (Fase A/B/C), Wali Kelas, kapasitas rombel, serta penempatan & kenaikan kelas murid.
- **Manajemen Murid (`/siswa`)**:
  - Biodata lengkap: NISN unik 10 digit, NIS, NIK, tempat/tanggal lahir, agama, alamat terstruktur (jalan, RT/RW, kelurahan/desa, kecamatan, kabupaten/kota, provinsi, kode pos), pendidikan sebelumnya, data Ayah, Ibu, Wali (nama, hubungan, pekerjaan, telepon, alamat), hingga data Wali Asuh & kamar asrama.
  - Unggah **Pas Foto 3×4** (validasi *magic bytes* PNG/JPEG/WebP, disimpan terisolasi di server).
  - **Template & Impor/Ekspor Excel** (`exceljs`) dengan validasi pratinjau sebelum simpan.
  - Riwayat mutasi status murid dan tab **Catatan Kesiswaan** (prestasi, pelanggaran, konseling, UKS, izin).
- **Pendidik & Tendik (`/guru`)**: Data guru dan tenaga kependidikan lengkap dengan NIP, NUPTK, status kepegawaian, spesialisasi, pendidikan, dan penugasan jam mengajar.

---

## 3. Kurikulum Merdeka, KBM & Asisten AI Manual

- **Kurikulum & Perencanaan (`/kurikulum`)**:
  - Pengaturan Mata Pelajaran per tingkat/fase, KKM/KKTP, JP/minggu, guru pengampu, dan urutan cetak di rapor.
  - Manajemen Capaian Pembelajaran (CP), Tujuan Pembelajaran (TP/ATP), dan Rencana Pembelajaran Mendalam (RPM) dengan 8 Dimensi Profil Lulusan.
- **Asisten AI Manual (BYO Key) di Pengaturan (`/pengaturan`)**:
  - **Pembagian Cakupan Kunci**: **Kunci API Sekolah** dikelola Admin/Kepala Sekolah pada tab *Kunci API* (dipakai oleh Admin/Kepala Sekolah), sementara **Kunci API Pribadi** dikelola masing-masing Guru pada tab *Akun Saya* maupun *Kunci API*.
  - **Tanpa Kunci Environment Wajib**: Fitur Generate di Kurikulum mewajibkan Kunci API manual terisi dan menampilkan banner peringatan amber sampai kunci disimpan.
  - **Dukungan Dual Protokol**:
    1. *Google Gemini Native REST* (`generativelanguage.googleapis.com` dengan header `x-goog-api-key`).
    2. *OpenAI-Compatible Chat Completions* (OpenRouter, DeepSeek, Groq, OpenAI, atau endpoint `/v1/chat/completions` lainnya).
  - **Popup Tutorial Singkat**: Panduan langkah demi langkah dan tombol pengisian preset Model & Base URL 1-klik.
  - **Keamanan**: Kunci disimpan terenkripsi **AES-256-GCM** di server, hanya tampil tersamar di UI, dan `Base URL` dilindungi validasi HTTPS publik (menolak alamat lokal/privat).
- **Jadwal & Bel Sekolah (`/jadwal`)**: Jadwal pelajaran mingguan dengan deteksi bentrok jadwal guru antar-kelas dan pengaturan jam/bunyi bel berbasis Web Audio API.
- **Jurnal Mengajar (`/jurnal`)**: Pencatatan materi harian, jam pelajaran, aktivitas kelas, dan status ketuntasan per tanggal.

---

## 4. Penilaian, Presensi & Rekap Leger

- **Penilaian Terpadu (`/penilaian`)**:
  - **Asesmen Formatif**: Penilaian ketercapaian tiap TP (`Tercapai`, `Perlu Pendalaman`, `Perlu Bimbingan`).
  - **Asesmen Sumatif**: Input nilai LM1–LM4, STS, SAS, nilai remedial (otomatis memperhitungkan batas KKTP), pengaturan bobot (wajib total 100%), generator deskripsi capaian kompetensi 2 paragraf otomatis, serta template & impor/ekspor Excel.
  - **Kokurikuler, Ekstrakurikuler & Catatan Wali Kelas**: Terintegrasi langsung ke halaman Rapor.
  - **Keasramaan (Opsional)**: Penilaian indikator kepemimpinan & ibadah oleh Wali Asuh/Asrama.
- **Presensi Harian & Guru (`/absensi`)**:
  - Presensi murid (`H`, `S`, `I`, `A`) dengan tombol *Hadir Semua*, deteksi otomatis hari libur kalender, dan unduh rekap `.xlsx`.
  - Presensi harian pendidik/tendik (`Hadir`, `Sakit`, `Izin`, `Alpa`, `Dinas Luar`, `Cuti`) untuk dasar perhitungan indeks disiplin Laporan TPP.
- **Rekap & Leger Nilai (`/laporan`)**: Rekap leger nilai satu kelas, peringkat rata-rata kelas otomatis, ketuntasan KKTP, serta ekspor leger Excel.

---

## 5. Pusat Cetak Dokumen A4 & Preview PDF (`/cetak`)

Seluruh dokumen dapat ditinjau melalui modal **Preview PDF Gaya Google Drive** (kontrol zoom `+/-`/`Pas`, info halaman `Hal X / Y`, tombol **Unduh PDF** A4 Potret/Lanskap otomatis, dan **Cetak**):

1. **Rapor Akademik**: Paginasi anti-terbelah antarbaris tabel, blok tanda tangan Orang Tua / Wali Kelas / Kepala Sekolah (dengan stempel 3 cm menimpa tanda tangan), dan catatan kaki identitas murid (`Kelas | Nama | NIS` · `Sekolah · Tahun Ajaran`) di paling bawah setiap halaman.
2. **Cover Rapor**: Halaman sampul depan + halaman identitas satuan pendidikan dengan watermark logo.
3. **Biodata (`IDENTITAS MURID`)**: Format 11 poin standar beserta sub-poin Orang Tua (`a–b`) & Alamat (`a–e`) dan Wali Murid (`a–c`), kotak **PAS FOTO 3x4**, blok Kepala Sekolah, serta dukungan saklar **Kop Surat**.
4. **Piagam Prestasi**: Penghargaan otomatis peringkat 3 besar atau murid terpilih dengan bingkai ganda.
5. **Rapor Keasramaan**: Rapor indikator kepemimpinan & ketaatan ibadah disertai catatan kaki identitas murid di tiap halaman.
6. **Jurnal Mengajar**, **Buku Tamu**, **Presensi Guru**, dan **Laporan TPP**: Mendukung cetak A4 Potret/Lanskap serta pengaturan tampilan **Kop Surat**, **Tanda Tangan**, dan **Stempel** dari toolbar maupun tab *Dokumen & TTD* di Pengaturan.

---

## 6. Administrasi, Integrasi Dapodik & Cadangan

- **Buku Tamu & Dinas Luar (`/administrasi`)**: Pencatatan kunjungan tamu sekolah dan pengajuan/persetujuan surat tugas dinas luar.
- **Dapodik & E-Rapor (`/integrasi`)**: Pengaturan WebService Dapodik (`localhost:5774`), pemetaan UUID eksternal aman, **Mode Sandbox**, alur kirim **MATEV → Nilai Akhir** dengan **Dry-Run**, serta impor nilai E-Rapor Excel.
- **Cadangan Database (`/pengaturan` → Cadangan)**: Pembuatan snapshot database SQLite `.db` dengan checksum SHA-256, unduh, impor pemulihan, dan reset data aman.
