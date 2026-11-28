'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Info,
  Lock,
  PenLine,
  Save,
  Search,
  SlidersHorizontal,
  Unlock,
  Upload,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import {
  AlertBox,
  Button,
  EmptyState,
  Input,
  Modal,
  Select,
  TableSkeleton,
} from '@/components/ui/Primitives';
import {
  buildCocurricularDescription,
  buildExtracurricularDescription,
  computeAverageTwo,
  computeScopeAveragesFromTpScores,
  type CocurricularPredicate,
  type ExtracurricularPredicate,
} from '@/lib/assessment-helpers';
import { cn } from '@/lib/utils';

export type PenilaianTab =
  | 'formatif'
  | 'sumatif'
  | 'kokurikuler'
  | 'ekstrakurikuler'
  | 'keasramaan'
  | 'catatan';

export function normalizePenilaianTab(raw?: string | null): PenilaianTab {
  if (raw === 'formatif') return 'formatif';
  if (raw === 'sumatif') return 'sumatif';
  if (raw === 'kokurikuler') return 'kokurikuler';
  if (raw === 'ekstrakurikuler' || raw === 'ekstra') return 'ekstrakurikuler';
  if (raw === 'keasramaan') return 'keasramaan';
  if (raw === 'catatan') return 'catatan';
  return 'sumatif';
}

interface SubjectTp {
  id: number;
  code: string;
  scopeMaterial: string;
  description: string;
  atpOrder: number;
}

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
  stsTes: number | null;
  stsNonTes: number | null;
  sasTes: number | null;
  sasNonTes: number | null;
  tpScores: Record<string, number | null>;
  remedialScore: number | null;
  enrichmentNote: string;
  teacherNote: string;
  midtermScore: number | null;
  finalScore: number | null;
  lmAverage: number | null;
  kktpPassed: boolean;
}

interface FormativeItem {
  tpId: number;
  code: string;
  scopeMaterial: string;
  description: string;
  status: 'Tercapai' | 'Perlu Bimbingan' | 'Belum Dinilai' | string;
  score: number | null;
  notes: string;
}

interface FormativeStudent {
  studentId: number;
  nisn: string;
  fullName: string;
  items: FormativeItem[];
}

interface CocuProject {
  id: number;
  code: string;
  title: string;
  dimensions: string[];
  scores: Array<{
    studentId: number;
    fullName: string;
    predicate: string;
    dimensionScores: Record<string, string>;
    description: string;
  }>;
}

interface EkstraItem {
  id: number;
  name: string;
  instructorName?: string;
  objectives: string[];
  scores: Array<{
    studentId: number;
    fullName: string;
    predicate: string;
    tpScores: Array<{ objective: string; predicate: string }>;
    description: string;
  }>;
}

interface HomeroomNoteItem {
  studentId: number;
  fullName: string;
  note: string;
  promotionDecision: string;
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
    learningObjectives: string[];
    predicate: 'A' | 'B' | 'C';
    achievedNote: string;
    guidanceNote: string;
  }>;
}

function StudentCombobox({
  students,
  selectedId,
  onSelect,
}: {
  students: Array<{ studentId: number; fullName: string }>;
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = students.find((s) => s.studentId === selectedId);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.fullName.toLowerCase().includes(q));
  }, [students, query]);

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={open ? query : selected?.fullName || ''}
          placeholder="Ketik nama murid atau pilih di sini"
          onFocus={() => {
            setQuery('');
            setOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 160);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          aria-label="Pilih murid cepat"
          className="w-full h-10 pl-9 pr-3 text-sm bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8]"
        />
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 rounded-md shadow-lg py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">Murid tidak ditemukan.</p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.studentId}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(s.studentId);
                  setQuery('');
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer',
                  s.studentId === selectedId
                    ? 'font-semibold text-[#0F2942] dark:text-sky-300 bg-slate-50 dark:bg-slate-800/70'
                    : 'text-slate-700 dark:text-slate-200'
                )}
              >
                <span className="truncate">{s.fullName}</span>
                {s.studentId === selectedId && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function formatScoreNum(val: number | null | undefined): string {
  if (typeof val !== 'number' || !Number.isFinite(val)) return '—';
  return val.toFixed(2);
}

function renderFormativeProgressSummary(items: FormativeItem[]) {
  if (items.length === 0) {
    return <span className="text-xs text-slate-400">Belum ada Tujuan Pembelajaran.</span>;
  }
  const hasAnyMarked = items.some((it) => it.status !== 'Belum Dinilai');
  if (!hasAnyMarked) {
    return (
      <span className="text-xs text-slate-500 dark:text-slate-400">
        Belum dinilai (0/{items.length} TP)
      </span>
    );
  }

  const order: string[] = [];
  const grouped = new Map<string, { achieved: number; total: number }>();
  for (const it of items) {
    const scope = (it.scopeMaterial || 'Umum').trim() || 'Umum';
    if (!grouped.has(scope)) {
      order.push(scope);
      grouped.set(scope, { achieved: 0, total: 0 });
    }
    const b = grouped.get(scope)!;
    b.total += 1;
    if (it.status === 'Tercapai') b.achieved += 1;
  }

  return (
    <span className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
      {order.map((scope, idx) => {
        const b = grouped.get(scope)!;
        const scopeLower = scope.toLowerCase();
        let prefix = '';
        let toneClass = '';
        if (b.achieved === b.total) {
          prefix = `sangat baik dalam materi ${scopeLower}`;
          toneClass = 'text-sky-600 dark:text-sky-400';
        } else if (b.achieved > 0) {
          prefix = `perlu pendalaman dalam materi ${scopeLower}`;
          toneClass = 'text-amber-600 dark:text-amber-400';
        } else {
          prefix = `perlu bimbingan dalam materi ${scopeLower}`;
          toneClass = 'text-red-600 dark:text-red-400';
        }
        const displayPrefix = idx === 0 ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : prefix;
        const sep =
          idx === order.length - 1
            ? '.'
            : idx === order.length - 2
            ? order.length > 2
              ? ', dan '
              : ' dan '
            : ', ';

        return (
          <React.Fragment key={scope}>
            {displayPrefix}{' '}
            <span className={cn('font-semibold tabular-nums', toneClass)}>
              ({b.achieved}/{b.total} TP)
            </span>
            {sep}
          </React.Fragment>
        );
      })}
    </span>
  );
}

function PenilaianWorkspaceInner({ activeTab }: { activeTab: PenilaianTab }) {
  const { school, selectedClassId, selectedClass, can, canAny, notify } = useApp();

  const showKeasramaan = Boolean(school?.enableKeasramaan && can('keasramaan', 'read'));
  const hasAcademicRead = can('penilaian', 'read');
  const canUpdateScores = can('penilaian', 'update');
  const canExportScores = can('penilaian', 'export');
  const canUpdateNotes = canAny(['penilaian', 'rapor'], 'update');
  const canUpdateKeasramaan = can('keasramaan', 'update');

  const effectiveTab: PenilaianTab =
    !hasAcademicRead && showKeasramaan ? 'keasramaan' : activeTab;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Core loaded state
  const [subjects, setSubjects] = useState<Array<{ id: number; name: string; code: string }>>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number>(0);
  const [subjectTps, setSubjectTps] = useState<SubjectTp[]>([]);
  const [weights, setWeights] = useState({ weightLm: 40, weightSts: 30, weightSas: 30, kktpMin: 75 });
  const [summativeRows, setSummativeRows] = useState<SummativeRow[]>([]);
  const [formativeByStudent, setFormativeByStudent] = useState<FormativeStudent[]>([]);
  const [cocurriculars, setCocurriculars] = useState<CocuProject[]>([]);
  const [extracurriculars, setExtracurriculars] = useState<EkstraItem[]>([]);
  const [homeroomNotes, setHomeroomNotes] = useState<HomeroomNoteItem[]>([]);
  const [keasRows, setKeasRows] = useState<KeasramaanStudentRow[]>([]);

  // View filters & selections
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number>(0);
  const [selectedEkstraId, setSelectedEkstraId] = useState<number>(0);

  // Sub-view detail state
  const [detailStudentId, setDetailStudentId] = useState<number | null>(null);

  // Formatif editor state
  const [formativeDraft, setFormativeDraft] = useState<Record<number, string>>({});

  // Sumatif editor state
  const [sumTpDraft, setSumTpDraft] = useState<Record<string, string>>({});
  const [sumManualLm, setSumManualLm] = useState({ lm1: '', lm2: '', lm3: '', lm4: '' });
  const [sumStsTes, setSumStsTes] = useState('');
  const [sumStsNonTes, setSumStsNonTes] = useState('');
  const [sumSasTes, setSumSasTes] = useState('');
  const [sumSasNonTes, setSumSasNonTes] = useState('');
  const [sumRemedial, setSumRemedial] = useState('');
  const [sumEnrichment, setSumEnrichment] = useState('');
  const [sumTeacherNote, setSumTeacherNote] = useState('');
  const [bulkUnlocked, setBulkUnlocked] = useState(false);
  const [bulkValue, setBulkValue] = useState('');

  // Sumatif weight modal
  const [weightModal, setWeightModal] = useState(false);
  const [weightForm, setWeightForm] = useState({ weightLm: 40, weightSts: 30, weightSas: 30, kktpMin: 75 });

  // Excel import modal
  const [importModeModal, setImportModeModal] = useState<'summative' | 'kokurikuler' | 'ekskul' | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);

  // Kokurikuler modal state
  const [cocuModalStudent, setCocuModalStudent] = useState<{
    studentId: number;
    fullName: string;
  } | null>(null);
  const [cocuDimDraft, setCocuDimDraft] = useState<Record<string, CocurricularPredicate>>({});
  const [cocuCustomDesc, setCocuCustomDesc] = useState<string | null>(null);

  // Ekstrakurikuler form state
  const [ekstraTpDraft, setEkstraTpDraft] = useState<Record<number, ExtracurricularPredicate>>({});
  const [ekstraFallbackPred, setEkstraFallbackPred] = useState<ExtracurricularPredicate>('Baik');

  // Keasramaan form state
  const [keasWaliAsrama, setKeasWaliAsrama] = useState('');
  const [keasWaliAsuh, setKeasWaliAsuh] = useState('');
  const [keasItemDraft, setKeasItemDraft] = useState<
    Record<number, { predicate: 'A' | 'B' | 'C'; achievedNote: string; guidanceNote: string }>
  >({});

  const syncFormatifDraft = useCallback(
    (studentId: number, rows: FormativeStudent[]) => {
      const stu = rows.find((f) => f.studentId === studentId);
      const draft: Record<number, string> = {};
      if (stu) {
        for (const item of stu.items) {
          draft[item.tpId] = item.status || 'Belum Dinilai';
        }
      }
      setFormativeDraft(draft);
    },
    []
  );

  const syncSumatifDraft = useCallback(
    (studentId: number, rows: SummativeRow[], tps: SubjectTp[]) => {
      const row = rows.find((r) => r.studentId === studentId);
      const tpDraft: Record<string, string> = {};
      for (const tp of tps) {
        const v = row?.tpScores?.[String(tp.id)];
        tpDraft[String(tp.id)] = typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
      }
      setSumTpDraft(tpDraft);
      setSumManualLm({
        lm1: row?.lm1 !== null && row?.lm1 !== undefined ? String(row.lm1) : '',
        lm2: row?.lm2 !== null && row?.lm2 !== undefined ? String(row.lm2) : '',
        lm3: row?.lm3 !== null && row?.lm3 !== undefined ? String(row.lm3) : '',
        lm4: row?.lm4 !== null && row?.lm4 !== undefined ? String(row.lm4) : '',
      });
      setSumStsTes(
        row?.stsTes !== null && row?.stsTes !== undefined
          ? String(row.stsTes)
          : row?.sts !== null && row?.sts !== undefined
          ? String(row.sts)
          : ''
      );
      setSumStsNonTes(
        row?.stsNonTes !== null && row?.stsNonTes !== undefined ? String(row.stsNonTes) : ''
      );
      setSumSasTes(
        row?.sasTes !== null && row?.sasTes !== undefined
          ? String(row.sasTes)
          : row?.sas !== null && row?.sas !== undefined
          ? String(row.sas)
          : ''
      );
      setSumSasNonTes(
        row?.sasNonTes !== null && row?.sasNonTes !== undefined ? String(row.sasNonTes) : ''
      );
      setSumRemedial(row?.remedialScore !== null && row?.remedialScore !== undefined ? String(row.remedialScore) : '');
      setSumEnrichment(row?.enrichmentNote || '');
      setSumTeacherNote(row?.teacherNote || '');
      setBulkUnlocked(false);
      setBulkValue('');
    },
    []
  );

  const loadData = useCallback(
    async (overrideSubjectId?: number, activeDetailId?: number | null) => {
      const subIdToFetch = overrideSubjectId !== undefined ? overrideSubjectId : selectedSubjectId;
      const params = new URLSearchParams();
      if (selectedClassId) params.set('classId', String(selectedClassId));
      if (subIdToFetch) params.set('subjectId', String(subIdToFetch));

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
        const loadedTps = (json.subjectTps || []) as SubjectTp[];
        const loadedSum = (json.summativeRows || []) as SummativeRow[];
        const loadedForm = (json.formativeByStudent || []) as FormativeStudent[];

        setSubjects(json.subjects || []);
        if (!subIdToFetch && json.selectedSubject?.id) {
          setSelectedSubjectId(json.selectedSubject.id);
        }
        setSubjectTps(loadedTps);
        setWeights(json.weights || { weightLm: 40, weightSts: 30, weightSas: 30, kktpMin: 75 });
        setWeightForm(json.weights || { weightLm: 40, weightSts: 30, weightSas: 30, kktpMin: 75 });
        setSummativeRows(loadedSum);
        setFormativeByStudent(loadedForm);
        const cocuList = (json.cocurricularProjects || []) as CocuProject[];
        setCocurriculars(cocuList);
        setSelectedProjectId((prev) =>
          cocuList.some((p) => p.id === prev) ? prev : cocuList[0]?.id || 0
        );
        const eksList = (json.extracurriculars || []) as EkstraItem[];
        setExtracurriculars(eksList);
        setSelectedEkstraId((prev) =>
          eksList.some((e) => e.id === prev) ? prev : eksList[0]?.id || 0
        );
        setHomeroomNotes(json.homeroomNotes || []);

        const stuId = activeDetailId !== undefined ? activeDetailId : detailStudentId;
        if (stuId) {
          if (effectiveTab === 'formatif') syncFormatifDraft(stuId, loadedForm);
          if (effectiveTab === 'sumatif') syncSumatifDraft(stuId, loadedSum, loadedTps);
        }
      }

      if (keasRes && keasRes.ok) {
        const kJson = await keasRes.json();
        setKeasRows(kJson.studentRows || []);
      }

      setLoading(false);
    },
    [
      selectedClassId,
      selectedSubjectId,
      hasAcademicRead,
      showKeasramaan,
      detailStudentId,
      effectiveTab,
      syncFormatifDraft,
      syncSumatifDraft,
    ]
  );

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadData();
    });
  }, [loadData]);

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) || subjects[0] || null,
    [subjects, selectedSubjectId]
  );

  const activeProject = useMemo(
    () => cocurriculars.find((p) => p.id === selectedProjectId) || cocurriculars[0] || null,
    [cocurriculars, selectedProjectId]
  );

  const activeEkstra = useMemo(
    () => extracurriculars.find((e) => e.id === selectedEkstraId) || extracurriculars[0] || null,
    [extracurriculars, selectedEkstraId]
  );

  const handleSubjectChange = async (nextSubId: number) => {
    setSelectedSubjectId(nextSubId);
    await loadData(nextSubId, detailStudentId);
  };

  const openFormatifStudent = (studentId: number) => {
    syncFormatifDraft(studentId, formativeByStudent);
    setDetailStudentId(studentId);
  };

  const openSumatifStudent = (studentId: number) => {
    syncSumatifDraft(studentId, summativeRows, subjectTps);
    setDetailStudentId(studentId);
  };

  const openEkstraStudent = (studentId: number) => {
    if (!activeEkstra) return;
    const existing = activeEkstra.scores.find((s) => s.studentId === studentId);
    const draft: Record<number, ExtracurricularPredicate> = {};
    activeEkstra.objectives.forEach((obj, idx) => {
      const matched = existing?.tpScores?.find((t) => t.objective === obj);
      const fallback =
        existing?.predicate && existing.predicate !== '-'
          ? (existing.predicate as ExtracurricularPredicate)
          : 'Baik';
      draft[idx] = (matched?.predicate as ExtracurricularPredicate) || fallback;
    });
    setEkstraTpDraft(draft);
    setEkstraFallbackPred(
      existing?.predicate && existing.predicate !== '-'
        ? (existing.predicate as ExtracurricularPredicate)
        : 'Baik'
    );
    setDetailStudentId(studentId);
  };

  const openKeasramaanStudent = (studentId: number) => {
    const stu = keasRows.find((r) => r.studentId === studentId);
    if (!stu) return;
    setKeasWaliAsrama(stu.waliAsramaName || '');
    setKeasWaliAsuh(stu.waliAsuhName || '');
    const draft: Record<
      number,
      { predicate: 'A' | 'B' | 'C'; achievedNote: string; guidanceNote: string }
    > = {};
    for (const item of stu.items) {
      draft[item.indicatorId] = {
        predicate: item.predicate || 'B',
        achievedNote: item.achievedNote || '',
        guidanceNote: item.guidanceNote || '',
      };
    }
    setKeasItemDraft(draft);
    setDetailStudentId(studentId);
  };

  // Live Sumatif calculations for active detail student
  const liveSumatif = useMemo(() => {
    const parseOpt = (raw: string): number | null => {
      const t = raw.trim().replace(',', '.');
      if (!t) return null;
      const n = Number(t);
      return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
    };

    const tpNumMap: Record<string, number | null> = {};
    for (const tp of subjectTps) {
      tpNumMap[String(tp.id)] = parseOpt(sumTpDraft[String(tp.id)] || '');
    }

    let lmAvg: number | null = null;
    let scopes: ReturnType<typeof computeScopeAveragesFromTpScores>['scopes'] = [];

    if (subjectTps.length > 0) {
      const scopeCalc = computeScopeAveragesFromTpScores(subjectTps, tpNumMap);
      scopes = scopeCalc.scopes;
      lmAvg = scopeCalc.lmAverage;
    } else {
      const manualVals = [
        parseOpt(sumManualLm.lm1),
        parseOpt(sumManualLm.lm2),
        parseOpt(sumManualLm.lm3),
        parseOpt(sumManualLm.lm4),
      ].filter((v): v is number => v !== null);
      lmAvg =
        manualVals.length > 0
          ? Number((manualVals.reduce((a, b) => a + b, 0) / manualVals.length).toFixed(2))
          : null;
    }

    const stsTesN = parseOpt(sumStsTes);
    const stsNonTesN = parseOpt(sumStsNonTes);
    const naSts = computeAverageTwo(stsTesN, stsNonTesN);

    const sasTesN = parseOpt(sumSasTes);
    const sasNonTesN = parseOpt(sumSasNonTes);
    const naSas = computeAverageTwo(sasTesN, sasNonTesN);

    const remN = parseOpt(sumRemedial);
    const effectiveLm =
      lmAvg !== null && remN !== null && remN > lmAvg
        ? Math.min(remN, weights.kktpMin)
        : lmAvg;

    const wLm = weights.weightLm / 100;
    const wSts = weights.weightSts / 100;
    const wSas = weights.weightSas / 100;

    let midtermPreview: number | null = null;
    if (effectiveLm !== null && naSts !== null) {
      midtermPreview = Number(
        (
          (effectiveLm * weights.weightLm + naSts * weights.weightSts) /
          Math.max(1, weights.weightLm + weights.weightSts)
        ).toFixed(2)
      );
    } else {
      midtermPreview = effectiveLm ?? naSts;
    }

    let finalPreview: number | null = null;
    if (effectiveLm !== null || naSts !== null || naSas !== null) {
      finalPreview = Number(
        ((effectiveLm ?? 0) * wLm + (naSts ?? 0) * wSts + (naSas ?? 0) * wSas).toFixed(2)
      );
    }

    return {
      tpNumMap,
      scopes,
      lmAvg,
      stsTesN,
      stsNonTesN,
      naSts,
      sasTesN,
      sasNonTesN,
      naSas,
      remN,
      midtermPreview,
      finalPreview,
    };
  }, [
    subjectTps,
    sumTpDraft,
    sumManualLm,
    sumStsTes,
    sumStsNonTes,
    sumSasTes,
    sumSasNonTes,
    sumRemedial,
    weights,
  ]);

  // Save handlers
  const handleSaveFormatifStudent = async () => {
    if (!selectedClass || !selectedSubjectId || !detailStudentId) return;
    setSaving(true);
    const entries = subjectTps.map((tp) => ({
      learningObjectiveId: tp.id,
      status: (formativeDraft[tp.id] || 'Belum Dinilai') as
        | 'Tercapai'
        | 'Perlu Bimbingan'
        | 'Belum Dinilai',
      notes: '',
    }));
    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'formative_batch',
        studentId: detailStudentId,
        subjectId: selectedSubjectId,
        classId: selectedClass.id,
        entries,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan asesmen formatif.');
      return;
    }
    notify('success', 'Asesmen formatif murid tersimpan.');
    await loadData(selectedSubjectId, detailStudentId);
  };

  const handleSaveSumatifStudent = async () => {
    if (!selectedClass || !selectedSubjectId || !detailStudentId) return;
    setSaving(true);

    const parseOpt = (raw: string): number | null => {
      const t = raw.trim().replace(',', '.');
      if (!t) return null;
      const n = Number(t);
      return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
    };

    const payload: Record<string, unknown> = {
      kind: 'summative',
      studentId: detailStudentId,
      subjectId: selectedSubjectId,
      classId: selectedClass.id,
      stsTes: liveSumatif.stsTesN,
      stsNonTes: liveSumatif.stsNonTesN,
      sasTes: liveSumatif.sasTesN,
      sasNonTes: liveSumatif.sasNonTesN,
      sts: liveSumatif.naSts,
      sas: liveSumatif.naSas,
      remedialScore: liveSumatif.remN,
      enrichmentNote: sumEnrichment,
      teacherNote: sumTeacherNote,
    };

    if (subjectTps.length > 0) {
      payload.tpScores = liveSumatif.tpNumMap;
    } else {
      payload.lm1 = parseOpt(sumManualLm.lm1);
      payload.lm2 = parseOpt(sumManualLm.lm2);
      payload.lm3 = parseOpt(sumManualLm.lm3);
      payload.lm4 = parseOpt(sumManualLm.lm4);
    }

    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan nilai sumatif.');
      return;
    }
    notify('success', 'Nilai sumatif tersimpan dan otomatis masuk ke Rapor.');
    await loadData(selectedSubjectId, detailStudentId);
  };

  const handleSaveWeights = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !selectedSubjectId) return;
    const sum =
      Number(weightForm.weightLm) + Number(weightForm.weightSts) + Number(weightForm.weightSas);
    if (sum !== 100) {
      notify('error', `Total bobot harus tepat 100% (saat ini ${sum}%).`);
      return;
    }
    setSaving(true);
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
    setSaving(false);
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan bobot.');
      return;
    }
    setWeightModal(false);
    notify('success', 'Bobot nilai & KKTP diperbarui dan nilai dihitung ulang.');
    await loadData(selectedSubjectId, detailStudentId);
  };

  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || !selectedClass || !importModeModal) return;
    setSaving(true);
    const fd = new FormData();
    fd.append('file', importFile);
    fd.append('mode', importModeModal);
    fd.append('classId', String(selectedClass.id));
    if (importModeModal === 'summative') fd.append('subjectId', String(selectedSubjectId));
    if (importModeModal === 'kokurikuler' && activeProject)
      fd.append('projectId', String(activeProject.id));
    if (importModeModal === 'ekskul' && activeEkstra)
      fd.append('extracurricularId', String(activeEkstra.id));

    const res = await fetch('/api/assessments/excel', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: fd,
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      notify('error', json.error || 'Gagal mengimpor berkas Excel.');
      return;
    }
    setImportModeModal(null);
    setImportFile(null);
    notify('success', `${json.updated} nilai murid berhasil diimpor dari Excel.`);
    await loadData();
  };

  const openCocuModal = (stu: {
    studentId: number;
    fullName: string;
    dimensionScores: Record<string, string>;
    predicate: string;
    description: string;
  }) => {
    if (!activeProject) return;
    const init: Record<string, CocurricularPredicate> = {};
    for (const dim of activeProject.dimensions) {
      const existing = stu.dimensionScores?.[dim];
      init[dim] =
        (existing as CocurricularPredicate) ||
        ((stu.predicate as CocurricularPredicate) || 'Baik');
    }
    setCocuDimDraft(init);
    setCocuCustomDesc(null);
    setCocuModalStudent({ studentId: stu.studentId, fullName: stu.fullName });
  };

  const handleSaveCocuScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !cocuModalStudent) return;
    setSaving(true);
    const preview = buildCocurricularDescription(activeProject.dimensions, cocuDimDraft);
    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'cocurricular_score',
        projectId: activeProject.id,
        studentId: cocuModalStudent.studentId,
        predicate: preview.predicate,
        dimensionScores: cocuDimDraft,
        description: cocuCustomDesc !== null ? cocuCustomDesc : preview.description,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan nilai kokurikuler.');
      return;
    }
    setCocuModalStudent(null);
    notify('success', 'Nilai kokurikuler tersimpan.');
    await loadData();
  };

  const handleSaveEkstraStudent = async () => {
    if (!activeEkstra || !detailStudentId) return;
    setSaving(true);
    const tpScores = activeEkstra.objectives.map((obj, idx) => ({
      objective: obj,
      predicate: ekstraTpDraft[idx] || 'Baik',
    }));
    const generated =
      tpScores.length > 0
        ? buildExtracurricularDescription(tpScores, ekstraFallbackPred)
        : {
            predicate: ekstraFallbackPred,
            description: `Ananda ${ekstraFallbackPred.toLowerCase()} dalam berpartisipasi aktif pada kegiatan ${activeEkstra.name}.`,
          };

    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'extracurricular_score',
        extracurricularId: activeEkstra.id,
        studentId: detailStudentId,
        predicate: generated.predicate,
        tpScores,
        description: generated.description,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan nilai ekstrakurikuler.');
      return;
    }
    notify('success', 'Nilai ekstrakurikuler tersimpan.');
    await loadData();
  };

  const handleSaveKeasramaanStudent = async () => {
    if (!selectedClass || !detailStudentId) return;
    const stu = keasRows.find((r) => r.studentId === detailStudentId);
    if (!stu) return;
    setSaving(true);
    const entries = stu.items.map((item) => {
      const draft = keasItemDraft[item.indicatorId] || {
        predicate: item.predicate,
        achievedNote: item.achievedNote,
        guidanceNote: item.guidanceNote,
      };
      return {
        studentId: stu.studentId,
        indicatorId: item.indicatorId,
        predicate: draft.predicate,
        achievedNote: draft.achievedNote,
        guidanceNote: draft.guidanceNote,
        notes: '',
        waliAsramaName: keasWaliAsrama,
        waliAsuhName: keasWaliAsuh,
      };
    });
    const res = await fetch('/api/keasramaan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'save_scores',
        classId: selectedClass.id,
        entries,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan nilai keasramaan.');
      return;
    }
    notify('success', 'Nilai pembinaan keasramaan murid tersimpan.');
    await loadData();
  };

  const handleSaveAllHomeroomNotes = async () => {
    if (!selectedClass || homeroomNotes.length === 0) return;
    setSaving(true);
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
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan catatan wali kelas.');
      return;
    }
    notify('success', 'Seluruh catatan wali kelas berhasil disimpan.');
    await loadData();
  };

  const applyBulkSumatif = (includeExams: boolean) => {
    const cleaned = bulkValue.trim().replace(',', '.');
    const n = Number(cleaned);
    if (!cleaned || !Number.isFinite(n) || n < 0 || n > 100) {
      notify('error', 'Masukkan nilai angka antara 0 sampai 100.');
      return;
    }
    const strVal = String(n);
    if (subjectTps.length > 0) {
      const next: Record<string, string> = {};
      for (const tp of subjectTps) next[String(tp.id)] = strVal;
      setSumTpDraft(next);
    } else {
      setSumManualLm({ lm1: strVal, lm2: strVal, lm3: strVal, lm4: strVal });
    }
    if (includeExams) {
      setSumStsTes(strVal);
      setSumStsNonTes(strVal);
      setSumSasTes(strVal);
      setSumSasNonTes(strVal);
    }
    notify(
      'success',
      includeExams
        ? `Nilai ${strVal} diterapkan ke semua komponen.`
        : `Nilai ${strVal} diterapkan ke seluruh Tujuan Pembelajaran.`
    );
  };

  // Filtered lists
  const qLower = searchQuery.trim().toLowerCase();
  const filteredFormative = useMemo(
    () =>
      qLower
        ? formativeByStudent.filter((f) => f.fullName.toLowerCase().includes(qLower))
        : formativeByStudent,
    [formativeByStudent, qLower]
  );
  const filteredSummative = useMemo(
    () =>
      qLower
        ? summativeRows.filter((s) => s.fullName.toLowerCase().includes(qLower))
        : summativeRows,
    [summativeRows, qLower]
  );
  const filteredCocuScores = useMemo(() => {
    const list = activeProject?.scores || [];
    return qLower ? list.filter((s) => s.fullName.toLowerCase().includes(qLower)) : list;
  }, [activeProject, qLower]);
  const filteredEkstraScores = useMemo(() => {
    const list = activeEkstra?.scores || [];
    return qLower ? list.filter((s) => s.fullName.toLowerCase().includes(qLower)) : list;
  }, [activeEkstra, qLower]);
  const filteredKeasRows = useMemo(
    () => (qLower ? keasRows.filter((k) => k.fullName.toLowerCase().includes(qLower)) : keasRows),
    [keasRows, qLower]
  );
  const filteredHomeroom = useMemo(
    () =>
      qLower
        ? homeroomNotes.filter((h) => h.fullName.toLowerCase().includes(qLower))
        : homeroomNotes,
    [homeroomNotes, qLower]
  );

  const pageTitle = (() => {
    if (effectiveTab === 'formatif') {
      return detailStudentId ? 'Form Asesmen Formatif' : 'Asesmen Formatif';
    }
    if (effectiveTab === 'sumatif') {
      return detailStudentId ? 'Form Asesmen Sumatif' : 'Asesmen Sumatif';
    }
    if (effectiveTab === 'kokurikuler') return 'Asesmen Kokurikuler';
    if (effectiveTab === 'ekstrakurikuler') {
      return detailStudentId ? 'Form Asesmen Ekstrakurikuler' : 'Nilai Ekstrakurikuler';
    }
    if (effectiveTab === 'keasramaan') {
      return detailStudentId ? 'Form Nilai Keasramaan' : 'Daftar Nilai Keasramaan';
    }
    return 'Catatan Wali Kelas';
  })();

  const requiredModule =
    effectiveTab === 'keasramaan'
      ? (['keasramaan'] as const)
      : effectiveTab === 'catatan'
      ? (['penilaian', 'rapor'] as const)
      : (['penilaian', 'keasramaan', 'rapor'] as const);

  return (
    <AppShell title={pageTitle} requiredModule={[...requiredModule]}>
      <div className="space-y-4">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : effectiveTab === 'keasramaan' && !showKeasramaan ? (
          <AlertBox variant="warning" title="Modul Keasramaan Belum Aktif">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Aktifkan program Keasramaan di Pengaturan Sekolah terlebih dahulu untuk mengisi nilai asrama.
              </span>
              <Link
                href="/pengaturan"
                className="inline-flex items-center gap-1 font-semibold underline"
              >
                Buka Pengaturan <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </AlertBox>
        ) : effectiveTab === 'formatif' ? (
          /* ================= FORMATIF ================= */
          detailStudentId ? (
            (() => {
              const stu = formativeByStudent.find((s) => s.studentId === detailStudentId);
              if (!stu) return null;
              return (
                <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setDetailStudentId(null)}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Kembali
                    </Button>
                    {canUpdateScores && subjectTps.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const next: Record<number, string> = {};
                            for (const tp of subjectTps) next[tp.id] = 'Tercapai';
                            setFormativeDraft(next);
                          }}
                        >
                          Tandai Semua Ya
                        </Button>
                        <Button
                          size="sm"
                          loading={saving}
                          onClick={handleSaveFormatifStudent}
                        >
                          <Save className="w-4 h-4" />
                          Simpan
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select
                      aria-label="Mata pelajaran"
                      value={selectedSubjectId}
                      onChange={(e) => void handleSubjectChange(Number(e.target.value))}
                    >
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </Select>
                    <StudentCombobox
                      students={formativeByStudent}
                      selectedId={stu.studentId}
                      onSelect={(id) => openFormatifStudent(id)}
                    />
                  </div>

                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Apakah <span className="text-[#0F2942] dark:text-sky-300">{stu.fullName}</span> telah memenuhi setiap tujuan pembelajaran{' '}
                    {selectedSubject?.name || ''}?
                  </p>

                  {subjectTps.length === 0 ? (
                    <EmptyState
                      title="Belum ada Tujuan Pembelajaran (TP)"
                      description="Tambahkan Tujuan Pembelajaran pada mata pelajaran ini terlebih dahulu."
                      action={
                        <Link
                          href="/intrakurikuler"
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-[#0F2942] text-white"
                        >
                          Kelola TP di Mata Pelajaran
                        </Link>
                      }
                    />
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <th className="py-2.5 px-3 text-left w-12">No</th>
                            <th className="py-2.5 px-3 text-left">Tujuan Pembelajaran</th>
                            <th className="py-2.5 px-3 text-center w-20">Ya</th>
                            <th className="py-2.5 px-3 text-center w-20">Tidak</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {subjectTps.map((tp, idx) => {
                            const status = formativeDraft[tp.id] || 'Belum Dinilai';
                            const isYa = status === 'Tercapai';
                            const isTidak = status === 'Perlu Bimbingan';
                            return (
                              <tr
                                key={tp.id}
                                className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors"
                              >
                                <td className="py-3 px-3 text-xs font-medium text-slate-500 tabular-nums align-top">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-3">
                                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                                    {tp.description}
                                  </p>
                                  <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mt-1">
                                    {tp.scopeMaterial}
                                  </p>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <button
                                    type="button"
                                    disabled={!canUpdateScores}
                                    aria-label={`Ya untuk TP ${idx + 1}`}
                                    aria-pressed={isYa}
                                    onClick={() =>
                                      setFormativeDraft((prev) => ({
                                        ...prev,
                                        [tp.id]: isYa ? 'Belum Dinilai' : 'Tercapai',
                                      }))
                                    }
                                    className={cn(
                                      'w-6 h-6 rounded border inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50',
                                      isYa
                                        ? 'bg-[#0F2942] border-[#0F2942] text-white dark:bg-sky-600 dark:border-sky-600'
                                        : 'bg-white dark:bg-[#0F172A] border-slate-300 dark:border-slate-600 hover:border-slate-400'
                                    )}
                                  >
                                    {isYa && <Check className="w-4 h-4 stroke-[2.5]" />}
                                  </button>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <button
                                    type="button"
                                    disabled={!canUpdateScores}
                                    aria-label={`Tidak untuk TP ${idx + 1}`}
                                    aria-pressed={isTidak}
                                    onClick={() =>
                                      setFormativeDraft((prev) => ({
                                        ...prev,
                                        [tp.id]: isTidak ? 'Belum Dinilai' : 'Perlu Bimbingan',
                                      }))
                                    }
                                    className={cn(
                                      'w-6 h-6 rounded border inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50',
                                      isTidak
                                        ? 'bg-red-600 border-red-600 text-white'
                                        : 'bg-white dark:bg-[#0F172A] border-slate-300 dark:border-slate-600 hover:border-slate-400'
                                    )}
                                  >
                                    {isTidak && <Check className="w-4 h-4 stroke-[2.5]" />}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Daftar Nilai Formatif - {selectedSubject?.name || 'Mata Pelajaran'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Kelas aktif: {selectedClass?.name || '-'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  aria-label="Pilih mata pelajaran formatif"
                  value={selectedSubjectId}
                  onChange={(e) => void handleSubjectChange(Number(e.target.value))}
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </Select>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama murid..."
                    className="w-full h-10 pl-9 pr-3 text-sm bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8]"
                  />
                </div>
              </div>

              {filteredFormative.length === 0 ? (
                <EmptyState
                  title="Belum ada murid pada pencarian ini"
                  description="Pastikan rombel aktif memiliki murid atau ubah kata kunci pencarian."
                />
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <th className="py-2.5 px-3 text-left w-12">No</th>
                        <th className="py-2.5 px-3 text-left min-w-[160px]">Nama</th>
                        <th className="py-2.5 px-3 text-left w-28">Aksi</th>
                        <th className="py-2.5 px-3 text-left min-w-[260px]">Progres</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredFormative.map((stu, idx) => (
                        <tr
                          key={stu.studentId}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors"
                        >
                          <td className="py-3 px-3 text-xs text-slate-500 tabular-nums align-top">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3 text-xs font-medium text-slate-900 dark:text-slate-100 align-top">
                            {stu.fullName}
                          </td>
                          <td className="py-3 px-3 align-top">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openFormatifStudent(stu.studentId)}
                            >
                              <PenLine className="w-3.5 h-3.5" />
                              Nilai
                            </Button>
                          </td>
                          <td className="py-3 px-3 align-top">
                            {renderFormativeProgressSummary(stu.items)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        ) : effectiveTab === 'sumatif' ? (
          /* ================= SUMATIF ================= */
          detailStudentId ? (
            (() => {
              const stu = summativeRows.find((r) => r.studentId === detailStudentId);
              if (!stu) return null;
              const equalPct =
                subjectTps.length > 0 ? (100 / subjectTps.length).toFixed(2) : '0.00';
              const filledScopeCount = liveSumatif.scopes.filter((s) => s.filledCount > 0).length;
              const filledScopeWeightPct =
                subjectTps.length > 0
                  ? Math.round(
                      (liveSumatif.scopes.reduce(
                        (acc, s) => acc + (s.filledCount > 0 ? s.totalTp : 0),
                        0
                      ) /
                        subjectTps.length) *
                        100
                    )
                  : 0;

              return (
                <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setDetailStudentId(null)}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Kembali
                      </Button>
                      {canUpdateScores && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBulkUnlocked((v) => !v)}
                        >
                          {bulkUnlocked ? (
                            <Unlock className="w-3.5 h-3.5 text-amber-600" />
                          ) : (
                            <Lock className="w-3.5 h-3.5" />
                          )}
                          {bulkUnlocked
                            ? 'Isi Sekaligus (Terbuka)'
                            : 'Isi Sekaligus (Terkunci)'}
                        </Button>
                      )}
                    </div>
                    {canUpdateScores && (
                      <Button
                        size="sm"
                        loading={saving}
                        onClick={handleSaveSumatifStudent}
                      >
                        <Save className="w-4 h-4" />
                        Simpan
                      </Button>
                    )}
                  </div>

                  {bulkUnlocked && canUpdateScores && (
                    <div className="p-3.5 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 flex flex-wrap items-center gap-2.5">
                      <span className="text-xs font-medium text-amber-900 dark:text-amber-200">
                        Isi nilai cepat (0–100):
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={bulkValue}
                        onChange={(e) => setBulkValue(e.target.value)}
                        placeholder="Contoh: 85"
                        className="w-28 h-8 px-2.5 text-xs bg-white dark:bg-[#0F172A] border border-amber-300 dark:border-amber-800 rounded"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyBulkSumatif(false)}
                      >
                        Terapkan ke Semua TP
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => applyBulkSumatif(true)}
                      >
                        Terapkan ke Semua (TP, STS, SAS)
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select
                      aria-label="Pilih mata pelajaran sumatif"
                      value={selectedSubjectId}
                      onChange={(e) => void handleSubjectChange(Number(e.target.value))}
                    >
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </Select>
                    <StudentCombobox
                      students={summativeRows}
                      selectedId={stu.studentId}
                      onSelect={(id) => openSumatifStudent(id)}
                    />
                  </div>

                  {/* Section 1: TP / Lingkup Materi */}
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Isi nilai harian tiap tujuan pembelajaran untuk{' '}
                      <span className="text-[#0F2942] dark:text-sky-300">{stu.fullName}</span>.
                    </p>

                    {subjectTps.length > 0 ? (
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                              <th className="py-2.5 px-3 text-left w-12">No</th>
                              <th className="py-2.5 px-3 text-left">Tujuan Pembelajaran</th>
                              <th className="py-2.5 px-3 text-right w-36">Nilai</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {subjectTps.map((tp, idx) => (
                              <tr key={tp.id}>
                                <td className="py-3 px-3 text-xs text-slate-500 tabular-nums align-top">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-3">
                                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                                    {tp.description}
                                  </p>
                                  <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mt-1 tabular-nums">
                                    {tp.scopeMaterial} &bull; BOBOT {equalPct}%
                                  </p>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.01"
                                    disabled={!canUpdateScores}
                                    placeholder="Isi nilai"
                                    aria-label={`Nilai TP ${idx + 1}`}
                                    value={sumTpDraft[String(tp.id)] ?? ''}
                                    onChange={(e) =>
                                      setSumTpDraft((prev) => ({
                                        ...prev,
                                        [String(tp.id)]: e.target.value,
                                      }))
                                    }
                                    className="w-28 h-9 px-2.5 text-sm text-right tabular-nums bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8] disabled:opacity-60"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <AlertBox variant="info">
                          Mata pelajaran ini belum memiliki daftar Tujuan Pembelajaran. Anda tetap dapat mengisi nilai Lingkup Materi (LM 1–4) di bawah ini atau menambahkan TP di menu Mata Pelajaran.
                        </AlertBox>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {(['lm1', 'lm2', 'lm3', 'lm4'] as const).map((k, idx) => (
                            <Input
                              key={k}
                              label={`Nilai LM ${idx + 1}`}
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              disabled={!canUpdateScores}
                              placeholder="Isi nilai"
                              value={sumManualLm[k]}
                              onChange={(e) =>
                                setSumManualLm((prev) => ({ ...prev, [k]: e.target.value }))
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* NA Sumatif Lingkup Materi Card */}
                    <div className="rounded-md border border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/30 p-4 flex items-start gap-3">
                      <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 mt-1 shrink-0" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                          NA Sumatif Lingkup Materi
                        </p>
                        <p className="text-xl font-bold tabular-nums text-sky-600 dark:text-sky-300">
                          {formatScoreNum(liveSumatif.lmAvg)}
                        </p>
                        {subjectTps.length > 0 && (
                          <>
                            <p className="text-xs text-sky-700/80 dark:text-sky-300/80">
                              Rata-rata dari {filledScopeCount} lingkup materi (cakupan TP terisi{' '}
                              {filledScopeWeightPct}%)
                            </p>
                            <div className="pt-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                              {liveSumatif.scopes.map((sc) => {
                                const scopeWeight = ((sc.totalTp / subjectTps.length) * 100).toFixed(
                                  2
                                );
                                return (
                                  <p key={sc.scopeMaterial} className="tabular-nums">
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                      {sc.scopeMaterial}:
                                    </span>{' '}
                                    {formatScoreNum(sc.average)}{' '}
                                    <span className="text-slate-400">(Bobot {scopeWeight}%)</span>
                                  </p>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 2: STS */}
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Isi Sumatif Tengah Semester di bawah ini untuk{' '}
                      <span className="text-[#0F2942] dark:text-sky-300">{stu.fullName}</span>{' '}
                      (opsional).
                    </p>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <th className="py-2.5 px-3 text-left w-12">No</th>
                            <th className="py-2.5 px-3 text-left">Jenis Tes</th>
                            <th className="py-2.5 px-3 text-right w-36">Nilai</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          <tr>
                            <td className="py-3 px-3 text-xs text-slate-500">1</td>
                            <td className="py-3 px-3 text-xs font-medium text-slate-900 dark:text-slate-100">
                              Nilai Tes Sumatif Tengah Semester (STS)
                            </td>
                            <td className="py-3 px-3 text-right">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                disabled={!canUpdateScores}
                                placeholder="Isi nilai"
                                aria-label="Nilai Tes STS"
                                value={sumStsTes}
                                onChange={(e) => setSumStsTes(e.target.value)}
                                className="w-28 h-9 px-2.5 text-sm text-right tabular-nums bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-md"
                              />
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 px-3 text-xs text-slate-500">2</td>
                            <td className="py-3 px-3 text-xs font-medium text-slate-900 dark:text-slate-100">
                              Nilai Non Tes Sumatif Tengah Semester (STS)
                            </td>
                            <td className="py-3 px-3 text-right">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                disabled={!canUpdateScores}
                                placeholder="Isi nilai"
                                aria-label="Nilai Non Tes STS"
                                value={sumStsNonTes}
                                onChange={(e) => setSumStsNonTes(e.target.value)}
                                className="w-28 h-9 px-2.5 text-sm text-right tabular-nums bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-md"
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="rounded-md border border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/30 p-4 flex items-start gap-3">
                      <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 mt-1 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                          NA Sumatif Tengah Semester
                        </p>
                        <p className="text-xl font-bold tabular-nums text-sky-600 dark:text-sky-300 mt-0.5">
                          {formatScoreNum(liveSumatif.naSts)}
                        </p>
                        <p className="text-xs text-sky-700/80 dark:text-sky-300/80">
                          Rata-rata dari nilai Tes dan Non Tes STS
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: SAS */}
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Isi Sumatif Akhir Semester di bawah ini untuk{' '}
                      <span className="text-[#0F2942] dark:text-sky-300">{stu.fullName}</span>.
                    </p>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <th className="py-2.5 px-3 text-left w-12">No</th>
                            <th className="py-2.5 px-3 text-left">Jenis Tes</th>
                            <th className="py-2.5 px-3 text-right w-36">Nilai</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          <tr>
                            <td className="py-3 px-3 text-xs text-slate-500">1</td>
                            <td className="py-3 px-3 text-xs font-medium text-slate-900 dark:text-slate-100">
                              Nilai Tes Sumatif Akhir Semester (SAS)
                            </td>
                            <td className="py-3 px-3 text-right">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                disabled={!canUpdateScores}
                                placeholder="Isi nilai"
                                aria-label="Nilai Tes SAS"
                                value={sumSasTes}
                                onChange={(e) => setSumSasTes(e.target.value)}
                                className="w-28 h-9 px-2.5 text-sm text-right tabular-nums bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-md"
                              />
                            </td>
                          </tr>
                          <tr>
                            <td className="py-3 px-3 text-xs text-slate-500">2</td>
                            <td className="py-3 px-3 text-xs font-medium text-slate-900 dark:text-slate-100">
                              Nilai Non Tes Sumatif Akhir Semester (SAS)
                            </td>
                            <td className="py-3 px-3 text-right">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                disabled={!canUpdateScores}
                                placeholder="Isi nilai"
                                aria-label="Nilai Non Tes SAS"
                                value={sumSasNonTes}
                                onChange={(e) => setSumSasNonTes(e.target.value)}
                                className="w-28 h-9 px-2.5 text-sm text-right tabular-nums bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-md"
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="rounded-md border border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/30 p-4 flex items-start gap-3">
                      <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 mt-1 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                          NA Sumatif Akhir Semester
                        </p>
                        <p className="text-xl font-bold tabular-nums text-sky-600 dark:text-sky-300 mt-0.5">
                          {formatScoreNum(liveSumatif.naSas)}
                        </p>
                        <p className="text-xs text-sky-700/80 dark:text-sky-300/80">
                          Rata-rata dari nilai Tes dan Non Tes SAS
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Pratinjau Rapor & Catatan Opsional */}
                  <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
                        <p className="text-[11px] font-medium text-slate-500">
                          Pratinjau Nilai Tengah Semester (Bobot LM {weights.weightLm}% · STS{' '}
                          {weights.weightSts}%)
                        </p>
                        <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                          {formatScoreNum(liveSumatif.midtermPreview)}
                        </p>
                      </div>
                      <div className="p-3 rounded bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
                        <p className="text-[11px] font-medium text-slate-500">
                          Pratinjau Nilai Rapor Semester (LM {weights.weightLm}% · STS{' '}
                          {weights.weightSts}% · SAS {weights.weightSas}%)
                        </p>
                        <p className="text-lg font-bold tabular-nums text-[#0F2942] dark:text-sky-300 mt-0.5">
                          {formatScoreNum(liveSumatif.finalPreview)}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input
                        label="Nilai Remedial (Opsional)"
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        disabled={!canUpdateScores}
                        placeholder="Batas KKTP"
                        value={sumRemedial}
                        onChange={(e) => setSumRemedial(e.target.value)}
                      />
                      <Input
                        label="Catatan Pengayaan (Opsional)"
                        disabled={!canUpdateScores}
                        value={sumEnrichment}
                        onChange={(e) => setSumEnrichment(e.target.value)}
                      />
                      <Input
                        label="Catatan Guru Mapel (Opsional)"
                        disabled={!canUpdateScores}
                        value={sumTeacherNote}
                        onChange={(e) => setSumTeacherNote(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Daftar Nilai Sumatif - {selectedSubject?.name || 'Mata Pelajaran'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Kelas aktif: {selectedClass?.name || '-'}
                  </p>
                </div>
                {canUpdateScores && (
                  <Button variant="outline" size="sm" onClick={() => setWeightModal(true)}>
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Atur Bobot
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex-1 min-w-[200px]">
                  <Select
                    aria-label="Pilih mata pelajaran sumatif"
                    value={selectedSubjectId}
                    onChange={(e) => void handleSubjectChange(Number(e.target.value))}
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </Select>
                </div>
                {canExportScores && selectedClass && selectedSubjectId > 0 && (
                  <a
                    href={`/api/assessments/excel?mode=template&classId=${selectedClass.id}&subjectId=${selectedSubjectId}`}
                    className="inline-flex items-center gap-2 h-10 px-3 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111C2E] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Unduh Template
                  </a>
                )}
                {canUpdateScores && (
                  <Button variant="outline" onClick={() => setImportModeModal('summative')}>
                    <Upload className="w-3.5 h-3.5" />
                    Import Nilai
                  </Button>
                )}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama murid..."
                  className="w-full h-10 pl-9 pr-3 text-sm bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8]"
                />
              </div>

              {filteredSummative.length === 0 ? (
                <EmptyState
                  title="Belum ada data murid"
                  description="Tambahkan murid ke rombel ini atau sesuaikan kata kunci pencarian."
                />
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <th className="py-2.5 px-3 text-left w-12">No</th>
                        <th className="py-2.5 px-3 text-left min-w-[160px]">Nama</th>
                        <th className="py-2.5 px-3 text-left min-w-[165px]">Nilai Tengah Semester</th>
                        <th className="py-2.5 px-3 text-left min-w-[165px]">Nilai Rapor Semester</th>
                        <th className="py-2.5 px-3 text-left w-28">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredSummative.map((row, idx) => (
                        <tr
                          key={row.studentId}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors"
                        >
                          <td className="py-3 px-3 text-xs text-slate-500 tabular-nums align-top">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3 text-xs font-medium text-slate-900 dark:text-slate-100 align-top">
                            {row.fullName}
                          </td>
                          <td className="py-3 px-3 align-top tabular-nums">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {row.midtermScore !== null ? row.midtermScore.toFixed(2) : '-'}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Lingkup Materi:{' '}
                              {row.lmAverage !== null ? row.lmAverage.toFixed(2) : '-'}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              STS: {row.sts !== null ? row.sts.toFixed(2) : '-'}
                            </p>
                          </td>
                          <td className="py-3 px-3 align-top tabular-nums">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {row.finalScore !== null ? row.finalScore.toFixed(2) : '-'}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Lingkup Materi:{' '}
                              {row.lmAverage !== null ? row.lmAverage.toFixed(2) : '-'}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              STS: {row.sts !== null ? row.sts.toFixed(2) : '-'}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              SAS: {row.sas !== null ? row.sas.toFixed(2) : '-'}
                            </p>
                          </td>
                          <td className="py-3 px-3 align-top">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openSumatifStudent(row.studentId)}
                            >
                              <PenLine className="w-3.5 h-3.5" />
                              Nilai
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        ) : effectiveTab === 'kokurikuler' ? (
          /* ================= KOKURIKULER ================= */
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Daftar Nilai Kokurikuler - {activeProject?.title || 'Kegiatan'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedClass?.name || '-'}
                </p>
              </div>
              <Link
                href="/kokurikuler"
                className="text-xs font-medium text-[#0F2942] dark:text-sky-400 hover:underline inline-flex items-center gap-1"
              >
                Kelola Daftar Kokurikuler <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            {cocurriculars.length === 0 ? (
              <EmptyState
                title="Belum ada kegiatan kokurikuler pada rombel ini"
                description="Tambahkan kegiatan kokurikuler beserta 8 DPL terlebih dahulu di menu Mata Pelajaran → Kokurikuler."
                action={
                  <Link
                    href="/kokurikuler"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-[#0F2942] text-white"
                  >
                    Tambah Kegiatan Kokurikuler
                  </Link>
                }
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {canExportScores && selectedClass && activeProject && (
                    <a
                      href={`/api/assessments/excel?mode=kokurikuler_template&classId=${selectedClass.id}&projectId=${activeProject.id}`}
                      className="inline-flex items-center gap-2 h-9 px-3 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111C2E] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download template
                    </a>
                  )}
                  {canUpdateScores && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setImportModeModal('kokurikuler')}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Import nilai
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Select
                    aria-label="Pilih kegiatan kokurikuler"
                    value={activeProject?.id || ''}
                    onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                  >
                    {cocurriculars.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </Select>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari nama murid..."
                      className="w-full h-10 pl-9 pr-3 text-sm bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8]"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <th className="py-2.5 px-3 text-left w-12">No</th>
                        <th className="py-2.5 px-3 text-left min-w-[160px]">Nama</th>
                        <th className="py-2.5 px-3 text-left w-28">Aksi</th>
                        <th className="py-2.5 px-3 text-left min-w-[260px]">Deskripsi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredCocuScores.map((stu, idx) => (
                        <tr
                          key={stu.studentId}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors"
                        >
                          <td className="py-3 px-3 text-xs text-slate-500 tabular-nums align-top">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3 text-xs font-medium text-slate-900 dark:text-slate-100 align-top">
                            {stu.fullName}
                          </td>
                          <td className="py-3 px-3 align-top">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCocuModal(stu)}
                            >
                              <PenLine className="w-3.5 h-3.5" />
                              Nilai
                            </Button>
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed align-top">
                            {stu.description ? (
                              stu.description
                            ) : (
                              <span className="text-slate-400">Belum dinilai</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        ) : effectiveTab === 'ekstrakurikuler' ? (
          /* ================= EKSTRAKURIKULER ================= */
          detailStudentId && activeEkstra ? (
            (() => {
              const stu = activeEkstra.scores.find((s) => s.studentId === detailStudentId);
              if (!stu) return null;
              const hasExistingScore = Boolean(stu.predicate && stu.predicate !== '-');
              const preview =
                activeEkstra.objectives.length > 0
                  ? buildExtracurricularDescription(
                      activeEkstra.objectives.map((obj, idx) => ({
                        objective: obj,
                        predicate: ekstraTpDraft[idx] || 'Baik',
                      })),
                      ekstraFallbackPred
                    )
                  : {
                      predicate: ekstraFallbackPred,
                      description: `Ananda ${ekstraFallbackPred.toLowerCase()} dalam berpartisipasi aktif pada kegiatan ${activeEkstra.name}.`,
                    };

              return (
                <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setDetailStudentId(null)}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Kembali
                    </Button>
                    {canUpdateScores && (
                      <Button size="sm" loading={saving} onClick={handleSaveEkstraStudent}>
                        <Save className="w-4 h-4" />
                        Simpan
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select
                      aria-label="Pilih ekstrakurikuler"
                      value={activeEkstra.id}
                      onChange={(e) => {
                        setSelectedEkstraId(Number(e.target.value));
                        setDetailStudentId(null);
                      }}
                    >
                      {extracurriculars.map((ek) => (
                        <option key={ek.id} value={ek.id}>
                          {ek.name}
                        </option>
                      ))}
                    </Select>
                    <StudentCombobox
                      students={activeEkstra.scores}
                      selectedId={stu.studentId}
                      onSelect={(id) => openEkstraStudent(id)}
                    />
                  </div>

                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Isi nilai untuk tiap tujuan pembelajaran ekstrakurikuler di bawah ini untuk Ananda{' '}
                    <span className="text-[#0F2942] dark:text-sky-300">{stu.fullName}</span>.
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-600 dark:text-slate-300">
                      Ekstrakurikuler:{' '}
                      <strong className="text-slate-900 dark:text-slate-100">
                        {activeEkstra.name}
                      </strong>
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 font-medium',
                        hasExistingScore
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-400 dark:text-slate-500'
                      )}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {hasExistingScore ? 'Nilai Tersimpan' : 'Belum Dinilai'}
                    </span>
                  </div>

                  {activeEkstra.objectives.length > 0 ? (
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <th className="py-2.5 px-3 text-left w-12">No</th>
                            <th className="py-2.5 px-3 text-left">Tujuan Pembelajaran</th>
                            <th className="py-2.5 px-3 text-left w-44">Pilih Nilai</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {activeEkstra.objectives.map((obj, idx) => (
                            <tr key={idx}>
                              <td className="py-3 px-3 text-xs text-slate-500 tabular-nums align-top">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-3 text-xs font-medium text-slate-900 dark:text-slate-100">
                                {obj}
                              </td>
                              <td className="py-3 px-3">
                                <select
                                  aria-label={`Nilai TP ${idx + 1}`}
                                  disabled={!canUpdateScores}
                                  value={ekstraTpDraft[idx] || 'Baik'}
                                  onChange={(e) =>
                                    setEkstraTpDraft((prev) => ({
                                      ...prev,
                                      [idx]: e.target.value as ExtracurricularPredicate,
                                    }))
                                  }
                                  className="w-full h-9 px-2.5 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-md"
                                >
                                  <option value="Sangat Baik">Sangat Baik</option>
                                  <option value="Baik">Baik</option>
                                  <option value="Cukup">Cukup</option>
                                  <option value="Kurang">Kurang</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <AlertBox variant="info">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            Ekstrakurikuler ini belum memiliki daftar Tujuan Pembelajaran. Anda dapat memilih predikat keseluruhan di bawah atau menambah TP terlebih dahulu.
                          </span>
                          <Link href="/ekstrakurikuler" className="font-semibold underline">
                            Edit TP Ekskul
                          </Link>
                        </div>
                      </AlertBox>
                      <div className="max-w-xs">
                        <Select
                          label="Predikat Ekstrakurikuler"
                          disabled={!canUpdateScores}
                          value={ekstraFallbackPred}
                          onChange={(e) =>
                            setEkstraFallbackPred(e.target.value as ExtracurricularPredicate)
                          }
                        >
                          <option value="Sangat Baik">Sangat Baik</option>
                          <option value="Baik">Baik</option>
                          <option value="Cukup">Cukup</option>
                          <option value="Kurang">Kurang</option>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="rounded-md border border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/30 p-3.5">
                    <p className="text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                      Pratinjau Deskripsi Rapor ({preview.predicate})
                    </p>
                    <p className="text-xs text-slate-700 dark:text-slate-200 mt-1 leading-relaxed">
                      {preview.description}
                    </p>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Daftar Nilai Ekstrakurikuler - {activeEkstra?.name || 'Ekstrakurikuler'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedClass?.name || '-'}
                  </p>
                </div>
                <Link
                  href="/ekstrakurikuler"
                  className="text-xs font-medium text-[#0F2942] dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                >
                  Kelola Ekskul & TP <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              {extracurriculars.length === 0 ? (
                <EmptyState
                  title="Belum ada kegiatan ekstrakurikuler"
                  description="Tambahkan kegiatan ekstrakurikuler terlebih dahulu di menu Mata Pelajaran → Ekstrakurikuler."
                  action={
                    <Link
                      href="/ekstrakurikuler"
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-[#0F2942] text-white"
                    >
                      Kelola Ekstrakurikuler
                    </Link>
                  }
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {canExportScores && selectedClass && activeEkstra && (
                      <a
                        href={`/api/assessments/excel?mode=ekskul_template&classId=${selectedClass.id}&extracurricularId=${activeEkstra.id}`}
                        className="inline-flex items-center gap-2 h-9 px-3 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111C2E] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download template
                      </a>
                    )}
                    {canUpdateScores && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setImportModeModal('ekskul')}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Import nilai
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select
                      aria-label="Pilih kegiatan ekstrakurikuler"
                      value={activeEkstra?.id || ''}
                      onChange={(e) => setSelectedEkstraId(Number(e.target.value))}
                    >
                      {extracurriculars.map((ek) => (
                        <option key={ek.id} value={ek.id}>
                          {ek.name}
                        </option>
                      ))}
                    </Select>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari nama murid..."
                        className="w-full h-10 pl-9 pr-3 text-sm bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8]"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          <th className="py-2.5 px-3 text-left w-12">No</th>
                          <th className="py-2.5 px-3 text-left min-w-[160px]">Nama</th>
                          <th className="py-2.5 px-3 text-left w-28">Aksi</th>
                          <th className="py-2.5 px-3 text-left min-w-[260px]">Deskripsi Nilai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredEkstraScores.map((stu, idx) => (
                          <tr
                            key={stu.studentId}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors"
                          >
                            <td className="py-3 px-3 text-xs text-slate-500 tabular-nums align-top">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3 text-xs font-medium text-slate-900 dark:text-slate-100 align-top">
                              {stu.fullName}
                            </td>
                            <td className="py-3 px-3 align-top">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEkstraStudent(stu.studentId)}
                              >
                                <PenLine className="w-3.5 h-3.5" />
                                Nilai
                              </Button>
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed align-top">
                              {stu.description ? (
                                stu.description
                              ) : (
                                <span className="text-slate-400">Belum dinilai</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )
        ) : effectiveTab === 'keasramaan' ? (
          /* ================= KEASRAMAAN ================= */
          detailStudentId ? (
            (() => {
              const stu = keasRows.find((r) => r.studentId === detailStudentId);
              if (!stu) return null;
              const categories = Array.from(new Set(stu.items.map((i) => i.category)));
              return (
                <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setDetailStudentId(null)}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Kembali
                    </Button>
                    {canUpdateKeasramaan && (
                      <Button size="sm" loading={saving} onClick={handleSaveKeasramaanStudent}>
                        <Save className="w-4 h-4" />
                        Simpan
                      </Button>
                    )}
                  </div>

                  <StudentCombobox
                    students={keasRows}
                    selectedId={stu.studentId}
                    onSelect={(id) => openKeasramaanStudent(id)}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Wali Asrama"
                      disabled={!canUpdateKeasramaan}
                      value={keasWaliAsrama}
                      placeholder="Nama Wali Asrama"
                      onChange={(e) => setKeasWaliAsrama(e.target.value)}
                    />
                    <Input
                      label="Wali Asuh"
                      disabled={!canUpdateKeasramaan}
                      value={keasWaliAsuh}
                      placeholder="Nama Wali Asuh"
                      onChange={(e) => setKeasWaliAsuh(e.target.value)}
                    />
                  </div>

                  {categories.map((cat) => {
                    const catItems = stu.items.filter((i) => i.category === cat);
                    return (
                      <div key={cat} className="space-y-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {cat}
                        </h3>
                        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                <th className="py-2.5 px-3 text-left w-10">No</th>
                                <th className="py-2.5 px-3 text-left min-w-[200px]">
                                  Indikator &amp; Tujuan Pembinaan
                                </th>
                                <th className="py-2.5 px-3 text-left w-44">Predikat</th>
                                <th className="py-2.5 px-3 text-left min-w-[180px]">
                                  Capaian / Pendampingan
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {catItems.map((it, idx) => {
                                const draft = keasItemDraft[it.indicatorId] || {
                                  predicate: it.predicate,
                                  achievedNote: it.achievedNote,
                                  guidanceNote: it.guidanceNote,
                                };
                                return (
                                  <tr key={it.indicatorId}>
                                    <td className="py-3 px-3 text-xs text-slate-500 tabular-nums align-top">
                                      {idx + 1}
                                    </td>
                                    <td className="py-3 px-3 align-top">
                                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                        {it.name}
                                      </p>
                                      {it.learningObjectives.length > 0 && (
                                        <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 list-disc pl-4">
                                          {it.learningObjectives.map((obj, oIdx) => (
                                            <li key={oIdx}>{obj}</li>
                                          ))}
                                        </ul>
                                      )}
                                    </td>
                                    <td className="py-3 px-3 align-top">
                                      <select
                                        aria-label={`Predikat ${it.name}`}
                                        disabled={!canUpdateKeasramaan}
                                        value={draft.predicate}
                                        onChange={(e) =>
                                          setKeasItemDraft((prev) => ({
                                            ...prev,
                                            [it.indicatorId]: {
                                              ...draft,
                                              predicate: e.target.value as 'A' | 'B' | 'C',
                                            },
                                          }))
                                        }
                                        className="w-full h-9 px-2.5 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-md"
                                      >
                                        <option value="A">A (Sangat Baik)</option>
                                        <option value="B">B (Baik)</option>
                                        <option value="C">C (Perlu Pembinaan)</option>
                                      </select>
                                    </td>
                                    <td className="py-3 px-3 space-y-1.5 align-top">
                                      <input
                                        type="text"
                                        disabled={!canUpdateKeasramaan}
                                        value={draft.achievedNote}
                                        placeholder="Catatan capaian..."
                                        onChange={(e) =>
                                          setKeasItemDraft((prev) => ({
                                            ...prev,
                                            [it.indicatorId]: {
                                              ...draft,
                                              achievedNote: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-full h-8 px-2.5 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded"
                                      />
                                      <input
                                        type="text"
                                        disabled={!canUpdateKeasramaan}
                                        value={draft.guidanceNote}
                                        placeholder="Catatan pendampingan (opsional)..."
                                        onChange={(e) =>
                                          setKeasItemDraft((prev) => ({
                                            ...prev,
                                            [it.indicatorId]: {
                                              ...draft,
                                              guidanceNote: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-full h-8 px-2.5 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : (
            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Daftar Nilai Keasramaan
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Kelas aktif: {selectedClass?.name || '-'}
                  </p>
                </div>
                <Link
                  href="/keasramaan"
                  className="text-xs font-medium text-[#0F2942] dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                >
                  Kelola Mata Evaluasi <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama murid..."
                  className="w-full h-10 pl-9 pr-3 text-sm bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8]"
                />
              </div>

              {filteredKeasRows.length === 0 ? (
                <EmptyState
                  title="Belum ada murid keasramaan"
                  description="Tambahkan murid ke kelas ini atau atur mata evaluasi di menu Mata Pelajaran → Keasramaan."
                />
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <th className="py-2.5 px-3 text-left w-12">No</th>
                        <th className="py-2.5 px-3 text-left min-w-[160px]">Nama</th>
                        <th className="py-2.5 px-3 text-left w-28">Aksi</th>
                        <th className="py-2.5 px-3 text-left min-w-[260px]">Ringkasan Capaian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredKeasRows.map((stu, idx) => {
                        const countA = stu.items.filter((i) => i.predicate === 'A').length;
                        const countB = stu.items.filter((i) => i.predicate === 'B').length;
                        const countC = stu.items.filter((i) => i.predicate === 'C').length;
                        const notedCount = stu.items.filter(
                          (i) => i.achievedNote.trim().length > 0
                        ).length;
                        return (
                          <tr
                            key={stu.studentId}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors"
                          >
                            <td className="py-3 px-3 text-xs text-slate-500 tabular-nums align-top">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3 text-xs font-medium text-slate-900 dark:text-slate-100 align-top">
                              {stu.fullName}
                            </td>
                            <td className="py-3 px-3 align-top">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openKeasramaanStudent(stu.studentId)}
                              >
                                <PenLine className="w-3.5 h-3.5" />
                                Nilai
                              </Button>
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300 align-top space-y-0.5">
                              <p className="tabular-nums">
                                {stu.items.length} indikator: Predikat A ({countA}), B ({countB}), C (
                                {countC})
                                {notedCount > 0 ? ` · ${notedCount} catatan capaian` : ''}
                              </p>
                              {(stu.waliAsramaName || stu.waliAsuhName) && (
                                <p className="text-[11px] text-slate-500">
                                  {stu.waliAsramaName ? `Wali Asrama: ${stu.waliAsramaName}` : ''}
                                  {stu.waliAsramaName && stu.waliAsuhName ? ' · ' : ''}
                                  {stu.waliAsuhName ? `Wali Asuh: ${stu.waliAsuhName}` : ''}
                                </p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        ) : (
          /* ================= CATATAN WALI KELAS ================= */
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Catatan Wali Kelas &amp; Keputusan Rapor - {selectedClass?.name || '-'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Catatan ini tercetak langsung pada lembar Rapor Kurikulum Merdeka masing-masing murid.
                </p>
              </div>
              {canUpdateNotes && (
                <Button size="sm" loading={saving} onClick={handleSaveAllHomeroomNotes}>
                  <Save className="w-4 h-4" />
                  Simpan Semua Catatan
                </Button>
              )}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama murid..."
                className="w-full h-10 pl-9 pr-3 text-sm bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8]"
              />
            </div>

            {filteredHomeroom.length === 0 ? (
              <EmptyState
                title="Belum ada murid pada pencarian ini"
                description="Pastikan rombel aktif memiliki murid atau ubah kata kunci pencarian."
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md">
                {filteredHomeroom.map((item, idx) => (
                  <div
                    key={item.studentId}
                    className="p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center odd:bg-white dark:odd:bg-transparent even:bg-slate-50/50 dark:even:bg-slate-900/20"
                  >
                    <div className="lg:col-span-3 text-xs font-medium text-slate-900 dark:text-slate-100">
                      <span className="text-slate-400 mr-1.5 tabular-nums">{idx + 1}.</span>
                      {item.fullName}
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
                            prev.map((p) =>
                              p.studentId === item.studentId ? { ...p, note: val } : p
                            )
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
                              p.studentId === item.studentId
                                ? { ...p, promotionDecision: val }
                                : p
                            )
                          );
                        }}
                        className="w-full h-9 px-3 text-xs bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-md disabled:opacity-60"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Bobot Penilaian */}
      <Modal
        open={weightModal}
        onClose={() => setWeightModal(false)}
        title="Atur Bobot Penilaian & KKTP"
      >
        <form onSubmit={handleSaveWeights} className="space-y-4">
          <AlertBox variant="info">
            Total bobot Lingkup Materi (LM), STS, dan SAS wajib berjumlah tepat 100%.
          </AlertBox>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Bobot Lingkup Materi (%)"
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
            <Button type="submit" loading={saving}>
              Simpan &amp; Hitung Ulang
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Import Excel */}
      <Modal
        open={Boolean(importModeModal)}
        onClose={() => {
          setImportModeModal(null);
          setImportFile(null);
        }}
        title={
          importModeModal === 'kokurikuler'
            ? 'Import Nilai Kokurikuler Excel'
            : importModeModal === 'ekskul'
            ? 'Import Nilai Ekstrakurikuler Excel'
            : 'Import Nilai Sumatif Excel'
        }
      >
        <form onSubmit={handleImportExcel} className="space-y-4">
          <AlertBox variant="info">
            Gunakan berkas Excel resmi hasil Unduh Template pada halaman ini agar kolom NISN dan komponen nilai terbaca akurat.
          </AlertBox>
          <input
            type="file"
            accept=".xlsx,.xlsm"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-slate-300 dark:file:border-slate-700 file:text-xs file:font-medium file:bg-slate-50 dark:file:bg-slate-800 hover:file:bg-slate-100"
            required
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setImportModeModal(null);
                setImportFile(null);
              }}
            >
              Batal
            </Button>
            <Button type="submit" loading={saving}>
              Proses Import Nilai
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Nilai Kokurikuler per 8 DPL */}
      <Modal
        open={Boolean(cocuModalStudent && activeProject)}
        onClose={() => setCocuModalStudent(null)}
        title="Nilai Kokurikuler"
        maxWidth="max-w-lg"
      >
        {cocuModalStudent && activeProject && (
          <form onSubmit={handleSaveCocuScore} className="space-y-4">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
              Ananda <strong>{cocuModalStudent.fullName}</strong>
            </p>
            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Kegiatan Kokurikuler
              </p>
              <div className="px-3 py-2 text-xs rounded-md bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                {activeProject.title}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeProject.dimensions.map((dim) => (
                <Select
                  key={dim}
                  label={dim}
                  disabled={!canUpdateScores}
                  value={cocuDimDraft[dim] || 'Baik'}
                  onChange={(e) => {
                    const nextVal = e.target.value as CocurricularPredicate;
                    setCocuDimDraft((prev) => ({ ...prev, [dim]: nextVal }));
                    setCocuCustomDesc(null);
                  }}
                >
                  <option value="Sangat Baik">Sangat Baik</option>
                  <option value="Baik">Baik</option>
                  <option value="Cukup">Cukup</option>
                  <option value="Perlu Bimbingan">Perlu Bimbingan</option>
                </Select>
              ))}
            </div>

            {(() => {
              const generated = buildCocurricularDescription(
                activeProject.dimensions,
                cocuDimDraft
              );
              const val = cocuCustomDesc !== null ? cocuCustomDesc : generated.description;
              return (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Pratinjau Deskripsi Rapor ({generated.predicate})
                  </label>
                  <textarea
                    rows={3}
                    disabled={!canUpdateScores}
                    value={val}
                    onChange={(e) => setCocuCustomDesc(e.target.value)}
                    className="w-full p-2.5 text-xs bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8]"
                  />
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCocuModalStudent(null)}>
                Batal
              </Button>
              {canUpdateScores && (
                <Button type="submit" loading={saving}>
                  <Save className="w-4 h-4" />
                  Simpan
                </Button>
              )}
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}

export function PenilaianWorkspace({ initialTab = 'sumatif' }: { initialTab?: PenilaianTab }) {
  const searchParams = useSearchParams();
  const { selectedClassId } = useApp();
  const queryTab = searchParams.get('tab');
  const activeTab: PenilaianTab = queryTab
    ? normalizePenilaianTab(queryTab)
    : initialTab;

  return (
    <PenilaianWorkspaceInner
      key={`${activeTab}-${selectedClassId || 0}`}
      activeTab={activeTab}
    />
  );
}
