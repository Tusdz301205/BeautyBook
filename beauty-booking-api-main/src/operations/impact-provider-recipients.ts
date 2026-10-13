import type { Prisma } from '@prisma/client';

/** Resolve current provider access in the same transaction as the notice intent. */
export async function impactProviderRecipientIds(
  tx: Prisma.TransactionClient,
  businessId: string,
  staffIds: string[],
): Promise<string[]> {
  if (!staffIds.length) return [];
  const profiles = await tx.staffProfile.findMany({
    where: {
      id: { in: [...new Set(staffIds)] },
      status: 'ACTIVE',
      deletedAt: null,
      branch: { businessId },
      user: { is: { isActive: true, deletedAt: null } },
    },
    select: { userId: true, branchId: true },
  });
  const linked = profiles.filter((profile): profile is typeof profile & { userId: string } => Boolean(profile.userId));
  if (!linked.length) return [];
  const grants = await tx.userRole.findMany({
    where: {
      businessId,
      user: { isActive: true, deletedAt: null },
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        { OR: [
          ...linked.map((profile) => ({
            userId: profile.userId,
            branchId: profile.branchId,
            role: { code: 'STAFF' as const },
          })),
          {
            userId: { in: linked.map((profile) => profile.userId) },
            branchId: null,
            role: { code: 'BUSINESS_OWNER' as const },
          },
        ] },
      ],
    },
    select: { userId: true },
  });
  return [...new Set(grants.map((grant) => grant.userId))];
}
