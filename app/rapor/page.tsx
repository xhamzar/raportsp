'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileStack, Printer } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import { Button, Select, TableSkeleton } from '@/components/ui/Primitives';
import {
  RaporAkademikSheet,
  RaporKeasramaanSheet,
  type PrintClassInfo,
  type PrintSchoolInfo,
  type ReportCardData,
} from '@/components/print/RaporDocumentSheets';

interface ReportPayload {
  school: PrintSchoolInfo;
  academicYear: { name: string };
  semester: { name: string; reportDate: string };
  class: PrintClassInfo;
  availableDecisions?: string[];
  keasramaanEnabled?: boolean;
  reports: ReportCardData[];
}

export default function RaporPage() {
  const { selectedClassId, can } = useApp();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [reportType, setReportType] = useState<'akademik' | 'keasramaan'>('akademik');

  const loadReports = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedClassId) params.set('classId', String(selectedClassId));
    const res = await fetch(`/api/reports?${params.toString()}`, { cache: 'no-store' });
    if (res.ok) {
      const json: ReportPayload = await res.json();
      setPayload(json);
      if (!json.keasramaanEnabled) {
        setReportType('akademik');
      }
      setSelectedStudentId((prev) =>
        prev === 'all' || json.reports.some((r) => String(r.student.id) === prev)
          ? prev
          : json.reports[0]
          ? String(json.reports[0].student.id)
          : 'all'
      );
    }
    setLoading(false);
  }, [selectedClassId]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadReports();
    });
  }, [loadReports]);

  const visibleReports =
    payload?.reports.filter(
      (r) => selectedStudentId === 'all' || String(r.student.id) === selectedStudentId
    ) || [];

  const activeReportType = payload?.keasramaanEnabled ? reportType : 'akademik';

  return (
    <AppShell title="Cetak Rapor A4" requiredModule="rapor">
      <div className="space-y-5">
        <div className="no-print bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-1 flex-wrap">
            {payload?.keasramaanEnabled && (
              <div>
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Format Dokumen Rapor
                </p>
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md w-fit">
                  <button
                    type="button"
                    onClick={() => setReportType('akademik')}
                    className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer whitespace-nowrap ${
                      activeReportType === 'akademik'
                        ? 'bg-white dark:bg-[#111C2E] text-[#0F2942] dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Rapor Akhir Semester
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportType('keasramaan')}
                    className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer whitespace-nowrap ${
                      activeReportType === 'keasramaan'
                        ? 'bg-white dark:bg-[#111C2E] text-[#0F2942] dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Rapor Keasramaan
                  </button>
                </div>
              </div>
            )}

            <div className="w-full sm:w-80">
              <Select
                label="Pilih Murid / Mode Cetak"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                <option value="all">
                  Cetak Massal Semua Murid ({payload?.reports.length || 0} Rapor)
                </option>
                {payload?.reports.map((r) => (
                  <option key={r.student.id} value={String(r.student.id)}>
                    {r.student.fullName} (NISN {r.student.nisn})
                  </option>
                ))}
              </Select>
            </div>
            <p className="text-xs text-slate-500 pb-2">
              Kelas {payload?.class?.name} · Fase {payload?.class?.fase} · Tanggal Rapor{' '}
              {payload?.semester?.reportDate}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/cetak">
              <Button variant="outline" size="sm">
                <FileStack className="w-4 h-4" />
                Pusat Cetak (9 Dokumen)
              </Button>
            </Link>
            {can('rapor', 'export') && (
              <Button onClick={() => window.print()}>
                <Printer className="w-4 h-4" />
                Cetak / Simpan PDF A4
              </Button>
            )}
          </div>
        </div>

        {loading || !payload ? (
          <TableSkeleton rows={10} />
        ) : (
          <div className="space-y-8">
            {visibleReports.map((rep, idx) =>
              activeReportType === 'akademik' ? (
                <RaporAkademikSheet
                  key={`akademik-${rep.student.id}`}
                  school={payload.school}
                  academicYear={payload.academicYear.name}
                  semester={payload.semester}
                  cls={payload.class}
                  rep={rep}
                  availableDecisions={payload.availableDecisions}
                  pageBreak={idx < visibleReports.length - 1}
                />
              ) : (
                <RaporKeasramaanSheet
                  key={`keasramaan-${rep.student.id}`}
                  school={payload.school}
                  academicYear={payload.academicYear.name}
                  semester={payload.semester}
                  cls={payload.class}
                  rep={rep}
                  pageBreak={idx < visibleReports.length - 1}
                />
              )
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
