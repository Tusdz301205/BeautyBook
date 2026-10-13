import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { validatePdfStructure } from './pdf-structure';

const MAX_PDF_BYTES = 10 * 1024 * 1024;
// Operational budget, not a page-count or document-content business rule.
const PARSE_TIMEOUT_MS = 15_000;
const INVALID_PDF = 'Tệp PDF bị hỏng, bị cắt ngắn hoặc không có trang đọc được.';

// Native ESM import runs in Node, outside the CommonJS/Jest module loader.
// Keep this self-contained so the compiled backend needs no copied .mjs asset.
const PARSER_WORKER = `
const { parentPort, workerData } = require('node:worker_threads');
const structuralParser = require(workerData.structuralModulePath);
const validateStructure = ${validatePdfStructure.toString()};
(async () => {
  const { getDocument } = await import(workerData.moduleUrl);
  // PDF.js 6.4.299 Parser.makeFilter catches bad filters and substitutes an
  // empty stream even with stopAtErrors. Observe only data-loss diagnostics,
  // not benign font/resource warnings. Version is pinned; real-byte tests guard it.
  let lostData = false;
  console.warn = (message) => {
    if (/^Warning: (Invalid stream:|getContentStream - ignoring sub-stream|Indexing all PDF objects|Filter .* is not supported)/.test(String(message))) {
      lostData = true;
    }
  };
  let task;
  let result;
  try {
    task = getDocument({
      data: new Uint8Array(workerData.bytes), stopAtErrors: true,
      isEvalSupported: false, useSystemFonts: false, verbosity: 1,
    });
    const document = await task.promise;
    if (!Number.isInteger(document.numPages) || document.numPages < 1) {
      throw new Error('No pages');
    }
    const actualPages = await validateStructure(new Uint8Array(workerData.bytes), structuralParser);
    if (actualPages !== document.numPages) throw new Error('Reader page count mismatch');
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index);
      try {
        await page.getOperatorList();
        await page.getTextContent();
      } finally {
        page.cleanup();
      }
    }
    if (lostData) throw new Error('Parser discarded damaged data');
    result = 'valid';
  } catch (error) {
    result = error?.name === 'PasswordException' ? 'password' : 'invalid';
  } finally {
    if (task) await task.destroy();
  }
  parentPort.postMessage(result);
})();
`;

/** Validate page-tree counts/Contents types, then read every page without requiring text.
 * Both parsers run inside the same bounded worker (scans/blank pages are valid).
 * PDF.js can recover damaged files: the EOF check also rejects missing final trailers.
 * This checks readability, not malware, signatures or legal authenticity.
 */
export async function validatePdfContent(buffer: Buffer): Promise<void> {
  if (buffer.length < 1 || buffer.length > MAX_PDF_BYTES) {
    throw new BadRequestException('Tệp PDF phải có dung lượng từ 1 byte đến 10 MB.');
  }
  let end = buffer.length;
  while (end > 0 && [0, 9, 10, 12, 13, 32].includes(buffer[end - 1])) end--;
  if (buffer.toString('ascii', 0, 5) !== '%PDF-' ||
      end < 5 || !buffer.subarray(end - 5, end).equals(Buffer.from('%%EOF'))) {
    throw new BadRequestException(INVALID_PDF);
  }

  let moduleUrl: string;
  let structuralModulePath: string;
  try {
    moduleUrl = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href;
    structuralModulePath = require.resolve('pdf-lib');
  } catch {
    throw new ServiceUnavailableException('Bộ đọc PDF chưa sẵn sàng. Vui lòng thử lại sau.');
  }
  let worker: Worker;
  try {
    worker = new Worker(PARSER_WORKER, {
      eval: true,
      workerData: { moduleUrl, structuralModulePath, bytes: new Uint8Array(buffer) },
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
  } catch {
    throw new ServiceUnavailableException('Không thể chạy bộ đọc PDF. Vui lòng thử lại sau.');
  }
  let timer: NodeJS.Timeout | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new BadRequestException(
        'Không thể hoàn tất kiểm tra PDF trong thời gian cho phép. Vui lòng thử tệp khác.',
      )), PARSE_TIMEOUT_MS);
      worker.once('message', (result: string) => {
        if (result === 'valid') resolve();
        else reject(new BadRequestException(result === 'password'
          ? 'Tệp PDF yêu cầu mật khẩu. Vui lòng tải bản PDF có thể mở mà không cần mật khẩu.'
          : INVALID_PDF));
      });
      worker.once('error', () => reject(new ServiceUnavailableException(
        'Không thể chạy bộ đọc PDF. Vui lòng thử lại sau.',
      )));
      worker.once('exit', () => reject(new ServiceUnavailableException(
        'Bộ đọc PDF đã dừng trước khi hoàn tất kiểm tra. Vui lòng thử lại sau.',
      )));
    });
  } finally {
    clearTimeout(timer);
    await worker.terminate();
  }
}
