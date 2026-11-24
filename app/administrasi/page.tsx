'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Plus } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import { Button, Input, Modal, Select, TabBar, TableSkeleton } from '@/components/ui/Primitives';

interface GuestRow {
  id: number;
  visitorName: string;
  institution: string;
  purpose: string;
  personToMeet: string;
  phone: string;
  visitDate: string;
  notes: string;
}

interface TravelRow {
  id: number;
  teacherId: number;
  teacherName: string;
  destination: string;
  purpose: string;
  letterNumber: string;
  startDate: string;
  endDate: string;
  status: string;
}

function AdministrasiInner() {
  const searchParams = useSearchParams();
  const { can, notify } = useApp();
  const [tab, setTab] = useState<'tamu' | 'dinas'>('tamu');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'tamu' || t === 'dinas') {
      Promise.resolve().then(() => setTab(t));
    }
  }, [searchParams]);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [travels, setTravels] = useState<TravelRow[]>([]);
  const [teachers, setTeachers] = useState<Array<{ id: number; fullName: string }>>([]);

  const canCreateAdmin = can('administrasi', 'create');
  const canApproveAdmin = can('administrasi', 'approve');

  const [guestModal, setGuestModal] = useState(false);
  const [guestForm, setGuestForm] = useState({
    visitorName: '',
    institution: '',
    purpose: '',
    personToMeet: 'Kepala Sekolah',
    phone: '',
    visitDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const [travelModal, setTravelModal] = useState(false);
  const [travelForm, setTravelForm] = useState({
    teacherId: '',
    destination: '',
    purpose: '',
    letterNumber: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [admRes, teachRes] = await Promise.all([
      fetch('/api/administrasi', { cache: 'no-store' }),
      canCreateAdmin ? fetch('/api/teachers', { cache: 'no-store' }) : Promise.resolve(null),
    ]);
    if (admRes.ok) {
      const json = await admRes.json();
      setGuests(json.guests || []);
      setTravels(json.travels || []);
    }
    if (teachRes && teachRes.ok) {
      const tJson = await teachRes.json();
      const list = tJson.teachers || [];
      setTeachers(list);
      setTravelForm((prev) => ({
        ...prev,
        teacherId: prev.teacherId || (list[0] ? String(list[0].id) : ''),
      }));
    }
    setLoading(false);
  }, [canCreateAdmin]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadData();
    });
  }, [loadData]);

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/administrasi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ type: 'guest', ...guestForm }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan buku tamu.');
      return;
    }
    setGuestModal(false);
    setGuestForm({
      visitorName: '',
      institution: '',
      purpose: '',
      personToMeet: 'Kepala Sekolah',
      phone: '',
      visitDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    notify('success', 'Kunjungan tamu berhasil dicatat.');
    await loadData();
  };

  const handleSaveTravel = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/administrasi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        type: 'travel',
        ...travelForm,
        teacherId: Number(travelForm.teacherId),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal mengajukan dinas luar.');
      return;
    }
    setTravelModal(false);
    notify('success', 'Surat tugas dinas luar berhasil diajukan.');
    await loadData();
  };

  const handleApproveTravel = async (id: number, status: 'Disetujui' | 'Selesai') => {
    const res = await fetch('/api/administrasi', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      notify('success', `Status perjalanan dinas diubah menjadi ${status}.`);
      await loadData();
    } else {
      const json = await res.json().catch(() => ({}));
      notify('error', json.error || 'Hanya Kepala Sekolah / Admin yang dapat menyetujui.');
    }
  };

  return (
    <AppShell title="Buku Tamu & Dinas" requiredModule="administrasi">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-lg font-bold text-slate-900 dark:text-slate-100">
              Buku Tamu & Dinas Luar
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pencatatan tamu sekolah serta pengajuan dan persetujuan surat tugas dinas luar.
            </p>
          </div>
          {canCreateAdmin && (
            <Button
              size="sm"
              onClick={() => (tab === 'tamu' ? setGuestModal(true) : setTravelModal(true))}
            >
              <Plus className="w-4 h-4" />
              {tab === 'tamu' ? 'Catat Tamu Baru' : 'Ajukan Dinas Luar'}
            </Button>
          )}
        </div>

        <TabBar
          items={[
            { id: 'tamu', label: `Buku Tamu (${guests.length})` },
            { id: 'dinas', label: `Dinas Luar (${travels.length})` },
          ]}
          activeId={tab}
          onChange={(id) => setTab(id as 'tamu' | 'dinas')}
        />

        {loading ? (
          <TableSkeleton rows={6} />
        ) : tab === 'tamu' ? (
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-3 px-3 font-semibold w-28">Tanggal</th>
                    <th className="py-3 px-3 font-semibold">Nama Tamu & Instansi</th>
                    <th className="py-3 px-3 font-semibold">Menemui</th>
                    <th className="py-3 px-3 font-semibold">Keperluan</th>
                    <th className="py-3 px-3 font-semibold">Kontak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {guests.map((g) => (
                    <tr key={g.id}>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500">
                        {g.visitDate}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {g.visitorName}
                        </div>
                        <div className="text-[11px] text-slate-500">{g.institution}</div>
                      </td>
                      <td className="py-2.5 px-3">{g.personToMeet}</td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{g.purpose}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">{g.phone || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-3 px-3 font-semibold">Pendidik</th>
                    <th className="py-3 px-3 font-semibold">Tujuan & Surat Tugas</th>
                    <th className="py-3 px-3 font-semibold">Tanggal</th>
                    <th className="py-3 px-3 font-semibold">Status</th>
                    {canApproveAdmin && <th className="py-3 px-3 font-semibold text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {travels.map((tr) => (
                    <tr key={tr.id}>
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                        {tr.teacherName}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium">{tr.destination}</div>
                        <div className="text-[11px] text-slate-500">
                          {tr.purpose} · No. {tr.letterNumber || '-'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">
                        {tr.startDate} s.d. {tr.endDate}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">{tr.status}</td>
                      {canApproveAdmin && (
                        <td className="py-2.5 px-3 text-right">
                          {tr.status === 'Diajukan' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApproveTravel(tr.id, 'Disetujui')}
                            >
                              <Check className="w-3.5 h-3.5" />
                              Setujui
                            </Button>
                          )}
                          {tr.status === 'Disetujui' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApproveTravel(tr.id, 'Selesai')}
                            >
                              Tandai Selesai
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal open={guestModal} onClose={() => setGuestModal(false)} title="Catat Kunjungan Tamu">
        <form onSubmit={handleSaveGuest} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nama Tamu"
              value={guestForm.visitorName}
              onChange={(e) => setGuestForm({ ...guestForm, visitorName: e.target.value })}
              required
            />
            <Input
              label="Asal Instansi / Alamat"
              value={guestForm.institution}
              onChange={(e) => setGuestForm({ ...guestForm, institution: e.target.value })}
              required
            />
            <Input
              label="Menemui"
              value={guestForm.personToMeet}
              onChange={(e) => setGuestForm({ ...guestForm, personToMeet: e.target.value })}
              required
            />
            <Input
              label="Tanggal Kunjungan"
              type="date"
              value={guestForm.visitDate}
              onChange={(e) => setGuestForm({ ...guestForm, visitDate: e.target.value })}
              required
            />
          </div>
          <Input
            label="Keperluan Kunjungan"
            value={guestForm.purpose}
            onChange={(e) => setGuestForm({ ...guestForm, purpose: e.target.value })}
            required
          />
          <Input
            label="Nomor Telepon / HP"
            value={guestForm.phone}
            onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setGuestModal(false)}>
              Batal
            </Button>
            <Button type="submit">Simpan Kunjungan</Button>
          </div>
        </form>
      </Modal>

      <Modal open={travelModal} onClose={() => setTravelModal(false)} title="Ajukan Perjalanan Dinas">
        <form onSubmit={handleSaveTravel} className="space-y-4">
          <Select
            label="Pendidik yang Bertugas"
            value={travelForm.teacherId}
            onChange={(e) => setTravelForm({ ...travelForm, teacherId: e.target.value })}
            required
          >
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Lokasi Tujuan"
              value={travelForm.destination}
              onChange={(e) => setTravelForm({ ...travelForm, destination: e.target.value })}
              required
            />
            <Input
              label="Nomor Surat Tugas"
              value={travelForm.letterNumber}
              onChange={(e) => setTravelForm({ ...travelForm, letterNumber: e.target.value })}
            />
            <Input
              label="Tanggal Mulai"
              type="date"
              value={travelForm.startDate}
              onChange={(e) => setTravelForm({ ...travelForm, startDate: e.target.value })}
              required
            />
            <Input
              label="Tanggal Selesai"
              type="date"
              value={travelForm.endDate}
              onChange={(e) => setTravelForm({ ...travelForm, endDate: e.target.value })}
              required
            />
          </div>
          <Input
            label="Uraian Tugas / Agenda"
            value={travelForm.purpose}
            onChange={(e) => setTravelForm({ ...travelForm, purpose: e.target.value })}
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTravelModal(false)}>
              Batal
            </Button>
            <Button type="submit">Ajukan Dinas Luar</Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

export default function AdministrasiPage() {
  return (
    <Suspense fallback={<AppShell title="Buku Tamu & Dinas" requiredModule="administrasi"><TableSkeleton rows={6} /></AppShell>}>
      <AdministrasiInner />
    </Suspense>
  );
}
