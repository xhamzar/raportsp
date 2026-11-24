'use client';

import React, { useEffect, useState } from 'react';
import { Edit, Plus } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import { Button, Input, Modal, Select, TableSkeleton } from '@/components/ui/Primitives';

interface TeacherItem {
  id: number;
  nuptk: string;
  nip: string;
  fullName: string;
  gender: 'L' | 'P';
  employmentStatus: string;
  education: string;
  specialization: string;
  phone: string;
  email: string;
  weeklyHours: number;
  assignments: Array<{ id: number; className: string; assignmentType: string; weeklyHours: number }>;
}

interface StaffItem {
  id: number;
  nip: string;
  fullName: string;
  gender: string;
  position: string;
  employmentStatus: string;
  phone: string;
}

export default function GuruPage() {
  const { notify, can } = useApp();
  const [tab, setTab] = useState<'guru' | 'staff'>('guru');
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherItem | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    gender: 'L' as 'L' | 'P',
    nuptk: '',
    nip: '',
    employmentStatus: 'PNS',
    education: 'S1 PGSD',
    specialization: 'Guru Kelas',
    phone: '',
    email: '',
  });

  const [staffModal, setStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({
    fullName: '',
    gender: 'L' as 'L' | 'P',
    nip: '',
    position: 'Staff Tata Usaha',
    employmentStatus: 'Honorer',
    phone: '',
  });

  const loadData = async () => {
    setLoading(true);
    const res = await fetch('/api/teachers', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      setTeachers(json.teachers || []);
      setStaff(json.staff || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadData();
    });
  }, []);

  const openCreateTeacher = () => {
    setEditingTeacher(null);
    setForm({
      fullName: '',
      gender: 'L',
      nuptk: '',
      nip: '',
      employmentStatus: 'PPPK',
      education: 'S1 PGSD',
      specialization: 'Guru Kelas',
      phone: '',
      email: '',
    });
    setModalOpen(true);
  };

  const openEditTeacher = (t: TeacherItem) => {
    setEditingTeacher(t);
    setForm({
      fullName: t.fullName,
      gender: t.gender,
      nuptk: t.nuptk || '',
      nip: t.nip || '',
      employmentStatus: t.employmentStatus,
      education: t.education,
      specialization: t.specialization,
      phone: t.phone || '',
      email: t.email || '',
    });
    setModalOpen(true);
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/teachers', {
      method: editingTeacher ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify(editingTeacher ? { id: editingTeacher.id, ...form } : form),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan data guru.');
      return;
    }
    setModalOpen(false);
    notify('success', editingTeacher ? 'Data pendidik diperbarui.' : 'Pendidik baru ditambahkan.');
    await loadData();
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ kind: 'staff', ...staffForm }),
    });
    if (res.ok) {
      setStaffModal(false);
      notify('success', 'Tenaga kependidikan ditambahkan.');
      await loadData();
    } else {
      notify('error', 'Gagal menambah staff.');
    }
  };

  return (
    <AppShell title="Guru & Tendik" requiredModule="guru">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-lg font-bold text-slate-900 dark:text-slate-100">
              Manajemen Pendidik & Tenaga Kependidikan
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Data NUPTK/NIP, penugasan guru kelas & guru mata pelajaran, serta beban jam mengajar.
            </p>
          </div>
          {can('guru', 'create') && (
            <Button
              size="sm"
              onClick={() => (tab === 'guru' ? openCreateTeacher() : setStaffModal(true))}
            >
              <Plus className="w-4 h-4" />
              {tab === 'guru' ? 'Tambah Guru' : 'Tambah Tendik'}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-md w-fit">
          <button
            type="button"
            onClick={() => setTab('guru')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded cursor-pointer ${
              tab === 'guru'
                ? 'bg-white dark:bg-[#111C2E] text-[#0F2942] dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Pendidik ({teachers.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('staff')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded cursor-pointer ${
              tab === 'staff'
                ? 'bg-white dark:bg-[#111C2E] text-[#0F2942] dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Tenaga Kependidikan ({staff.length})
          </button>
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : tab === 'guru' ? (
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-3 px-3 font-semibold w-10">No</th>
                    <th className="py-3 px-3 font-semibold">Nama Pendidik</th>
                    <th className="py-3 px-3 font-semibold">NIP / NUPTK</th>
                    <th className="py-3 px-3 font-semibold">Status & Pendidikan</th>
                    <th className="py-3 px-3 font-semibold">Bidang / Penugasan</th>
                    <th className="py-3 px-3 font-semibold text-right">Beban JP</th>
                    <th className="py-3 px-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {teachers.map((t, idx) => (
                    <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                        {t.fullName}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">
                        <div>{t.nip || '-'}</div>
                        <div className="text-[11px] text-slate-500">NUPTK: {t.nuptk || '-'}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        {t.employmentStatus} · {t.education}
                      </td>
                      <td className="py-2.5 px-3">
                        <div>{t.specialization}</div>
                        <div className="text-[11px] text-slate-500">
                          {t.assignments.map((a) => `${a.assignmentType} (${a.className})`).join(', ') || '-'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                        {t.weeklyHours} JP
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {can('guru', 'update') && (
                          <button
                            type="button"
                            onClick={() => openEditTeacher(t)}
                            className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-[#0F2942] dark:text-blue-400 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3 font-semibold w-10">No</th>
                  <th className="py-3 px-3 font-semibold">Nama Lengkap</th>
                  <th className="py-3 px-3 font-semibold">NIP</th>
                  <th className="py-3 px-3 font-semibold">Jabatan</th>
                  <th className="py-3 px-3 font-semibold">Status</th>
                  <th className="py-3 px-3 font-semibold">Telepon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {staff.map((s, idx) => (
                  <tr key={s.id}>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-medium">{s.fullName}</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">{s.nip || '-'}</td>
                    <td className="py-2.5 px-3">{s.position}</td>
                    <td className="py-2.5 px-3">{s.employmentStatus}</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">{s.phone || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTeacher ? 'Edit Data Pendidik' : 'Tambah Pendidik Baru'}
      >
        <form onSubmit={handleSaveTeacher} className="space-y-4">
          <Input label="Nama Lengkap & Gelar" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Jenis Kelamin" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as 'L' | 'P' })}>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </Select>
            <Select label="Status Kepegawaian" value={form.employmentStatus} onChange={(e) => setForm({ ...form, employmentStatus: e.target.value })}>
              <option value="PNS">PNS</option>
              <option value="PPPK">PPPK</option>
              <option value="GTY">GTY</option>
              <option value="Honorer">Honorer</option>
            </Select>
            <Input label="NIP" value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} className="font-mono" />
            <Input label="NUPTK" value={form.nuptk} onChange={(e) => setForm({ ...form, nuptk: e.target.value })} className="font-mono" />
            <Input label="Pendidikan Terakhir" value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} required />
            <Input label="Spesialisasi / Jabatan" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} required />
            <Input label="Telepon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button type="submit">Simpan Pendidik</Button>
          </div>
        </form>
      </Modal>

      <Modal open={staffModal} onClose={() => setStaffModal(false)} title="Tambah Tenaga Kependidikan">
        <form onSubmit={handleSaveStaff} className="space-y-4">
          <Input label="Nama Lengkap" value={staffForm.fullName} onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Jabatan" value={staffForm.position} onChange={(e) => setStaffForm({ ...staffForm, position: e.target.value })} required />
            <Input label="Status Kepegawaian" value={staffForm.employmentStatus} onChange={(e) => setStaffForm({ ...staffForm, employmentStatus: e.target.value })} required />
            <Input label="NIP" value={staffForm.nip} onChange={(e) => setStaffForm({ ...staffForm, nip: e.target.value })} className="font-mono" />
            <Input label="Telepon" value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStaffModal(false)}>Batal</Button>
            <Button type="submit">Simpan Tendik</Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
