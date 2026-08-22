# BÁO CÁO PHẠM VI CÔNG VIỆC, CÔNG NGHỆ VÀ TIẾN ĐỘ DỰ ÁN BEAUTYBOOK

## 1. Thông tin chung

| Nội dung | Thông tin |
|---|---|
| Tên dự án | BeautyBook – Nền tảng đặt lịch và quản trị cơ sở làm đẹp |
| Người thực hiện | Thành viên phụ trách Full-stack và tích hợp hệ thống |
| Vai trò | Full-stack Developer / Backend & System Integration |
| Phạm vi chính | Nghiệp vụ, Backend API, phân quyền, tích hợp Frontend, cơ sở dữ liệu, bảo mật và kiểm thử |
| Ngày cập nhật | 08/08/2026 |
| Trạng thái | Các luồng cốt lõi đã hoạt động; đang hoàn thiện các điều kiện production readiness |

---

## 2. Tổng quan dự án

BeautyBook là nền tảng SaaS phục vụ hai nhóm người dùng lớn:

1. **Khách hàng cá nhân**: tìm kiếm salon/spa/dịch vụ làm đẹp, xem thông tin, đặt lịch, sử dụng voucher, thanh toán và đánh giá sau dịch vụ.
2. **Doanh nghiệp làm đẹp**: quản lý doanh nghiệp, chi nhánh, dịch vụ, nhân viên, lịch làm việc, lịch hẹn, thanh toán, khuyến mãi, đánh giá, báo cáo và hoạt động vận hành.

Hệ thống đồng thời cung cấp không gian quản trị nền tảng cho các vai trò Platform Admin, Finance, Marketing, Compliance và Support. Đây là hệ thống **đa doanh nghiệp (multi-tenant)**, vì vậy dữ liệu và quyền thao tác của từng doanh nghiệp, chi nhánh và người dùng phải được tách biệt rõ ràng.

Mục tiêu kỹ thuật không chỉ là xây dựng giao diện và API hoạt động, mà còn bảo đảm:

- Đúng phạm vi dữ liệu của từng doanh nghiệp và chi nhánh.
- Đúng thẩm quyền của từng vai trò.
- Không tạo kết quả thanh toán, gửi email hoặc tích hợp nhà cung cấp giả.
- Không để Platform Admin can thiệp trực tiếp vào hoạt động thường ngày của salon.
- Các thao tác tài chính có khả năng truy vết, chống thực thi lặp và giữ được tính nhất quán dữ liệu.
- Có thể kiểm thử, đóng gói và triển khai nhất quán bằng Docker và CI.

---

## 3. Phạm vi công việc cá nhân

### 3.1. Phân tích nghiệp vụ và kiến trúc hệ thống

Phạm vi của tôi bao gồm việc đọc và đối chiếu các yêu cầu nghiệp vụ với source code hiện tại, từ đó xác định ranh giới giữa các miền nghiệp vụ:

- Identity và Authentication.
- Authorization, RBAC và permission scope.
- Doanh nghiệp và chi nhánh.
- Dịch vụ, combo và gói trị liệu.
- Nhân sự, lịch làm việc, chấm công và tính lương.
- Booking, recurring booking và appointment change request.
- Thanh toán, hoàn tiền, ledger, platform fee và statement.
- Voucher, promotion và campaign.
- Review, report và moderation.
- Notification và realtime event.
- Trust & Safety, compliance và audit log.
- Media và tài liệu doanh nghiệp.

Nhiệm vụ quan trọng nhất là xác định **ai được phép thực hiện hành động nào, trên dữ liệu nào và trong điều kiện nào**. Việc kiểm tra quyền không chỉ được đặt tại giao diện hoặc controller mà phải được xác nhận lại ở service, dựa trên dữ liệu đã lưu trong database.

### 3.2. Backend API và business logic

Tôi phụ trách kiểm tra, hoàn thiện và bảo vệ các API liên quan đến:

- Đăng nhập, refresh token, đăng xuất và thu hồi phiên.
- Người dùng, vai trò và permission.
- Onboarding doanh nghiệp, quản lý cơ sở và chi nhánh.
- Danh mục dịch vụ, combo, nhân viên và phân công chi nhánh.
- Lịch làm việc, nghỉ phép, schedule change request và attendance.
- Tạo, xác nhận, check-in, thực hiện, hoàn thành hoặc hủy lịch hẹn.
- Thanh toán, xác minh chuyển khoản, hoàn tiền và đối soát.
- Voucher, promotion và chiến dịch nền tảng/doanh nghiệp.
- Đánh giá, phản hồi của cơ sở, báo cáo và kiểm duyệt.
- Báo cáo vận hành và các màn hình quản trị nền tảng.

### 3.3. Frontend và tích hợp API

Phần Frontend được kiểm tra theo các nhóm vai trò Guest, Customer, Staff, Receptionist, Branch Manager, Business Owner, Support, Compliance, Marketing, Finance và Platform Admin.

Phạm vi tích hợp gồm:

- Điều hướng đúng route theo vai trò và trạng thái đăng nhập.
- Gọi đúng API thật, không sử dụng nút chết hoặc phản hồi thành công giả.
- Hiển thị lịch hẹn dưới dạng calendar/scheduler.
- Quản lý trạng thái dùng chung bằng Zustand.
- Nhận notification/realtime event qua Socket.IO.
- Hiển thị biểu đồ và dữ liệu báo cáo bằng Recharts.
- Xử lý ngày, tuần, tháng và khoảng thời gian bằng date-fns.
- Responsive trên desktop, tablet và mobile.

### 3.4. Cơ sở dữ liệu và migration

Tôi kiểm tra schema Prisma, quan hệ dữ liệu, migration và các quy tắc toàn vẹn liên quan đến:

- User, role, permission, session và account token.
- Business, branch, service, combo, staff và schedule.
- Booking và lịch sử trạng thái.
- Payment, transaction, refund, ledger, fee và statement.
- Voucher, promotion và customer voucher.
- Treatment package, installment và session entitlement.
- Review, report, trust snapshot và audit log.
- Attendance, timesheet, compensation và payroll.

Database hiện sử dụng **33 Prisma migration**. Migration được áp dụng bằng `prisma migrate deploy`, không đồng nhất migration production với việc chạy seed. Dữ liệu được lưu trong PostgreSQL volume của Docker và không bị xóa khi chỉ dừng hoặc khởi động lại container.

### 3.5. Bảo mật và production readiness

Phần việc bảo mật tập trung vào:

- JWT access token và refresh token.
- Blacklist/revocation token trên Redis.
- Hash mật khẩu bằng bcrypt.
- RBAC và permission theo scope Platform, Business và Branch.
- Tenant isolation tại service layer.
- Validation dữ liệu đầu vào.
- Rate limiting và HTTP security headers.
- Bảo vệ secret, encryption key và attendance QR secret.
- Không ghi token, nội dung email hoặc dữ liệu nhạy cảm vào log.
- Idempotency cho các thao tác tài chính có thể bị gửi lặp.
- Audit trail cho hành động nhạy cảm.

### 3.6. Kiểm thử, CI và vận hành

Tôi phụ trách chạy và kiểm tra:

- Unit test bằng Jest.
- Integration/E2E test bằng Jest và Supertest.
- Prisma validate/generate/migrate.
- OpenAPI generation và kiểm tra tài liệu API có đồng bộ với source.
- Production build cho Backend và Frontend.
- Docker Compose runtime và health check.
- GitHub Actions cho cả hai lớp Backend và Frontend.

---

## 4. Công nghệ, thư viện và protocol sử dụng

### 4.1. Backend

| Công nghệ/thư viện | Phiên bản/vai trò |
|---|---|
| Node.js | 22, môi trường thực thi Backend và build Frontend |
| TypeScript | 5.7, ngôn ngữ chính của Backend |
| NestJS | 11, framework tổ chức module, controller, service, guard và interceptor |
| Prisma ORM | 7.8, schema, migration và truy vấn PostgreSQL |
| PostgreSQL | 16 trong Docker, cơ sở dữ liệu quan hệ chính |
| Redis/ioredis | Redis 7, lưu blacklist token và trạng thái cần chia sẻ giữa các instance |
| Passport + passport-jwt | Xác thực JWT Bearer Token |
| bcryptjs | Băm và kiểm tra mật khẩu |
| class-validator | Validation DTO và dữ liệu request |
| class-transformer | Chuyển đổi dữ liệu request/response |
| Helmet | Thiết lập các HTTP security header |
| NestJS Throttler | Rate limiting |
| Nodemailer | Gửi email qua SMTP |
| Socket.IO | Giao tiếp realtime |
| Jest + Supertest | Unit test, integration test và E2E test |

### 4.2. Frontend

| Công nghệ/thư viện | Phiên bản/vai trò |
|---|---|
| React | 18.3, xây dựng giao diện theo component |
| Vite | 5.4, development server và production build |
| React Router DOM | 6.30, định tuyến theo khu vực và vai trò |
| Zustand | 4.5, quản lý state phía client |
| Tailwind CSS | 3.4, hệ thống utility CSS và responsive layout |
| Recharts | 2.15, hiển thị biểu đồ báo cáo |
| date-fns | 4.4, xử lý ngày giờ và lịch hẹn |
| Socket.IO Client | 4.8, nhận dữ liệu realtime từ Backend |
| React Select | Thành phần chọn dữ liệu có tìm kiếm |
| React Hot Toast | Thông báo kết quả thao tác |
| QRCode | Sinh/hiển thị mã QR cho luồng phù hợp |
| Lucide React | Bộ icon giao diện |

### 4.3. Protocol và chuẩn giao tiếp

| Protocol/chuẩn | Cách sử dụng trong hệ thống |
|---|---|
| HTTP/HTTPS | Kênh giao tiếp chính giữa trình duyệt và API |
| REST + JSON | Thiết kế API và định dạng request/response |
| JWT Bearer | Truyền access token trong `Authorization` header |
| WebSocket/Socket.IO | Notification và sự kiện realtime |
| SMTP | Gửi email xác thực, khôi phục hoặc thông báo |
| OpenAPI | Mô tả hợp đồng API; hiện có 230 API paths được sinh tự động |
| PostgreSQL protocol | Kết nối Prisma/adapter-pg với database |
| Redis protocol | Kết nối Backend với kho blacklist token |
| Idempotency-Key | Chống tạo giao dịch hoặc tác vụ tài chính trùng lặp |

### 4.4. Hạ tầng và triển khai

- Docker Compose quản lý bốn service chính: `postgres`, `redis`, `api` và `web`.
- Backend được build bằng image Node 22 Alpine và chạy dưới user không phải root.
- Frontend được build bằng Node 22 và phục vụ bằng Nginx 1.27 Alpine.
- PostgreSQL, Redis và media sử dụng named volume để dữ liệu tồn tại qua các lần restart.
- Backend tự chạy `prisma migrate deploy` trước khi khởi động ứng dụng production.
- GitHub Actions dùng Node 22 và chạy kiểm tra độc lập cho Backend/Frontend.

---

## 5. Kiến trúc và luồng xử lý

### 5.1. Kiến trúc tổng quát

```text
Trình duyệt người dùng
        |
        | HTTP/JSON, JWT, Socket.IO
        v
React + Vite + Nginx
        |
        v
NestJS API
  |-- Controller: tiếp nhận request, auth và coarse permission
  |-- Guard/Interceptor: JWT, RBAC, rate limit, idempotency
  |-- Service: nghiệp vụ và persisted ownership check
  |-- Prisma: transaction và truy cập dữ liệu
        |                       |
        v                       v
PostgreSQL                  Redis
nghiệp vụ chính             token revocation
```

### 5.2. Nguyên tắc phân quyền

Hệ thống áp dụng nhiều lớp kiểm tra:

1. **Authentication**: xác định người dùng thông qua JWT.
2. **Role/permission**: xác định nhóm quyền được gán.
3. **Scope**: xác định quyền thuộc Platform, Business hay Branch.
4. **Persisted ownership**: truy vấn dữ liệu thật để xác nhận đối tượng thuộc đúng doanh nghiệp/chi nhánh.
5. **Business invariant**: kiểm tra hành động có hợp lệ với trạng thái hiện tại hay không.

Ví dụ, việc người dùng có permission cập nhật voucher chưa đủ để cho phép sửa mọi voucher. Service vẫn phải kiểm tra voucher đó thuộc Platform hay thuộc doanh nghiệp nào, đồng thời người dùng có thuộc đúng phạm vi đó hay không.

### 5.3. Phân tách vai trò

| Nhóm vai trò | Phạm vi chính |
|---|---|
| Guest | Khám phá thông tin công khai và bắt đầu luồng đăng ký/đăng nhập |
| Customer | Hồ sơ cá nhân, tìm kiếm, đặt lịch, voucher, thanh toán và đánh giá |
| Staff | Lịch làm việc, lịch được phân công, tiến trình phục vụ và chấm công |
| Receptionist | Lịch hẹn và vận hành tiếp đón trong chi nhánh được cấp quyền |
| Branch Manager | Quản lý vận hành, nhân sự và dữ liệu thuộc chi nhánh |
| Business Owner | Quản lý doanh nghiệp và các chi nhánh thuộc sở hữu |
| Marketing | Campaign/promotion ở phạm vi nền tảng theo quyền được cấp |
| Finance | Thanh toán, hoàn tiền, platform fee và statement theo thẩm quyền |
| Compliance | Xem xét tài liệu và trạng thái tuân thủ |
| Support | Hỗ trợ người dùng theo dữ liệu và quyền được cấp |
| Platform Admin | Quản trị, giám sát và governance; không thay salon vận hành hằng ngày |

---

## 6. Các hạng mục đã hoàn thành

### 6.1. Tách quyền Platform và quyền vận hành salon

Đã sửa các điểm có thể khiến Platform Admin vượt quá phạm vi governance:

- Platform Admin không được tạo lịch hẹn thay khách hàng hoặc cơ sở.
- Platform Admin không được thực hiện các cập nhật trạng thái booking thông thường.
- Platform Admin không được tự tạo hoặc chỉnh sửa chi nhánh, dịch vụ, combo và lịch nhân viên của doanh nghiệp.
- Vẫn giữ các quyền quản trị hợp lệ như đọc/giám sát, force-cancel và refund theo đúng điều kiện.
- Loại bỏ các permission Platform không phù hợp khỏi endpoint vận hành.
- Bổ sung kiểm tra tại service để controller không phải là lớp bảo vệ duy nhất.

### 6.2. Bảo vệ campaign, promotion và voucher

- Platform chỉ quản lý voucher thật sự thuộc Platform.
- Platform không được sửa voucher hoặc campaign thuộc doanh nghiệp.
- Doanh nghiệp không được tạo voucher mang phạm vi Platform.
- Doanh nghiệp không được liên kết campaign sang branch, service hoặc business không thuộc quyền quản lý.
- Campaign toàn cục không được chứa liên kết tài nguyên tenant.

### 6.3. Thu hồi permission nguy hiểm

Đã bổ sung migration để vô hiệu hóa các direct grant vận hành không phù hợp từng được cấp cho tài khoản Platform, gồm các nhóm quyền tạo/cập nhật booking, chi nhánh, dịch vụ, lịch nhân viên và phê duyệt change request.

Service cấp quyền trực tiếp hiện cũng từ chối những permission này để tránh chúng được cấp lại sau migration.

### 6.4. Bảo mật email và dữ liệu nhạy cảm

- Loại bỏ credential email giả khỏi source.
- Không ghi HTML email, token hoặc nội dung nhạy cảm vào console.
- Môi trường production thiếu mail credential sẽ dừng với lỗi cấu hình rõ ràng.
- Môi trường development không cấu hình email chỉ ghi metadata `EMAIL DISABLED`.
- Bổ sung kiểm tra encryption key và attendance QR secret khi khởi động production.

### 6.5. Thu hồi phiên đăng nhập

- Redis là nguồn lưu blacklist token trong production.
- Production không được âm thầm chuyển sang memory fallback nếu Redis lỗi.
- Môi trường development vẫn có fallback có kiểm soát để hỗ trợ phát triển local.
- Secret dùng cho QR attendance phải đủ mạnh và không được trùng JWT secret.

### 6.6. Idempotency và an toàn tài chính

Đã yêu cầu `Idempotency-Key` đối với các thao tác có nguy cơ bị gửi lặp:

- Mua treatment package.
- Thanh toán installment.
- Reserve package session.
- Verify hoặc reverse transaction.
- Tạo platform statement.

Hệ thống payment hiện chỉ công nhận các adapter đã có xử lý thật:

- `CASH`.
- `MANUAL_BANK_TRANSFER`.

Các phương thức MoMo, VNPay, ZaloPay, credit card và mock online bị từ chối rõ ràng nếu chưa có adapter thật. Chuyển khoản thủ công phải ở trạng thái chờ đến khi có bằng chứng và được người có thẩm quyền xác minh.

### 6.7. Database và backup hygiene

- Đã áp dụng đủ 33 migration.
- Không chạy seed trong quá trình audit/fix nên không xóa dữ liệu hiện có.
- Bổ sung ignore rule cho `.env`, database dump, `node_modules`, build output và coverage.
- File backup hiện có được giữ nguyên.
- Bổ sung hướng dẫn xem database dump là dữ liệu nhạy cảm và cần lưu trong encrypted object storage khi triển khai thật.

### 6.8. CI và tài liệu API

Pipeline CI hiện thực hiện:

1. Cài dependency bằng `npm ci`.
2. Validate và generate Prisma Client.
3. Chạy unit test.
4. Chạy E2E test.
5. Sinh OpenAPI và kiểm tra file tài liệu có thay đổi ngoài ý muốn.
6. Build Backend.
7. Build Frontend.

OpenAPI hiện sinh được **230 paths** từ source.

---

## 7. Tiến độ hiện tại và bằng chứng kiểm chứng

### 7.1. Trạng thái theo hạng mục

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Kiến trúc API và module cốt lõi | Đã hoàn thành phần chính | Backend build thành công |
| Authentication và session | Đã hoàn thành phần chính | JWT, refresh, logout và Redis revocation |
| RBAC và tenant isolation | Đã gia cố | Đã bổ sung negative test và persisted ownership check |
| Business/branch/service/staff | Đã hoạt động | Cần tiếp tục regression khi thêm nghiệp vụ mới |
| Booking và calendar | Đã hoạt động | Luồng calendar/scheduler được giữ nguyên |
| Payment và refund nội bộ | Đã hoạt động | Cash/manual transfer; chưa tích hợp cổng online thật |
| Voucher và promotion | Đã gia cố ownership | Đã tách Platform và tenant campaign |
| Workforce và attendance | Đã hoạt động | Có schedule, exception, timesheet và compensation model |
| Review và moderation | Đã hoạt động | Cơ sở phản hồi/report; Platform moderation |
| Compliance | Hoạt động ở mức trạng thái dẫn xuất | Chưa có compliance-case aggregate độc lập |
| Support/dispute | Chưa hoàn chỉnh | Chưa có vòng đời case/dispute đầy đủ |
| Observability production | Cơ bản | Có log/health/request context; chưa có metrics/tracing/error tracking ngoài hệ thống |
| Docker và CI | Đã hoạt động | Runtime và production build đã kiểm tra |

### 7.2. Kết quả kiểm thử gần nhất

- **263 test pass**.
- **5 test skip có chủ đích**.
- **2/2 E2E test pass**.
- **53 file kiểm thử** hiện có trong Backend.
- Backend production build thành công.
- Frontend production build thành công với 3.344 module được xử lý.
- PostgreSQL và Redis ở trạng thái healthy.
- API health live/ready trả kết quả thành công.
- Web trả HTTP 200 tại `http://localhost:8080`.
- Database đã đồng bộ đủ 33 migration.

### 7.3. Đánh giá mức hoàn thành

Các luồng cốt lõi của sản phẩm đã có đủ nền tảng để demo, kiểm thử nghiệp vụ và tiếp tục phát triển. Phần đã hoàn thành tốt nhất là kiến trúc ứng dụng, quản lý tenant, booking, workforce, permission, Docker runtime và kiểm thử tự động.

Hệ thống **chưa nên được tuyên bố production-ready tuyệt đối** cho đến khi chốt các chính sách nghiệp vụ còn thiếu, tích hợp nhà cung cấp thanh toán thật và bổ sung observability production.

---

## 8. Vấn đề đang gặp phải

### 8.1. Chính sách gói trả góp chưa được chốt

Hiện package có thể chuyển sang trạng thái hoạt động sau khi khách hàng thanh toán một phần, trong khi toàn bộ session entitlement có thể trở nên khả dụng. Cần quyết định rõ:

- Thanh toán bao nhiêu phần trăm thì được dùng bao nhiêu buổi.
- Có khóa các buổi chưa thanh toán hay không.
- Xử lý thế nào nếu installment quá hạn.
- Hoàn tiền và thu hồi entitlement theo nguyên tắc nào.

Đây là quyết định sản phẩm/tài chính; không nên tự đặt quy tắc trong code khi chưa được phê duyệt.

### 8.2. Chưa có support case/dispute aggregate đầy đủ

Hệ thống cần một mô hình nghiệp vụ độc lập cho support case hoặc dispute, bao gồm:

- Người mở case và đối tượng liên quan.
- Phân loại và mức độ ưu tiên.
- Người được phân công xử lý.
- Bằng chứng đính kèm.
- SLA và thời hạn phản hồi.
- Lịch sử trạng thái.
- Kết luận và hành động sau xử lý.

### 8.3. Compliance mới ở mức trạng thái dẫn xuất

Compliance hiện chủ yếu dựa trên trạng thái doanh nghiệp, chi nhánh và tài liệu. Cần cân nhắc xây dựng `ComplianceCase` độc lập để quản lý quá trình review, yêu cầu bổ sung, bằng chứng, quyết định và appeal.

### 8.4. Chưa tích hợp cổng thanh toán online thật

Hệ thống chưa có credential và adapter production cho MoMo, VNPay, ZaloPay hoặc credit card. Để hoàn thành cần:

- Tài khoản merchant/sandbox chính thức.
- Quy tắc ký request và xác minh chữ ký callback.
- Webhook endpoint an toàn và idempotent.
- Reconciliation job.
- Xử lý timeout, retry và webhook đến sai thứ tự.
- Kiểm thử sandbox và quy trình chuyển production.

### 8.5. Observability chưa hoàn chỉnh

Hiện có health check, log ứng dụng và request context, nhưng hệ thống production lớn cần thêm:

- Error tracking tập trung.
- Metrics về latency, error rate, throughput và queue/backlog.
- Alert theo SLO/SLA.
- Distributed tracing giữa Web, API, database và provider.
- Dashboard vận hành và quy trình xử lý sự cố.

### 8.6. Phạm vi chưa đánh giá trong đợt này

Module Privacy có tồn tại trong source và schema, nhưng được loại khỏi phạm vi audit/fix của đợt công việc hiện tại theo yêu cầu. Vì vậy báo cáo này không kết luận mức độ hoàn chỉnh pháp lý hoặc kỹ thuật của Privacy/Data Subject Request.

---

## 9. Định hướng phát triển tiếp theo

### Giai đoạn 1 – Chốt nghiệp vụ còn thiếu

1. Chốt chính sách installment và package entitlement.
2. Định nghĩa vòng đời support case/dispute.
3. Định nghĩa compliance case, escalation và appeal.
4. Chốt chính sách platform fee, statement và reconciliation.

### Giai đoạn 2 – Hoàn thiện tích hợp production

1. Chọn payment provider chính thức.
2. Phát triển adapter và webhook verification.
3. Thiết lập SMTP/provider email production.
4. Chọn object storage cho media và backup.
5. Quản lý secret bằng secret manager thay vì file cấu hình thủ công.

### Giai đoạn 3 – Nâng mức độ tin cậy

1. Bổ sung negative test cho toàn bộ role/scope quan trọng.
2. Bổ sung concurrency test cho booking và payment.
3. Kiểm thử restore backup định kỳ.
4. Bổ sung metrics, tracing, alert và error tracking.
5. Thực hiện security review và penetration test trước khi public production.

### Giai đoạn 4 – Tối ưu sản phẩm

1. Theo dõi conversion từ explore đến booking.
2. Tối ưu hiệu năng calendar và báo cáo nhiều chi nhánh.
3. Chuẩn hóa audit dashboard cho Platform.
4. Cải thiện accessibility và responsive trên các thiết bị nhỏ.
5. Đánh giá index/database query theo dữ liệu thực tế.

---

## 10. Rủi ro và biện pháp kiểm soát

| Rủi ro | Ảnh hưởng | Biện pháp |
|---|---|---|
| Truy cập chéo doanh nghiệp | Rò rỉ hoặc sửa dữ liệu tenant khác | Persisted ownership check, scope permission và negative test |
| Platform vận hành thay salon | Sai ranh giới sản phẩm và trách nhiệm | Tách governance permission khỏi operational permission |
| Gửi request tài chính lặp | Giao dịch hoặc statement bị tạo trùng | Idempotency-Key, transaction và unique constraint phù hợp |
| Provider trả callback lặp/sai thứ tự | Sai trạng thái thanh toán | Chữ ký webhook, idempotency và state transition có điều kiện |
| Redis lỗi khi thu hồi token | Token đã logout vẫn có thể dùng | Production fail-closed, health check và monitoring Redis |
| Secret yếu hoặc bị log | Chiếm quyền truy cập | Startup validation, secret separation và log redaction |
| Backup bị commit hoặc phát tán | Lộ dữ liệu người dùng và tài chính | `.gitignore`, encryption, retention và access control |
| Quy tắc trả góp không rõ | Khách dùng dịch vụ vượt phần đã trả | Chốt policy trước khi thay đổi entitlement logic |

---

## 11. Cách trình bày ngắn khi bảo vệ

> Phạm vi của em là phát triển và kiểm tra hệ thống BeautyBook theo hướng full-stack, nhưng tập trung nhiều vào Backend, nghiệp vụ, phân quyền và tích hợp hệ thống. Em sử dụng NestJS, TypeScript, Prisma và PostgreSQL cho Backend; Redis cho thu hồi phiên; React, Vite, Zustand và Tailwind CSS cho Frontend. Frontend giao tiếp với API bằng REST/JSON qua HTTP, xác thực bằng JWT Bearer và nhận sự kiện realtime qua Socket.IO/WebSocket. Hệ thống chạy bằng Docker Compose và có CI kiểm tra Prisma, test, OpenAPI và production build.
>
> Định hướng của em là xây dựng BeautyBook thành nền tảng SaaS đa doanh nghiệp, trong đó Platform chỉ quản trị nền tảng và mỗi salon tự vận hành dữ liệu của mình. Hiện các luồng chính như auth, phân quyền, doanh nghiệp, chi nhánh, dịch vụ, nhân sự, booking, payment nội bộ, voucher và review đã hoạt động. Kết quả gần nhất có 263 test pass, 2/2 E2E pass, Backend và Frontend đều build thành công, database đủ 33 migration và các container đang hoạt động ổn định.
>
> Các vấn đề còn lại chủ yếu là quyết định nghiệp vụ và tích hợp production: chính sách sử dụng gói trả góp, vòng đời support/dispute, compliance case, cổng thanh toán online thật và hệ thống monitoring tập trung. Hướng tiếp theo là chốt các quy tắc này, bổ sung adapter provider thật, tăng kiểm thử tình huống biên và hoàn thiện observability trước khi triển khai production.

---

## 12. Kết luận

Phần công việc đã giải quyết được nền tảng kỹ thuật và phần lớn nghiệp vụ cốt lõi của BeautyBook. Kết quả quan trọng nhất không chỉ là các màn hình hoạt động, mà là việc hệ thống đã có ranh giới rõ hơn giữa Platform và salon, có lớp bảo vệ tenant ở Backend, có cơ chế kiểm thử tự động và có quy trình build/deploy lặp lại được.

BeautyBook hiện phù hợp để demo toàn hệ thống, kiểm thử nghiệp vụ và phát triển tiếp. Trước khi vận hành production với dữ liệu và tiền thật, nhóm cần hoàn thành các quyết định nghiệp vụ còn mở, tích hợp provider thật, triển khai monitoring và thực hiện một vòng kiểm thử bảo mật/khôi phục dữ liệu cuối cùng.
