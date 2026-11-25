'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Download, Save } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import { AlertBox, Button, Input, TabBar, TableSkeleton } from '@/components/ui/Primitives';
import { formatIndoDate, formatIndoDateRange } from '@/lib/utils';

interface StudentAttRow {
  no: number;
  studentId: number;
  nisn: string;
  fullName: string;
  status: 'H' | 'S' | 'I' | 'A' | null;
  notes: string;
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  percentage: number;
}

interface TeacherAttRow {
  teacherId: number;
  fullName: string;
  nip: string;
  specialization: string;
  status: string;
  checkInTime: string;
  notes: string;
  recap: { hadir: number; sakit: number; izin: number; alpa: number; dinasLuar: number };
}

function AbsensiInner() {
  const searchParams = useSearchParams();
  const { selectedClassId, selectedClass, notify, can } = useApp();
  const canCreateAttendance = can('absensi', 'create');
  const canExportAttendance = can('absensi', 'export');
  const [tab, setTab] = useState<'murid' | 'guru'>('murid');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'murid' || t === 'guru') {
      Promise.resolve().then(() => setTab(t));
    }
  }, [searchParams]);

  const [holiday, setHoliday] = useState<{ title: string; startDate: string; endDate: string } | null>(null);
  const [studentRows, setStudentRows] = useState<StudentAttRow[]>([]);
  const [teacherRows, setTeacherRows] = useState<TeacherAttRow[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    if (tab === 'murid') {
      const params = new URLSearchParams({ date });
      if (selectedClassId) params.set('classId', String(selectedClassId));
      const res = await fetch(`/api/attendance?${params.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setHoliday(json.holiday || null);
        setStudentRows(
          (json.rows || []).map((r: StudentAttRow) => ({
            ...r,
            status: r.status || 'H',
          }))
        );
      }
    } else {
      const res = await fetch(`/api/teachers/attendance?date=${date}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setTeacherRows(
          (json.rows || []).map((r: TeacherAttRow) => ({
            ...r,
            status: r.status === 'Belum presensi' ? 'Hadir' : r.status,
          }))
        );
      }
    }
    setLoading(false);
  }, [tab, date, selectedClassId]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadData();
    });
  }, [loadData]);

  const markAllStudentsPresent = () => {
    setStudentRows((prev) => prev.map((r) => ({ ...r, status: 'H' })));
    notify('info', 'Semua murid ditandai Hadir (H). Klik Simpan Presensi untuk merekam.');
  };

  const handleSaveStudents = async () => {
    if (!selectedClass) return;
    setSaving(true);
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        classId: selectedClass.id,
        date,
        entries: studentRows.map((r) => ({
          studentId: r.studentId,
          status: r.status || 'H',
          notes: r.notes || '',
        })),
      }),
    });
    setSaving(false);
    if (res.ok) {
      notify('success', `Presensi murid Kelas ${selectedClass.name} tanggal ${formatIndoDate(date)} disimpan.`);
      await loadData();
    } else {
      const json = await res.json().catch(() => ({}));
      notify('error', json.error || 'Gagal menyimpan presensi murid.');
    }
  };

  const handleSaveTeachers = async () => {
    setSaving(true);
    const res = await fetch('/api/teachers/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        date,
        entries: teacherRows.map((t) => ({
          teacherId: t.teacherId,
          status: t.status,
          checkInTime: t.checkInTime || '06:50',
          notes: t.notes || '',
        })),
      }),
    });
    setSaving(false);
    if (res.ok) {
      notify('success', `Presensi pendidik tanggal ${formatIndoDate(date)} disimpan.`);
      await loadData();
    } else {
      notify('error', 'Gagal menyimpan presensi pendidik.');
    }
  };

  return (
    <AppShell title="Presensi" requiredModule="absensi">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-lg font-bold text-slate-900 dark:text-slate-100">
              Presensi {tab === 'murid' ? `Murid — Kelas ${selectedClass?.name}` : 'Guru & Tendik'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pencatatan kehadiran harian dengan deteksi hari libur kalender dan rekap otomatis ke rapor.
            </p>
          </div>
          {tab === 'murid' && (
            <div className="flex flex-wrap items-center gap-2">
              {canCreateAttendance && (
                <Button variant="outline" size="sm" onClick={markAllStudentsPresent}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Hadir Semua
                </Button>
              )}
              {canExportAttendance && (
                <a
                  href={`/api/attendance?classId=${selectedClass?.id || ''}&date=${date}&format=xlsx`}
                >
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4" />
                    Unduh Rekap (.xlsx)
                  </Button>
                </a>
              )}
              {canCreateAttendance && (
                <Button size="sm" loading={saving} onClick={handleSaveStudents}>
                  <Save className="w-4 h-4" />
                  Simpan Presensi
                </Button>
              )}
            </div>
          )}
          {tab === 'guru' && canCreateAttendance && (
            <Button size="sm" loading={saving} onClick={handleSaveTeachers}>
              <Save className="w-4 h-4" />
              Simpan Presensi Guru
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabBar
            items={[
              { id: 'murid', label: 'Presensi Murid' },
              { id: 'guru', label: 'Presensi Guru' },
            ]}
            activeId={tab}
            onChange={(id) => setTab(id as 'murid' | 'guru')}
          />

          <div className="w-44 shrink-0">
            <Input
              aria-label="Tanggal Presensi"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {tab === 'murid' && holiday && (
          <AlertBox variant="warning" title={`Hari Libur Kalender Pendidikan: ${holiday.title}`}>
            Tanggal {formatIndoDate(date)} bertepatan dengan agenda libur sekolah ({formatIndoDateRange(holiday.startDate, holiday.endDate)}).
          </AlertBox>
        )}

        {loading ? (
          <TableSkeleton rows={8} />
        ) : tab === 'murid' ? (
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table text-left text-xs">
                <thead>
                  <tr className="text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-3 font-semibold w-10 col-id">No</th>
                    <th className="py-3 px-3 font-semibold col-id col-cell-div">Nama Murid</th>
                    <th className="py-3 px-3 font-semibold col-a col-sep whitespace-nowrap">
                      Status Tanggal {formatIndoDate(date)}
                    </th>
                    <th className="py-3 px-3 font-semibold col-b col-sep">Keterangan</th>
                    <th className="py-3 px-3 font-semibold text-right col-total col-sep">
                      Rekap Semester (H/S/I/A)
                    </th>
                    <th className="py-3 px-3 font-semibold text-right col-total col-cell-div">
                      Kehadiran
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {studentRows.map((row) => (
                    <tr key={row.studentId}>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 col-id">
                        {row.no}
                      </td>
                      <td className="py-2.5 px-3 col-id col-cell-div">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {row.fullName}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500">
                          {row.nisn}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 col-a col-sep">
                        <div className="inline-flex items-center gap-1">
                          {(['H', 'S', 'I', 'A'] as const).map((code) => {
                            const active = row.status === code;
                            return (
                              <button
                                key={code}
                                type="button"
                                disabled={!canCreateAttendance}
                                onClick={() =>
                                  setStudentRows((prev) =>
                                    prev.map((p) =>
                                      p.studentId === row.studentId ? { ...p, status: code } : p
                                    )
                                  )
                                }
                                className={`min-w-[34px] h-8 px-2 rounded text-xs font-semibold border transition-colors ${
                                  canCreateAttendance ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'
                                } ${
                                  active
                                    ? 'bg-[#0F2942] dark:bg-blue-600 text-white border-[#0F2942] dark:border-blue-500'
                                    : 'bg-white dark:bg-[#0F172A] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                                }`}
                              >
                                {code}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 col-b col-sep">
                        <input
                          type="text"
                          value={row.notes}
                          disabled={!canCreateAttendance}
                          placeholder="Catatan opsional..."
                          onChange={(e) => {
                            const val = e.target.value;
                            setStudentRows((prev) =>
                              prev.map((p) =>
                                p.studentId === row.studentId ? { ...p, notes: val } : p
                              )
                            );
                          }}
                          className="w-full min-w-[140px] h-8 px-2.5 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded disabled:opacity-70"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200 col-total col-sep">
                        {row.hadir} / {row.sakit} / {row.izin} / {row.alpa}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 col-total col-cell-div">
                        {row.percentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table text-left text-xs">
                <thead>
                  <tr className="text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-3 font-semibold col-id">Nama Pendidik</th>
                    <th className="py-3 px-3 font-semibold col-id col-cell-div">Bidang</th>
                    <th className="py-3 px-3 font-semibold col-a col-sep">Status Kehadiran</th>
                    <th className="py-3 px-3 font-semibold w-28 col-b col-sep">Jam Hadir</th>
                    <th className="py-3 px-3 font-semibold text-right col-total col-sep">
                      Rekap H/S/I/DL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {teacherRows.map((t) => (
                    <tr key={t.teacherId}>
                      <td className="py-2.5 px-3 col-id">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {t.fullName}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500">
                          {t.nip || '-'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 col-id col-cell-div">{t.specialization}</td>
                      <td className="py-2.5 px-3 col-a col-sep">
                        <select
                          value={t.status}
                          disabled={!canCreateAttendance}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTeacherRows((prev) =>
                              prev.map((p) =>
                                p.teacherId === t.teacherId ? { ...p, status: val } : p
                              )
                            );
                          }}
                          className="h-8 px-2.5 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded cursor-pointer disabled:opacity-70"
                        >
                          <option value="Hadir">Hadir</option>
                          <option value="Sakit">Sakit</option>
                          <option value="Izin">Izin</option>
                          <option value="Dinas Luar">Dinas Luar</option>
                          <option value="Alpa">Alpa</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 col-b col-sep">
                        <input
                          type="time"
                          disabled={!canCreateAttendance}
                          value={t.checkInTime || '06:50'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTeacherRows((prev) =>
                              prev.map((p) =>
                                p.teacherId === t.teacherId ? { ...p, checkInTime: val } : p
                              )
                            );
                          }}
                          className="h-8 px-2 text-xs font-mono bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded disabled:opacity-70"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-800 dark:text-slate-100 col-total col-sep">
                        {t.recap.hadir} / {t.recap.sakit} / {t.recap.izin} / {t.recap.dinasLuar}
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

export default function AbsensiPage() {
  return (
    <Suspense fallback={<AppShell title="Presensi" requiredModule="absensi"><TableSkeleton rows={8} /></AppShell>}>
      <AbsensiInner />
    </Suspense>
  );
}
