# Panduan Instalasi & Konfigurasi Awal SEKOLAHKITA

Panduan ini menjelaskan langkah demi langkah pemasangan **SEKOLAHKITA** di komputer lokal (Windows, macOS, maupun Linux) serta konfigurasi awal setelah aplikasi berjalan.

---

## 1. Prasyarat Perangkat Lunak

Pastikan komponen berikut telah terpasang sebelum memasang dependensi:

1. **Node.js**: Versi **20 LTS** atau **22 LTS** (disarankan ≥ 20.11).
2. **Package Manager**: `npm` (bawaan Node.js) atau `bun`.
3. **Perkakas Kompilasi Native** (dibutuhkan oleh `better-sqlite3` bila prebuild binary tidak tersedia untuk arsitektur Anda):
   - **Ubuntu / Debian**: `sudo apt update && sudo apt install -y build-essential python3`
   - **Windows**: Visual Studio Build Tools (*Desktop development with C++*) atau Node.js installer dengan opsi *Tools for Native Modules*.
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`).

---

## 2. Langkah Instalasi Lokal

### A. Persiapan Kode & Dependensi

```bash
# 1. Masuk ke direktori proyek
cd sekolahkita

# 2. Pasang seluruh paket dependensi
npm install
```

### B. Konfigurasi Variabel Lingkungan (`.env`)

Salin contoh konfigurasi dan sesuaikan nilainya:

```bash
cp .env.example .env
```

Isi variabel pada `.env`:

```env
# Lokasi berkas database SQLite (otomatis dibuat jika belum ada)
DATABASE_PATH=./data/sekolahkita.db

# Kunci acak minimal 32 karakter untuk menandatangani sesi & enkripsi Kunci API AI
# Contoh pembuatan di Linux/macOS: openssl rand -hex 32
SESSION_SECRET=ganti-dengan-string-acak-minimal-32-karakter-unik

# Opsional: kode otorisasi tambahan saat pengisian sandi Administrator pertama kali
# ADMIN_BOOTSTRAP_PASSCODE=
```

> **Catatan Penting:** Jangan pernah menaruh rahasia produksi ke repositori Git dan pastikan `.env` selalu diabaikan oleh `.gitignore`.

### C. Menjalankan Aplikasi

- **Mode Pengembangan**:
  ```bash
  npm run dev
  ```
  Aplikasi aktif di `http://localhost:3000`.

- **Mode Produksi Lokal**:
  ```bash
  npm run build
  npm run start
  ```

---

## 3. Pengaturan Awal di Peramban (First-Run Setup)

1. Buka `http://localhost:3000/login`.
2. Jika database masih baru, aplikasi otomatis menampilkan formulir **Pengaturan Awal Administrator** (`admin`).
3. Buat kata sandi administrator yang kuat (minimal 8 karakter).
4. Setelah berhasil masuk ke Beranda:
   - Buka **Sekolah & Kalender** untuk mengisi Nama Sekolah, NPSN, alamat, Kepala Sekolah beserta NIP, dan Tanggal Bagi Rapor.
   - Buka **Pengaturan → Dokumen & TTD** untuk mengatur saklar **Kop Surat**, serta mengunggah **Tanda Tangan Kepala Sekolah** dan **Stempel Sekolah** berformat PNG transparan.
   - Buka **Pengaturan → Pengguna** untuk membuat akun Wali Kelas, Guru Mapel, Operator, atau Wali Asuh.

---

## 4. Konfigurasi Kunci API Manual (Fitur Asisten Draf AI)

Aplikasi ini memakai sistem **Kunci API Manual (BYO Key)** yang tersimpan terenkripsi **AES-256-GCM** di SQLite:

1. **Untuk Admin / Kepala Sekolah (Kunci Sekolah)**:
   - Masuk ke **Pengaturan → Tab Kunci API**.
   - Klik **Tutorial Singkat** bila memerlukan contoh pengisian untuk **Google Gemini** (`https://generativelanguage.googleapis.com`), **OpenRouter**, **DeepSeek**, **Groq**, atau **OpenAI**.
   - Masukkan **Kunci API**, pilih **Model** (bawaan `gemini-2.5-flash`), isi **Base URL** (wajib `https://`, atau kosongkan untuk Google Gemini native), lalu klik **Simpan**.
2. **Untuk Guru / Wali Kelas (Kunci Pribadi)**:
   - Masuk ke **Pengaturan → Tab Akun Saya** (atau tab **Kunci API**) lalu isi bagian **Kunci API Pribadi**.
   - Selama Kunci API belum diisi, fitur *Bantu Draf AI* di halaman Kurikulum akan dinonaktifkan dengan banner peringatan kuning.

---

## 5. Verifikasi Instalasi

Jalankan perintah berikut untuk memastikan database, tipe TypeScript, linter, dan fungsi inti berjalan normal:

```bash
npm run lint
npm test
npm run build
```
