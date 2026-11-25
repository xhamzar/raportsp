'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Printer,
  RefreshCw,
  UserCheck,
  Users,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import { Button, TableSkeleton } from '@/components/ui/Primitives';
import { formatIndoDate } from '@/lib/utils';

interface DashboardData {
  school: {
    name: string;
    npsn: string;
    jenjang: string;
    principalName: string;
    logoUrl: string;
  };
  activeYear: { name: string };
  activeSemester: { name: string; reportDate: string };
  selectedClass: { id: number; name: string; gradeLevel: number; fase: string };
  stats: {
    totalStudents: number;
    classStudentsCount: number;
    totalTeachers: number;
    totalClasses: number;
    totalSubjects: number;
    mandatorySubjects: number;
    cocurricularCount: number;
    extracurricularCount: number;
    studentAttendance: { H: number; S: number; I: number; A: number };
    studentAttendanceRate: number;
    teacherAttendanceRate: number;
    assessmentCompletionPct: number;
    reportCompletionPct: number;
    dapodikStatus: string;
    dapodikLastSync: string | null;
    pendingSyncTasks: number;
  };
  charts: {
    classDistribution: Array<{ className: string; gradeLevel: number; students: number }>;
    subjectPerformance: Array<{ code: string; name: string; average: number }>;
  };
  recentActivities: Array<{
    id: number;
    actorName: string;
    action: string;
    details: string;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const { selectedClassId, classes, can, canAny } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const query = selectedClassId ? `?classId=${selectedClassId}` : '';
    Promise.resolve().then(() => {
      if (active) setLoading(true);
      fetch(`/api/dashboard${query}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          if (active && res) setData(res);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [selectedClassId]);

  const maxClassStudents = Math.max(
    1,
    ...(data?.charts.classDistribution.map((c) => c.students) || [1])
  );

  return (
    <AppShell title="Beranda" requiredModule="dashboard">
      {loading && !data ? (
        <div className="space-y-4">
          <TableSkeleton rows={4} />
          <TableSkeleton rows={5} />
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* School Identity Header Strip (Zero-Pill Discipline) */}
          <section className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <img
                src={data.school.logoUrl || '/images/school-crest.jpg'}
                alt={data.school.name}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-md object-cover border border-slate-200 dark:border-slate-700 bg-white shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Identitas Satuan Pendidikan · NPSN{' '}
                  <span className="font-mono tabular-nums">{data.school.npsn}</span>
                </p>
                <h1 className="font-[family-name:var(--font-display)] text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                  {data.school.name}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <span>{data.school.jenjang}</span>
                  <span aria-hidden="true">·</span>
                  <span>Tahun Ajaran {data.activeYear?.name}</span>
                  <span aria-hidden="true">·</span>
                  <span>Semester {data.activeSemester?.name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    Bagi Rapor {formatIndoDate(data.activeSemester?.reportDate)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {can('absensi', 'read') && (
                <Link href="/absensi">
                  <Button variant="outline" size="sm">
                    <UserCheck className="w-4 h-4" />
                    Presensi Harian
                  </Button>
                </Link>
              )}
              {can('rapor', 'read') && (
                <Link href="/cetak?doc=rapor">
                  <Button size="sm">
                    <Printer className="w-4 h-4" />
                    Cetak Rapor {data.selectedClass?.name}
                  </Button>
                </Link>
              )}
            </div>
          </section>

          {/* Compact KPI Overview Grid */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Total Murid Aktif</span>
                <Users className="w-4 h-4 text-[#0F2942] dark:text-blue-400" />
              </div>
              <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {data.stats.totalStudents}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {data.stats.classStudentsCount} murid di Kelas {data.selectedClass?.name}
              </p>
            </div>

            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Pendidik & Rombel</span>
                <GraduationCap className="w-4 h-4 text-[#0F2942] dark:text-blue-400" />
              </div>
              <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {data.stats.totalTeachers} <span className="text-sm font-normal text-slate-500">Guru</span>
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {data.stats.totalClasses} rombongan belajar aktif
              </p>
            </div>

            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Ketuntasan Nilai {data.selectedClass?.name}</span>
                <ClipboardCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {data.stats.assessmentCompletionPct}%
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Kesiapan Rapor: {data.stats.reportCompletionPct}% murid
              </p>
            </div>

            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Kehadiran & Dapodik</span>
                <RefreshCw className="w-4 h-4 text-[#1D4ED8]" />
              </div>
              <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {data.stats.studentAttendanceRate}%
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                Dapodik: {data.stats.dapodikStatus}
              </p>
            </div>
          </section>

          {/* Academic Overview & Charts */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Subject Average Performance Chart */}
            <div className="lg:col-span-7 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Rata-rata Capaian Mata Pelajaran — Kelas {data.selectedClass?.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Fase {data.selectedClass?.fase} · {data.stats.totalSubjects} mata pelajaran (
                    {data.stats.mandatorySubjects} wajib)
                  </p>
                </div>
                {canAny(['penilaian', 'rapor'], 'read') && (
                  <Link
                    href="/laporan"
                    className="text-xs font-medium text-[#1D4ED8] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    Lihat Leger <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              <div className="space-y-3">
                {data.charts.subjectPerformance.map((item) => (
                  <div key={item.code} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-200 truncate pr-3">
                        {item.name}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                        {item.average > 0 ? item.average.toFixed(1) : '-'}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-[#0F2942] dark:bg-[#3B82F6] transition-all duration-300"
                        style={{ width: `${Math.min(100, item.average)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Enrollment by Rombel & Attendance Summary */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Sebaran Murid per Rombel ({classes.length} Kelas)
                  </h2>
                  {can('kelas', 'read') && (
                    <Link href="/kelas" className="text-xs text-[#1D4ED8] hover:underline">
                      Kelola
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-6 gap-2 items-end h-28 pt-2">
                  {data.charts.classDistribution.map((c) => {
                    const heightPct = Math.max(15, Math.round((c.students / maxClassStudents) * 100));
                    const isSelected = c.className === data.selectedClass?.name;
                    return (
                      <div key={c.className} className="flex flex-col items-center gap-1 h-full justify-end">
                        <span className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {c.students}
                        </span>
                        <div
                          className={`w-full rounded-t ${
                            isSelected
                              ? 'bg-[#1D4ED8]'
                              : 'bg-[#0F2942]/75 dark:bg-slate-700'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                          {c.className}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  Statistik Kehadiran Semester Berjalan
                </h2>
                <div className="grid grid-cols-4 divide-x divide-slate-200 dark:divide-slate-800 border-y border-slate-100 dark:border-slate-800 py-3 text-center">
                  {[
                    { label: 'Hadir', val: data.stats.studentAttendance.H, color: 'text-emerald-700 dark:text-emerald-400' },
                    { label: 'Sakit', val: data.stats.studentAttendance.S, color: 'text-amber-700 dark:text-amber-400' },
                    { label: 'Izin', val: data.stats.studentAttendance.I, color: 'text-blue-700 dark:text-blue-400' },
                    { label: 'Alpa', val: data.stats.studentAttendance.A, color: 'text-red-700 dark:text-red-400' },
                  ].map((s) => (
                    <div key={s.label} className="px-2">
                      <p className={`text-lg font-bold font-mono tabular-nums ${s.color}`}>
                        {s.val}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{s.label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  Kehadiran Guru tercatat: <strong>{data.stats.teacherAttendanceRate}%</strong> ·
                  Kokurikuler: <strong>{data.stats.cocurricularCount}</strong> projek ·
                  Ekstrakurikuler: <strong>{data.stats.extracurricularCount}</strong>
                </p>
              </div>
            </div>
          </section>

          {/* Quick Shortcuts & Recent Audit Activity */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Akses Cepat Administrasi Guru
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { href: '/kurikulum', label: 'Mapel & CP / TP', icon: BookOpen, mod: 'kurikulum' as const },
                  { href: '/penilaian', label: 'Input Nilai Sumatif', icon: ClipboardCheck, mod: 'penilaian' as const },
                  { href: '/absensi', label: 'Presensi Harian', icon: UserCheck, mod: 'absensi' as const },
                  { href: '/integrasi', label: 'Kirim Nilai Dapodik', icon: RefreshCw, mod: 'dapodik' as const },
                ]
                  .filter((link) => can(link.mod, 'read'))
                  .map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center gap-2.5 p-3 rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-xs font-medium text-slate-800 dark:text-slate-200"
                      >
                        <Icon className="w-4 h-4 text-[#0F2942] dark:text-blue-400 shrink-0" />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
              </div>
            </div>

            <div className="lg:col-span-7 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Aktivitas Terakhir Sistem
              </h2>
              {data.recentActivities.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada catatan aktivitas.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.recentActivities.slice(0, 6).map((act) => (
                    <div
                      key={act.id}
                      className="py-2.5 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {act.details}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                          Oleh {act.actorName}
                        </p>
                      </div>
                      <span className="text-[11px] tabular-nums text-slate-400 shrink-0 whitespace-nowrap">
                        {formatIndoDate(act.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
