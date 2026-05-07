/**
 * Renders the first page of a PDF to a canvas (Mozilla PDF.js).
 * Avoids the browser's embedded PDF viewer (toolbar, thumbnails) so slides look like posters.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import logger from '@/utils/logger';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

export interface MediaPdfPageProps {
  url: string;
  /** Accessible label */
  title?: string;
  /** contain = letterbox (default for signage); cover = fill crop */
  fit: 'contain' | 'cover';
  className?: string;
  /** Fires once when the first frame has been painted (or load/render failed). */
  onReady?: () => void;
}

const MediaPdfPage: React.FC<MediaPdfPageProps> = ({
  url,
  title,
  fit,
  className = '',
  onReady,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const readyFiredRef = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const fireReadyOnce = () => {
    if (readyFiredRef.current) return;
    readyFiredRef.current = true;
    onReadyRef.current?.();
  };

  const renderCanvas = useCallback(async () => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const pdf = pdfRef.current;
    if (!wrap || !canvas || !pdf) return;

    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    if (cw <= 0 || ch <= 0) return;

    try {
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const scale =
        fit === 'contain'
          ? Math.min(cw / base.width, ch / base.height)
          : Math.max(cw / base.width, ch / base.height);
      const viewport = page.getViewport({ scale });

      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        fireReadyOnce();
        return;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;
      fireReadyOnce();
    } catch (err: unknown) {
      logger.error('[MediaPdfPage] Failed to render page', {
        error: err instanceof Error ? err.message : String(err),
      });
      fireReadyOnce();
    }
  }, [fit]);

  const renderCanvasRef = useRef(renderCanvas);
  renderCanvasRef.current = renderCanvas;

  /** Load / unload PDF when URL only — do not depend on `fit` or we re-fetch the file on every fit change. */
  useEffect(() => {
    readyFiredRef.current = false;
    let cancelled = false;
    const loadingTask = pdfjsLib.getDocument({
      url,
      useSystemFonts: true,
    });

    loadingTask.promise
      .then(async (pdf: PDFDocumentProxy) => {
        if (cancelled) {
          await pdf.destroy();
          return;
        }
        pdfRef.current = pdf;
        await renderCanvasRef.current();
      })
      .catch((err: unknown) => {
        logger.error('[MediaPdfPage] Failed to load PDF', {
          error: err instanceof Error ? err.message : String(err),
        });
        fireReadyOnce();
      });

    return () => {
      cancelled = true;
      void loadingTask.destroy();
      void pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, [url]);

  /** Re-render when fit changes (same document) */
  useEffect(() => {
    void renderCanvas();
  }, [fit, renderCanvas]);

  /** Resize → redraw */
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    let raf = 0;
    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        void renderCanvas();
      });
    };

    const ro = new ResizeObserver(schedule);
    ro.observe(wrap);
    schedule();

    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [renderCanvas]);

  return (
    <div
      ref={wrapRef}
      data-media-pdf-page=""
      className={`flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-hidden ${className}`}
      aria-label={title ?? 'PDF poster'}
    >
      <canvas ref={canvasRef} className="gpu-accelerated max-h-full max-w-full" role="img" />
    </div>
  );
};

export default React.memo(MediaPdfPage);
