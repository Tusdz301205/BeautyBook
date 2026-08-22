import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
async function main() {
  let role = await prisma.role.findUnique({ where: { code: 'RECEPTIONIST' } });
  if (!role) {
    role = await prisma.role.create({
      data: { code: 'RECEPTIONIST', name: 'Lễ tân', level: 'BRANCH' }
    });
    console.log('Tạo Role RECEPTIONIST thành công.');
  }

  const existing = await prisma.user.findFirst({
    where: { email: 'letan@glowbook.vn' }
  });
  if (existing) {
    console.log('Tài khoản đã tồn tại: letan@glowbook.vn / Password123!');
    return;
  }

  const passwordHash = await bcrypt.hash('Password123!', 12);
  const branch = await prisma.branch.findFirst();

  if (!branch) {
    console.log('Không tìm thấy chi nhánh nào để gán cho lễ tân.');
    return;
  }

  const user = await prisma.user.create({
    data: {
      email: 'letan@glowbook.vn',
      phone: '0901234567',
      passwordHash,
      fullName: 'Nguyễn Lễ Tân',
      gender: 'FEMALE',
      isEmailVerified: true,
      isActive: true,
      userRoles: {
        create: {
          roleId: role.id,
          branchId: branch.id,
          businessId: branch.businessId
        }
      },
      staffProfile: {
        create: {
          branchId: branch.id,
          fullName: 'Nguyễn Lễ Tân',
          position: 'Lễ tân',
          status: 'ACTIVE'
        }
      }
    }
  });

  console.log('Tạo tài khoản lễ tân thành công: letan@glowbook.vn / Password123! thuộc chi nhánh: ' + branch.name);
}
main().catch(console.error).finally(() => prisma.$disconnect());
