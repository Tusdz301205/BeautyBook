import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { assertCustomerPrincipal } from '../auth/account-separation';

@Injectable()
export class SavedServicesService {
  constructor(private readonly prisma: PrismaService) {}

  private async customerId(user: AuthUser): Promise<string> {
    assertCustomerPrincipal(user);
    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!customer) throw new BadRequestException('Tài khoản chưa có hồ sơ khách hàng');
    return customer.id;
  }

  async list(user: AuthUser) {
    const customerId = await this.customerId(user);
    const saved = await this.prisma.customerSavedService.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    const offerings = await this.prisma.branchServiceOffering.findMany({
      where: { id: { in: saved.map((item) => item.branchServiceOfferingId) } },
      include: {
        branch: { include: { business: { select: { id: true, name: true, status: true, bookingRestrictedAt: true, deletedAt: true } } } },
        category: true,
        businessService: true,
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });
    const byId = new Map(offerings.map((offering) => [offering.id, offering]));
    return saved.map((item) => {
      const offering = byId.get(item.branchServiceOfferingId);
      return {
        ...item,
        offering: offering ?? null,
        available: !!offering
          && offering.deletedAt === null
          && offering.status === 'ACTIVE'
          && offering.bookable
          && offering.branch.deletedAt === null
          && offering.branch.status === 'ACTIVE'
          && offering.branch.reviewStatus === 'APPROVED'
          && offering.branch.operationalStatus === 'ACTIVE'
          && offering.branch.business.deletedAt === null
          && ['APPROVED', 'ACTIVE'].includes(offering.branch.business.status)
          && offering.branch.business.bookingRestrictedAt === null,
      };
    });
  }

  async save(user: AuthUser, offeringId: string) {
    const customerId = await this.customerId(user);
    const offering = await this.prisma.branchServiceOffering.findFirst({
      where: {
        id: offeringId,
        deletedAt: null,
        status: 'ACTIVE',
        bookable: true,
        branch: {
          deletedAt: null,
          status: 'ACTIVE',
          reviewStatus: 'APPROVED',
          operationalStatus: 'ACTIVE',
          business: { deletedAt: null, status: { in: ['APPROVED', 'ACTIVE'] }, bookingRestrictedAt: null },
        },
      },
      select: { id: true },
    });
    if (!offering) throw new NotFoundException('Dịch vụ không còn khả dụng để lưu');
    return this.prisma.customerSavedService.upsert({
      where: { customerId_branchServiceOfferingId: { customerId, branchServiceOfferingId: offeringId } },
      update: {},
      create: { customerId, branchServiceOfferingId: offeringId },
    });
  }

  async remove(user: AuthUser, offeringId: string) {
    const customerId = await this.customerId(user);
    await this.prisma.customerSavedService.deleteMany({
      where: { customerId, branchServiceOfferingId: offeringId },
    });
    return { removed: true };
  }
}
