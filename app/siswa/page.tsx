'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Download,
  Edit,
  Eye,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import { formatIndoDate } from '@/lib/utils';
import {
  AlertBox,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  TableSkeleton,
} from '@/components/ui/Primitives';

import {
  StudentDetailEditModal,
  type StudentDetailRecord,
  type TeacherOption,
} from '@/components/students/StudentDetailEditModal';

interface AffairsRecord {
  id: number;
  studentId: number;
  recordType: string;
  title: string;
  description: string;
  points: number;
  date: string;
}

export default function SiswaPage() {
  const { selectedClassId, selectedClass, classes, school, notify, can } = useApp();
  const [tab, setTab] = useState<'daftar' | 'kesiswaan'>('daftar');
  const canReadSiswa = can('siswa', 'read');
  const canReadKesiswaan = can('kesiswaan', 'read');
  const activeTab =
    !canReadSiswa && canReadKesiswaan
      ? 'kesiswaan'
      : tab === 'kesiswaan' && !canReadKesiswaan
      ? 'daftar'
      : tab;
  const [scopeAll, setScopeAll] = useState(false);
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<StudentDetailRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [affairs, setAffairs] = useState<AffairsRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Unified Detail / Edit / Create Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalMode, setDetailModalMode] = useState<'view' | 'edit' | 'create'>('view');
  const [activeStudentId, setActiveStudentId] = useState<number | null>(null);
  // Archive Confirm
  const [archiveTarget, setArchiveTarget] = useState<StudentDetailRecord | null>(null);

  // Excel Import Modal
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    totalParsed: number;
    readyToInsert: number;
    rows: Array<{ rowNumber: number; nisn: string; fullName: string; className: string }>;
    errors: Array<{ rowNumber: number; message: string }>;
    existingDuplicates: Array<{ rowNumber: number; nisn: string; fullName: string }>;
  } | null>(null);
  const [importing, setImporting] = useState(false);

  // Affairs Modal
  const [affairsModal, setAffairsModal] = useState(false);
  const [affairsForm, setAffairsForm] = useState({
    studentId: 0,
    recordType: 'Prestasi',
    title: '',
    description: '',
    date: new Date().toISOString().slice(0, 10),
  });

  const loadStudents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (!scopeAll && selectedClassId) params.set('classId', String(selectedClassId));
    if (scopeAll) params.set('classId', 'all');
    if (search.trim()) params.set('q', search.trim());

    const res = await fetch(`/api/students?${params.toString()}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      setStudents(json.students || []);
      setAffairs(json.affairs || []);
      setTeachers(json.teachers || []);
    }
    setLoading(false);
  }, [scopeAll, selectedClassId, search]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadStudents();
    });
  }, [loadStudents]);

  const activeStudent =
    activeStudentId !== null ? students.find((s) => s.id === activeStudentId) ?? null : null;

  const openCreate = () => {
    setActiveStudentId(null);
    setDetailModalMode('create');
    setDetailModalOpen(true);
  };

  const openDetail = (s: StudentDetailRecord) => {
    setActiveStudentId(s.id);
    setDetailModalMode('view');
    setDetailModalOpen(true);
  };

  const openEdit = (s: StudentDetailRecord) => {
    setActiveStudentId(s.id);
    setDetailModalMode('edit');
    setDetailModalOpen(true);
  };

  const handleArchiveStudent = async () => {
    if (!archiveTarget) return;
    const res = await fetch(`/api/students?id=${archiveTarget.id}`, {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    const json = await res.json();
    setArchiveTarget(null);
    if (!res.ok) {
      notify('error', json.error || 'Gagal mengarsipkan murid.');
      return;
    }
    notify('success', json.message || 'Status murid diperbarui.');
    await loadStudents();
  };

  const handlePreviewExcel = async () => {
    if (!importFile) return;
    setImporting(true);
    const fd = new FormData();
    fd.append('file', importFile);
    fd.append('commit', 'false');
    const res = await fetch('/api/students/excel', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: fd,
    });
    const json = await res.json();
    setImporting(false);
    if (!res.ok) {
      notify('error', json.error || 'Gagal membaca file Excel.');
      return;
    }
    setImportPreview(json.preview);
  };

  const handleCommitExcel = async () => {
    if (!importFile) return;
    setImporting(true);
    const fd = new FormData();
    fd.append('file', importFile);
    fd.append('commit', 'true');
    const res = await fetch('/api/students/excel', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: fd,
    });
    const json = await res.json();
    setImporting(false);
    if (!res.ok) {
      notify('error', json.error || 'Gagal mengimpor murid.');
      return;
    }
    setImportOpen(false);
    setImportFile(null);
    setImportPreview(null);
    notify('success', `Berhasil mengimpor ${json.insertedCount} murid baru.`);
    await loadStudents();
  };

  const handleCreateAffairs = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        action: 'create_affairs',
        studentId: Number(affairsForm.studentId || students[0]?.id),
        recordType: affairsForm.recordType,
        title: affairsForm.title,
        description: affairsForm.description,
        date: affairsForm.date,
      }),
    });
    if (res.ok) {
      setAffairsModal(false);
      setAffairsForm({ ...affairsForm, title: '', description: '' });
      notify('success', 'Catatan kesiswaan disimpan.');
      await loadStudents();
    } else {
      const j = await res.json();
      notify('error', j.error || 'Gagal menyimpan catatan.');
    }
  };

  return (
    <AppShell title="Data Murid" requiredModule={['siswa', 'kesiswaan']}>
      <div className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-lg font-bold text-slate-900 dark:text-slate-100">
              Buku Induk & Data Murid — {scopeAll ? 'Semua Kelas' : `Kelas ${selectedClass?.name || '-'}`}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kelola data pokok peserta didik, orang tua/wali, riwayat mutasi, serta catatan kesiswaan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can('siswa', 'create') && (
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4" />
                Import Excel
              </Button>
            )}
            {can('siswa', 'export') && (
              <a href="/api/students/excel?mode=export">
                <Button variant="outline" size="sm">
                  <FileSpreadsheet className="w-4 h-4" />
                  Ekspor .xlsx
                </Button>
              </a>
            )}
            {can('siswa', 'create') && (
              <Button size="sm" onClick={openCreate}>
                <Plus className="w-4 h-4" />
                Tambah Murid
              </Button>
            )}
          </div>
        </div>

        {/* Filter & Tabs Bar */}
        <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md">
              {canReadSiswa && (
                <button
                  type="button"
                  onClick={() => setTab('daftar')}
                  className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer ${
                    activeTab === 'daftar'
                      ? 'bg-white dark:bg-[#111C2E] text-[#0F2942] dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Daftar Murid
                </button>
              )}
              {canReadKesiswaan && (
                <button
                  type="button"
                  onClick={() => setTab('kesiswaan')}
                  className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer ${
                    activeTab === 'kesiswaan'
                      ? 'bg-white dark:bg-[#111C2E] text-[#0F2942] dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Catatan Kesiswaan
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setScopeAll((v) => !v)}
              className={`h-9 px-3 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                scopeAll
                  ? 'bg-[#0F2942] text-white border-[#0F2942]'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
              }`}
            >
              {scopeAll ? 'Menampilkan Semua Kelas' : `Hanya Kelas ${selectedClass?.name || ''}`}
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, NISN, atau NIS..."
              className="w-full h-10 pl-9 pr-3 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
            />
          </div>
        </div>

        {activeTab === 'daftar' ? (
          loading ? (
            <TableSkeleton rows={8} />
          ) : students.length === 0 ? (
            <EmptyState
              title="Belum ada data murid pada filter ini"
              description="Tambahkan murid baru secara manual atau impor melalui template Excel Dapodik."
              action={
                can('siswa', 'create') ? (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="w-4 h-4" />
                    Tambah Murid Pertama
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table text-left text-xs">
                  <thead>
                    <tr className="text-slate-600 dark:text-slate-300">
                      <th className="py-3 px-3 font-semibold w-10 col-id">No</th>
                      <th className="py-3 px-3 font-semibold col-id col-cell-div">NISN / NIS</th>
                      <th className="py-3 px-3 font-semibold col-id col-cell-div">Nama Lengkap</th>
                      <th className="py-3 px-3 font-semibold col-a col-sep">JK</th>
                      <th className="py-3 px-3 font-semibold col-a col-cell-div">Agama</th>
                      <th className="py-3 px-3 font-semibold col-a col-cell-div">
                        Tempat, Tgl Lahir
                      </th>
                      <th className="py-3 px-3 font-semibold col-b col-sep">Rombel</th>
                      <th className="py-3 px-3 font-semibold col-total col-sep">Status</th>
                      <th className="py-3 px-3 font-semibold text-right col-action col-sep">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, idx) => (
                      <tr key={s.id}>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 col-id">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums col-id col-cell-div">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {s.nisn}
                          </div>
                          <div className="text-[11px] text-slate-500">NIS {s.nis}</div>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100 col-id col-cell-div">
                          <button
                            type="button"
                            onClick={() => openDetail(s)}
                            className="text-left hover:text-[#1D4ED8] dark:hover:text-blue-400 hover:underline cursor-pointer"
                          >
                            {s.fullName}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 col-a col-sep">{s.gender}</td>
                        <td className="py-2.5 px-3 col-a col-cell-div">{s.religion}</td>
                        <td className="py-2.5 px-3 tabular-nums col-a col-cell-div whitespace-nowrap">
                          {s.birthPlace}, {formatIndoDate(s.birthDate)}
                        </td>
                        <td className="py-2.5 px-3 font-medium col-b col-sep">{s.className}</td>
                        <td className="py-2.5 px-3 col-total col-sep">
                          <span
                            className={
                              s.status === 'Aktif'
                                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                                : 'text-amber-700 dark:text-amber-400 font-medium'
                            }
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right col-action col-sep">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openDetail(s)}
                              title="Lihat detail murid"
                              className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {can('siswa', 'update') && (
                              <button
                                type="button"
                                onClick={() => openEdit(s)}
                                title="Ubah data murid"
                                className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-[#0F2942] dark:text-blue-400 cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {can('siswa', 'delete') && (
                              <button
                                type="button"
                                onClick={() => setArchiveTarget(s)}
                                title="Arsipkan murid"
                                className="p-2 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 cursor-pointer"
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
          )
        ) : (
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Catatan Kesiswaan, Prestasi, Konseling & UKS
                </h2>
                <p className="text-xs text-slate-500">
                  Catatan pembinaan karakter dan prestasi murid yang terjaga privasinya.
                </p>
              </div>
              {can('kesiswaan', 'create') && (
                <Button
                  size="sm"
                  onClick={() => {
                    setAffairsForm({
                      ...affairsForm,
                      studentId: students[0]?.id || 0,
                    });
                    setAffairsModal(true);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Catat Peristiwa
                </Button>
              )}
            </div>

            {affairs.length === 0 ? (
              <EmptyState
                title="Belum ada catatan kesiswaan"
                description="Catat prestasi lomba, bimbingan konseling, atau catatan kesehatan UKS murid di sini."
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {affairs.map((a) => {
                  const stu = students.find((s) => s.id === a.studentId);
                  return (
                    <div key={a.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {a.title} · <span className="text-[#1D4ED8]">{a.recordType}</span>
                        </p>
                        <p className="text-slate-600 dark:text-slate-300 mt-0.5">{a.description}</p>
                        <p className="text-slate-400 mt-1">
                          Murid: {stu?.fullName || `#${a.studentId}`}
                        </p>
                      </div>
                      <span className="tabular-nums whitespace-nowrap text-slate-500 shrink-0">
                        {formatIndoDate(a.date)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unified Tabbed Student Detail / Edit / Create Modal */}
      <StudentDetailEditModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        student={activeStudent}
        initialMode={detailModalMode}
        classes={classes}
        teachers={teachers}
        defaultClassId={selectedClassId || classes[0]?.id || 1}
        enableKeasramaan={Boolean(school?.enableKeasramaan)}
        canUpdate={can('siswa', 'update')}
        onSaved={loadStudents}
        notify={notify}
      />

      {/* Archive Confirm */}
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchiveStudent}
        title="Arsipkan Murid dari Rombel Aktif?"
        message={`Murid ${archiveTarget?.fullName} akan dipindahkan ke status Keluar. Seluruh riwayat nilai, presensi, dan rapor sebelumnya tetap tersimpan aman di database.`}
        confirmLabel="Ya, Arsipkan"
        danger
      />

      {/* Excel Import Modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Massal Data Murid (.xlsx)"
        subtitle="Unduh template terlebih dahulu, lalu unggah untuk pratinjau validasi dan deteksi duplikat NISN."
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md">
            <span className="text-xs text-slate-600 dark:text-slate-300">
              Format kolom standar SEKOLAHKITA / Dapodik (.xlsx)
            </span>
            <a href="/api/students/excel?mode=template">
              <Button variant="outline" size="sm">
                <Download className="w-3.5 h-3.5" />
                Unduh Template
              </Button>
            </a>
          </div>

          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              setImportFile(e.target.files?.[0] || null);
              setImportPreview(null);
            }}
            className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-medium file:bg-white hover:file:bg-slate-50"
          />

          {importPreview && (
            <div className="space-y-3">
              <AlertBox variant="info" title="Hasil Pratinjau Impor Excel">
                Terbaca {importPreview.totalParsed} baris valid · Siap ditambahkan:{' '}
                <strong>{importPreview.readyToInsert} murid baru</strong> · Duplikat di database:{' '}
                {importPreview.existingDuplicates.length} · Galat format: {importPreview.errors.length}
              </AlertBox>
              {importPreview.errors.length > 0 && (
                <div className="max-h-28 overflow-y-auto text-xs text-red-700 bg-red-50 p-2.5 rounded border border-red-200">
                  {importPreview.errors.map((err, i) => (
                    <p key={i}>Baris {err.rowNumber}: {err.message}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportOpen(false)}>Tutup</Button>
            {!importPreview ? (
              <Button onClick={handlePreviewExcel} disabled={!importFile} loading={importing}>
                Pratinjau & Validasi
              </Button>
            ) : (
              <Button
                onClick={handleCommitExcel}
                disabled={importPreview.readyToInsert === 0}
                loading={importing}
              >
                Simpan {importPreview.readyToInsert} Murid ke Database
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Affairs Modal */}
      <Modal open={affairsModal} onClose={() => setAffairsModal(false)} title="Tambah Catatan Kesiswaan">
        <form onSubmit={handleCreateAffairs} className="space-y-4">
          <Select
            label="Pilih Murid"
            value={affairsForm.studentId}
            onChange={(e) => setAffairsForm({ ...affairsForm, studentId: Number(e.target.value) })}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.fullName} ({s.className})</option>
            ))}
          </Select>
          <Select
            label="Kategori Catatan"
            value={affairsForm.recordType}
            onChange={(e) => setAffairsForm({ ...affairsForm, recordType: e.target.value })}
          >
            <option value="Prestasi">Prestasi & Penghargaan</option>
            <option value="Konseling">Bimbingan & Konseling</option>
            <option value="UKS">Kesehatan & UKS</option>
            <option value="Pelanggaran">Catatan Kedisiplinan</option>
            <option value="Izin">Izin Khusus</option>
          </Select>
          <Input
            label="Judul Catatan"
            value={affairsForm.title}
            onChange={(e) => setAffairsForm({ ...affairsForm, title: e.target.value })}
            required
          />
          <Input
            label="Tanggal"
            type="date"
            value={affairsForm.date}
            onChange={(e) => setAffairsForm({ ...affairsForm, date: e.target.value })}
            required
          />
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Uraian
            </label>
            <textarea
              rows={3}
              value={affairsForm.description}
              onChange={(e) => setAffairsForm({ ...affairsForm, description: e.target.value })}
              className="w-full p-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAffairsModal(false)}>Batal</Button>
            <Button type="submit">Simpan Catatan</Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
