'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { NotebookPen, Plus, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  TableSkeleton,
} from '@/components/ui/Primitives';

interface JournalRow {
  id: number;
  teacherId: number;
  teacherName: string;
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  date: string;
  lessonHour: string;
  material: string;
  objectiveSummary: string;
  activities: string;
  completionStatus: string;
  notes: string;
}

interface SubjectOption {
  id: number;
  name: string;
}

interface TeacherOption {
  id: number;
  fullName: string;
}

export default function JurnalPage() {
  const { selectedClassId, selectedClass, user, notify, can } = useApp();
  const [loading, setLoading] = useState(true);
  const [journals, setJournals] = useState<JournalRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [dateFilter, setDateFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    subjectId: '',
    teacherId: '',
    date: new Date().toISOString().slice(0, 10),
    lessonHour: '1–2',
    material: '',
    objectiveSummary: '',
    activities: '',
    completionStatus: 'Tuntas',
    notes: '',
  });

  const defaultTeacherId = user?.teacherId;

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedClassId) params.set('classId', String(selectedClassId));
    if (dateFilter) params.set('date', dateFilter);

    const [jRes, aRes, tRes] = await Promise.all([
      fetch(`/api/journals?${params.toString()}`, { cache: 'no-store' }),
      fetch(`/api/academics?module=kurikulum${selectedClassId ? `&classId=${selectedClassId}` : ''}`, { cache: 'no-store' }),
      fetch('/api/teachers', { cache: 'no-store' }),
    ]);

    if (jRes.ok) {
      const json = await jRes.json();
      setJournals(json.journals || []);
    }
    if (aRes.ok) {
      const aJson = await aRes.json();
      const subs = aJson.subjects || [];
      setSubjects(subs);
      setForm((prev) => ({
        ...prev,
        subjectId: prev.subjectId || (subs[0] ? String(subs[0].id) : ''),
      }));
    }
    if (tRes.ok) {
      const tJson = await tRes.json();
      const tList = tJson.teachers || [];
      setTeachers(tList);
      setForm((prev) => ({
        ...prev,
        teacherId:
          prev.teacherId ||
          (defaultTeacherId ? String(defaultTeacherId) : tList[0] ? String(tList[0].id) : ''),
      }));
    }
    setLoading(false);
  }, [selectedClassId, dateFilter, defaultTeacherId]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadData();
    });
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    const res = await fetch('/api/journals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        classId: selectedClass.id,
        subjectId: Number(form.subjectId),
        teacherId: Number(form.teacherId),
        date: form.date,
        lessonHour: form.lessonHour,
        material: form.material,
        objectiveSummary: form.objectiveSummary,
        activities: form.activities,
        completionStatus: form.completionStatus,
        notes: form.notes,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan jurnal mengajar.');
      return;
    }
    setModalOpen(false);
    setForm((prev) => ({ ...prev, material: '', objectiveSummary: '', activities: '', notes: '' }));
    notify('success', 'Jurnal mengajar harian berhasil dicatat.');
    await loadData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/journals?id=${deleteId}`, {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (res.ok) {
      notify('success', 'Catatan jurnal dihapus.');
      setDeleteId(null);
      await loadData();
    } else {
      notify('error', 'Gagal menghapus jurnal.');
    }
  };

  return (
    <AppShell title="Jurnal Mengajar" requiredModule="kurikulum">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-lg font-bold text-slate-900 dark:text-slate-100">
              Jurnal Mengajar Guru — Kelas {selectedClass?.name}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dokumentasi materi ajar, ringkasan tujuan pembelajaran, aktivitas kelas, dan ketuntasan KBM harian.
            </p>
          </div>
          {can('kurikulum', 'create') && (
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4" />
              Catat Jurnal Baru
            </Button>
          )}
        </div>

        <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-wrap items-end gap-3">
          <div className="w-52">
            <Input
              label="Filter Tanggal"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          {dateFilter && (
            <Button variant="outline" size="sm" onClick={() => setDateFilter('')}>
              Tampilkan Semua Tanggal
            </Button>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={5} />
        ) : journals.length === 0 ? (
          <EmptyState
            title="Belum ada jurnal mengajar"
            description="Klik Catat Jurnal Baru untuk mendokumentasikan pelaksanaan pembelajaran kelas hari ini."
          />
        ) : (
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-3 px-3 font-semibold w-28">Tanggal / JP</th>
                    <th className="py-3 px-3 font-semibold">Mata Pelajaran & Guru</th>
                    <th className="py-3 px-3 font-semibold">Materi & Tujuan</th>
                    <th className="py-3 px-3 font-semibold">Aktivitas Kelas</th>
                    <th className="py-3 px-3 font-semibold">Ketuntasan</th>
                    <th className="py-3 px-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {journals.map((j) => (
                    <tr key={j.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 align-top">
                        <div className="font-mono tabular-nums font-medium">{j.date}</div>
                        <div className="text-[11px] text-slate-500">Jam {j.lessonHour}</div>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {j.subjectName}
                        </div>
                        <div className="text-[11px] text-slate-500">{j.teacherName}</div>
                      </td>
                      <td className="py-3 px-3 align-top max-w-xs">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {j.material}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{j.objectiveSummary}</div>
                      </td>
                      <td className="py-3 px-3 align-top max-w-xs text-slate-600 dark:text-slate-300">
                        {j.activities}
                      </td>
                      <td className="py-3 px-3 align-top font-medium">
                        {j.completionStatus}
                      </td>
                      <td className="py-3 px-3 align-top text-right">
                        {can('kurikulum', 'delete') && (
                          <button
                            type="button"
                            onClick={() => setDeleteId(j.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                            aria-label="Hapus jurnal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Catat Jurnal Mengajar">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Tanggal"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
            <Input
              label="Jam Pelajaran ke-"
              placeholder="1–2"
              value={form.lessonHour}
              onChange={(e) => setForm({ ...form, lessonHour: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Mata Pelajaran"
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              required
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select
              label="Guru Mengajar"
              value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
              required
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Materi Pokok"
            value={form.material}
            onChange={(e) => setForm({ ...form, material: e.target.value })}
            required
          />
          <Input
            label="Ringkasan Tujuan Pembelajaran"
            value={form.objectiveSummary}
            onChange={(e) => setForm({ ...form, objectiveSummary: e.target.value })}
            required
          />
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Aktivitas & Metode Pembelajaran
            </label>
            <textarea
              rows={3}
              value={form.activities}
              onChange={(e) => setForm({ ...form, activities: e.target.value })}
              className="w-full p-3 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-md"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Status Ketuntasan"
              value={form.completionStatus}
              onChange={(e) => setForm({ ...form, completionStatus: e.target.value })}
            >
              <option value="Tuntas">Tuntas</option>
              <option value="Sebagian">Sebagian</option>
              <option value="Tertunda">Tertunda</option>
            </Select>
            <Input
              label="Catatan Refleksi"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit">
              <NotebookPen className="w-4 h-4" />
              Simpan Jurnal
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Catatan Jurnal"
        message="Yakin ingin menghapus catatan jurnal mengajar ini?"
        confirmLabel="Ya, Hapus"
        danger
      />
    </AppShell>
  );
}
