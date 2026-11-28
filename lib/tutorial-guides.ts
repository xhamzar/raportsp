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
  '/intrakurikuler': {
    key: '/intrakurikuler',
    menuLabel: 'Mata Pelajaran Intrakurikuler',
    warning:
      'Pastikan Tujuan Pembelajaran (TP) pada setiap mata pelajaran telah terisi (indikator hijau) sebelum guru mengisi asesmen formatif dan rapor.',
    paragraphs: [
      [
        { type: 'text', value: 'Klik ' },
        { type: 'chip', value: 'Tambah Mapel' },
        { type: 'text', value: ' untuk menambahkan mata pelajaran secara cepat dengan 4 kolom utama (Nama lengkap, KKM, Kode opsional, dan Jenis Mapel). Guru pengampu dan beban JP dapat disesuaikan lewat tombol ' },
        { type: 'chip', value: 'Edit' },
        { type: 'text', value: '.' },
      ],
      [
        { type: 'text', value: 'Gunakan ' },
        { type: 'chip', value: 'Edit Urutan' },
        { type: 'text', value: ' untuk mengatur urutan mapel di rapor, tekan ' },
        { type: 'chip', value: 'Edit TP' },
        { type: 'text', value: ' langsung pada baris mapel untuk mengelola Tujuan Pembelajaran (atau draf AI), serta akses ' },
        { type: 'chip', value: 'CP & RPM' },
        { type: 'text', value: ' untuk menyusun Capaian Pembelajaran dan Rencana Pembelajaran Mendalam.' },
      ],
    ],
  },
  '/kokurikuler': {
    key: '/kokurikuler',
    menuLabel: 'Kokurikuler (8 DPL)',
    paragraphs: [
      [
        { type: 'text', value: 'Gunakan halaman ini untuk menyusun daftar kegiatan Kokurikuler kelas aktif lengkap dengan pemilihan ' },
        { type: 'strong', value: '8 Dimensi Profil Lulusan (8 DPL)' },
        { type: 'text', value: ' dan kode kegiatan.' },
      ],
      [
        { type: 'text', value: 'Setelah kegiatan kokurikuler tersimpan, guru dapat menginput predikat dan capaian murid pada menu ' },
        { type: 'chip', value: 'Penilaian' },
        { type: 'text', value: ' → tab ' },
        { type: 'chip', value: 'Kokurikuler' },
        { type: 'text', value: '.' },
      ],
    ],
  },
  '/ekstrakurikuler': {
    key: '/ekstrakurikuler',
    menuLabel: 'Ekstrakurikuler',
    paragraphs: [
      [
        { type: 'text', value: 'Tambahkan daftar kegiatan ekstrakurikuler sekolah melalui tombol ' },
        { type: 'chip', value: 'Tambah' },
        { type: 'text', value: ', lalu tekan ' },
        { type: 'chip', value: 'Edit TP' },
        { type: 'text', value: ' pada baris kegiatan untuk menyusun Tujuan Pembelajaran masing-masing ekstrakurikuler.' },
      ],
      [
        { type: 'text', value: 'Pengisian predikat dan catatan keaktifan murid dilakukan di halaman ' },
        { type: 'chip', value: 'Penilaian' },
        { type: 'text', value: ' → tab ' },
        { type: 'chip', value: 'Ekstrakurikuler' },
        { type: 'text', value: '.' },
      ],
    ],
  },
  '/keasramaan': {
    key: '/keasramaan',
    menuLabel: 'Mata Evaluasi Keasramaan',
    warning:
      'Halaman ini khusus sekolah dengan program keasramaan yang diaktifkan melalui Pengaturan Sekolah.',
    paragraphs: [
      [
        { type: 'text', value: 'Klik ' },
        { type: 'chip', value: 'Kelola Mata Evaluasi' },
        { type: 'text', value: ' untuk menambah, mengurutkan, atau menonaktifkan kelompok dan indikator pembinaan asrama.' },
      ],
      [
        { type: 'text', value: 'Tekan ' },
        { type: 'chip', value: 'Edit TP' },
        { type: 'text', value: ' pada tiap indikator untuk menetapkan target pembinaan asrama, lalu isi predikat murid melalui ' },
        { type: 'chip', value: 'Penilaian' },
        { type: 'text', value: ' → tab ' },
        { type: 'chip', value: 'Keasramaan' },
        { type: 'text', value: '.' },
      ],
    ],
  },
  '/kurikulum': {
    key: '/kurikulum',
    menuLabel: 'Intrakurikuler & RPM',
    warning:
      'Pastikan Tujuan Pembelajaran (TP) pada setiap mata pelajaran telah terisi sebelum membuka menu Penilaian.',
    paragraphs: [
      [
        { type: 'text', value: 'Tambahkan mapel kelas aktif melalui tombol ' },
        { type: 'chip', value: 'Tambah Mapel' },
        { type: 'text', value: ', atur urutan tampilnya lewat ' },
        { type: 'chip', value: 'Edit Urutan' },
        { type: 'text', value: ', atau klik ' },
        { type: 'chip', value: 'Edit TP' },
        { type: 'text', value: ' langsung pada baris mapel.' },
      ],
      [
        { type: 'text', value: 'Buka ' },
        { type: 'chip', value: 'CP & RPM' },
        { type: 'text', value: ' untuk menyusun Capaian Pembelajaran, Alur Tujuan Pembelajaran, dan dokumen Perencanaan RPM.' },
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
    menuLabel: 'Input Nilai',
    warning:
      'Pastikan bobot Lingkup Materi, STS, dan SAS berjumlah tepat 100% di menu Atur Bobot. Setelah mengisi nilai murid pada formulir, tekan Simpan agar rata-rata dan deskripsi rapor langsung diperbarui.',
    paragraphs: [
      [
        { type: 'text', value: 'Pilih jenis nilai dari grup ' },
        { type: 'chip', value: 'Input Nilai' },
        { type: 'text', value: ' di menu samping (' },
        { type: 'chip', value: 'Formatif' },
        { type: 'text', value: ', ' },
        { type: 'chip', value: 'Sumatif' },
        { type: 'text', value: ', ' },
        { type: 'chip', value: 'Kokurikuler' },
        { type: 'text', value: ', ' },
        { type: 'chip', value: 'Ekstrakurikuler' },
        { type: 'text', value: ', atau ' },
        { type: 'chip', value: 'Keasramaan' },
        { type: 'text', value: ').' },
      ],
      [
        { type: 'text', value: 'Klik tombol ' },
        { type: 'chip', value: 'Nilai' },
        { type: 'text', value: ' pada baris murid untuk membuka formulir fokus satu murid, atau gunakan ' },
        { type: 'chip', value: 'Download Template' },
        { type: 'text', value: ' dan ' },
        { type: 'chip', value: 'Import Nilai' },
        { type: 'text', value: ' untuk pengisian massal lewat Excel.' },
      ],
    ],
  },
  '/penilaian/formatif': {
    key: '/penilaian/formatif',
    menuLabel: 'Asesmen Formatif',
    paragraphs: [
      [
        { type: 'text', value: 'Pilih mata pelajaran lalu tekan tombol ' },
        { type: 'chip', value: 'Nilai' },
        { type: 'text', value: ' di samping nama murid untuk menandai kotak centang ' },
        { type: 'strong', value: 'Ya / Tidak' },
        { type: 'text', value: ' pada setiap Tujuan Pembelajaran (TP).' },
      ],
      [
        { type: 'text', value: 'Gunakan kotak pencarian murid di atas formulir untuk berpindah ke murid berikutnya tanpa kembali ke daftar, lalu tekan ' },
        { type: 'chip', value: 'Simpan' },
        { type: 'text', value: '.' },
      ],
    ],
  },
  '/penilaian/sumatif': {
    key: '/penilaian/sumatif',
    menuLabel: 'Asesmen Sumatif',
    warning:
      'Gunakan tombol Atur Bobot apabila persentase Lingkup Materi, STS, dan SAS perlu disesuaikan dengan ketentuan sekolah.',
    paragraphs: [
      [
        { type: 'text', value: 'Klik ' },
        { type: 'chip', value: 'Nilai' },
        { type: 'text', value: ' pada murid untuk mengisi nilai harian tiap TP serta nilai Tes/Non-Tes STS dan SAS. Ringkasan ' },
        { type: 'strong', value: 'NA Sumatif Lingkup Materi, STS, dan SAS' },
        { type: 'text', value: ' dihitung otomatis.' },
      ],
      [
        { type: 'text', value: 'Anda juga dapat mengunduh format Excel melalui ' },
        { type: 'chip', value: 'Unduh Template' },
        { type: 'text', value: ' dan mengunggah hasilnya lewat ' },
        { type: 'chip', value: 'Import Nilai' },
        { type: 'text', value: '.' },
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
        { type: 'text', value: ' untuk mengganti kata sandi dan mengatur Kunci API pribadi, tab ' },
        { type: 'chip', value: 'Kunci API' },
        { type: 'text', value: ' untuk mengelola Kunci API sekolah (Admin/Kepsek) beserta panduan pengisiannya, tab ' },
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
