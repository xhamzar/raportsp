'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Primitives';
import { resolveTutorialGuide } from '@/lib/tutorial-guides';

export function TutorialGuideModal({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  const guide = resolveTutorialGuide(pathname);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-900 flex items-center justify-center text-[#0F2942] dark:text-blue-300 shrink-0">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="tutorial-modal-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight"
              >
                Petunjuk
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Panduan menu {guide.menuLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup petunjuk"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {guide.warning && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#F59E0B] text-slate-950 shadow-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-slate-950" />
              <p className="text-xs font-medium leading-relaxed">
                <span className="font-bold">Perhatian: </span>
                {guide.warning}
              </p>
            </div>
          )}

          <div className="space-y-3 text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
            {guide.paragraphs.map((segments, pIdx) => (
              <p key={pIdx}>
                {segments.map((seg, sIdx) => {
                  if (seg.type === 'chip') {
                    return (
                      <span
                        key={sIdx}
                        className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-800 dark:text-slate-100 align-baseline"
                      >
                        {seg.value}
                      </span>
                    );
                  }
                  if (seg.type === 'strong') {
                    return (
                      <strong key={sIdx} className="font-semibold text-slate-900 dark:text-slate-100">
                        {seg.value}
                      </strong>
                    );
                  }
                  return <React.Fragment key={sIdx}>{seg.value}</React.Fragment>;
                })}
              </p>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50/70 dark:bg-slate-900/40">
          <Button size="sm" onClick={onClose}>
            Mengerti
          </Button>
        </div>
      </div>
    </div>
  );
}
