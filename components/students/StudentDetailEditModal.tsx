'use client';

import React, { useRef, useState } from 'react';
import {
  Edit,
  Loader2,
  Save,
  Trash2,
  UserSquare2,
  X,
  XCircle,
} from 'lucide-react';
import { Button, Input, Select } from '@/components/ui/Primitives';
import type { ClassOption } from '@/components/providers/AppContext';

export interface TeacherOption {
  id: number;
  fullName: string;
  nip: string | null;
  specialization: string;
}

export interface StudentDetailRecord {
  id: number;
  nisn: string;
  nis: string;
  fullName: string;
  nickname?: string | null;
  nik?: string | null;
  gender: 'L' | 'P';
  birthPlace: string;
  birthDate: string;
  religion: string;
  childOrder?: number | null;
  siblingCount?: number | null;
  photoPath?: string | null;
  photoUrl?: string | null;
  address: string | null;
  rtRw?: string | null;
  village?: string | null;
  district?: string | null;
  regency?: string | null;
  province?: string | null;
  postalCode?: string | null;
  phone: string | null;
  email?: string | null;
  previousSchool?: string | null;
  enrollmentDate?: string;
  fatherName: string | null;
  fatherNik?: string | null;
  fatherJob?: string | null;
  fatherEducation?: string | null;
  fatherPhone?: string | null;
  motherName: string | null;
  motherNik?: string | null;
  motherJob?: string | null;
  motherEducation?: string | null;
  motherPhone?: string | null;
  parentPhone: string | null;
  guardianName?: string | null;
  guardianRelation?: string | null;
  guardianJob?: string | null;
  guardianPhone?: string | null;
  guardianAddress?: string | null;
  waliAsuhTeacherId?: number | null;
  waliAsuhName?: string | null;
  waliAsramaName?: string | null;
  dormitoryRoom?: string | null;
  keasramaanNotes?: string | null;
  status: 'Aktif' | 'Mutasi' | 'Lulus' | 'Keluar';
  classId: number | null;
  className: string;
}

type ModalMode = 'view' | 'edit' | 'create';
type TabKey = 'murid' | 'ortu' | 'alamat' | 'wali' | 'wali_asuh';

interface StudentDetailEditModalProps {
  open: boolean;
  onClose: () => void;
  student: StudentDetailRecord | null;
  initialMode: ModalMode;
  classes: ClassOption[];
  teachers: TeacherOption[];
  defaultClassId: number;
  enableKeasramaan: boolean;
  canUpdate: boolean;
  onSaved: () => Promise<void>;
  notify: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface StudentFormState {
  nisn: string;
  nis: string;
  fullName: string;
  nickname: string;
  nik: string;
  gender: 'L' | 'P';
  birthPlace: string;
  birthDate: string;
  religion: string;
  childOrder: string;
  siblingCount: string;
  classId: number;
  status: 'Aktif' | 'Mutasi' | 'Lulus' | 'Keluar';
  previousSchool: string;
  enrollmentDate: string;
  phone: string;
  email: string;
  address: string;
  rtRw: string;
  village: string;
  district: string;
  regency: string;
  province: string;
  postalCode: string;
  fatherName: string;
  fatherNik: string;
  fatherJob: string;
  fatherEducation: string;
  fatherPhone: string;
  motherName: string;
  motherNik: string;
  motherJob: string;
  motherEducation: string;
  motherPhone: string;
  parentPhone: string;
  guardianName: string;
  guardianRelation: string;
  guardianJob: string;
  guardianPhone: string;
  guardianAddress: string;
  waliAsuhTeacherId: string;
  waliAsuhName: string;
  waliAsramaName: string;
  dormitoryRoom: string;
  keasramaanNotes: string;
}

function createInitialFormState(
  student: StudentDetailRecord | null,
  defaultClassId: number
): StudentFormState {
  if (!student) {
    return {
      nisn: '',
      nis: '',
      fullName: '',
      nickname: '',
      nik: '',
      gender: 'L',
      birthPlace: 'Jakarta',
      birthDate: '2016-05-01',
      religion: 'Islam',
      childOrder: '',
      siblingCount: '',
      classId: defaultClassId,
      status: 'Aktif',
      previousSchool: '',
      enrollmentDate: new Date().toISOString().slice(0, 10),
      phone: '',
      email: '',
      address: '',
      rtRw: '',
      village: '',
      district: '',
      regency: '',
      province: '',
      postalCode: '',
      fatherName: '',
      fatherNik: '',
      fatherJob: '',
      fatherEducation: '',
      fatherPhone: '',
      motherName: '',
      motherNik: '',
      motherJob: '',
      motherEducation: '',
      motherPhone: '',
      parentPhone: '',
      guardianName: '',
      guardianRelation: '',
      guardianJob: '',
      guardianPhone: '',
      guardianAddress: '',
      waliAsuhTeacherId: '',
      waliAsuhName: '',
      waliAsramaName: '',
      dormitoryRoom: '',
      keasramaanNotes: '',
    };
  }

  return {
    nisn: student.nisn || '',
    nis: student.nis || '',
    fullName: student.fullName || '',
    nickname: student.nickname || '',
    nik: student.nik || '',
    gender: student.gender || 'L',
    birthPlace: student.birthPlace || '',
    birthDate: student.birthDate || '',
    religion: student.religion || 'Islam',
    childOrder: student.childOrder ? String(student.childOrder) : '',
    siblingCount: student.siblingCount ? String(student.siblingCount) : '',
    classId: student.classId || defaultClassId,
    status: student.status || 'Aktif',
    previousSchool: student.previousSchool || '',
    enrollmentDate: student.enrollmentDate || '',
    phone: student.phone || '',
    email: student.email || '',
    address: student.address || '',
    rtRw: student.rtRw || '',
    village: student.village || '',
    district: student.district || '',
    regency: student.regency || '',
    province: student.province || '',
    postalCode: student.postalCode || '',
    fatherName: student.fatherName || '',
    fatherNik: student.fatherNik || '',
    fatherJob: student.fatherJob || '',
    fatherEducation: student.fatherEducation || '',
    fatherPhone: student.fatherPhone || '',
    motherName: student.motherName || '',
    motherNik: student.motherNik || '',
    motherJob: student.motherJob || '',
    motherEducation: student.motherEducation || '',
    motherPhone: student.motherPhone || '',
    parentPhone: student.parentPhone || '',
    guardianName: student.guardianName || '',
    guardianRelation: student.guardianRelation || '',
    guardianJob: student.guardianJob || '',
    guardianPhone: student.guardianPhone || '',
    guardianAddress: student.guardianAddress || '',
    waliAsuhTeacherId: student.waliAsuhTeacherId ? String(student.waliAsuhTeacherId) : '',
    waliAsuhName: student.waliAsuhName || '',
    waliAsramaName: student.waliAsramaName || '',
    dormitoryRoom: student.dormitoryRoom || '',
    keasramaanNotes: student.keasramaanNotes || '',
  };
}

function DetailField({
  label,
  value,
  mono = false,
  className = '',
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
  className?: string;
}) {
  const display =
    value !== undefined && value !== null && String(value).trim() !== ''
      ? String(value)
      : '-';
  return (
    <div className={`space-y-0.5 ${className}`}>
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={`text-sm font-medium text-slate-900 dark:text-slate-100 break-words ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
      >
        {display}
      </p>
    </div>
  );
}

export function StudentDetailEditModal(props: StudentDetailEditModalProps) {
  if (!props.open) return null;
  const modalKey = `${props.student?.id ?? 'new'}-${props.initialMode}`;
  return <StudentDetailEditModalBody key={modalKey} {...props} />;
}

function StudentDetailEditModalBody({
  onClose,
  student,
  initialMode,
  classes,
  teachers,
  defaultClassId,
  enableKeasramaan,
  canUpdate,
  onSaved,
  notify,
}: StudentDetailEditModalProps) {
  const [mode, setMode] = useState<ModalMode>(initialMode);
  const [activeTab, setActiveTab] = useState<TabKey>('murid');
  const [form, setForm] = useState<StudentFormState>(() =>
    createInitialFormState(student, defaultClassId)
  );
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoOverrideUrl, setPhotoOverrideUrl] = useState<string | null | undefined>(undefined);
  const [stagedPhotoFile, setStagedPhotoFile] = useState<File | null>(null);
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isEditing = mode === 'edit' || mode === 'create';
  const showWaliAsuhTab =
    enableKeasramaan ||
    Boolean(
      student?.waliAsuhTeacherId ||
        student?.waliAsuhName ||
        student?.waliAsramaName ||
        student?.dormitoryRoom
    );

  const effectivePhotoUrl =
    mode === 'create'
      ? stagedPreviewUrl
      : photoOverrideUrl !== undefined
      ? photoOverrideUrl
      : student?.photoUrl || null;

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'murid', label: 'Data Murid' },
    { key: 'ortu', label: 'Data Orang Tua' },
    { key: 'alamat', label: 'Data Alamat Murid' },
    { key: 'wali', label: 'Data Wali' },
    ...(showWaliAsuhTab ? [{ key: 'wali_asuh' as const, label: 'Wali Asuh' }] : []),
  ];

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      notify('error', 'Format foto harus JPG, PNG, atau WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      notify('error', 'Ukuran berkas foto maksimal 2 MB.');
      return;
    }

    if (mode === 'create' || !student) {
      setStagedPhotoFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setStagedPreviewUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
      notify('info', 'Foto dipilih dan akan diunggah setelah data murid disimpan.');
      return;
    }

    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/students/${student.id}/photo`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        notify('error', json.error || 'Gagal mengunggah foto murid.');
        return;
      }
      setPhotoOverrideUrl(json.photoUrl);
      notify('success', 'Foto profil murid berhasil diperbarui.');
      await onSaved();
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (mode === 'create' || !student) {
      setStagedPhotoFile(null);
      setStagedPreviewUrl(null);
      return;
    }
    if (!effectivePhotoUrl) return;

    setUploadingPhoto(true);
    try {
      const res = await fetch(`/api/students/${student.id}/photo`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      const json = await res.json();
      if (!res.ok) {
        notify('error', json.error || 'Gagal menghapus foto murid.');
        return;
      }
      setPhotoOverrideUrl(null);
      notify('success', 'Foto profil murid dihapus.');
      await onSaved();
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;

    setSaving(true);
    try {
      const payload = {
        ...(mode === 'edit' && student ? { id: student.id } : {}),
        ...(mode === 'create' ? { nisn: form.nisn, nis: form.nis } : {}),
        fullName: form.fullName,
        nickname: form.nickname,
        nik: form.nik,
        gender: form.gender,
        birthPlace: form.birthPlace,
        birthDate: form.birthDate,
        religion: form.religion,
        childOrder: form.childOrder ? Number(form.childOrder) : null,
        siblingCount: form.siblingCount ? Number(form.siblingCount) : null,
        classId: Number(form.classId) || undefined,
        status: form.status,
        previousSchool: form.previousSchool,
        ...(form.enrollmentDate ? { enrollmentDate: form.enrollmentDate } : {}),
        phone: form.phone,
        email: form.email,
        address: form.address,
        rtRw: form.rtRw,
        village: form.village,
        district: form.district,
        regency: form.regency,
        province: form.province,
        postalCode: form.postalCode,
        fatherName: form.fatherName,
        fatherNik: form.fatherNik,
        fatherJob: form.fatherJob,
        fatherEducation: form.fatherEducation,
        fatherPhone: form.fatherPhone,
        motherName: form.motherName,
        motherNik: form.motherNik,
        motherJob: form.motherJob,
        motherEducation: form.motherEducation,
        motherPhone: form.motherPhone,
        parentPhone: form.parentPhone,
        guardianName: form.guardianName,
        guardianRelation: form.guardianRelation,
        guardianJob: form.guardianJob,
        guardianPhone: form.guardianPhone,
        guardianAddress: form.guardianAddress,
        waliAsuhTeacherId: form.waliAsuhTeacherId ? Number(form.waliAsuhTeacherId) : null,
        waliAsuhName: form.waliAsuhName,
        waliAsramaName: form.waliAsramaName,
        dormitoryRoom: form.dormitoryRoom,
        keasramaanNotes: form.keasramaanNotes,
      };

      const res = await fetch('/api/students', {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        notify('error', json.error || 'Gagal menyimpan data murid.');
        if (json.error?.toLowerCase().includes('nik ayah') || json.error?.toLowerCase().includes('nik ibu')) {
          setActiveTab('ortu');
        } else {
          setActiveTab('murid');
        }
        return;
      }

      if (mode === 'create' && stagedPhotoFile && json.student?.id) {
        const fd = new FormData();
        fd.append('file', stagedPhotoFile);
        await fetch(`/api/students/${json.student.id}/photo`, {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          body: fd,
        }).catch(() => null);
      }

      notify(
        'success',
        mode === 'create'
          ? 'Murid baru berhasil ditambahkan ke buku induk.'
          : 'Perubahan data murid berhasil disimpan.'
      );
      await onSaved();
      if (mode === 'create') {
        onClose();
      } else {
        setMode('view');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (mode === 'create') {
      onClose();
      return;
    }
    setForm(createInitialFormState(student, defaultClassId));
    setMode('view');
  };

  const selectedClassName =
    classes.find((c) => c.id === Number(form.classId))?.name || student?.className || '-';

  const educationOptions = ['', 'Tidak Sekolah', 'SD/Sederajat', 'SMP/Sederajat', 'SMA/Sederajat', 'D1/D2/D3', 'S1/D4', 'S2', 'S3'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-detail-modal-title"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="min-w-0">
            <h2
              id="student-detail-modal-title"
              className="font-[family-name:var(--font-display)] text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate"
            >
              {mode === 'create'
                ? 'Tambah Murid Baru'
                : mode === 'edit'
                ? 'Edit Data Murid'
                : 'Detail Data Murid'}
            </h2>
            {student && mode !== 'create' && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {form.fullName} · Kelas {selectedClassName} ·{' '}
                <span className="font-mono tabular-nums">NISN {student.nisn}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B1320]/60 shrink-0">
          <div className="flex flex-wrap items-center gap-1" role="tablist">
            {tabs.map((t) => {
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-[#111C2E] text-[#0F2942] dark:text-white border border-slate-200 dark:border-slate-700 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Body */}
        <form id="student-detail-edit-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'murid' && (
            <div className="space-y-5">
              {/* Photo Frame + Ubah / Hapus Buttons matching reference */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-5 pb-5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-col items-start gap-3 shrink-0">
                  <div className="w-48 sm:w-52 aspect-[3/4] rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1320]/80 flex flex-col items-center justify-center overflow-hidden relative">
                    {effectivePhotoUrl ? (
                      <img
                        src={effectivePhotoUrl}
                        alt={`Foto ${form.fullName || 'Murid'}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 px-4 text-center">
                        <UserSquare2 className="w-12 h-12 text-slate-400 dark:text-slate-500 stroke-[1.5]" />
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Foto belum tersedia
                        </span>
                      </div>
                    )}
                    {uploadingPhoto && (
                      <div className="absolute inset-0 bg-slate-950/50 flex items-center justify-center text-white">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoFileChange}
                    className="hidden"
                  />

                  {canUpdate && (
                    <div className="space-y-1.5">
                      <div className="inline-flex items-center rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                        <button
                          type="button"
                          disabled={uploadingPhoto}
                          onClick={() => fileInputRef.current?.click()}
                          className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Ubah
                        </button>
                        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
                        <button
                          type="button"
                          disabled={!effectivePhotoUrl || uploadingPhoto}
                          onClick={handleDeletePhoto}
                          className="h-9 px-3.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/70 dark:hover:bg-red-950/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        JPG, PNG, atau WebP · Maks. 2 MB
                      </p>
                    </div>
                  )}
                </div>

                {/* Primary Identifiers right beside photo on wider screens */}
                <div className="flex-1 min-w-0">
                  {!isEditing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                      <DetailField label="NIS" value={form.nis} mono />
                      <DetailField label="NISN" value={form.nisn} mono />
                      <DetailField label="Nama Lengkap" value={form.fullName} className="sm:col-span-2" />
                      <DetailField label="Nama Panggilan" value={form.nickname} />
                      <DetailField label="NIK" value={form.nik} mono />
                      <DetailField
                        label="Jenis Kelamin"
                        value={form.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                      />
                      <DetailField label="Agama" value={form.religion} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <Input
                        label="NIS Sekolah"
                        value={form.nis}
                        onChange={(e) => setForm({ ...form, nis: e.target.value })}
                        disabled={mode === 'edit'}
                        className="font-mono tabular-nums"
                        required
                      />
                      <Input
                        label="NISN (10 Digit)"
                        value={form.nisn}
                        onChange={(e) => setForm({ ...form, nisn: e.target.value })}
                        disabled={mode === 'edit'}
                        className="font-mono tabular-nums"
                        required
                      />
                      <div className="sm:col-span-2">
                        <Input
                          label="Nama Lengkap Murid"
                          value={form.fullName}
                          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                          required
                        />
                      </div>
                      <Input
                        label="Nama Panggilan"
                        value={form.nickname}
                        onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                        placeholder="Opsional"
                      />
                      <Input
                        label="NIK (16 Digit)"
                        value={form.nik}
                        onChange={(e) => setForm({ ...form, nik: e.target.value })}
                        className="font-mono tabular-nums"
                        maxLength={16}
                        placeholder="Opsional"
                      />
                      <Select
                        label="Jenis Kelamin"
                        value={form.gender}
                        onChange={(e) => setForm({ ...form, gender: e.target.value as 'L' | 'P' })}
                      >
                        <option value="L">Laki-laki</option>
                        <option value="P">Perempuan</option>
                      </Select>
                      <Select
                        label="Agama"
                        value={form.religion}
                        onChange={(e) => setForm({ ...form, religion: e.target.value })}
                      >
                        {['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'].map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Biodata Section */}
              {!isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                  <DetailField
                    label="Tempat, Tanggal Lahir"
                    value={
                      form.birthPlace || form.birthDate
                        ? `${form.birthPlace || '-'}, ${form.birthDate || '-'}`
                        : '-'
                    }
                    mono
                  />
                  <DetailField
                    label="Anak Ke- / Jumlah Saudara"
                    value={
                      form.childOrder || form.siblingCount
                        ? `${form.childOrder || '-'} dari ${form.siblingCount || '-'} bersaudara`
                        : '-'
                    }
                  />
                  <DetailField label="Rombel" value={`Kelas ${selectedClassName}`} />
                  <DetailField label="Status Murid" value={form.status} />
                  <DetailField label="Sekolah Asal" value={form.previousSchool} />
                  <DetailField label="Tanggal Diterima" value={form.enrollmentDate} mono />
                  <DetailField label="No. HP Murid" value={form.phone} mono />
                  <DetailField label="Email Murid" value={form.email} />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    label="Tempat Lahir"
                    value={form.birthPlace}
                    onChange={(e) => setForm({ ...form, birthPlace: e.target.value })}
                    required
                  />
                  <Input
                    label="Tanggal Lahir"
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                    className="font-mono tabular-nums"
                    required
                  />
                  <Input
                    label="Anak Ke-"
                    type="number"
                    min={1}
                    value={form.childOrder}
                    onChange={(e) => setForm({ ...form, childOrder: e.target.value })}
                    className="font-mono tabular-nums"
                    placeholder="Contoh: 1"
                  />
                  <Input
                    label="Jumlah Saudara"
                    type="number"
                    min={1}
                    value={form.siblingCount}
                    onChange={(e) => setForm({ ...form, siblingCount: e.target.value })}
                    className="font-mono tabular-nums"
                    placeholder="Contoh: 2"
                  />
                  <Select
                    label="Rombel Aktif"
                    value={form.classId}
                    onChange={(e) => setForm({ ...form, classId: Number(e.target.value) })}
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        Kelas {c.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="Status Murid"
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as StudentFormState['status'],
                      })
                    }
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Mutasi">Mutasi Keluar</option>
                    <option value="Lulus">Lulus / Alumni</option>
                    <option value="Keluar">Keluar</option>
                  </Select>
                  <Input
                    label="Sekolah Asal"
                    value={form.previousSchool}
                    onChange={(e) => setForm({ ...form, previousSchool: e.target.value })}
                    placeholder="TK / SD Asal"
                  />
                  <Input
                    label="Tanggal Diterima"
                    type="date"
                    value={form.enrollmentDate}
                    onChange={(e) => setForm({ ...form, enrollmentDate: e.target.value })}
                    className="font-mono tabular-nums"
                  />
                  <Input
                    label="No. HP Murid"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="font-mono tabular-nums"
                    placeholder="08xxxxxxxxxx"
                  />
                  <Input
                    label="Email Murid"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="murid@sekolah.sch.id"
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'ortu' && (
            <div className="space-y-5">
              {/* Data Ayah */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 pb-1.5 border-b border-slate-200 dark:border-slate-800">
                  Data Ayah Kandung
                </h3>
                {!isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                    <DetailField label="Nama Ayah" value={form.fatherName} />
                    <DetailField label="NIK Ayah" value={form.fatherNik} mono />
                    <DetailField label="Pendidikan Terakhir" value={form.fatherEducation} />
                    <DetailField label="Pekerjaan Ayah" value={form.fatherJob} />
                    <DetailField label="No. HP Ayah" value={form.fatherPhone} mono />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Input
                      label="Nama Ayah"
                      value={form.fatherName}
                      onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
                    />
                    <Input
                      label="NIK Ayah (16 Digit)"
                      value={form.fatherNik}
                      onChange={(e) => setForm({ ...form, fatherNik: e.target.value })}
                      className="font-mono tabular-nums"
                      maxLength={16}
                    />
                    <Select
                      label="Pendidikan Terakhir Ayah"
                      value={form.fatherEducation}
                      onChange={(e) => setForm({ ...form, fatherEducation: e.target.value })}
                    >
                      {educationOptions.map((opt) => (
                        <option key={opt || 'empty'} value={opt}>
                          {opt || '— Pilih Pendidikan —'}
                        </option>
                      ))}
                    </Select>
                    <Input
                      label="Pekerjaan Ayah"
                      value={form.fatherJob}
                      onChange={(e) => setForm({ ...form, fatherJob: e.target.value })}
                      placeholder="Contoh: Wiraswasta, PNS, Guru"
                    />
                    <Input
                      label="No. HP Ayah"
                      value={form.fatherPhone}
                      onChange={(e) => setForm({ ...form, fatherPhone: e.target.value })}
                      className="font-mono tabular-nums"
                    />
                  </div>
                )}
              </div>

              {/* Data Ibu */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 pb-1.5 border-b border-slate-200 dark:border-slate-800">
                  Data Ibu Kandung
                </h3>
                {!isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                    <DetailField label="Nama Ibu" value={form.motherName} />
                    <DetailField label="NIK Ibu" value={form.motherNik} mono />
                    <DetailField label="Pendidikan Terakhir" value={form.motherEducation} />
                    <DetailField label="Pekerjaan Ibu" value={form.motherJob} />
                    <DetailField label="No. HP Ibu" value={form.motherPhone} mono />
                    <DetailField label="No. Telepon Utama Orang Tua" value={form.parentPhone} mono />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Input
                      label="Nama Ibu"
                      value={form.motherName}
                      onChange={(e) => setForm({ ...form, motherName: e.target.value })}
                    />
                    <Input
                      label="NIK Ibu (16 Digit)"
                      value={form.motherNik}
                      onChange={(e) => setForm({ ...form, motherNik: e.target.value })}
                      className="font-mono tabular-nums"
                      maxLength={16}
                    />
                    <Select
                      label="Pendidikan Terakhir Ibu"
                      value={form.motherEducation}
                      onChange={(e) => setForm({ ...form, motherEducation: e.target.value })}
                    >
                      {educationOptions.map((opt) => (
                        <option key={opt || 'empty'} value={opt}>
                          {opt || '— Pilih Pendidikan —'}
                        </option>
                      ))}
                    </Select>
                    <Input
                      label="Pekerjaan Ibu"
                      value={form.motherJob}
                      onChange={(e) => setForm({ ...form, motherJob: e.target.value })}
                      placeholder="Contoh: Ibu Rumah Tangga, Karyawan"
                    />
                    <Input
                      label="No. HP Ibu"
                      value={form.motherPhone}
                      onChange={(e) => setForm({ ...form, motherPhone: e.target.value })}
                      className="font-mono tabular-nums"
                    />
                    <Input
                      label="No. Telepon Utama Orang Tua"
                      value={form.parentPhone}
                      onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
                      className="font-mono tabular-nums"
                      placeholder="Nomor kontak darurat/utama"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'alamat' && (
            <div className="space-y-4">
              {!isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                  <DetailField
                    label="Alamat Jalan / Dusun / Perumahan"
                    value={form.address}
                    className="sm:col-span-2"
                  />
                  <DetailField label="RT / RW" value={form.rtRw} mono />
                  <DetailField label="Kelurahan / Desa" value={form.village} />
                  <DetailField label="Kecamatan" value={form.district} />
                  <DetailField label="Kabupaten / Kota" value={form.regency} />
                  <DetailField label="Provinsi" value={form.province} />
                  <DetailField label="Kode Pos" value={form.postalCode} mono />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Alamat Jalan / Dusun / Perumahan
                    </label>
                    <textarea
                      rows={2}
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Contoh: Jl. Merdeka No. 14"
                      className="w-full p-2.5 text-sm bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
                    />
                  </div>
                  <Input
                    label="RT / RW"
                    value={form.rtRw}
                    onChange={(e) => setForm({ ...form, rtRw: e.target.value })}
                    className="font-mono tabular-nums"
                    placeholder="Contoh: 003 / 005"
                  />
                  <Input
                    label="Kelurahan / Desa"
                    value={form.village}
                    onChange={(e) => setForm({ ...form, village: e.target.value })}
                  />
                  <Input
                    label="Kecamatan"
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                  />
                  <Input
                    label="Kabupaten / Kota"
                    value={form.regency}
                    onChange={(e) => setForm({ ...form, regency: e.target.value })}
                  />
                  <Input
                    label="Provinsi"
                    value={form.province}
                    onChange={(e) => setForm({ ...form, province: e.target.value })}
                  />
                  <Input
                    label="Kode Pos"
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                    className="font-mono tabular-nums"
                    maxLength={10}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'wali' && (
            <div className="space-y-4">
              {!isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                  <DetailField label="Nama Wali Murid" value={form.guardianName} />
                  <DetailField label="Hubungan Keluarga" value={form.guardianRelation} />
                  <DetailField label="Pekerjaan Wali" value={form.guardianJob} />
                  <DetailField label="No. HP Wali" value={form.guardianPhone} mono />
                  <DetailField
                    label="Alamat Wali"
                    value={form.guardianAddress}
                    className="sm:col-span-2"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    label="Nama Wali Murid"
                    value={form.guardianName}
                    onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
                    placeholder="Kosongkan bila tinggal bersama orang tua"
                  />
                  <Input
                    label="Hubungan Keluarga"
                    value={form.guardianRelation}
                    onChange={(e) => setForm({ ...form, guardianRelation: e.target.value })}
                    placeholder="Contoh: Paman, Bibi, Kakek"
                  />
                  <Input
                    label="Pekerjaan Wali"
                    value={form.guardianJob}
                    onChange={(e) => setForm({ ...form, guardianJob: e.target.value })}
                  />
                  <Input
                    label="No. HP Wali"
                    value={form.guardianPhone}
                    onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
                    className="font-mono tabular-nums"
                  />
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Alamat Wali
                    </label>
                    <textarea
                      rows={2}
                      value={form.guardianAddress}
                      onChange={(e) => setForm({ ...form, guardianAddress: e.target.value })}
                      className="w-full p-2.5 text-sm bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'wali_asuh' && (
            <div className="space-y-4">
              {!isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                  <DetailField label="Nama Wali Asuh" value={form.waliAsuhName} />
                  <DetailField label="Nama Wali Asrama" value={form.waliAsramaName} />
                  <DetailField label="Kamar / Gedung Asrama" value={form.dormitoryRoom} />
                  <DetailField
                    label="Catatan Pembinaan Asrama"
                    value={form.keasramaanNotes}
                    className="sm:col-span-2"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Select
                    label="Pilih PTK Wali Asuh"
                    value={form.waliAsuhTeacherId}
                    onChange={(e) => {
                      const val = e.target.value;
                      const found = teachers.find((t) => String(t.id) === val);
                      setForm({
                        ...form,
                        waliAsuhTeacherId: val,
                        waliAsuhName: found ? found.fullName : form.waliAsuhName,
                      });
                    }}
                  >
                    <option value="">— Pilih Guru / Wali Asuh —</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName}
                        {t.specialization ? ` (${t.specialization})` : ''}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Nama Wali Asuh (Tercetak)"
                    value={form.waliAsuhName}
                    onChange={(e) => setForm({ ...form, waliAsuhName: e.target.value })}
                    placeholder="Nama Wali Asuh di Rapor Keasramaan"
                  />
                  <Input
                    label="Nama Wali Asrama"
                    value={form.waliAsramaName}
                    onChange={(e) => setForm({ ...form, waliAsramaName: e.target.value })}
                    placeholder="Pembina Asrama"
                  />
                  <Input
                    label="Kamar / Gedung Asrama"
                    value={form.dormitoryRoom}
                    onChange={(e) => setForm({ ...form, dormitoryRoom: e.target.value })}
                    placeholder="Contoh: Asrama Putra - Kamar 2B"
                  />
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Catatan Pembinaan Asrama
                    </label>
                    <textarea
                      rows={3}
                      value={form.keasramaanNotes}
                      onChange={(e) => setForm({ ...form, keasramaanNotes: e.target.value })}
                      placeholder="Catatan khusus pembinaan kedisiplinan, ibadah, atau kesehatan di asrama..."
                      className="w-full p-2.5 text-sm bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Footer Actions matching reference */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B1320]/60 shrink-0">
          {!isEditing ? (
            <>
              <Button variant="outline" onClick={onClose}>
                <XCircle className="w-4 h-4" />
                Tutup
              </Button>
              {canUpdate && (
                <Button onClick={() => setMode('edit')}>
                  <Edit className="w-4 h-4" />
                  Edit
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
                Batal
              </Button>
              <Button type="submit" form="student-detail-edit-form" loading={saving}>
                <Save className="w-4 h-4" />
                {mode === 'create' ? 'Simpan Murid Baru' : 'Simpan Perubahan'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
