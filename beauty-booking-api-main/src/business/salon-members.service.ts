import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SalonMembersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liệt kê members của 1 business — chỉ ADMIN hoặc chính member đó mới xem được.
   */
  async listByBusiness(businessId: string) {
    const members = await this.prisma.salonMember.findMany({
      where: { businessId, deletedAt: null },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return members;
  }

  /**
   * Compatibility membership metadata; authorization comes from UserRole.
   */
  async addMember(businessId: string, params: {
    userId: string;
    role: 'OWNER' | 'RECEPTIONIST';
    branchId?: string;
  }) {
    if (!['OWNER', 'RECEPTIONIST'].includes(params.role)) {
      throw new BadRequestException('Vai trò thành viên không còn được hỗ trợ');
    }
    if (params.role === 'RECEPTIONIST' && !params.branchId) {
      throw new BadRequestException('Lễ tân bắt buộc có chi nhánh');
    }
    if (params.branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: params.branchId, businessId, deletedAt: null } });
      if (!branch) throw new BadRequestException('Chi nhánh không thuộc doanh nghiệp');
    }
    return this.prisma.salonMember.upsert({
      where: { userId_businessId: { userId: params.userId, businessId } },
      create: {
        userId: params.userId,
        businessId,
        branchId: params.branchId,
        role: params.role,
      },
      update: {
        role: params.role,
        branchId: params.branchId,
        isActive: true,
      },
    });
  }

  /**
   * Vô hiệu hoá member (không xoá cứng để giữ audit).
   */
  async deactivate(memberId: string) {
    const m = await this.prisma.salonMember.findUnique({ where: { id: memberId } });
    if (!m) throw new NotFoundException('Không tìm thấy member');
    return this.prisma.salonMember.update({
      where: { id: memberId },
      data: { isActive: false, deletedAt: new Date() },
    });
  }
}
