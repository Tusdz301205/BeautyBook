import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { FinanceService } from './finance.service';

function prismaForInvoiceRequest(booking: any) {
  const prisma: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(async (operation: (tx: any) => unknown) => operation(prisma)),
    invoiceInformationRequest: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => ({ id: 'request-1', status: 'PENDING', ...data })),
    },
    booking: { findUnique: jest.fn().mockResolvedValue(booking) },
    invoice: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  return prisma;
}

const paidBooking = {
  id: 'booking-1', customerId: 'customer-1', status: 'COMPLETED', finalAmount: 300_000, totalAmount: 300_000,
  branch: { id: 'branch-1', businessId: 'business-1' },
  paymentTransactions: [{ status: 'VERIFIED', amount: 300_000 }],
  payments: [], invoiceRequests: [],
};

describe('FinanceService invoice information request', () => {
  it('creates one auditable request only after the booking is fully collected', async () => {
    const prisma = prismaForInvoiceRequest(paidBooking);
    const result = await new FinanceService(prisma as PrismaService).requestInvoiceInformation('customer-1', {
      bookingId: 'booking-1', buyerName: 'Công ty A', buyerTaxCode: '0312345678', idempotencyKey: 'request-key-1',
    });
    expect(result).toEqual(expect.objectContaining({ status: 'PENDING', bookingId: 'booking-1', customerId: 'customer-1' }));
    expect(prisma.invoiceInformationRequest.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      businessId: 'business-1', branchId: 'branch-1', openKey: 'booking-1', idempotencyKey: 'request-key-1',
    }) });
  });

  it('returns the same record for an idempotent retry', async () => {
    const prisma = prismaForInvoiceRequest(paidBooking);
    prisma.invoiceInformationRequest.findUnique.mockResolvedValue({ id: 'request-existing', customerId: 'customer-1' });
    const result = await new FinanceService(prisma as PrismaService).requestInvoiceInformation('customer-1', {
      bookingId: 'booking-1', buyerName: 'Công ty A', idempotencyKey: 'request-key-1',
    });
    expect(result.id).toBe('request-existing');
    expect(prisma.invoiceInformationRequest.create).not.toHaveBeenCalled();
  });

  it('blocks cross-customer access even when a booking id is known', async () => {
    const prisma = prismaForInvoiceRequest(paidBooking);
    await expect(new FinanceService(prisma as PrismaService).requestInvoiceInformation('customer-2', {
      bookingId: 'booking-1', buyerName: 'Người mua', idempotencyKey: 'request-key-2',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.invoiceInformationRequest.create).not.toHaveBeenCalled();
  });

  it('does not treat a partial payment as invoice-eligible', async () => {
    const prisma = prismaForInvoiceRequest({ ...paidBooking, paymentTransactions: [{ status: 'VERIFIED', amount: 100_000 }] });
    await expect(new FinanceService(prisma as PrismaService).requestInvoiceInformation('customer-1', {
      bookingId: 'booking-1', buyerName: 'Người mua', idempotencyKey: 'request-key-3',
    })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.invoiceInformationRequest.create).not.toHaveBeenCalled();
  });
});
