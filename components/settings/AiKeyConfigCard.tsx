'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button, ConfirmDialog, Input, Modal } from '@/components/ui/Primitives';

export interface AiKeyConfigSummary {
  hasApiKey: boolean;
  maskedKey: string;
  model: string;
  baseUrl: string;
  updatedAt: string | null;
}

export interface AiConfigPayload {
  personal: AiKeyConfigSummary;
  school?: AiKeyConfigSummary;
  canManageSchoolKey: boolean;
  canReadSchoolKey: boolean;
  canUseSchoolKey: boolean;
  effectiveConfigured: boolean;
  effectiveSource: 'personal' | 'school' | null;
  effectiveModel: string | null;
}

interface ProviderPreset {
  id: 'gemini' | 'openrouter' | 'deepseek' | 'groq' | 'openai';
  label: string;
  badge: string;
  keyPrefix: string;
  model: string;
  baseUrl: string;
  steps: string[];
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'gemini',
    label: 'Google Gemini (Native)',
    badge: 'Direkomendasikan',
    keyPrefix: 'AIzaSy...',
    model: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com',
    steps: [
      'Buka Google AI Studio (aistudio.google.com) lalu masuk dengan akun Google Anda.',
      'Klik menu "Get API key" → "Create API key", lalu salin kunci yang diawali AIzaSy...',
      'Tempel kunci pada kolom Kunci API, isi Model "gemini-2.5-flash", dan biarkan Base URL kosong atau isi https://generativelanguage.googleapis.com.',
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    badge: 'OpenAI-Compatible',
    keyPrefix: 'sk-or-v1-...',
    model: 'google/gemini-2.5-flash',
    baseUrl: 'https://openrouter.ai/api/v1',
    steps: [
      'Masuk ke openrouter.ai lalu buka menu Keys → Create Key.',
      'Salin kunci berawalan sk-or-v1-... ke kolom Kunci API.',
      'Gunakan Base URL https://openrouter.ai/api/v1 dan isi nama model sesuai katalog OpenRouter.',
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    badge: 'OpenAI-Compatible',
    keyPrefix: 'sk-... / ds-...',
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
    steps: [
      'Masuk ke platform.deepseek.com lalu buka API Keys → Create new API key.',
      'Salin kunci API yang diberikan ke kolom Kunci API.',
      'Isi Model "deepseek-chat" dan Base URL https://api.deepseek.com.',
    ],
  },
  {
    id: 'groq',
    label: 'Groq',
    badge: 'OpenAI-Compatible',
    keyPrefix: 'gsk_...',
    model: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    steps: [
      'Masuk ke console.groq.com lalu buat kunci pada menu API Keys.',
      'Tempel kunci ke kolom Kunci API dan isi Base URL https://api.groq.com/openai/v1.',
      'Gunakan nama model aktif seperti llama-3.3-70b-versatile.',
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    badge: 'OpenAI-Compatible',
    keyPrefix: 'sk-...',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    steps: [
      'Masuk ke platform.openai.com/api-keys lalu buat kunci rahasia baru.',
      'Tempel kunci berawalan sk-... ke kolom Kunci API.',
      'Isi Model "gpt-4o-mini" dan Base URL https://api.openai.com/v1.',
    ],
  },
];

export function AiKeyTutorialModal({
  open,
  onClose,
  onApplyPreset,
}: {
  open: boolean;
  onClose: () => void;
  onApplyPreset?: (preset: { model: string; baseUrl: string; label: string }) => void;
}) {
  const [selectedId, setSelectedId] = useState<ProviderPreset['id']>('gemini');
  const activePreset =
    PROVIDER_PRESETS.find((p) => p.id === selectedId) || PROVIDER_PRESETS[0];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tutorial Singkat Penggunaan Kunci API"
      subtitle="Panduan menghubungkan Google Gemini atau penyedia kompatibel OpenAI secara manual"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 p-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
            Aturan Pemakaian & Keamanan Kunci
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <strong>Admin / Kepala Sekolah</strong> dapat mengisi <em>Kunci API Sekolah</em> di
              tab <strong>Kunci API</strong> sebagai standar sekolah untuk Admin dan Kepala Sekolah.
            </li>
            <li>
              <strong>Guru / Wali Kelas</strong> mengisi <em>Kunci API Pribadi</em> di tab{' '}
              <strong>Akun Saya</strong> atau tab <strong>Kunci API</strong> agar kuota AI terpisah
              per akun.
            </li>
            <li>
              Seluruh Kunci API disimpan terenkripsi di server dan tidak pernah dikirim balik ke
              peramban dalam bentuk teks asli.
            </li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PROVIDER_PRESETS.map((preset) => {
            const active = preset.id === activePreset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSelectedId(preset.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#0F2942] text-white border-[#0F2942] dark:bg-[#1E3A5F] dark:border-[#1E3A5F]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-[#0F172A] dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-[#0F172A]/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {activePreset.label}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Protokol: {activePreset.badge} · Awalan Kunci:{' '}
                <span className="font-mono">{activePreset.keyPrefix}</span>
              </p>
            </div>
            {onApplyPreset && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onApplyPreset({
                    model: activePreset.model,
                    baseUrl: activePreset.baseUrl,
                    label: activePreset.label,
                  });
                  onClose();
                }}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#1D4ED8]" />
                Pakai Preset Model & URL
              </Button>
            )}
          </div>

          <ol className="list-decimal pl-4 space-y-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            {activePreset.steps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wide text-slate-500">
                Contoh Model
              </span>
              <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                {activePreset.model}
              </span>
            </div>
            <div className="rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wide text-slate-500">
                Contoh Base URL
              </span>
              <span className="font-mono font-medium text-slate-900 dark:text-slate-100 break-all">
                {activePreset.baseUrl}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Mengerti, Tutup Panduan
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function AiKeyConfigCard({
  scope,
  config,
  readOnly = false,
  onUpdated,
  notify,
}: {
  scope: 'personal' | 'school';
  config: AiKeyConfigSummary;
  readOnly?: boolean;
  onUpdated: (next: AiConfigPayload) => void;
  notify: (type: 'success' | 'error' | 'info', msg: string) => void;
}) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelDraft, setModelDraft] = useState<string | null>(null);
  const [baseUrlDraft, setBaseUrlDraft] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const serverModel = config.model || 'gemini-2.5-flash';
  const serverBaseUrl = config.baseUrl || '';
  const modelInput = modelDraft ?? serverModel;
  const baseUrlInput = baseUrlDraft ?? serverBaseUrl;

  const trimmedModel = modelInput.trim();
  const trimmedBaseUrl = baseUrlInput.trim();
  const trimmedKey = apiKeyInput.trim();

  const hasChanges =
    Boolean(trimmedKey) ||
    (config.hasApiKey && (trimmedModel !== serverModel || trimmedBaseUrl !== serverBaseUrl));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    if (!config.hasApiKey && !trimmedKey) {
      notify('info', 'Masukkan Kunci API terlebih dahulu sebelum menyimpan.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          scope,
          apiKey: trimmedKey,
          model: trimmedModel || 'gemini-2.5-flash',
          baseUrl: trimmedBaseUrl,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify('error', json.error || 'Gagal menyimpan konfigurasi Kunci API.');
        return;
      }
      setApiKeyInput('');
      setModelDraft(null);
      setBaseUrlDraft(null);
      setShowKey(false);
      onUpdated(json as AiConfigPayload);
      notify('success', json.message || 'Konfigurasi Kunci API berhasil disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (readOnly) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/ai/config?scope=${scope}`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      const json = await res.json().catch(() => ({}));
      setConfirmDeleteOpen(false);
      if (!res.ok) {
        notify('error', json.error || 'Gagal menghapus Kunci API.');
        return;
      }
      setApiKeyInput('');
      setModelDraft(null);
      setBaseUrlDraft(null);
      onUpdated(json as AiConfigPayload);
      notify('info', json.message || 'Kunci API berhasil dihapus.');
    } finally {
      setDeleting(false);
    }
  };

  const scopeLabel = scope === 'school' ? 'Kunci Sekolah (Admin)' : 'Kunci Pribadi (Akun Anda)';
  const description =
    scope === 'school'
      ? 'Kunci API sekolah untuk fitur "Generate" TP dan RPM di halaman Kurikulum. Dipakai oleh admin/kepala sekolah; guru memakai kunci API pribadi masing-masing. Mendukung Google Gemini langsung (native API) dan semua penyedia yang kompatibel dengan OpenAI chat completions (OpenRouter, DeepSeek, Groq, dsb).'
      : 'Kunci API pribadi Anda untuk fitur "Generate" TP dan RPM di halaman Kurikulum. Tersimpan terenkripsi di server dan hanya dipakai oleh akun Anda. Mendukung Google Gemini langsung (native API) dan semua penyedia yang kompatibel dengan OpenAI chat completions (OpenRouter, DeepSeek, Groq, dsb).';

  const keyInputId = `ai-api-key-${scope}`;

  return (
    <>
      <form
        onSubmit={handleSave}
        className="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Kunci API
              </h2>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                · {scopeLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
              {description}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setTutorialOpen(true)}
          >
            <BookOpen className="w-3.5 h-3.5 text-[#1D4ED8]" />
            Tutorial Singkat
          </Button>
        </div>

        {!config.hasApiKey ? (
          <div className="flex items-center gap-2.5 rounded-md border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-xs font-medium text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Belum ada kunci API. Fitur &quot;Generate&quot; belum dapat digunakan.</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200/80 bg-emerald-50/90 px-3.5 py-2.5 text-xs text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                Kunci API aktif (<span className="font-mono">{config.maskedKey}</span>) · Model:{' '}
                <span className="font-mono">{config.model}</span>
              </span>
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:underline dark:text-red-400 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Hapus Kunci
              </button>
            )}
          </div>
        )}

        <div className="space-y-3.5">
          <div>
            <label
              htmlFor={keyInputId}
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Kunci API
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id={keyInputId}
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy... / sk-... / ds-..."
                autoComplete="off"
                disabled={readOnly}
                className="w-full h-10 pl-9 pr-10 text-sm bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-md transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8] disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                aria-label={showKey ? 'Sembunyikan kunci API' : 'Lihat kunci API'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {config.hasApiKey
                ? 'Masukkan kunci API baru untuk mengganti kunci yang tersimpan.'
                : 'Masukkan kunci API manual dari Google AI Studio atau penyedia OpenAI-compatible.'}
            </p>
          </div>

          <Input
            id={`ai-model-${scope}`}
            label="Model"
            value={modelInput}
            onChange={(e) => setModelDraft(e.target.value)}
            placeholder="gemini-2.5-flash"
            hint="Nama model sesuai penyedia API yang digunakan."
            disabled={readOnly}
            required
          />

          <Input
            id={`ai-base-url-${scope}`}
            label="Base URL"
            value={baseUrlInput}
            onChange={(e) => setBaseUrlDraft(e.target.value)}
            placeholder="contoh: https://generativelanguage.googleapis.com"
            hint="Endpoint API lengkap termasuk /v1 jika diperlukan."
            disabled={readOnly}
          />
        </div>

        {!readOnly && (
          <div className="flex items-center justify-end pt-1">
            <Button type="submit" loading={saving} disabled={!hasChanges}>
              <Save className="w-4 h-4" />
              Simpan
            </Button>
          </div>
        )}
      </form>

      <AiKeyTutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onApplyPreset={
          readOnly
            ? undefined
            : (preset) => {
                setModelDraft(preset.model);
                setBaseUrlDraft(preset.baseUrl);
                notify(
                  'info',
                  `Preset ${preset.label} diterapkan. Tempel Kunci API Anda lalu klik Simpan.`
                );
              }
        }
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Hapus Kunci API"
        message={`Apakah Anda yakin ingin menghapus ${
          scope === 'school' ? 'Kunci API sekolah' : 'Kunci API pribadi Anda'
        }? Fitur Generate AI tidak akan dapat digunakan sampai kunci baru disimpan.`}
        confirmLabel="Ya, Hapus"
        danger
      />
    </>
  );
}
