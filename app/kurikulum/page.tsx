'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, Plus, Sparkles, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import {
  AlertBox,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  TabBar,
  TableSkeleton,
} from '@/components/ui/Primitives';
import { formatIndoDate } from '@/lib/utils';

interface SubjectRow {
  id: number;
  code: string;
  name: string;
  category: string;
  gradeLevel: number;
  fase: string;
  kkm: number;
  weeklyHours: number;
  teacherId: number | null;
  teacherName: string | null;
}

interface LearningOutcomeRow {
  id: number;
  subjectId: number;
  fase: string;
  code: string;
  element: string;
  description: string;
}

interface LearningObjectiveRow {
  id: number;
  subjectId: number;
  semesterId: number;
  code: string;
  scopeMaterial: string;
  description: string;
  atpOrder: number;
  kktpThreshold: number;
}

interface RpmPlanRow {
  id: number;
  subjectId: number;
  classId: number;
  cpText: string;
  scopeMaterial: string;
  dimensionsJson: string;
  studentCharacteristics: string;
  identificationJson: string;
  designJson: string;
  experienceJson: string;
  assessmentJson: string;
  status: string;
  createdAt: string;
}

interface TeacherOption {
  id: number;
  fullName: string;
}

const DIMENSI_PROFIL = [
  'Keimanan & Ketakwaan',
  'Kewargaan',
  'Penalaran Kritis',
  'Kreativitas',
  'Kolaborasi',
  'Kemandirian',
  'Kesehatan',
  'Komunikasi',
];

function KurikulumInner() {
  const searchParams = useSearchParams();
  const { selectedClassId, selectedClass, school, notify, can } = useApp();
  const [tab, setTab] = useState<'mapel' | 'cptp' | 'rpm'>('mapel');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'mapel' || t === 'cptp' || t === 'rpm') {
      Promise.resolve().then(() => setTab(t));
    }
  }, [searchParams]);

  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [learningOutcomes, setLearningOutcomes] = useState<LearningOutcomeRow[]>([]);
  const [learningObjectives, setLearningObjectives] = useState<LearningObjectiveRow[]>([]);
  const [rpmPlans, setRpmPlans] = useState<RpmPlanRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number>(0);

  // Subject Modal
  const [subjectModal, setSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectRow | null>(null);
  const [subjectForm, setSubjectForm] = useState({
    code: '',
    name: '',
    category: 'Wajib',
    gradeLevel: 4,
    kkm: 75,
    weeklyHours: 4,
    teacherId: '',
  });

  // CP & TP Modals
  const [cpModal, setCpModal] = useState(false);
  const [cpForm, setCpForm] = useState({ code: '', element: '', description: '' });

  const [tpModal, setTpModal] = useState(false);
  const [tpForm, setTpForm] = useState({
    code: '',
    scopeMaterial: '',
    description: '',
    atpOrder: 1,
    kktpThreshold: 75,
  });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'subject' | 'tp'; id: number; label: string } | null>(null);

  // RPM Builder
  const [rpmForm, setRpmForm] = useState({
    scopeMaterial: '',
    cpText: '',
    studentCharacteristics: 'Murid memiliki gaya belajar visual, kinestetik, dan membutuhkan contoh kontekstual.',
    pedagogicalPractice: 'Pembelajaran Berbasis Masalah & Inkuiri Terbimbing',
    learningEnvironment: 'Ruang kelas kolaboratif dan lingkungan sekolah',
    experienceSummary: 'Memahami konsep inti, mengaplikasikan melalui proyek kelompok, dan merefleksikan proses belajar.',
    assessmentSummary: 'Asesmen diagnostik awal, observasi diskusi formatif, dan kuis sumatif akhir materi.',
    dimensions: ['Penalaran Kritis', 'Kolaborasi'] as string[],
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraftText, setAiDraftText] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const query = selectedClassId ? `&classId=${selectedClassId}` : '';
    const [acadRes, teachRes] = await Promise.all([
      fetch(`/api/academics?module=kurikulum${query}`, { cache: 'no-store' }),
      fetch('/api/teachers', { cache: 'no-store' }),
    ]);

    if (acadRes.ok) {
      const json = await acadRes.json();
      const subs: SubjectRow[] = json.subjects || [];
      setSubjects(subs);
      setLearningOutcomes(json.learningOutcomes || []);
      setLearningObjectives(json.learningObjectives || []);
      setRpmPlans(json.rpmPlans || []);
      setSelectedSubjectId((prev) =>
        prev && subs.some((s) => s.id === prev) ? prev : subs[0]?.id || 0
      );
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

  const activeSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0] || null;
  const activeCps = learningOutcomes.filter((cp) => cp.subjectId === activeSubject?.id);
  const activeTps = learningObjectives.filter((tp) => tp.subjectId === activeSubject?.id);

  const openCreateSubject = () => {
    setEditingSubject(null);
    setSubjectForm({
      code: '',
      name: '',
      category: 'Wajib',
      gradeLevel: selectedClass?.gradeLevel || 4,
      kkm: 75,
      weeklyHours: 4,
      teacherId: teachers[0] ? String(teachers[0].id) : '',
    });
    setSubjectModal(true);
  };

  const openEditSubject = (sub: SubjectRow) => {
    setEditingSubject(sub);
    setSubjectForm({
      code: sub.code,
      name: sub.name,
      category: sub.category,
      gradeLevel: sub.gradeLevel,
      kkm: sub.kkm,
      weeklyHours: sub.weeklyHours,
      teacherId: sub.teacherId ? String(sub.teacherId) : '',
    });
    setSubjectModal(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/academics', {
      method: editingSubject ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'subject',
        id: editingSubject?.id,
        code: subjectForm.code,
        name: subjectForm.name,
        category: subjectForm.category,
        gradeLevel: Number(subjectForm.gradeLevel),
        kkm: Number(subjectForm.kkm),
        weeklyHours: Number(subjectForm.weeklyHours),
        teacherId: subjectForm.teacherId ? Number(subjectForm.teacherId) : null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan mata pelajaran.');
      return;
    }
    setSubjectModal(false);
    notify('success', editingSubject ? 'Mata pelajaran diperbarui.' : 'Mata pelajaran ditambahkan.');
    await loadData();
  };

  const handleSaveCp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubject) return;
    const res = await fetch('/api/academics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'cp',
        subjectId: activeSubject.id,
        fase: activeSubject.fase,
        ...cpForm,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal menambahkan Capaian Pembelajaran.');
      return;
    }
    setCpModal(false);
    setCpForm({ code: '', element: '', description: '' });
    notify('success', 'Capaian Pembelajaran ditambahkan.');
    await loadData();
  };

  const handleSaveTp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubject) return;
    const res = await fetch('/api/academics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'tp',
        subjectId: activeSubject.id,
        code: tpForm.code,
        scopeMaterial: tpForm.scopeMaterial,
        description: tpForm.description,
        atpOrder: Number(tpForm.atpOrder),
        kktpThreshold: Number(tpForm.kktpThreshold),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal menambahkan Tujuan Pembelajaran.');
      return;
    }
    setTpModal(false);
    setTpForm({ code: '', scopeMaterial: '', description: '', atpOrder: activeTps.length + 2, kktpThreshold: 75 });
    notify('success', 'Tujuan Pembelajaran (TP) ditambahkan.');
    await loadData();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/academics?kind=${deleteTarget.kind}&id=${deleteTarget.id}`, {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (res.ok) {
      notify('success', `${deleteTarget.label} berhasil dihapus.`);
      setDeleteTarget(null);
      await loadData();
    } else {
      const json = await res.json().catch(() => ({}));
      notify('error', json.error || 'Gagal menghapus data.');
    }
  };

  const handleGenerateAiDraft = async (taskType: 'tp' | 'rpm') => {
    if (!activeSubject) return;
    const topic = taskType === 'tp' ? tpForm.scopeMaterial || activeSubject.name : rpmForm.scopeMaterial || activeSubject.name;
    setAiLoading(true);
    setAiDraftText('');
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        taskType,
        subjectName: activeSubject.name,
        gradeLevel: activeSubject.gradeLevel,
        fase: activeSubject.fase,
        topic,
        cpText: activeCps[0]?.description || rpmForm.cpText,
        dimensions: rpmForm.dimensions,
      }),
    });
    const json = await res.json();
    setAiLoading(false);
    if (!res.ok) {
      notify('error', json.error || 'Asisten AI belum tersedia.');
      return;
    }
    if (taskType === 'tp') {
      setTpForm((prev) => ({ ...prev, description: json.text.slice(0, 350) }));
      notify('success', 'Draf TP berhasil disusun oleh Asisten AI.');
    } else {
      setAiDraftText(json.text);
      setRpmForm((prev) => ({
        ...prev,
        experienceSummary: json.text.slice(0, 600),
      }));
      notify('success', 'Draf RPM berhasil disusun oleh Asisten AI.');
    }
  };

  const handleSaveRpm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubject || !selectedClass) return;
    const res = await fetch('/api/academics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'rpm',
        subjectId: activeSubject.id,
        classId: selectedClass.id,
        cpText: rpmForm.cpText || activeCps[0]?.description || activeSubject.name,
        scopeMaterial: rpmForm.scopeMaterial,
        tpIds: activeTps.map((t) => t.id),
        dimensions: rpmForm.dimensions,
        studentCharacteristics: rpmForm.studentCharacteristics,
        identification: { dimensi: rpmForm.dimensions },
        design: {
          praktikPedagogis: rpmForm.pedagogicalPractice,
          lingkunganBelajar: rpmForm.learningEnvironment,
        },
        experience: { ringkasan: rpmForm.experienceSummary },
        assessment: { ringkasan: rpmForm.assessmentSummary },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan Rencana Pembelajaran Mendalam.');
      return;
    }
    notify('success', 'Rencana Pembelajaran Mendalam (RPM) berhasil disimpan.');
    setRpmForm((prev) => ({ ...prev, scopeMaterial: '' }));
    setAiDraftText('');
    await loadData();
  };

  return (
    <AppShell title="Kurikulum & RPM" requiredModule="kurikulum">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-lg font-bold text-slate-900 dark:text-slate-100">
              Kurikulum & RPM — Kelas {selectedClass?.name} (Fase {selectedClass?.fase})
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pengelolaan mata pelajaran, Capaian Pembelajaran (CP), TP/ATP, dan Rencana Pembelajaran Mendalam.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tab === 'mapel' && can('kurikulum', 'create') && (
              <Button size="sm" onClick={openCreateSubject}>
                <Plus className="w-4 h-4" />
                Tambah Mapel
              </Button>
            )}
            {tab === 'cptp' && activeSubject && can('kurikulum', 'create') && (
              <>
                <Button size="sm" variant="outline" onClick={() => setCpModal(true)}>
                  <Plus className="w-4 h-4" />
                  Tambah CP
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setTpForm({
                      code: `TP.${activeSubject.gradeLevel}.${activeTps.length + 1}`,
                      scopeMaterial: '',
                      description: '',
                      atpOrder: activeTps.length + 1,
                      kktpThreshold: activeSubject.kkm,
                    });
                    setTpModal(true);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Tambah TP / ATP
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabBar
            items={[
              { id: 'mapel', label: `Mata Pelajaran (${subjects.length})` },
              { id: 'cptp', label: 'CP & TP/ATP' },
              { id: 'rpm', label: `RPM (${rpmPlans.length})` },
            ]}
            activeId={tab}
            onChange={(id) => setTab(id as 'mapel' | 'cptp' | 'rpm')}
          />

          {tab === 'cptp' && (
            <div className="w-full sm:w-72 shrink-0">
              <Select
                aria-label="Pilih Mata Pelajaran"
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : tab === 'mapel' ? (
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table text-left text-xs">
                <thead>
                  <tr className="text-slate-600 dark:text-slate-300">
                    <th className="py-3 px-3 font-semibold w-10 col-id">No</th>
                    <th className="py-3 px-3 font-semibold col-id col-cell-div">Kode</th>
                    <th className="py-3 px-3 font-semibold col-id col-cell-div">Mata Pelajaran</th>
                    <th className="py-3 px-3 font-semibold col-a col-sep">Kategori</th>
                    <th className="py-3 px-3 font-semibold col-a col-cell-div">Guru Pengampu</th>
                    <th className="py-3 px-3 font-semibold text-right col-total col-sep">KKTP</th>
                    <th className="py-3 px-3 font-semibold text-right col-total col-cell-div">
                      JP / Minggu
                    </th>
                    <th className="py-3 px-3 font-semibold text-right col-action col-sep">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((sub, idx) => (
                    <tr key={sub.id}>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 col-id">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300 col-id col-cell-div">
                        {sub.code}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100 col-id col-cell-div">
                        {sub.name}
                      </td>
                      <td className="py-2.5 px-3 col-a col-sep">{sub.category}</td>
                      <td className="py-2.5 px-3 col-a col-cell-div">
                        {sub.teacherName || 'Guru Kelas'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold col-total col-sep">
                        {sub.kkm}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums col-total col-cell-div">
                        {sub.weeklyHours} JP
                      </td>
                      <td className="py-2.5 px-3 text-right col-action col-sep">
                        <div className="inline-flex items-center gap-1">
                          {can('kurikulum', 'update') && (
                            <button
                              type="button"
                              onClick={() => openEditSubject(sub)}
                              className="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-[#0F2942] dark:text-blue-400 font-medium cursor-pointer"
                            >
                              Ubah
                            </button>
                          )}
                          {can('kurikulum', 'delete') && (
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({ kind: 'subject', id: sub.id, label: sub.name })
                              }
                              className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                              aria-label={`Hapus ${sub.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'cptp' ? (
          <div className="space-y-4">
            {/* CP List */}
            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Capaian Pembelajaran (CP) — {activeSubject?.name}
              </h2>
              {activeCps.length === 0 ? (
                <EmptyState
                  title="Belum ada Capaian Pembelajaran"
                  description="Tambahkan elemen CP resmi Kurikulum Merdeka untuk mata pelajaran ini."
                />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeCps.map((cp) => (
                    <div key={cp.id} className="py-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#0F2942] dark:text-blue-400">
                        <span className="font-mono">{cp.code}</span>
                        <span>·</span>
                        <span>Elemen: {cp.element}</span>
                        <span>·</span>
                        <span>Fase {cp.fase}</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                        {cp.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TP / ATP Table */}
            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Alur Tujuan Pembelajaran (ATP) & KKTP
                </h2>
                <span className="text-xs text-slate-500 tabular-nums">{activeTps.length} Tujuan</span>
              </div>
              {activeTps.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="Belum ada Tujuan Pembelajaran"
                    description="Klik Tambah TP / ATP untuk menyusun alur tujuan pembelajaran semester aktif."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table text-left text-xs">
                    <thead>
                      <tr className="text-slate-600 dark:text-slate-300">
                        <th className="py-3 px-3 font-semibold w-14 col-id">Urut</th>
                        <th className="py-3 px-3 font-semibold w-28 col-id col-cell-div">Kode TP</th>
                        <th className="py-3 px-3 font-semibold col-a col-sep">Lingkup Materi</th>
                        <th className="py-3 px-3 font-semibold col-b col-sep">
                          Rumusan Tujuan Pembelajaran
                        </th>
                        <th className="py-3 px-3 font-semibold text-right col-total col-sep">
                          KKTP
                        </th>
                        <th className="py-3 px-3 font-semibold text-right col-action col-sep">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTps.map((tp) => (
                        <tr key={tp.id}>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 col-id">
                            #{tp.atpOrder}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums font-medium col-id col-cell-div">
                            {tp.code}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100 col-a col-sep">
                            {tp.scopeMaterial}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 leading-relaxed col-b col-sep">
                            {tp.description}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold col-total col-sep">
                            {tp.kktpThreshold}
                          </td>
                          <td className="py-2.5 px-3 text-right col-action col-sep">
                            {can('kurikulum', 'delete') && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({ kind: 'tp', id: tp.id, label: tp.code })
                                }
                                className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                                aria-label={`Hapus ${tp.code}`}
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
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form
              onSubmit={handleSaveRpm}
              className="lg:col-span-7 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#0F2942] dark:text-blue-400" />
                  Penyusunan Rencana Pembelajaran Mendalam (RPM)
                </h2>
                {school?.enableAi && can('ai', 'create') && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={aiLoading}
                    onClick={() => handleGenerateAiDraft('rpm')}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#1D4ED8]" />
                    Bantu Draf AI
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Mata Pelajaran"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Lingkup Materi / Topik Inti"
                  placeholder="Contoh: Pecahan Senilai dan Operasi Hitung"
                  value={rpmForm.scopeMaterial}
                  onChange={(e) => setRpmForm({ ...rpmForm, scopeMaterial: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Dimensi Profil Lulusan (8 DPL)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DIMENSI_PROFIL.map((dim) => {
                    const checked = rpmForm.dimensions.includes(dim);
                    return (
                      <label
                        key={dim}
                        className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setRpmForm((prev) => ({
                              ...prev,
                              dimensions: checked
                                ? prev.dimensions.filter((d) => d !== dim)
                                : [...prev.dimensions, dim],
                            }))
                          }
                          className="rounded border-slate-300"
                        />
                        <span className="truncate">{dim}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Praktik Pedagogis"
                  value={rpmForm.pedagogicalPractice}
                  onChange={(e) => setRpmForm({ ...rpmForm, pedagogicalPractice: e.target.value })}
                />
                <Input
                  label="Lingkungan Belajar"
                  value={rpmForm.learningEnvironment}
                  onChange={(e) => setRpmForm({ ...rpmForm, learningEnvironment: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Pengalaman Belajar (Memahami, Mengaplikasi, Merefleksi)
                </label>
                <textarea
                  rows={4}
                  value={rpmForm.experienceSummary}
                  onChange={(e) => setRpmForm({ ...rpmForm, experienceSummary: e.target.value })}
                  className="w-full p-3 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Rencana Asesmen (Awal, Proses, Akhir)
                </label>
                <textarea
                  rows={2}
                  value={rpmForm.assessmentSummary}
                  onChange={(e) => setRpmForm({ ...rpmForm, assessmentSummary: e.target.value })}
                  className="w-full p-3 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
                  required
                />
              </div>

              {aiDraftText && (
                <AlertBox variant="info" title="Catatan Draf AI (Tanpa Data Pribadi Murid)">
                  <pre className="whitespace-pre-wrap font-sans text-xs max-h-40 overflow-y-auto">
                    {aiDraftText}
                  </pre>
                </AlertBox>
              )}

              {can('kurikulum', 'create') && (
                <div className="flex justify-end">
                  <Button type="submit">Simpan Dokumen RPM</Button>
                </div>
              )}
            </form>

            <div className="lg:col-span-5 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Arsip RPM Kelas {selectedClass?.name}
              </h2>
              {rpmPlans.length === 0 ? (
                <EmptyState
                  title="Belum ada dokumen RPM"
                  description="Gunakan formulir di samping untuk menyusun dan menyimpan Rencana Pembelajaran Mendalam."
                />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rpmPlans.map((r) => {
                    const sub = subjects.find((s) => s.id === r.subjectId);
                    const dims: string[] = JSON.parse(r.dimensionsJson || '[]');
                    return (
                      <div key={r.id} className="py-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {r.scopeMaterial || 'Topik Pembelajaran'}
                          </span>
                          <span className="text-[11px] tabular-nums whitespace-nowrap text-slate-500">
                            {formatIndoDate(r.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {sub?.name || 'Mata Pelajaran'} · Status: {r.status}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Dimensi: {dims.join(', ') || '-'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Mata Pelajaran */}
      <Modal
        open={subjectModal}
        onClose={() => setSubjectModal(false)}
        title={editingSubject ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
      >
        <form onSubmit={handleSaveSubject} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Kode Mapel"
              placeholder="MTK-4"
              value={subjectForm.code}
              onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
              required
            />
            <Select
              label="Kategori"
              value={subjectForm.category}
              onChange={(e) => setSubjectForm({ ...subjectForm, category: e.target.value })}
            >
              <option value="Wajib">Wajib</option>
              <option value="Muatan Lokal">Muatan Lokal</option>
              <option value="Pilihan">Pilihan</option>
            </Select>
          </div>
          <Input
            label="Nama Mata Pelajaran"
            value={subjectForm.name}
            onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Tingkat Kelas"
              type="number"
              min={1}
              max={12}
              value={subjectForm.gradeLevel}
              onChange={(e) => setSubjectForm({ ...subjectForm, gradeLevel: Number(e.target.value) })}
              required
            />
            <Input
              label="KKTP Min"
              type="number"
              min={0}
              max={100}
              value={subjectForm.kkm}
              onChange={(e) => setSubjectForm({ ...subjectForm, kkm: Number(e.target.value) })}
              required
            />
            <Input
              label="JP / Minggu"
              type="number"
              min={1}
              max={20}
              value={subjectForm.weeklyHours}
              onChange={(e) => setSubjectForm({ ...subjectForm, weeklyHours: Number(e.target.value) })}
              required
            />
          </div>
          <Select
            label="Guru Pengampu"
            value={subjectForm.teacherId}
            onChange={(e) => setSubjectForm({ ...subjectForm, teacherId: e.target.value })}
          >
            <option value="">-- Sesuai Wali Kelas --</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSubjectModal(false)}>
              Batal
            </Button>
            <Button type="submit">Simpan Mata Pelajaran</Button>
          </div>
        </form>
      </Modal>

      {/* Modal CP */}
      <Modal open={cpModal} onClose={() => setCpModal(false)} title="Tambah Capaian Pembelajaran (CP)">
        <form onSubmit={handleSaveCp} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Kode CP"
              placeholder="CP-MTK-B1"
              value={cpForm.code}
              onChange={(e) => setCpForm({ ...cpForm, code: e.target.value })}
              required
            />
            <Input
              label="Elemen CP"
              placeholder="Bilangan / Aljabar"
              value={cpForm.element}
              onChange={(e) => setCpForm({ ...cpForm, element: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Deskripsi Capaian Pembelajaran
            </label>
            <textarea
              rows={4}
              value={cpForm.description}
              onChange={(e) => setCpForm({ ...cpForm, description: e.target.value })}
              className="w-full p-3 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-md"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCpModal(false)}>
              Batal
            </Button>
            <Button type="submit">Simpan CP</Button>
          </div>
        </form>
      </Modal>

      {/* Modal TP */}
      <Modal open={tpModal} onClose={() => setTpModal(false)} title="Tambah Tujuan Pembelajaran (TP/ATP)">
        <form onSubmit={handleSaveTp} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Kode TP"
              value={tpForm.code}
              onChange={(e) => setTpForm({ ...tpForm, code: e.target.value })}
              required
            />
            <Input
              label="Urutan ATP"
              type="number"
              min={1}
              value={tpForm.atpOrder}
              onChange={(e) => setTpForm({ ...tpForm, atpOrder: Number(e.target.value) })}
              required
            />
            <Input
              label="KKTP TP"
              type="number"
              min={0}
              max={100}
              value={tpForm.kktpThreshold}
              onChange={(e) => setTpForm({ ...tpForm, kktpThreshold: Number(e.target.value) })}
              required
            />
          </div>
          <Input
            label="Lingkup Materi"
            placeholder="Contoh: Pecahan Desimal"
            value={tpForm.scopeMaterial}
            onChange={(e) => setTpForm({ ...tpForm, scopeMaterial: e.target.value })}
            required
          />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Rumusan Tujuan Pembelajaran
              </label>
              {school?.enableAi && can('ai', 'create') && (
                <button
                  type="button"
                  onClick={() => handleGenerateAiDraft('tp')}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1D4ED8] hover:underline cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  {aiLoading ? 'Menyusun...' : 'Susun dengan AI'}
                </button>
              )}
            </div>
            <textarea
              rows={3}
              value={tpForm.description}
              onChange={(e) => setTpForm({ ...tpForm, description: e.target.value })}
              className="w-full p-3 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-md"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTpModal(false)}>
              Batal
            </Button>
            <Button type="submit">Simpan TP</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Konfirmasi Penghapusan"
        message={`Apakah Anda yakin ingin menghapus "${deleteTarget?.label}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus"
        danger
      />
    </AppShell>
  );
}

export default function KurikulumPage() {
  return (
    <Suspense fallback={<AppShell title="Kurikulum & Perencanaan" requiredModule="kurikulum"><TableSkeleton rows={8} /></AppShell>}>
      <KurikulumInner />
    </Suspense>
  );
}
