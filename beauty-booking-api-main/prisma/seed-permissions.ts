/**
 * Seed permissions + role permissions idempotently.
 *
 * Usage: `npx tsx prisma/seed-permissions.ts`
 *
 * Inserts/updates:
 *   - All `permissions` rows defined in `permission-catalog.ts`
 *   - All system `roles` rows (one per role code)
 *   - All `role_permissions` rows from `ROLE_PERMISSIONS`
 *
 * Safe to run multiple times — uses `upsert` and skips inserts that
 * already exist with the same code.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_LEVELS,
} from '../src/common/permissions/permission-catalog';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const ROLE_NAMES: Record<string, string> = {
  PLATFORM_ADMIN: 'Quản trị nền tảng',
  BUSINESS_OWNER: 'Chủ Salon',
  BRANCH_MANAGER: 'Quản lý chi nhánh',
  RECEPTIONIST: 'Lễ tân',
  STAFF: 'Nhân viên / Thợ',
  CUSTOMER: 'Khách hàng',
  GUEST: 'Khách vãng lai',
};

const OFFICIAL_ROLE_CODES = new Set([
  'PLATFORM_ADMIN',
  'BUSINESS_OWNER',
  'BRANCH_MANAGER',
  'RECEPTIONIST',
  'STAFF',
  'CUSTOMER',
  'GUEST',
]);

async function main(): Promise<void> {
  console.log('[seed-permissions] begin');

  // --- permissions ---
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
      },
      create: {
        code: perm.code,
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
        scope: (perm.defaultScope as unknown) as any,
      },
    });
  }
  console.log(`[seed-permissions] ${PERMISSIONS.length} permissions upserted`);

  // --- roles ---
  const officialRoles = Object.entries(ROLE_LEVELS).filter(([code]) =>
    OFFICIAL_ROLE_CODES.has(code),
  );
  for (const [code, level] of officialRoles) {
    await prisma.role.upsert({
      where: { code: code as any },
      update: {
        name: ROLE_NAMES[code] ?? code,
        level: (level as unknown) as any,
      },
      create: {
        code: code as any,
        name: ROLE_NAMES[code] ?? code,
        level: (level as unknown) as any,
      },
    });
  }
  console.log(`[seed-permissions] ${officialRoles.length} official roles upserted`);

  // --- role_permissions ---
  const allPermissions = await prisma.permission.findMany();
  const permIdByCode = new Map(allPermissions.map((p) => [p.code, p.id]));

  let rpInserted = 0;
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUnique({ where: { code: roleCode as any } });
    if (!role) {
      console.warn(`[seed-permissions] role ${roleCode} missing; skipping`);
      continue;
    }
    for (const code of permCodes) {
      const permissionId = permIdByCode.get(code);
      if (!permissionId) {
        console.warn(`[seed-permissions] permission ${code} missing; skipping`);
        continue;
      }
      try {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId } },
          update: {},
          create: { roleId: role.id, permissionId },
        });
        rpInserted += 1;
      } catch (err) {
        // Composite primary key collision is acceptable.
        if (!(err as Error).message?.includes('Unique constraint')) {
          throw err;
        }
      }
    }
  }
  console.log(`[seed-permissions] ${rpInserted} role-permissions upserted`);
  console.log('[seed-permissions] done');
}

main()
  .catch((err) => {
    console.error('[seed-permissions] failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
