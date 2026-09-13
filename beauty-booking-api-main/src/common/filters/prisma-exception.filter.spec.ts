import { HttpStatus } from '@nestjs/common';
import { mapKnownPrismaError } from './prisma-exception.filter';

describe('mapKnownPrismaError', () => {
  it.each([
    ['P2002', HttpStatus.CONFLICT, 'RESOURCE_CONFLICT'],
    ['P2003', HttpStatus.CONFLICT, 'RESOURCE_IN_USE'],
    ['P2025', HttpStatus.NOT_FOUND, 'RESOURCE_NOT_FOUND'],
    ['P2034', HttpStatus.CONFLICT, 'CONCURRENT_UPDATE'],
    ['P2024', HttpStatus.SERVICE_UNAVAILABLE, 'DATABASE_BUSY'],
    ['P2021', HttpStatus.SERVICE_UNAVAILABLE, 'DATABASE_SCHEMA_UNAVAILABLE'],
    ['P2022', HttpStatus.SERVICE_UNAVAILABLE, 'DATABASE_SCHEMA_UNAVAILABLE'],
  ])('maps %s to a safe HTTP response', (code, status, publicCode) => {
    const result = mapKnownPrismaError(code);
    expect(result.statusCode).toBe(status);
    expect(result.code).toBe(publicCode);
    expect(result.message).not.toMatch(/prisma|column|table|constraint/i);
  });

  it('does not expose unknown database failures', () => {
    const result = mapKnownPrismaError('P9999');
    expect(result.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(result.code).toBe('DATABASE_ERROR');
    expect(result.message).not.toContain('P9999');
  });
});
