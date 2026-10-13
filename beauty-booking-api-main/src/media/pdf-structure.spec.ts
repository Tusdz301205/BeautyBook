import * as parser from 'pdf-lib';
import { validatePdfStructure } from './pdf-structure';
import { compressedObjectsPdf, nestedPageTreePdf, nonStreamContentsPdf, pdfBytes, undercountedLaterPagePdf } from './pdf-test-fixtures';

describe('parsed PDF page structure', () => {
  it('counts actual leaves in compressed nested trees', async () => {
    const bytes = await compressedObjectsPdf(nestedPageTreePdf());
    // The counts are encoded inside /ObjStm, not visible to byte searches.
    expect(bytes.toString('latin1')).not.toContain('/Count');
    await expect(validatePdfStructure(bytes, parser)).resolves.toBe(2);
  });
  it.each([false, true])('finds hidden later-page undercounts (compressed: %s)', async compressed => {
    const bytes = compressed ? await compressedObjectsPdf(undercountedLaterPagePdf()) : undercountedLaterPagePdf();
    await expect(validatePdfStructure(bytes, parser)).rejects.toThrow('Incorrect page tree count');
  });
  it.each(['(not a stream)', '<< /Length 0 >>'])('rejects parsed non-stream Contents %s', async object => {
    const bytes = await compressedObjectsPdf(nonStreamContentsPdf(object));
    await expect(validatePdfStructure(bytes, parser)).rejects.toThrow('Non-stream page Contents');
  });
  it.each([
    ['cycle', '<< /Type /Pages /Parent 2 0 R /Kids [2 0 R] /Count 1 >>', 'null', 'Cyclic'],
    ['duplicate kid', '<< /Type /Pages /Kids [3 0 R 3 0 R] /Count 2 >>',
      '<< /Type /Page /Parent 2 0 R >>', 'repeated'],
    ['missing kid', '<< /Type /Pages /Kids [99 0 R] /Count 1 >>', 'null', 'Missing PDF object'],
    ['wrong parent', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 1 0 R >>', 'Incorrect page parent'],
  ])('rejects %s without recursive traversal', async (_, tree, page, error) => {
    const bytes = pdfBytes(['<< /Type /Catalog /Pages 2 0 R >>', tree, page]);
    await expect(validatePdfStructure(bytes, parser)).rejects.toThrow(error);
  });
});
