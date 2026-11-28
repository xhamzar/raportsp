'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Pencil, Plus, Save, SquarePen, Trash2, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import {
  AlertBox,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  TableSkeleton,
} from '@/components/ui/Primitives';

interface KeasramaanIndicatorItem {
  id: number;
  category: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  learningObjectives: string[];
}

const SUGGESTED_CATEGORIES = [
  'Kemandirian',
  'Kedisiplinan',
  'Kebersihan',
  'A. Kepemimpinan',
  'B. Ketaatan Ibadah',
];

export default function KeasramaanPage() {
  const { selectedClassId, selectedClass, school, notify, can } = useApp();
  const [loading, setLoading] = useState(true);
  const [indicators, setIndicators] = useState<KeasramaanIndicatorItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  // Kelola Mata Evaluasi Modal
  const [manageModal, setManageModal] = useState(false);
  const [editingInd, setEditingInd] = useState<KeasramaanIndicatorItem | null>(null);
  const [savingInd, setSavingInd] = useState(false);
  const [indForm, setIndForm] = useState({
    category: 'Kemandirian',
    name: '',
    sortOrder: 1,
    isActive: true,
  });

  // Edit TP Modal
  const [tpIndicator, setTpIndicator] = useState<KeasramaanIndicatorItem | null>(null);
  const [tpDraftList, setTpDraftList] = useState<string[]>([]);
  const [newTpText, setNewTpText] = useState('');
  const [savingTp, setSavingTp] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<KeasramaanIndicatorItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = can('keasramaan', 'create');
  const canUpdate = can('keasramaan', 'update');
  const canDelete = can('keasramaan', 'delete');

  const loadData = useCallback(async () => {
    setLoading(true);
    const query = selectedClassId ? `?classId=${selectedClassId}` : '';
    const res = await fetch(`/api/keasramaan${query}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      setIndicators(json.indicators || []);
    }
    setLoading(false);
  }, [selectedClassId]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadData();
    });
  }, [loadData]);

  const groupedCategories = useMemo(() => {
    const groups = new Map<string, KeasramaanIndicatorItem[]>();
    for (const ind of indicators.filter((i) => i.isActive)) {
      const list = groups.get(ind.category) || [];
      list.push(ind);
      groups.set(ind.category, list);
    }
    return Array.from(groups.entries());
  }, [indicators]);

  const resetIndForm = () => {
    setEditingInd(null);
    setIndForm({
      category: groupedCategories[0]?.[0] || 'Kemandirian',
      name: '',
      sortOrder: indicators.length + 1,
      isActive: true,
    });
  };

  const handleOpenManage = () => {
    resetIndForm();
    setManageModal(true);
  };

  const startEditIndicator = (ind: KeasramaanIndicatorItem) => {
    setEditingInd(ind);
    setIndForm({
      category: ind.category,
      name: ind.name,
      sortOrder: ind.sortOrder,
      isActive: ind.isActive,
    });
  };

  const handleSaveIndicator = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInd(true);
    const res = await fetch('/api/keasramaan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'save_indicator',
        id: editingInd?.id,
        category: indForm.category.trim(),
        name: indForm.name.trim(),
        sortOrder: Number(indForm.sortOrder) || 1,
        isActive: indForm.isActive,
      }),
    });
    setSavingInd(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan mata evaluasi keasramaan.');
      return;
    }
    notify('success', editingInd ? 'Mata evaluasi diperbarui.' : 'Mata evaluasi ditambahkan.');
    resetIndForm();
    await loadData();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/keasramaan?id=${deleteTarget.id}`, {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    setDeleting(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify('error', json.error || 'Gagal menghapus indikator.');
      return;
    }
    notify('success', `Indikator "${deleteTarget.name}" dihapus.`);
    setDeleteTarget(null);
    await loadData();
  };

  const openTpModal = (ind: KeasramaanIndicatorItem) => {
    setTpIndicator(ind);
    setTpDraftList([...(ind.learningObjectives || [])]);
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
    if (!tpIndicator) return;
    const finalObjectives = [
      ...tpDraftList.map((s) => s.trim()).filter(Boolean),
      ...(newTpText.trim() ? [newTpText.trim()] : []),
    ];
    setSavingTp(true);
    const res = await fetch('/api/keasramaan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        kind: 'save_indicator_tp',
        indicatorId: tpIndicator.id,
        learningObjectives: finalObjectives,
      }),
    });
    setSavingTp(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan TP keasramaan.');
      return;
    }
    setTpIndicator(null);
    notify('success', 'Tujuan Pembelajaran indikator keasramaan tersimpan.');
    await loadData();
  };

  return (
    <AppShell title="Daftar Nilai Keasramaan" requiredModule="keasramaan">
      <div className="space-y-4">
        <AlertBox variant="info">
          Halaman ini khusus sekolah yang memiliki program keasramaan.
        </AlertBox>

        {!school?.enableKeasramaan ? (
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-6">
            <EmptyState
              title="Modul Keasramaan belum diaktifkan"
              description="Aktifkan saklar Program Keasramaan pada halaman Sekolah & Kalender agar daftar mata evaluasi asrama dapat dikelola."
              action={
                <Link
                  href="/sekolah"
                  className="inline-flex items-center justify-center h-9 px-4 text-xs font-medium rounded-md bg-[#0F2942] text-white hover:bg-[#163859]"
                >
                  Buka Pengaturan Sekolah
                </Link>
              }
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  Daftar Nilai Keasramaan
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kelas aktif: {selectedClass?.name || '-'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/penilaian?tab=keasramaan"
                  className="text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap mr-1"
                >
                  Input Nilai →
                </Link>
                {(canCreate || canUpdate) && (
                  <div className="relative inline-flex items-center">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleOpenManage}
                      className="rounded-r-none border-r border-slate-300 dark:border-slate-600"
                    >
                      <SquarePen className="w-4 h-4" />
                      Kelola Mata Evaluasi
                    </Button>
                    <button
                      type="button"
                      aria-label="Opsi keasramaan"
                      onClick={() => setMenuOpen((v) => !v)}
                      className="h-9 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100 border border-l-0 border-slate-200 dark:border-slate-700 rounded-r-md cursor-pointer"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {menuOpen && (
                      <div className="absolute right-0 top-10 w-52 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-md shadow-lg z-20 py-1">
                        <Link
                          href="/penilaian?tab=keasramaan"
                          onClick={() => setMenuOpen(false)}
                          className="block px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          Input Nilai Keasramaan
                        </Link>
                        <Link
                          href="/cetak"
                          onClick={() => setMenuOpen(false)}
                          className="block px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          Cetak Rapor Keasramaan
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <TableSkeleton rows={6} />
            ) : groupedCategories.length === 0 ? (
              <EmptyState
                title="Belum ada mata evaluasi keasramaan"
                description="Klik Kelola Mata Evaluasi untuk menambahkan aspek dan indikator pembinaan asrama."
                action={
                  canCreate ? (
                    <Button size="sm" onClick={handleOpenManage}>
                      <Plus className="w-4 h-4" />
                      Kelola Mata Evaluasi
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-5">
                {groupedCategories.map(([categoryName, categoryIndicators]) => (
                  <div key={categoryName} className="space-y-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {categoryName}
                    </h2>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="data-table text-left text-xs">
                          <thead>
                            <tr className="text-slate-600 dark:text-slate-300">
                              <th className="py-3 px-3 font-semibold w-12 col-id">No</th>
                              <th className="py-3 px-3 font-semibold col-b col-sep">Indikator</th>
                              <th className="py-3 px-3 font-semibold text-right col-action col-sep">
                                Aksi
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {categoryIndicators.map((ind, idx) => {
                              const tpCount = ind.learningObjectives?.length || 0;
                              return (
                                <tr key={ind.id}>
                                  <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500 col-id">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 col-b col-sep">
                                    {ind.name}
                                  </td>
                                  <td className="py-2.5 px-3 text-right col-action col-sep">
                                    <div className="inline-flex items-center gap-2 justify-end">
                                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                        {tpCount > 0 ? `${tpCount} TP` : 'Kosong'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => openTpModal(ind)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium whitespace-nowrap cursor-pointer transition-colors"
                                      >
                                        <SquarePen className="w-3.5 h-3.5" />
                                        Edit TP
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Kelola Mata Evaluasi */}
      <Modal
        open={manageModal}
        onClose={() => setManageModal(false)}
        title="Kelola Mata Evaluasi Keasramaan"
        subtitle="Tambah, ubah kelompok pembinaan, urutan, atau nonaktifkan indikator evaluasi."
        maxWidth="max-w-2xl"
      >
        <div className="space-y-5">
          <div className="border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
            {indicators.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 text-center">
                Belum ada mata evaluasi terdaftar.
              </p>
            ) : (
              indicators.map((ind) => (
                <div
                  key={ind.id}
                  className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/70 dark:hover:bg-slate-900/30"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {ind.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {ind.category} · Urutan #{ind.sortOrder} ·{' '}
                      {ind.isActive ? 'Aktif' : 'Nonaktif'}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 shrink-0">
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => startEditIndicator(ind)}
                        aria-label={`Edit ${ind.name}`}
                        className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(ind)}
                        aria-label={`Hapus ${ind.name}`}
                        className="p-1.5 rounded border border-red-200 dark:border-red-900/50 hover:bg-red-50 text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={handleSaveIndicator}
            className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {editingInd ? 'Ubah Mata Evaluasi' : 'Tambah Mata Evaluasi Baru'}
              </p>
              {editingInd && (
                <button
                  type="button"
                  onClick={resetIndForm}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Batal ubah
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label="Kategori / Aspek Evaluasi"
                  list="keasramaan-categories"
                  value={indForm.category}
                  onChange={(e) => setIndForm({ ...indForm, category: e.target.value })}
                  placeholder="Contoh: Kemandirian"
                  required
                />
                <datalist id="keasramaan-categories">
                  {SUGGESTED_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <Input
                label="Urutan"
                type="number"
                min={1}
                max={99}
                value={indForm.sortOrder}
                onChange={(e) => setIndForm({ ...indForm, sortOrder: Number(e.target.value) })}
                required
              />
            </div>

            <Input
              label="Nama Indikator"
              value={indForm.name}
              onChange={(e) => setIndForm({ ...indForm, name: e.target.value })}
              placeholder="Contoh: Pembiasaan kemandirian dalam kegiatan sehari-hari."
              required
            />

            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={indForm.isActive}
                onChange={(e) => setIndForm({ ...indForm, isActive: e.target.checked })}
                className="rounded border-slate-300 cursor-pointer"
              />
              Indikator aktif ditampilkan di rapor keasramaan
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setManageModal(false)}>
                Tutup
              </Button>
              <Button type="submit" loading={savingInd}>
                <Save className="w-3.5 h-3.5" />
                {editingInd ? 'Simpan Perubahan' : 'Tambah Indikator'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal Edit TP Indikator Keasramaan */}
      <Modal
        open={Boolean(tpIndicator)}
        onClose={() => setTpIndicator(null)}
        title={`Edit TP — ${tpIndicator?.category || ''}`}
        subtitle={tpIndicator?.name}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveTp} className="space-y-4">
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {tpDraftList.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                Belum ada tujuan pembinaan untuk indikator ini. Tambahkan baris di bawah.
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
              placeholder="Ketik tujuan pembinaan keasramaan baru..."
              className="flex-1 h-9 px-3 text-xs bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30"
            />
            <Button type="button" size="sm" variant="outline" onClick={handleAddTpLine}>
              <Plus className="w-3.5 h-3.5" />
              Tambah Baris
            </Button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setTpIndicator(null)}>
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
        title="Hapus Indikator Keasramaan"
        message={`Apakah Anda yakin ingin menghapus indikator "${deleteTarget?.name}"?`}
        confirmLabel="Ya, Hapus"
        danger
      />
    </AppShell>
  );
}
