'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, CalendarClock, Plus, Trash2, Volume2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import { Button, Input, Modal, Select, TableSkeleton } from '@/components/ui/Primitives';

interface BellRow {
  id: number;
  dayGroup: string;
  periodNumber: number;
  label: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  soundType: string;
}

interface ScheduleRow {
  id: number;
  classId: number;
  dayOfWeek: number;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectId: number | null;
  teacherId: number | null;
  activityLabel: string;
}

interface SubjectOption {
  id: number;
  code: string;
  name: string;
  teacherId: number | null;
}

interface TeacherOption {
  id: number;
  fullName: string;
}

const DAYS = [
  { id: 1, label: 'Senin' },
  { id: 2, label: 'Selasa' },
  { id: 3, label: 'Rabu' },
  { id: 4, label: 'Kamis' },
  { id: 5, label: 'Jumat' },
  { id: 6, label: 'Sabtu' },
];

export default function JadwalPage() {
  const { selectedClassId, selectedClass, notify, can } = useApp();
  const canManageSchedule = can('jadwal', 'create');
  const canDeleteSchedule = can('jadwal', 'delete');
  const [loading, setLoading] = useState(true);
  const [bells, setBells] = useState<BellRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    dayOfWeek: 1,
    periodNumber: 1,
    subjectId: '',
    teacherId: '',
    activityLabel: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const query = selectedClassId ? `&classId=${selectedClassId}` : '';
    const [acadRes, teachRes] = await Promise.all([
      fetch(`/api/academics?module=jadwal${query}`, { cache: 'no-store' }),
      fetch('/api/teachers', { cache: 'no-store' }),
    ]);

    if (acadRes.ok) {
      const json = await acadRes.json();
      setBells(json.bells || []);
      setSchedules(json.schedules || []);
      setSubjects(json.subjects || []);
    }
    if (teachRes.ok) {
      const tJson = await teachRes.json();
      setTeachers(tJson.teachers || []);
    }
    setLoading(false);
  }, [selectedClassId]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadData();
    });
  }, [loadData]);

  const playBellSound = (label: string) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.22);
        gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.22);
        osc.stop(ctx.currentTime + i * 0.22 + 0.6);
      });
      notify('info', `Bel berbunyi: ${label}`);
    } catch {
      notify('info', `Bel berbunyi: ${label}`);
    }
  };

  const openSlotModal = (dayOfWeek: number, periodNumber: number, existing?: ScheduleRow) => {
    setForm({
      dayOfWeek,
      periodNumber,
      subjectId: existing?.subjectId ? String(existing.subjectId) : subjects[0] ? String(subjects[0].id) : '',
      teacherId: existing?.teacherId
        ? String(existing.teacherId)
        : selectedClass?.homeroomTeacherId
        ? String(selectedClass.homeroomTeacherId)
        : '',
      activityLabel: existing?.activityLabel || '',
    });
    setModalOpen(true);
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    const bell = bells.find((b) => b.periodNumber === Number(form.periodNumber));
    const res = await fetch('/api/academics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'schedule',
        classId: selectedClass.id,
        dayOfWeek: Number(form.dayOfWeek),
        periodNumber: Number(form.periodNumber),
        startTime: bell?.startTime || '07:00',
        endTime: bell?.endTime || '07:35',
        subjectId: form.subjectId ? Number(form.subjectId) : null,
        teacherId: form.teacherId ? Number(form.teacherId) : null,
        activityLabel: form.activityLabel,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan slot jadwal.');
      return;
    }
    setModalOpen(false);
    notify('success', 'Slot jadwal pelajaran disimpan.');
    await loadData();
  };

  const handleDeleteSlot = async (id: number) => {
    const res = await fetch(`/api/academics?kind=schedule&id=${id}`, {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (res.ok) {
      notify('success', 'Slot jadwal dihapus.');
      await loadData();
    }
  };

  return (
    <AppShell title="Jadwal & Bel" requiredModule="jadwal">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-lg font-bold text-slate-900 dark:text-slate-100">
              Jadwal Pelajaran Mingguan — Kelas {selectedClass?.name}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Deteksi otomatis bentrok jadwal guru antar rombel serta simulasi bel pergantian jam sekolah.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => playBellSound('Bel Pergantian Jam Pelajaran')}
            >
              <Volume2 className="w-4 h-4" />
              Bunyikan Bel
            </Button>
            {canManageSchedule && (
              <Button size="sm" onClick={() => openSlotModal(1, 1)}>
                <Plus className="w-4 h-4" />
                Atur Slot Jadwal
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={8} />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Weekly Timetable Matrix */}
            <div className="xl:col-span-9 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-[#0F2942] dark:text-blue-400" />
                  Matriks Jadwal Senin – Sabtu
                </span>
                <span className="text-[11px] text-slate-500">Klik sel untuk mengisi atau mengubah</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold w-28">Jam / Waktu</th>
                      {DAYS.map((d) => (
                        <th key={d.id} className="py-2.5 px-3 font-semibold min-w-[130px]">
                          {d.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {bells.map((bell) => (
                      <tr key={bell.id} className={bell.isBreak ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''}>
                        <td className="py-2.5 px-3 align-top">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {bell.label}
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-500">
                            {bell.startTime}–{bell.endTime}
                          </div>
                        </td>
                        {DAYS.map((day) => {
                          if (bell.isBreak) {
                            return (
                              <td
                                key={day.id}
                                className="py-2.5 px-3 text-[11px] text-amber-700 dark:text-amber-300 font-medium"
                              >
                                Istirahat
                              </td>
                            );
                          }
                          const slot = schedules.find(
                            (s) => s.dayOfWeek === day.id && s.periodNumber === bell.periodNumber
                          );
                          const sub = subjects.find((s) => s.id === slot?.subjectId);
                          const tchr = teachers.find((t) => t.id === slot?.teacherId);
                          return (
                            <td key={day.id} className="py-2 px-2.5 align-top">
                              {slot ? (
                                <div className="group p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 hover:border-[#1D4ED8] transition-colors">
                                  <div className="flex items-start justify-between gap-1">
                                    {canManageSchedule ? (
                                      <button
                                        type="button"
                                        onClick={() => openSlotModal(day.id, bell.periodNumber, slot)}
                                        className="text-left flex-1 cursor-pointer"
                                      >
                                        <p className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                                          {sub?.name || slot.activityLabel || 'Kegiatan'}
                                        </p>
                                        {tchr && (
                                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                            {tchr.fullName}
                                          </p>
                                        )}
                                      </button>
                                    ) : (
                                      <div className="text-left flex-1">
                                        <p className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                                          {sub?.name || slot.activityLabel || 'Kegiatan'}
                                        </p>
                                        {tchr && (
                                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                            {tchr.fullName}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    {canDeleteSchedule && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSlot(slot.id)}
                                        className="text-slate-400 hover:text-red-600 p-0.5 cursor-pointer"
                                        aria-label="Hapus slot"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : canManageSchedule ? (
                                <button
                                  type="button"
                                  onClick={() => openSlotModal(day.id, bell.periodNumber)}
                                  className="w-full h-11 rounded border border-dashed border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 hover:text-[#1D4ED8] hover:border-[#1D4ED8]/50 transition-colors cursor-pointer"
                                >
                                  + Isi
                                </button>
                              ) : (
                                <div className="w-full h-11 flex items-center justify-center text-[11px] text-slate-300 dark:text-slate-700">
                                  -
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bell Schedule Panel */}
            <div className="xl:col-span-3 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 h-fit">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-[#0F2942] dark:text-blue-400" />
                  Konfigurasi Bel
                </h2>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {bells.map((b) => (
                  <div key={b.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">{b.label}</p>
                      <p className="text-[11px] font-mono tabular-nums text-slate-500">
                        {b.startTime} – {b.endTime}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => playBellSound(`${b.label} (${b.startTime})`)}
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium cursor-pointer"
                    >
                      Uji
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Atur Jadwal Pelajaran">
        <form onSubmit={handleSaveSlot} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Hari"
              value={form.dayOfWeek}
              onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
            >
              {DAYS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
            <Select
              label="Jam Pelajaran"
              value={form.periodNumber}
              onChange={(e) => setForm({ ...form, periodNumber: Number(e.target.value) })}
            >
              {bells
                .filter((b) => !b.isBreak)
                .map((b) => (
                  <option key={b.id} value={b.periodNumber}>
                    {b.label} ({b.startTime}–{b.endTime})
                  </option>
                ))}
            </Select>
          </div>

          <Select
            label="Mata Pelajaran"
            value={form.subjectId}
            onChange={(e) => {
              const sid = Number(e.target.value);
              const sub = subjects.find((s) => s.id === sid);
              setForm({
                ...form,
                subjectId: e.target.value,
                teacherId: sub?.teacherId ? String(sub.teacherId) : form.teacherId,
              });
            }}
          >
            <option value="">-- Kegiatan Non-Mapel (Upacara/Literasi) --</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>

          <Select
            label="Guru Pengajar"
            value={form.teacherId}
            onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
          >
            <option value="">-- Pilih Guru --</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </Select>

          <Input
            label="Keterangan Tambahan / Kegiatan Khusus"
            placeholder="Contoh: Upacara Bendera / Pembiasaan Literasi"
            value={form.activityLabel}
            onChange={(e) => setForm({ ...form, activityLabel: e.target.value })}
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit">Simpan Jadwal</Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
