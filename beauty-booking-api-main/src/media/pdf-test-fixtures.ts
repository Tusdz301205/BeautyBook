import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';

// Tiny real PDF byte fixtures, with correct xref offsets, not mocked parser results.
export function pdfBytes(objects: string[], trailer = ''): Buffer {
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R ${trailer} >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

const catalog = '<< /Type /Catalog /Pages 2 0 R >>';
const pages = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
const page = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >>';
export const blankPdf = () => pdfBytes([catalog, pages, `${page} >>`]);
export const zeroPagePdf = () => pdfBytes([catalog, '<< /Type /Pages /Kids [] /Count 0 >>']);
export const malformedPagePdf = () => pdfBytes([catalog, pages, 'null']);
export const malformedContentPdf = () => pdfBytes([
  catalog, pages, `${page} /Contents 4 0 R >>`,
  '<< /Length 7 /Filter /FlateDecode >>\nstream\ngarbage\nendstream',
]);
export const malformedLaterPagePdf = () => pdfBytes([
  catalog, '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>', `${page} >>`,
  `${page} /Contents 5 0 R >>`,
  '<< /Length 7 /Filter /FlateDecode >>\nstream\ngarbage\nendstream',
]);
export const undercountedLaterPagePdf = () => Buffer.from(malformedLaterPagePdf()
  .toString('latin1').replace('/Count 2', '/Count 1'), 'latin1');
export const nonStreamContentsPdf = (object: string) => pdfBytes([
  catalog, pages, `${page} /Contents 4 0 R >>`, object,
]);
export const malformedXrefPdf = () => Buffer.from(blankPdf().toString('latin1')
  .replace(/startxref\n\d+/, 'startxref\n1'), 'latin1');
export const contentPdf = () => {
  const content = '0 0 100 100 re f\n';
  return pdfBytes([catalog, pages, `${page} /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}endstream`]);
};

export const contentsArrayPdf = (members = '4 0 R', indirect = false) => pdfBytes([
  catalog, pages, `${page} /Contents ${indirect ? '5 0 R' : `[${members}]`} >>`,
  '<< /Length 0 >>\nstream\n\nendstream', ...(indirect ? [`[${members}]`] : []),
]);
export const nullContentsPdf = () => pdfBytes([catalog, pages, `${page} /Contents null >>`]);
export const nestedPageTreePdf = (nestedCount = '2', rootCount = '2') => pdfBytes([
  catalog, `<< /Type /Pages /Kids [3 0 R] /Count ${rootCount} >>`,
  `<< /Type /Pages /Parent 2 0 R /Kids [4 0 R 5 0 R] /Count ${nestedCount} >>`,
  '<< /Type /Page /Parent 3 0 R /MediaBox [0 0 200 200] /Resources << >> >>',
  '<< /Type /Page /Parent 3 0 R /MediaBox [0 0 200 200] /Resources << >> >>',
]);
export const textPdf = () => {
  const content = 'BT /F1 12 Tf 10 100 Td (Readable text) Tj ET\n';
  return pdfBytes([catalog, pages,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]);
};
// An image-only scanned page: no fonts or text, with a real Flate RGB image.
export const scannedImagePdf = () => {
  const content = 'q 100 0 0 100 0 0 cm /Scan Do Q\n';
  const pixels = deflateSync(Buffer.from([255, 255, 255, 0, 0, 0, 0, 0, 0, 255, 255, 255]));
  return pdfBytes([catalog, pages,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /XObject << /Scan 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    `<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${pixels.length} >>\nstream\n${pixels.toString('latin1')}\nendstream`,
  ]);
};
export async function compressedObjectsPdf(bytes: Buffer): Promise<Buffer> {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  return Buffer.from(await document.save({
    useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false,
  }));
}

// Standard Security Handler revision 2, real password "secret"; blank page needs
// no encrypted stream. O/U are derived per the PDF encryption algorithm.
export function encryptedPdf(): Buffer {
  const padding = Buffer.from('28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a', 'hex');
  const pad = (password: string) => Buffer.concat([Buffer.from(password), padding]).subarray(0, 32);
  const md5 = (bytes: Buffer) => createHash('md5').update(bytes).digest();
  const rc4 = (key: Buffer, bytes: Buffer) => {
    const state = Array.from({ length: 256 }, (_, index) => index);
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + state[i] + key[i % key.length]) % 256;
      [state[i], state[j]] = [state[j], state[i]];
    }
    let i = 0; j = 0;
    return Buffer.from(bytes.map(byte => {
      i = (i + 1) % 256; j = (j + state[i]) % 256;
      [state[i], state[j]] = [state[j], state[i]];
      return byte ^ state[(state[i] + state[j]) % 256];
    }));
  };
  const owner = rc4(md5(pad('owner')).subarray(0, 5), pad('secret'));
  const id = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
  const permissions = Buffer.alloc(4); permissions.writeInt32LE(-4);
  const key = md5(Buffer.concat([pad('secret'), owner, permissions, id])).subarray(0, 5);
  const user = rc4(key, padding);
  return pdfBytes([catalog, pages, `${page} >>`,
    `<< /Filter /Standard /V 1 /R 2 /O <${owner.toString('hex')}> /U <${user.toString('hex')}> /P -4 >>`],
    `/Encrypt 4 0 R /ID [<${id.toString('hex')}> <${id.toString('hex')}>]`);
}
