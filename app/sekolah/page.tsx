'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Calendar, Plus, Save, School } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import { Button, Input, Modal, Select, TabBar, TableSkeleton } from '@/components/ui/Primitives';
import { formatIndoDateRange } from '@/lib/utils';

interface SchoolData {
  school: {
    name: string;
    npsn: string;
    jenjang: string;
    naungan: string;
    status: 'Negeri' | 'Swasta';
    accreditation: string;
    address: string;
    village: string;
    district: string;
    regency: string;
    province: string;
    postalCode: string;
    phone: string;
    email: string;
    website: string;
    principalName: string;
    principalNip: string;
    enableKeasramaan: boolean;
    enableAi: boolean;
  };
  academicYears: Array<{ id: number; name: string; startDate: string; endDate: string; isActive: boolean }>;
  semesters: Array<{ id: number; academicYearId: number; name: string; startDate: string; reportDate: string; isActive: boolean }>;
  calendars: Array<{ id: number; semesterId: number; title: string; category: string; startDate: string; endDate: string; isHoliday: boolean; description: string }>;
  classrooms: Array<{ id: number; code: string; name: string; capacity: number; condition: string }>;
  facilities: Array<{ id: number; name: string; category: string; quantity: number; condition: string }>;
}

function SekolahInner() {
  const searchParams = useSearchParams();
  const { can, notify, refreshContext } = useApp();
  const canUpdateSchool = can('sekolah', 'update');
  const [data, setData] = useState<SchoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'profil' | 'akademik' | 'kalender' | 'sarpras'>('profil');

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'profil' || t === 'akademik' || t === 'kalender' || t === 'sarpras') {
      Promise.resolve().then(() => setTab(t));
    }
  }, [searchParams]);

  // Form states
  const [form, setForm] = useState<SchoolData['school'] | null>(null);
  const [termStartDate, setTermStartDate] = useState('');
  const [termReportDate, setTermReportDate] = useState('');
  const [selectedSemId, setSelectedSemId] = useState(0);

  // Calendar modal
  const [calModal, setCalModal] = useState(false);
  const [calTitle, setCalTitle] = useState('');
  const [calCategory, setCalCategory] = useState('Kegiatan Sekolah');
  const [calStart, setCalStart] = useState('2026-11-25');
  const [calEnd, setCalEnd] = useState('2026-11-25');
  const [calHoliday, setCalHoliday] = useState(false);

  // Facility modal
  const [facModal, setFacModal] = useState(false);
  const [facName, setFacName] = useState('');
  const [facCategory, setFacCategory] = useState('Ruang Penunjang');
  const [facQty, setFacQty] = useState(1);

  const loadData = async () => {
    setLoading(true);
    const res = await fetch('/api/school', { cache: 'no-store' });
    if (res.ok) {
      const json: SchoolData = await res.json();
      setData(json);
      setForm(json.school);
      const activeSem = json.semesters.find((s) => s.isActive) || json.semesters[0];
      if (activeSem) {
        setSelectedSemId(activeSem.id);
        setTermStartDate(activeSem.startDate);
        setTermReportDate(activeSem.reportDate);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadData();
    });
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const res = await fetch('/api/school', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan profil sekolah.');
      return;
    }
    notify('success', 'Profil sekolah berhasil disimpan.');
    await refreshContext();
    await loadData();
  };

  const handleSaveTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    const sem = data?.semesters.find((s) => s.id === selectedSemId);
    if (!sem) return;
    setSaving(true);
    const res = await fetch('/api/school', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        type: 'set_active_semester',
        academicYearId: sem.academicYearId,
        semesterId: sem.id,
        startDate: termStartDate,
        reportDate: termReportDate,
      }),
    });
    setSaving(false);
    if (res.ok) {
      notify('success', 'Pengaturan tahun ajaran & semester aktif diperbarui.');
      await refreshContext();
      await loadData();
    } else {
      notify('error', 'Gagal memperbarui semester aktif.');
    }
  };

  const handleAddCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/school', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        type: 'create_calendar',
        semesterId: selectedSemId,
        title: calTitle,
        category: calCategory,
        startDate: calStart,
        endDate: calEnd,
        isHoliday: calHoliday,
      }),
    });
    if (res.ok) {
      setCalModal(false);
      setCalTitle('');
      notify('success', 'Agenda kalender akademik ditambahkan.');
      await loadData();
    } else {
      const j = await res.json();
      notify('error', j.error || 'Gagal menambah agenda.');
    }
  };

  const handleAddFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/school', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        type: 'create_facility',
        name: facName,
        category: facCategory,
        quantity: Number(facQty),
        condition: 'Baik',
      }),
    });
    if (res.ok) {
      setFacModal(false);
      setFacName('');
      notify('success', 'Sarana prasarana ditambahkan.');
      await loadData();
    }
  };

  return (
    <AppShell title="Sekolah & Kalender" requiredModule="sekolah">
      {loading || !form || !data ? (
        <TableSkeleton rows={6} />
      ) : (
        <div className="space-y-5">
          <TabBar
            items={[
              { id: 'profil', label: 'Profil Sekolah' },
              { id: 'akademik', label: 'Tahun & Semester' },
              { id: 'kalender', label: 'Kalender' },
              { id: 'sarpras', label: 'Sarpras' },
            ]}
            activeId={tab}
            onChange={(id) => setTab(id as typeof tab)}
          />

          {tab === 'profil' && (
            <form
              onSubmit={handleSaveProfile}
              className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-5"
            >
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <School className="w-5 h-5 text-[#0F2942] dark:text-blue-400" />
                  <div>
                    <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Profil Resmi Satuan Pendidikan
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Data ini digunakan pada kop rapor A4, surat resmi, dan sinkronisasi Dapodik.
                    </p>
                  </div>
                </div>
                {canUpdateSchool && (
                  <Button type="submit" loading={saving}>
                    <Save className="w-4 h-4" />
                    Simpan Perubahan
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Input
                  label="Nama Sekolah"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <Input
                  label="NPSN (8 Digit)"
                  value={form.npsn}
                  onChange={(e) => setForm({ ...form, npsn: e.target.value })}
                  className="font-mono tabular-nums"
                  required
                />
                <Select
                  label="Jenjang Pendidikan"
                  value={form.jenjang}
                  onChange={(e) => setForm({ ...form, jenjang: e.target.value })}
                >
                  <option value="Sekolah Dasar (SD)">Sekolah Dasar (SD)</option>
                  <option value="Madrasah Ibtidaiyah (MI)">Madrasah Ibtidaiyah (MI)</option>
                  <option value="Sekolah Menengah Pertama (SMP)">Sekolah Menengah Pertama (SMP)</option>
                  <option value="Sekolah Menengah Atas (SMA)">Sekolah Menengah Atas (SMA)</option>
                </Select>
                <Select
                  label="Status Sekolah"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as 'Negeri' | 'Swasta' })}
                >
                  <option value="Negeri">Negeri</option>
                  <option value="Swasta">Swasta</option>
                </Select>
                <Input
                  label="Akreditasi"
                  value={form.accreditation}
                  onChange={(e) => setForm({ ...form, accreditation: e.target.value })}
                />
                <Input
                  label="Naungan"
                  value={form.naungan}
                  onChange={(e) => setForm({ ...form, naungan: e.target.value })}
                />
                <Input
                  label="Nama Kepala Sekolah"
                  value={form.principalName}
                  onChange={(e) => setForm({ ...form, principalName: e.target.value })}
                  required
                />
                <Input
                  label="NIP Kepala Sekolah"
                  value={form.principalNip}
                  onChange={(e) => setForm({ ...form, principalNip: e.target.value })}
                  className="font-mono tabular-nums"
                />
                <Input
                  label="Telepon Sekolah"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                <Input
                  label="Email Sekolah"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <Input
                  label="Website"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
                <Input
                  label="Kode Pos"
                  value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  className="font-mono tabular-nums"
                />
                <div className="md:col-span-2 lg:col-span-3">
                  <Input
                    label="Alamat Lengkap"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
                <Input
                  label="Desa / Kelurahan"
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
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enableAi}
                    onChange={(e) => setForm({ ...form, enableAi: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  Aktifkan Asisten AI Kurikulum (Opsional, membutuhkan koneksi Gemini server)
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enableKeasramaan}
                    onChange={(e) => setForm({ ...form, enableKeasramaan: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  Aktifkan Program & Rapor Keasramaan (membuka tab Keasramaan, Rapor Keasramaan A4, dan peran Wali Asuh)
                </label>
              </div>
            </form>
          )}

          {tab === 'akademik' && (
            <form
              onSubmit={handleSaveTerm}
              className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-6 max-w-2xl space-y-4"
            >
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Manajemen Tahun Ajaran & Semester Aktif
              </h2>
              <Select
                label="Pilih Semester Aktif"
                value={selectedSemId}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedSemId(id);
                  const found = data.semesters.find((s) => s.id === id);
                  if (found) {
                    setTermStartDate(found.startDate);
                    setTermReportDate(found.reportDate);
                  }
                }}
              >
                {data.semesters.map((s) => {
                  const ay = data.academicYears.find((y) => y.id === s.academicYearId);
                  return (
                    <option key={s.id} value={s.id}>
                      TA {ay?.name} — Semester {s.name} {s.isActive ? '(Aktif)' : ''}
                    </option>
                  );
                })}
              </Select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Tanggal Mulai Presensi Semester"
                  type="date"
                  value={termStartDate}
                  onChange={(e) => setTermStartDate(e.target.value)}
                  className="font-mono tabular-nums"
                />
                <Input
                  label="Tanggal Pembagian Rapor"
                  type="date"
                  value={termReportDate}
                  onChange={(e) => setTermReportDate(e.target.value)}
                  className="font-mono tabular-nums"
                />
              </div>
              {canUpdateSchool && (
                <Button type="submit" loading={saving}>
                  <Save className="w-4 h-4" />
                  Simpan Pengaturan Semester
                </Button>
              )}
            </form>
          )}

          {tab === 'kalender' && (
            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Kalender Pendidikan & Hari Libur
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Terintegrasi langsung dengan peringatan hari libur pada halaman Presensi.
                  </p>
                </div>
                {canUpdateSchool && (
                  <Button size="sm" onClick={() => setCalModal(true)}>
                    <Plus className="w-4 h-4" />
                    Tambah Agenda
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="data-table text-left text-xs">
                  <thead>
                    <tr className="text-slate-600 dark:text-slate-300">
                      <th className="py-2.5 px-4 font-semibold col-id">Tanggal</th>
                      <th className="py-2.5 px-4 font-semibold col-id col-cell-div">
                        Kegiatan / Agenda
                      </th>
                      <th className="py-2.5 px-4 font-semibold col-a col-sep">Kategori</th>
                      <th className="py-2.5 px-4 font-semibold col-total col-sep">Status Hari</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.calendars.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2.5 px-4 tabular-nums whitespace-nowrap col-id">
                          {formatIndoDateRange(c.startDate, c.endDate)}
                        </td>
                        <td className="py-2.5 px-4 font-medium col-id col-cell-div">{c.title}</td>
                        <td className="py-2.5 px-4 text-slate-500 col-a col-sep">{c.category}</td>
                        <td className="py-2.5 px-4 col-total col-sep">
                          <span className={c.isHoliday ? 'text-red-600 font-medium' : 'text-emerald-700 dark:text-emerald-400 font-medium'}>
                            {c.isHoliday ? 'Hari Libur' : 'Hari Efektif'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'sarpras' && (
            <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Inventaris Ruang Kelas & Sarana Prasarana
                </h2>
                {canUpdateSchool && (
                  <Button size="sm" onClick={() => setFacModal(true)}>
                    <Plus className="w-4 h-4" />
                    Tambah Sarpras
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                  <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                    Daftar Ruang Kelas
                  </div>
                  <table className="data-table text-left text-xs">
                    <thead>
                      <tr>
                        <th className="py-2 px-3 font-semibold col-id">Kode</th>
                        <th className="py-2 px-3 font-semibold col-id col-cell-div">Ruang Kelas</th>
                        <th className="py-2 px-3 font-semibold text-right col-total col-sep">
                          Kapasitas
                        </th>
                        <th className="py-2 px-3 font-semibold text-right col-b col-sep">
                          Kondisi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.classrooms.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2 px-3 font-mono col-id">{r.code}</td>
                          <td className="py-2 px-3 font-medium col-id col-cell-div">{r.name}</td>
                          <td className="py-2 px-3 text-right tabular-nums col-total col-sep">
                            {r.capacity} kursi
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-700 dark:text-emerald-400 col-b col-sep">
                            {r.condition}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                  <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                    Sarana & Fasilitas Sekolah
                  </div>
                  <table className="data-table text-left text-xs">
                    <thead>
                      <tr>
                        <th className="py-2 px-3 font-semibold col-id">Nama Fasilitas</th>
                        <th className="py-2 px-3 font-semibold col-a col-sep">Kategori</th>
                        <th className="py-2 px-3 font-semibold text-right col-total col-sep">
                          Jumlah
                        </th>
                        <th className="py-2 px-3 font-semibold text-right col-b col-sep">
                          Kondisi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.facilities.map((f) => (
                        <tr key={f.id}>
                          <td className="py-2 px-3 font-medium col-id">{f.name}</td>
                          <td className="py-2 px-3 text-slate-500 col-a col-sep">{f.category}</td>
                          <td className="py-2 px-3 text-right tabular-nums col-total col-sep">
                            {f.quantity} unit
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-700 dark:text-emerald-400 col-b col-sep">
                            {f.condition}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={calModal} onClose={() => setCalModal(false)} title="Tambah Agenda Kalender">
        <form onSubmit={handleAddCalendar} className="space-y-4">
          <Input
            label="Nama Kegiatan / Hari Libur"
            value={calTitle}
            onChange={(e) => setCalTitle(e.target.value)}
            required
          />
          <Select
            label="Kategori"
            value={calCategory}
            onChange={(e) => setCalCategory(e.target.value)}
          >
            <option value="Kegiatan Sekolah">Kegiatan Sekolah</option>
            <option value="Ujian">Ujian / Asesmen</option>
            <option value="Libur Nasional">Libur Nasional / Cuti</option>
            <option value="Pembagian Rapor">Pembagian Rapor</option>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Tanggal Mulai" type="date" value={calStart} onChange={(e) => setCalStart(e.target.value)} />
            <Input label="Tanggal Selesai" type="date" value={calEnd} onChange={(e) => setCalEnd(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={calHoliday} onChange={(e) => setCalHoliday(e.target.checked)} />
            Tandai sebagai hari libur sekolah (tidak ada KBM)
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCalModal(false)}>Batal</Button>
            <Button type="submit"><Calendar className="w-4 h-4" />Simpan Agenda</Button>
          </div>
        </form>
      </Modal>

      <Modal open={facModal} onClose={() => setFacModal(false)} title="Tambah Sarana Prasarana">
        <form onSubmit={handleAddFacility} className="space-y-4">
          <Input label="Nama Fasilitas / Alat" value={facName} onChange={(e) => setFacName(e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Kategori" value={facCategory} onChange={(e) => setFacCategory(e.target.value)} required />
            <Input label="Jumlah" type="number" min={1} value={facQty} onChange={(e) => setFacQty(Number(e.target.value))} required />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFacModal(false)}>Batal</Button>
            <Button type="submit">Simpan Sarpras</Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

export default function SekolahPage() {
  return (
    <Suspense fallback={<AppShell title="Identitas Sekolah" requiredModule="sekolah"><TableSkeleton rows={6} /></AppShell>}>
      <SekolahInner />
    </Suspense>
  );
}
