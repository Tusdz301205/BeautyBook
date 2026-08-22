import {
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

export interface EncryptedValue {
  valueCiphertext: string;
  encryptionIv: string;
  authenticationTag: string;
  keyVersion: string;
}

@Injectable()
export class SensitiveDataCipherService {
  constructor(private readonly config: ConfigService) {}

  encrypt(value: unknown, maxBytes = 16 * 1024): EncryptedValue {
    const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
    if (plaintext.length > maxBytes) {
      throw new PayloadTooLargeException(
        `Dữ liệu nhạy cảm vượt giới hạn ${maxBytes} bytes`,
      );
    }
    const key = this.key();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    return {
      valueCiphertext: ciphertext.toString('base64'),
      encryptionIv: iv.toString('base64'),
      authenticationTag: cipher.getAuthTag().toString('base64'),
      keyVersion:
        this.config.get<string>('SENSITIVE_DATA_KEY_VERSION') ?? 'v1',
    };
  }

  decrypt<T>(value: EncryptedValue): T {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key(value.keyVersion),
      Buffer.from(value.encryptionIv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(value.authenticationTag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(value.valueCiphertext, 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString('utf8')) as T;
  }

  private key(requestedVersion?: string): Buffer {
    const activeVersion =
      this.config.get<string>('SENSITIVE_DATA_KEY_VERSION') ?? 'v1';
    if (requestedVersion && requestedVersion !== activeVersion) {
      throw new ServiceUnavailableException(
        `Không có khóa giải mã cho key version ${requestedVersion}`,
      );
    }
    const encoded = this.config.get<string>('SENSITIVE_DATA_ENCRYPTION_KEY');
    const key = encoded ? Buffer.from(encoded, 'base64') : Buffer.alloc(0);
    if (key.length !== 32) {
      throw new ServiceUnavailableException(
        'SENSITIVE_DATA_ENCRYPTION_KEY phải là khóa base64 32 bytes',
      );
    }
    return key;
  }
}
