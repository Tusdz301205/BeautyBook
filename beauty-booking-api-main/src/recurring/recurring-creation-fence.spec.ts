import { reserveRecurringOccurrence } from './recurring-creation-fence';

describe('Recurring occurrence transaction fence', () => {
  it('atomically checks ownership, branch and creation state and records progress', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    await reserveRecurringOccurrence({ recurringBookingPlan: { updateMany } } as never, 'plan', 'customer', 'branch');
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'plan', customerId: 'customer', branchId: 'branch', status: 'CREATING', deletedAt: null },
      data: { updatedAt: expect.any(Date), createdOccurrenceCount: { increment: 1 } },
    });
  });
  it('rejects a recovered, cancelled, deleted or differently scoped plan', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    await expect(reserveRecurringOccurrence({ recurringBookingPlan: { updateMany } } as never, 'plan', 'customer', 'branch')).rejects.toThrow('đã dừng tạo');
  });
  it('does not drop the ownership filter for a missing customer', async () => {
    const updateMany = jest.fn();
    await expect(reserveRecurringOccurrence({ recurringBookingPlan: { updateMany } } as never, 'plan', undefined, 'branch')).rejects.toThrow('khách hàng');
    expect(updateMany).not.toHaveBeenCalled();
  });
});
