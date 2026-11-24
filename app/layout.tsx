import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { AppProvider } from '@/components/providers/AppContext';

const plusJakartaSans = localFont({
  src: './fonts/plus-jakarta-sans-latin.woff2',
  weight: '400 800',
  style: 'normal',
  variable: '--font-display',
  display: 'swap',
});

const dmSans = localFont({
  src: './fonts/dm-sans-latin.woff2',
  weight: '400 700',
  style: 'normal',
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = localFont({
  src: './fonts/jetbrains-mono-latin.woff2',
  weight: '400 700',
  style: 'normal',
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SEKOLAHKITA — Sistem Manajemen Sekolah Kurikulum Merdeka',
  description:
    'Sistem Manajemen Sekolah dan Administrasi Guru Terpadu Kurikulum Merdeka (SD/MI) dengan SQLite luring-utama, Rapor A4, ExcelJS, dan Integrasi Dapodik.',
  openGraph: {
    title: 'SEKOLAHKITA — Sistem Manajemen Sekolah Kurikulum Merdeka',
    description:
      'Sistem Manajemen Sekolah dan Administrasi Guru Terpadu Kurikulum Merdeka (SD/MI) dengan SQLite luring-utama, Rapor A4, ExcelJS, dan Integrasi Dapodik.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SEKOLAHKITA — Sistem Manajemen Sekolah Kurikulum Merdeka',
    description:
      'Sistem Manajemen Sekolah dan Administrasi Guru Terpadu Kurikulum Merdeka (SD/MI) dengan SQLite luring-utama, Rapor A4, ExcelJS, dan Integrasi Dapodik.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      className={`${plusJakartaSans.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased selection:bg-[#1E3A5F] selection:text-white">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
