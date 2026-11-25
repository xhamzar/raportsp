'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import { GoogleDrivePdfPreviewModal } from '@/components/print/GoogleDrivePdfPreviewModal';
import {
  buildPdfFileName,
  renderPrintContainerToPdf,
  triggerPdfDownload,
  type RenderedPdfBundle,
} from '@/lib/pdf-renderer';
import {
  Button,
  EmptyState,
  Input,
  Select,
  TabBar,
  TableSkeleton,
  ToggleSwitch,
} from '@/components/ui/Primitives';
import {
  BiodataMuridSheet,
  BukuTamuPrintSheet,
  CoverRaporSheet,
  JurnalMengajarPrintSheet,
  LaporanTppPrintSheet,
  PiagamPrestasiSheet,
  PresensiGuruPrintSheet,
  RaporAkademikSheet,
  RaporKeasramaanSheet,
  type DailyCalendarDay,
  type JournalPrintRow,
  type PrintClassInfo,
  type PrintSchoolInfo,
  type PrintStudentBiodata,
  type ReportCardData,
  type TeacherDailyMatrixRow,
} from '@/components/print/RaporDocumentSheets';
import type { RankedStudentEntry, TeacherTppSummaryRow } from '@/lib/server/services/print-metrics';
import { formatIndoMonthYear } from '@/lib/utils';

type PrintDocKey =
  | ''
  | 'cover'
  | 'biodata'
  | 'rapor'
  | 'piagam'
  | 'keasramaan'
  | 'jurnal'
  | 'buku_tamu'
  | 'presensi_guru'
  | 'laporan_tpp';

const DOC_OPTIONS: Array<{ value: Exclude<PrintDocKey, ''>; label: string }> = [
  { value: 'rapor', label: 'Rapor' },
  { value: 'cover', label: 'Cover' },
  { value: 'biodata', label: 'Biodata' },
  { value: 'piagam', label: 'Piagam' },
  { value: 'keasramaan', label: 'Keasramaan' },
  { value: 'jurnal', label: 'Jurnal Mengajar' },
  { value: 'buku_tamu', label: 'Buku Tamu' },
  { value: 'presensi_guru', label: 'Presensi Guru' },
  { value: 'laporan_tpp', label: 'Laporan TPP' },
];

interface PrintCenterPayload {
  doc: Exclude<PrintDocKey, ''>;
  school: PrintSchoolInfo;
  academicYear: { name: string };
  semester: { name: string; reportDate: string };
  class: PrintClassInfo | null;
  availableDocs: Array<Exclude<PrintDocKey, ''>>;
  students?: PrintStudentBiodata[];
  rankings?: RankedStudentEntry[];
  journals?: JournalPrintRow[];
  guests?: Array<{
    id: number;
    visitDate: string;
    visitorName: string;
    institution: string;
    purpose: string;
    personToMeet: string;
    phone: string | null;
  }>;
  resolvedMonth?: string;
  learningDaysCount?: number;
  dailyCalendar?: DailyCalendarDay[];
  dailyMatrixRows?: TeacherDailyMatrixRow[];
  effectiveWorkDays?: number;
  teacherSummary?: TeacherTppSummaryRow[];
}

interface ReportsPayload {
  school: PrintSchoolInfo;
  academicYear: { name: string };
  semester: { name: string; reportDate: string };
  class: PrintClassInfo;
  availableDecisions?: string[];
  keasramaanEnabled?: boolean;
  reports: ReportCardData[];
}

function CetakInner() {
  const searchParams = useSearchParams();
  const {
    selectedClassId,
    selectedClass,
    activeYear,
    activeSemester,
    school,
    user,
    can,
    canAny,
    notify,
    refreshContext,
  } = useApp();

  const initialDoc = (searchParams.get('doc') || '') as PrintDocKey;
  const [selectedDoc, setSelectedDoc] = useState<PrintDocKey>(initialDoc);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [piagamFilter, setPiagamFilter] = useState<string>('top3');
  const [monthFilter, setMonthFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSigOverride, setShowSigOverride] = useState<boolean | null>(null);
  const [showStampOverride, setShowStampOverride] = useState<boolean | null>(null);
  const [showLetterheadOverride, setShowLetterheadOverride] = useState<boolean | null>(null);
  const printCanvasRef = useRef<HTMLDivElement>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const [pdfBundle, setPdfBundle] = useState<RenderedPdfBundle | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [centerData, setCenterData] = useState<PrintCenterPayload | null>(null);
  const [reportsData, setReportsData] = useState<ReportsPayload | null>(null);

  const permittedDocs = useMemo(
    () =>
      DOC_OPTIONS.filter((opt) => {
        if (opt.value === 'keasramaan') {
          return Boolean(school?.enableKeasramaan && canAny(['keasramaan', 'rapor'], 'read'));
        }
        if (opt.value === 'jurnal') return can('kurikulum', 'read');
        if (opt.value === 'buku_tamu') return can('administrasi', 'read');
        if (opt.value === 'presensi_guru' || opt.value === 'laporan_tpp') {
          return canAny(['absensi', 'guru'], 'read');
        }
        return can('rapor', 'read');
      }),
    [school?.enableKeasramaan, can, canAny]
  );

  const defaultDoc: PrintDocKey =
    permittedDocs.find((o) => o.value === 'rapor')?.value || permittedDocs[0]?.value || '';

  useEffect(() => {
    const paramDoc = (searchParams.get('doc') || '') as PrintDocKey;
    if (paramDoc && DOC_OPTIONS.some((o) => o.value === paramDoc)) {
      Promise.resolve().then(() => setSelectedDoc(paramDoc));
    } else if (user && !selectedDoc && defaultDoc) {
      Promise.resolve().then(() => setSelectedDoc(defaultDoc));
    }
  }, [searchParams, user, selectedDoc, defaultDoc]);

  const effectiveDoc: PrintDocKey = selectedDoc || defaultDoc;

  const loadDocument = useCallback(async () => {
    if (!effectiveDoc) {
      setCenterData(null);
      setReportsData(null);
      setErrorMsg('');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      if (effectiveDoc === 'rapor' || effectiveDoc === 'keasramaan') {
        const params = new URLSearchParams();
        if (selectedClassId) params.set('classId', String(selectedClassId));
        const res = await fetch(`/api/reports?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) {
          setErrorMsg(json.error || 'Gagal memuat data rapor.');
          setReportsData(null);
        } else {
          setReportsData(json);
        }
      } else {
        const params = new URLSearchParams({ doc: effectiveDoc });
        if (selectedClassId) params.set('classId', String(selectedClassId));
        if (monthFilter) params.set('month', monthFilter);
        const res = await fetch(`/api/print-center?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) {
          setErrorMsg(json.error || 'Gagal memuat dokumen cetak.');
          setCenterData(null);
        } else {
          setCenterData(json);
        }
      }
    } catch {
      setErrorMsg('Koneksi terputus saat memuat pratinjau dokumen cetak.');
    } finally {
      setLoading(false);
    }
  }, [effectiveDoc, selectedClassId, monthFilter]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadDocument();
    });
  }, [loadDocument]);

  const activeDocLabel = DOC_OPTIONS.find((o) => o.value === effectiveDoc)?.label || 'Cetak';
  const isStudentDoc =
    effectiveDoc === 'cover' ||
    effectiveDoc === 'biodata' ||
    effectiveDoc === 'rapor' ||
    effectiveDoc === 'keasramaan';
  const isMonthFilterDoc =
    effectiveDoc === 'jurnal' ||
    effectiveDoc === 'buku_tamu' ||
    effectiveDoc === 'presensi_guru' ||
    effectiveDoc === 'laporan_tpp';

  const studentOptions =
    effectiveDoc === 'rapor' || effectiveDoc === 'keasramaan'
      ? (reportsData?.reports || []).map((r) => r.student)
      : centerData?.students || [];

  const visibleStudents = (centerData?.students || []).filter(
    (s) => selectedStudentId === 'all' || String(s.id) === selectedStudentId
  );

  const visibleReports = (reportsData?.reports || []).filter(
    (r) => selectedStudentId === 'all' || String(r.student.id) === selectedStudentId
  );

  const allRankings = centerData?.rankings || [];
  const visibleRankings =
    piagamFilter === 'top3'
      ? allRankings.filter((r) => r.rank <= 3)
      : piagamFilter === 'all'
      ? allRankings
      : allRankings.filter((r) => String(r.studentId) === piagamFilter);

  const monthLabel = monthFilter ? formatIndoMonthYear(monthFilter) : 'Semester Aktif';

  const effectiveShowSig =
    showSigOverride ?? school?.showPrincipalSignature ?? centerData?.school?.showPrincipalSignature ?? reportsData?.school?.showPrincipalSignature ?? true;
  const effectiveShowStamp =
    showStampOverride ?? school?.showSchoolStamp ?? centerData?.school?.showSchoolStamp ?? reportsData?.school?.showSchoolStamp ?? true;
  const effectiveShowLetterhead =
    showLetterheadOverride ?? school?.showLetterhead ?? centerData?.school?.showLetterhead ?? reportsData?.school?.showLetterhead ?? true;
  const isLetterheadDoc =
    effectiveDoc === 'biodata' ||
    effectiveDoc === 'piagam' ||
    effectiveDoc === 'buku_tamu' ||
    effectiveDoc === 'laporan_tpp';
  const hasAnySignatureAsset = Boolean(
    school?.principalSignaturePath ||
      centerData?.school?.principalSignaturePath ||
      reportsData?.school?.principalSignaturePath ||
      school?.schoolStampPath ||
      centerData?.school?.schoolStampPath ||
      reportsData?.school?.schoolStampPath
  );

  const handleQuickToggle = async (
    field: 'showPrincipalSignature' | 'showSchoolStamp' | 'showLetterhead',
    next: boolean
  ) => {
    if (field === 'showPrincipalSignature') {
      setShowSigOverride(next);
    } else if (field === 'showSchoolStamp') {
      setShowStampOverride(next);
    } else {
      setShowLetterheadOverride(next);
    }
    if (can('sekolah', 'update')) {
      const res = await fetch('/api/school/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ [field]: next }),
      });
      if (res.ok) {
        await refreshContext();
      } else {
        notify('error', 'Gagal menyimpan preferensi tampilan.');
      }
    }
  };

  const effectiveCenterSchool: PrintSchoolInfo | undefined = centerData?.school
    ? {
        ...centerData.school,
        showPrincipalSignature: effectiveShowSig,
        showSchoolStamp: effectiveShowStamp,
        showLetterhead: effectiveShowLetterhead,
      }
    : undefined;

  const effectiveReportsSchool: PrintSchoolInfo | undefined = reportsData?.school
    ? {
        ...reportsData.school,
        showPrincipalSignature: effectiveShowSig,
        showSchoolStamp: effectiveShowStamp,
        showLetterhead: effectiveShowLetterhead,
      }
    : undefined;

  useEffect(() => {
    return () => {
      if (pdfBundle?.pdfUrl) {
        URL.revokeObjectURL(pdfBundle.pdfUrl);
      }
    };
  }, [pdfBundle]);

  const invalidatePdfBundle = useCallback(() => {
    setPdfBundle((prev) => {
      if (prev?.pdfUrl) URL.revokeObjectURL(prev.pdfUrl);
      return null;
    });
  }, []);

  const handleOpenPreview = async () => {
    if (!printCanvasRef.current || generatingPdf) return;
    setGeneratingPdf(true);
    setPdfProgress(null);
    try {
      const classLabel = selectedClass ? `Kelas_${selectedClass.name}` : 'Semua_Kelas';
      const periodLabel = monthFilter || activeYear?.name || '2026-2027';
      const fileName = buildPdfFileName([activeDocLabel, classLabel, periodLabel]);
      const bundle = await renderPrintContainerToPdf(printCanvasRef.current, {
        fileName,
        onProgress: (current, total) => setPdfProgress({ current, total }),
      });
      setPdfBundle((prev) => {
        if (prev?.pdfUrl) URL.revokeObjectURL(prev.pdfUrl);
        return bundle;
      });
      setPreviewOpen(true);
    } catch (err) {
      notify(
        'error',
        err instanceof Error ? err.message : 'Gagal menyiapkan pratinjau dokumen PDF.'
      );
    } finally {
      setGeneratingPdf(false);
      setPdfProgress(null);
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfBundle) return;
    triggerPdfDownload(pdfBundle);
    notify('success', `Mengunduh ${pdfBundle.fileName}...`);
  };

  const handlePrintFromPreview = () => {
    let beforePrintFired = false;
    const onBeforePrint = () => {
      beforePrintFired = true;
    };
    window.addEventListener('beforeprint', onBeforePrint, { once: true });
    try {
      window.print();
    } catch {
      // Blocked in restricted context
    }
    setTimeout(() => {
      window.removeEventListener('beforeprint', onBeforePrint);
      if (!beforePrintFired) {
        notify(
          'info',
          'Browser atau frame pratinjau membatasi dialog cetak langsung. Silakan gunakan tombol Unduh PDF lalu cetak file PDF dari perangkat Anda.'
        );
      }
    }, 600);
  };

  return (
    <AppShell
      title="Cetak"
      requiredModule={['rapor', 'keasramaan', 'kurikulum', 'administrasi', 'absensi', 'guru']}
    >
      <div className="space-y-5">
        {/* Clean Print Toolbar */}
        <div className="no-print space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-lg font-bold text-slate-900 dark:text-slate-100">
                Pusat Cetak Dokumen
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedClass ? `Kelas ${selectedClass.name}` : 'Semua Kelas'} ·{' '}
                {activeSemester?.name || 'Semester Aktif'} · TA {activeYear?.name || '2026/2027'}
              </p>
            </div>
            {effectiveDoc && (
              <div className="flex flex-wrap items-center gap-3">
                {effectiveDoc !== 'cover' && (
                  <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2E]">
                    {isLetterheadDoc && (
                      <>
                        <ToggleSwitch
                          size="sm"
                          checked={effectiveShowLetterhead}
                          onChange={(next) => {
                            invalidatePdfBundle();
                            void handleQuickToggle('showLetterhead', next);
                          }}
                          label="Kop Surat"
                        />
                        <span className="h-4 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                      </>
                    )}
                    <ToggleSwitch
                      size="sm"
                      checked={effectiveShowSig}
                      onChange={(next) => {
                        invalidatePdfBundle();
                        void handleQuickToggle('showPrincipalSignature', next);
                      }}
                      label="Tanda Tangan"
                    />
                    <span className="h-4 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                    <ToggleSwitch
                      size="sm"
                      checked={effectiveShowStamp}
                      onChange={(next) => {
                        invalidatePdfBundle();
                        void handleQuickToggle('showSchoolStamp', next);
                      }}
                      label="Stempel"
                    />
                    {!hasAnySignatureAsset && can('sekolah', 'read') && (
                      <>
                        <span className="h-4 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                        <Link
                          href="/pengaturan?tab=dokumen"
                          className="text-[11px] font-medium text-[#1D4ED8] hover:underline whitespace-nowrap"
                        >
                          Unggah TTD/Stempel
                        </Link>
                      </>
                    )}
                  </div>
                )}
                <Button
                  onClick={handleOpenPreview}
                  loading={generatingPdf}
                  disabled={loading || Boolean(errorMsg) || generatingPdf}
                >
                  <Eye className="w-4 h-4" />
                  {generatingPdf && pdfProgress
                    ? `Menyiapkan ${pdfProgress.current}/${pdfProgress.total}...`
                    : 'Preview & Simpan PDF'}
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <TabBar
              items={permittedDocs.map((opt) => ({ id: opt.value, label: opt.label }))}
              activeId={effectiveDoc}
              onChange={(id) => {
                setSelectedDoc(id as PrintDocKey);
                setSelectedStudentId('all');
              }}
            />

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isStudentDoc && (
                <div className="w-full sm:w-72">
                  <Select
                    aria-label="Filter Peserta Didik"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                  >
                    <option value="all">
                      Semua Murid ({studentOptions.length} Murid)
                    </option>
                    {studentOptions.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.fullName} (NISN {s.nisn})
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {effectiveDoc === 'piagam' && (
                <div className="w-full sm:w-72">
                  <Select
                    aria-label="Penerima Piagam Peringkat"
                    value={piagamFilter}
                    onChange={(e) => setPiagamFilter(e.target.value)}
                  >
                    <option value="top3">Otomatis 3 Besar Kelas</option>
                    <option value="all">Seluruh Murid ({allRankings.length})</option>
                    {allRankings.map((r) => (
                      <option key={r.studentId} value={String(r.studentId)}>
                        #{r.rank} · {r.fullName} ({r.averageScore.toFixed(1)})
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {isMonthFilterDoc && (
                <div className="flex items-center gap-2">
                  <div className="w-44">
                    <Input
                      aria-label="Filter Bulan"
                      type="month"
                      value={monthFilter}
                      onChange={(e) => setMonthFilter(e.target.value)}
                    />
                  </div>
                  {monthFilter && (
                    <Button variant="outline" size="sm" onClick={() => setMonthFilter('')}>
                      Reset
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Document Preview Canvas */}
        <div ref={printCanvasRef}>
        {!effectiveDoc ? (
          <EmptyState
            title="Tidak Ada Dokumen Tersedia"
            description="Peran akun Anda belum memiliki izin untuk mencetak dokumen pada modul ini."
          />
        ) : loading ? (
          <TableSkeleton rows={8} />
        ) : errorMsg ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-5 text-sm text-red-800">
            {errorMsg}
          </div>
        ) : effectiveDoc === 'cover' && effectiveCenterSchool && centerData && centerData.class ? (
          <div className="space-y-8">
            {visibleStudents.map((stu, idx) => (
              <CoverRaporSheet
                key={stu.id}
                school={effectiveCenterSchool}
                academicYear={centerData.academicYear.name}
                student={stu}
                pageBreak={idx < visibleStudents.length - 1}
              />
            ))}
          </div>
        ) : effectiveDoc === 'biodata' && effectiveCenterSchool && centerData && centerData.class ? (
          <div className="space-y-8">
            {visibleStudents.map((stu, idx) => (
              <BiodataMuridSheet
                key={stu.id}
                school={effectiveCenterSchool}
                semester={centerData.semester}
                cls={centerData.class!}
                student={stu}
                pageBreak={idx < visibleStudents.length - 1}
              />
            ))}
          </div>
        ) : effectiveDoc === 'piagam' && effectiveCenterSchool && centerData && centerData.class ? (
          <div className="space-y-8">
            {visibleRankings.length === 0 ? (
              <EmptyState
                title="Belum Ada Data Peringkat"
                description={`Belum ada nilai sumatif tercatat pada ${activeDocLabel} kelas ${centerData.class.name}.`}
              />
            ) : (
              visibleRankings.map((entry, idx) => (
                <PiagamPrestasiSheet
                  key={entry.studentId}
                  school={effectiveCenterSchool}
                  academicYear={centerData.academicYear.name}
                  semester={centerData.semester}
                  cls={centerData.class!}
                  entry={entry}
                  pageBreak={idx < visibleRankings.length - 1}
                />
              ))
            )}
          </div>
        ) : effectiveDoc === 'rapor' && effectiveReportsSchool && reportsData ? (
          <div className="space-y-8">
            {visibleReports.map((rep, idx) => (
              <RaporAkademikSheet
                key={rep.student.id}
                school={effectiveReportsSchool}
                academicYear={reportsData.academicYear.name}
                semester={reportsData.semester}
                cls={reportsData.class}
                rep={rep}
                availableDecisions={reportsData.availableDecisions}
                pageBreak={idx < visibleReports.length - 1}
              />
            ))}
          </div>
        ) : effectiveDoc === 'keasramaan' && effectiveReportsSchool && reportsData ? (
          <div className="space-y-8">
            {visibleReports.map((rep, idx) => (
              <RaporKeasramaanSheet
                key={rep.student.id}
                school={effectiveReportsSchool}
                academicYear={reportsData.academicYear.name}
                semester={reportsData.semester}
                cls={reportsData.class}
                rep={rep}
                pageBreak={idx < visibleReports.length - 1}
              />
            ))}
          </div>
        ) : effectiveDoc === 'jurnal' && effectiveCenterSchool && centerData ? (
          <JurnalMengajarPrintSheet
            school={effectiveCenterSchool}
            academicYear={centerData.academicYear.name}
            semester={centerData.semester}
            cls={centerData.class}
            monthLabel={monthLabel}
            journals={centerData.journals || []}
          />
        ) : effectiveDoc === 'buku_tamu' && effectiveCenterSchool && centerData ? (
          <BukuTamuPrintSheet
            school={effectiveCenterSchool}
            semester={centerData.semester}
            monthLabel={monthLabel}
            guests={centerData.guests || []}
          />
        ) : effectiveDoc === 'presensi_guru' && effectiveCenterSchool && centerData ? (
          <PresensiGuruPrintSheet
            school={effectiveCenterSchool}
            academicYear={centerData.academicYear.name}
            semester={centerData.semester}
            resolvedMonth={centerData.resolvedMonth || monthFilter || new Date().toISOString().slice(0, 7)}
            learningDaysCount={centerData.learningDaysCount || centerData.effectiveWorkDays || 22}
            dailyCalendar={centerData.dailyCalendar || []}
            dailyMatrixRows={centerData.dailyMatrixRows || []}
          />
        ) : effectiveDoc === 'laporan_tpp' && effectiveCenterSchool && centerData ? (
          <LaporanTppPrintSheet
            school={effectiveCenterSchool}
            academicYear={centerData.academicYear.name}
            semester={centerData.semester}
            monthLabel={monthLabel}
            effectiveWorkDays={centerData.effectiveWorkDays || 22}
            rows={centerData.teacherSummary || []}
          />
        ) : null}
        </div>
      </div>

      <GoogleDrivePdfPreviewModal
        open={previewOpen}
        bundle={pdfBundle}
        onClose={() => setPreviewOpen(false)}
        onDownload={handleDownloadPdf}
        onPrint={handlePrintFromPreview}
      />
    </AppShell>
  );
}

export default function CetakPage() {
  return (
    <Suspense
      fallback={
        <AppShell
          title="Cetak"
          requiredModule={['rapor', 'keasramaan', 'kurikulum', 'administrasi', 'absensi', 'guru']}
        >
          <TableSkeleton rows={8} />
        </AppShell>
      }
    >
      <CetakInner />
    </Suspense>
  );
}
