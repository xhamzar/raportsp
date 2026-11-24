'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import { Button, EmptyState, TableSkeleton } from '@/components/ui/Primitives';

interface SubjectItem {
  id: number;
  code: string;
  name: string;
}

interface LegerItem {
  rank: number;
  studentId: number;
  nisn: string;
  fullName: string;
  subjectScores: Record<number, number | null>;
  scoredSubjectCount: number;
  totalSubjects: number;
  average: number;
  cocurricularSummary: string;
  extracurricularSummary: string;
}

interface KeasramaanStudentRow {
  studentId: number;
  nisn: string;
  fullName: string;
  waliAsramaName: string;
  waliAsuhName: string;
  items: Array<{
    indicatorId: number;
    category: string;
    name: string;
    predicate: 'A' | 'B' | 'C';
  }>;
}

function LaporanInner() {
  const searchParams = useSearchParams();
  const { school, selectedClassId, selectedClass, can, canAny } = useApp();
  const showKeasramaan = Boolean(school?.enableKeasramaan && can('keasramaan', 'read'));
  const hasNilaiRead = canAny(['penilaian', 'rapor'], 'read');

  const [tab, setTab] = useState<'nilai' | 'keasramaan'>('nilai');
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [leger, setLeger] = useState<LegerItem[]>([]);
  const [keasIndicators, setKeasIndicators] = useState<
    Array<{ id: number; category: string; name: string }>
  >([]);
  const [keasRows, setKeasRows] = useState<KeasramaanStudentRow[]>([]);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'nilai' || t === 'keasramaan') {
      Promise.resolve().then(() => setTab(t));
    }
  }, [searchParams]);

  const activeTab =
    !hasNilaiRead && showKeasramaan
      ? 'keasramaan'
      : tab === 'keasramaan' && !showKeasramaan
      ? 'nilai'
      : tab;

  const loadData = useCallback(async () => {
    setLoading(true);
    const query = selectedClassId ? `?classId=${selectedClassId}` : '';
    const [assRes, keasRes] = await Promise.all([
      hasNilaiRead ? fetch(`/api/assessments${query}`, { cache: 'no-store' }) : Promise.resolve(null),
      showKeasramaan
        ? fetch(`/api/keasramaan${query}`, { cache: 'no-store' })
        : Promise.resolve(null),
    ]);
    if (assRes && assRes.ok) {
      const json = await assRes.json();
      setSubjects(json.subjects || []);
      setLeger(json.leger || []);
    }
    if (keasRes && keasRes.ok) {
      const kJson = await keasRes.json();
      setKeasIndicators(kJson.indicators || []);
      setKeasRows(kJson.studentRows || []);
    }
    setLoading(false);
  }, [selectedClassId, hasNilaiRead, showKeasramaan]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadData();
    });
  }, [loadData]);

  const classAverage =
    leger.length > 0
      ? (leger.reduce((acc, l) => acc + l.average, 0) / leger.length).toFixed(2)
      : '0.00';
  const highestAvg = leger.length > 0 ? Math.max(...leger.map((l) => l.average)).toFixed(2) : '0.00';
  const completeStudents = leger.filter(
    (l) => l.totalSubjects > 0 && l.scoredSubjectCount >= l.totalSubjects
  ).length;

  return (
    <AppShell title="Rekap & Leger" requiredModule={['penilaian', 'rapor', 'keasramaan']}>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-lg font-bold text-slate-900 dark:text-slate-100">
              {activeTab === 'keasramaan'
                ? `Rekap Pembinaan Keasramaan Kelas ${selectedClass?.name || ''}`
                : `Leger & Rekapitulasi Nilai Kelas ${selectedClass?.name || ''}`}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeTab === 'keasramaan'
                ? 'Matriks predikat pembinaan keasramaan (Kepemimpinan & Ketaatan Ibadah) per peserta didik.'
                : 'Rekap nilai akhir seluruh mata pelajaran intrakurikuler, kokurikuler, dan ekstrakurikuler semester aktif.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can('penilaian', 'export') && activeTab === 'nilai' && (
              <a href={`/api/assessments/excel?mode=leger&classId=${selectedClass?.id || ''}`}>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4" />
                  Unduh Leger (.xlsx)
                </Button>
              </a>
            )}
            {can('dapodik', 'read') && activeTab === 'nilai' && (
              <Link href="/integrasi">
                <Button variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4" />
                  Kirim ke Dapodik
                </Button>
              </Link>
            )}
            {canAny(['rapor', 'keasramaan'], 'read') && (
              <Link href={activeTab === 'keasramaan' ? '/cetak?doc=keasramaan' : '/cetak?doc=rapor'}>
                <Button size="sm">
                  <Printer className="w-4 h-4" />
                  Buka Pusat Cetak
                </Button>
              </Link>
            )}
          </div>
        </div>

        {hasNilaiRead && showKeasramaan && (
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md w-fit">
            <button
              type="button"
              onClick={() => setTab('nilai')}
              className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer whitespace-nowrap ${
                activeTab === 'nilai'
                  ? 'bg-white dark:bg-[#111C2E] text-[#0F2942] dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Rekap Nilai
            </button>
            <button
              type="button"
              onClick={() => setTab('keasramaan')}
              className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer whitespace-nowrap ${
                activeTab === 'keasramaan'
                  ? 'bg-white dark:bg-[#111C2E] text-[#0F2942] dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Rekap Keasramaan
            </button>
          </div>
        )}

        {activeTab === 'nilai' ? (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <p className="text-xs text-slate-500">Rata-rata Kelas {selectedClass?.name}</p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {classAverage}
                </p>
              </div>
              <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <p className="text-xs text-slate-500">Rata-rata Tertinggi</p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  {highestAvg}
                </p>
              </div>
              <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <p className="text-xs text-slate-500">Kelengkapan Nilai Murid</p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold font-mono tabular-nums text-[#0F2942] dark:text-blue-400">
                  {completeStudents} / {leger.length}
                </p>
              </div>
            </section>

            {loading ? (
              <TableSkeleton rows={10} />
            ) : (
              <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="py-3 px-3 font-semibold w-12">Pkt</th>
                        <th className="py-3 px-3 font-semibold">Nama Murid</th>
                        {subjects.map((sub) => (
                          <th
                            key={sub.id}
                            title={sub.name}
                            className="py-3 px-2 font-semibold text-right whitespace-nowrap"
                          >
                            {sub.code.split('-')[0]}
                          </th>
                        ))}
                        <th className="py-3 px-3 font-semibold text-right">Rata-rata</th>
                        <th className="py-3 px-3 font-semibold">Kokurikuler</th>
                        <th className="py-3 px-3 font-semibold">Ekstra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {leger.map((row) => (
                        <tr key={row.studentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-500">
                            #{row.rank}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {row.fullName}
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-slate-500">
                              {row.nisn}
                            </div>
                          </td>
                          {subjects.map((sub) => {
                            const val = row.subjectScores[sub.id];
                            return (
                              <td
                                key={sub.id}
                                className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200"
                              >
                                {val !== null && val !== undefined ? Math.round(val) : '-'}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[#0F2942] dark:text-blue-400">
                            {row.average.toFixed(1)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">{row.cocurricularSummary}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">{row.extracurricularSummary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : loading ? (
          <TableSkeleton rows={8} />
        ) : keasRows.length === 0 ? (
          <EmptyState
            title="Belum Ada Data Keasramaan"
            description="Pastikan modul Keasramaan diaktifkan dan nilai pembinaan telah diinput."
          />
        ) : (
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-3 px-3 font-semibold w-10">No</th>
                    <th className="py-3 px-3 font-semibold">Nama Murid</th>
                    {keasIndicators.map((ind) => (
                      <th key={ind.id} className="py-3 px-2 font-semibold text-center whitespace-nowrap" title={ind.category}>
                        {ind.name}
                      </th>
                    ))}
                    <th className="py-3 px-3 font-semibold">Wali Asuh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {keasRows.map((row, idx) => (
                    <tr key={row.studentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {row.fullName}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500">
                          {row.nisn}
                        </div>
                      </td>
                      {keasIndicators.map((ind) => {
                        const match = row.items.find((it) => it.indicatorId === ind.id);
                        return (
                          <td key={ind.id} className="py-2.5 px-2 text-center font-mono font-bold">
                            {match?.predicate || '-'}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {row.waliAsuhName || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function LaporanPage() {
  return (
    <Suspense fallback={<AppShell title="Rekap & Leger" requiredModule={['penilaian', 'rapor', 'keasramaan']}><TableSkeleton rows={8} /></AppShell>}>
      <LaporanInner />
    </Suspense>
  );
}
