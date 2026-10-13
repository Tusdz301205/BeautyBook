import type { PDFDict, PDFObject } from 'pdf-lib';

/** Check parsed objects, including objects inside compressed /ObjStm streams.
 * Self-contained: its compiled function is embedded in the bounded parser worker.
 * Do not call getPages()/normalize(), which can repair the structure being checked.
 */
export async function validatePdfStructure(
  bytes: Uint8Array,
  parser: typeof import('pdf-lib'),
): Promise<number> {
  const { PDFDocument, PDFArray, PDFDict, PDFName, PDFNull, PDFNumber, PDFRef, PDFStream } = parser;
  const document = await PDFDocument.load(bytes, {
    throwOnInvalidObject: true, updateMetadata: false, ignoreEncryption: true,
  });
  const resolve = (object: PDFObject | undefined) => {
    const value = document.context.lookup(object);
    if (object instanceof PDFRef && value === undefined) throw new Error('Missing PDF object');
    return value;
  };
  const entry = (dict: PDFDict, key: string) => resolve(dict.get(PDFName.of(key), true));
  const root = entry(document.catalog, 'Pages');
  if (!(root instanceof PDFDict) || entry(root, 'Type') !== PDFName.of('Pages')) {
    throw new Error('Invalid page tree root');
  }

  type Frame = { node: PDFObject | undefined; parent?: PDFDict; finish?: boolean };
  const stack: Frame[] = [{ node: root }];
  const seen = new Set<PDFDict>();
  const counts = new Map<PDFDict, number>();
  while (stack.length) {
    const { node: object, parent, finish } = stack.pop()!;
    const node = resolve(object);
    if (!(node instanceof PDFDict)) throw new Error('Invalid page tree node');
    if (finish) {
      const kids = entry(node, 'Kids');
      if (!(kids instanceof PDFArray)) throw new Error('Invalid page tree Kids');
      let actual = 0;
      for (let index = 0; index < kids.size(); index++) {
        actual += counts.get(resolve(kids.get(index)) as PDFDict)!;
      }
      const declared = entry(node, 'Count');
      if (!(declared instanceof PDFNumber) || !Number.isSafeInteger(declared.asNumber()) ||
          declared.asNumber() !== actual) throw new Error('Incorrect page tree count');
      counts.set(node, actual);
      continue;
    }
    if (seen.has(node)) throw new Error('Cyclic or repeated page tree node');
    seen.add(node);
    if (parent && entry(node, 'Parent') !== parent) throw new Error('Incorrect page parent');
    const type = entry(node, 'Type');
    if (type === PDFName.of('Page')) {
      const contents = entry(node, 'Contents');
      if (contents !== undefined && contents !== PDFNull) {
        if (contents instanceof PDFArray) {
          for (let index = 0; index < contents.size(); index++) {
            if (!(resolve(contents.get(index)) instanceof PDFStream)) {
              throw new Error('Non-stream page Contents member');
            }
          }
        } else if (!(contents instanceof PDFStream)) {
          throw new Error('Non-stream page Contents');
        }
      }
      counts.set(node, 1);
    } else if (type === PDFName.of('Pages')) {
      const kids = entry(node, 'Kids');
      if (!(kids instanceof PDFArray)) throw new Error('Invalid page tree Kids');
      stack.push({ node, finish: true });
      for (let index = kids.size() - 1; index >= 0; index--) {
        const kid = kids.get(index);
        if (!(kid instanceof PDFRef)) throw new Error('Non-reference page tree kid');
        stack.push({ node: kid, parent: node });
      }
    } else {
      throw new Error('Invalid page tree type');
    }
  }
  const count = counts.get(root)!;
  if (count < 1) throw new Error('No pages');
  return count;
}
