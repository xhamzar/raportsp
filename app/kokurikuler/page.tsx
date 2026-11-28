'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  TableSkeleton,
} from '@/components/ui/Primitives';

interface KokurikulerItem {
  id: number;
  classId: number;
  semesterId: number;
  code: string;
  title: string;
  dimensions: string[];
  description: string;
}

const EIGHT_DPL_OPTIONS = [
  'Keimanan dan Ketakwaan kepada Tuhan Yang Maha Esa',
  'Kewargaan',
  'Penalaran kritis',
  'Kreativitas',
  'Kolaborasi',
  'Kemandirian',
  'Kesehatan',
  'Komunikasi',
] as const;

function normalizeDplSelection(rawDimensions: string[]): string[] {
  const mapped = rawDimensions.map((d) => {
    const low = d.trim().toLowerCase();
    if (low.includes('keimanan') || low.includes('ketakwaan')) {
      return 'Keimanan dan Ketakwaan kepada Tuhan Yang Maha Esa';
    }
    if (low.includes('penalaran')) return 'Penalaran kritis';
    const match = EIGHT_DPL_OPTIONS.find((opt) => opt.toLowerCase() === low);
    return match || d.trim();
  });
  return Array.from(new Set(mapped));
}

export default function KokurikulerPage() {
  const { selectedClassId, selectedClass, notify, canAny } = useApp();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<KokurikulerItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KokurikulerItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    title: '',
    dimensions: [] as string[],
  });

  const [deleteTarget, setDeleteTarget] = useState<{ ids: number[]; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = canAny(['kurikulum', 'penilaian'], 'create');
  const canUpdate = canAny(['kurikulum', 'penilaian'], 'update');
  const canDelete = canAny(['kurikulum', 'penilaian'], 'delete');

  const loadData = useCallback(async () => {
    setLoading(true);
    const query = selectedClassId ? `?classId=${selectedClassId}` : '';
    const res = await fetch(`/api/assessments${query}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      setItems(json.cocurricularProjects || []);
      setSelectedIds([]);
    }
    setLoading(false);
  }, [selectedClassId]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadData();
    });
  }, [loadData]);

  const openCreateModal = () => {
    setEditingItem(null);
    const grade = selectedClass?.gradeLevel || 1;
    setForm({
      code: `K${grade}-${items.length + 1}`,
      title: '',
      dimensions: [],
    });
    setModalOpen(true);
  };

  const openEditModal = (item: KokurikulerItem) => {
    setEditingItem(item);
    setForm({
      code: item.code,
      title: item.title,
      dimensions: normalizeDplSelection(item.dimensions || []),
    });
    setModalOpen(true);
  };

  const toggleDimension = (dim: string) => {
    setForm((prev) => ({
      ...prev,
      dimensions: prev.dimensions.includes(dim)
        ? prev.dimensions.filter((d) => d !== dim)
        : [...prev.dimensions, dim],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) {
      notify('error', 'Pilih kelas aktif terlebih dahulu.');
      return;
    }
    if (form.dimensions.length === 0) {
      notify('error', 'Pilih minimal 1 Dimensi Profil Lulusan (8 DPL).');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'cocurricular_project',
        id: editingItem?.id,
        classId: selectedClass.id,
        code: form.code.trim(),
        title: form.title.trim(),
        dimensions: form.dimensions,
        description: editingItem?.description || '',
      }),
    });
    setSaving(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan kegiatan kokurikuler.');
      return;
    }
    setModalOpen(false);
    notify(
      'success',
      editingItem ? 'Kegiatan kokurikuler diperbarui.' : 'Kegiatan kokurikuler ditambahkan.'
    );
    await loadData();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleteTarget.ids.length === 0) return;
    setDeleting(true);
    const res = await fetch(
      `/api/assessments?kind=cocurricular_project&ids=${deleteTarget.ids.join(',')}`,
      {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      }
    );
    setDeleting(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify('error', json.error || 'Gagal menghapus kegiatan kokurikuler.');
      return;
    }
    notify('success', `${deleteTarget.label} berhasil dihapus.`);
    setDeleteTarget(null);
    await loadData();
  };

  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : items.map((i) => i.id));
  };
  const toggleSelectRow = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <AppShell title="Kokurikuler" requiredModule={['kurikulum', 'penilaian']}>
      <div className="space-y-4">
        <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Daftar Kokurikuler
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kelas aktif: {selectedClass?.name || '-'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/penilaian?tab=kokurikuler"
                className="text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap mr-1"
              >
                Input Nilai →
              </Link>
              {canCreate && (
                <div className="relative inline-flex items-center">
                  <Button
                    size="sm"
                    onClick={openCreateModal}
                    className="rounded-r-none border-r border-white/20"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah
                  </Button>
                  <button
                    type="button"
                    aria-label="Opsi daftar kokurikuler"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="h-9 px-2.5 bg-[#0F2942] hover:bg-[#163859] dark:bg-[#1E3A5F] dark:hover:bg-[#2B4C7E] text-white rounded-r-md border-l border-white/15 cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-10 w-48 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-md shadow-lg z-20 py-1">
                      {canDelete && (
                        <button
                          type="button"
                          disabled={selectedIds.length === 0}
                          onClick={() => {
                            setMenuOpen(false);
                            setDeleteTarget({
                              ids: selectedIds,
                              label: `${selectedIds.length} kegiatan kokurikuler`,
                            });
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Hapus Terpilih ({selectedIds.length})
                        </button>
                      )}
                      <Link
                        href="/penilaian?tab=kokurikuler"
                        onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Buka Penilaian Kokurikuler
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={5} />
          ) : items.length === 0 ? (
            <EmptyState
              title="Belum ada kegiatan kokurikuler untuk kelas ini"
              description="Tambahkan kegiatan kokurikuler beserta Dimensi Profil Lulusan (8 DPL) melalui tombol Tambah."
              action={
                canCreate ? (
                  <Button size="sm" onClick={openCreateModal}>
                    <Plus className="w-4 h-4" />
                    Tambah Kokurikuler
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
                      <th className="py-3 px-3 w-10">
                        <input
                          type="checkbox"
                          aria-label="Pilih semua kegiatan kokurikuler"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3 font-semibold w-12 col-id">No</th>
                      <th className="py-3 px-3 font-semibold w-24 col-id col-cell-div">Kode</th>
                      <th className="py-3 px-3 font-semibold col-a col-sep">8 DPL</th>
                      <th className="py-3 px-3 font-semibold col-b col-sep">
                        Kegiatan Kokurikuler
                      </th>
                      <th className="py-3 px-3 font-semibold text-right col-action col-sep">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            aria-label={`Pilih ${item.code}`}
                            checked={selectedIds.includes(item.id)}
                            onChange={() => toggleSelectRow(item.id)}
                            className="rounded border-slate-300 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 col-id">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 col-id col-cell-div whitespace-nowrap">
                          {item.code}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 leading-relaxed col-a col-sep">
                          {(item.dimensions || []).join(', ') || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-900 dark:text-slate-100 leading-relaxed col-b col-sep">
                          {item.title}
                        </td>
                        <td className="py-2.5 px-3 text-right col-action col-sep">
                          <div className="inline-flex items-center gap-1">
                            {canUpdate && (
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                aria-label={`Edit ${item.code}`}
                                className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({ ids: [item.id], label: item.code })
                                }
                                aria-label={`Hapus ${item.code}`}
                                className="p-1.5 rounded border border-red-200 dark:border-red-900/50 bg-red-50/60 hover:bg-red-100 dark:bg-red-950/30 text-red-600 cursor-pointer"
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
          )}
        </div>
      </div>

      {/* Modal Tambah / Edit Kokurikuler */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Kokurikuler' : 'Tambah Kokurikuler'}
        subtitle={`Kelas aktif: ${selectedClass?.name || '-'}`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <p className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
              Pilih Dimensi Profil Lulusan
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
              {EIGHT_DPL_OPTIONS.map((dim) => {
                const checked = form.dimensions.includes(dim);
                return (
                  <label
                    key={dim}
                    className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer leading-snug"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDimension(dim)}
                      className="mt-0.5 rounded border-slate-300 cursor-pointer shrink-0"
                    />
                    <span>{dim}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <Input
            label="Kode"
            placeholder="Contoh: K1-1"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            required
          />

          <div>
            <label
              htmlFor="kegiatan-kokurikuler"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Kegiatan Kokurikuler
            </label>
            <textarea
              id="kegiatan-kokurikuler"
              rows={3}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Contoh: Merancang kegiatan pengelolaan sampah di lingkungan sekolah."
              className="w-full p-3 text-xs bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
              required
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              <X className="w-3.5 h-3.5" />
              Batal
            </Button>
            <Button type="submit" loading={saving}>
              <Save className="w-3.5 h-3.5" />
              {editingItem ? 'Simpan Perubahan' : 'Simpan'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Konfirmasi Penghapusan"
        message={`Apakah Anda yakin ingin menghapus "${deleteTarget?.label}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus"
        danger
      />
    </AppShell>
  );
}
