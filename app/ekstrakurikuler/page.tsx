'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Pencil, Plus, Save, SquarePen, Trash2, X } from 'lucide-react';
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

interface EkstraItem {
  id: number;
  name: string;
  instructorName: string;
  scheduleDay: string;
  objectives: string[];
}

export default function EkstrakurikulerPage() {
  const { selectedClassId, selectedClass, notify, canAny } = useApp();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<EkstraItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  // Add / Edit Ekstrakurikuler Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EkstraItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    instructorName: '',
    scheduleDay: 'Sabtu',
  });

  // Edit TP Modal
  const [tpItem, setTpItem] = useState<EkstraItem | null>(null);
  const [tpDraftList, setTpDraftList] = useState<string[]>([]);
  const [newTpText, setNewTpText] = useState('');
  const [savingTp, setSavingTp] = useState(false);

  // Delete dialog
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
      setItems(json.extracurriculars || []);
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
    setForm({ name: '', instructorName: '', scheduleDay: 'Sabtu' });
    setModalOpen(true);
  };

  const openEditModal = (item: EkstraItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      instructorName: item.instructorName === '-' ? '' : item.instructorName || '',
      scheduleDay: item.scheduleDay || 'Sabtu',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'extracurricular',
        id: editingItem?.id,
        name: form.name.trim(),
        instructorName: form.instructorName.trim() || '-',
        scheduleDay: form.scheduleDay.trim() || 'Sabtu',
      }),
    });
    setSaving(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan ekstrakurikuler.');
      return;
    }
    setModalOpen(false);
    notify('success', editingItem ? 'Ekstrakurikuler diperbarui.' : 'Ekstrakurikuler ditambahkan.');
    await loadData();
  };

  const openTpModal = (item: EkstraItem) => {
    setTpItem(item);
    setTpDraftList([...(item.objectives || [])]);
    setNewTpText('');
  };

  const handleAddTpLine = () => {
    const clean = newTpText.trim();
    if (!clean) return;
    setTpDraftList((prev) => [...prev, clean]);
    setNewTpText('');
  };

  const handleSaveTp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpItem) return;
    const finalObjectives = [
      ...tpDraftList.map((s) => s.trim()).filter(Boolean),
      ...(newTpText.trim() ? [newTpText.trim()] : []),
    ];
    setSavingTp(true);
    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'extracurricular',
        id: tpItem.id,
        name: tpItem.name,
        instructorName: tpItem.instructorName || '-',
        scheduleDay: tpItem.scheduleDay || 'Sabtu',
        learningObjectives: finalObjectives,
      }),
    });
    setSavingTp(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan Tujuan Pembelajaran.');
      return;
    }
    setTpItem(null);
    notify('success', 'Tujuan Pembelajaran ekstrakurikuler tersimpan.');
    await loadData();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleteTarget.ids.length === 0) return;
    setDeleting(true);
    const res = await fetch(
      `/api/assessments?kind=extracurricular&ids=${deleteTarget.ids.join(',')}`,
      {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      }
    );
    setDeleting(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify('error', json.error || 'Gagal menghapus ekstrakurikuler.');
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
    <AppShell title="Ekstrakurikuler" requiredModule={['kurikulum', 'penilaian']}>
      <div className="space-y-4">
        <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Daftar Ekstrakurikuler
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kelas aktif: {selectedClass?.name || '-'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/penilaian?tab=ekstra"
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
                    aria-label="Opsi daftar ekstrakurikuler"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="h-9 px-2.5 bg-[#0F2942] hover:bg-[#163859] dark:bg-[#1E3A5F] dark:hover:bg-[#2B4C7E] text-white rounded-r-md border-l border-white/15 cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-10 w-52 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-md shadow-lg z-20 py-1">
                      {canDelete && (
                        <button
                          type="button"
                          disabled={selectedIds.length === 0}
                          onClick={() => {
                            setMenuOpen(false);
                            setDeleteTarget({
                              ids: selectedIds,
                              label: `${selectedIds.length} ekstrakurikuler`,
                            });
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Hapus Terpilih ({selectedIds.length})
                        </button>
                      )}
                      <Link
                        href="/penilaian?tab=ekstra"
                        onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Buka Penilaian Ekstrakurikuler
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
              title="Belum ada kegiatan ekstrakurikuler"
              description="Klik Tambah untuk mendaftarkan ekstrakurikuler sekolah dan mengatur Tujuan Pembelajarannya."
              action={
                canCreate ? (
                  <Button size="sm" onClick={openCreateModal}>
                    <Plus className="w-4 h-4" />
                    Tambah Ekstrakurikuler
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
                          aria-label="Pilih semua ekstrakurikuler"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3 font-semibold w-12 col-id">No</th>
                      <th className="py-3 px-3 font-semibold col-a col-sep">Ekstrakurikuler</th>
                      <th className="py-3 px-3 font-semibold col-b col-sep">
                        Tujuan Pembelajaran
                      </th>
                      <th className="py-3 px-3 font-semibold text-right col-action col-sep">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const tpCount = item.objectives?.length || 0;
                      return (
                        <tr key={item.id}>
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              aria-label={`Pilih ${item.name}`}
                              checked={selectedIds.includes(item.id)}
                              onChange={() => toggleSelectRow(item.id)}
                              className="rounded border-slate-300 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 col-id">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 col-a col-sep">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {item.name}
                            </div>
                            {item.instructorName && item.instructorName !== '-' && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Pembina: {item.instructorName} · {item.scheduleDay}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 col-b col-sep">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openTpModal(item)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium whitespace-nowrap cursor-pointer transition-colors"
                              >
                                <SquarePen className="w-3.5 h-3.5" />
                                Edit TP
                              </button>
                              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {tpCount > 0 ? `${tpCount} TP` : 'Belum ada TP'}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right col-action col-sep">
                            <div className="inline-flex items-center gap-1">
                              {canUpdate && (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(item)}
                                  aria-label={`Edit ${item.name}`}
                                  className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({ ids: [item.id], label: item.name })
                                  }
                                  aria-label={`Hapus ${item.name}`}
                                  className="p-1.5 rounded border border-red-200 dark:border-red-900/50 bg-red-50/60 hover:bg-red-100 dark:bg-red-950/30 text-red-600 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
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
      </div>

      {/* Modal Tambah / Edit Ekstrakurikuler */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Ekstrakurikuler' : 'Tambah Ekstrakurikuler'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Nama Ekstrakurikuler"
            placeholder="Contoh: Pramuka"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Pembina (Opsional)"
              placeholder="Contoh: Kak Arif"
              value={form.instructorName}
              onChange={(e) => setForm({ ...form, instructorName: e.target.value })}
            />
            <Input
              label="Hari Kegiatan (Opsional)"
              placeholder="Contoh: Sabtu"
              value={form.scheduleDay}
              onChange={(e) => setForm({ ...form, scheduleDay: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" loading={saving}>
              <Save className="w-3.5 h-3.5" />
              {editingItem ? 'Simpan Perubahan' : 'Simpan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit TP Ekstrakurikuler */}
      <Modal
        open={Boolean(tpItem)}
        onClose={() => setTpItem(null)}
        title={`Tujuan Pembelajaran — ${tpItem?.name || ''}`}
        subtitle="Daftar capaian pembinaan yang digunakan saat penilaian dan cetak rapor."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveTp} className="space-y-4">
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {tpDraftList.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                Belum ada tujuan pembelajaran. Tambahkan baris baru di bawah ini.
              </p>
            ) : (
              tpDraftList.map((tp, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-6 text-xs font-mono tabular-nums text-slate-500 text-right shrink-0">
                    {index + 1}.
                  </span>
                  <input
                    type="text"
                    value={tp}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTpDraftList((prev) => prev.map((item, i) => (i === index ? val : item)));
                    }}
                    className="flex-1 h-9 px-3 text-xs bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
                  />
                  <button
                    type="button"
                    onClick={() => setTpDraftList((prev) => prev.filter((_, i) => i !== index))}
                    aria-label={`Hapus TP ${index + 1}`}
                    className="p-2 rounded border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <input
              type="text"
              value={newTpText}
              onChange={(e) => setNewTpText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTpLine();
                }
              }}
              placeholder="Ketik rumusan tujuan pembelajaran baru..."
              className="flex-1 h-9 px-3 text-xs bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
            />
            <Button type="button" size="sm" variant="outline" onClick={handleAddTpLine}>
              <Plus className="w-3.5 h-3.5" />
              Tambah Baris
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setTpItem(null)}>
              <X className="w-3.5 h-3.5" />
              Batal
            </Button>
            <Button type="submit" loading={savingTp}>
              <Save className="w-3.5 h-3.5" />
              Simpan TP
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
