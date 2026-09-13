import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { BookingsModule } from './bookings/bookings.module';
import { ReportsModule } from './reports/reports.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BranchesModule } from './branches/branches.module';
import { ServicesModule } from './services/services.module';
import { MailModule } from './mail/mail.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PolicyGuard } from './common/guards/policy.guard';
import { ScopeGuard } from './common/guards/scope.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { BusinessModule } from './business/business.module';
import { AdminModule } from './admin/admin.module';
import { StaffModule } from './staff/staff.module';
import { PromotionsModule } from './promotions/promotions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PaymentsModule } from './payments/payments.module';
import { HealthController } from './health.controller';
import { UserAwareThrottlerGuard } from './common/guards/user-aware-throttler.guard';
import { PlatformSettingsModule } from './platform-settings/platform-settings.module';
import { MediaModule } from './media/media.module';
import { CombosModule } from './combos/combos.module';
import { RecurringModule } from './recurring/recurring.module';
import { PrivacyModule } from './privacy/privacy.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { FinanceModule } from './finance/finance.module';
import { OperationsModule } from './operations/operations.module';
import { OwnershipModule } from './ownership/ownership.module';
import { SavedServicesModule } from './saved-services/saved-services.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    // API Rule: rate limit 100 requests / phút / user
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    PlatformSettingsModule,
    AuthModule,
    UsersModule,
    BranchesModule,
    ServicesModule,
    BookingsModule,
    ReportsModule,
    MailModule,
    SchedulerModule,
    BusinessModule,
    AdminModule,
    StaffModule,
    PromotionsModule,
    NotificationsModule,
    ReviewsModule,
    PaymentsModule,
    MediaModule,
    CombosModule,
    RecurringModule,
    PrivacyModule,
    LoyaltyModule,
    FinanceModule,
    OperationsModule,
    OwnershipModule,
    SavedServicesModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    // Apply JWT auth + RBAC + Scope + Policy guards globally;
    // individual routes opt out via @Public(). Resource-level checks still
    // happen in services via canOnResource(...) for ownership / branch scope.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: UserAwareThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ScopeGuard },
    { provide: APP_GUARD, useClass: PolicyGuard },
    // AuditInterceptor fires for routes carrying the @Audited(...) meta.
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    // Redis-backed idempotency for duplicate-sensitive booking/payment writes.
    // Authentication responses are excluded so tokens are never cached.
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule { }
