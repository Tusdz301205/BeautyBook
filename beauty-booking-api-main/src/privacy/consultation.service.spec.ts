import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { ConsultationService } from './consultation.service';
import type { SensitiveDataCipherService } from './sensitive-data-cipher.service';

const CUSTOMER: AuthUser = {
  id: 'customer-user',
  email: 'customer@example.com',
  roles: ['CUSTOMER'],
  scopes: [{ code: 'CUSTOMER' }],
  permissions: ['consultation:submit:self', 'consultation:read:self'],
  sessionType: 'customer',
};

const STAFF: AuthUser = {
  id: 'staff-user',
  email: 'staff@example.com',
  roles: ['STAFF'],
  scopes: [
    { code: 'STAFF', businessId: 'business-1', branchId: 'branch-1' },
  ],
  permissions: ['consultation:read:assigned'],
  sessionType: 'salon',
};

const RECEPTIONIST: AuthUser = {
  id: 'reception-user',
  email: 'reception@example.com',
  roles: ['RECEPTIONIST'],
  scopes: [
    {
      code: 'RECEPTIONIST',
      businessId: 'business-1',
      branchId: 'branch-1',
    },
  ],
  permissions: ['consultation:status:branch'],
  sessionType: 'salon',
};

function submission(
  consentEvents: Array<{
    fieldId: string;
    assignedStaffId: string;
    expiresAt: Date;
    revokedBy: { id: string; createdAt: Date } | null;
  }> = [],
) {
  const now = new Date();
  return {
    id: 'submission-1',
    customerId: 'customer-1',
    businessId: 'business-1',
    branchId: 'branch-1',
    bookingId: 'booking-1',
    serviceId: 'service-1',
    versionId: 'version-1',
    status: 'SUBMITTED',
    requiresReview: true,
    submittedAt: now,
    retentionUntil: new Date(now.getTime() + 86_400_000),
    legalHoldReason: null,
    createdAt: now,
    updatedAt: now,
    customer: { userId: 'customer-user' },
    version: {
      version: 1,
      noticeVersion: 'v1',
      noticeHash: 'a'.repeat(64),
      purpose: 'Customer safety',
    },
    booking: {
      status: 'CONFIRMED',
      appointmentDate: now,
      appointmentStartTime: now,
      appointmentEndTime: new Date(now.getTime() + 3_600_000),
    },
    service: { name: 'Skin care' },
    answers: [
      {
        id: 'answer-1',
        submissionId: 'submission-1',
        fieldId: 'field-1',
        dataCategory: 'ALLERGY',
        valueType: 'TEXT',
        valueCiphertext: 'encrypted',
        encryptionIv: 'iv',
        authenticationTag: 'tag',
        keyVersion: 'v1',
        createdAt: now,
        updatedAt: now,
        field: {
          id: 'field-1',
          fieldKey: 'allergy',
          label: 'Dị ứng',
          fieldType: 'TEXT',
          dataCategory: 'ALLERGY',
        },
      },
    ],
    consentEvents,
  };
}

function readPrisma(
  record: ReturnType<typeof submission>,
  options: { staffId?: string; assigned?: boolean } = {},
) {
  return {
    consultationSubmission: {
      findUnique: jest.fn().mockResolvedValue(record),
    },
    sensitiveDataAccessEvent: {
      create: jest.fn().mockResolvedValue({ id: 'access-1' }),
    },
    staffProfile: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.staffId ? { id: options.staffId } : null,
        ),
    },
    bookingService: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.assigned ? { id: 'booking-service-1' } : null),
    },
  } as unknown as PrismaService;
}

const cipher = {
  encrypt: jest.fn().mockReturnValue({
    valueCiphertext: 'encrypted',
    encryptionIv: 'iv',
    authenticationTag: 'tag',
    keyVersion: 'v1',
  }),
  decrypt: jest.fn().mockReturnValue('latex'),
} as unknown as SensitiveDataCipherService;

describe('ConsultationService sensitive access matrix', () => {
  test('receptionist receives metadata only and the read is audited as redacted', async () => {
    const prisma = readPrisma(submission());
    const result = await new ConsultationService(prisma, cipher).readSubmission(
      'submission-1',
      RECEPTIONIST,
      { purpose: 'CHECK_IN_STATUS' },
    );

    expect(result).toMatchObject({
      contentAccess: 'REDACTED',
      answers: [],
    });
    expect(prisma.sensitiveDataAccessEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ result: 'REDACTED' }),
    });
  });

  test('unassigned staff is denied and the denied attempt is audited', async () => {
    const prisma = readPrisma(submission(), {
      staffId: 'staff-1',
      assigned: false,
    });
    await expect(
      new ConsultationService(prisma, cipher).readSubmission(
        'submission-1',
        STAFF,
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.sensitiveDataAccessEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ result: 'DENIED' }),
    });
  });

  test('assigned staff can read only while the exact field grant is active', async () => {
    const record = submission([
      {
        fieldId: 'field-1',
        assignedStaffId: 'staff-1',
        expiresAt: new Date(Date.now() + 60_000),
        revokedBy: null,
      },
    ]);
    const prisma = readPrisma(record, {
      staffId: 'staff-1',
      assigned: true,
    });
    const result = await new ConsultationService(prisma, cipher).readSubmission(
      'submission-1',
      STAFF,
      {},
    );
    expect(result).toMatchObject({
      contentAccess: 'GRANTED',
      answers: [{ fieldKey: 'allergy', value: 'latex' }],
    });
  });

  test('revoked exact grant does not become active through unrelated consent', async () => {
    const record = submission([
      {
        fieldId: 'field-1',
        assignedStaffId: 'staff-1',
        expiresAt: new Date(Date.now() + 60_000),
        revokedBy: { id: 'revoke-1', createdAt: new Date() },
      },
    ]);
    const prisma = readPrisma(record, {
      staffId: 'staff-1',
      assigned: true,
    });
    await expect(
      new ConsultationService(prisma, cipher).readSubmission(
        'submission-1',
        STAFF,
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('ConsultationService submission context', () => {
  test('stores encrypted answers and booking-scoped grants for assigned staff', async () => {
    const sensitiveAnswerCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const consentEventCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      consultationSubmission: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'submission-1',
          status: 'SUBMITTED',
          requiresReview: true,
          submittedAt: new Date(),
          retentionUntil: new Date(Date.now() + 86_400_000),
        }),
      },
      sensitiveAnswer: { createMany: sensitiveAnswerCreateMany },
      consentEvent: { createMany: consentEventCreateMany },
    };
    const prisma = {
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerId: 'customer-1',
          branchId: 'branch-1',
          status: 'CONFIRMED',
          appointmentDate: new Date(Date.now() + 86_400_000),
          appointmentEndTime: new Date('1970-01-01T10:00:00.000Z'),
          branch: { businessId: 'business-1' },
          bookingServices: [
            {
              serviceId: 'service-1',
              staff: { id: 'staff-1', userId: 'staff-user' },
            },
          ],
        }),
      },
      serviceConsultationRequirement: {
        findUnique: jest.fn().mockResolvedValue({
          template: {
            versions: [
              {
                id: 'version-1',
                noticeVersion: 'v1',
                noticeHash: 'a'.repeat(64),
                purpose: 'Protect customer during the booked service',
                retentionDays: 30,
                fields: [
                  {
                    id: 'field-1',
                    fieldKey: 'allergy',
                    fieldType: 'TEXT',
                    dataCategory: 'ALLERGY',
                    required: true,
                    options: null,
                    maxLength: 200,
                  },
                ],
              },
            ],
          },
        }),
      },
      $transaction: jest.fn(
        (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    } as unknown as PrismaService;

    await new ConsultationService(prisma, cipher).submit(
      'booking-1',
      {
        serviceId: 'service-1',
        noticeHash: 'a'.repeat(64),
        consentAccepted: true,
        answers: [{ fieldKey: 'allergy', value: 'latex' }],
      },
      CUSTOMER,
      { ipAddress: '127.0.0.1' },
    );

    expect(sensitiveAnswerCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          valueCiphertext: 'encrypted',
          fieldId: 'field-1',
        }),
      ],
    });
    expect(
      JSON.stringify(sensitiveAnswerCreateMany.mock.calls[0][0]),
    ).not.toContain('latex');
    expect(consentEventCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          bookingId: 'booking-1',
          serviceId: 'service-1',
          assignedStaffId: 'staff-1',
          recipientId: 'staff-user',
        }),
      ],
    });
  });
});
