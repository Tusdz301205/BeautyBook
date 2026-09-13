import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { auditLog } from '../common/utils/audit';
import { UpdateCancellationPolicyDto } from './dto/cancellation-policy.dto';

const EDITABLE_POLICY_FIELDS = new Set(['freeCancelHours', 'rescheduleAllowedHours', 'notes']);

@Injectable()
export class CancellationPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fee columns remain in the database solely for historical compatibility.
   * Do not expose them through the active policy API now that cancellation and
   * no-show fees are retired.
   */
  private activePolicy(policy: any) {
    const { lateCancelFeePercent: _lateFee, noShowFeePercent: _noShowFee, ...active } = policy;
    return active;
  }

  private validateUpdate(params: UpdateCancellationPolicyDto) {
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      throw new BadRequestException('Chính sách hủy/đổi lịch phải là một đối tượng');
    }
    if (Object.keys(params).some((key) => !EDITABLE_POLICY_FIELDS.has(key))) {
      throw new BadRequestException('Chính sách hủy/đổi lịch chứa trường không được phép cập nhật');
    }

    const validated = plainToInstance(UpdateCancellationPolicyDto, params);
    const errors = validateSync(validated, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length) {
      throw new BadRequestException(errors.flatMap((error) => Object.values(error.constraints ?? {})));
    }

    // Never pass client objects or Prisma mutation operators into an upsert.
    return {
      ...(validated.freeCancelHours !== undefined ? { freeCancelHours: validated.freeCancelHours } : {}),
      ...(validated.rescheduleAllowedHours !== undefined ? { rescheduleAllowedHours: validated.rescheduleAllowedHours } : {}),
      ...(validated.notes !== undefined ? { notes: validated.notes } : {}),
    };
  }

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
    return this.activePolicy(policy);
  }

  /**
   * Cập nhật policy — chỉ OWNER mới được.
   */
  async update(businessId: string, updatedBy: string, params: UpdateCancellationPolicyDto) {
    const data = this.validateUpdate(params);
    const before = await this.prisma.cancellationPolicy.findUnique({ where: { businessId } });
    const after = await this.prisma.cancellationPolicy.upsert({
      where: { businessId },
      create: { businessId, ...data },
      update: data,
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
    return this.activePolicy(after);
  }
}
