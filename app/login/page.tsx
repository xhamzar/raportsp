'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { AlertBox, Button, Input } from '@/components/ui/Primitives';
import { useApp } from '@/components/providers/AppContext';

export default function LoginPage() {
  const router = useRouter();
  const { refreshContext } = useApp();

  const [checking, setChecking] = useState(true);
  const [bootstrapRequired, setBootstrapRequired] = useState(false);

  // Login fields
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Bootstrap fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [initializeDemoRoles, setInitializeDemoRoles] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          router.replace('/dashboard');
          return;
        }
        setBootstrapRequired(Boolean(data.bootstrapRequired));
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/bootstrap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          password: newPassword,
          confirmPassword,
          initializeDemoRoles,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal mengaktivasi akun administrator.');
        setSubmitting(false);
        return;
      }
      await refreshContext();
      router.replace('/dashboard');
    } catch {
      setError('Terjadi gangguan koneksi lokal.');
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal masuk ke sistem.');
        setSubmitting(false);
        return;
      }
      await refreshContext();
      router.replace('/dashboard');
    } catch {
      setError('Terjadi gangguan koneksi lokal.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1320] flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-[#111C2E]">
        {/* Left Institutional Panel */}
        <div className="lg:col-span-6 bg-[#0F2942] text-white p-8 lg:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <img
                src="/images/school-crest.jpg"
                alt="Lambang Sekolah"
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded bg-white object-cover p-0.5 shrink-0"
              />
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight">
                  SEKOLAHKITA
                </h1>
                <p className="text-xs text-slate-300">
                  Sistem Manajemen Sekolah & Administrasi Guru Terpadu
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold leading-snug text-balance">
                Tata Kelola Akademik Kurikulum Merdeka yang Rapi dan Luring-Utama
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Dirancang untuk satuan pendidikan dasar Indonesia (SD/MI Fase A–C) dengan basis
                data SQLite lokal, penilaian sumatif & formatif transparan, presensi harian, cetak
                rapor A4, serta sinkronisasi Dapodik dan E-Rapor.
              </p>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-white/15 space-y-2.5 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Kendali akses 9 peran resmi sekolah dengan log audit database lokal</span>
            </div>
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-sky-300 shrink-0" />
              <span>Data demo awal: SD Negeri Nusantara 01 · NPSN 20104567 · TA 2026/2027</span>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-6 p-8 lg:p-10 flex flex-col justify-center">
          {checking ? (
            <div className="space-y-4">
              <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              <div className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
            </div>
          ) : bootstrapRequired ? (
            <div>
              <p className="text-xs font-medium text-[#1D4ED8] mb-1">
                Inisialisasi Awal Server Sekolah
              </p>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-slate-900 dark:text-slate-100">
                Tetapkan Kata Sandi Administrator
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Buat kata sandi pertama untuk akun <strong className="font-mono">admin</strong>{' '}
                (Super Administrator). Kata sandi di-hash aman di server SQLite lokal.
              </p>

              <form onSubmit={handleBootstrap} className="mt-6 space-y-4">
                {error && <AlertBox variant="error">{error}</AlertBox>}

                <Input
                  label="Kata Sandi Administrator Baru"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  required
                />

                <Input
                  label="Konfirmasi Kata Sandi"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  required
                />

                <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={initializeDemoRoles}
                    onChange={(e) => setInitializeDemoRoles(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span>
                    Terapkan kata sandi ini juga ke akun peran demo (
                    <span className="font-mono">kepsek</span>,{' '}
                    <span className="font-mono">operator</span>,{' '}
                    <span className="font-mono">walikelas4a</span>,{' '}
                    <span className="font-mono">gurupai</span>,{' '}
                    <span className="font-mono">waliasuh</span>) untuk uji coba multi-peran.
                  </span>
                </label>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showPassword ? 'Sembunyikan' : 'Tampilkan sandi'}
                  </button>
                  <Button type="submit" loading={submitting}>
                    <Lock className="w-4 h-4" />
                    Simpan & Masuk
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Masuk ke Ruang Kerja Sekolah
              </p>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-slate-900 dark:text-slate-100">
                Masuk Akun SEKOLAHKITA
              </h2>

              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                {error && <AlertBox variant="error">{error}</AlertBox>}

                <Input
                  label="Nama Pengguna"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Contoh: admin atau walikelas4a"
                  autoComplete="username"
                  required
                />

                <div className="relative">
                  <Input
                    label="Kata Sandi"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label="Ubah visibilitas kata sandi"
                    className="absolute right-2.5 top-[30px] p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <Button type="submit" className="w-full" loading={submitting}>
                  <Lock className="w-4 h-4" />
                  Masuk ke Sistem
                </Button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Pilih cepat nama pengguna peran sekolah (lingkungan demonstrasi):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { u: 'admin', label: 'Admin' },
                    { u: 'kepsek', label: 'Kepala Sekolah' },
                    { u: 'operator', label: 'Operator' },
                    { u: 'walikelas4a', label: 'Guru Kelas 4A' },
                    { u: 'gurupai', label: 'Guru PAI' },
                    { u: 'waliasuh', label: 'Wali Asuh' },
                  ].map((item) => (
                    <button
                      key={item.u}
                      type="button"
                      onClick={() => setUsername(item.u)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                        username === item.u
                          ? 'bg-[#0F2942] text-white border-[#0F2942]'
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
