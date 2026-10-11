import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export const MAX_IMAGE_PIXELS = 40_000_000;
export const MAX_IMAGE_SIDE = 10_000;

/** Magic bytes alone do not prove that an image can be displayed. */
export async function validateImageContent(buffer: Buffer): Promise<void> {
  try {
    const image = sharp(buffer, { failOn: 'warning', limitInputPixels: MAX_IMAGE_PIXELS });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width > MAX_IMAGE_SIDE ||
        metadata.height > MAX_IMAGE_SIDE || metadata.width * metadata.height > MAX_IMAGE_PIXELS ||
        (metadata.pages ?? 1) > 1) {
      throw new Error('Image dimensions or frames exceed the supported limits');
    }
    // stats decodes the entire image; metadata() by itself accepts truncated payloads.
    await image.stats();
  } catch {
    throw new BadRequestException('Ảnh bị hỏng, không giải mã được hoặc vượt giới hạn 40 triệu pixel / 10.000 pixel mỗi cạnh. Chỉ hỗ trợ ảnh tĩnh.');
  }
}
