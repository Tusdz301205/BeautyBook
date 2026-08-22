import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { auditLog } from '../common/utils/audit';

@Injectable()
export class CancellationPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy policy của salon. Tạo mặc định nếu chưa có.
   */
  async getOrCreate(businessId: string) {
    let policy = await this.prisma.cancellationPolicy.findUnique({
      where: { businessId },
    });
    if (!policy) {
      policy = await this.prisma.cancellationPolicy.create({
        data: { businessId },
      });
    }
    return policy;
  }

  /**
   * Cập nhật policy — chỉ OWNER mới được.
   */
  async update(businessId: string, updatedBy: string, params: {
    freeCancelHours?: number;
    lateCancelFeePercent?: number;
    noShowFeePercent?: number;
    rescheduleAllowedHours?: number;
    notes?: string;
  }) {
    const before = await this.prisma.cancellationPolicy.findUnique({ where: { businessId } });
    const after = await this.prisma.cancellationPolicy.upsert({
      where: { businessId },
      create: { businessId, ...params },
      update: params,
    });
    await auditLog(this.prisma, {
      userId: updatedBy,
      action: 'POLICY_OVERRIDE' as any,
      entityType: 'CancellationPolicy',
      entityId: after.id,
      oldData: before as any,
      newData: after as any,
      reason: 'Cập nhật chính sách huỷ/đổi lịch',
    });
    return after;
  }
}
