import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";
import { PERMISSIONS, ROLE_LEVELS, ROLE_PERMISSIONS } from "../src/common/permissions/permission-catalog";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = "Password123!";

type SeedMode = "small" | "demo" | "realistic";
const requestedMode = (process.env.SEED_SIZE ?? "demo").toLowerCase();
if (!(["small", "demo", "realistic"] as const).includes(requestedMode as SeedMode)) {
  throw new Error(`SEED_SIZE không hợp lệ: ${requestedMode}. Dùng small, demo hoặc realistic.`);
}
const SEED_MODE = requestedMode as SeedMode;
const MODE = {
  small: { businesses: 3, branchesMin: 2, branchesMax: 2, staffPerBranch: 3, customers: 120, bookings: 600, comments: 30, notifications: 120, audits: 100, attendanceDays: 30 },
  demo: { businesses: 8, branchesMin: 3, branchesMax: 3, staffPerBranch: 5, customers: 600, bookings: 4000, comments: 200, notifications: 1200, audits: 1000, attendanceDays: 180 },
  realistic: { businesses: 12, branchesMin: 3, branchesMax: 4, staffPerBranch: 6, customers: 1500, bookings: 10000, comments: 600, notifications: 5000, audits: 20000, attendanceDays: 730 },
} as const;
const seedConfig = MODE[SEED_MODE];
const DAY_MS = 86_400_000;
const SEED_START_DATE = new Date("2024-01-01T00:00:00.000Z");
const parsedEndDate = process.env.SEED_END_DATE ? new Date(`${process.env.SEED_END_DATE}T23:59:59.999Z`) : new Date();
if (Number.isNaN(parsedEndDate.getTime())) throw new Error("SEED_END_DATE phải có dạng YYYY-MM-DD.");
const SEED_END_DATE = parsedEndDate;
const FUTURE_END_DATE = new Date(SEED_END_DATE.getTime() + 60 * DAY_MS);

// ============================================================
// RANDOM HELPERS (seedable)
// ============================================================
let _seed = 20240709;
function rand() {
  // mulberry32
  _seed |= 0;
  _seed = (_seed + 0x6d2b79f5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function randInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function pickN<T>(arr: readonly T[], n: number): T[] {
  const a = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && a.length; i++) {
    out.push(a.splice(Math.floor(rand() * a.length), 1)[0]);
  }
  return out;
}
function chance(p: number) {
  return rand() < p;
}

// ============================================================
// DATA POOLS
// ============================================================
const HO = [
  "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Hồ",
  "Ngô", "Dương", "Lý", "Phan", "Võ", "Trương", "Đinh", "Tô", "Quách", "Mai",
];
const HO_DEM_NAM = [
  "Văn", "Hữu", "Đức", "Minh", "Quang", "Thanh", "Công", "Anh", "Tuấn", "Hoàng",
  "Phúc", "Thành", "Khánh", "Gia", "Kim", "Thiên", "Bảo", "Đăng", "Nhật", "Tiến",
];
const HO_DEM_NU = [
  "Thị", "Ngọc", "Thu", "Phương", "Thanh", "Mai", "Hồng", "Kim", "Bích", "Thùy",
  "Trúc", "Yến", "Diệu", "Khánh", "Gia", "Tuyết", "Hà", "Ánh", "Thư", "Uyên",
];
const TEN_NAM = [
  "An", "Bình", "Cường", "Dũng", "Đạt", "Hùng", "Huy", "Khôi", "Long", "Minh",
  "Nam", "Phong", "Quân", "Sơn", "Tài", "Thành", "Toàn", "Trí", "Tú", "Việt",
  "Anh", "Bảo", "Đức", "Hải", "Hiếu", "Khoa", "Kiên", "Lộc", "Mạnh", "Nhân",
  "Phú", "Quang", "Tâm", "Thiện", "Trung", "Tuấn", "Vinh", "Vũ", "Khang", "Duy",
];
const TEN_NU = [
  "Anh", "Chi", "Diệu", "Duyên", "Hà", "Hân", "Hoa", "Hương", "Lan", "Linh",
  "Mai", "My", "Nga", "Ngân", "Ngọc", "Như", "Phương", "Quyên", "Thảo", "Thư",
  "Thy", "Trang", "Trinh", "Tú", "Tuyết", "Uyên", "Vân", "Yến", "Thanh", "Xuân",
  "An", "Bích", "Châu", "Diễm", "Giang", "Hiền", "Huyền", "Khanh", "Ly", "Nhi",
];

function randomPhone() {
  const prefixes = ["090", "091", "093", "094", "096", "097", "098", "039", "038", "037", "036", "035", "034", "033", "032", "070", "076", "077", "078", "079"];
  return pick(prefixes) + Array.from({ length: 7 }, () => randInt(0, 9)).join("");
}

function randomDob(minAge: number, maxAge: number) {
  const today = SEED_END_DATE;
  const year = today.getUTCFullYear() - randInt(minAge, maxAge);
  const month = randInt(1, 12);
  const day = randInt(1, 28);
  return new Date(Date.UTC(year, month - 1, day));
}

function fullName(gender: "MALE" | "FEMALE") {
  const ho = pick(HO);
  const dem = pick(gender === "MALE" ? HO_DEM_NAM : HO_DEM_NU);
  const ten = pick(gender === "MALE" ? TEN_NAM : TEN_NU);
  const secondTen = chance(0.25) ? " " + pick(gender === "MALE" ? TEN_NU : TEN_NAM) : "";
  return `${ho} ${dem} ${ten}${secondTen}`;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// ============================================================
// TIME RANGE HELPERS
// ============================================================
function randDate(start: Date, end: Date) {
  const ms = start.getTime() + rand() * (end.getTime() - start.getTime());
  return new Date(ms);
}
function appointmentDateWithinRange() {
  // Tăng trưởng theo năm và luôn có lịch tương lai 60 ngày để demo.
  const roll = rand();
  let start = SEED_START_DATE;
  let end = SEED_END_DATE;
  if (roll < 0.18) {
    start = SEED_START_DATE;
    end = new Date("2024-12-31T23:59:59.999Z");
  } else if (roll < 0.50) {
    start = new Date("2025-01-01T00:00:00.000Z");
    end = new Date("2025-12-31T23:59:59.999Z");
  } else if (roll < 0.88) {
    start = new Date("2026-01-01T00:00:00.000Z");
    end = SEED_END_DATE;
  } else {
    start = new Date(SEED_END_DATE.getTime() + DAY_MS);
    end = FUTURE_END_DATE;
  }
  if (end < start) start = SEED_START_DATE;
  const value = randDate(start, end);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function weightedStatus(date: Date, index: number): Prisma.BookingCreateInput["status"] {
  const today = new Date(Date.UTC(SEED_END_DATE.getUTCFullYear(), SEED_END_DATE.getUTCMonth(), SEED_END_DATE.getUTCDate()));
  if (index < 24) return pick(["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "PENDING", "COMPLETED"] as const);
  if (date > today) return pick(["CONFIRMED", "CONFIRMED", "CONFIRMED", "PENDING"] as const);
  const r = rand();
  if (r < 0.70) return "COMPLETED";
  if (r < 0.80) return "CANCELLED";
  if (r < 0.83) return "NO_SHOW";
  if (r < 0.86) return "REJECTED";
  if (r < 0.89) return "EXPIRED";
  return "COMPLETED";
}

function atUtcTime(date: Date, hour: number, minute = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute));
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log(`Bắt đầu seed production-like: mode=${SEED_MODE}, từ 2024-01-01 đến ${SEED_END_DATE.toISOString().slice(0, 10)}...`);

  console.log("Reset dữ liệu demo cũ theo đúng thứ tự quan hệ (Docker volume không bị xóa)...");
  await prisma.attendanceExceptionRequest.deleteMany();
  await prisma.staffAttendance.deleteMany();
  await prisma.reviewReport.deleteMany();
  await prisma.trustAction.deleteMany();
  await prisma.businessReviewEvent.deleteMany();
  await prisma.platformSetting.deleteMany();
  await prisma.bookingHealthRecord.deleteMany();
  await prisma.sensitiveConsent.deleteMany();
  await prisma.appointmentChangeRequest.deleteMany();
  await prisma.customerVoucher.deleteMany();
  await prisma.refundRequest.deleteMany();
  await prisma.staffInvitation.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.accountToken.deleteMany();
  await prisma.specialWorkingDay.deleteMany();
  await prisma.branchHoliday.deleteMany();
  await prisma.staffLeave.deleteMany();
  await prisma.staffBreak.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.businessComment.deleteMany();
  await prisma.reviewServiceRating.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.bookingStatusHistory.deleteMany();
  await prisma.bookingService.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.recurringBookingPlan.deleteMany();
  await prisma.staffWorkingHour.deleteMany();
  await prisma.staffService.deleteMany();
  await prisma.staffImage.deleteMany();
  await prisma.staffProfile.deleteMany();
  await prisma.comboService.deleteMany();
  await prisma.comboImage.deleteMany();
  await prisma.combo.deleteMany();
  await prisma.promotionCombo.deleteMany();
  await prisma.promotionService.deleteMany();
  await prisma.promotionBranch.deleteMany();
  await prisma.promotionBusiness.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.serviceImage.deleteMany();
  await prisma.branchServiceOffering.deleteMany();
  await prisma.businessService.deleteMany();
  await prisma.canonicalService.deleteMany();
  await prisma.serviceCategory.deleteMany();
  await prisma.cancellationPolicy.deleteMany();
  await prisma.salonTrustSnapshot.deleteMany();
  await prisma.salonMember.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.branchWorkingHour.deleteMany();
  await prisma.branchImage.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.businessImage.deleteMany();
  await prisma.business.deleteMany();
  await prisma.deviceToken.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.businessOwnerProfile.deleteMany();
  await prisma.staffProfile.deleteMany();
  await prisma.user.updateMany({ data: { avatarMediaId: null } });
  await prisma.mediaFile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.district.deleteMany();
  await prisma.province.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  console.log("Hash mật khẩu xong");

  // ============================================================
  // 1. ROLES
  // ============================================================
  console.log("Tạo roles...");
  const roleNames: Record<string, string> = {
    PLATFORM_ADMIN: "Quản trị nền tảng", BUSINESS_OWNER: "Chủ doanh nghiệp",
    BRANCH_MANAGER: "Quản lý chi nhánh", RECEPTIONIST: "Lễ tân", STAFF: "Nhân viên salon",
    CUSTOMER: "Khách hàng", GUEST: "Khách vãng lai",
  };
  const officialRoleCodes = [
    "PLATFORM_ADMIN",
    "BUSINESS_OWNER",
    "BRANCH_MANAGER",
    "RECEPTIONIST",
    "STAFF",
    "CUSTOMER",
    "GUEST",
  ];
  const roles = new Map<string, Awaited<ReturnType<typeof prisma.role.create>>>();
  for (const code of officialRoleCodes) {
    const level = ROLE_LEVELS[code];
    const role = await prisma.role.create({
      data: { code: code as any, name: roleNames[code] ?? code, level: level as any },
    });
    roles.set(code, role);
  }
  const permissionIds = new Map<string, string>();
  for (const permission of PERMISSIONS) {
    const created = await prisma.permission.create({
      data: {
        code: permission.code, resource: permission.resource, action: permission.action,
        scope: permission.defaultScope as any, description: permission.description,
      },
    });
    permissionIds.set(permission.code, created.id);
  }
  for (const [roleCode, codes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roles.get(roleCode);
    if (!role) continue;
    await prisma.rolePermission.createMany({
      data: codes.map((code) => ({ roleId: role.id, permissionId: permissionIds.get(code)! })),
    });
  }
  const roleAdmin = roles.get("PLATFORM_ADMIN")!;
  const roleOwner = roles.get("BUSINESS_OWNER")!;
  const roleManager = roles.get("BRANCH_MANAGER")!;
  const roleReceptionist = roles.get("RECEPTIONIST")!;
  const roleStaff = roles.get("STAFF")!;
  const roleCustomer = roles.get("CUSTOMER")!;

  // ============================================================
  // 2. PROVINCES & DISTRICTS
  // ============================================================
  console.log("Tạo tỉnh/thành + quận/huyện...");
  const provinceDefs = [
    { name: "TP. Hồ Chí Minh", code: "HCM", districts: ["Quận 1", "Quận 3", "Quận 5", "Quận 7", "Quận Bình Thạnh", "Quận Gò Vấp", "Quận Tân Bình", "Quận Phú Nhuận", "Quận Thủ Đức", "Quận 10"] },
    { name: "Hà Nội", code: "HN", districts: ["Quận Cầu Giấy", "Quận Hai Bà Trưng", "Quận Đống Đa", "Quận Hoàn Kiếm", "Quận Thanh Xuân", "Quận Long Biên", "Quận Tây Hồ", "Quận Nam Từ Liêm"] },
    { name: "Đà Nẵng", code: "DN", districts: ["Quận Sơn Trà", "Quận Hải Châu", "Quận Ngũ Hành Sơn", "Quận Thanh Khê", "Quận Liên Chiểu"] },
    { name: "Bình Dương", code: "BD", districts: ["TP. Thủ Dầu Một", "TP. Dĩ An", "TP. Thuận An", "Huyện Bến Cát"] },
    { name: "Đồng Nai", code: "DNG", districts: ["TP. Biên Hòa", "Huyện Long Thành", "TP. Long Khánh"] },
    { name: "Hải Phòng", code: "HP", districts: ["Quận Hồng Bàng", "Quận Lê Chân", "Quận Ngô Quyền"] },
    { name: "Cần Thơ", code: "CT", districts: ["Quận Ninh Kiều", "Quận Cái Răng", "Quận Bình Thủy"] },
  ];
  const districts: { id: string; name: string; provinceName: string }[] = [];
  for (const p of provinceDefs) {
    const prov = await prisma.province.create({ data: { name: p.name, code: p.code } });
    for (const dname of p.districts) {
      const d = await prisma.district.create({ data: { provinceId: prov.id, name: dname, code: `${p.code}-${dname.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 4)}` } });
      districts.push({ id: d.id, name: d.name, provinceName: p.name });
    }
  }

  // ============================================================
  // 3. ADMIN + OWNERS
  // ============================================================
  console.log("Tạo admin & chủ doanh nghiệp...");
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@glowbook.vn",
      phone: "0900000001",
      passwordHash,
      fullName: "Nguyễn Văn Admin",
      gender: "MALE",
      dateOfBirth: new Date("1990-01-15"),
      isEmailVerified: true,
      isActive: true,
      userRoles: { create: [{ roleId: roleAdmin.id }] },
    },
  });
  const platformUserIds: string[] = [adminUser.id];

  await prisma.platformSetting.create({
    data: {
      key: "platform",
      updatedBy: adminUser.id,
      value: {
        maxAdvanceBookingDays: 30, minBookingLeadTimeHours: 2, freeCancellationHours: 24,
        allowRescheduleRequests: true, maxRescheduleCountPerBooking: 2, pendingHoldMinutes: 30,
        appointmentReminderBeforeHours: 2, reviewReminderAfterHours: 24,
        emailEnabled: false, smsEnabled: false, pushEnabled: false,
        autoApproveNewSalons: false, requirePhoneVerification: false, requireIdVerification: true,
        maxBranchesPerBusiness: 10, reviewMinLength: 10, allowAnonymousReview: true,
        autoHideReviewReportThreshold: 5, violationSuspendThreshold: 3,
        checkInEarlyWindowMinutes: 30, lateGraceMinutes: 10, absentThresholdMinutes: 60,
        checkOutEarlyGraceMinutes: 5, overtimeGraceMinutes: 15, attendanceQrTtlSeconds: 45,
      },
    },
  });

  const ownerDefs = [
    { email: "lananh.owner@glowbook.vn", fullName: "Trần Lan Anh", gender: "FEMALE" as const, company: "Công ty TNHH Lan Anh Beauty", tax: "0312445566" },
    { email: "minhhoang.owner@glowbook.vn", fullName: "Phạm Minh Hoàng", gender: "MALE" as const, company: "Công ty CP Minh Hoàng Salon", tax: "0315778899" },
    { email: "thanhhuong.owner@glowbook.vn", fullName: "Lê Thanh Hương", gender: "FEMALE" as const, company: "Công ty TNHH Thanh Hương Spa", tax: "0316889900" },
    { email: "quocbao.owner@glowbook.vn", fullName: "Nguyễn Quốc Bảo", gender: "MALE" as const, company: "Công ty CP Quốc Bảo Hair", tax: "0317223344" },
    { email: "phuonglinh.owner@glowbook.vn", fullName: "Hoàng Phương Linh", gender: "FEMALE" as const, company: "Công ty TNHH Phương Linh Beauty", tax: "0318556677" },
    { email: "mocspa.owner@glowbook.vn", fullName: "Đặng Minh Châu", gender: "FEMALE" as const, company: "Công ty TNHH Mộc Spa", tax: "0109981001" },
    { email: "aurora.owner@glowbook.vn", fullName: "Võ Hải Yến", gender: "FEMALE" as const, company: "Công ty TNHH Aurora Nail", tax: "0319981002" },
    { email: "annhien.owner@glowbook.vn", fullName: "Nguyễn An Nhiên", gender: "FEMALE" as const, company: "Công ty TNHH An Nhiên Skincare", tax: "0409981003" },
    { email: "themen.owner@glowbook.vn", fullName: "Lê Tuấn Kiệt", gender: "MALE" as const, company: "Công ty TNHH The Men Grooming", tax: "0109981004" },
    { email: "bloom.owner@glowbook.vn", fullName: "Trương Khánh Ly", gender: "FEMALE" as const, company: "Công ty TNHH Bloom Lash", tax: "0319981005" },
    { email: "lavie.owner@glowbook.vn", fullName: "Phan Thanh Tùng", gender: "MALE" as const, company: "Công ty TNHH Lavie Hair", tax: "0209981006" },
    { email: "serenity.owner@glowbook.vn", fullName: "Bùi Ngọc Trâm", gender: "FEMALE" as const, company: "Công ty TNHH Serenity Spa", tax: "1809981007" },
  ].slice(0, seedConfig.businesses);

  const owners: { userId: string; ownerProfileId: string }[] = [];
  for (const o of ownerDefs) {
    const u = await prisma.user.create({
      data: {
        email: o.email,
        phone: randomPhone(),
        passwordHash,
        fullName: o.fullName,
        gender: o.gender,
        dateOfBirth: new Date("1985-1989-04-15".replace("1985-1989", String(1985 + randInt(0, 8)))),
        isEmailVerified: true,
        isActive: true,
        userRoles: { create: [{ roleId: roleOwner.id }] },
        ownerProfile: {
          create: { companyName: o.company, taxCode: o.tax, identityCardNumber: `0790${randInt(80, 99)}${randInt(100000, 999999)}` },
        },
      },
      include: { ownerProfile: true },
    });
    owners.push({ userId: u.id, ownerProfileId: u.ownerProfile!.id });
  }

  // ============================================================
  // 4. BUSINESSES + BRANCHES
  // ============================================================
  console.log("Tạo doanh nghiệp + chi nhánh...");
  const businessDefs = [
    { name: "Lan Anh Beauty Salon", desc: "Salon chăm sóc sắc đẹp hàng đầu TP.HCM với hơn 10 năm kinh nghiệm." },
    { name: "Minh Hoàng Hair Studio", desc: "Studio tóc cao cấp, chuyên nhuộm và tạo kiểu chuyên nghiệp." },
    { name: "Thanh Hương Spa & Clinic", desc: "Spa và chăm sóc da công nghệ cao Hàn Quốc." },
    { name: "Quốc Bảo Hair Salon", desc: "Salon tóc nam nữ phong cách Hàn Quốc, giá hợp lý." },
    { name: "Phương Linh Beauty Center", desc: "Trung tâm làm đẹp tổng hợp với đội ngũ chuyên gia hàng đầu." },
    { name: "Mộc Spa & Beauty", desc: "Chuỗi spa chăm sóc cơ thể và thư giãn với quy trình vận hành ổn định." },
    { name: "Aurora Nail Studio", desc: "Studio nail hiện đại, phục vụ nhiều khách walk-in tại TP.HCM." },
    { name: "An Nhiên Skincare Clinic", desc: "Cơ sở chăm sóc da và tư vấn liệu trình tại Đà Nẵng." },
    { name: "The Men Grooming", desc: "Chuỗi barber và grooming dành cho nam, đông khách vào buổi tối." },
    { name: "Bloom Lash & Brow", desc: "Chuyên mi và chân mày với đội ngũ kỹ thuật viên giàu kinh nghiệm." },
    { name: "Lavie Hair Salon", desc: "Salon tóc, nhuộm và phục hồi chuyên sâu tại Hải Phòng." },
    { name: "Serenity Spa", desc: "Massage và body care tại Cần Thơ, đang hoàn thiện hồ sơ vận hành." },
  ].slice(0, seedConfig.businesses);

  const businesses: {
    id: string;
    ownerId: string;
    name: string;
    status: "ACTIVE" | "SUSPENDED" | "PENDING_REVIEW" | "NEED_MORE_INFO" | "REJECTED";
  }[] = [];
  for (let i = 0; i < businessDefs.length; i++) {
    // Status scenarios belong to stable dataset positions, not the sliced
    // array length. Otherwise `small` mode turns all three businesses into
    // review-only records and leaves no ACTIVE tenant for operational QA.
    const businessStatus =
      i === 11
        ? "REJECTED"
        : i === 10
          ? "NEED_MORE_INFO"
          : i === 9
            ? "PENDING_REVIEW"
            : i === 8
              ? "SUSPENDED"
              : "ACTIVE";
    const b = await prisma.business.create({
      data: {
        ownerId: owners[i].ownerProfileId,
        name: businessDefs[i].name,
        slug: slugify(businessDefs[i].name),
        description: businessDefs[i].desc,
        status: businessStatus,
        contactEmail: ownerDefs[i].email,
        contactPhone: randomPhone(),
        addressLine: `${randInt(10, 300)} Nguyễn Huệ`,
        legalRepresentative: ownerDefs[i].fullName,
        legalDocuments: { businessLicense: `/demo-documents/${slugify(businessDefs[i].name)}/business-license.pdf`, ownerIdCard: `/demo-documents/${slugify(businessDefs[i].name)}/owner-id-card.pdf`, taxDocument: `/demo-documents/${slugify(businessDefs[i].name)}/tax-document.pdf` },
        submittedAt: randDate(SEED_START_DATE, SEED_END_DATE),
        reviewedAt: ["PENDING_REVIEW", "NEED_MORE_INFO", "REJECTED"].includes(businessStatus)
          ? null
          : randDate(new Date("2024-02-01"), SEED_END_DATE),
        reviewNote: businessStatus === "REJECTED" ? "Mã số thuế không khớp tên pháp nhân." : businessStatus === "NEED_MORE_INFO" ? "Cần bổ sung ảnh mặt tiền cơ sở và giấy phép kinh doanh hợp lệ." : null,
      },
    });
    businesses.push({
      id: b.id,
      ownerId: owners[i].ownerProfileId,
      name: b.name,
      status: businessStatus,
    });
    await prisma.userRole.updateMany({
      where: { userId: owners[i].userId, roleId: roleOwner.id },
      data: { businessId: b.id },
    });
    await prisma.cancellationPolicy.create({
      data: { businessId: b.id, freeCancelHours: 24, lateCancelFeePercent: 30, noShowFeePercent: 50, rescheduleAllowedHours: 2, updatedBy: adminUser.id, notes: "Chính sách demo production-like; không tự động thu phí no-show." },
    });
    await prisma.businessReviewEvent.create({
      data: {
        businessId: b.id,
        actorId: ["PENDING_REVIEW", "NEED_MORE_INFO", "REJECTED"].includes(b.status)
          ? adminUser.id
          : owners[i].userId,
        action: b.status === "REJECTED" ? "REJECT" : b.status === "NEED_MORE_INFO" ? "REQUEST_MORE_INFO" : b.status === "PENDING_REVIEW" ? "SUBMIT" : "APPROVE",
        fromStatus: "PENDING_REVIEW", toStatus: b.status,
        reason: b.reviewNote ?? "Hồ sơ đáp ứng yêu cầu vận hành và đã được duyệt.",
        createdAt: b.reviewedAt ?? b.submittedAt ?? b.createdAt,
      },
    });
  }

  const branchStreetNames = [
    "Nguyễn Huệ", "Lê Lợi", "Trần Hưng Đạo", "Hai Bà Trưng", "Cách Mạng Tháng 8",
    "Nguyễn Trãi", "Lý Tự Trọng", "Đồng Khởi", "Pasteur", "Võ Văn Tần",
    "Phan Xích Long", "Phan Đăng Lưu", "Cao Thắng", "Sư Vạn Hạnh", "Bạch Đằng",
    "Xô Viết Nghệ Tĩnh", "Điện Biên Phủ", "Nguyễn Đình Chiểu", "Trần Não", "Phổ Quang",
  ];

  const branches: {
    id: string;
    businessId: string;
    name: string;
    districtId: string;
    status: "ACTIVE" | "PENDING" | "INACTIVE";
  }[] = [];
  for (let i = 0; i < businesses.length; i++) {
    const branchCount = randInt(seedConfig.branchesMin, seedConfig.branchesMax);
    const usedDistricts = pickN(districts, branchCount);
    for (let j = 0; j < branchCount; j++) {
      const d = usedDistricts[j];
      const street = pick(branchStreetNames);
      const number = randInt(1, 500);
      const businessStatus = businesses[i].status;
      const branchStatus =
        businessStatus === "ACTIVE"
          ? j === 0 || chance(0.86)
            ? "ACTIVE"
            : chance(0.55)
              ? "PENDING"
              : "INACTIVE"
          : businessStatus === "PENDING_REVIEW" || businessStatus === "NEED_MORE_INFO"
            ? j === 0
              ? "PENDING"
              : "INACTIVE"
            : "INACTIVE";
      const br = await prisma.branch.create({
        data: {
          businessId: businesses[i].id,
          name: `${businesses[i].name} - ${d.name}`,
          addressLine: `${number} ${street}`,
          districtId: d.id,
          latitude: 10.7 + rand() * 0.4,
          longitude: 106.6 + rand() * 0.4,
          phone: `028${randInt(1000000, 9999999)}`,
          status: branchStatus,
          reviewNote: businessStatus === "SUSPENDED"
            ? "Tạm ngưng do tỷ lệ hủy sát giờ cao."
            : ["PENDING_REVIEW", "NEED_MORE_INFO"].includes(businessStatus)
              ? "Chi nhánh chờ hoàn tất duyệt hồ sơ doanh nghiệp."
              : null,
        },
      });
      branches.push({
        id: br.id,
        businessId: businesses[i].id,
        name: br.name,
        districtId: d.id,
        status: branchStatus,
      });
    }
  }
  console.log(`  -> ${branches.length} chi nhánh`);

  // Branch working hours (Mon-Sun)
  for (const b of branches) {
    for (let dow = 0; dow <= 6; dow++) {
      await prisma.branchWorkingHour.create({
        data: {
          branchId: b.id,
          dayOfWeek: dow,
          openTime: new Date("1970-01-01T08:00:00Z"),
          closeTime: new Date("1970-01-01T23:00:00Z"),
          isClosed: false,
        },
      });
    }
  }

  // ============================================================
  // 5. SERVICE CATEGORIES
  // ============================================================
  console.log("Tạo danh mục dịch vụ...");
  const catData: { name: string; slug: string; parent?: string }[] = [
    { name: "Chăm sóc tóc", slug: "cham-soc-toc" },
    { name: "Cắt tóc", slug: "cat-toc", parent: "cham-soc-toc" },
    { name: "Nhuộm tóc", slug: "nhuom-toc", parent: "cham-soc-toc" },
    { name: "Uốn/Duỗi tóc", slug: "uon-duoi-toc", parent: "cham-soc-toc" },
    { name: "Chăm sóc móng", slug: "cham-soc-mong" },
    { name: "Sơn gel", slug: "son-gel", parent: "cham-soc-mong" },
    { name: "Đắp móng", slug: "dap-mong", parent: "cham-soc-mong" },
    { name: "Chăm sóc da", slug: "cham-soc-da" },
    { name: "Spa & Massage", slug: "spa-massage" },
    { name: "Thiết kế lông mày", slug: "thiet-ke-long-may" },
    { name: "Trang điểm", slug: "trang-diem" },
    { name: "Triệt lông", slug: "triet-long" },
  ];
  const catByBusinessAndSlug = new Map<string, string>();
  for (const business of businesses) {
    const catBySlug: Record<string, string> = {};
    for (const c of catData) {
      const parentId = c.parent ? catBySlug[c.parent] : null;
      const cat = await prisma.serviceCategory.create({
        data: { businessId: business.id, name: c.name, slug: c.slug, parentId },
      });
      catBySlug[c.slug] = cat.id;
      catByBusinessAndSlug.set(`${business.id}:${c.slug}`, cat.id);
    }
  }

  const canonicalDefinitions = [
    ["MENS_HAIRCUT", "cat-toc-nam", "Cắt tóc nam", ["cắt tóc nam", "tóc nam"]],
    ["WOMENS_HAIRCUT", "cat-toc-nu", "Cắt tóc nữ", ["cắt tóc nữ", "cắt layer", "cắt bob"]],
    ["HAIR_COLOR", "nhuom-toc", "Nhuộm tóc", ["nhuộm tóc", "balayage", "highlight"]],
    ["HAIR_PERM", "uon-toc", "Uốn tóc", ["uốn tóc", "uốn setting"]],
    ["GEL_POLISH", "son-gel", "Sơn gel", ["sơn gel", "gel polish"]],
    ["NAIL_EXTENSION", "dap-mong", "Đắp móng", ["đắp móng", "nối móng"]],
    ["SKIN_CARE", "cham-soc-da", "Chăm sóc da", ["chăm sóc da", "facial"]],
    ["BODY_MASSAGE", "massage-body", "Massage body", ["massage body", "massage toàn thân"]],
    ["FOOT_MASSAGE", "massage-foot", "Massage foot", ["massage foot", "massage chân"]],
  ] as const;
  const canonicalByCode = new Map<string, string>();
  for (const [code, slug, name, synonyms] of canonicalDefinitions) {
    const canonical = await prisma.canonicalService.create({ data: { code, slug, name, synonyms: [...synonyms] } });
    canonicalByCode.set(code, canonical.id);
  }

  // ============================================================
  // 6. SERVICES PER BRANCH
  // ============================================================
  console.log("Tạo dịch vụ...");
  const svcTemplates = [
    { name: "Cắt tóc nữ theo yêu cầu", cat: "cat-toc", canonical: "WOMENS_HAIRCUT", price: 250000, dur: 60 },
    { name: "Cắt tóc nam theo yêu cầu", cat: "cat-toc", canonical: "MENS_HAIRCUT", price: 150000, dur: 45 },
    { name: "Cắt tóc trẻ em", cat: "cat-toc", canonical: null, price: 120000, dur: 40 },
    { name: "Nhuộm tóc thời trang", cat: "nhuom-toc", canonical: "HAIR_COLOR", price: 1200000, dur: 180 },
    { name: "Nhuộm highlight", cat: "nhuom-toc", canonical: "HAIR_COLOR", price: 1800000, dur: 210 },
    { name: "Uốn xoăn lạnh", cat: "uon-duoi-toc", canonical: "HAIR_PERM", price: 1500000, dur: 180 },
    { name: "Duỗi tóc thẳng", cat: "uon-duoi-toc", canonical: null, price: 1300000, dur: 150 },
    { name: "Sơn gel tay", cat: "son-gel", canonical: "GEL_POLISH", price: 200000, dur: 60 },
    { name: "Sơn gel chân", cat: "son-gel", canonical: "GEL_POLISH", price: 250000, dur: 60 },
    { name: "Sơn gel tay + chân", cat: "son-gel", canonical: "GEL_POLISH", price: 400000, dur: 90 },
    { name: "Đắp móng gel", cat: "dap-mong", canonical: "NAIL_EXTENSION", price: 500000, dur: 90 },
    { name: "Chăm sóc da mặt cơ bản", cat: "cham-soc-da", canonical: "SKIN_CARE", price: 450000, dur: 75 },
    { name: "Chăm sóc da mặt chuyên sâu", cat: "cham-soc-da", canonical: "SKIN_CARE", price: 850000, dur: 90 },
    { name: "Trẻ hóa da Hàn Quốc", cat: "cham-soc-da", canonical: null, price: 1500000, dur: 120 },
    { name: "Massage body 60 phút", cat: "spa-massage", canonical: "BODY_MASSAGE", price: 600000, dur: 60 },
    { name: "Massage body 90 phút", cat: "spa-massage", canonical: "BODY_MASSAGE", price: 850000, dur: 90 },
    { name: "Massage foot 60 phút", cat: "spa-massage", canonical: "FOOT_MASSAGE", price: 400000, dur: 60 },
    { name: "Điêu khắc lông mày 8D", cat: "thiet-ke-long-may", canonical: null, price: 800000, dur: 90 },
    { name: "Phun xăm lông mày", cat: "thiet-ke-long-may", canonical: null, price: 1500000, dur: 120 },
    { name: "Trang điểm cô dâu", cat: "trang-diem", canonical: null, price: 2500000, dur: 120 },
    { name: "Trang điểm dự tiệc", cat: "trang-diem", canonical: null, price: 1200000, dur: 90 },
    { name: "Triệt lông tay/chân", cat: "triet-long", canonical: null, price: 500000, dur: 45 },
  ];

  const catalogByBusinessAndName = new Map<string, string>();
  for (const business of businesses) {
    for (const template of svcTemplates) {
      const item = await prisma.businessService.create({
        data: {
          businessId: business.id, categoryId: catByBusinessAndSlug.get(`${business.id}:${template.cat}`)!, name: template.name,
          canonicalServiceId: template.canonical ? canonicalByCode.get(template.canonical) : null,
          mappingStatus: template.canonical ? "MAPPED" : "UNMAPPED",
          description: `${template.name} trong danh mục chuẩn của ${business.name}.`,
          basePrice: new Prisma.Decimal(template.price), baseDurationMinutes: template.dur,
          status: chance(0.96) ? "ACTIVE" : "INACTIVE",
        },
      });
      catalogByBusinessAndName.set(`${business.id}:${template.name}`, item.id);
    }
  }

  const services: { id: string; branchId: string; businessServiceId: string; canonicalServiceId: string | null; price: number; durationMinutes: number; name: string }[] = [];
  for (const b of branches) {
    // mỗi branch chọn 8-14 dịch vụ ngẫu nhiên từ template
    const count = randInt(8, 14);
    const tmpls = pickN(svcTemplates, count);
    for (const t of tmpls) {
      const priceJitter = t.price * (0.9 + rand() * 0.3);
      const price = Math.round(priceJitter / 1000) * 1000;
      const dur = t.dur + pick([0, 0, 0, -15, 15, 30]);
      const s = await prisma.branchServiceOffering.create({
        data: {
          branchId: b.id,
          businessServiceId: catalogByBusinessAndName.get(`${b.businessId}:${t.name}`)!,
          categoryId: catByBusinessAndSlug.get(`${b.businessId}:${t.cat}`)!,
          name: t.name,
          description: `${t.name} với sản phẩm cao cấp, nhân viên chuyên nghiệp.`,
          price: new Prisma.Decimal(price),
          durationMinutes: Math.max(30, dur),
          status: "ACTIVE",
        },
      });
      const businessServiceId = catalogByBusinessAndName.get(`${b.businessId}:${t.name}`)!;
      services.push({ id: s.id, branchId: b.id, businessServiceId, canonicalServiceId: t.canonical ? canonicalByCode.get(t.canonical)! : null, price, durationMinutes: s.durationMinutes, name: s.name });
    }
  }
  console.log(`  -> ${services.length} dịch vụ`);

  // ============================================================
  // 7. STAFF
  // ============================================================
  console.log("Tạo nhân viên...");
  const staffRecords: { id: string; userId: string; branchId: string; fullName: string; isBookable: boolean }[] = [];
  const demoBranch = branches[0];
  for (const demo of [
    { code: "BRANCH_MANAGER", email: "manager@glowbook.vn", name: "Demo Quản lý" },
    { code: "RECEPTIONIST", email: "reception@glowbook.vn", name: "Demo Lễ tân" },
    { code: "STAFF", email: "staff@glowbook.vn", name: "Demo Nhân viên" },
  ]) {
    const created = await prisma.user.create({
      data: {
        email: demo.email, passwordHash, fullName: demo.name,
        isEmailVerified: true, isActive: true,
        userRoles: { create: [{ roleId: roles.get(demo.code)!.id, businessId: demoBranch.businessId, branchId: demoBranch.id }] },
        staffProfile: { create: { branchId: demoBranch.id, fullName: demo.name, position: demo.code, status: "ACTIVE", isBookable: demo.code === "STAFF", publicVisible: demo.code === "STAFF" } },
      },
      include: { staffProfile: true },
    });
    staffRecords.push({ id: created.staffProfile!.id, userId: created.id, branchId: demoBranch.id, fullName: demo.name, isBookable: demo.code === "STAFF" });
  }
  for (const b of branches) {
    const count = randInt(Math.max(3, seedConfig.staffPerBranch - 1), seedConfig.staffPerBranch);
    for (let k = 0; k < count; k++) {
      const gender = chance(0.65) ? "FEMALE" : "MALE";
      const name = fullName(gender);
      const email = `staff.${slugify(name)}.${b.id.slice(0, 6)}@glowbook.vn`;
      const operationalRole = k === 0 ? roleManager : k === 1 ? roleReceptionist : roleStaff;
      const position = k === 0 ? "Quản lý chi nhánh" : k === 1 ? "Lễ tân" : pick([
        "Chuyên viên tóc", "Chuyên viên nail", "Chuyên viên spa", "Chuyên viên da",
        "Stylist", "Massage therapist", "Senior stylist", "Junior stylist",
      ]);
      const u = await prisma.user.create({
        data: {
          email,
          phone: randomPhone(),
          passwordHash,
          fullName: name,
          gender: gender as "MALE" | "FEMALE",
          isEmailVerified: true,
          isActive: true,
          userRoles: { create: [{ roleId: operationalRole.id, businessId: b.businessId, branchId: b.id }] },
          staffProfile: {
            create: {
              branchId: b.id,
              fullName: name,
              position,
              bio: `${position} với ${randInt(2, 12)} năm kinh nghiệm.`,
              status: chance(0.85) ? "ACTIVE" : (chance(0.5) ? "ON_LEAVE" : "INACTIVE"),
              isBookable: operationalRole.id === roleStaff.id,
              publicVisible: operationalRole.id === roleStaff.id,
              hiredAt: randDate(new Date("2022-01-01"), new Date("2024-06-30")),
            },
          },
        },
        include: { staffProfile: true },
      });
      if (u.staffProfile) {
        staffRecords.push({ id: u.staffProfile.id, userId: u.id, branchId: b.id, fullName: name, isBookable: operationalRole.id === roleStaff.id });
      }
    }
  }
  console.log(`  -> ${staffRecords.length} nhân viên`);

  // Staff working hours
  for (const sp of staffRecords) {
    for (let dow = 1; dow <= 6; dow++) {
      await prisma.staffWorkingHour.create({
        data: {
          staffId: sp.id,
          dayOfWeek: dow,
          startTime: new Date(`1970-01-01T${chance(0.5) ? "09:00:00" : "10:00:00"}Z`),
          endTime: new Date(`1970-01-01T${chance(0.3) ? "18:00:00" : "19:00:00"}Z`),
          isOff: false,
        },
      });
    }
    await prisma.staffWorkingHour.create({
      data: {
        staffId: sp.id,
        dayOfWeek: 0,
        startTime: new Date(`1970-01-01T00:00:00Z`),
        endTime: new Date(`1970-01-01T00:00:00Z`),
        isOff: true,
      },
    });
  }

  // Staff-Service mapping
  console.log("Gán dịch vụ cho nhân viên...");
  const staffSkills = new Map<string, Set<string>>();
  for (const sp of staffRecords) {
    if (!sp.isBookable) continue;
    const branchServices = services.filter((s) => s.branchId === sp.branchId);
    // mỗi staff biết làm 60-90% số dịch vụ của branch
    for (const s of branchServices) {
      if (chance(0.7)) {
        await prisma.staffService.create({ data: { staffId: sp.id, serviceId: s.id } });
        const skills = staffSkills.get(sp.id) ?? new Set<string>();
        skills.add(s.id);
        staffSkills.set(sp.id, skills);
      }
    }
    // Mỗi nhân viên phải có ít nhất một kỹ năng để có thể nhận lịch hợp lệ.
    if (!(staffSkills.get(sp.id)?.size) && branchServices[0]) {
      await prisma.staffService.create({ data: { staffId: sp.id, serviceId: branchServices[0].id } });
      staffSkills.set(sp.id, new Set([branchServices[0].id]));
    }
  }
  const operationalBranches = branches.filter(
    (candidate) => candidate.status === "ACTIVE",
  );
  if (!operationalBranches.length) {
    throw new Error("Seed requires at least one ACTIVE branch");
  }

  // ============================================================
  // 8. CUSTOMERS (1000)
  // ============================================================
  console.log(`Tạo ${seedConfig.customers} khách hàng...`);
  const TOTAL_CUSTOMERS = seedConfig.customers;
  const customerUserIds: string[] = [];
  const customerProfileIds: string[] = [];

  const batch = 100;
  for (let start = 0; start < TOTAL_CUSTOMERS; start += batch) {
    const promises: Promise<any>[] = [];
    for (let i = 0; i < batch && start + i < TOTAL_CUSTOMERS; i++) {
      const idx = start + i;
      const gender = chance(0.62) ? "FEMALE" : "MALE"; // thiên về nữ vì làm đẹp
      const name = fullName(gender as "MALE" | "FEMALE");
      const email = `khach${String(idx + 1).padStart(4, "0")}@glowbook.vn`;
      const phone = randomPhone();
      const created = randDate(SEED_START_DATE, SEED_END_DATE);
      const district = pick(districts);
      const address = `${randInt(1, 999)} ${pick(branchStreetNames)}, ${district.name}, ${district.provinceName}`;

      promises.push(
        prisma.user.create({
          data: {
            email,
            phone,
            passwordHash,
            fullName: name,
            gender: gender as "MALE" | "FEMALE",
            dateOfBirth: randomDob(18, 60),
            isEmailVerified: chance(0.8),
            isPhoneVerified: chance(0.6),
            isActive: true,
            lastLoginAt: chance(0.7) ? randDate(created, SEED_END_DATE) : null,
            createdAt: created,
            userRoles: { create: [{ roleId: roleCustomer.id }] },
            customerProfile: {
              create: {
                address,
                note: chance(0.1) ? "Khách VIP" : null,
                createdAt: created,
              },
            },
          },
          include: { customerProfile: true },
        }),
      );
    }
    const results = await Promise.all(promises);
    for (const r of results) {
      customerUserIds.push(r.id);
      customerProfileIds.push(r.customerProfile!.id);
    }
    if ((start + batch) % 200 === 0) console.log(`  -> ${start + batch} customers`);
  }
  console.log(`  -> Tổng ${customerUserIds.length} khách hàng`);

  // ============================================================
  // 9. COMBOS
  // ============================================================
  console.log("Tạo combo...");
  const comboDefs: { branchIdx: number; name: string; svcNames: string[]; price: number }[] = [
    { branchIdx: 0, name: "Combo Tóc Đẹp Đón Tết", svcNames: ["Cắt tóc nữ theo yêu cầu", "Nhuộm tóc thời trang"], price: 1300000 },
    { branchIdx: 1, name: "Combo Thư Giãn Cuối Tuần", svcNames: ["Chăm sóc da mặt cơ bản", "Massage body 60 phút"], price: 950000 },
    { branchIdx: 2, name: "Combo Nail Hoàn Hảo", svcNames: ["Sơn gel tay + chân", "Đắp móng gel"], price: 800000 },
    { branchIdx: 3, name: "Combo Cô Dâu", svcNames: ["Trang điểm cô dâu", "Uốn xoăn lạnh"], price: 3700000 },
  ];
  const comboIds: string[] = [];
  for (const cd of comboDefs) {
    const branch = operationalBranches[cd.branchIdx % operationalBranches.length];
    const branchSvc = services.filter((s) => s.branchId === branch.id);
    const comboSvcIds = cd.svcNames
      .map((n) => branchSvc.find((s) => s.name === n)?.id)
      .filter(Boolean) as string[];
    if (comboSvcIds.length < 2) continue;
    const c = await prisma.combo.create({
      data: {
        businessId: branch.businessId,
        branchId: branch.id,
        name: cd.name,
        description: `Combo tiết kiệm: ${cd.name}`,
        comboPrice: cd.price,
        status: "ACTIVE",
        comboServices: {
          create: comboSvcIds.map((id, sortOrder) => {
            const service = branchSvc.find((item) => item.id === id)!;
            return {
              serviceId: id,
              quantity: 1,
              sortOrder,
              priceSnapshot: service.price,
              durationSnapshot: service.durationMinutes,
            };
          }),
        },
      },
    });
    comboIds.push(c.id);
  }

  // ============================================================
  // 10. PROMOTIONS
  // ============================================================
  console.log("Tạo khuyến mãi...");
  await prisma.promotion.create({
    data: {
      name: "Giảm 20% dịch vụ tóc tháng này",
      description: "Áp dụng cho tất cả dịch vụ tóc.",
      discountType: "PERCENTAGE",
      discountValue: 20,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-08-31"),
      status: "ACTIVE",
      businessLinks: { create: [{ businessId: businesses[0].id }] },
    },
  });
  await prisma.promotion.create({
    data: {
      name: "Giảm 100K cho khách mới",
      description: "Áp dụng đơn đầu tiên.",
      discountType: "FIXED_AMOUNT",
      discountValue: 100000,
      startDate: new Date("2024-08-01"),
      endDate: new Date("2026-12-31"),
      status: "ACTIVE",
      branchLinks: { create: [{ branchId: operationalBranches[2 % operationalBranches.length].id }] },
    },
  });
  await prisma.promotion.create({
    data: {
      name: "Flash sale cuối năm -30%",
      description: "Áp dụng cho dịch vụ spa.",
      discountType: "PERCENTAGE",
      discountValue: 30,
      startDate: new Date("2025-12-01"),
      endDate: new Date("2025-12-31"),
      status: "EXPIRED",
    },
  });

  for (const campaign of [
    { name: "Khai trương 2024", start: "2024-01-01", end: "2024-03-31", value: 15 },
    { name: "Hè rạng rỡ 2025", start: "2025-05-01", end: "2025-08-31", value: 12 },
    { name: "Ưu đãi 20/10", start: "2025-10-10", end: "2025-10-20", value: 20 },
    { name: "Tết và cuối năm", start: "2025-12-01", end: "2026-02-28", value: 10 },
  ]) {
    await prisma.promotion.create({
      data: {
        name: campaign.name, description: `Chiến dịch lịch sử ${campaign.name}.`, discountType: "PERCENTAGE",
        discountValue: campaign.value, startDate: new Date(campaign.start), endDate: new Date(campaign.end),
        status: new Date(campaign.end) < SEED_END_DATE ? "EXPIRED" : "ACTIVE", createdByPlatform: true,
      },
    });
  }

  const vouchers: Awaited<ReturnType<typeof prisma.voucher.create>>[] = [];
  for (let i = 0; i < Math.max(6, businesses.length); i++) {
    const business = businesses[i % businesses.length];
    const platformVoucher = i < 3;
    const voucher = await prisma.voucher.create({
      data: {
        code: `GLOW${SEED_MODE.toUpperCase()}${String(i + 1).padStart(2, "0")}`,
        name: platformVoucher ? `Voucher nền tảng ${i + 1}` : `Ưu đãi ${business.name}`,
        description: "Voucher production-like dùng cho dữ liệu demo.", discountType: i % 2 ? "FIXED_AMOUNT" : "PERCENTAGE",
        discountValue: i % 2 ? 50_000 : 10, minOrderValue: 150_000, maxDiscount: 150_000,
        totalQuantity: 1000, usedQuantity: randInt(20, 400),
        startDate: randDate(new Date("2024-01-01"), new Date("2026-01-01")), endDate: FUTURE_END_DATE,
        status: "ACTIVE", businessId: platformVoucher ? null : business.id,
        scope: platformVoucher ? "PLATFORM" : "TENANT", createdByPlatform: platformVoucher,
      },
    });
    vouchers.push(voucher);
  }

  for (let i = 0; i < Math.min(customerProfileIds.length, vouchers.length * 20); i++) {
    const voucher = vouchers[i % vouchers.length];
    await prisma.customerVoucher.create({
      data: { voucherId: voucher.id, customerId: customerProfileIds[i], status: chance(0.15) ? "USED" : "ACTIVE", acquiredAt: randDate(voucher.startDate, SEED_END_DATE), expiresAt: voucher.endDate },
    });
  }

  // ============================================================
  // 11. BOOKINGS
  // ============================================================
  console.log("Tạo bookings...");
  const TOTAL_BOOKINGS = seedConfig.bookings;
  const paymentMethods: ("CASH" | "BANK_TRANSFER" | "MOMO" | "VNPAY" | "ZALOPAY" | "CREDIT_CARD")[] = [
    "CASH", "CASH", "CASH", "BANK_TRANSFER", "BANK_TRANSFER", "MOMO", "VNPAY", "ZALOPAY", "CREDIT_CARD",
  ];

  // pre-group staff by branch
  const staffByBranch: Record<string, typeof staffRecords> = {};
  for (const sp of staffRecords) {
    (staffByBranch[sp.branchId] ||= []).push(sp);
  }

  const bookingIds: string[] = [];
  const occupiedByStaffDay = new Map<string, { start: number; end: number }[]>();

  for (let i = 0; i < TOTAL_BOOKINGS; i++) {
    const custIdx = randInt(0, customerProfileIds.length - 1);
    const branch = pick(operationalBranches);
    const branchServices = services.filter((s) => s.branchId === branch.id);
    if (branchServices.length === 0) continue;
    const svc = pick(branchServices);
    const branchStaff = staffByBranch[branch.id] || [];
    if (branchStaff.length === 0) continue;
    const eligibleStaff = branchStaff.filter((candidate) => staffSkills.get(candidate.id)?.has(svc.id));
    if (!eligibleStaff.length) continue;
    const staff = pick(eligibleStaff);

    const generatedDate = i < Math.min(24, TOTAL_BOOKINGS)
      ? new Date(Date.UTC(SEED_END_DATE.getUTCFullYear(), SEED_END_DATE.getUTCMonth(), SEED_END_DATE.getUTCDate()))
      : appointmentDateWithinRange();
    const apptDate = generatedDate;
    const status = weightedStatus(apptDate, i);
    // giờ vàng: 10-12h và 14-19h
    const requestedHour = chance(0.6)
      ? randInt(10, 12)
      : chance(0.7)
        ? randInt(14, 19)
        : randInt(9, 18);
    const requestedMinute = pick([0, 15, 30, 45]);
    const requestedStartMinutes = requestedHour * 60 + requestedMinute;
    const latestStartMinutes = Math.floor(
      (23 * 60 - svc.durationMinutes) / 15,
    ) * 15;
    const startMinutes = Math.min(requestedStartMinutes, latestStartMinutes);
    const hour = Math.floor(startMinutes / 60);
    const minute = startMinutes % 60;
    let endMinutes = startMinutes + svc.durationMinutes;
    // clamp nếu dịch vụ kéo qua ngày hôm sau
    if (endMinutes >= 24 * 60) endMinutes = 23 * 60 + 59;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    const startTime = new Date(Date.UTC(1970, 0, 1, hour, minute));
    const endTime = new Date(Date.UTC(1970, 0, 1, endH, endM));
    const occupancyKey = `${staff.id}:${apptDate.toISOString().slice(0, 10)}`;
    const occupied = occupiedByStaffDay.get(occupancyKey) ?? [];
    if (occupied.some((slot) => startMinutes < slot.end && endMinutes > slot.start)) continue;
    occupied.push({ start: startMinutes, end: endMinutes });
    occupiedByStaffDay.set(occupancyKey, occupied);

    const code = `BB-${apptDate.getUTCFullYear()}-${String(i + 1).padStart(5, "0")}`;

    // Tạo createdAt trước appointment 1-30 ngày
    const createdAt = new Date(apptDate.getTime() - randInt(1, 30) * 86400000 - randInt(0, 86400000));

    const isCancelled = status === "CANCELLED";
    const cancelledAt = isCancelled ? new Date(apptDate.getTime() - randInt(0, 3) * 86400000) : null;
    const cancelledByUserId = isCancelled ? customerUserIds[custIdx] : null;
    const cancelReason = isCancelled
      ? pick([
          "Khách bận đột xuất công việc",
          "Đổi lịch hẹn khác",
          "Không liên lạc được",
          "Khách thay đổi ý định",
          "Thời tiết xấu",
        ])
      : null;
    const note = chance(0.15)
      ? pick([
          "Khách muốn tone nâu chocolate",
          "Cắt ngắn hơn bình thường",
          "Da nhạy cảm, dùng sản phẩm dịu nhẹ",
          "Khách VIP, ưu tiên",
          "Đã làm dịch vụ này lần trước",
          "Khách muốn gặp chị Linh quen",
        ])
      : null;
    const eligibleVouchers = vouchers.filter((voucher) => voucher.scope === "PLATFORM" || voucher.businessId === branch.businessId);
    const selectedVoucher = chance(0.12) && eligibleVouchers.length ? pick(eligibleVouchers) : null;
    const rawDiscount = selectedVoucher
      ? selectedVoucher.discountType === "PERCENTAGE"
        ? Math.round(svc.price * Number(selectedVoucher.discountValue) / 100)
        : Number(selectedVoucher.discountValue)
      : 0;
    const voucherDiscount = Math.min(rawDiscount, 150_000, svc.price);
    const finalAmount = svc.price - voucherDiscount;

    const booking = await prisma.booking.create({
      data: {
        bookingCode: code,
        customerId: customerProfileIds[custIdx],
        branchId: branch.id,
        appointmentDate: new Date(Date.UTC(apptDate.getUTCFullYear(), apptDate.getUTCMonth(), apptDate.getUTCDate())),
        appointmentStartTime: startTime,
        appointmentEndTime: endTime,
        status: status as any,
        source: pick(["ONLINE_WEB", "ONLINE_WEB", "ONLINE_WEB", "WALK_IN", "WALK_IN", "PHONE", "STAFF_CREATED", "ADMIN_CREATED"] as const),
        pendingExpiresAt: status === "PENDING" ? new Date(createdAt.getTime() + 30 * 60_000) : null,
        totalAmount: new Prisma.Decimal(svc.price),
        voucherId: selectedVoucher?.id,
        voucherDiscountAmount: new Prisma.Decimal(voucherDiscount),
        finalAmount: new Prisma.Decimal(finalAmount),
        note,
        cancelReason,
        cancelledAt,
        cancelledBy: cancelledByUserId,
        cancelledByType: isCancelled ? "CUSTOMER" : null,
        createdAt,
        updatedAt: createdAt,
      },
    });
    bookingIds.push(booking.id);

    // booking service
    await prisma.bookingService.create({
      data: {
        bookingId: booking.id,
        serviceId: svc.id,
        businessServiceId: svc.businessServiceId,
        canonicalServiceId: svc.canonicalServiceId,
        staffId: staff.id,
        priceAtBooking: new Prisma.Decimal(svc.price),
        durationMinutes: svc.durationMinutes,
        serviceNameSnapshot: svc.name,
        createdAt,
      },
    });

    // status history
    const history: any[] = [{ bookingId: booking.id, status: "PENDING", changedBy: customerUserIds[custIdx], note: "Khách đặt lịch", createdAt }];
    if (status !== "PENDING") {
      history.push({ bookingId: booking.id, status, changedBy: adminUser.id, note: "Cập nhật bởi hệ thống", createdAt: new Date(createdAt.getTime() + 3600000) });
    }
    await prisma.bookingStatusHistory.createMany({ data: history });

    // payment
    let payStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
    if (status === "COMPLETED") payStatus = "PAID";
    else if (status === "CONFIRMED" || status === "CHECKED_IN" || status === "IN_PROGRESS") payStatus = chance(0.5) ? "PAID" : "PENDING";
    else if (status === "PENDING") payStatus = "PENDING";
    else if (status === "CANCELLED") payStatus = chance(0.5) ? "REFUNDED" : "PENDING";
    else payStatus = "FAILED";

    const method = pick(paymentMethods);
    const paidAt = payStatus === "PAID"
      ? new Date(Date.UTC(apptDate.getUTCFullYear(), apptDate.getUTCMonth(), apptDate.getUTCDate(), endH, endM))
      : payStatus === "REFUNDED"
        ? new Date(Date.UTC(apptDate.getUTCFullYear(), apptDate.getUTCMonth(), apptDate.getUTCDate(), endH, endM))
        : null;
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: new Prisma.Decimal(finalAmount),
        method,
        status: payStatus,
        transactionRef: method === "VNPAY" || method === "MOMO" || method === "ZALOPAY" ? `${method}-${code}` : null,
        paidAt,
        createdAt,
      },
    });

    if (payStatus === "REFUNDED") {
      await prisma.refundRequest.create({
        data: {
          paymentId: payment.id, amount: new Prisma.Decimal(finalAmount),
          reason: pick(["Khách hủy đúng chính sách.", "Cơ sở không thể cung cấp dịch vụ.", "Xử lý khiếu nại chất lượng dịch vụ."]),
          status: "REFUNDED", requestedBy: customerUserIds[custIdx], reviewedBy: adminUser.id,
          reviewNote: "Đã đối soát và hoàn tiền trong dữ liệu demo.", reviewedAt: cancelledAt ?? createdAt,
          processedAt: cancelledAt ?? createdAt, createdAt: cancelledAt ?? createdAt,
        },
      });
    }

    if ((status === "CONFIRMED" || status === "CANCELLED") && chance(0.025)) {
      const proposedStart = new Date(apptDate.getTime() + DAY_MS + startMinutes * 60_000);
      await prisma.appointmentChangeRequest.create({
        data: {
          bookingId: booking.id, requestedBy: customerUserIds[custIdx], requestedByType: "CUSTOMER",
          requestType: status === "CANCELLED" ? "CANCEL" : "RESCHEDULE",
          proposedStartTime: status === "CANCELLED" ? null : proposedStart,
          proposedEndTime: status === "CANCELLED" ? null : new Date(proposedStart.getTime() + svc.durationMinutes * 60_000),
          reason: status === "CANCELLED" ? "Khách thay đổi kế hoạch." : "Khách muốn đổi sang ngày kế tiếp.",
          status: chance(0.25) ? "PENDING" : chance(0.75) ? "APPROVED" : "REJECTED",
          reviewedBy: adminUser.id, reviewedAt: new Date(createdAt.getTime() + 2 * 60 * 60_000),
          reviewNote: "Đã xử lý theo khả năng phục vụ của chi nhánh.",
          expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60_000), createdAt,
        },
      });
    }

    // review cho ~60% booking COMPLETED
    if (status === "COMPLETED" && chance(0.6)) {
      const rating = pick([1, 2, 3, 4, 4, 4, 5, 5, 5, 5, 5, 5]);
      const review = await prisma.review.create({
        data: {
          bookingId: booking.id,
          customerId: customerProfileIds[custIdx],
          overallRating: rating,
          comment: pick([
            "Dịch vụ tuyệt vời, nhân viên nhiệt tình.",
            "Rất hài lòng, sẽ quay lại.",
            "Salon sạch sẽ, giá hợp lý.",
            "Nhân viên chuyên nghiệp, tay nghề cao.",
            "Ok, tạm ổn.",
            "Thợ cắt tóc rất có tâm.",
            "Không gian thoải mái, dịch vụ tốt.",
            "Hơi chờ lâu nhưng kết quả đẹp.",
          ]),
          status: chance(0.9) ? "APPROVED" : "PENDING",
          createdAt: new Date(paidAt ? paidAt.getTime() + 86400000 : createdAt.getTime() + 86400000),
        },
      });
      // rating service
      const bs = await prisma.bookingService.findFirst({ where: { bookingId: booking.id } });
      if (bs) {
        await prisma.reviewServiceRating.create({
          data: {
            reviewId: review.id,
            bookingServiceId: bs.id,
            staffId: staff.id,
            rating,
            createdAt: review.createdAt,
          },
        });
      }
      if (rating <= 2 && chance(0.6)) {
        await prisma.reviewReport.create({
          data: { reviewId: review.id, reporterId: adminUser.id, reason: "Nội dung cần kiểm tra theo quy trình kiểm duyệt.", createdAt: new Date(review.createdAt.getTime() + 60 * 60_000) },
        });
        await prisma.review.update({ where: { id: review.id }, data: { status: chance(0.5) ? "HIDDEN" : "PENDING" } });
      }
    }

    if ((i + 1) % 500 === 0) console.log(`  -> ${i + 1} bookings`);
  }
  console.log(`  -> Tổng ${bookingIds.length} bookings`);

  // ============================================================
  // 12. ATTENDANCE / LEAVE / EXCEPTIONS
  // ============================================================
  console.log("Tạo lịch sử chấm công, nghỉ phép và yêu cầu ngoại lệ...");
  const businessIdByBranch = new Map(branches.map((branch) => [branch.id, branch.businessId]));
  const attendanceStart = new Date(Math.max(SEED_START_DATE.getTime(), SEED_END_DATE.getTime() - seedConfig.attendanceDays * DAY_MS));
  const attendanceRows: Prisma.StaffAttendanceCreateManyInput[] = [];
  const todayKey = SEED_END_DATE.toISOString().slice(0, 10);
  const yesterdayKey = new Date(SEED_END_DATE.getTime() - DAY_MS).toISOString().slice(0, 10);
  for (let staffIndex = 0; staffIndex < staffRecords.length; staffIndex++) {
    const staff = staffRecords[staffIndex];
    for (let cursor = new Date(attendanceStart); cursor <= SEED_END_DATE; cursor = new Date(cursor.getTime() + DAY_MS)) {
      if (cursor.getUTCDay() === 0) continue;
      const date = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()));
      const dateKey = date.toISOString().slice(0, 10);
      let status: Prisma.StaffAttendanceCreateManyInput["status"] = "CHECKED_OUT";
      let lateMinutes = 0;
      let earlyLeaveMinutes = 0;
      let checkInAt: Date | null = atUtcTime(date, 9, randInt(-5, 8));
      let checkOutAt: Date | null = atUtcTime(date, 18, randInt(0, 25));
      if (dateKey === todayKey) {
        status = pick(["CHECKED_IN", "LATE", "ABSENT", "NOT_CHECKED_IN"] as const);
        checkOutAt = null;
        if (status === "NOT_CHECKED_IN" || status === "ABSENT") checkInAt = null;
        if (status === "LATE") { lateMinutes = randInt(12, 45); checkInAt = atUtcTime(date, 9, lateMinutes); }
      } else if (dateKey === yesterdayKey && staffIndex % 17 === 0) {
        status = "MISSING_CHECKOUT";
        checkOutAt = null;
      } else {
        const roll = rand();
        if (roll < 0.04) { status = "ABSENT"; checkInAt = null; checkOutAt = null; }
        else if (roll < 0.12) { status = "LATE"; lateMinutes = randInt(11, 50); checkInAt = atUtcTime(date, 9, lateMinutes); }
        else if (roll < 0.16) { status = "LEFT_EARLY"; earlyLeaveMinutes = randInt(10, 60); checkOutAt = atUtcTime(date, 18, -earlyLeaveMinutes); }
        else if (roll < 0.19) { status = "MISSING_CHECKOUT"; checkOutAt = null; }
      }
      attendanceRows.push({
        businessId: businessIdByBranch.get(staff.branchId)!, branchId: staff.branchId, staffId: staff.id, userId: staff.userId,
        workDate: date, scheduledStartTime: new Date("1970-01-01T09:00:00.000Z"), scheduledEndTime: new Date("1970-01-01T18:00:00.000Z"),
        checkInAt, checkOutAt, checkInMethod: checkInAt ? (chance(0.92) ? "QR" : "MANUAL_EXCEPTION") : null,
        checkOutMethod: checkOutAt ? (chance(0.92) ? "QR" : "MANUAL_ADJUSTMENT") : null,
        status, lateMinutes, earlyLeaveMinutes, overtimeMinutes: checkOutAt && checkOutAt.getUTCHours() >= 19 ? randInt(15, 60) : 0,
        note: status === "ABSENT" ? "Vắng đột xuất; quản lý đã tiếp nhận xử lý lịch liên quan." : null,
        absentMarkedBy: status === "ABSENT" ? adminUser.id : null, absentMarkedAt: status === "ABSENT" ? atUtcTime(date, 9, 45) : null,
        createdAt: date, updatedAt: date,
      });
    }
  }
  for (let offset = 0; offset < attendanceRows.length; offset += 2000) {
    await prisma.staffAttendance.createMany({ data: attendanceRows.slice(offset, offset + 2000) });
    if (offset && offset % 10000 === 0) console.log(`  -> ${offset} attendance records`);
  }

  const leaveCount = Math.min(staffRecords.length, SEED_MODE === "small" ? 8 : SEED_MODE === "demo" ? 50 : 180);
  for (let i = 0; i < leaveCount; i++) {
    const staff = staffRecords[i];
    const startAt = randDate(attendanceStart, SEED_END_DATE);
    await prisma.staffLeave.create({
      data: { staffId: staff.id, startAt, endAt: new Date(startAt.getTime() + DAY_MS), reason: pick(["Nghỉ phép năm", "Việc gia đình", "Khám sức khỏe"]), status: chance(0.82) ? "APPROVED" : chance(0.5) ? "PENDING" : "REJECTED", reviewedBy: adminUser.id, reviewNote: "Dữ liệu lịch nghỉ production-like." },
    });
  }

  const exceptionCount = Math.min(staffRecords.length, SEED_MODE === "small" ? 8 : SEED_MODE === "demo" ? 60 : 200);
  for (let i = 0; i < exceptionCount; i++) {
    const staff = staffRecords[i];
    const workDate = i < 6 ? new Date(Date.UTC(SEED_END_DATE.getUTCFullYear(), SEED_END_DATE.getUTCMonth(), SEED_END_DATE.getUTCDate())) : randDate(attendanceStart, SEED_END_DATE);
    const requestStatus = i < 3 ? "PENDING" : pick(["PENDING", "APPROVED", "APPROVED", "REJECTED"] as const);
    await prisma.attendanceExceptionRequest.create({
      data: {
        businessId: businessIdByBranch.get(staff.branchId)!, branchId: staff.branchId, staffId: staff.id, requestedBy: staff.userId,
        type: pick(["CHECK_IN", "CHECK_OUT", "ADJUST_TIME"] as const), workDate,
        proposedAt: atUtcTime(workDate, chance(0.7) ? 9 : 18, randInt(0, 20)),
        reason: pick(["Quên check-in.", "Quên check-out.", "QR tại quầy chưa được mở.", "Máy quầy lỗi hoặc mất mạng."]),
        status: requestStatus, reviewedBy: requestStatus === "PENDING" ? null : adminUser.id,
        reviewedAt: requestStatus === "PENDING" ? null : new Date(workDate.getTime() + DAY_MS),
        reviewReason: requestStatus === "REJECTED" ? "Thời gian đề nghị không khớp lịch làm việc." : requestStatus === "APPROVED" ? "Đã đối chiếu lịch ca và xác nhận." : null,
        createdAt: workDate,
      },
    });
  }

  // ============================================================
  // 13. TRUST & SAFETY
  // ============================================================
  console.log("Tạo trust snapshots và lịch sử xử lý vi phạm...");
  for (let i = 0; i < businesses.length; i++) {
    const business = businesses[i];
    const danger = i === 8;
    const warn = i === 7;
    await prisma.salonTrustSnapshot.create({
      data: {
        businessId: business.id, totalBookings: Math.floor(bookingIds.length / Math.max(1, businesses.length)),
        cancellationRate: danger ? 0.28 : warn ? 0.16 : 0.05 + rand() * 0.04,
        noShowRate: danger ? 0.08 : warn ? 0.05 : 0.01 + rand() * 0.02,
        avgRejectTimeMinutes: danger ? 180 : warn ? 95 : 20 + randInt(0, 30),
        lateCancelBySalonRate: danger ? 0.18 : warn ? 0.10 : 0.01,
        trustScore: danger ? 42 : warn ? 68 : 88 + randInt(0, 10), alertLevel: danger ? "DANGER" : warn ? "WARN" : "OK",
        computedAt: SEED_END_DATE,
      },
    });
    const actionCount = danger ? 8 : warn ? 6 : 4;
    for (let actionIndex = 0; actionIndex < actionCount; actionIndex++) {
      await prisma.trustAction.create({
        data: {
          businessId: business.id, branchId: actionIndex % 2 ? branches.find((branch) => branch.businessId === business.id)?.id : null,
          actorId: adminUser.id,
          action: danger ? pick(["WARNING_SENT", "EXPLANATION_REQUESTED", "MONITORING_STARTED", "BOOKING_RESTRICTED", "SUSPENDED"] as const) : warn ? pick(["WARNING_SENT", "EXPLANATION_REQUESTED", "MONITORING_STARTED"] as const) : "NOTE_ADDED",
          reason: danger ? "Tỷ lệ hủy sát giờ và khiếu nại vượt ngưỡng theo dõi." : warn ? "Xác nhận lịch chậm và tỷ lệ hủy tăng." : "Đánh giá định kỳ: vận hành ổn định.",
          internalNote: "Tình huống production-like phục vụ demo Trust & Safety.",
          statusBefore: actionIndex === 0 ? "ACTIVE" : null, statusAfter: danger && actionIndex === actionCount - 1 ? "SUSPENDED" : null,
          createdAt: randDate(SEED_START_DATE, SEED_END_DATE),
        },
      });
    }
  }

  // ============================================================
  // 14. BUSINESS COMMENTS (một số)
  // ============================================================
  console.log("Tạo bình luận doanh nghiệp...");
  const commentSample = seedConfig.comments;
  for (let i = 0; i < commentSample; i++) {
    const b = pick(businesses);
    const custIdx = randInt(0, customerProfileIds.length - 1);
    await prisma.businessComment.create({
      data: {
        businessId: b.id,
        customerId: customerProfileIds[custIdx],
        content: pick([
          "Salon đẹp, phục vụ chuyên nghiệp. Sẽ quay lại!",
          "Nhân viên nhiệt tình, giá cả hợp lý.",
          "Không gian sang trọng, rất thích.",
          "Dịch vụ tốt nhưng hơi đông vào cuối tuần.",
          "Stylist cắt tóc đẹp, tư vấn nhiệt tình.",
          "Đã là khách quen nhiều năm, rất tin tưởng.",
          "Spa thư giãn, nhân viên tay nghề cao.",
          "Giá hơi cao nhưng chất lượng xứng đáng.",
        ]),
        status: chance(0.9) ? "VISIBLE" : "HIDDEN",
      },
    });
  }

  // ============================================================
  // 15. NOTIFICATIONS
  // ============================================================
  console.log("Tạo thông báo...");
  const notifSample = seedConfig.notifications;
  for (let i = 0; i < notifSample; i++) {
    const custIdx = randInt(0, customerUserIds.length - 1);
    const type = pick(["BOOKING_CONFIRMED", "BOOKING_REMINDER", "BOOKING_CANCELLED", "PROMOTION", "SYSTEM", "PAYMENT", "BOOKING_RESCHEDULE_REQUEST", "BOOKING_PAYMENT_RECEIVED", "REVIEW_REMINDER", "SALON_VIOLATION_ALERT"] as const);
    const booking = bookingIds.length ? pick(bookingIds) : null;
    const titles: Record<typeof type, string> = {
      BOOKING_CONFIRMED: "Đặt lịch thành công",
      BOOKING_REMINDER: "Nhắc lịch hẹn",
      BOOKING_CANCELLED: "Lịch hẹn đã bị hủy",
      PROMOTION: "Khuyến mãi hấp dẫn",
      SYSTEM: "Thông báo hệ thống",
      PAYMENT: "Thanh toán thành công",
      BOOKING_RESCHEDULE_REQUEST: "Yêu cầu đổi lịch mới",
      BOOKING_PAYMENT_RECEIVED: "Đã nhận thanh toán",
      REVIEW_REMINDER: "Mời bạn đánh giá dịch vụ",
      SALON_VIOLATION_ALERT: "Cảnh báo vận hành cơ sở",
    };
    const operationalRecipients = [...owners.map((owner) => owner.userId), ...staffRecords.map((staff) => staff.userId), ...platformUserIds];
    let recipientId = customerUserIds[custIdx];
    if (chance(0.25)) {
      recipientId = pick(operationalRecipients);
    }
    await prisma.notification.create({
      data: {
        userId: recipientId,
        type,
        title: titles[type],
        body: `Thông báo ${titles[type]} từ GlowBook.`,
        isRead: chance(0.6),
        relatedBookingId: booking,
        createdAt: randDate(SEED_START_DATE, SEED_END_DATE),
      },
    });
  }

  // ============================================================
  // 16. AUDIT LOGS
  // ============================================================
  console.log("Tạo audit log...");
  const auditSample = seedConfig.audits;
  for (let i = 0; i < auditSample; i++) {
    const action = pick(["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "STATUS_CHANGE"] as const);
    await prisma.auditLog.create({
      data: {
        userId: chance(0.7) ? adminUser.id : pick(owners).userId,
        action,
        entityType: pick(["Business", "Branch", "Booking", "User", "Promotion", "Payment", "RefundRequest", "Review", "StaffAttendance", "AttendanceExceptionRequest", "TrustAction", "PlatformSetting"]),
        entityId: null,
        oldData:
          action === "UPDATE" || action === "STATUS_CHANGE"
            ? { previous: "value" }
            : undefined,
        newData:
          action === "CREATE" || action === "UPDATE"
            ? { updated: "value" }
            : undefined,
        reason: pick(["Cập nhật vận hành định kỳ.", "Xử lý yêu cầu người dùng.", "Đối soát dữ liệu và ghi nhận lịch sử.", "Điều chỉnh theo chính sách nền tảng."]),
        createdAt: randDate(SEED_START_DATE, SEED_END_DATE),
      },
    });
  }

  const report = {
    users: await prisma.user.count(), businesses: await prisma.business.count(), branches: await prisma.branch.count(),
    staff: await prisma.staffProfile.count(), customers: await prisma.customerProfile.count(), services: await prisma.branchServiceOffering.count(),
    bookings: await prisma.booking.count(), payments: await prisma.payment.count(), refunds: await prisma.refundRequest.count(),
    reviews: await prisma.review.count(), attendance: await prisma.staffAttendance.count(), attendanceExceptions: await prisma.attendanceExceptionRequest.count(),
    notifications: await prisma.notification.count(), auditLogs: await prisma.auditLog.count(), trustSnapshots: await prisma.salonTrustSnapshot.count(),
    trustActions: await prisma.trustAction.count(), onboardingEvents: await prisma.businessReviewEvent.count(),
  };
  console.table(report);

  console.log("\nSeed hoàn tất!");
  console.log("\nTài khoản đăng nhập (mật khẩu: Password123!):");
  console.log("  Admin       : admin@glowbook.vn");
  console.log("  Chủ DN #1   : lananh.owner@glowbook.vn");
  console.log("  Quản lý CN  : manager@glowbook.vn");
  console.log("  Lễ tân      : reception@glowbook.vn");
  console.log("  Nhân viên   : staff@glowbook.vn");
  console.log("  Khách #1    : khach0001@glowbook.vn");
  console.log(`  Khách cuối  : khach${String(TOTAL_CUSTOMERS).padStart(4, "0")}@glowbook.vn`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed lỗi:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
