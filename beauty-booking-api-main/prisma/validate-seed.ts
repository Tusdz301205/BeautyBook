import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PERMISSION_CODE_SET } from "../src/common/permissions/permission-catalog";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type Finding = { check: string; count: number; severity: "ERROR" | "WARNING"; sample?: string };
const findings: Finding[] = [];
const add = (check: string, count: number, severity: Finding["severity"] = "ERROR", sample?: string) => findings.push({ check, count, severity, sample });
const minutes = (value: Date) => value.getUTCHours() * 60 + value.getUTCMinutes();

async function main() {
  const [bookingServices, workingHours, staffSkills, invalidReviews, payments, refunds, invalidBranches, permissions] = await Promise.all([
    prisma.bookingService.findMany({
      where: { booking: { deletedAt: null, status: { notIn: ["CANCELLED", "REJECTED", "EXPIRED"] } } },
      select: { id: true, staffId: true, serviceId: true, durationMinutes: true, booking: { select: { id: true, bookingCode: true, branchId: true, appointmentDate: true, appointmentStartTime: true, appointmentEndTime: true, createdAt: true } } },
    }),
    prisma.branchWorkingHour.findMany(),
    prisma.staffService.findMany({ select: { staffId: true, serviceId: true } }),
    prisma.review.count({ where: { booking: { status: { not: "COMPLETED" } } } }),
    prisma.payment.findMany({ select: { id: true, amount: true } }),
    prisma.refundRequest.findMany({ select: { id: true, amount: true, payment: { select: { amount: true } } } }),
    prisma.branch.count({ where: { status: "ACTIVE", business: { status: { notIn: ["ACTIVE", "APPROVED"] } } } }),
    prisma.permission.findMany({ select: { code: true } }),
  ]);

  const skillSet = new Set(staffSkills.map((row) => `${row.staffId}:${row.serviceId}`));
  const skillMismatch = bookingServices.filter((row) => row.staffId && !skillSet.has(`${row.staffId}:${row.serviceId}`));
  add("Booking có nhân viên thiếu kỹ năng dịch vụ", skillMismatch.length, "ERROR", skillMismatch[0]?.booking.bookingCode);

  const hourMap = new Map(workingHours.map((row) => [`${row.branchId}:${row.dayOfWeek}`, row]));
  const outsideHours = bookingServices.filter((row) => {
    const day = row.booking.appointmentDate.getUTCDay();
    const hours = hourMap.get(`${row.booking.branchId}:${day}`);
    return !hours || hours.isClosed || minutes(row.booking.appointmentStartTime) < minutes(hours.openTime) || minutes(row.booking.appointmentEndTime) > minutes(hours.closeTime);
  });
  add("Booking ngoài giờ mở cửa chi nhánh", outsideHours.length, "ERROR", outsideHours[0]?.booking.bookingCode);

  const grouped = new Map<string, typeof bookingServices>();
  for (const row of bookingServices) {
    if (!row.staffId) continue;
    const key = `${row.staffId}:${row.booking.appointmentDate.toISOString().slice(0, 10)}`;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  let overlaps = 0;
  let overlapSample: string | undefined;
  for (const list of grouped.values()) {
    list.sort((a, b) => minutes(a.booking.appointmentStartTime) - minutes(b.booking.appointmentStartTime));
    for (let i = 1; i < list.length; i++) {
      if (minutes(list[i].booking.appointmentStartTime) < minutes(list[i - 1].booking.appointmentEndTime)) {
        overlaps++;
        overlapSample ??= `${list[i - 1].booking.bookingCode}/${list[i].booking.bookingCode}`;
      }
    }
  }
  add("Booking trùng ca cùng nhân viên", overlaps, "ERROR", overlapSample);
  add("Review gắn booking chưa hoàn thành", invalidReviews);
  add("Payment có số tiền âm", payments.filter((row) => Number(row.amount) < 0).length);
  add("Refund vượt số tiền payment", refunds.filter((row) => Number(row.amount) > Number(row.payment.amount) || Number(row.amount) < 0).length);
  add("Branch ACTIVE thuộc business chưa được duyệt/active", invalidBranches);
  const unknownPermissions = permissions.filter((row) => !PERMISSION_CODE_SET.has(row.code));
  const missingPermissions = [...PERMISSION_CODE_SET].filter((code) => !permissions.some((row) => row.code === code));
  add("Permission không tồn tại trong catalog", unknownPermissions.length, "ERROR", unknownPermissions[0]?.code);
  add("Permission catalog chưa được seed", missingPermissions.length, "ERROR", missingPermissions[0]);

  const counts = {
    users: await prisma.user.count(), businesses: await prisma.business.count(), branches: await prisma.branch.count(),
    staff: await prisma.staffProfile.count(), customers: await prisma.customerProfile.count(), services: await prisma.branchServiceOffering.count(),
    bookings: await prisma.booking.count(), payments: payments.length, reviews: await prisma.review.count(),
    notifications: await prisma.notification.count(), auditLogs: await prisma.auditLog.count(),
  };
  console.table(counts);
  console.table(findings);
  const errors = findings.filter((finding) => finding.severity === "ERROR" && finding.count > 0);
  if (errors.length) throw new Error(`Seed validation thất bại: ${errors.length} kiểm tra có lỗi.`);
  console.log("Seed validation PASS: các bất biến dữ liệu quan trọng đều hợp lệ.");
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
