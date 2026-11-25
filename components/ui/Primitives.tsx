'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Info, Loader2, ShieldAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const variants = {
    primary:
      'bg-[#0F2942] text-white hover:bg-[#163859] dark:bg-[#1E3A5F] dark:hover:bg-[#2B4C7E] border border-transparent',
    secondary:
      'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700',
    outline:
      'bg-white text-slate-700 hover:bg-slate-50 dark:bg-[#111C2E] dark:text-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700',
    danger:
      'bg-red-600 text-white hover:bg-red-700 border border-transparent',
    ghost:
      'bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 border border-transparent',
  };

  const sizes = {
    sm: 'h-9 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-5 text-sm',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id, ...rest }: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/[^a-z0-9]/g, '-') : undefined);
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full h-10 px-3 text-sm bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border rounded-md transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8]',
          error ? 'border-red-500' : 'border-slate-300 dark:border-slate-700',
          className
        )}
        {...rest}
      />
      {hint && !error && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, className, id, children, ...rest }: SelectProps) {
  const selectId = id || (label ? label.toLowerCase().replace(/[^a-z0-9]/g, '-') : undefined);
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          'w-full h-10 px-3 text-sm bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/30 focus:border-[#1D4ED8]',
          error ? 'border-red-500' : 'border-slate-300 dark:border-slate-700',
          className
        )}
        {...rest}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'w-full bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl max-h-[90vh] flex flex-col',
          maxWidth
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  danger = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{message}</p>
      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Batal
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function AlertBox({
  variant = 'info',
  title,
  children,
}: {
  variant?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: 'bg-blue-50/70 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-200',
    warning:
      'bg-amber-50/80 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200',
    error:
      'bg-red-50/80 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-900 dark:text-red-200',
    success:
      'bg-emerald-50/80 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-200',
  };
  const Icon =
    variant === 'success' ? CheckCircle2 : variant === 'info' ? Info : AlertCircle;

  return (
    <div className={cn('flex items-start gap-3 p-3.5 rounded-md border text-sm', styles[variant])}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="text-xs leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-10 px-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-md bg-slate-50/50 dark:bg-slate-900/30">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden bg-white dark:bg-[#111C2E]">
      <div className="h-10 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800" />
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="h-11 px-4 flex items-center gap-4 border-b last:border-b-0 border-slate-100 dark:border-slate-800"
        >
          <div className="h-3.5 w-8 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-3.5 w-44 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-3.5 w-28 bg-slate-100 dark:bg-slate-800/70 rounded animate-pulse ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function AccessDeniedCard({
  moduleLabel,
  roleName,
}: {
  moduleLabel: string;
  roleName?: string;
}) {
  return (
    <div className="max-w-xl mx-auto my-8 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-lg p-6 text-center space-y-4">
      <div className="w-12 h-12 mx-auto rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-center justify-center text-red-600 dark:text-red-400">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-mono font-semibold text-red-600 dark:text-red-400">
          HTTP 403 · AKSES DIBATASI
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-slate-900 dark:text-slate-100">
          Anda tidak memiliki izin membuka modul {moduleLabel}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
          {roleName
            ? `Peran aktif Anda (${roleName}) belum diberikan izin Lihat untuk halaman ini. Hubungi Administrator Sekolah apabila Anda memerlukan penyesuaian hak akses.`
            : 'Peran aktif Anda belum diberikan izin Lihat untuk halaman ini.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <Link
          href="/pengaturan"
          className="inline-flex items-center justify-center h-9 px-4 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Profil & Pengaturan Akun
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center h-9 px-4 text-xs font-medium rounded-md bg-[#0F2942] text-white hover:bg-[#163859]"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}

export interface TabBarItem {
  id: string;
  label: string;
}

export function TabBar({
  items,
  activeId,
  onChange,
  className,
}: {
  items: TabBarItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex max-w-full overflow-x-auto items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-md',
        className
      )}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8]',
              active
                ? 'bg-white dark:bg-[#111C2E] text-[#0F2942] dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  size = 'md',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  size?: 'sm' | 'md';
}) {
  const isSm = size === 'sm';
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2.5 select-none',
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label || 'Saklar status'}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative inline-flex shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-1',
          isSm ? 'h-5 w-9' : 'h-6 w-11',
          checked ? 'bg-[#0F2942] dark:bg-[#1D4ED8]' : 'bg-slate-300 dark:bg-slate-700',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block rounded-full bg-white shadow-sm transition-transform duration-150',
            isSm ? 'h-4 w-4' : 'h-5 w-5',
            checked ? (isSm ? 'translate-x-4' : 'translate-x-5') : 'translate-x-0'
          )}
        />
      </button>
      {(label || description) && (
        <span className="min-w-0">
          {label && (
            <span className="block text-xs font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">
              {label}
            </span>
          )}
          {description && (
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
}

