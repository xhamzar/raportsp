'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, PlugZap, RefreshCw, Send, Upload, Download } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/components/providers/AppContext';
import { AlertBox, Button, Input, Select, TableSkeleton } from '@/components/ui/Primitives';

interface DapodikSyncLog {
  id: number;
  syncType: string;
  direction: string;
  status: string;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  createdAt: string;
}

interface DapodikSubLog {
  id: number;
  submissionPhase: string;
  isDryRun: boolean;
  status: string;
  payloadSummaryJson?: string;
  responseMessage: string;
  createdAt: string;
}

interface DapodikSyncSection {
  key: string;
  label: string;
  endpoint: string;
  status: 'Berhasil' | 'Dilewati' | 'Gagal';
  count: number;
  detail: string;
}

interface EraporLog {
  id: number;
  templateVersion: string;
  fileName: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  createdAt: string;
}

export default function IntegrasiPage() {
  const { selectedClassId, selectedClass, can, notify } = useApp();
  const [tab, setTab] = useState<'dapodik' | 'erapor'>('dapodik');
  const [loading, setLoading] = useState(true);

  const canReadDapodik = can('dapodik', 'read');
  const canUpdateDapodik = can('dapodik', 'update');
  const canReadErapor = can('erapor', 'read');
  const canCreateErapor = can('erapor', 'create');
  const canExportErapor = can('erapor', 'export');

  const activeTab: 'dapodik' | 'erapor' =
    tab === 'dapodik' && !canReadDapodik && canReadErapor
      ? 'erapor'
      : tab === 'erapor' && !canReadErapor && canReadDapodik
      ? 'dapodik'
      : tab;

  // Dapodik State
  const [dapodikForm, setDapodikForm] = useState({
    webServiceUrl: 'http://localhost:5774',
    npsn: '20104567',
    apiToken: '',
    mode: 'Sandbox' as 'WebService' | 'Sandbox',
  });
  const [tokenMasked, setTokenMasked] = useState('');
  const [connStatus, setConnStatus] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [mappingCount, setMappingCount] = useState(0);
  const [dapodikSubjectsCount, setDapodikSubjectsCount] = useState(0);
  const [mappedAnggotaCount, setMappedAnggotaCount] = useState(0);
  const [totalEnrollments, setTotalEnrollments] = useState(0);
  const [syncSections, setSyncSections] = useState<DapodikSyncSection[]>([]);
  const [syncingMaster, setSyncingMaster] = useState(false);
  const [syncLogs, setSyncLogs] = useState<DapodikSyncLog[]>([]);
  const [subLogs, setSubLogs] = useState<DapodikSubLog[]>([]);
  const [lastProtocolResult, setLastProtocolResult] = useState<{
    idEvaluasi: string;
    updaterId: string;
    sentCount: number;
  } | null>(null);

  const [subjects, setSubjects] = useState<
    Array<{ id: number; name: string; code: string; dapodikMapelId?: string | null }>
  >([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number>(0);
  const [isDryRun, setIsDryRun] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // E-Rapor State
  const [eraporLogs, setEraporLogs] = useState<EraporLog[]>([]);
  const [eraporFile, setEraporFile] = useState<File | null>(null);
  const [templateVersion, setTemplateVersion] = useState('e-Rapor SD KM 2025/2026');
  const [nisnCol, setNisnCol] = useState(2);
  const [scoreCol, setScoreCol] = useState(5);
  const [descCol, setDescCol] = useState(6);
  const [eraporPreview, setEraporPreview] = useState<{
    totalValid: number;
    rows: Array<{
      rowNumber: number;
      nisn: string;
      fullName: string;
      score: number;
      description: string;
    }>;
    errors: Array<{ rowNumber: number; message: string }>;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [dapRes, erapRes, acadRes] = await Promise.all([
      canReadDapodik ? fetch('/api/dapodik', { cache: 'no-store' }) : Promise.resolve(null),
      canReadErapor ? fetch('/api/erapor', { cache: 'no-store' }) : Promise.resolve(null),
      fetch(`/api/academics${selectedClassId ? `?classId=${selectedClassId}` : ''}`, {
        cache: 'no-store',
      }),
    ]);

    if (dapRes && dapRes.ok) {
      const json = await dapRes.json();
      if (json.config) {
        setDapodikForm({
          webServiceUrl: json.config.webServiceUrl,
          npsn: json.config.npsn,
          apiToken: '',
          mode: json.config.mode,
        });
        setTokenMasked(json.config.tokenMasked || '');
        setConnStatus(json.config.connectionStatus || '');
        setLastSyncAt(json.config.lastSyncAt || null);
      }
      setMappingCount(json.mappingCount || 0);
      setDapodikSubjectsCount(json.dapodikSubjectsCount || 0);
      setMappedAnggotaCount(json.mappedAnggotaRombelCount || 0);
      setTotalEnrollments(json.totalEnrollmentCount || 0);
      setSyncLogs(json.syncLogs || []);
      setSubLogs(json.submissionLogs || []);
    }

    if (erapRes && erapRes.ok) {
      const eJson = await erapRes.json();
      setEraporLogs(eJson.logs || []);
    }

    if (acadRes.ok) {
      const aJson = await acadRes.json();
      const subs = aJson.subjects || [];
      setSubjects(subs);
      setSelectedSubjectId((prev) =>
        prev && subs.some((s: { id: number }) => s.id === prev) ? prev : subs[0]?.id || 0
      );
    }
    setLoading(false);
  }, [selectedClassId, canReadDapodik, canReadErapor]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void loadData();
    });
  }, [loadData]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/dapodik', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ action: 'save_config', ...dapodikForm }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal menyimpan konfigurasi Dapodik.');
      return;
    }
    notify('success', 'Konfigurasi koneksi Dapodik tersimpan.');
    await loadData();
  };

  const handleTestConnection = async () => {
    const res = await fetch('/api/dapodik', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ action: 'test_connection' }),
    });
    const json = await res.json();
    if (json.connected) {
      notify('success', json.statusText);
    } else {
      notify('error', json.error || json.statusText || 'Koneksi Dapodik gagal.');
    }
    await loadData();
  };

  const handleSyncMaster = async () => {
    setSyncingMaster(true);
    const res = await fetch('/api/dapodik', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ action: 'sync_master' }),
    });
    const json = await res.json();
    setSyncingMaster(false);
    if (Array.isArray(json.sections)) {
      setSyncSections(json.sections);
    }
    if (!res.ok || !json.ok) {
      notify('error', json.error || 'Sinkronisasi master Dapodik gagal.');
    } else {
      notify('success', json.message);
    }
    await loadData();
  };

  const handleSubmitGrades = async () => {
    if (!selectedClass || !selectedSubjectId) return;
    setSubmitting(true);
    const res = await fetch('/api/dapodik', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({
        action: 'submit_grades',
        classId: selectedClass.id,
        subjectId: selectedSubjectId,
        isDryRun,
      }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok || !json.ok) {
      notify('error', json.error || 'Pengiriman MATEV / Nilai Akhir gagal.');
    } else {
      if (json.matev?.idEvaluasi) {
        setLastProtocolResult({
          idEvaluasi: json.matev.idEvaluasi,
          updaterId: json.updaterId || '',
          sentCount: json.nilai?.sentCount ?? 0,
        });
      }
      notify('success', json.nilai?.message || 'postMatevRapor dan postNilai berhasil diproses.');
    }
    await loadData();
  };

  const handleEraporUpload = async (commit: boolean) => {
    if (!eraporFile || !selectedClass || !selectedSubjectId) return;
    const fd = new FormData();
    fd.append('file', eraporFile);
    fd.append('templateVersion', templateVersion);
    fd.append('classId', String(selectedClass.id));
    fd.append('subjectId', String(selectedSubjectId));
    fd.append('nisnCol', String(nisnCol));
    fd.append('scoreCol', String(scoreCol));
    fd.append('descCol', String(descCol));
    fd.append('commit', commit ? 'true' : 'false');

    const res = await fetch('/api/erapor', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: fd,
    });
    const json = await res.json();
    if (!res.ok) {
      notify('error', json.error || 'Gagal memproses berkas E-Rapor.');
      return;
    }
    if (!commit) {
      setEraporPreview(json.preview);
      notify('info', `Pratinjau E-Rapor siap: ${json.preview.totalValid} baris valid.`);
    } else {
      setEraporPreview(null);
      setEraporFile(null);
      notify('success', `Berhasil mengimpor ${json.importedCount} nilai dari E-Rapor.`);
      await loadData();
    }
  };

  return (
    <AppShell title="Dapodik & E-Rapor" requiredModule={['dapodik', 'erapor']}>
      <div className="space-y-5">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-lg font-bold text-slate-900 dark:text-slate-100">
            Integrasi Protokol WebService Dapodik & E-Rapor
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Protokol resmi Dapodik Desktop (port 5774: getSekolah, getRombonganBelajar, getGtk, getPesertaDidik, postMatevRapor, postNilai?table=rapor dengan UUID v5 deterministik) dan mode Sandbox.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-md w-fit">
          {canReadDapodik && (
            <button
              type="button"
              onClick={() => setTab('dapodik')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded cursor-pointer ${
                activeTab === 'dapodik'
                  ? 'bg-white dark:bg-[#111C2E] text-[#0F2942] dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Integrasi Dapodik
            </button>
          )}
          {canReadErapor && (
            <button
              type="button"
              onClick={() => setTab('erapor')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded cursor-pointer ${
                activeTab === 'erapor'
                  ? 'bg-white dark:bg-[#111C2E] text-[#0F2942] dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Impor / Ekspor E-Rapor
            </button>
          )}
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : activeTab === 'dapodik' ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Connection Config */}
              <form
                onSubmit={handleSaveConfig}
                className="lg:col-span-6 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Konfigurasi WebService Dapodik
                  </h2>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500 text-right">
                    <div>Pemetaan: {mappingCount} murid · {dapodikSubjectsCount} mapel</div>
                    <div>anggota_rombel_id: {mappedAnggotaCount}/{totalEnrollments}</div>
                  </div>
                </div>

                <AlertBox variant={dapodikForm.mode === 'Sandbox' ? 'warning' : 'info'}>
                  Status saat ini: <strong>{connStatus || 'Belum diuji'}</strong>
                  {lastSyncAt &&
                    ` · Sinkronisasi terakhir: ${lastSyncAt.slice(0, 16).replace('T', ' ')}`}
                </AlertBox>

                <Input
                  label="URL / IP WebService Dapodik Desktop"
                  value={dapodikForm.webServiceUrl}
                  disabled={!canUpdateDapodik}
                  hint="Mendukung format http://localhost:5774, 192.168.8.114:5774, atau .../WebService"
                  onChange={(e) =>
                    setDapodikForm({ ...dapodikForm, webServiceUrl: e.target.value })
                  }
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="NPSN Sekolah"
                    value={dapodikForm.npsn}
                    disabled={!canUpdateDapodik}
                    onChange={(e) => setDapodikForm({ ...dapodikForm, npsn: e.target.value })}
                    className="font-mono"
                    required
                  />
                  <Select
                    label="Mode Adapter"
                    value={dapodikForm.mode}
                    disabled={!canUpdateDapodik}
                    onChange={(e) =>
                      setDapodikForm({
                        ...dapodikForm,
                        mode: e.target.value as 'WebService' | 'Sandbox',
                      })
                    }
                  >
                    <option value="WebService">WebService (Dapodik Asli)</option>
                    <option value="Sandbox">Sandbox (Simulasi / Uji)</option>
                  </Select>
                </div>
                <Input
                  label="Token WebService Dapodik"
                  type="password"
                  disabled={!canUpdateDapodik}
                  placeholder={
                    tokenMasked
                      ? `Token tersimpan (${tokenMasked}) — isi untuk ganti`
                      : 'Masukkan token Dapodik'
                  }
                  value={dapodikForm.apiToken}
                  onChange={(e) => setDapodikForm({ ...dapodikForm, apiToken: e.target.value })}
                />

                {canUpdateDapodik && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button type="submit" size="sm">
                      Simpan Konfigurasi
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleTestConnection}
                    >
                      <PlugZap className="w-4 h-4" />
                      Uji Koneksi
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={syncingMaster}
                      onClick={handleSyncMaster}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Sinkronisasi 6 Endpoint
                    </Button>
                  </div>
                )}

                {syncSections.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-1.5">
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Ringkasan Tahapan Sinkronisasi Terakhir:
                    </p>
                    <div className="space-y-1">
                      {syncSections.map((sec) => (
                        <div
                          key={sec.key}
                          className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                        >
                          <div>
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {sec.label}
                            </span>
                            <span className="text-slate-500 ml-2">— {sec.detail}</span>
                          </div>
                          <span
                            className={`font-semibold ${
                              sec.status === 'Gagal'
                                ? 'text-red-600'
                                : sec.status === 'Dilewati'
                                ? 'text-amber-600'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {sec.status} ({sec.count})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </form>

              {/* Two-Step postMatevRapor & postNilai Submission */}
              <div className="lg:col-span-6 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Pengiriman Nilai Resmi (postMatevRapor → postNilai?table=rapor)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kelas aktif: <strong>{selectedClass?.name}</strong>. Protokol membuat/memakai ulang <code className="font-mono">id_evaluasi</code> dan <code className="font-mono">nilai_id</code> UUID v5 deterministik untuk setiap murid terpetakan.
                </p>

                <Select
                  label="Pilih Mata Pelajaran"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                      {s.dapodikMapelId ? ` · Mapel ID ${s.dapodikMapelId}` : ''}
                    </option>
                  ))}
                </Select>

                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
                  <input
                    type="checkbox"
                    checked={isDryRun}
                    disabled={!canUpdateDapodik}
                    onChange={(e) => setIsDryRun(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>
                    <strong>Mode Dry-Run (Simulasi Uji Payload)</strong> — validasi kelengkapan
                    nilai dan UUID v5 payload tanpa mengirim perubahan permanen.
                  </span>
                </label>

                {lastProtocolResult && (
                  <AlertBox variant="info">
                    <div className="font-mono text-[11px] space-y-0.5">
                      <div>id_evaluasi: {lastProtocolResult.idEvaluasi}</div>
                      <div>updater_id: {lastProtocolResult.updaterId}</div>
                      <div>Jumlah payload nilai_id terproses: {lastProtocolResult.sentCount}</div>
                    </div>
                  </AlertBox>
                )}

                {canUpdateDapodik ? (
                  <Button loading={submitting} onClick={handleSubmitGrades}>
                    <Send className="w-4 h-4" />
                    {isDryRun
                      ? 'Jalankan Dry-Run postMatevRapor & postNilai'
                      : 'Kirim postMatevRapor & postNilai'}
                  </Button>
                ) : (
                  <p className="text-xs text-slate-500">
                    Akun Anda memiliki akses lihat saja. Diperlukan izin ubah Dapodik untuk mengirim nilai.
                  </p>
                )}
              </div>
            </div>

            {/* Submission & Sync Logs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                  Riwayat Pengiriman Nilai (postMatevRapor & postNilai)
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                  {subLogs.length === 0 ? (
                    <p className="p-4 text-xs text-slate-500">Belum ada riwayat pengiriman.</p>
                  ) : (
                    subLogs.map((l) => (
                      <div key={l.id} className="p-3 text-xs space-y-0.5">
                        <div className="flex items-center justify-between font-semibold">
                          <span>
                            {l.submissionPhase} · {l.isDryRun ? 'Dry-Run' : 'Produksi'}
                          </span>
                          <span
                            className={
                              l.status === 'Gagal'
                                ? 'text-red-600'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }
                          >
                            {l.status}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">{l.responseMessage}</p>
                        <p className="text-[11px] font-mono text-slate-400">
                          {l.createdAt.slice(0, 16)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                  Log Sinkronisasi Master Data
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                  {syncLogs.length === 0 ? (
                    <p className="p-4 text-xs text-slate-500">Belum ada log sinkronisasi.</p>
                  ) : (
                    syncLogs.map((l) => (
                      <div key={l.id} className="p-3 text-xs space-y-0.5">
                        <div className="flex items-center justify-between font-semibold">
                          <span>{l.syncType}</span>
                          <span
                            className={l.status === 'Gagal' ? 'text-red-600' : 'text-emerald-700'}
                          >
                            {l.status}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 tabular-nums">
                          Diproses: {l.recordsProcessed} · Pemetaan baru: {l.recordsCreated} ·
                          Diperbarui: {l.recordsUpdated}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400">
                          {l.createdAt.slice(0, 16)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-6 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Ekspor & Impor Format Excel E-Rapor ({selectedClass?.name})
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="Mata Pelajaran"
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Versi Template E-Rapor"
                    value={templateVersion}
                    onChange={(e) => setTemplateVersion(e.target.value)}
                  />
                </div>

                {canExportErapor && (
                  <a
                    href={`/api/erapor?mode=export&classId=${selectedClass?.id || ''}&subjectId=${selectedSubjectId}`}
                    className="inline-block"
                  >
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4" />
                      Unduh Format E-Rapor (.xlsx)
                    </Button>
                  </a>
                )}

                {canCreateErapor && (
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Pemetaan Nomor Kolom Excel (1 = Kolom A, 2 = Kolom B, dst.)
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <Input
                        label="Kolom NISN"
                        type="number"
                        min={1}
                        value={nisnCol}
                        onChange={(e) => setNisnCol(Number(e.target.value))}
                      />
                      <Input
                        label="Kolom Nilai"
                        type="number"
                        min={1}
                        value={scoreCol}
                        onChange={(e) => setScoreCol(Number(e.target.value))}
                      />
                      <Input
                        label="Kolom Deskripsi"
                        type="number"
                        min={1}
                        value={descCol}
                        onChange={(e) => setDescCol(Number(e.target.value))}
                      />
                    </div>
                    <input
                      type="file"
                      accept=".xlsx,.xlsm"
                      onChange={(e) => setEraporFile(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-medium file:bg-slate-50"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!eraporFile}
                        onClick={() => handleEraporUpload(false)}
                      >
                        <Upload className="w-4 h-4" />
                        Pratinjau Impor
                      </Button>
                      {eraporPreview && eraporPreview.totalValid > 0 && (
                        <Button size="sm" onClick={() => handleEraporUpload(true)}>
                          <CheckCircle2 className="w-4 h-4" />
                          Simpan {eraporPreview.totalValid} Nilai
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-6 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {eraporPreview ? 'Pratinjau Hasil Pembacaan E-Rapor' : 'Riwayat Impor E-Rapor'}
                </h2>

                {eraporPreview ? (
                  <div className="space-y-3">
                    {eraporPreview.errors.length > 0 && (
                      <AlertBox variant="warning">
                        {eraporPreview.errors.length} baris dilewati:{' '}
                        {eraporPreview.errors.map((e) => e.message).join('; ')}
                      </AlertBox>
                    )}
                    <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2 px-3">NISN</th>
                            <th className="py-2 px-3">Nama Murid</th>
                            <th className="py-2 px-3 text-right">Nilai</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {eraporPreview.rows.map((r) => (
                            <tr key={r.rowNumber}>
                              <td className="py-2 px-3 font-mono">{r.nisn}</td>
                              <td className="py-2 px-3 font-medium">{r.fullName}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold">
                                {r.score}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {eraporLogs.length === 0 ? (
                      <p className="text-xs text-slate-500">Belum ada riwayat impor E-Rapor.</p>
                    ) : (
                      eraporLogs.map((l) => (
                        <div key={l.id} className="py-2.5 text-xs">
                          <div className="flex items-center justify-between font-medium">
                            <span>{l.fileName}</span>
                            <span className="font-mono text-slate-500">
                              {l.createdAt.slice(0, 10)}
                            </span>
                          </div>
                          <p className="text-slate-500 mt-0.5 tabular-nums">
                            {l.templateVersion} · Berhasil: {l.successRows} · Gagal: {l.errorRows}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
