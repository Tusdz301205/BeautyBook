import type { PrismaService } from '../prisma/prisma.service';
import { ImpactService } from './impact.service';

describe('ImpactService scoped listing', () => {
  it('does not expose business-wide or sibling-branch cases to a branch manager', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { operationalImpactCase: { findMany } } as unknown as PrismaService;
    const service = new ImpactService(prisma, {} as never, {} as never, {} as never);

    await service.list(['business-1'], ['branch-1']);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        businessId: { in: ['business-1'] },
        branchId: { in: ['branch-1'] },
      },
    }));
  });
});
