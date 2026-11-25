export type PdfOrientation = 'portrait' | 'landscape';

export interface RenderedPdfPage {
  pageNumber: number;
  orientation: PdfOrientation;
  dataUrl: string;
  widthMm: number;
  heightMm: number;
}

export interface RenderedPdfBundle {
  fileName: string;
  pages: RenderedPdfPage[];
  pdfBlob: Blob;
  pdfUrl: string;
}

export function buildPdfFileName(parts: Array<string | null | undefined>): string {
  const joined = parts
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .join('_')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const base = joined || 'Dokumen_Sekolah';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete) {
        return typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        setTimeout(done, 4000);
      });
    })
  );
}

async function inlineImagesAsDataUrls(sourceRoot: HTMLElement, cloneRoot: HTMLElement): Promise<void> {
  const srcImgs = Array.from(sourceRoot.querySelectorAll('img'));
  const cloneImgs = Array.from(cloneRoot.querySelectorAll('img'));

  await Promise.all(
    cloneImgs.map(async (cloneImg, idx) => {
      const origImg = srcImgs[idx];
      const rawSrc = cloneImg.getAttribute('src') || '';
      if (!rawSrc || rawSrc.startsWith('data:')) return;

      if (origImg && origImg.complete && origImg.naturalWidth > 0) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = origImg.naturalWidth;
          canvas.height = origImg.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(origImg, 0, 0);
            cloneImg.setAttribute('src', canvas.toDataURL('image/png'));
            return;
          }
        } catch {
          // Fallback to fetch below if canvas taint occurs
        }
      }

      try {
        const res = await fetch(rawSrc, { credentials: 'include' });
        if (!res.ok) {
          cloneImg.style.display = 'none';
          return;
        }
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.onerror = () => reject(new Error('Gagal membaca gambar'));
          reader.readAsDataURL(blob);
        });
        if (dataUrl) {
          cloneImg.setAttribute('src', dataUrl);
        } else {
          cloneImg.style.display = 'none';
        }
      } catch {
        cloneImg.style.display = 'none';
      }
    })
  );
}

export interface PageSliceInterval {
  start: number;
  end: number;
}

export interface PageSliceRange {
  startY: number;
  endY: number;
  topMarginPx: number;
}

export interface RepeatingPageFooter {
  left: string;
  right: string;
}

export function computePageSlices(
  totalHeightPx: number,
  pageHeightPx: number,
  sliceMarginPx: number,
  avoidIntervals: PageSliceInterval[],
  bottomReservePx = 0
): PageSliceRange[] {
  if (totalHeightPx <= 0) return [];
  const effectiveSinglePageMax =
    bottomReservePx > 0 ? pageHeightPx - bottomReservePx : pageHeightPx * 1.05;
  if (totalHeightPx <= effectiveSinglePageMax) {
    return [{ startY: 0, endY: totalHeightPx, topMarginPx: 0 }];
  }

  const sortedIntervals = [...avoidIntervals]
    .filter((iv) => iv.end > iv.start)
    .sort((a, b) => a.start - b.start);

  const slices: PageSliceRange[] = [];
  let offsetY = 0;

  while (offsetY < totalHeightPx) {
    const isFirstPage = slices.length === 0;
    const topMarginPx = isFirstPage ? 0 : sliceMarginPx;
    const effectiveBottomMargin = sliceMarginPx + bottomReservePx;
    const maxUsableHeight = Math.max(200, pageHeightPx - topMarginPx - effectiveBottomMargin);
    const rawCut = offsetY + maxUsableHeight;

    if (rawCut >= totalHeightPx) {
      slices.push({ startY: offsetY, endY: totalHeightPx, topMarginPx });
      break;
    }

    // Find the earliest indivisible row/block interval that straddles rawCut
    let cutY = rawCut;
    for (const iv of sortedIntervals) {
      if (iv.start < rawCut && iv.end > rawCut && iv.start > offsetY + 60) {
        cutY = Math.min(cutY, iv.start);
      }
    }

    // Avoid leaving a tiny empty padding sliver (< 28px) on a trailing blank page
    if (
      totalHeightPx - cutY <= 28 &&
      totalHeightPx - offsetY <= pageHeightPx - topMarginPx - bottomReservePx
    ) {
      cutY = totalHeightPx;
    }

    if (cutY <= offsetY + 20) {
      cutY = rawCut;
    }

    slices.push({ startY: offsetY, endY: cutY, topMarginPx });
    offsetY = cutY;
  }

  return slices;
}

function collectAvoidBreakIntervals(clone: HTMLElement, pixelRatio: number): PageSliceInterval[] {
  const rootRect = clone.getBoundingClientRect();
  const toPx = (y: number) => Math.max(0, Math.round((y - rootRect.top) * pixelRatio));
  const intervals: PageSliceInterval[] = [];

  // 1. Keep-together blocks (signature + footer, Ketidakhadiran + Catatan, Tanggapan)
  clone
    .querySelectorAll<HTMLElement>('.rapor-keep-together, .rapor-signature-block')
    .forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        intervals.push({
          start: Math.max(0, toPx(rect.top) - 4),
          end: toPx(rect.bottom) + 4,
        });
      }
    });

  // 2. Table headers + first data rows, group headings + next row, and individual rows
  clone.querySelectorAll('table').forEach((table) => {
    const thead = table.querySelector('thead');
    const tbodyRows = Array.from(table.querySelectorAll(':scope > tbody > tr'));

    if (thead && tbodyRows.length > 0) {
      const theadRect = thead.getBoundingClientRect();
      const firstRowRect = tbodyRows[0].getBoundingClientRect();
      if (theadRect.height > 0 && firstRowRect.height > 0) {
        intervals.push({
          start: Math.max(0, toPx(theadRect.top) - 2),
          end: toPx(firstRowRect.bottom) + 2,
        });
      }
    }

    for (let i = 0; i < tbodyRows.length; i++) {
      const row = tbodyRows[i];
      const rect = row.getBoundingClientRect();
      if (rect.height <= 0) continue;

      const isGroupHeaderRow =
        Boolean(row.querySelector('td[colspan]')) && !row.classList.contains('first-data-row');

      if (isGroupHeaderRow && i + 1 < tbodyRows.length) {
        const nextRect = tbodyRows[i + 1].getBoundingClientRect();
        intervals.push({
          start: Math.max(0, toPx(rect.top) - 2),
          end: toPx(nextRect.bottom) + 2,
        });
      } else {
        intervals.push({
          start: Math.max(0, toPx(rect.top) - 2),
          end: toPx(rect.bottom) + 2,
        });
      }
    }
  });

  return intervals;
}

function drawPageFooter(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  footer: RepeatingPageFooter
): void {
  const padX = 80; // Matches sm:p-10 (40px * 2x pixelRatio)
  const lineY = canvasHeight - 86;
  const textY = canvasHeight - 50;

  ctx.save();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, lineY);
  ctx.lineTo(canvasWidth - padX, lineY);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '22px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'middle';

  if (footer.left) {
    ctx.textAlign = 'left';
    ctx.fillText(footer.left, padX, textY, (canvasWidth - padX * 2) * 0.62);
  }
  if (footer.right) {
    ctx.textAlign = 'right';
    ctx.fillText(footer.right, canvasWidth - padX, textY, (canvasWidth - padX * 2) * 0.45);
  }
  ctx.restore();
}

function sliceCanvasToA4Pages(
  sourceCanvas: HTMLCanvasElement,
  orientation: PdfOrientation,
  startPageNumber: number,
  avoidIntervals: PageSliceInterval[],
  footer?: RepeatingPageFooter | null
): RenderedPdfPage[] {
  const widthMm = orientation === 'landscape' ? 297 : 210;
  const heightMm = orientation === 'landscape' ? 210 : 297;
  const pageRatio = heightMm / widthMm;
  const targetPageHeightPx = Math.round(sourceCanvas.width * pageRatio);
  const sliceMarginPx = Math.round(targetPageHeightPx * 0.032);
  const bottomReservePx = footer ? 104 : 0;

  const slices = computePageSlices(
    sourceCanvas.height,
    targetPageHeightPx,
    sliceMarginPx,
    avoidIntervals,
    bottomReservePx
  );

  // If fits on 1 page cleanly
  const singlePageCeiling =
    bottomReservePx > 0 ? targetPageHeightPx - bottomReservePx : targetPageHeightPx * 1.05;
  if (slices.length === 1 && sourceCanvas.height <= singlePageCeiling) {
    const outCanvas = document.createElement('canvas');
    outCanvas.width = sourceCanvas.width;
    outCanvas.height = targetPageHeightPx;
    const ctx = outCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
      const maxDrawHeight = targetPageHeightPx - bottomReservePx;
      const drawWidth =
        sourceCanvas.height > maxDrawHeight
          ? Math.round(sourceCanvas.width * (maxDrawHeight / sourceCanvas.height))
          : sourceCanvas.width;
      const drawHeight =
        sourceCanvas.height > maxDrawHeight ? maxDrawHeight : sourceCanvas.height;
      const offsetX = Math.round((outCanvas.width - drawWidth) / 2);
      ctx.drawImage(
        sourceCanvas,
        0,
        0,
        sourceCanvas.width,
        sourceCanvas.height,
        offsetX,
        0,
        drawWidth,
        drawHeight
      );
      if (footer) {
        drawPageFooter(ctx, outCanvas.width, outCanvas.height, footer);
      }
    }
    return [
      {
        pageNumber: startPageNumber,
        orientation,
        dataUrl: outCanvas.toDataURL('image/jpeg', 0.95),
        widthMm,
        heightMm,
      },
    ];
  }

  return slices.map((slice, idx) => {
    const chunkHeight = Math.max(1, slice.endY - slice.startY);
    const outCanvas = document.createElement('canvas');
    outCanvas.width = sourceCanvas.width;
    outCanvas.height = Math.max(
      targetPageHeightPx,
      chunkHeight + slice.topMarginPx + bottomReservePx
    );
    const ctx = outCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
      ctx.drawImage(
        sourceCanvas,
        0,
        slice.startY,
        sourceCanvas.width,
        chunkHeight,
        0,
        slice.topMarginPx,
        sourceCanvas.width,
        chunkHeight
      );
      if (footer) {
        drawPageFooter(ctx, outCanvas.width, outCanvas.height, footer);
      }
    }

    return {
      pageNumber: startPageNumber + idx,
      orientation,
      dataUrl: outCanvas.toDataURL('image/jpeg', 0.95),
      widthMm,
      heightMm,
    };
  });
}

export async function renderPrintContainerToPdf(
  container: HTMLElement,
  options: {
    fileName: string;
    onProgress?: (current: number, total: number) => void;
  }
): Promise<RenderedPdfBundle> {
  const articles = Array.from(container.querySelectorAll('article'));
  if (articles.length === 0) {
    throw new Error('Tidak ada lembar dokumen yang siap diproses.');
  }

  await waitForImages(container);

  const [{ toCanvas }, { jsPDF }] = await Promise.all([
    import('html-to-image'),
    import('jspdf'),
  ]);

  const stagingHost = document.createElement('div');
  stagingHost.setAttribute('aria-hidden', 'true');
  stagingHost.className = 'light';
  stagingHost.style.position = 'fixed';
  stagingHost.style.left = '-12000px';
  stagingHost.style.top = '0';
  stagingHost.style.zIndex = '-1';
  stagingHost.style.pointerEvents = 'none';
  stagingHost.style.backgroundColor = '#FFFFFF';
  stagingHost.style.colorScheme = 'light';
  document.body.appendChild(stagingHost);

  const renderedPages: RenderedPdfPage[] = [];

  try {
    for (let i = 0; i < articles.length; i++) {
      options.onProgress?.(i + 1, articles.length);
      const article = articles[i];
      const orientation: PdfOrientation = article.classList.contains('print-landscape')
        ? 'landscape'
        : 'portrait';

      // Standard A4 pixel width at 96 DPI: Portrait 794px (210mm), Landscape 1123px (297mm)
      const targetWidthPx = orientation === 'landscape' ? 1123 : 794;

      const footerLeft = article.getAttribute('data-footer-left') || '';
      const footerRight = article.getAttribute('data-footer-right') || '';
      const footer: RepeatingPageFooter | null =
        footerLeft || footerRight ? { left: footerLeft, right: footerRight } : null;

      const clone = article.cloneNode(true) as HTMLElement;
      clone.style.width = `${targetWidthPx}px`;
      clone.style.maxWidth = `${targetWidthPx}px`;
      clone.style.minWidth = `${targetWidthPx}px`;
      clone.style.margin = '0';
      clone.style.border = 'none';
      clone.style.boxShadow = 'none';
      clone.style.borderRadius = '0';
      clone.style.backgroundColor = '#FFFFFF';
      clone.style.color = '#0F172A';

      if (footer) {
        clone.querySelectorAll('.rapor-inline-footer').forEach((el) => el.remove());
      }

      // Expand any horizontally scrollable wrappers inside tables so wide tables never clip
      const scrollContainers = clone.querySelectorAll<HTMLElement>('.overflow-x-auto');
      scrollContainers.forEach((el) => {
        el.style.overflow = 'visible';
      });

      await inlineImagesAsDataUrls(article, clone);

      stagingHost.innerHTML = '';
      stagingHost.style.width = `${targetWidthPx}px`;
      stagingHost.appendChild(clone);

      // Give the browser a frame to apply layout metrics
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

      const pixelRatio = 2;
      const avoidIntervals = collectAvoidBreakIntervals(clone, pixelRatio);

      const canvas = await toCanvas(clone, {
        backgroundColor: '#FFFFFF',
        pixelRatio,
        width: targetWidthPx,
        cacheBust: false,
      });

      const sliced = sliceCanvasToA4Pages(
        canvas,
        orientation,
        renderedPages.length + 1,
        avoidIntervals,
        footer
      );
      renderedPages.push(...sliced);
    }
  } finally {
    stagingHost.remove();
  }

  if (renderedPages.length === 0) {
    throw new Error('Gagal merender halaman dokumen PDF.');
  }

  const first = renderedPages[0];
  const pdf = new jsPDF({
    orientation: first.orientation,
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  renderedPages.forEach((page, idx) => {
    if (idx > 0) {
      pdf.addPage('a4', page.orientation);
    }
    pdf.addImage(page.dataUrl, 'JPEG', 0, 0, page.widthMm, page.heightMm, undefined, 'FAST');
  });

  const pdfBlob = pdf.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);

  return {
    fileName: options.fileName,
    pages: renderedPages,
    pdfBlob,
    pdfUrl,
  };
}

export function triggerPdfDownload(bundle: Pick<RenderedPdfBundle, 'pdfUrl' | 'fileName'>): void {
  const link = document.createElement('a');
  link.href = bundle.pdfUrl;
  link.download = bundle.fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => link.remove(), 250);
}
