import { Prisma } from '@prisma/client';
import { normalizeNameSearch, nameSearchPattern, foldNameSql } from './name-search';
describe('Vietnamese name search', () => {
  it('normalizes names only and escapes wildcard characters', () => {
    expect(normalizeNameSearch(' ĐỖ  Thị ')).toBe('do thi');
    expect(normalizeNameSearch('Đỗ'.normalize('NFD'))).toBe('do');
    expect(nameSearchPattern('50% _')).toBe('%50\\% \\_%');
  });
  it('uses parameterized SQL without requiring an unaccent extension', () => {
    const query=foldNameSql(Prisma.sql`full_name`);
    expect(query.sql).toContain('translate(lower(full_name)');
    expect(query.values).toContainEqual(expect.stringContaining('đ'));
  });
});
