'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Plus, Save, SlidersHorizontal, Upload } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import {
  AlertBox,
  Button,
  Input,
  Modal,
  Select,
  TabBar,
  TableSkeleton,
} from '@/components/ui/Primitives';

interface SummativeRow {
  studentId: number;
  nisn: string;
  fullName: string;
  lm1: number | null;
  lm2: number | null;
  lm3: number | null;
  lm4: number | null;
  sts: number | null;
  sas: number | null;
  remedialScore: number | null;
  enrichmentNote: string;
  teacherNote: string;
  midtermScore: number | null;
  finalScore: number | null;
  lmAverage: number | null;
  kktpPassed: boolean;
}

interface FormativeStudent {
  studentId: number;
  nisn: string;
  fullName: string;
  items: Array<{
    tpId: number;
    code: string;
    scopeMaterial: string;
    description: string;
    status: string;
    score: number | null;
    notes: string;
  }>;
}

interface CocuProject {
  id: number;
  code: string;
  title: string;
  theme: string;
  dimensions: string[];
  scores: Array<{ studentId: number; fullName: string; predicate: string; description: string }>;
}

interface EkstraItem {
  id: number;
  name: string;
  mentorName: string;
  scores: Array<{ studentId: number; fullName: string; predicate: string; description: string }>;
}

interface HomeroomNoteItem {
  studentId: number;
  fullName: string;
  note: string;
  promotionDecision: string;
}

interface KeasramaanIndicatorItem {
  id: number;
  category: 'A. Kepemimpinan' | 'B. Ketaatan Ibadah';
  name: string;
  sortOrder: number;
  isActive: boolean;
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
    achievedNote: string;
    guidanceNote: string;
    notes: string;
  }>;
}

function PenilaianInner() {
  const searchParams = useSearchParams();
  const { school, selectedClassId, selectedClass, can, canAny, notify } = useApp();
  const showKeasramaan = Boolean(school?.enableKeasramaan && can('keasramaan', 'read'));
  const hasAcademicRead = can('penilaian', 'read');
  const [tab, setTab] = useState<
    'sumatif' | 'formatif' | 'kokurikuler' | 'ekstra' | 'catatan' | 'keasramaan'
  >('sumatif');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (
      t === 'sumatif' ||
      t === 'formatif' ||
      t === 'kokurikuler' ||
      t === 'ekstra' ||
      t === 'catatan' ||
      t === 'keasramaan'
    ) {
      Promise.resolve().then(() => setTab(t));
    }
  }, [searchParams]);

  const canUpdateScores = can('penilaian', 'update');
  const canExportScores = can('penilaian', 'export');
  const canUpdateNotes = canAny(['penilaian', 'rapor'], 'update');
  const canUpdateKeasramaan = can('keasramaan', 'update');
  const canCreateKeasramaan = can('keasramaan', 'create');

  const activeTab =
    !hasAcademicRead && showKeasramaan
      ? 'keasramaan'
      : tab === 'keasramaan' && !showKeasramaan
      ? 'sumatif'
      : tab;

  const [subjects, setSubjects] = useState<Array<{ id: number; name: string; code: string }>>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number>(0);
  const [weights, setWeights] = useState({ weightLm: 40, weightSts: 30, weightSas: 30, kktpMin: 75 });
  const [summativeRows, setSummativeRows] = useState<SummativeRow[]>([]);
  const [formativeByStudent, setFormativeByStudent] = useState<FormativeStudent[]>([]);
  const [cocurriculars, setCocurriculars] = useState<CocuProject[]>([]);
  const [extracurriculars, setExtracurriculars] = useState<EkstraItem[]>([]);
  const [homeroomNotes, setHomeroomNotes] = useState<HomeroomNoteItem[]>([]);

  // Modals
  const [weightModal, setWeightModal] = useState(false);
  const [weightForm, setWeightForm] = useState({ weightLm: 40, weightSts: 30, weightSas: 30, kktpMin: 75 });

  const [editScoreRow, setEditScoreRow] = useState<SummativeRow | null>(null);
  const [scoreForm, setScoreForm] = useState({
    lm1: '',
    lm2: '',
    lm3: '',
    lm4: '',
    sts: '',
    sas: '',
    remedialScore: '',
    enrichmentNote: '',
    teacherNote: '',
  });

  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  // Keasramaan State
  const [keasIndicators, setKeasIndicators] = useState<KeasramaanIndicatorItem[]>([]);
  const [keasRows, setKeasRows] = useState<KeasramaanStudentRow[]>([]);
  const [savingKeas, setSavingKeas] = useState(false);
  const [indModal, setIndModal] = useState(false);
  const [indForm, setIndForm] = useState({
    category: 'A. Kepemimpinan' as 'A. Kepemimpinan' | 'B. Ketaatan Ibadah',
    name: '',
    sortOrder: 1,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedClassId) params.set('classId', String(selectedClassId));
    if (selectedSubjectId) params.set('subjectId', String(selectedSubjectId));

    const [assRes, keasRes] = await Promise.all([
      hasAcademicRead
        ? fetch(`/api/assessments?${params.toString()}`, { cache: 'no-store' })
        : Promise.resolve(null),
      showKeasramaan
        ? fetch(`/api/keasramaan?classId=${selectedClassId || ''}`, { cache: 'no-store' })
        : Promise.resolve(null),
    ]);

    if (assRes && assRes.ok) {
      const json = await assRes.json();
      setSubjects(json.subjects || []);
      if (!selectedSubjectId && json.selectedSubject?.id) {
        setSelectedSubjectId(json.selectedSubject.id);
      }
      setWeights(json.weights || { weightLm: 40, weightSts: 30, weightSas: 30, kktpMin: 75 });
      setWeightForm(json.weights || { weightLm: 40, weightSts: 30, weightSas: 30, kktpMin: 75 });
      setSummativeRows(json.summativeRows || []);
      setFormativeByStudent(json.formativeByStudent || []);
      setCocurriculars(json.cocurricularProjects || []);
      setExtracurriculars(json.extracurriculars || []);
      setHomeroomNotes(json.homeroomNotes || []);
    }

    if (keasRes && keasRes.ok) {
      const kJson = await keasRes.json();
      setKeasIndicators(kJson.indicators || []);
      setKeasRows(kJson.studentRows || []);
    }
    setLoading(false);
  }, [selectedClassId, selectedSubjectId, hasAcademicRead, showKeasramaan]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadData();
    });
  }, [loadData]);

  const handleSaveWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !selectedSubjectId) return;
    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'weights',
        subjectId: selectedSubjectId,
        classId: selectedClass.id,
        weightLm: Number(weightForm.weightLm),
        weightSts: Number(weightForm.weightSts),
        weightSas: Number(weightForm.weightSas),
        kktpMin: Number(weightForm.kktpMin),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan bobot penilaian.');
      return;
    }
    setWeightModal(false);
    notify('success', 'Bobot nilai & KKTP diperbarui dan nilai dihitung ulang.');
    await loadData();
  };

  const openEditScore = (row: SummativeRow) => {
    setEditScoreRow(row);
    setScoreForm({
      lm1: row.lm1 !== null ? String(row.lm1) : '',
      lm2: row.lm2 !== null ? String(row.lm2) : '',
      lm3: row.lm3 !== null ? String(row.lm3) : '',
      lm4: row.lm4 !== null ? String(row.lm4) : '',
      sts: row.sts !== null ? String(row.sts) : '',
      sas: row.sas !== null ? String(row.sas) : '',
      remedialScore: row.remedialScore !== null ? String(row.remedialScore) : '',
      enrichmentNote: row.enrichmentNote || '',
      teacherNote: row.teacherNote || '',
    });
  };

  const handleSaveScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editScoreRow || !selectedClass || !selectedSubjectId) return;
    const toNum = (v: string) => (v.trim() === '' ? null : Number(v));

    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'summative',
        studentId: editScoreRow.studentId,
        subjectId: selectedSubjectId,
        classId: selectedClass.id,
        lm1: toNum(scoreForm.lm1),
        lm2: toNum(scoreForm.lm2),
        lm3: toNum(scoreForm.lm3),
        lm4: toNum(scoreForm.lm4),
        sts: toNum(scoreForm.sts),
        sas: toNum(scoreForm.sas),
        remedialScore: toNum(scoreForm.remedialScore),
        enrichmentNote: scoreForm.enrichmentNote,
        teacherNote: scoreForm.teacherNote,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan nilai sumatif.');
      return;
    }
    setEditScoreRow(null);
    notify('success', `Nilai ${editScoreRow.fullName} tersimpan.`);
    await loadData();
  };

  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || !selectedClass || !selectedSubjectId) return;
    const fd = new FormData();
    fd.append('file', importFile);
    fd.append('classId', String(selectedClass.id));
    fd.append('subjectId', String(selectedSubjectId));

    const res = await fetch('/api/assessments/excel', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: fd,
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal mengimpor file nilai Excel.');
      return;
    }
    setImportModal(false);
    setImportFile(null);
    notify('success', `Berhasil memperbarui nilai ${json.updated} murid dari Excel.`);
    await loadData();
  };

  const handleFormativeChange = async (
    studentId: number,
    tpId: number,
    status: string,
    score: number | null
  ) => {
    if (!selectedClass || !selectedSubjectId) return;
    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'formative',
        studentId,
        learningObjectiveId: tpId,
        subjectId: selectedSubjectId,
        classId: selectedClass.id,
        status,
        score,
        notes: '',
      }),
    });
    if (res.ok) {
      notify('success', 'Status formatif TP diperbarui.');
      await loadData();
    } else {
      notify('error', 'Gagal menyimpan status formatif.');
    }
  };

  const handleSaveCocu = async (
    projectId: number,
    studentId: number,
    predicate: string,
    description: string
  ) => {
    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'cocurricular_score',
        projectId,
        studentId,
        predicate,
        description: description || `Menunjukkan capaian ${predicate} dalam projek kokurikuler.`,
      }),
    });
    if (res.ok) {
      notify('success', 'Capaian kokurikuler tersimpan.');
      await loadData();
    } else {
      notify('error', 'Gagal menyimpan capaian kokurikuler.');
    }
  };

  const handleSaveEkstra = async (
    extracurricularId: number,
    studentId: number,
    predicate: string,
    description: string
  ) => {
    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'extracurricular_score',
        extracurricularId,
        studentId,
        predicate,
        description: description || `Aktif mengikuti kegiatan dengan predikat ${predicate}.`,
      }),
    });
    if (res.ok) {
      notify('success', 'Nilai ekstrakurikuler tersimpan.');
      await loadData();
    } else {
      notify('error', 'Gagal menyimpan nilai ekstrakurikuler.');
    }
  };

  const handleSaveAllHomeroomNotes = async () => {
    if (!selectedClass) return;
    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'homeroom_note',
        classId: selectedClass.id,
        entries: homeroomNotes.map((h) => ({
          studentId: h.studentId,
          note: h.note,
          promotionDecision: h.promotionDecision,
        })),
      }),
    });
    if (res.ok) {
      notify('success', 'Semua catatan wali kelas berhasil disimpan.');
      await loadData();
    } else {
      notify('error', 'Gagal menyimpan catatan wali kelas.');
    }
  };

  const handleSaveAllKeasramaan = async () => {
    if (!selectedClass) return;
    const entries = keasRows.flatMap((stu) =>
      stu.items.map((item) => ({
        studentId: stu.studentId,
        indicatorId: item.indicatorId,
        predicate: item.predicate,
        achievedNote: item.achievedNote,
        guidanceNote: item.guidanceNote,
        notes: item.notes,
        waliAsramaName: stu.waliAsramaName,
        waliAsuhName: stu.waliAsuhName,
      }))
    );
    if (entries.length === 0) return;

    setSavingKeas(true);
    const res = await fetch('/api/keasramaan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'save_scores',
        classId: selectedClass.id,
        entries,
      }),
    });
    setSavingKeas(false);
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan nilai pembinaan keasramaan.');
      return;
    }
    notify('success', 'Seluruh nilai pembinaan keasramaan berhasil disimpan.');
    await loadData();
  };

  const handleCreateIndicator = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/keasramaan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'save_indicator',
        category: indForm.category,
        name: indForm.name,
        sortOrder: Number(indForm.sortOrder),
        isActive: true,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal menambahkan indikator keasramaan.');
      return;
    }
    setIndModal(false);
    setIndForm({ category: 'A. Kepemimpinan', name: '', sortOrder: keasIndicators.length + 1 });
    notify('success', 'Indikator keasramaan baru ditambahkan.');
    await loadData();
  };

  const navTabs = [
    ...(hasAcademicRead
      ? [
          { id: 'sumatif', label: 'Sumatif' },
          { id: 'formatif', label: 'Formatif (TP)' },
          { id: 'kokurikuler', label: 'Kokurikuler' },
          { id: 'ekstra', label: 'Ekstrakurikuler' },
          { id: 'catatan', label: 'Catatan Wali' },
        ]
      : []),
    ...(showKeasramaan ? [{ id: 'keasramaan', label: 'Keasramaan' }] : []),
  ];

  return (
    <AppShell title="Penilaian" requiredModule={['penilaian', 'keasramaan']}>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-lg font-bold text-slate-900 dark:text-slate-100">
              Penilaian — Kelas {selectedClass?.name}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Bobot: LM {weights.weightLm}% · STS {weights.weightSts}% · SAS {weights.weightSas}% · KKTP {weights.kktpMin}
            </p>
          </div>
          {activeTab === 'sumatif' && (canUpdateScores || canExportScores) && (
            <div className="flex flex-wrap items-center gap-2">
              {canUpdateScores && (
                <Button variant="outline" size="sm" onClick={() => setWeightModal(true)}>
                  <SlidersHorizontal className="w-4 h-4" />
                  Atur Bobot
                </Button>
              )}
              {canExportScores && (
                <a
                  href={`/api/assessments/excel?mode=template&classId=${selectedClass?.id || ''}&subjectId=${selectedSubjectId}`}
                >
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4" />
                    Template Excel
                  </Button>
                </a>
              )}
              {canUpdateScores && (
                <Button size="sm" onClick={() => setImportModal(true)}>
                  <Upload className="w-4 h-4" />
                  Import Nilai (.xlsx)
                </Button>
              )}
            </div>
          )}
          {activeTab === 'keasramaan' && (canUpdateKeasramaan || canCreateKeasramaan) && (
            <div className="flex flex-wrap items-center gap-2">
              {canCreateKeasramaan && (
                <Button variant="outline" size="sm" onClick={() => setIndModal(true)}>
                  <Plus className="w-4 h-4" />
                  Tambah Indikator
                </Button>
              )}
              {canUpdateKeasramaan && (
                <Button size="sm" loading={savingKeas} onClick={handleSaveAllKeasramaan}>
                  <Save className="w-4 h-4" />
                  Simpan Nilai Keasramaan
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <TabBar
            items={navTabs}
            activeId={activeTab}
            onChange={(id) => setTab(id as typeof tab)}
          />

          {(activeTab === 'sumatif' || activeTab === 'formatif') && (
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
          <TableSkeleton rows={8} />
        ) : activeTab === 'sumatif' ? (
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table text-left text-xs">
                <thead>
                  <tr className="th-groups text-[10px] uppercase tracking-wider">
                    <th colSpan={2} className="py-1.5 px-3 font-semibold col-id">
                      Identitas Murid
                    </th>
                    <th colSpan={3} className="py-1.5 px-2 font-semibold text-center col-a col-sep">
                      Lingkup Materi
                    </th>
                    <th colSpan={3} className="py-1.5 px-2 font-semibold text-center col-b col-sep">
                      Asesmen Akhir
                    </th>
                    <th colSpan={2} className="py-1.5 px-3 font-semibold text-center col-total col-sep">
                      Ringkasan Nilai
                    </th>
                    {canUpdateScores && (
                      <th className="py-1.5 px-3 font-semibold text-right col-action col-sep">
                        &nbsp;
                      </th>
                    )}
                  </tr>
                  <tr className="text-slate-600 dark:text-slate-300">
                    <th className="py-2.5 px-3 font-semibold w-10 col-id">No</th>
                    <th className="py-2.5 px-3 font-semibold col-id col-cell-div">Nama Murid</th>
                    <th className="py-2.5 px-2 font-semibold text-right col-a col-sep">LM 1</th>
                    <th className="py-2.5 px-2 font-semibold text-right col-a col-cell-div">LM 2</th>
                    <th className="py-2.5 px-2 font-semibold text-right col-a col-cell-div">LM 3</th>
                    <th className="py-2.5 px-2 font-semibold text-right col-b col-sep">STS</th>
                    <th className="py-2.5 px-2 font-semibold text-right col-b col-cell-div">SAS</th>
                    <th className="py-2.5 px-2 font-semibold text-right col-b col-cell-div">Remedial</th>
                    <th className="py-2.5 px-3 font-semibold text-right col-total col-sep">Nilai Tengah</th>
                    <th className="py-2.5 px-3 font-semibold text-right col-total col-cell-div">Nilai Rapor</th>
                    {canUpdateScores && (
                      <th className="py-2.5 px-3 font-semibold text-right col-action col-sep">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {summativeRows.map((row, idx) => (
                    <tr key={row.studentId}>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 col-id">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 col-id col-cell-div">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {row.fullName}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-500">
                          {row.nisn}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums col-a col-sep">
                        {row.lm1 ?? '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums col-a col-cell-div">
                        {row.lm2 ?? '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums col-a col-cell-div">
                        {row.lm3 ?? '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums col-b col-sep">
                        {row.sts ?? '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums col-b col-cell-div">
                        {row.sas ?? '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums col-b col-cell-div">
                        {row.remedialScore ?? '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200 col-total col-sep">
                        {row.midtermScore !== null ? row.midtermScore.toFixed(1) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 col-total col-cell-div">
                        {row.finalScore !== null ? Math.round(row.finalScore) : '-'}
                      </td>
                      {canUpdateScores && (
                        <td className="py-2.5 px-3 text-right col-action col-sep">
                          <Button size="sm" variant="outline" onClick={() => openEditScore(row)}>
                            Input
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'formatif' ? (
          <div className="space-y-4">
            {formativeByStudent.map((stu) => (
              <div
                key={stu.studentId}
                className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {stu.fullName}
                  </h3>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500">
                    NISN {stu.nisn}
                  </span>
                </div>
                {stu.items.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500">
                    Belum ada Tujuan Pembelajaran untuk mapel ini.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {stu.items.map((item) => (
                      <div
                        key={item.tpId}
                        className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 odd:bg-white dark:odd:bg-transparent even:bg-slate-50/60 dark:even:bg-slate-900/30 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 focus-within:bg-blue-50/70 dark:focus-within:bg-blue-950/30 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#0F2942] dark:text-blue-400">
                            {item.code} · {item.scopeMaterial}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">
                            {item.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 sm:w-56 shrink-0">
                          <select
                            aria-label={`Status TP ${item.code} untuk ${stu.fullName}`}
                            value={item.status}
                            disabled={!canUpdateScores}
                            onChange={(e) =>
                              handleFormativeChange(stu.studentId, item.tpId, e.target.value, item.score)
                            }
                            className="flex-1 h-8 px-2 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <option value="Belum Dinilai">Belum Dinilai</option>
                            <option value="Tercapai">Tercapai</option>
                            <option value="Perlu Pendalaman">Perlu Pendalaman</option>
                            <option value="Perlu Bimbingan">Perlu Bimbingan</option>
                          </select>
                          <span className="w-8 text-right text-xs font-mono tabular-nums text-slate-500">
                            {item.score ?? '-'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : activeTab === 'kokurikuler' ? (
          <div className="space-y-4">
            {cocurriculars.map((proj) => (
              <div
                key={proj.id}
                className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
              >
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                  <p className="text-xs font-mono text-slate-500">
                    {proj.code} · Tema: {proj.theme}
                  </p>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {proj.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Dimensi Fokus: {proj.dimensions.join(', ')}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table text-left text-xs">
                    <thead>
                      <tr>
                        <th className="py-2.5 px-3 font-semibold col-id">Nama Murid</th>
                        <th className="py-2.5 px-3 font-semibold w-44 col-a col-sep">Predikat</th>
                        <th className="py-2.5 px-3 font-semibold col-b col-sep">
                          Deskripsi Capaian Projek
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {proj.scores.map((sc) => (
                        <tr key={sc.studentId}>
                          <td className="py-2.5 px-3 font-medium col-id">{sc.fullName}</td>
                          <td className="py-2.5 px-3 col-a col-sep">
                            <select
                              value={sc.predicate}
                              disabled={!canUpdateScores}
                              onChange={(e) =>
                                handleSaveCocu(proj.id, sc.studentId, e.target.value, sc.description)
                              }
                              className="w-full h-8 px-2 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <option value="Sangat Baik">Sangat Baik</option>
                              <option value="Baik">Baik</option>
                              <option value="Cukup">Cukup</option>
                              <option value="Perlu Bimbingan">Perlu Bimbingan</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 col-b col-sep">
                            {sc.description || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'ekstra' ? (
          <div className="space-y-4">
            {extracurriculars.map((eks) => (
              <div
                key={eks.id}
                className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
              >
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {eks.name}
                    </h2>
                    <p className="text-xs text-slate-500">Pembina: {eks.mentorName}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table text-left text-xs">
                    <thead>
                      <tr>
                        <th className="py-2.5 px-3 font-semibold col-id">Nama Murid</th>
                        <th className="py-2.5 px-3 font-semibold w-44 col-a col-sep">Predikat</th>
                        <th className="py-2.5 px-3 font-semibold col-b col-sep">
                          Keterangan Pembina
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {eks.scores.map((sc) => (
                        <tr key={sc.studentId}>
                          <td className="py-2.5 px-3 font-medium col-id">{sc.fullName}</td>
                          <td className="py-2.5 px-3 col-a col-sep">
                            <select
                              value={sc.predicate === '-' ? 'Baik' : sc.predicate}
                              disabled={!canUpdateScores}
                              onChange={(e) =>
                                handleSaveEkstra(eks.id, sc.studentId, e.target.value, sc.description)
                              }
                              className="w-full h-8 px-2 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <option value="Sangat Baik">Sangat Baik</option>
                              <option value="Baik">Baik</option>
                              <option value="Cukup">Cukup</option>
                              <option value="Kurang">Kurang</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 col-b col-sep">
                            {sc.description || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'keasramaan' ? (
          <div className="space-y-4">
            {keasRows.map((stu) => (
              <div
                key={stu.studentId}
                className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
              >
                <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {stu.fullName}
                    </h3>
                    <p className="text-[11px] font-mono tabular-nums text-slate-500">
                      NISN {stu.nisn}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:w-96">
                    <input
                      type="text"
                      value={stu.waliAsramaName}
                      disabled={!canUpdateKeasramaan}
                      placeholder="Nama Wali Asrama"
                      onChange={(e) => {
                        const val = e.target.value;
                        setKeasRows((prev) =>
                          prev.map((r) =>
                            r.studentId === stu.studentId ? { ...r, waliAsramaName: val } : r
                          )
                        );
                      }}
                      className="h-8 px-2.5 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded disabled:opacity-60"
                    />
                    <input
                      type="text"
                      value={stu.waliAsuhName}
                      disabled={!canUpdateKeasramaan}
                      placeholder="Nama Wali Asuh"
                      onChange={(e) => {
                        const val = e.target.value;
                        setKeasRows((prev) =>
                          prev.map((r) =>
                            r.studentId === stu.studentId ? { ...r, waliAsuhName: val } : r
                          )
                        );
                      }}
                      className="h-8 px-2.5 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stu.items.map((item) => (
                    <div
                      key={item.indicatorId}
                      className="px-4 py-3 grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-center odd:bg-white dark:odd:bg-transparent even:bg-slate-50/60 dark:even:bg-slate-900/30 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 focus-within:bg-blue-50/70 dark:focus-within:bg-blue-950/30 transition-colors"
                    >
                      <div className="lg:col-span-3">
                        <p className="text-[11px] text-slate-500">{item.category}</p>
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {item.name}
                        </p>
                      </div>
                      <div className="lg:col-span-2">
                        <select
                          aria-label={`Predikat ${item.name} untuk ${stu.fullName}`}
                          value={item.predicate}
                          disabled={!canUpdateKeasramaan}
                          onChange={(e) => {
                            const val = e.target.value as 'A' | 'B' | 'C';
                            setKeasRows((prev) =>
                              prev.map((r) =>
                                r.studentId === stu.studentId
                                  ? {
                                      ...r,
                                      items: r.items.map((it) =>
                                        it.indicatorId === item.indicatorId
                                          ? { ...it, predicate: val }
                                          : it
                                      ),
                                    }
                                  : r
                              )
                            );
                          }}
                          className="w-full h-8 px-2 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded disabled:opacity-60"
                        >
                          <option value="A">A (Sangat Baik)</option>
                          <option value="B">B (Baik)</option>
                          <option value="C">C (Perlu Pembinaan)</option>
                        </select>
                      </div>
                      <div className="lg:col-span-4">
                        <input
                          type="text"
                          value={item.achievedNote}
                          disabled={!canUpdateKeasramaan}
                          placeholder="Paragraf capaian terlihat..."
                          onChange={(e) => {
                            const val = e.target.value;
                            setKeasRows((prev) =>
                              prev.map((r) =>
                                r.studentId === stu.studentId
                                  ? {
                                      ...r,
                                      items: r.items.map((it) =>
                                        it.indicatorId === item.indicatorId
                                          ? { ...it, achievedNote: val }
                                          : it
                                      ),
                                    }
                                  : r
                              )
                            );
                          }}
                          className="w-full h-8 px-2.5 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded disabled:opacity-60"
                        />
                      </div>
                      <div className="lg:col-span-3">
                        <input
                          type="text"
                          value={item.guidanceNote}
                          disabled={!canUpdateKeasramaan}
                          placeholder="Catatan pendampingan (opsional)..."
                          onChange={(e) => {
                            const val = e.target.value;
                            setKeasRows((prev) =>
                              prev.map((r) =>
                                r.studentId === stu.studentId
                                  ? {
                                      ...r,
                                      items: r.items.map((it) =>
                                        it.indicatorId === item.indicatorId
                                          ? { ...it, guidanceNote: val }
                                          : it
                                      ),
                                    }
                                  : r
                              )
                            );
                          }}
                          className="w-full h-8 px-2.5 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded disabled:opacity-60"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Catatan Wali Kelas & Keputusan Rapor — Kelas {selectedClass?.name}
                </h2>
                <p className="text-xs text-slate-500">
                  Catatan ini tercetak langsung pada lembar Rapor Kurikulum Merdeka masing-masing murid.
                </p>
              </div>
              {canUpdateNotes && (
                <Button size="sm" onClick={handleSaveAllHomeroomNotes}>
                  <Save className="w-4 h-4" />
                  Simpan Semua Catatan
                </Button>
              )}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {homeroomNotes.map((item, index) => (
                <div
                  key={item.studentId}
                  className="py-3 px-2 rounded grid grid-cols-1 lg:grid-cols-12 gap-3 odd:bg-white dark:odd:bg-transparent even:bg-slate-50/60 dark:even:bg-slate-900/30 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 focus-within:bg-blue-50/70 dark:focus-within:bg-blue-950/30 transition-colors"
                >
                  <div className="lg:col-span-3 font-medium text-xs text-slate-900 dark:text-slate-100 pt-1">
                    {index + 1}. {item.fullName}
                  </div>
                  <div className="lg:col-span-6">
                    <input
                      type="text"
                      value={item.note}
                      disabled={!canUpdateNotes}
                      placeholder="Tuliskan motivasi dan catatan perkembangan murid..."
                      onChange={(e) => {
                        const val = e.target.value;
                        setHomeroomNotes((prev) =>
                          prev.map((p) => (p.studentId === item.studentId ? { ...p, note: val } : p))
                        );
                      }}
                      className="w-full h-9 px-3 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-md disabled:opacity-60"
                    />
                  </div>
                  <div className="lg:col-span-3">
                    <input
                      type="text"
                      value={item.promotionDecision}
                      disabled={!canUpdateNotes}
                      placeholder="Keputusan (mis. Naik ke Kelas V)"
                      onChange={(e) => {
                        const val = e.target.value;
                        setHomeroomNotes((prev) =>
                          prev.map((p) =>
                            p.studentId === item.studentId ? { ...p, promotionDecision: val } : p
                          )
                        );
                      }}
                      className="w-full h-9 px-3 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-md disabled:opacity-60"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal Bobot */}
      <Modal open={weightModal} onClose={() => setWeightModal(false)} title="Atur Bobot Penilaian & KKTP">
        <form onSubmit={handleSaveWeights} className="space-y-4">
          <AlertBox variant="info">
            Total bobot Lingkup Materi (LM), STS, dan SAS wajib berjumlah tepat 100%.
          </AlertBox>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Bobot Sumatif LM (%)"
              type="number"
              min={0}
              max={100}
              value={weightForm.weightLm}
              onChange={(e) => setWeightForm({ ...weightForm, weightLm: Number(e.target.value) })}
              required
            />
            <Input
              label="Bobot STS (%)"
              type="number"
              min={0}
              max={100}
              value={weightForm.weightSts}
              onChange={(e) => setWeightForm({ ...weightForm, weightSts: Number(e.target.value) })}
              required
            />
            <Input
              label="Bobot SAS (%)"
              type="number"
              min={0}
              max={100}
              value={weightForm.weightSas}
              onChange={(e) => setWeightForm({ ...weightForm, weightSas: Number(e.target.value) })}
              required
            />
            <Input
              label="KKTP Minimum"
              type="number"
              min={0}
              max={100}
              value={weightForm.kktpMin}
              onChange={(e) => setWeightForm({ ...weightForm, kktpMin: Number(e.target.value) })}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setWeightModal(false)}>
              Batal
            </Button>
            <Button type="submit">Simpan & Hitung Ulang</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Input Nilai Murid */}
      <Modal
        open={Boolean(editScoreRow)}
        onClose={() => setEditScoreRow(null)}
        title={`Input Nilai Sumatif — ${editScoreRow?.fullName || ''}`}
        subtitle={`NISN: ${editScoreRow?.nisn || ''}`}
      >
        <form onSubmit={handleSaveScore} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="LM 1"
              type="number"
              min={0}
              max={100}
              value={scoreForm.lm1}
              onChange={(e) => setScoreForm({ ...scoreForm, lm1: e.target.value })}
            />
            <Input
              label="LM 2"
              type="number"
              min={0}
              max={100}
              value={scoreForm.lm2}
              onChange={(e) => setScoreForm({ ...scoreForm, lm2: e.target.value })}
            />
            <Input
              label="LM 3"
              type="number"
              min={0}
              max={100}
              value={scoreForm.lm3}
              onChange={(e) => setScoreForm({ ...scoreForm, lm3: e.target.value })}
            />
            <Input
              label="LM 4"
              type="number"
              min={0}
              max={100}
              value={scoreForm.lm4}
              onChange={(e) => setScoreForm({ ...scoreForm, lm4: e.target.value })}
            />
            <Input
              label="STS (Tengah)"
              type="number"
              min={0}
              max={100}
              value={scoreForm.sts}
              onChange={(e) => setScoreForm({ ...scoreForm, sts: e.target.value })}
            />
            <Input
              label="SAS (Akhir)"
              type="number"
              min={0}
              max={100}
              value={scoreForm.sas}
              onChange={(e) => setScoreForm({ ...scoreForm, sas: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nilai Remedial (Opsional)"
              type="number"
              min={0}
              max={100}
              hint="Mengambil nilai tertinggi hingga batas KKTP jika lebih baik"
              value={scoreForm.remedialScore}
              onChange={(e) => setScoreForm({ ...scoreForm, remedialScore: e.target.value })}
            />
            <Input
              label="Catatan Pengayaan"
              value={scoreForm.enrichmentNote}
              onChange={(e) => setScoreForm({ ...scoreForm, enrichmentNote: e.target.value })}
            />
          </div>
          <Input
            label="Catatan Guru / Deskripsi Khusus"
            value={scoreForm.teacherNote}
            onChange={(e) => setScoreForm({ ...scoreForm, teacherNote: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditScoreRow(null)}>
              Batal
            </Button>
            <Button type="submit">Simpan Nilai</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Import Excel */}
      <Modal open={importModal} onClose={() => setImportModal(false)} title="Import Nilai Sumatif Excel">
        <form onSubmit={handleImportExcel} className="space-y-4">
          <AlertBox variant="info">
            Gunakan template resmi yang diunduh dari tombol Template Excel agar kolom NISN dan LM/STS/SAS terbaca akurat.
          </AlertBox>
          <input
            type="file"
            accept=".xlsx,.xlsm"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-medium file:bg-slate-50 hover:file:bg-slate-100"
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportModal(false)}>
              Batal
            </Button>
            <Button type="submit">Proses Import Nilai</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Indikator Keasramaan */}
      <Modal
        open={indModal}
        onClose={() => setIndModal(false)}
        title="Tambah Indikator Pembinaan Keasramaan"
      >
        <form onSubmit={handleCreateIndicator} className="space-y-4">
          <Select
            label="Kelompok Pembinaan"
            value={indForm.category}
            onChange={(e) =>
              setIndForm({
                ...indForm,
                category: e.target.value as 'A. Kepemimpinan' | 'B. Ketaatan Ibadah',
              })
            }
          >
            <option value="A. Kepemimpinan">A. Kepemimpinan</option>
            <option value="B. Ketaatan Ibadah">B. Ketaatan Ibadah</option>
          </Select>
          <Input
            label="Nama Indikator"
            value={indForm.name}
            onChange={(e) => setIndForm({ ...indForm, name: e.target.value })}
            placeholder="Contoh: Kemandirian dan Kerapian Asrama"
            required
          />
          <Input
            label="Urutan Tampil"
            type="number"
            min={1}
            max={99}
            value={indForm.sortOrder}
            onChange={(e) => setIndForm({ ...indForm, sortOrder: Number(e.target.value) })}
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIndModal(false)}>
              Batal
            </Button>
            <Button type="submit">Simpan Indikator</Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

export default function PenilaianPage() {
  return (
    <Suspense fallback={<AppShell title="Asesmen & Nilai" requiredModule={['penilaian', 'keasramaan']}><TableSkeleton rows={8} /></AppShell>}>
      <PenilaianInner />
    </Suspense>
  );
}
