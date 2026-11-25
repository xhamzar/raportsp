'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Printer,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { RenderedPdfBundle } from '@/lib/pdf-renderer';

interface GoogleDrivePdfPreviewModalProps {
  open: boolean;
  bundle: RenderedPdfBundle | null;
  onClose: () => void;
  onDownload: () => void;
  onPrint: () => void;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75];

export function GoogleDrivePdfPreviewModal({
  open,
  bundle,
  onClose,
  onDownload,
  onPrint,
}: GoogleDrivePdfPreviewModalProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activePage, setActivePage] = useState(1);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [fitMode, setFitMode] = useState<'fit' | 'manual'>('fit');

  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => {
      setActivePage(1);
      setFitMode('fit');
      setZoomScale(1);
    });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !bundle) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height * 0.4;
      let closestPage = 1;
      let minDist = Number.POSITIVE_INFINITY;

      pageRefs.current.forEach((el, idx) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const dist = Math.abs(mid - centerY);
        if (dist < minDist) {
          minDist = dist;
          closestPage = idx + 1;
        }
      });

      setActivePage(closestPage);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [open, bundle]);

  if (!open || !bundle) return null;

  const totalPages = bundle.pages.length;

  const jumpToPage = (target: number) => {
    const clamped = Math.max(1, Math.min(totalPages, target));
    setActivePage(clamped);
    const el = pageRefs.current[clamped - 1];
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleZoomOut = () => {
    setFitMode('manual');
    setZoomScale((prev) => {
      const idx = ZOOM_STEPS.findIndex((z) => z >= prev - 0.01);
      if (idx <= 0) return ZOOM_STEPS[0];
      return ZOOM_STEPS[idx - 1];
    });
  };

  const handleZoomIn = () => {
    setFitMode('manual');
    setZoomScale((prev) => {
      const next = ZOOM_STEPS.find((z) => z > prev + 0.01);
      return next ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
    });
  };

  const handleResetFit = () => {
    setFitMode('fit');
    setZoomScale(1);
  };

  const zoomPercent = Math.round(zoomScale * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview Dokumen ${bundle.fileName}`}
      className="no-print fixed inset-0 z-[60] flex flex-col bg-[#1B2330]/95 backdrop-blur-sm text-white"
    >
      {/* Top Toolbar ala Google Drive PDF Viewer */}
      <header className="shrink-0 bg-[#111827] border-b border-slate-700/80 px-2.5 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        {/* Zone Kiri: Tutup & Nama File */}
        <div className="flex items-center gap-2 min-w-0 max-w-[55%] sm:max-w-[34%]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Preview"
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <FileText className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs sm:text-sm font-medium text-slate-100 truncate">
            {bundle.fileName}
          </span>
        </div>

        {/* Zone Tengah: Info Halaman & Zoom */}
        <div className="order-3 sm:order-2 w-full sm:w-auto flex items-center justify-center gap-1.5 sm:gap-3 border-t sm:border-t-0 border-slate-800 pt-1.5 sm:pt-0">
          {/* Navigasi Halaman */}
          <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700 rounded-md px-1.5 py-1">
            <button
              type="button"
              onClick={() => jumpToPage(activePage - 1)}
              disabled={activePage <= 1}
              aria-label="Halaman sebelumnya"
              className="w-7 h-7 rounded flex items-center justify-center text-slate-200 hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-1.5 text-xs font-mono tabular-nums text-slate-200 whitespace-nowrap">
              Hal {activePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => jumpToPage(activePage + 1)}
              disabled={activePage >= totalPages}
              aria-label="Halaman berikutnya"
              className="w-7 h-7 rounded flex items-center justify-center text-slate-200 hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Kontrol Zoom */}
          <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700 rounded-md px-1.5 py-1">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={fitMode === 'manual' && zoomScale <= ZOOM_STEPS[0]}
              aria-label="Perkecil"
              className="w-7 h-7 rounded flex items-center justify-center text-slate-200 hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleResetFit}
              title="Sesuaikan Lebar Layar"
              className="px-2 h-7 rounded text-xs font-mono tabular-nums text-slate-200 hover:bg-slate-700 whitespace-nowrap cursor-pointer"
            >
              {fitMode === 'fit' ? 'Pas' : `${zoomPercent}%`}
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={fitMode === 'manual' && zoomScale >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              aria-label="Perbesar"
              className="w-7 h-7 rounded flex items-center justify-center text-slate-200 hover:bg-slate-700 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Zone Kanan: Cetak & Unduh PDF */}
        <div className="order-2 sm:order-3 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onPrint}
            className="h-9 px-3 rounded-md border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden xs:inline sm:inline">Cetak</span>
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="h-9 px-3.5 rounded-md bg-[#1D4ED8] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            <Download className="w-4 h-4" />
            <span>Unduh PDF</span>
          </button>
        </div>
      </header>

      {/* Scrollable Google Drive Document Viewer Canvas */}
      <motion.div
        ref={scrollContainerRef}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 overflow-auto px-3 sm:px-8 py-5 sm:py-8"
      >
        <div className="flex flex-col items-center gap-6 min-w-fit mx-auto">
          {bundle.pages.map((page, index) => {
            const baseWidthPx = page.orientation === 'landscape' ? 980 : 760;
            const styleObj: React.CSSProperties =
              fitMode === 'fit'
                ? {
                    width: `min(calc(100vw - 24px), ${baseWidthPx}px)`,
                  }
                : {
                    width: `${Math.round(baseWidthPx * zoomScale)}px`,
                  };

            return (
              <div
                key={page.pageNumber}
                ref={(el) => {
                  pageRefs.current[index] = el;
                }}
                className="flex flex-col items-center gap-2"
              >
                <div
                  style={styleObj}
                  className="bg-white shadow-2xl border border-slate-700/40 rounded-[2px] overflow-hidden transition-[width] duration-150"
                >
                  <img
                    src={page.dataUrl}
                    alt={`Halaman ${page.pageNumber}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-auto block select-none"
                  />
                </div>
                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                  Halaman {page.pageNumber} dari {totalPages} · A4{' '}
                  {page.orientation === 'landscape' ? 'Lanskap' : 'Potret'}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
