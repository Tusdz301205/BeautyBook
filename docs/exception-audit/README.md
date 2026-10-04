# BeautyBook — audit ngoại lệ

Đợt khắc phục sau audit được theo dõi riêng tại [REMEDIATION-PLAN.md](REMEDIATION-PLAN.md), [REMEDIATION-RESULTS.md](REMEDIATION-RESULTS.md) và [DEFERRED-PAYMENT.md](DEFERRED-PAYMENT.md). Các số liệu và trạng thái bên dưới là **baseline audit**, không phải kết quả khắc phục mới.

Audit source và kiểm chứng cô lập trên worktree hiện tại; **không sửa mã ứng dụng, test, schema, migrations, seed, dependency hoặc cấu hình runtime**. Báo cáo phục vụ task khắc phục tiếp theo; không phải xác nhận hệ thống đã hết lỗi.

## Mốc và phạm vi

- Baseline UTC: 2026-09-26T08:27:07.070Z. Hoàn thiện tài liệu UTC: 2026-09-26T15:07:01.504Z. Ngày làm việc theo môi trường: 26/09/2026, Asia/Bangkok.
- Branch: **main**. HEAD: **761d3607297e72bb7765efe791a8dbcb71673d01**.
- Worktree có sẵn103 tracked files thay đổi,3504 insertions/8332 deletions, không có staged changes; còn untracked mobile/media/diagrams/report artifacts. Không phục hồi file đã xóa hoặc tiếp tục việc ảnh/sơ đồ cũ.
- Repository: C:/Users/Admin/Downloads/beauty-booking-api-main.
- Backend: [beauty-booking-api-main](../../beauty-booking-api-main/package.json) — NestJS/Prisma/PostgreSQL/Redis/Socket.IO/nodemailer.
- Web: [beauty-booking-web-main/beauty-booking-web-main](../../beauty-booking-web-main/beauty-booking-web-main/package.json) — React/Vite/Router/Zustand/fetch.
- Mobile: [mobile](../../mobile/package.json) — Expo57/React Native; [hướng dẫn mobile](../../mobile/AGENTS.md) đã đọc. Đây là đọc source, không chỉnh code Expo hoặc chạy emulator.
- [BASELINE.json](BASELINE.json) lưu hash diff tracked/staged và540 file source/schema/migration/test tại mốc. [VERIFICATION.json](VERIFICATION.json) là đối chiếu cuối; phạm vi hash không bao gồm mọi asset binary/untracked ngoài danh sách.

## Cách đọc

1. [EXCEPTION-AUDIT.md](EXCEPTION-AUDIT.md): kiến trúc, mức coverage, traces, kiểm thử và giới hạn.
2. [EXCEPTION-MATRIX.md](EXCEPTION-MATRIX.md): 75 tình huống với đủ14 cột, source/symbol/dòng, database và test evidence.
3. [CRITICAL-GAPS.md](CRITICAL-GAPS.md): 24 nguyên nhân tồn đọng, repro an toàn, lịch A/B, hướng sửa và test cần bổ sung.
4. [INVENTORY.md](INVENTORY.md):252 declarations/256 verb-path trên24 controllers, vai trò và module/client/entity/dependency; không phải256 API đã chạy. [TEST-COVERAGE.md](TEST-COVERAGE.md): chỉ mục test thực tế.

File JSON FINDINGS/MATRIX/EVIDENCE/INVENTORY/ROUTES/CLIENT-INVENTORY là dữ liệu bằng chứng hỗ trợ tài liệu, không phải cấu hình runtime. Dòng evidence tính theo worktree này; source link mở file, nhãn ghi dòng/symbol. Khi code đổi phải audit lại.

## Status và cơ chế

| Status | Nghĩa | Số scenario |
|---|---|---|
| HANDLED | Trigger cụ thể có bảo vệ/phản hồi nhất quán ở các lớp liên quan; thiếu test riêng không tự hạ status. | 43 |
| PARTIALLY HANDLED | Có bảo vệ nhưng có gap cụ thể về invariant, phản hồi hoặc recovery. | 23 |
| NOT HANDLED | Đường reachable thiếu cơ chế có ý nghĩa sau đối chiếu toàn luồng. | 1 |
| NOT APPLICABLE | Không thuộc triển khai hiện tại, có lý do/căn cứ. | 3 |
| CANNOT CONFIRM | Thiếu dữ kiện runtime/cấu hình hoặc semantics cần xác minh; không chỉ vì chưa chạy test. | 5 |

Tổng **75 scenarios**. PREVENTED là invariant chặn trạng thái sai; DETECTED AND HANDLED là phát hiện và phản hồi/phục hồi đúng; DETECTED BUT POORLY HANDLED là phát hiện nhưng phản hồi/recovery chưa đúng. Nhánh thiếu xử lý được mô tả riêng; không dùng việc có try/catch làm bằng chứng an toàn.

## Severity và ưu tiên

| Severity | Tiêu chí | Unresolved root causes |
|---|---|---|
| CRITICAL | Hậu quả đặc biệt nghiêm trọng, diện rộng, đường lỗi đã chứng minh. | 0 |
| HIGH | Tác động đáng kể tới tài khoản/quyền/quyền sở hữu hoặc dữ liệu, có trigger rõ. | 4 |
| MEDIUM | Lỗi nghiệp vụ, consistency/recovery có tác động nhưng đã xét phạm vi/quyền/DB protections còn lại. | 19 |
| LOW | Tác động giới hạn ở contract/thông tin. | 1 |

Severity độc lập status. HANDLED dùng mức tác động tiềm tàng của scenario, không cộng vào lỗi tồn đọng. NOT APPLICABLE và vấn đề chưa đủ căn cứ định mức dùng “—”. Không có CRITICAL được xác nhận. HIGH gồm GAP-01/02/04/05; đó là kết luận đường source, chưa phải khai thác runtime quan sát được.

## Kiểm chứng và giới hạn

Windows PowerShell, Node v24.16.0; dependencies sẵn có, không cài thêm. Backend chạy Jest trực tiếp sau khi kiểm tra setup, loại integration: **92/93 suites pass;774/775 tests pass,1 fail** ở generated OpenAPI scope. Web chạy7 file Node tests: **57 pass,0 fail,0 skip**. Xem [backend log](backend-tests.log), [Jest result](backend-tests.json), [web log](web-tests.log). Không ghi lỗi test là do thay đổi audit: audit không thay app.

Không start app/worker/Metro/emulator; không DB reset/seed/migrate, không gửi email/chuyển tiền, không chạy E2E demo/live, không sửa/viết tests.7 PostgreSQL integration và12 Playwright files **chưa chạy**, không coi skipped là pass. Không chạy build tạo artifact ngoài phạm vi docs trong task này; Jest đã biên dịch code cần cho tests được chọn. Chưa browser/device smoke, chưa ảnh chụp màn hình; không tuyên bố UI/mobile đã được xác nhận thực tế.

Migrations trong repository khác với migrations đã áp dụng. Redis behavior, proxy/cookies, deployed DB indexes, multi-instance socket và payment/manual settlement thực chưa xác minh. Mỗi vấn đề ghi phần chưa biết và kế hoạch test môi trường riêng.
