import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { MediaService } from './media.service';
import { validateImageContent } from './image-content';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const user = { id: 'qa-image-user', roles: ['CUSTOMER'] } as AuthUser;
const input = { entityType: 'USER_AVATAR' as const, entityId: user.id };
const valid = () => sharp({ create: { width: 80, height: 60, channels: 3, background: '#ac3f67' } }).png().toBuffer();

describe('upload decoding and local storage lifecycle', () => {
  let directory: string;
  let service: MediaService;
  let prisma: any;
  let rows: Map<string, any>;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'beautybook-storage-test-'));
    rows = new Map();
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: user.id }), update: jest.fn() },
      mediaFile: {
        create: jest.fn(async ({ data }) => {
          const row = { ...data, id: String(rows.size + 1) }; rows.set(row.id, row); return row;
        }),
        update: jest.fn(async ({ where, data }) => { const row = { ...rows.get(where.id), ...data }; rows.set(where.id, row); return row; }),
        findUnique: jest.fn(async ({ where }) => rows.get(where.id)),
      },
      $transaction: jest.fn(async (callback) => callback(prisma)),
    };
    service = new MediaService(prisma, { get: () => directory } as never);
  });
  afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
  const upload = async (buffer: Buffer, size = buffer.length) => service.upload(user,
    { buffer, size, originalname: 'qa.png', mimetype: 'image/png' }, input);
  const files = async () => (await readdir(directory, { recursive: true })).filter(name => String(name).endsWith('.png'));

  it('rejects magic-byte-only PNG before filesystem or DB writes', async () => {
    await expect(upload(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).rejects.toThrow('Ảnh bị hỏng');
    expect(await files()).toEqual([]); expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects truncated PNG even when metadata is readable', async () => {
    const bytes = await valid();
    await expect(upload(bytes.subarray(0, Math.floor(bytes.length * 0.7)))).rejects.toThrow('Ảnh bị hỏng');
    expect(await files()).toEqual([]);
  });
  it.each(['jpeg', 'png', 'webp', 'avif'] as const)('fully decodes a valid %s image', async format => {
    const image = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#ac3f67' } }).toFormat(format).toBuffer();
    await expect(validateImageContent(image)).resolves.toBeUndefined();
  });
  it('rejects excessive pixels and sides without writing anything', async () => {
    const wide = await sharp({ create: { width: 10_001, height: 1, channels: 3, background: 'white' } }).png().toBuffer();
    const huge = await sharp({ create: { width: 6400, height: 6400, channels: 3, background: 'white' } }).png().toBuffer();
    for (const bytes of [wide, huge]) await expect(upload(bytes)).rejects.toThrow('Ảnh bị hỏng');
    expect(prisma.$transaction).not.toHaveBeenCalled(); expect(await files()).toEqual([]);
  });
  it('rejects MIME, extension and byte count mismatch', async () => {
    const bytes = await valid();
    await expect(upload(bytes, bytes.length + 1)).rejects.toThrow('dữ liệu nhận được');
    await expect(service.upload(user, { buffer: bytes, size: bytes.length, originalname: 'qa.jpg', mimetype: 'image/png' }, input)).rejects.toThrow('Phần mở rộng');
    await expect(service.upload(user, { buffer: bytes, size: bytes.length, originalname: 'qa.png', mimetype: 'image/jpeg' }, input)).rejects.toThrow('Nội dung tệp');
    expect(await files()).toEqual([]);
  });
  it('removes only its new file when DB transaction fails', async () => {
    const first = await upload(await valid());
    prisma.$transaction.mockRejectedValueOnce(new Error('synthetic DB failure'));
    await expect(upload(await valid())).rejects.toThrow('synthetic DB failure');
    expect((await files()).length).toBe(1);
    if (!first.storageKey) throw new Error('Stored file must have a storage key');
    expect(await readFile(join(directory, first.storageKey))).toEqual(await valid());
  });
  it('concurrent uploads have unique keys and remain readable from a fresh service instance', async () => {
    const bytes = await valid();
    const results = await Promise.all(Array.from({ length: 6 }, () => upload(bytes)));
    expect(new Set(results.map(result => result.storageKey)).size).toBe(6);
    expect((await files()).length).toBe(6);
    const restarted = new MediaService(prisma, { get: () => directory } as never);
    for (const result of results) expect((await restarted.read(result.id, false)).buffer).toEqual(bytes);
  });
});
