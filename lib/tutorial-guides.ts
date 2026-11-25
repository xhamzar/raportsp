export type TutorialInlineSegment =
  | { type: 'text'; value: string }
  | { type: 'chip'; value: string }
  | { type: 'strong'; value: string };

export interface TutorialGuideEntry {
  key: string;
  menuLabel: string;
  warning?: string;
  paragraphs: TutorialInlineSegment[][];
}

export const TUTORIAL_GUIDES: Record<string, TutorialGuideEntry> = {
  '/dashboard': {
    key: '/dashboard',
    menuLabel: 'Beranda',
    paragraphs: [
      [
        { type: 'text', value: 'Halaman ' },
        { type: 'strong', value: 'Beranda' },
        {
          type: 'text',
          value:
            ' menyajikan ringkasan cepat kondisi sekolah: jumlah murid aktif, rombongan belajar, pendidik, persentase kehadiran harian, serta jadwal pelajaran hari ini.',
        },
      ],
      [
        { type: 'text', value: 'Gunakan pemilih kelas di bilah atas untuk mengganti rombel aktif. Anda dapat langsung menuju menu pencatatan melalui kartu ' },
        { type: 'chip', value: 'Aksi Cepat' },
        { type: 'text', value: ' atau memantau pembaruan terakhir pada panel aktivitas terbaru.' },
      ],
    ],
  },
  '/sekolah': {
    key: '/sekolah',
    menuLabel: 'Sekolah & Kalender',
    warning:
      'Pastikan Nama Sekolah, Kabupaten/Kota, Nama Kepala Sekolah, dan Tanggal Bagi Rapor terisi benar karena data ini langsung dicetak pada kop surat serta kolom pengesahan seluruh dokumen PDF.',
    paragraphs: [
      [
        { type: 'text', value: 'Pada tab ' },
        { type: 'chip', value: 'Profil Sekolah' },
        { type: 'text', value: ', perbarui identitas sekolah, NPSN, alamat, kepala sekolah, serta aktifkan modul opsional (seperti Keasramaan atau Asisten Rapor), lalu klik ' },
        { type: 'chip', value: 'Simpan Profil' },
        { type: 'text', value: '.' },
      ],
      [
        { type: 'text', value: 'Atur Tahun Ajaran, Semester aktif, dan tanggal pembagian rapor melalui tab ' },
        { type: 'chip', value: 'Tahun Ajaran & Semester' },
        { type: 'text', value: '. Agenda libur pada tab ' },
        { type: 'chip', value: 'Kalender Pendidikan' },
        { type: 'text', value: ' akan otomatis memunculkan peringatan hari libur di halaman Presensi.' },
      ],
    ],
  },
  '/kelas': {
    key: '/kelas',
    menuLabel: 'Kelas',
    paragraphs: [
      [
        { type: 'text', value: 'Gunakan halaman ini untuk mengelola daftar Rombongan Belajar (rombel), tingkat kelas, fase Kurikulum Merdeka, wali kelas, dan penempatan murid.' },
      ],
      [
        { type: 'text', value: 'Klik ' },
        { type: 'chip', value: 'Tambah Kelas' },
        { type: 'text', value: ' untuk membuat rombel baru, atau pilih salah satu kelas guna mengatur wali kelas dan memindahkan murid antar-rombel.' },
      ],
    ],
  },
  '/siswa': {
    key: '/siswa',
    menuLabel: 'Murid',
    warning:
      'NISN wajib unik (10 digit) untuk setiap murid. Saat mengimpor data Excel, gunakan format tanggal lahir YYYY-MM-DD (misalnya 2016-02-01) pada berkas Excel agar terbaca akurat oleh sistem.',
    paragraphs: [
      [
        { type: 'text', value: 'Tambahkan murid satu per satu melalui ' },
        { type: 'chip', value: 'Tambah Murid' },
        { type: 'text', value: ' atau unggah massal lewat tombol ' },
        { type: 'chip', value: 'Impor Excel' },
        { type: 'text', value: ' dengan template resmi yang dapat diunduh langsung.' },
      ],
      [
        { type: 'text', value: 'Klik ikon mata atau edit pada baris murid untuk melihat biodata lengkap, mengunggah pas foto 3×4, mengubah data orang tua/wali, serta mencatat prestasi dan bimbingan pada tab ' },
        { type: 'chip', value: 'Catatan Kesiswaan' },
        { type: 'text', value: '.' },
      ],
    ],
  },
  '/guru': {
    key: '/guru',
    menuLabel: 'Guru & Tendik',
    paragraphs: [
      [
        { type: 'text', value: 'Kelola data Pendidik (Guru) dan Tenaga Kependidikan (Tendik) lengkap dengan NIP, NUPTK, status kepegawaian, serta beban jam mengajar per minggu.' },
      ],
      [
        { type: 'text', value: 'Klik ' },
        { type: 'chip', value: 'Tambah Pendidik' },
        { type: 'text', value: ' untuk menambah guru baru. Data NIP dan nama guru dari halaman ini dipakai sebagai penanda tangan wali kelas di rapor maupun rekap Laporan TPP.' },
      ],
    ],
  },
  '/kurikulum': {
    key: '/kurikulum',
    menuLabel: 'Kurikulum & RPM',
    warning:
      'Mata pelajaran Pendidikan Agama dan Budi Pekerti memiliki perlakuan khusus agar selaras dengan agama masing-masing murid. Pastikan data Tujuan Pembelajaran (TP) terisi sebelum membuka menu Penilaian.',
    paragraphs: [
      [
        { type: 'text', value: 'Pada tab ' },
        { type: 'chip', value: 'Mata Pelajaran' },
        { type: 'text', value: ', tambahkan mapel kelas aktif melalui tombol ' },
        { type: 'chip', value: 'Tambah Mata Pelajaran' },
        { type: 'text', value: '. Isi kode singkat mapel (misalnya MTK atau IPAS), KKM/KKTP, guru pengampu, dan urutan cetak rapor.' },
      ],
      [
        { type: 'text', value: 'Buka tab ' },
        { type: 'chip', value: 'Tujuan Pembelajaran (TP)' },
        { type: 'text', value: ' untuk menyusun materi lingkup dan deskripsi TP. Untuk menyusun Rencana Pembelajaran Mendalam, gunakan tab ' },
        { type: 'chip', value: 'Perencanaan RPM' },
        { type: 'text', value: ' dan simpan arsip dokumennya.' },
      ],
    ],
  },
  '/jadwal': {
    key: '/jadwal',
    menuLabel: 'Jadwal & Bel',
    paragraphs: [
      [
        { type: 'text', value: 'Atur jadwal pelajaran mingguan untuk kelas aktif serta konfigurasi jam pelajaran dan jam istirahat pada tab ' },
        { type: 'chip', value: 'Pengaturan Bel' },
        { type: 'text', value: '.' },
      ],
      [
        { type: 'text', value: 'Klik ' },
        { type: 'chip', value: 'Tambah Jadwal' },
        { type: 'text', value: ' untuk menempatkan mata pelajaran dan guru pada hari serta jam ke- tertentu. Jadwal hari ini otomatis tampil di Beranda.' },
      ],
    ],
  },
  '/jurnal': {
    key: '/jurnal',
    menuLabel: 'Jurnal Mengajar',
    paragraphs: [
      [
        { type: 'text', value: 'Dokumentasikan kegiatan belajar mengajar harian melalui tombol ' },
        { type: 'chip', value: 'Catat Jurnal Baru' },
        { type: 'text', value: ' dengan memilih mata pelajaran, guru pengajar, jam pelajaran, materi pokok, aktivitas kelas, dan status ketuntasan.' },
      ],
      [
        { type: 'text', value: 'Gunakan pemfilter tanggal di atas tabel untuk meninjau riwayat hari tertentu. Seluruh entri jurnal dapat dicetak rapi menjadi laporan bulanan/semester melalui menu ' },
        { type: 'chip', value: 'Cetak' },
        { type: 'text', value: ' → tab ' },
        { type: 'chip', value: 'Jurnal Mengajar' },
        { type: 'text', value: '.' },
      ],
    ],
  },
  '/penilaian': {
    key: '/penilaian',
    menuLabel: 'Penilaian',
    warning:
      'Pastikan jumlah bobot LM + STS + SAS berjumlah tepat 100% pada pengaturan bobot nilai sebelum menyimpan, dan tekan Simpan Nilai agar deskripsi capaian kompetensi otomatis diperbarui.',
    paragraphs: [
      [
        { type: 'text', value: 'Pilih mata pelajaran pada menu dropdown, lalu gunakan tab ' },
        { type: 'chip', value: 'Asesmen Formatif' },
        { type: 'text', value: ' untuk menandai ketercapaian tiap Tujuan Pembelajaran (TP), atau tab ' },
        { type: 'chip', value: 'Asesmen Sumatif' },
        { type: 'text', value: ' untuk menginput nilai LM, STS, SAS, dan nilai remedial.' },
      ],
      [
        { type: 'text', value: 'Tab ' },
        { type: 'chip', value: 'Kokurikuler' },
        { type: 'text', value: ', ' },
        { type: 'chip', value: 'Ekstrakurikuler' },
        { type: 'text', value: ', ' },
        { type: 'chip', value: 'Catatan Wali Kelas' },
        { type: 'text', value: ', dan ' },
        { type: 'chip', value: 'Keasramaan' },
        { type: 'text', value: ' (jika diaktifkan) terintegrasi langsung ke isi halaman Rapor murid.' },
      ],
    ],
  },
  '/absensi': {
    key: '/absensi',
    menuLabel: 'Presensi',
    paragraphs: [
      [
        { type: 'text', value: 'Pilih tanggal di pojok kanan bar kontrol. Gunakan tombol ' },
        { type: 'chip', value: 'Hadir Semua' },
        { type: 'text', value: ' untuk menandai seluruh murid Hadir (H) dengan cepat, lalu sesuaikan murid yang Sakit (S), Izin (I), atau Alpa (A) sebelum menekan ' },
        { type: 'chip', value: 'Simpan Presensi' },
        { type: 'text', value: '.' },
      ],
      [
        { type: 'text', value: 'Pindah ke tab ' },
        { type: 'chip', value: 'Presensi Guru' },
        { type: 'text', value: ' untuk mencatat kehadiran dan jam masuk pendidik/tendik. Rekap bulanan dan indeks TPP dapat dicetak di menu ' },
        { type: 'chip', value: 'Cetak' },
        { type: 'text', value: '.' },
      ],
    ],
  },
  '/laporan': {
    key: '/laporan',
    menuLabel: 'Rekap & Leger',
    paragraphs: [
      [
        { type: 'text', value: 'Halaman ini menampilkan rekap nilai seluruh mata pelajaran dalam bentuk Leger Nilai Kelas, peringkat rata-rata kelas, serta ketuntasan KKTP.' },
      ],
      [
        { type: 'text', value: 'Anda dapat mengekspor leger ke format Excel atau beralih ke menu ' },
        { type: 'chip', value: 'Cetak' },
        { type: 'text', value: ' untuk mencetak Rapor A4 maupun Piagam Prestasi 3 Besar.' },
      ],
    ],
  },
  '/cetak': {
    key: '/cetak',
    menuLabel: 'Cetak Dokumen',
    warning:
      'Saat jendela cetak browser terbuka, atur ukuran kertas ke A4 dan aktifkan opsi Background Graphics bila diperlukan agar tabel dan bingkai piagam tercetak sempurna.',
    paragraphs: [
      [
        { type: 'text', value: 'Pilih jenis dokumen di tab bar (Rapor, Cover, Biodata, Piagam, Keasramaan, Jurnal Mengajar, Buku Tamu, Presensi Guru, atau Laporan TPP), lalu saring murid atau bulan bila diperlukan.' },
      ],
      [
        { type: 'text', value: 'Gunakan saklar cepat ' },
        { type: 'chip', value: 'Kop Surat' },
        { type: 'text', value: ', ' },
        { type: 'chip', value: 'Tanda Tangan' },
        { type: 'text', value: ', dan ' },
        { type: 'chip', value: 'Stempel' },
        { type: 'text', value: ' di toolbar, lalu klik ' },
        { type: 'chip', value: 'Preview & Simpan PDF' },
        { type: 'text', value: ' untuk memeriksa pratinjau halaman A4, mengatur zoom, mengunduh file PDF langsung, atau mencetak.' },
      ],
    ],
  },
  '/administrasi': {
    key: '/administrasi',
    menuLabel: 'Buku Tamu & Dinas',
    paragraphs: [
      [
        { type: 'text', value: 'Catat setiap kunjungan tamu instansi atau wali murid pada tab ' },
        { type: 'chip', value: 'Buku Tamu' },
        { type: 'text', value: ' melalui tombol ' },
        { type: 'chip', value: 'Catat Tamu Baru' },
        { type: 'text', value: '.' },
      ],
      [
        { type: 'text', value: 'Pada tab ' },
        { type: 'chip', value: 'Dinas Luar' },
        { type: 'text', value: ', ajukan surat tugas perjalanan dinas pendidik. Kepala Sekolah atau Admin dapat menyetujui pengajuan dengan tombol ' },
        { type: 'chip', value: 'Setujui' },
        { type: 'text', value: '.' },
      ],
    ],
  },
  '/integrasi': {
    key: '/integrasi',
    menuLabel: 'Dapodik & E-Rapor',
    warning:
      'Gunakan Mode Sandbox atau jalankan Mode Dry-Run terlebih dahulu sebelum mengirim nilai produksi ke WebService Dapodik Desktop agar seluruh UUID pemetaan tervalidasi aman.',
    paragraphs: [
      [
        { type: 'text', value: 'Masukkan alamat WebService Dapodik, NPSN, dan token lalu klik ' },
        { type: 'chip', value: 'Uji Koneksi' },
        { type: 'text', value: ' serta ' },
        { type: 'chip', value: 'Sinkronisasi 6 Endpoint' },
        { type: 'text', value: ' untuk memetakan rombel, murid, dan mata pelajaran.' },
      ],
      [
        { type: 'text', value: 'Untuk pertukaran Excel, buka tab ' },
        { type: 'chip', value: 'E-Rapor Excel' },
        { type: 'text', value: ' guna mengunduh template dan mengimpor nilai dengan pratinjau validasi kolom.' },
      ],
    ],
  },
  '/pengaturan': {
    key: '/pengaturan',
    menuLabel: 'Pengaturan',
    warning:
      'Perubahan hak akses peran maupun pemulihan cadangan database berdampak langsung ke seluruh pengguna sekolah. Pastikan Anda mengunduh snapshot cadangan sebelum melakukan pemulihan.',
    paragraphs: [
      [
        { type: 'text', value: 'Pada tab ' },
        { type: 'chip', value: 'Dokumen & TTD' },
        { type: 'text', value: ', atur saklar On/Off ' },
        { type: 'chip', value: 'Kop Surat' },
        { type: 'text', value: ', unggah gambar PNG transparan untuk Tanda Tangan Kepala Sekolah dan Stempel Sekolah, serta atur tampilan default agar otomatis diterapkan pada dokumen cetak resmi.' },
      ],
      [
        { type: 'text', value: 'Gunakan tab ' },
        { type: 'chip', value: 'Akun Saya' },
        { type: 'text', value: ' untuk mengganti kata sandi, tab ' },
        { type: 'chip', value: 'Pengguna' },
        { type: 'text', value: ' & ' },
        { type: 'chip', value: 'Peran & Izin' },
        { type: 'text', value: ' untuk mengatur akses berbasis rombel/mapel, serta tab ' },
        { type: 'chip', value: 'Cadangan' },
        { type: 'text', value: ' untuk membuat atau mengunduh salinan database SQLite.' },
      ],
    ],
  },
};

export function resolveTutorialGuide(pathname: string): TutorialGuideEntry {
  if (pathname === '/rapor' || pathname.startsWith('/rapor/')) {
    return TUTORIAL_GUIDES['/cetak'];
  }
  const exact = TUTORIAL_GUIDES[pathname];
  if (exact) return exact;
  const matchedKey = Object.keys(TUTORIAL_GUIDES).find((key) => pathname.startsWith(`${key}/`));
  return matchedKey ? TUTORIAL_GUIDES[matchedKey] : TUTORIAL_GUIDES['/dashboard'];
}
