import Link from 'next/link';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#F6F5F0] text-[#1A1C19] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-[#E2DFD5] rounded-2xl p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-[#EEF2F7] text-[#1E3A5F] flex items-center justify-center">
          <Compass className="h-6 w-6" />
        </div>
        <p className="text-xs font-mono font-semibold uppercase tracking-widest text-[#6B7280] mb-1">
          Galat 404
        </p>
        <h1 className="text-xl font-bold text-[#1A1C19] mb-2">Halaman Tidak Ditemukan</h1>
        <p className="text-sm text-[#6B7280] mb-6">
          Tautan yang Anda tuju tidak tersedia atau telah dipindahkan di sistem SEKOLAHKITA.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#162C49] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}
