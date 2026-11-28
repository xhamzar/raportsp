'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ListOrdered,
  Pencil,
  Plus,
  Sparkles,
  SquarePen,
  Trash2,
} from 'lucide-react';
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
  sortOrder: number;
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

function formatCategoryLabel(category: string): string {
  if (category === 'Wajib') return 'Mata Pelajaran Wajib';
  if (category === 'Pilihan') return 'Mata Pelajaran Pilihan';
  if (category === 'Muatan Lokal') return 'Muatan Lokal';
  return category;
}

export function IntrakurikulerManager({
  pageTitle = 'Mata Pelajaran Intrakurikuler',
}: {
  pageTitle?: string;
}) {
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

  // Reorder state
  const [isReordering, setIsReordering] = useState(false);
  const [reorderedSubjects, setReorderedSubjects] = useState<SubjectRow[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  // Dropdown menu near Tambah Mapel
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  // Subject Add / Edit Modal
  const [subjectModal, setSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectRow | null>(null);
  const [savingSubject, setSavingSubject] = useState(false);
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    kkm: '',
    code: '',
    category: '',
    weeklyHours: '2',
    teacherId: '',
  });

  // Row Edit TP Modal
  const [tpSubject, setTpSubject] = useState<SubjectRow | null>(null);
  const [editingTpId, setEditingTpId] = useState<number | null>(null);
  const [tpRowForm, setTpRowForm] = useState({
    code: '',
    scopeMaterial: '',
    description: '',
    atpOrder: 1,
    kktpThreshold: 75,
  });
  const [savingTp, setSavingTp] = useState(false);

  // Standalone CP & TP Modals on CP/ATP tab
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
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'subject' | 'tp';
    id: number;
    label: string;
  } | null>(null);

  // RPM Builder
  const [rpmForm, setRpmForm] = useState({
    scopeMaterial: '',
    cpText: '',
    studentCharacteristics:
      'Murid memiliki gaya belajar visual, kinestetik, dan membutuhkan contoh kontekstual.',
    pedagogicalPractice: 'Pembelajaran Berbasis Masalah & Inkuiri Terbimbing',
    learningEnvironment: 'Ruang kelas kolaboratif dan lingkungan sekolah',
    experienceSummary:
      'Memahami konsep inti, mengaplikasikan melalui proyek kelompok, dan merefleksikan proses belajar.',
    assessmentSummary:
      'Asesmen diagnostik awal, observasi diskusi formatif, dan kuis sumatif akhir materi.',
    dimensions: ['Penalaran Kritis', 'Kolaborasi'] as string[],
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDraftText, setAiDraftText] = useState('');
  const [aiKeyStatus, setAiKeyStatus] = useState<{
    checked: boolean;
    apiConfigured: boolean;
    canUseSchoolKey: boolean;
  }>({ checked: false, apiConfigured: false, canUseSchoolKey: false });

  const loadData = useCallback(async () => {
    setLoading(true);
    const query = selectedClassId ? `&classId=${selectedClassId}` : '';
    const [acadRes, teachRes, aiRes] = await Promise.all([
      fetch(`/api/academics?module=kurikulum${query}`, { cache: 'no-store' }),
      fetch('/api/teachers', { cache: 'no-store' }),
      fetch('/api/ai', { cache: 'no-store' }).catch(() => null),
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
    if (aiRes && aiRes.ok) {
      const aJson = await aiRes.json().catch(() => ({}));
      setAiKeyStatus({
        checked: true,
        apiConfigured: Boolean(aJson.apiConfigured),
        canUseSchoolKey: Boolean(aJson.canUseSchoolKey),
      });
    } else {
      setAiKeyStatus((prev) => ({ ...prev, checked: true }));
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

  // KPI counts
  const countWajib = subjects.filter((s) => s.category === 'Wajib').length;
  const countPilihan = subjects.filter((s) => s.category === 'Pilihan').length;
  const countMulok = subjects.filter((s) => s.category === 'Muatan Lokal').length;
  const countTotal = subjects.length;

  const displayedSubjects = isReordering ? reorderedSubjects : subjects;

  const startReorder = () => {
    setReorderedSubjects([...subjects]);
    setIsReordering(true);
  };

  const moveSubject = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= reorderedSubjects.length) return;
    const copy = [...reorderedSubjects];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    setReorderedSubjects(copy);
  };

  const handleSaveOrder = async () => {
    setSavingOrder(true);
    const res = await fetch('/api/academics', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'subject_reorder',
        orderedIds: reorderedSubjects.map((s) => s.id),
      }),
    });
    setSavingOrder(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      notify('error', json.error || 'Gagal menyimpan urutan mata pelajaran.');
      return;
    }
    setIsReordering(false);
    notify('success', 'Urutan mata pelajaran berhasil diperbarui.');
    await loadData();
  };

  const openCreateSubject = () => {
    setEditingSubject(null);
    setSubjectForm({
      name: '',
      kkm: '',
      code: '',
      category: '',
      weeklyHours: '2',
      teacherId: '',
    });
    setSubjectModal(true);
  };

  const openEditSubject = (sub: SubjectRow) => {
    setEditingSubject(sub);
    setSubjectForm({
      name: sub.name,
      kkm: String(sub.kkm),
      code: sub.code || '',
      category: sub.category,
      weeklyHours: String(sub.weeklyHours || 2),
      teacherId: sub.teacherId ? String(sub.teacherId) : '',
    });
    setSubjectModal(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.category) {
      notify('error', 'Pilih Jenis Mata Pelajaran terlebih dahulu.');
      return;
    }
    setSavingSubject(true);
    const kkmVal = subjectForm.kkm.trim() === '' ? 75 : Number(subjectForm.kkm);
    const payload = editingSubject
      ? {
          kind: 'subject',
          id: editingSubject.id,
          name: subjectForm.name.trim(),
          kkm: kkmVal,
          code: subjectForm.code.trim(),
          category: subjectForm.category,
          weeklyHours: Number(subjectForm.weeklyHours || 2),
          teacherId: subjectForm.teacherId ? Number(subjectForm.teacherId) : null,
        }
      : {
          kind: 'subject',
          name: subjectForm.name.trim(),
          kkm: kkmVal,
          code: subjectForm.code.trim(),
          category: subjectForm.category,
          gradeLevel: selectedClass?.gradeLevel || 4,
          weeklyHours: 2,
          teacherId: null,
        };

    const res = await fetch('/api/academics', {
      method: editingSubject ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify(payload),
    });
    setSavingSubject(false);
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan mata pelajaran.');
      return;
    }
    setSubjectModal(false);
    notify('success', editingSubject ? 'Mata pelajaran diperbarui.' : 'Mata pelajaran ditambahkan.');
    await loadData();
  };

  const openRowTpModal = (sub: SubjectRow) => {
    const subTps = learningObjectives.filter((tp) => tp.subjectId === sub.id);
    setTpSubject(sub);
    setEditingTpId(null);
    setTpRowForm({
      code: `TP.${sub.gradeLevel}.${subTps.length + 1}`,
      scopeMaterial: '',
      description: '',
      atpOrder: subTps.length + 1,
      kktpThreshold: sub.kkm || 75,
    });
  };

  const startEditRowTp = (tp: LearningObjectiveRow) => {
    setEditingTpId(tp.id);
    setTpRowForm({
      code: tp.code,
      scopeMaterial: tp.scopeMaterial,
      description: tp.description,
      atpOrder: tp.atpOrder,
      kktpThreshold: tp.kktpThreshold,
    });
  };

  const resetRowTpForm = (sub: SubjectRow) => {
    const subTps = learningObjectives.filter((tp) => tp.subjectId === sub.id);
    setEditingTpId(null);
    setTpRowForm({
      code: `TP.${sub.gradeLevel}.${subTps.length + 1}`,
      scopeMaterial: '',
      description: '',
      atpOrder: subTps.length + 1,
      kktpThreshold: sub.kkm || 75,
    });
  };

  const handleSaveRowTp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpSubject) return;
    setSavingTp(true);
    const res = await fetch('/api/academics', {
      method: editingTpId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'tp',
        id: editingTpId || undefined,
        subjectId: tpSubject.id,
        code: tpRowForm.code.trim(),
        scopeMaterial: tpRowForm.scopeMaterial.trim() || 'Umum',
        description: tpRowForm.description.trim(),
        atpOrder: Number(tpRowForm.atpOrder) || 1,
        kktpThreshold: Number(tpRowForm.kktpThreshold) || tpSubject.kkm || 75,
      }),
    });
    setSavingTp(false);
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan Tujuan Pembelajaran.');
      return;
    }
    notify('success', editingTpId ? 'Tujuan Pembelajaran diperbarui.' : 'Tujuan Pembelajaran ditambahkan.');
    await loadData();
    resetRowTpForm(tpSubject);
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
    setTpForm({
      code: '',
      scopeMaterial: '',
      description: '',
      atpOrder: activeTps.length + 2,
      kktpThreshold: 75,
    });
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

  const handleGenerateAiDraft = async (
    taskType: 'tp' | 'rpm',
    targetSubject?: SubjectRow | null,
    customTopic?: string
  ) => {
    const subj = targetSubject || activeSubject;
    if (!subj) return;
    const subjCps = learningOutcomes.filter((cp) => cp.subjectId === subj.id);
    const topic =
      taskType === 'tp'
        ? customTopic || tpForm.scopeMaterial || subj.name
        : rpmForm.scopeMaterial || subj.name;
    setAiLoading(true);
    setAiDraftText('');
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        taskType,
        subjectName: subj.name,
        gradeLevel: subj.gradeLevel,
        fase: subj.fase,
        topic,
        cpText: subjCps[0]?.description || rpmForm.cpText,
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
      if (targetSubject) {
        setTpRowForm((prev) => ({ ...prev, description: json.text.slice(0, 350) }));
      } else {
        setTpForm((prev) => ({ ...prev, description: json.text.slice(0, 350) }));
      }
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

  const tpModalList = tpSubject
    ? learningObjectives.filter((tp) => tp.subjectId === tpSubject.id)
    : [];

  return (
    <AppShell title={pageTitle} requiredModule="kurikulum">
      <div className="space-y-4">
        {/* Top Workspace View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabBar
            items={[
              { id: 'mapel', label: `Daftar Mapel (${subjects.length})` },
              { id: 'cptp', label: 'CP & ATP' },
              { id: 'rpm', label: `Perencanaan RPM (${rpmPlans.length})` },
            ]}
            activeId={tab}
            onChange={(id) => {
              setIsReordering(false);
              setTab(id as 'mapel' | 'cptp' | 'rpm');
            }}
          />

          {tab === 'cptp' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-64 shrink-0">
                <Select
                  aria-label="Pilih Mata Pelajaran"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.code ? ` (${s.code})` : ''}
                    </option>
                  ))}
                </Select>
              </div>
              {activeSubject && can('kurikulum', 'create') && (
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
                    Tambah TP
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={7} />
        ) : tab === 'mapel' ? (
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  Daftar Mata Pelajaran Intrakurikuler
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kelas aktif: {selectedClass?.name || '-'} · Fase {selectedClass?.fase || '-'}
                </p>
              </div>
              <Link
                href="/penilaian"
                className="text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap self-start sm:self-center"
              >
                Lanjut ke Penilaian →
              </Link>
            </div>

            {/* 4 KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 bg-slate-50/40 dark:bg-slate-900/20">
              <div className="p-3.5 sm:p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Mapel Wajib</p>
                <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {countWajib}
                </p>
              </div>
              <div className="p-3.5 sm:p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Mapel Pilihan</p>
                <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {countPilihan}
                </p>
              </div>
              <div className="p-3.5 sm:p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Muatan Lokal</p>
                <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {countMulok}
                </p>
              </div>
              <div className="p-3.5 sm:p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Mapel</p>
                <p className="mt-1 font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {countTotal}
                </p>
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                {can('kurikulum', 'update') && subjects.length > 1 && !isReordering && (
                  <Button size="sm" variant="outline" onClick={startReorder}>
                    <ListOrdered className="w-4 h-4" />
                    Edit Urutan
                  </Button>
                )}
                {isReordering && (
                  <>
                    <Button size="sm" loading={savingOrder} onClick={handleSaveOrder}>
                      <Check className="w-4 h-4" />
                      Simpan Urutan
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingOrder}
                      onClick={() => setIsReordering(false)}
                    >
                      Batal
                    </Button>
                  </>
                )}
              </div>

              {can('kurikulum', 'create') && !isReordering && (
                <div className="relative inline-flex items-center">
                  <Button
                    size="sm"
                    onClick={openCreateSubject}
                    className="rounded-r-none border-r border-white/20"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Mapel
                  </Button>
                  <button
                    type="button"
                    aria-label="Menu opsi kurikulum"
                    onClick={() => setActionMenuOpen((v) => !v)}
                    className="h-9 px-2.5 bg-[#0F2942] hover:bg-[#163859] dark:bg-[#1E3A5F] dark:hover:bg-[#2B4C7E] text-white rounded-r-md border-l border-white/15 cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {actionMenuOpen && (
                    <div className="absolute right-0 top-10 w-48 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-md shadow-lg z-20 py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActionMenuOpen(false);
                          setTab('cptp');
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Kelola CP & ATP
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActionMenuOpen(false);
                          setTab('rpm');
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Penyusunan RPM
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Subjects Table */}
            {displayedSubjects.length === 0 ? (
              <EmptyState
                title="Belum ada mata pelajaran untuk kelas ini"
                description="Klik Tambah Mapel untuk menambahkan mata pelajaran intrakurikuler dengan cepat."
                action={
                  can('kurikulum', 'create') ? (
                    <Button size="sm" onClick={openCreateSubject}>
                      <Plus className="w-4 h-4" />
                      Tambah Mapel Pertama
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="data-table text-left text-xs">
                    <thead>
                      <tr className="text-slate-600 dark:text-slate-300">
                        <th className="py-3 px-3 font-semibold w-12 col-id">No</th>
                        <th className="py-3 px-3 font-semibold col-id col-cell-div">
                          Mata Pelajaran
                        </th>
                        <th className="py-3 px-3 font-semibold col-a col-sep">Jenis Mapel</th>
                        <th className="py-3 px-3 font-semibold col-id col-cell-div">Kode</th>
                        <th className="py-3 px-3 font-semibold text-right col-total col-sep">KKM</th>
                        <th className="py-3 px-3 font-semibold col-b col-sep">
                          Tujuan Pembelajaran
                        </th>
                        <th className="py-3 px-3 font-semibold text-right col-action col-sep">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedSubjects.map((sub, idx) => {
                        const tpCount = learningObjectives.filter(
                          (tp) => tp.subjectId === sub.id
                        ).length;
                        const hasTp = tpCount > 0;
                        return (
                          <tr key={sub.id}>
                            <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 col-id">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100 col-id col-cell-div">
                              <div>{sub.name}</div>
                              {sub.teacherName && (
                                <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                  {sub.teacherName} · {sub.weeklyHours} JP
                                </p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 col-a col-sep whitespace-nowrap">
                              {formatCategoryLabel(sub.category)}
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300 col-id col-cell-div">
                              {sub.code || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold col-total col-sep">
                              {sub.kkm}
                            </td>
                            <td className="py-2.5 px-3 col-b col-sep">
                              <div className="inline-flex items-center gap-2">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                    hasTp ? 'bg-emerald-500' : 'bg-red-500'
                                  }`}
                                  title={
                                    hasTp
                                      ? `${tpCount} Tujuan Pembelajaran tersedia`
                                      : 'Belum ada Tujuan Pembelajaran'
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() => openRowTpModal(sub)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium whitespace-nowrap cursor-pointer transition-colors"
                                >
                                  <SquarePen className="w-3.5 h-3.5" />
                                  Edit TP
                                </button>
                                <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  {hasTp ? `${tpCount} TP` : 'Kosong'}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right col-action col-sep">
                              {isReordering ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => moveSubject(idx, -1)}
                                    aria-label={`Pindah ${sub.name} ke atas`}
                                    className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === displayedSubjects.length - 1}
                                    onClick={() => moveSubject(idx, 1)}
                                    aria-label={`Pindah ${sub.name} ke bawah`}
                                    className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  {can('kurikulum', 'update') && (
                                    <button
                                      type="button"
                                      onClick={() => openEditSubject(sub)}
                                      aria-label={`Edit ${sub.name}`}
                                      className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {can('kurikulum', 'delete') && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDeleteTarget({
                                          kind: 'subject',
                                          id: sub.id,
                                          label: sub.name,
                                        })
                                      }
                                      aria-label={`Hapus ${sub.name}`}
                                      className="p-1.5 rounded border border-red-200 dark:border-red-900/50 bg-red-50/60 hover:bg-red-100 dark:bg-red-950/30 text-red-600 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : tab === 'cptp' ? (
          <div className="space-y-4">
            {/* CP List */}
            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Capaian Pembelajaran (CP) — {activeSubject?.name || '-'}
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
                <span className="text-xs text-slate-500 tabular-nums">
                  {activeTps.length} Tujuan
                </span>
              </div>
              {activeTps.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="Belum ada Tujuan Pembelajaran"
                    description="Klik Tambah TP untuk menyusun alur tujuan pembelajaran semester aktif."
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
                    disabled={aiKeyStatus.checked && !aiKeyStatus.apiConfigured}
                    onClick={() => handleGenerateAiDraft('rpm')}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#1D4ED8]" />
                    Bantu Draf AI
                  </Button>
                )}
              </div>

              {school?.enableAi &&
                can('ai', 'create') &&
                aiKeyStatus.checked &&
                !aiKeyStatus.apiConfigured && (
                  <AlertBox variant="warning">
                    Belum ada kunci API. Fitur &quot;Generate&quot; belum dapat digunakan.{' '}
                    <Link
                      href={
                        aiKeyStatus.canUseSchoolKey
                          ? '/pengaturan?tab=kunci-api'
                          : '/pengaturan?tab=akun'
                      }
                      className="font-semibold underline hover:no-underline"
                    >
                      Atur Kunci API di Pengaturan
                    </Link>
                  </AlertBox>
                )}

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

      {/* Modal Tambah / Edit Mata Pelajaran */}
      <Modal
        open={subjectModal}
        onClose={() => setSubjectModal(false)}
        title={editingSubject ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
        subtitle={`Kelas aktif: ${selectedClass?.name || '-'}`}
      >
        <form onSubmit={handleSaveSubject} className="space-y-4">
          <Input
            label="Nama Mata Pelajaran"
            placeholder="Contoh: Ilmu Pengetahuan Alam dan Sosial"
            hint="Nama mata pelajaran jangan disingkat!"
            value={subjectForm.name}
            onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="KKM"
              type="number"
              min={0}
              max={100}
              placeholder="Contoh: 76"
              value={subjectForm.kkm}
              onChange={(e) => setSubjectForm({ ...subjectForm, kkm: e.target.value })}
              required
            />
            <Input
              label="Singkatan/kode"
              placeholder="Contoh: PAPB"
              hint="Singkatan/kode singkat untuk mata pelajaran (opsional)."
              value={subjectForm.code}
              onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
            />
          </div>

          <Select
            label="Jenis Mata Pelajaran"
            value={subjectForm.category}
            onChange={(e) => setSubjectForm({ ...subjectForm, category: e.target.value })}
            required
          >
            <option value="" disabled>
              Pilih Jenis Mata Pelajaran
            </option>
            <option value="Wajib">Mata Pelajaran Wajib</option>
            <option value="Pilihan">Mata Pelajaran Pilihan</option>
            <option value="Muatan Lokal">Muatan Lokal</option>
          </Select>

          {editingSubject && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Guru Pengampu (Opsional)"
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
              <Input
                label="JP / Minggu (Opsional)"
                type="number"
                min={1}
                max={20}
                value={subjectForm.weeklyHours}
                onChange={(e) => setSubjectForm({ ...subjectForm, weeklyHours: e.target.value })}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSubjectModal(false)}>
              Batal
            </Button>
            <Button type="submit" loading={savingSubject}>
              {editingSubject ? 'Simpan Perubahan' : 'Simpan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit TP per Mata Pelajaran */}
      <Modal
        open={Boolean(tpSubject)}
        onClose={() => setTpSubject(null)}
        title={`Tujuan Pembelajaran — ${tpSubject?.name || ''}`}
        subtitle={`Kelas aktif: ${selectedClass?.name || '-'} · ${tpModalList.length} TP tersimpan`}
        maxWidth="max-w-2xl"
      >
        {tpSubject && (
          <div className="space-y-5">
            {tpModalList.length === 0 ? (
              <EmptyState
                title="Belum ada Tujuan Pembelajaran"
                description="Tambahkan tujuan pembelajaran pertama pada formulir di bawah ini."
              />
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                {tpModalList.map((tp) => (
                  <div
                    key={tp.id}
                    className="p-3 flex items-start justify-between gap-3 text-xs hover:bg-slate-50/70 dark:hover:bg-slate-900/30"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                        <span className="font-mono tabular-nums text-[#1D4ED8]">
                          #{tp.atpOrder} · {tp.code}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span>{tp.scopeMaterial}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {tp.description}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1 shrink-0">
                      {can('kurikulum', 'update') && (
                        <button
                          type="button"
                          onClick={() => startEditRowTp(tp)}
                          aria-label={`Ubah ${tp.code}`}
                          className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {can('kurikulum', 'delete') && (
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({ kind: 'tp', id: tp.id, label: tp.code })
                          }
                          aria-label={`Hapus ${tp.code}`}
                          className="p-1.5 rounded border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(can('kurikulum', 'create') || can('kurikulum', 'update')) && (
              <form
                onSubmit={handleSaveRowTp}
                className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {editingTpId ? 'Ubah Tujuan Pembelajaran' : 'Tambah Tujuan Pembelajaran Baru'}
                  </p>
                  {editingTpId && (
                    <button
                      type="button"
                      onClick={() => resetRowTpForm(tpSubject)}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                    >
                      Batal ubah
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Kode TP (Opsional)"
                    value={tpRowForm.code}
                    onChange={(e) => setTpRowForm({ ...tpRowForm, code: e.target.value })}
                    placeholder={`TP.${tpSubject.gradeLevel}.${tpModalList.length + 1}`}
                  />
                  <Input
                    label="Lingkup Materi"
                    value={tpRowForm.scopeMaterial}
                    onChange={(e) => setTpRowForm({ ...tpRowForm, scopeMaterial: e.target.value })}
                    placeholder="Contoh: Operasi Hitung"
                  />
                  <Input
                    label="KKTP TP"
                    type="number"
                    min={0}
                    max={100}
                    value={tpRowForm.kktpThreshold}
                    onChange={(e) =>
                      setTpRowForm({ ...tpRowForm, kktpThreshold: Number(e.target.value) })
                    }
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Rumusan Tujuan Pembelajaran
                    </label>
                    {school?.enableAi && can('ai', 'create') && (
                      <button
                        type="button"
                        onClick={() =>
                          handleGenerateAiDraft('tp', tpSubject, tpRowForm.scopeMaterial)
                        }
                        disabled={aiLoading || (aiKeyStatus.checked && !aiKeyStatus.apiConfigured)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1D4ED8] hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        {aiLoading ? 'Menyusun...' : 'Generate dengan AI'}
                      </button>
                    )}
                  </div>
                  {school?.enableAi &&
                    can('ai', 'create') &&
                    aiKeyStatus.checked &&
                    !aiKeyStatus.apiConfigured && (
                      <p className="mb-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                        Belum ada kunci API. Fitur &quot;Generate&quot; belum dapat digunakan —{' '}
                        <Link
                          href={
                            aiKeyStatus.canUseSchoolKey
                              ? '/pengaturan?tab=kunci-api'
                              : '/pengaturan?tab=akun'
                          }
                          className="font-semibold underline"
                        >
                          Isi Kunci API
                        </Link>
                        .
                      </p>
                    )}
                  <textarea
                    rows={3}
                    value={tpRowForm.description}
                    onChange={(e) => setTpRowForm({ ...tpRowForm, description: e.target.value })}
                    placeholder="Contoh: Peserta didik mampu memahami konsep pecahan senilai dalam kehidupan sehari-hari."
                    className="w-full p-3 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setTpSubject(null)}>
                    Tutup
                  </Button>
                  <Button type="submit" loading={savingTp}>
                    {editingTpId ? 'Simpan Perubahan TP' : 'Tambah TP'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      {/* Modal CP */}
      <Modal
        open={cpModal}
        onClose={() => setCpModal(false)}
        title="Tambah Capaian Pembelajaran (CP)"
      >
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

      {/* Modal TP Tab CP/ATP */}
      <Modal
        open={tpModal}
        onClose={() => setTpModal(false)}
        title="Tambah Tujuan Pembelajaran (TP/ATP)"
      >
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
                  disabled={aiLoading || (aiKeyStatus.checked && !aiKeyStatus.apiConfigured)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1D4ED8] hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  {aiLoading ? 'Menyusun...' : 'Susun dengan AI'}
                </button>
              )}
            </div>
            {school?.enableAi &&
              can('ai', 'create') &&
              aiKeyStatus.checked &&
              !aiKeyStatus.apiConfigured && (
                <p className="mb-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                  Belum ada kunci API. Fitur &quot;Generate&quot; belum dapat digunakan —{' '}
                  <Link
                    href={
                      aiKeyStatus.canUseSchoolKey
                        ? '/pengaturan?tab=kunci-api'
                        : '/pengaturan?tab=akun'
                    }
                    className="font-semibold underline"
                  >
                    Isi Kunci API
                  </Link>
                  .
                </p>
              )}
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
