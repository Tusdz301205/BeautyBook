import { Prisma } from '@prisma/client';
export function normalizeNameSearch(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi-VN').trim().replace(/\s+/g, ' ');
}

const accents = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
const marks = Array.from({ length: 112 }, (_, index) => String.fromCharCode(0x300 + index)).join('');
export function nameSearchPattern(value: unknown): string {
  return '%' + normalizeNameSearch(value).replace(/[\\%_]/g, '\\$&') + '%';
}
export function foldNameSql(expression: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`regexp_replace(btrim(translate(lower(${expression}), ${accents + marks}, ${normalizeNameSearch(accents)})), '[[:space:]]+', ' ', 'g')`;
}
