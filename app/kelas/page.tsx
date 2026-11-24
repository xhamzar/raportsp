'use client';

import React, { useEffect, useState } from 'react';
import { Edit, Plus, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import { Button, Input, Modal, Select, TableSkeleton } from '@/components/ui/Primitives';

interface ClassItem {
  id: number;
  name: string;
  gradeLevel: number;
  fase: string;
  homeroomTeacherId: number | null;
  homeroomTeacherName: string | null;
  capacity: number;
  studentCount: number;
}

interface TeacherOption {
  id: number;
  fullName: string;
}

export default function KelasPage() {
  const { selectedClassId, setSelectedClassId, refreshContext, notify, can } = useApp();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [gradeLevel, setGradeLevel] = useState(4);
  const [name, setName] = useState('');
  const [homeroomTeacherId, setHomeroomTeacherId] = useState<string>('');
  const [capacity, setCapacity] = useState(28);

  const loadData = async () => {
    setLoading(true);
    const [acRes, tRes] = await Promise.all([
      fetch('/api/academics?module=kelas', { cache: 'no-store' }),
      fetch('/api/teachers', { cache: 'no-store' }),
    ]);
    if (acRes.ok) {
      const d = await acRes.json();
      setClasses(d.classes || []);
    }
    if (tRes.ok) {
      const t = await tRes.json();
      setTeachers(t.teachers || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadData();
    });
  }, []);

  const openCreate = () => {
    setEditId(null);
    setGradeLevel(4);
    setName('4 B');
    setHomeroomTeacherId('');
    setCapacity(28);
    setModalOpen(true);
  };

  const openEdit = (c: ClassItem) => {
    setEditId(c.id);
    setGradeLevel(c.gradeLevel);
    setName(c.name);
    setHomeroomTeacherId(c.homeroomTeacherId ? String(c.homeroomTeacherId) : '');
    setCapacity(c.capacity);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editId ? 'PATCH' : 'POST';
    const res = await fetch('/api/academics', {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'class',
        id: editId ?? undefined,
        gradeLevel: Number(gradeLevel),
        name,
        homeroomTeacherId: homeroomTeacherId ? Number(homeroomTeacherId) : null,
        capacity: Number(capacity),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan data rombel.');
      return;
    }
    setModalOpen(false);
    notify('success', editId ? 'Rombel berhasil diperbarui.' : 'Rombel baru berhasil dibuat.');
    await refreshContext();
    await loadData();
  };

  return (
    <AppShell title="Rombel & Kelas" requiredModule="kelas">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-lg font-bold text-slate-900 dark:text-slate-100">
              Manajemen Rombongan Belajar (Rombel)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kelola tingkat kelas SD/MI (Fase A, B, C), wali/guru kelas, serta kapasitas rombel.
            </p>
          </div>
          {can('kelas', 'create') && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Tambah Rombel
            </Button>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((c) => {
              const isSelected = c.id === selectedClassId;
              return (
                <div
                  key={c.id}
                  className={`bg-white dark:bg-[#111C2E] border rounded-lg p-5 flex flex-col justify-between gap-4 ${
                    isSelected
                      ? 'border-[#1D4ED8] ring-1 ring-[#1D4ED8]/20'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Kelas {c.name}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Tingkat {c.gradeLevel} · Fase {c.fase}
                        </p>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {c.studentCount}/{c.capacity} murid
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Guru Kelas / Wali Kelas
                      </p>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                        {c.homeroomTeacherName || 'Belum ditetapkan'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <Button
                      variant={isSelected ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSelectedClassId(c.id);
                        notify('info', `Konteks aktif berpindah ke Kelas ${c.name}.`);
                      }}
                    >
                      <Users className="w-3.5 h-3.5" />
                      {isSelected ? 'Kelas Aktif' : 'Pilih Kelas'}
                    </Button>
                    {can('kelas', 'update') && (
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                        <Edit className="w-3.5 h-3.5" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Rombongan Belajar' : 'Tambah Rombongan Belajar'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {!editId && (
            <Select
              label="Tingkat Kelas"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((g) => (
                <option key={g} value={g}>
                  Kelas {g} (Fase {g <= 2 ? 'A' : g <= 4 ? 'B' : 'C'})
                </option>
              ))}
            </Select>
          )}
          <Input
            label="Nama Rombel"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: 4 B"
            required
          />
          <Select
            label="Guru Kelas / Wali Kelas"
            value={homeroomTeacherId}
            onChange={(e) => setHomeroomTeacherId(e.target.value)}
          >
            <option value="">-- Pilih Guru --</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </Select>
          <Input
            label="Kapasitas Kursi"
            type="number"
            min={1}
            max={50}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button type="submit">Simpan Rombel</Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
