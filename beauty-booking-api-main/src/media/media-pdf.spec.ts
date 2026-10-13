import { ForbiddenException } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import { MediaService } from './media.service';
import * as pdf from './pdf-content';
import { blankPdf, encryptedPdf, malformedContentPdf, malformedLaterPagePdf, malformedPagePdf, malformedXrefPdf, zeroPagePdf } from './pdf-test-fixtures';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { compressedObjectsPdf, nonStreamContentsPdf, undercountedLaterPagePdf } from './pdf-test-fixtures';

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));
const user = { id: 'admin', roles: ['PLATFORM_ADMIN'], scopes: [] } as unknown as AuthUser;
const input = { entityType: 'LEGAL_DOCUMENT' as const, entityId: 'business' };
const file = (buffer: Buffer) => ({ buffer, size: buffer.length, originalname: 'legal.pdf', mimetype: 'application/pdf' });

describe('MediaService PDF validation before writes', () => {
  const setup = () => {
    const prisma = {
      business: { findFirst: jest.fn().mockResolvedValue({ id: 'business' }) },
      $transaction: jest.fn().mockRejectedValue(new Error('write boundary reached')),
    };
    return { prisma, service: new MediaService(prisma as never, { get: () => undefined } as never) };
  };
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());
  it.each([
    () => Buffer.from('%PDF-1.4\n'), malformedPagePdf, malformedContentPdf, encryptedPdf, zeroPagePdf,
    () => blankPdf().subarray(0, -15),
    malformedLaterPagePdf, malformedXrefPdf,
    undercountedLaterPagePdf,
    () => nonStreamContentsPdf('(not a stream)'),
    () => nonStreamContentsPdf('<< /Length 0 >>'),
  ])('rejects unreadable real bytes without mkdir, file or DB writes', async fixture => {
    const { service, prisma } = setup();
    await expect(service.upload(user, file(fixture()), input)).rejects.toMatchObject({ status: 400 });
    expect(prisma.business.findFirst).toHaveBeenCalled();
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each([undercountedLaterPagePdf,
    () => nonStreamContentsPdf('(not a stream)'),
    () => nonStreamContentsPdf('<< /Length 0 >>'),
  ])('rejects compressed malformed structure before writes', async fixture => {
    const { service, prisma } = setup();
    const bytes = await compressedObjectsPdf(fixture());
    await expect(service.upload(user, file(bytes), input)).rejects.toMatchObject({ status: 400 });
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('reports worker construction failure as 503 before writes', async () => {
    const workers = require('node:worker_threads') as typeof import('node:worker_threads');
    jest.spyOn(workers, 'Worker').mockImplementationOnce(() => {
      throw new Error('synthetic worker startup failure');
    });
    const { service, prisma } = setup();
    await expect(service.upload(user, file(blankPdf()), input)).rejects.toMatchObject({ status: 503 });
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('authorizes before starting PDF parsing', async () => {
    const { service, prisma } = setup();
    prisma.business.findFirst.mockRejectedValueOnce(new ForbiddenException());
    const parse = jest.spyOn(pdf, 'validatePdfContent');
    await expect(service.upload(user, file(blankPdf()), input)).rejects.toBeInstanceOf(ForbiddenException);
    expect(parse).not.toHaveBeenCalled();
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('preserves original PDF bytes and existing rollback after successful parsing', async () => {
    const { service, prisma } = setup();
    const bytes = blankPdf();
    await expect(service.upload(user, file(bytes), input)).rejects.toThrow('write boundary reached');
    expect(fs.writeFile).toHaveBeenCalledWith(expect.any(String), bytes, { flag: 'wx' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(fs.unlink).toHaveBeenCalledTimes(1);
  });
});
