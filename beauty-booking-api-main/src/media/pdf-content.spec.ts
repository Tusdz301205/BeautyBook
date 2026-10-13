import { validatePdfContent } from './pdf-content';
import { blankPdf, contentPdf, encryptedPdf, malformedContentPdf, malformedLaterPagePdf, malformedPagePdf, malformedXrefPdf, zeroPagePdf } from './pdf-test-fixtures';
import { compressedObjectsPdf, contentsArrayPdf, nestedPageTreePdf, nonStreamContentsPdf, nullContentsPdf, scannedImagePdf, textPdf, undercountedLaterPagePdf } from './pdf-test-fixtures';

describe('real PDF parsing', () => {
  it.each([blankPdf, contentPdf, textPdf, scannedImagePdf, nullContentsPdf,
    () => contentsArrayPdf(), () => contentsArrayPdf('', false),
    () => contentsArrayPdf('4 0 R', true), () => nestedPageTreePdf(),
  ])('accepts a readable PDF without requiring text', async fixture => {
    const bytes = fixture();
    const original = Buffer.from(bytes);
    await expect(validatePdfContent(bytes)).resolves.toBeUndefined();
    expect(bytes).toEqual(original);
  });
  it.each([
    ['header only', () => Buffer.from('%PDF-1.4\n')],
    ['header and EOF only', () => Buffer.from('%PDF-1.4\n%%EOF\n')],
    ['truncated', () => contentPdf().subarray(0, -15)],
    ['invalid page', malformedPagePdf],
    ['invalid content stream', malformedContentPdf],
    ['invalid content on the second page', malformedLaterPagePdf],
    ['damaged xref needing recovery', malformedXrefPdf],
    ['zero pages', zeroPagePdf],
    ['undercounted tree hiding corrupt later content', undercountedLaterPagePdf],
    ['Contents referencing a string', () => nonStreamContentsPdf('(not a stream)')],
    ['Contents referencing a non-stream dictionary', () => nonStreamContentsPdf('<< /Length 0 >>')],
    ['Contents array containing a non-stream', () => contentsArrayPdf('4 0 R 2 0 R')],
    ['Contents referencing a missing object', () => contentsArrayPdf('99 0 R')],
    ['nested page tree undercount', () => nestedPageTreePdf('1')],
    ['root page tree undercount', () => nestedPageTreePdf('2', '1')],
    ['fractional page count', () => nestedPageTreePdf('2.5')],
    ['negative page count', () => nestedPageTreePdf('-1')],
  ])('rejects %s', async (_, fixture) => {
    await expect(validatePdfContent(fixture())).rejects.toThrow('Tệp PDF bị hỏng');
  });
  it('reports a password requirement truthfully', async () => {
    await expect(validatePdfContent(encryptedPdf())).rejects.toThrow('yêu cầu mật khẩu');
  });
  it.each([blankPdf, textPdf, scannedImagePdf, () => nestedPageTreePdf(),
    () => contentsArrayPdf('4 0 R', true),
  ])('accepts readable content and page trees in compressed object streams', async fixture => {
    const bytes = await compressedObjectsPdf(fixture());
    expect(bytes.toString('latin1')).toContain('/Type /ObjStm');
    const original = Buffer.from(bytes);
    await expect(validatePdfContent(bytes)).resolves.toBeUndefined();
    expect(bytes).toEqual(original);
  });
  it.each([
    ['hidden damaged later page', undercountedLaterPagePdf],
    ['string Contents', () => nonStreamContentsPdf('(not a stream)')],
    ['dictionary Contents', () => nonStreamContentsPdf('<< /Length 0 >>')],
    ['non-stream Contents array member', () => contentsArrayPdf('4 0 R 2 0 R')],
    ['nested undercount', () => nestedPageTreePdf('1')],
  ])('rejects %s in compressed object streams', async (_, fixture) => {
    const bytes = await compressedObjectsPdf(fixture());
    expect(bytes.toString('latin1')).toContain('/Type /ObjStm');
    await expect(validatePdfContent(bytes)).rejects.toThrow('Tệp PDF bị hỏng');
  });
  it('accepts PDF trailing whitespace without imposing a trailer byte limit', async () => {
    await expect(validatePdfContent(Buffer.concat([blankPdf(), Buffer.alloc(2048, 32)]))).resolves.toBeUndefined();
  });
  it('enforces existing byte limit even when invoked directly', async () => {
    await expect(validatePdfContent(Buffer.alloc(10 * 1024 * 1024 + 1))).rejects.toThrow('10 MB');
    await expect(validatePdfContent(Buffer.alloc(0))).rejects.toThrow('10 MB');
  });
});
