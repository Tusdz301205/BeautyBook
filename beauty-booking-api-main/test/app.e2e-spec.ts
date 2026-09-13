import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { TokenBlacklistService } from './../src/auth/token-blacklist.service';

describe('AppController HTTP smoke (stubbed database)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      // Empty queues let real startup hooks run without accessing a live DB.
      // This smoke suite does not replace PostgreSQL/worker integration tests.
      .useValue({
        $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
        business: { findMany: jest.fn().mockResolvedValue([]) },
        appointmentChangeRequest: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        notificationOutbox: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([]),
        },
        operationalImpactCase: { findMany: jest.fn().mockResolvedValue([]) },
        recurringBookingPlan: { findMany: jest.fn().mockResolvedValue([]) },
      } satisfies Partial<Record<keyof PrismaService, unknown>>)
      .overrideProvider(TokenBlacklistService)
      .useValue({ isRevoked: jest.fn().mockResolvedValue(false), revokeAllForUser: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('/api/v1 (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('Hello World!');
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ status: 'ok', database: 'up' });
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
