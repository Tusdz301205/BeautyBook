import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui';

// Imported only when an authorized document has been downloaded.
export default function PdfPreview({ blob }) {
  const container = useRef(null);
  const canvas = useRef(null);
  const documentRef = useRef(null);
  const [document, setDocument] = useState(null);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loading;
    setBusy(true); setError(''); setDocument(null); setPage(1); setText('');
    (async () => {
      const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
      ]);
      if (cancelled) return;
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const data = new Uint8Array(await blob.arrayBuffer());
      if (cancelled) return;
      loading = pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true });
      // A password-protected document needs explicit handling, not a permanently busy canvas.
      loading.onPassword = () => {
        if (!cancelled) { setError('PDF được bảo vệ bằng mật khẩu. Hãy tải file để mở bằng trình đọc PDF.'); setBusy(false); }
        void loading.destroy();
      };
      const pdf = await loading.promise;
      if (cancelled) { await pdf.destroy(); return; }
      documentRef.current = pdf;
      setDocument(pdf);
    })().catch(() => {
      if (!cancelled) { setError('Không thể xem trước PDF này. Hãy tải đúng phiên bản đang chọn để đọc; chưa thể xác nhận nội dung từ bản xem trước.'); setBusy(false); }
    });
    return () => { cancelled = true; documentRef.current = null; if (loading) void loading.destroy(); };
  }, [blob]);

  useEffect(() => {
    if (!document || !width) return undefined;
    let cancelled = false;
    let render;
    setBusy(true); setError(''); setText('');
    (async () => {
      const pdfPage = await document.getPage(page);
      if (cancelled) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: width / base.width });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const node = canvas.current;
      node.width = Math.ceil(viewport.width * ratio);
      node.height = Math.ceil(viewport.height * ratio);
      node.style.width = '100%';
      node.style.height = 'auto';
      render = pdfPage.render({ canvasContext: node.getContext('2d'), viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined });
      await render.promise;
      const content = await pdfPage.getTextContent();
      if (!cancelled) { setText(content.items.map(item => item.str || '').join(' ')); setBusy(false); }
    })().catch(error => {
      if (!cancelled && error.name !== 'RenderingCancelledException') {
        setError('Không thể đọc trang PDF này. Hãy tải file để kiểm tra nội dung.'); setBusy(false);
      }
    });
    return () => { cancelled = true; render?.cancel(); };
  }, [document, page, width]);

  return <div ref={container} className="min-w-0">
    {document && <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <Button size="sm" variant="secondary" disabled={page <= 1 || busy} onClick={() => setPage(value => value - 1)}>Trang trước</Button>
      <p aria-live="polite">Trang {page} / {document.numPages}</p>
      <Button size="sm" variant="secondary" disabled={page >= document.numPages || busy} onClick={() => setPage(value => value + 1)}>Trang sau</Button>
    </div>}
    {busy && <p role="status" className="mb-3">Đang đọc nội dung PDF…</p>}
    {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm">{error}</p>}
    <canvas ref={canvas} hidden={busy || Boolean(error)} role="img" aria-label={`Nội dung tài liệu pháp lý, trang ${page}`} className="max-w-full rounded-lg border border-[var(--bb-border)] bg-white" />
    {!busy && !error && text && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">Đọc nội dung dạng văn bản</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm">{text}</p></details>}
  </div>;
}
