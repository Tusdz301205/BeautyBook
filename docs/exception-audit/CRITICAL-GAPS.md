# Khoảng trống cần xử lý

**24 root causes chưa sửa:** CRITICAL0, HIGH4, MEDIUM19, LOW1. Không đếm các biểu hiện UI/backend của cùng nguyên nhân thành lỗi riêng. 5 CANNOT CONFIRM là yêu cầu xác minh, không tự cộng thành vulnerabilities. Các repro dưới đây là kế hoạch kiểm chứng an toàn, **chưa chạy**; không sử dụng ID, token, thông tin cá nhân hay database thật.

Thứ tự: GAP-01/02/04/05 trước; sau đó GAP-03/18/19 (tiền/lượt), GAP-07/09/10/15/24 (nhất quán lịch), GAP-06/11/12/13 (retry/session), GAP-08/16/21/22/23 (workflow), GAP-14/17 (validation/projection), GAP-20 (contract). MEDIUM ở đây vẫn cần sửa, chỉ không đủ căn cứ nâng HIGH khi đã xét quyền và DB protection còn hiệu lực.

<a id="gap-01"></a>

## GAP-01 — Đổi mật khẩu và thu hồi phiên không nguyên tử

1. **ID và scenario:** [AUTH-005](EXCEPTION-MATRIX.md#auth-005). Root cause được tính1 lần.
2. **Severity: HIGH.** Người đang giữ refresh token cũ tiếp tục truy cập sau thao tác đổi mật khẩu. Không suy ra người ngoài có thể lấy token.
3. **Flow/role/resource:** Authentication / reset/change password. Tài khoản có phiên đang sống; Redis SET thất bại sau user.update trong resetPassword/changePassword.
4. **Tiên quyết:** Tài khoản có phiên đang sống; Redis SET thất bại sau user.update trong resetPassword/changePassword. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. 
6. **Lịch A/B hoặc partial failure:** A đổi password commit → Redis SET lỗi → B dùng refresh cũ trên session chưa revoked; sau Redis phục hồi access cũ cũng không có mốc thu hồi mới.
7. **Mong đợi:** Mật khẩu đổi thì mọi phiên cần thu hồi phải bị vô hiệu hóa bền vững, kể cả Redis lỗi.
8. **Hiện tại:** Mật khẩu đã đổi; revokeAllForUser ném lỗi nên userSession.updateMany chưa chạy. Refresh đọc session/hash mà không kiểm tra mốc Redis; phiên cũ có thể refresh.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/auth/auth.service.ts:426 — async resetPassword](../../beauty-booking-api-main/src/auth/auth.service.ts); [beauty-booking-api-main/src/auth/auth.service.ts:286 — async refresh](../../beauty-booking-api-main/src/auth/auth.service.ts); [beauty-booking-api-main/src/auth/token-blacklist.service.ts:64 — async revokeAllForUser](../../beauty-booking-api-main/src/auth/token-blacklist.service.ts); [beauty-booking-api-main/src/auth/jwt.strategy.ts:64 — async validate](../../beauty-booking-api-main/src/auth/jwt.strategy.ts). [auth/auth.service.spec.ts](../../beauty-booking-api-main/src/auth/auth.service.spec.ts) — ĐÃ CHẠY; suite/file có PASS. logout test kiểm tra revoked session, không inject Redis sau password write. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-auth-auth-service-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** JWT fail-closed khi Redis đọc lỗi; session/expiry/signature vẫn được kiểm tra. Các bảo vệ đó không thu hồi session đã bỏ sót. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Người đang giữ refresh token cũ tiếp tục truy cập sau thao tác đổi mật khẩu. Không suy ra người ngoài có thể lấy token.
12. **Hướng sửa — chưa triển khai:** Ghi password và revoke DB sessions trong một transaction; dùng DB làm nguồn thu hồi, outbox đồng bộ Redis; không coi lỗi hạ tầng là mật khẩu sai.
13. **Test cần có trong task sửa sau:** Fault injection Redis SET sau password write; chứng minh tất cả session cũ không refresh được, kể cả sau Redis hồi phục.
14. **Chưa xác minh:** Chưa gọi Redis thực hoặc endpoint đổi mật khẩu. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/store/authStore.js:123 — setSession:](../../beauty-booking-web-main/beauty-booking-web-main/src/store/authStore.js); [mobile/src/context/AuthContext.tsx:29 — export function AuthProvider](../../mobile/src/context/AuthContext.tsx).

<a id="gap-02"></a>

## GAP-02 — Token đặt lại mật khẩu được tiêu thụ bằng read rồi update không điều kiện

1. **ID và scenario:** [AUTH-006](EXCEPTION-MATRIX.md#auth-006). Root cause được tính1 lần.
2. **Severity: HIGH.** Vi phạm one-time credential; token hợp lệ bị dùng hai lần hoặc mất hiệu lực khi DB ghi password lỗi.
3. **Flow/role/resource:** Authentication / consume reset token. Hai request có cùng PASSWORD_RESET token hợp lệ, chưa dùng, cùng đến trước update usedAt.
4. **Tiên quyết:** Hai request có cùng PASSWORD_RESET token hợp lệ, chưa dùng, cùng đến trước update usedAt. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. 
6. **Lịch A/B hoặc partial failure:** A/B cùng read unused → A update usedAt → B update usedAt theo id → A/B ghi password; lần cuối thắng.
7. **Mong đợi:** Một token chỉ có một lần tiêu thụ thành công, gắn nguyên tử với thay đổi tài khoản.
8. **Hiện tại:** consumeAccountToken đọc usedAt:null rồi update chỉ theo id; cả hai có thể nhận record và ghi password khác nhau. Token cũng bị đánh dấu dùng trước khi password write thành công.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/auth/auth.service.ts:618 — private async consumeAccountToken](../../beauty-booking-api-main/src/auth/auth.service.ts); [beauty-booking-api-main/src/auth/auth.service.ts:426 — async resetPassword](../../beauty-booking-api-main/src/auth/auth.service.ts); [beauty-booking-api-main/prisma/schema.prisma:80 — model AccountToken](../../beauty-booking-api-main/prisma/schema.prisma). [auth/auth.service.spec.ts](../../beauty-booking-api-main/src/auth/auth.service.spec.ts) — ĐÃ CHẠY; suite/file có PASS. Không assertion reset đồng thời cùng token. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-auth-auth-service-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Hash token unique, expiry, type và usedAt chặn token giả/hết hạn/replay tuần tự; UNIQUE không chặn hai update cùng row. ValidationPipe và rate limit không serialize token. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Vi phạm one-time credential; token hợp lệ bị dùng hai lần hoặc mất hiệu lực khi DB ghi password lỗi.
12. **Hướng sửa — chưa triển khai:** CAS updateMany usedAt:null + expiry trong transaction cùng password/revocation; xử lý count=0 rõ ràng.
13. **Test cần có trong task sửa sau:** Barrier hai request cùng token; chỉ một đổi password; rollback consume khi password write lỗi.
14. **Chưa xác minh:** Chưa tái hiện cạnh tranh trên PostgreSQL; trigger trong repository không bổ sung CAS cho account_tokens. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/store/authStore.js:123 — setSession:](../../beauty-booking-web-main/beauty-booking-web-main/src/store/authStore.js).

<a id="gap-04"></a>

## GAP-04 — Chuyển chi nhánh không kiểm tra chuyên viên đích

1. **ID và scenario:** [OPS-001](EXCEPTION-MATRIX.md#ops-001). Root cause được tính1 lần.
2. **Severity: HIGH.** Ghi phân công lịch của một doanh nghiệp sang staff ngoài phạm vi; notification tới staff đó; khả năng xem chi tiết sau đó còn chịu access guard, chưa khẳng định rò toàn booking.
3. **Flow/role/resource:** Operations / TRANSFER_BRANCH. Owner có impact case của mình; TRANSFER_BRANCH đến branch cùng business; gửi replacementStaffId đang tồn tại nhưng thuộc tenant khác/không có kỹ năng; chọn slot không trùng.
4. **Tiên quyết:** Owner có impact case của mình; TRANSFER_BRANCH đến branch cùng business; gửi replacementStaffId đang tồn tại nhưng thuộc tenant khác/không có kỹ năng; chọn slot không trùng. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. Có thể xác nhận nhánh tuần tự trước khi dựng concurrency.
6. **Lịch A/B hoặc partial failure:** Không cần race cho staff sai scope. Với race, A đọc booking cũ → B hoàn tất item → A chuyển theo snapshot cũ.
7. **Mong đợi:** Chuyên viên phải thuộc branch đích, có kỹ năng, active/bookable, đúng giờ và booking còn được phép chuyển.
8. **Hiện tại:** transferBranch kiểm tra business của branch, tìm offering thay thế, ghi staffId trực tiếp; không gọi validateStaffForService, không kiểm tra giờ mở cửa và revision/status của booking hiện tại.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/operations/impact.controller.ts:41 — async resolve(](../../beauty-booking-api-main/src/operations/impact.controller.ts); [beauty-booking-api-main/src/operations/impact.service.ts:48 — async resolveItem](../../beauty-booking-api-main/src/operations/impact.service.ts); [beauty-booking-api-main/src/operations/impact.service.ts:236 — private async transferBranch](../../beauty-booking-api-main/src/operations/impact.service.ts); [beauty-booking-api-main/src/bookings/bookings.validation.ts:134 — export async function validateStaffForService](../../beauty-booking-api-main/src/bookings/bookings.validation.ts); [beauty-booking-api-main/prisma/schema.prisma:1081 — model BookingService {](../../beauty-booking-api-main/prisma/schema.prisma); [beauty-booking-api-main/prisma/migrations/20260829_remove_attendance_workforce/migration.sql:213 — hashtext(NEW."staff_id")](../../beauty-booking-api-main/prisma/migrations/20260829_remove_attendance_workforce/migration.sql). [operations/impact.controller.spec.ts](../../beauty-booking-api-main/src/operations/impact.controller.spec.ts) — ĐÃ CHẠY; suite/file có PASS. Reject receptionist/staff trước load case; không kiểm tra replacementStaffId của owner. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-operations-impact-controller-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** JWT/roles/permission và assertImpactAccess bảo vệ case nguồn; branch đích cùng business. FK chỉ chứng minh staff tồn tại; trigger slot chống overlap, không chứng minh staff cùng branch hoặc service. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Ghi phân công lịch của một doanh nghiệp sang staff ngoài phạm vi; notification tới staff đó; khả năng xem chi tiết sau đó còn chịu access guard, chưa khẳng định rò toàn booking.
12. **Hướng sửa — chưa triển khai:** Dùng cùng primitive điều chuyển đã kiểm tra eligibility, revision, trạng thái, slot và scope trong một transaction; derive target staff từ resource.
13. **Test cần có trong task sửa sau:** Owner A thử staff B, inactive/unskilled, giờ đóng cửa; chuyển sau COMPLETE; rollback toàn bộ items nếu một item lỗi.
14. **Chưa xác minh:** Chưa ghi thử booking thật; không xác nhận migration triển khai. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonOperations.jsx:73 — const [form, setForm] = useState({ itemId](../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonOperations.jsx).

<a id="gap-05"></a>

## GAP-05 — Cancel/review chuyển chủ có thể ghi đè kết quả execute

1. **ID và scenario:** [OWN-002](EXCEPTION-MATRIX.md#own-002). Root cause được tính1 lần.
2. **Severity: HIGH.** Lịch sử chuyển quyền sai với owner thực tế; gây nhầm điều hành và recovery. Không khẳng định cấp quyền trực tiếp cho người chưa được duyệt.
3. **Flow/role/resource:** Ownership / cancel/review vs execute. Transfer SCHEDULED đủ điều kiện execute; chủ cũ gửi cancel và tác vụ execute/admin chạy đồng thời.
4. **Tiên quyết:** Transfer SCHEDULED đủ điều kiện execute; chủ cũ gửi cancel và tác vụ execute/admin chạy đồng thời. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. 
6. **Lịch A/B hoặc partial failure:** A cancel đọc SCHEDULED → B execute commit COMPLETED và đổi owner/roles → A update status=CANCELLED theo id.
7. **Mong đợi:** Trạng thái cuối phản ánh đúng việc chuyển tài sản/quyền; cancel chỉ thành công nếu chưa execute.
8. **Hiện tại:** execute có row lock/Serializable; cancel đọc state ngoài transaction rồi update theo id không state predicate. Writer đến muộn có thể đổi COMPLETED thành CANCELLED mà quyền sở hữu đã chuyển.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/ownership/ownership.service.ts:119 — async cancel](../../beauty-booking-api-main/src/ownership/ownership.service.ts); [beauty-booking-api-main/src/ownership/ownership.service.ts:132 — async execute](../../beauty-booking-api-main/src/ownership/ownership.service.ts); [beauty-booking-api-main/src/ownership/ownership.service.ts:13 — async create](../../beauty-booking-api-main/src/ownership/ownership.service.ts). [ownership/ownership.service.spec.ts](../../beauty-booking-api-main/src/ownership/ownership.service.spec.ts) — ĐÃ CHẠY; suite/file có PASS. Không dựng xen kẽ cancel read / execute commit / cancel update trên DB thật. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-ownership-ownership-service-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Controller giới hạn actor; execute kiểm tra phê duyệt, hiệu lực, nghĩa vụ tài chính, legal/payout và revoke sessions; accept có CAS. Không có CAS ở cancel/review; row lock của B không chặn A ghi sau commit. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Lịch sử chuyển quyền sai với owner thực tế; gây nhầm điều hành và recovery. Không khẳng định cấp quyền trực tiếp cho người chưa được duyệt.
12. **Hướng sửa — chưa triển khai:** Dùng cùng row lock hoặc CAS trạng thái/revision cho mọi transition; giữ history mutation cùng transaction.
13. **Test cần có trong task sửa sau:** Barrier cancel/execute và hai reviewer trái quyết định; assert owner, grants, history, transfer status nhất quán.
14. **Chưa xác minh:** Race chưa chạy DB thật; chỉ source chứng minh đường xen kẽ. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonOperations.jsx:73 — const [form, setForm] = useState({ itemId](../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonOperations.jsx).

<a id="gap-03"></a>

## GAP-03 — Split payment xung đột chỉ mục một khoản đã thanh toán trên mỗi booking

1. **ID và scenario:** [PAY-002](EXCEPTION-MATRIX.md#pay-002). Root cause được tính1 lần.
2. **Severity: MEDIUM.** UI mời split payment nhưng không thể hoàn tất khoản thứ hai; pending attempts có thể tồn đọng. Không khẳng định đã thu quá tiền.
3. **Flow/role/resource:** Payments / collect/verify split payment. Owner/receptionist thu tiền mặt một phần, sau đó thu phần còn lại bằng key mới; hoặc xác minh hai pending transfers cùng booking.
4. **Tiên quyết:** Owner/receptionist thu tiền mặt một phần, sau đó thu phần còn lại bằng key mới; hoặc xác minh hai pending transfers cùng booking. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. Có thể xác nhận nhánh tuần tự trước khi dựng concurrency.
6. **Lịch A/B hoặc partial failure:** Không cần race: booking minh họa 100, thu 40, thu 60 → unique conflict nếu migration đã áp dụng.
7. **Mong đợi:** Luồng split payment và invariant DB phải thống nhất, vẫn chặn tổng thu vượt nghĩa vụ.
8. **Hiện tại:** collect hỗ trợ amount nhỏ hơn due và tạo Payment mới mỗi lần. Chỉ mục payments_one_settled_per_booking chặn Payment PAID thứ hai; transaction rollback và trả 409.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/payments/payments.service.ts:149 — async collect(](../../beauty-booking-api-main/src/payments/payments.service.ts); [beauty-booking-api-main/src/payments/payments.service.ts:735 — async verifyTransaction](../../beauty-booking-api-main/src/payments/payments.service.ts); [beauty-booking-api-main/prisma/migrations/20260715_harden_payment_concurrency/migration.sql:3 — CREATE UNIQUE INDEX](../../beauty-booking-api-main/prisma/migrations/20260715_harden_payment_concurrency/migration.sql); [beauty-booking-api-main/prisma/migrations/20260909_audit_integrity/migration.sql:91 — payment_transactions_audit_amount_check](../../beauty-booking-api-main/prisma/migrations/20260909_audit_integrity/migration.sql). [payments/payments.service.spec.ts](../../beauty-booking-api-main/src/payments/payments.service.spec.ts) — ĐÃ CHẠY; suite/file có PASS. Cash PAID trong mock không thi hành partial unique index. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-payments-payments-service-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Đã tìm toàn migrations: có CREATE unique index, không thấy DROP. Chỉ mục ngăn kết luận overpayment trên schema repository; serializable và CAS giữ từng transaction nguyên tử. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** UI mời split payment nhưng không thể hoàn tất khoản thứ hai; pending attempts có thể tồn đọng. Không khẳng định đã thu quá tiền.
12. **Hướng sửa — chưa triển khai:** Chọn mô hình nhiều receipts/transactions với aggregate invariant hoặc một Payment tổng hợp; migration phải bảo toàn lịch sử và có kiểm chứng riêng.
13. **Test cần có trong task sửa sau:** PostgreSQL disposable áp dụng đầy đủ migrations: 40+60, 100+100 pending, cash+bank, refund/reversal rồi thu bổ sung.
14. **Chưa xác minh:** Chưa biết chỉ mục đã tồn tại trên demo; nếu thiếu thì verify chưa kiểm tra tổng due là rủi ro khác cần xác minh, chưa tính thêm gap. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/PaymentsWorkspace.jsx:64 — const collect =](../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/PaymentsWorkspace.jsx).

<a id="gap-06"></a>

## GAP-06 — Xung đột idempotency Redis bị bắt như lỗi hạ tầng

1. **ID và scenario:** [TECH-004](EXCEPTION-MATRIX.md#tech-004). Root cause được tính1 lần.
2. **Severity: MEDIUM.** Sai thông báo/retry; bỏ cơ chế dedupe của interceptor ở dev. Không suy ra mọi duplicate sẽ phá dữ liệu.
3. **Flow/role/resource:** Infrastructure / reserve idempotency key. Redis hoạt động; key đã in_flight hoặc fingerprint khác; request lặp trong TTL.
4. **Tiên quyết:** Redis hoạt động; key đã in_flight hoặc fingerprint khác; request lặp trong TTL. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. 
6. **Lịch A/B hoặc partial failure:** A SET NX thành công → B NX thất bại/GET in_flight → resolveExisting throws → catch dev dùng memory trống → B chạy handler.
7. **Mong đợi:** Trả 409 cho semantic conflict; không chuyển store khi store khỏe và key thuộc request khác.
8. **Hiện tại:** resolveExisting ném ConflictException bên trong try Redis; catch chuyển thành 503 ở production, hoặc fallback memory ở development. Memory trống có thể cấp reservation thứ hai.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/common/interceptors/idempotency.interceptor.ts:154 — private async reserve](../../beauty-booking-api-main/src/common/interceptors/idempotency.interceptor.ts). [common/interceptors/idempotency.interceptor.spec.ts](../../beauty-booking-api-main/src/common/interceptors/idempotency.interceptor.spec.ts) — ĐÃ CHẠY; suite/file có PASS. Replay/mismatch assertions dùng memory, config.get undefined; không chạy Redis branch. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-common-interceptors-idempotency-interceptor-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Guards chạy trước; invariant booking/financial DB còn bảo vệ. Auth routes bị loại khỏi cache. Tests hiện chạy memory nên chưa chứng minh nhánh Redis này. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Sai thông báo/retry; bỏ cơ chế dedupe của interceptor ở dev. Không suy ra mọi duplicate sẽ phá dữ liệu.
12. **Hướng sửa — chưa triển khai:** Tách lỗi I/O Redis khỏi ConflictException; reserve/complete/release có owner fence; test cả production và development Redis adapter.
13. **Test cần có trong task sửa sau:** Redis stub SET NX null/GET existing: assert 409 và next.handle không chạy; store outage thật tách biệt.
14. **Chưa xác minh:** Chưa chạy Redis; tác động runtime phụ thuộc REDIS_URL/NODE_ENV. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js:52 — async function request](../../beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js); [mobile/src/api/client.ts:64 — async function refreshAccessToken](../../mobile/src/api/client.ts).

<a id="gap-07"></a>

## GAP-07 — Lỗi thông báo sau commit làm booking báo thất bại

1. **ID và scenario:** [BOOK-008](EXCEPTION-MATRIX.md#book-008). Root cause được tính1 lần.
2. **Severity: MEDIUM.** Người dùng không biết lịch đã tạo; thiếu notification/socket update; fee có thể được bổ sung qua luồng khác nhưng không có bảo đảm từ bước này.
3. **Flow/role/resource:** Booking / create/status post-commit. Booking create hoặc status transition commit xong; DB notification query/create lỗi.
4. **Tiên quyết:** Booking create hoặc status transition commit xong; DB notification query/create lỗi. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. 
6. **Lịch A/B hoặc partial failure:** A commit booking → notify lỗi → client nhận lỗi → retry; DB overlap/CAS có thể chặn retry nhưng client chưa nhận booking đã tạo.
7. **Mong đợi:** Booking đã commit trả kết quả có thể truy hồi; thông báo/fee được ghi bền vững hoặc có recovery độc lập.
8. **Hiện tại:** notifySalonMembers/notifyBookingBothParties được await ngoài transaction, lỗi truyền lên; idempotency release reservation. Khi COMPLETED, ensurePlatformFee chạy sau notify nên bị bỏ qua trong lượt đó.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/bookings/bookings.service.ts:1508 — // 7. Notification](../../beauty-booking-api-main/src/bookings/bookings.service.ts); [beauty-booking-api-main/src/bookings/bookings.service.ts:772 — if (notifTitleByStatus[mappedStatus])](../../beauty-booking-api-main/src/bookings/bookings.service.ts); [beauty-booking-api-main/src/common/interceptors/idempotency.interceptor.ts:154 — private async reserve](../../beauty-booking-api-main/src/common/interceptors/idempotency.interceptor.ts); [beauty-booking-api-main/src/notifications/notification-outbox.worker.ts:9 — export class](../../beauty-booking-api-main/src/notifications/notification-outbox.worker.ts). [bookings/customer-change-request.spec.ts](../../beauty-booking-api-main/src/bookings/customer-change-request.spec.ts) — ĐÃ CHẠY; suite/file có PASS. Notification failure aborts CHANGE REQUEST mock transaction; không chứng minh create/status sau commit an toàn. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-bookings-customer-change-request-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Slot guards, booking state CAS, snapshots trong transaction vẫn đúng. ChangeRequestsService.create có notification trong transaction nên không thuộc gap này. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Người dùng không biết lịch đã tạo; thiếu notification/socket update; fee có thể được bổ sung qua luồng khác nhưng không có bảo đảm từ bước này.
12. **Hướng sửa — chưa triển khai:** Outbox cùng transaction; tách response khỏi side effect; durable operation result/key và đối soát fee sau partial failure.
13. **Test cần có trong task sửa sau:** Inject notify failure sau commit, retry cùng key, assert một booking + response truy hồi được + outbox eventually delivered.
14. **Chưa xác minh:** Không tái hiện bằng cách phá DB demo; chưa xác minh các nguồn fee recovery ngoài call sites đã thấy. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingConfirm.jsx:79 — const confirm = async](../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingConfirm.jsx); [mobile/src/context/BookingsContext.tsx:61 — const reload =](../../mobile/src/context/BookingsContext.tsx).

<a id="gap-08"></a>

## GAP-08 — Gửi email thất bại bị coi là hoàn tất lời mời

1. **ID và scenario:** [STAFF-001](EXCEPTION-MATRIX.md#staff-001). Root cause được tính1 lần.
2. **Severity: MEDIUM.** Nhân sự bị giữ INVITED nhưng chưa nhận link; phải mời lại thủ công.
3. **Flow/role/resource:** Staff / Mail / invite/sendMail. Owner mời staff; SMTP lỗi trong MailService.sendMail.
4. **Tiên quyết:** Owner mời staff; SMTP lỗi trong MailService.sendMail. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. Có thể xác nhận nhánh tuần tự trước khi dựng concurrency.
6. **Lịch A/B hoặc partial failure:** Không cần race: tạo invitation/profile → sendMail reject → MailService swallow → invite resolve.
7. **Mong đợi:** Ghi trạng thái delivery/retry rõ; không báo đã gửi khi chưa có kết quả.
8. **Hiện tại:** MailService catch/log rồi resolve; StaffInvitationsService catch rollback không chạy, trả invitation PENDING dù email không được gửi.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/mail/mail.service.ts:22 — async sendMail](../../beauty-booking-api-main/src/mail/mail.service.ts); [beauty-booking-api-main/src/staff/staff-invitations.service.ts:32 — async invite](../../beauty-booking-api-main/src/staff/staff-invitations.service.ts). [mail/mail.service.spec.ts](../../beauty-booking-api-main/src/mail/mail.service.spec.ts) — ĐÃ CHẠY; suite/file có PASS. Missing production creds throw; không assert SMTP failure đi xuyên invitation. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-mail-mail-service-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Token hash, expiry 7 ngày, role/scope/profile checks vẫn có; production thiếu creds bị chặn startup. Chống enumeration ở forgot-password là chủ ý, không tính là false success riêng. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Nhân sự bị giữ INVITED nhưng chưa nhận link; phải mời lại thủ công.
12. **Hướng sửa — chưa triển khai:** Mail outbox/retry hoặc kết quả typed delivery failure; không hủy chứng cứ sau lỗi gửi; log an toàn.
13. **Test cần có trong task sửa sau:** SMTP stub reject qua MailService thật, không chỉ mock invite.sendInvitationEmail reject; assert delivery state/retry.
14. **Chưa xác minh:** Không gửi email thật; chưa quan sát nhà cung cấp. UI riêng chưa trace; không báo đã thử demo.

<a id="gap-09"></a>

## GAP-09 — Impact PROCESSING và các bước con thiếu recovery bền vững

1. **ID và scenario:** [OPS-002](EXCEPTION-MATRIX.md#ops-002). Root cause được tính1 lần.
2. **Severity: MEDIUM.** Case không hoàn tất; phân công thay đổi một phần nhưng workflow chưa phản ánh.
3. **Flow/role/resource:** Operations / resolve impact. Process dừng sau claim PROCESSING, hoặc REASSIGN nhiều items lỗi ở item sau/finalize.
4. **Tiên quyết:** Process dừng sau claim PROCESSING, hoặc REASSIGN nhiều items lỗi ở item sau/finalize. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. 
6. **Lịch A/B hoặc partial failure:** A claim PROCESSING → commit item1 → crash trước item2/finalize; B retry gặp count=0.
7. **Mong đợi:** Kết quả có checkpoint/compensation và lease recovery, không kẹt vô thời hạn; mô tả partial success chính xác.
8. **Hiện tại:** Claim ngoài transaction, từng bookingItems.update commit riêng; catch chỉ trả impact item về PENDING, không hoàn tác item đã đổi. Crash không chạy catch để giải phóng PROCESSING.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/operations/impact.service.ts:48 — async resolveItem](../../beauty-booking-api-main/src/operations/impact.service.ts); [beauty-booking-api-main/src/bookings/booking-items.service.ts:85 — async update(](../../beauty-booking-api-main/src/bookings/booking-items.service.ts); [beauty-booking-api-main/src/notifications/notification-outbox.worker.ts:9 — export class](../../beauty-booking-api-main/src/notifications/notification-outbox.worker.ts). [operations/impact.service.spec.ts](../../beauty-booking-api-main/src/operations/impact.service.spec.ts) — ĐÃ CHẠY; suite/file có PASS. Chỉ assert scoped case query; không crash/partial multi-item. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-operations-impact-service-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** CAS ngăn hai worker cùng claim; mỗi item riêng có revision, transaction; finalize+outbox atomic. OperationsModule chỉ đăng ký deadline worker, không reclaim processing. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Case không hoàn tất; phân công thay đổi một phần nhưng workflow chưa phản ánh.
12. **Hướng sửa — chưa triển khai:** Transaction chung khi có thể hoặc saga checkpoint/lease owner, idempotent steps, recovery worker và trạng thái cần can thiệp.
13. **Test cần có trong task sửa sau:** Crash ở mỗi checkpoint; fault item2/finalize; assert recovery không lặp side effects.
14. **Chưa xác minh:** Chưa chạy kill-process test; compensation cần quyết định nghiệp vụ. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonOperations.jsx:73 — const [form, setForm] = useState({ itemId](../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonOperations.jsx).

<a id="gap-10"></a>

## GAP-10 — Impact COMPLETED cũ có thể cho phép đóng chi nhánh khi có lịch mới

1. **ID và scenario:** [CAT-003](EXCEPTION-MATRIX.md#cat-003). Root cause được tính1 lần.
2. **Severity: MEDIUM.** Lịch còn hoạt động nằm ở chi nhánh đã đóng/tạm dừng mà không vào workflow mới.
3. **Flow/role/resource:** Catalog / Branch / pause/suspend/close. Branch từng hoàn tất impact PAUSE/SUSPEND, đã RESTORE, nhận booking mới rồi lại cùng transition.
4. **Tiên quyết:** Branch từng hoàn tất impact PAUSE/SUSPEND, đã RESTORE, nhận booking mới rồi lại cùng transition. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. Có thể xác nhận nhánh tuần tự trước khi dựng concurrency.
6. **Lịch A/B hoặc partial failure:** Không cần race: complete case cũ → restore → booking mới → pause lần nữa; case cũ vẫn làm điều kiện đủ.
7. **Mong đợi:** Lần chuyển mới phải giải quyết mọi lịch bị ảnh hưởng hiện tại.
8. **Hiện tại:** BranchStateService tìm bất kỳ COMPLETED case cùng subject/action; cả precheck và tx recheck chỉ xem tồn tại, không đối chiếu booking hiện tại với items đã giải quyết.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/branches/branch-state.service.ts:40 — async transition](../../beauty-booking-api-main/src/branches/branch-state.service.ts); [beauty-booking-api-main/src/operations/impact.service.ts:48 — async resolveItem](../../beauty-booking-api-main/src/operations/impact.service.ts). [branches/branch-state.service.spec.ts](../../beauty-booking-api-main/src/branches/branch-state.service.spec.ts) — ĐÃ CHẠY; suite/file có PASS. Revalidate guards sau row lock; không repeated pause/restore với case cũ. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-branches-branch-state-service-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Transition có row lock, state table, reason và audit; kiểm tra active count có nhưng boolean completedImpact quá rộng. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Lịch còn hoạt động nằm ở chi nhánh đã đóng/tạm dừng mà không vào workflow mới.
12. **Hướng sửa — chưa triển khai:** Gắn case với transition/version và tập lịch; recheck chưa giải quyết trong transaction, không tái sử dụng approval lịch sử vô hạn.
13. **Test cần có trong task sửa sau:** Hai chu kỳ pause/restore và thêm lịch giữa complete với transition; bảo đảm case mới được tạo/đòi xử lý.
14. **Chưa xác minh:** Không đổi trạng thái branch thực. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonOperations.jsx:73 — const [form, setForm] = useState({ itemId](../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonOperations.jsx).

<a id="gap-11"></a>

## GAP-11 — Refresh lỗi hạ tầng tiêu thụ token rồi trả 401

1. **ID và scenario:** [AUTH-007](EXCEPTION-MATRIX.md#auth-007). Root cause được tính1 lần.
2. **Severity: MEDIUM.** Logout cưỡng bức khi dependency gián đoạn; client mất phiên dù token ban đầu hợp lệ.
3. **Flow/role/resource:** Authentication / refresh infrastructure failure. Refresh token hợp lệ; DB đọc user hoặc issueTokens lỗi sau CAS rotating marker.
4. **Tiên quyết:** Refresh token hợp lệ; DB đọc user hoặc issueTokens lỗi sau CAS rotating marker. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. 
6. **Lịch A/B hoặc partial failure:** A CAS rotating → user lookup/token persistence fail → 401 → B retry old token mismatch.
7. **Mong đợi:** Phân biệt credentials invalid với hạ tầng; rotate nguyên tử hoặc recover được khi phát hành thất bại.
8. **Hiện tại:** refreshTokenHash đã thay bằng rotating:<random>; catch toàn hàm chuyển mọi lỗi thành UnauthorizedException. Lần retry token cũ không còn khớp.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/auth/auth.service.ts:286 — async refresh](../../beauty-booking-api-main/src/auth/auth.service.ts). [auth/auth.service.spec.ts](../../beauty-booking-api-main/src/auth/auth.service.spec.ts) — ĐÃ CHẠY; suite/file có PASS. Không inject lỗi giữa rotation CAS và token persistence. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-auth-auth-service-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** CAS chống replay đúng khi không có lỗi; expiry/signature vẫn kiểm tra; đây là availability/recovery, không bypass auth. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Logout cưỡng bức khi dependency gián đoạn; client mất phiên dù token ban đầu hợp lệ.
12. **Hướng sửa — chưa triển khai:** Transaction/fence phù hợp cho claim+issue+persist và rollback; 503 cho lỗi hạ tầng đã phân loại.
13. **Test cần có trong task sửa sau:** Inject từng điểm giữa CAS và persist, assert rollback/recovery và mã lỗi; giữ test chống replay.
14. **Chưa xác minh:** Chưa fault injection DB thực. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js:52 — async function request](../../beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js); [mobile/src/api/client.ts:64 — async function refreshAccessToken](../../mobile/src/api/client.ts).

<a id="gap-12"></a>

## GAP-12 — Response refresh đến muộn có thể ghi đè phiên đã đổi

1. **ID và scenario:** [UI-002](EXCEPTION-MATRIX.md#ui-002). Root cause được tính1 lần.
2. **Severity: MEDIUM.** UI quay lại user cũ hoặc mất phiên mới; nhầm tài khoản khi dùng chung thiết bị.
3. **Flow/role/resource:** Client recovery / refresh/restore vs switch account. Web/mobile có refresh hoặc restore đang chờ; người dùng logout hoặc đăng nhập tài khoản khác trước response.
4. **Tiên quyết:** Web/mobile có refresh hoặc restore đang chờ; người dùng logout hoặc đăng nhập tài khoản khác trước response. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. 
6. **Lịch A/B hoặc partial failure:** A refresh user1 đang chờ → B logout/login user2 → A resolves → store nhận user1.
7. **Mong đợi:** Chỉ response của thế hệ phiên hiện tại được phép cập nhật credentials và UI.
8. **Hiện tại:** setSession/setUser/token handlers không gắn session generation; refresh thành công đến muộn vẫn ghi auth state. Mobile active flag chỉ kiểm tra mount.
9. **Bằng chứng source/schema/test:** [beauty-booking-web-main/beauty-booking-web-main/src/store/authStore.js:123 — setSession:](../../beauty-booking-web-main/beauty-booking-web-main/src/store/authStore.js); [beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js:52 — async function request](../../beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js); [mobile/src/context/AuthContext.tsx:29 — export function AuthProvider](../../mobile/src/context/AuthContext.tsx); [mobile/src/api/client.ts:64 — async function refreshAccessToken](../../mobile/src/api/client.ts). [utils/authScope.test.js](../../beauty-booking-web-main/beauty-booking-web-main/src/utils/authScope.test.js) — ĐÃ CHẠY; suite/file có PASS. Scope/session shape thuần, không asynchronous session race. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-web-main-beauty-booking-web-main-src-utils-authscope-test-js).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Backend session/role guards vẫn kiểm tra request kế tiếp; BookingsContext có dataOwnerId/currentUserIdRef bảo vệ booking data. Không suy ra server cho phép session đã revoked. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** UI quay lại user cũ hoặc mất phiên mới; nhầm tài khoản khi dùng chung thiết bị.
12. **Hướng sửa — chưa triển khai:** Session epoch tăng khi login/logout/switch; fence mọi refresh/restore; hủy pending requests và đồng bộ tab.
13. **Test cần có trong task sửa sau:** Deferred refresh rồi logout/login; assert token/user/storage vẫn thuộc phiên mới; nhiều tab.
14. **Chưa xác minh:** Chưa chạy browser/device timing; phạm vi ảnh hưởng dữ liệu từng màn hình cần E2E. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/store/authStore.js:123 — setSession:](../../beauty-booking-web-main/beauty-booking-web-main/src/store/authStore.js); [mobile/src/context/AuthContext.tsx:29 — export function AuthProvider](../../mobile/src/context/AuthContext.tsx).

<a id="gap-13"></a>

## GAP-13 — Lỗi mạng khi refresh tự động làm xóa phiên

1. **ID và scenario:** [UI-003](EXCEPTION-MATRIX.md#ui-003). Root cause được tính1 lần.
2. **Severity: MEDIUM.** Người dùng buộc đăng nhập lại khi mất mạng; request treo có thể giữ loading.
3. **Flow/role/resource:** Client recovery / offline during refresh. Access hết hạn trả 401; refresh gặp offline/5xx, không phải token invalid.
4. **Tiên quyết:** Access hết hạn trả 401; refresh gặp offline/5xx, không phải token invalid. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. Có thể xác nhận nhánh tuần tự trước khi dựng concurrency.
6. **Lịch A/B hoặc partial failure:** Không cần race: API 401 → refresh network failure → clearSession/clearAuthSession.
7. **Mong đợi:** Giữ phiên có thể khôi phục với lỗi tạm thời; phân biệt 401 thật và offline/timeout.
8. **Hiện tại:** Web catch refresh xóa session; mobile refreshAccessToken network catch trả null, caller gọi unauthorizedHandler. Không có timeout mặc định cho fetch ở cả hai client.
9. **Bằng chứng source/schema/test:** [beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js:52 — async function request](../../beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js); [mobile/src/api/client.ts:64 — async function refreshAccessToken](../../mobile/src/api/client.ts); [mobile/src/context/AuthContext.tsx:29 — export function AuthProvider](../../mobile/src/context/AuthContext.tsx). [utils/latestRequest.test.js](../../beauty-booking-web-main/beauty-booking-web-main/src/utils/latestRequest.test.js) — ĐÃ CHẠY; suite/file có PASS. Latest request fence không chứng minh auto-refresh offline. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-web-main-beauty-booking-web-main-src-utils-latestrequest-test-js).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Có single-flight; mobile restore khởi động có giữ cached state khi lỗi non-401, nhưng nhánh auto-refresh khác. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Người dùng buộc đăng nhập lại khi mất mạng; request treo có thể giữ loading.
12. **Hướng sửa — chưa triển khai:** Typed transient error, timeout/AbortSignal theo operation, retry có giới hạn; chỉ clear khi xác thực phiên bị từ chối.
13. **Test cần có trong task sửa sau:** Offline và 503 giữa request/refresh; không xóa credentials; timeout mutation hiển thị trạng thái chưa rõ và reconcile.
14. **Chưa xác minh:** Chưa mô phỏng mạng trên emulator/browser. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js:52 — async function request](../../beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js); [mobile/src/api/client.ts:64 — async function refreshAccessToken](../../mobile/src/api/client.ts).

<a id="gap-14"></a>

## GAP-14 — Body dạng inline type/any không được ValidationPipe kiểm tra kiểu

1. **ID và scenario:** [TECH-001](EXCEPTION-MATRIX.md#tech-001). Root cause được tính1 lần.
2. **Severity: MEDIUM.** 500 không cần thiết, form recovery yếu; batch trả error.message có thể đưa chi tiết nội bộ ra UI.
3. **Flow/role/resource:** Infrastructure / inline body validation. Người đăng nhập PATCH users/me/profile gửi fullName là object; owner PATCH impact gửi reason sai kiểu.
4. **Tiên quyết:** Người đăng nhập PATCH users/me/profile gửi fullName là object; owner PATCH impact gửi reason sai kiểu. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. Có thể xác nhận nhánh tuần tự trước khi dựng concurrency.
6. **Lịch A/B hoặc partial failure:** Không cần race; request minh họa fullName:{} tới profile của chính mình.
7. **Mong đợi:** Trả 400 rõ ràng cho sai kiểu và range trước khi ghi; giới hạn pagination.
8. **Hiện tại:** TypeScript type bị xóa runtime; service gọi .trim trước kiểm tra kiểu nên TypeError/500. Danh sách users dùng parseInt/page/limit không clamp đầy đủ.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/main.ts:3 — ValidationPipe](../../beauty-booking-api-main/src/main.ts); [beauty-booking-api-main/src/users/users.service.ts:56 — async updateSelf](../../beauty-booking-api-main/src/users/users.service.ts); [beauty-booking-api-main/src/operations/impact.controller.ts:41 — async resolve(](../../beauty-booking-api-main/src/operations/impact.controller.ts); [beauty-booking-api-main/src/operations/impact.service.ts:201 — async resolveBatch](../../beauty-booking-api-main/src/operations/impact.service.ts). [auth/dto/auth.dto.spec.ts](../../beauty-booking-api-main/src/auth/dto/auth.dto.spec.ts) — ĐÃ CHẠY; suite/file có PASS. DTO auth validation không chứng minh inline type/any được validate. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-auth-dto-auth-dto-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Guards/resource scope và service whitelisting các field ngăn mass assignment tự do; real DTO vẫn được forbidNonWhitelisted. Không kết luận mọi endpoint đều thiếu validation. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** 500 không cần thiết, form recovery yếu; batch trả error.message có thể đưa chi tiết nội bộ ra UI.
12. **Hướng sửa — chưa triển khai:** DTO class cho endpoints thiếu metatype, nested validation/ranges; trả structured error an toàn cho batch.
13. **Test cần có trong task sửa sau:** Wrong primitive, array/object/null, invalid dates, negative/huge/NaN pagination; assert 400 và không write.
14. **Chưa xác minh:** Không fuzz live; fullName/object đường lỗi đọc tĩnh. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js:52 — async function request](../../beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js); [beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonOperations.jsx:73 — const [form, setForm] = useState({ itemId](../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/SalonOperations.jsx).

<a id="gap-15"></a>

## GAP-15 — Catalog thay đổi sau lần đọc trước transaction tạo booking

1. **ID và scenario:** [BOOK-009](EXCEPTION-MATRIX.md#book-009). Root cause được tính1 lần.
2. **Severity: MEDIUM.** Lịch mới cho offering vừa dừng, giá/thời lượng không phản ánh thay đổi trước xác nhận; không phải lỗi sửa lịch sử snapshot.
3. **Flow/role/resource:** Booking / catalog stale at create. Create đã load offering ACTIVE và tính giá; owner pause/archive/update offering trước khi create vào transaction.
4. **Tiên quyết:** Create đã load offering ACTIVE và tính giá; owner pause/archive/update offering trước khi create vào transaction. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. 
6. **Lịch A/B hoặc partial failure:** A load service/quote → B pause/archive commit → A tx validate staff + insert booking với snapshot cũ.
7. **Mong đợi:** Quy định snapshot phải rõ và revalidate phiên bản/eligibility lúc nhận booking, không nhận service đã dừng trước commit.
8. **Hiện tại:** Trong transaction có recheck branch/staff/slot, nhưng dùng services/giá/thời lượng từ trước tx; validateStaffForService không đọc offering status. Archive cũng precheck future count ngoài tx.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/bookings/bookings.service.ts:816 — async create(](../../beauty-booking-api-main/src/bookings/bookings.service.ts); [beauty-booking-api-main/src/bookings/bookings.validation.ts:134 — export async function validateStaffForService](../../beauty-booking-api-main/src/bookings/bookings.validation.ts); [beauty-booking-api-main/src/services/services.service.ts:755 — async archiveCatalog](../../beauty-booking-api-main/src/services/services.service.ts); [beauty-booking-api-main/src/promotions/pricing-engine.service.ts:174 — async reserve](../../beauty-booking-api-main/src/promotions/pricing-engine.service.ts). [promotions/pricing-engine.service.spec.ts](../../beauty-booking-api-main/src/promotions/pricing-engine.service.spec.ts) — ĐÃ CHẠY; suite/file có PASS. Promotion quote eligible line/quantity; không barrier pause/archive vs create. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-promotions-pricing-engine-service-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Promotion/voucher reserve có version+quota locks; combo quota có conditional update; FK/history snapshots giữ dữ liệu, không chặn service inactive. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Lịch mới cho offering vừa dừng, giá/thời lượng không phản ánh thay đổi trước xác nhận; không phải lỗi sửa lịch sử snapshot.
12. **Hướng sửa — chưa triển khai:** Lock/version offering và catalog cần thiết trong transaction; revalidate eligibility/quote version; archive dùng cùng protocol.
13. **Test cần có trong task sửa sau:** Barrier pause/archive/reprice giữa quote và create; assert reject/requote hoặc snapshot contract đã quy định.
14. **Chưa xác minh:** Chưa tái hiện DB concurrency; không mặc định giá phải đổi hồi tố. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingConfirm.jsx:79 — const confirm = async](../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingConfirm.jsx).

<a id="gap-16"></a>

## GAP-16 — Preview lịch lặp chưa kiểm tra slot đã bị chiếm

1. **ID và scenario:** [BG-002](EXCEPTION-MATRIX.md#bg-002). Root cause được tính1 lần.
2. **Severity: MEDIUM.** UI báo còn chỗ sai, chuỗi thất bại thay vì bỏ kỳ đã chọn, các kỳ trước bị hủy bù.
3. **Flow/role/resource:** Workers / Recurring / preview/skip conflicts. Customer preview recurring ở giờ đã có booking khác của staff, eligibility và branch hours hợp lệ.
4. **Tiên quyết:** Customer preview recurring ở giờ đã có booking khác của staff, eligibility và branch hours hợp lệ. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. Có thể xác nhận nhánh tuần tự trước khi dựng concurrency.
6. **Lịch A/B hoặc partial failure:** Không cần race: seed fixture slot đã chiếm → preview → create cùng input.
7. **Mong đợi:** Preview phản ánh conflict hiện hữu; skipConflicts bỏ đúng occurrence; create vẫn recheck race mới.
8. **Hiện tại:** findStaff chỉ gọi validateStaffForService; không assertNoOverlap. availableCount có thể báo còn chỗ. create gọi BookingsService nên phát hiện conflict rồi bù chuỗi, kể cả skipConflicts=true.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/recurring/recurring.service.ts:13 — async preview](../../beauty-booking-api-main/src/recurring/recurring.service.ts); [beauty-booking-api-main/src/bookings/bookings.validation.ts:134 — export async function validateStaffForService](../../beauty-booking-api-main/src/bookings/bookings.validation.ts); [beauty-booking-api-main/src/bookings/bookings.validation.ts:288 — export async function assertNoOverlap](../../beauty-booking-api-main/src/bookings/bookings.validation.ts); [beauty-booking-api-main/src/bookings/bookings.service.ts:816 — async create(](../../beauty-booking-api-main/src/bookings/bookings.service.ts). [recurring/recurring.service.spec.ts](../../beauty-booking-api-main/src/recurring/recurring.service.spec.ts) — ĐÃ CHẠY; suite/file có PASS. Mock compensation không chứng minh preview kiểm tra occupied slot. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-recurring-recurring-service-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Booking create vẫn ngăn double booking; compensation và creation fence có sẵn. Không cáo buộc recurring ghi lịch chồng. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** UI báo còn chỗ sai, chuỗi thất bại thay vì bỏ kỳ đã chọn, các kỳ trước bị hủy bù.
12. **Hướng sửa — chưa triển khai:** Dùng availability chung trong preview; thiết kế skipConflicts với revalidation từng kỳ và thông báo outcome chính xác.
13. **Test cần có trong task sửa sau:** Occupied slot với SAME_STAFF/ANY, skip true/false; lỗi DB trong findStaff không được biến thành hết nhân viên.
14. **Chưa xác minh:** Chưa chạy E2E lịch lặp. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingConfirm.jsx:79 — const confirm = async](../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/BookingConfirm.jsx).

<a id="gap-17"></a>

## GAP-17 — Endpoint suspend trả nguyên User có passwordHash

1. **ID và scenario:** [USER-001](EXCEPTION-MATRIX.md#user-001). Root cause được tính1 lần.
2. **Severity: MEDIUM.** Credential hash xuất hiện ở client quản trị/devtools/response logging ngoài nơi lưu credential; phạm vi admin có quyền nên xếp MEDIUM.
3. **Flow/role/resource:** User management / suspend response. PLATFORM_ADMIN có user:suspend:platform gọi suspend thành công.
4. **Tiên quyết:** PLATFORM_ADMIN có user:suspend:platform gọi suspend thành công. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. Có thể xác nhận nhánh tuần tự trước khi dựng concurrency.
6. **Lịch A/B hoặc partial failure:** Không cần race; đọc JSON response bằng tài khoản test admin.
7. **Mong đợi:** Response quản trị chỉ chứa DTO an toàn, không có passwordHash.
8. **Hiện tại:** prisma.user.update không select trả toàn scalar User; service return updated; controller forward trực tiếp. Không có serializer/Prisma omit toàn cục.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/users/users.service.ts:236 — async suspend](../../beauty-booking-api-main/src/users/users.service.ts); [beauty-booking-api-main/prisma/schema.prisma:15 — passwordHash](../../beauty-booking-api-main/prisma/schema.prisma); [beauty-booking-api-main/src/app.module.ts:79 — { provide: APP_GUARD](../../beauty-booking-api-main/src/app.module.ts). [common/security/serialization-contract.spec.ts](../../beauty-booking-api-main/src/common/security/serialization-contract.spec.ts) — ĐÃ CHẠY; suite/file có PASS. Regex chỉ cấm user:true; không kiểm tra root prisma.user.update response. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-common-security-serialization-contract-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** JWT/permission chặn anonymous và tenant role. Hash không phải plaintext; test serialization chỉ regex user:true nên không phát hiện update trực tiếp. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Credential hash xuất hiện ở client quản trị/devtools/response logging ngoài nơi lưu credential; phạm vi admin có quyền nên xếp MEDIUM.
12. **Hướng sửa — chưa triển khai:** Select safe fields/response DTO; kiểm soát serialization cho root User lẫn relation.
13. **Test cần có trong task sửa sau:** Test API response recursively không có passwordHash/reset/refresh token; suspend success và unlock.
14. **Chưa xác minh:** Chưa gọi suspend trên dữ liệu thật; không đọc/hash credentials thật. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js:52 — async function request](../../beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js).

<a id="gap-18"></a>

## GAP-18 — Khoản refund PROCESSING không được tính vào số dư giữ chỗ

1. **ID và scenario:** [PAY-004](EXCEPTION-MATRIX.md#pay-004). Root cause được tính1 lần.
2. **Severity: MEDIUM.** Overcommit hàng đợi và thao tác chuyển khoản thủ công nhầm; chưa chứng minh tiền thật đã hoàn hai lần.
3. **Flow/role/resource:** Payments / refund reservation. Một payment có refund APPROVED rồi START→PROCESSING; owner tạo refund khác cùng amount.
4. **Tiên quyết:** Một payment có refund APPROVED rồi START→PROCESSING; owner tạo refund khác cùng amount. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. 
6. **Lịch A/B hoặc partial failure:** Tuần tự đủ: A START 100 → B request 100; không cần race.
7. **Mong đợi:** Mọi refund đang xử lý phải reserve balance cho đến FAILED/REJECTED/cancel theo chính sách.
8. **Hiện tại:** requestRefund và impact CANCEL_REFUND chỉ cộng PENDING/APPROVED/REFUNDED, bỏ PROCESSING. Yêu cầu thứ hai được tạo/duyệt dù nghĩa vụ đã giữ chỗ.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/payments/payments.service.ts:363 — async requestRefund](../../beauty-booking-api-main/src/payments/payments.service.ts); [beauty-booking-api-main/src/payments/payments.service.ts:421 — async processRefund](../../beauty-booking-api-main/src/payments/payments.service.ts); [beauty-booking-api-main/src/operations/impact.service.ts:48 — async resolveItem](../../beauty-booking-api-main/src/operations/impact.service.ts). [payments/payments.service.spec.ts](../../beauty-booking-api-main/src/payments/payments.service.spec.ts) — ĐÃ CHẠY; suite/file có PASS. Pending refunds reserve amount; không assert PROCESSING giữ chỗ. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-payments-payments-service-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** CONFIRM lock payment, kiểm tra tổng REFUNDED và settlement reference nên chặn ghi hoàn vượt ở bước cuối. Gateway tự động không tồn tại. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Overcommit hàng đợi và thao tác chuyển khoản thủ công nhầm; chưa chứng minh tiền thật đã hoàn hai lần.
12. **Hướng sửa — chưa triển khai:** Một hàm reservedRefundBalance chung gồm PROCESSING; kiểm tra lại ở START và CONFIRM.
13. **Test cần có trong task sửa sau:** PROCESSING giữ số dư, FAIL giải phóng theo policy; hai requests/START đồng thời; giữ cap ở CONFIRM.
14. **Chưa xác minh:** Không giao dịch tiền thật; hành động ngoài ngân hàng không quan sát được. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/PaymentsWorkspace.jsx:64 — const collect =](../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Salon/PaymentsWorkspace.jsx).

<a id="gap-19"></a>

## GAP-19 — Reserve lượt gói vào booking đã kết thúc

1. **ID và scenario:** [PKG-003](EXCEPTION-MATRIX.md#pkg-003). Root cause được tính1 lần.
2. **Severity: MEDIUM.** Lượt gói bị giữ không sử dụng, sai entitlement lifecycle; không khẳng định mất tiền trực tiếp.
3. **Flow/role/resource:** Packages / reserve entitlement. Customer sở hữu package ACTIVE còn hạn/lượt và booking COMPLETED/CANCELLED cùng customer/business.
4. **Tiên quyết:** Customer sở hữu package ACTIVE còn hạn/lượt và booking COMPLETED/CANCELLED cùng customer/business. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. Có thể xác nhận nhánh tuần tự trước khi dựng concurrency.
6. **Lịch A/B hoặc partial failure:** Không cần race; reserve vào booking CANCELLED trước đó. Race với cancel cần cùng fence để không bỏ sót release.
7. **Mong đợi:** Reserve chỉ cho item/booking còn phù hợp và đúng branch policy; terminal phải reject hoặc xử lý rõ.
8. **Hiện tại:** reservePackageSession kiểm tra package, permission, relation item/booking/customer/business; không kiểm tra trạng thái item/booking hay branch cụ thể của purchase. Lượt được đặt RESERVED sau lifecycle terminal, không còn transition để redeem/release tự động.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/payments/payments.service.ts:1588 — async reservePackageSession](../../beauty-booking-api-main/src/payments/payments.service.ts); [beauty-booking-api-main/prisma/schema.prisma:1567 — model PackageSessionEntitlement](../../beauty-booking-api-main/prisma/schema.prisma). [payments/payments.service.spec.ts](../../beauty-booking-api-main/src/payments/payments.service.spec.ts) — ĐÃ CHẠY; suite/file có PASS. Foreign tenant package list denied; chưa assertion reserve terminal booking. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-payments-payments-service-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Serializable, unique redeemedBookingServiceId và sequence ngăn hai lượt cho một item; không ngăn liên kết terminal state. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Lượt gói bị giữ không sử dụng, sai entitlement lifecycle; không khẳng định mất tiền trực tiếp.
12. **Hướng sửa — chưa triển khai:** Kiểm tra trạng thái + branch trong transaction có khóa booking/purchase; sửa service contract cho late reserve nếu cần.
13. **Test cần có trong task sửa sau:** Reserve sau terminal, race reserve/cancel/complete, wrong branch trong cùng business, expiry boundary.
14. **Chưa xác minh:** Chưa chạy API; mobile chưa có consumer package. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js:52 — async function request](../../beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js).

<a id="gap-21"></a>

## GAP-21 — Link tiếp nhận ownership trỏ vào workspace CUSTOMER không tương thích

1. **ID và scenario:** [OWN-003](EXCEPTION-MATRIX.md#own-003). Root cause được tính1 lần.
2. **Severity: MEDIUM.** Luồng chuẩn trên web không hoàn tất được bước nhận quyền; mobile không triển khai incoming ownership.
3. **Flow/role/resource:** Ownership / incoming accept UI. New owner là tài khoản operational hợp lệ theo account separation; nhận notification tiếp nhận.
4. **Tiên quyết:** New owner là tài khoản operational hợp lệ theo account separation; nhận notification tiếp nhận. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. Có thể xác nhận nhánh tuần tự trước khi dựng concurrency.
6. **Lịch A/B hoặc partial failure:** Không cần race: owner đề nghị tài khoản operational → người nhận mở link.
7. **Mong đợi:** Có màn hình incoming cho đúng workspace/newOwnerUserId và quyền API không phụ thuộc customer.
8. **Hiện tại:** actionUrl /customer/benefits?tab=ownership; incoming UI chỉ ở CustomerBenefits, được ProtectedRoute customer bọc. Tài khoản CUSTOMER lại bị assertAccountRoleCompatible khi tạo đề nghị.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/ownership/ownership.service.ts:13 — async create](../../beauty-booking-api-main/src/ownership/ownership.service.ts); [beauty-booking-api-main/src/ownership/ownership.service.ts:51 — async accept](../../beauty-booking-api-main/src/ownership/ownership.service.ts); [beauty-booking-api-main/src/auth/account-separation.ts:11 — export function](../../beauty-booking-api-main/src/auth/account-separation.ts); [beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerBenefits.jsx:20 — ownershipApi.incoming](../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerBenefits.jsx); [beauty-booking-web-main/beauty-booking-web-main/src/App.jsx:293 — path="/customer/*"](../../beauty-booking-web-main/beauty-booking-web-main/src/App.jsx). [utils/operationsScope.test.js](../../beauty-booking-web-main/beauty-booking-web-main/src/utils/operationsScope.test.js) — ĐÃ CHẠY; suite/file có PASS. Operations scope thuần; không E2E recipient deep link. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-web-main-beauty-booking-web-main-src-utils-operationsscope-test-js).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** API accept dùng newOwnerUserId+status CAS, nên không mất bảo vệ ownership; có thể gọi API trực tiếp nếu principal hợp lệ. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Luồng chuẩn trên web không hoàn tất được bước nhận quyền; mobile không triển khai incoming ownership.
12. **Hướng sửa — chưa triển khai:** Đặt incoming ownership trong workspace/account center phù hợp; link theo route thật; giữ authorization theo recipient.
13. **Test cần có trong task sửa sau:** E2E operational recipient, CUSTOMER bị từ chối đúng, recipient khác 403/409; deep link sau login.
14. **Chưa xác minh:** Chưa mở demo và xác minh redirects runtime. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerBenefits.jsx:20 — ownershipApi.incoming](../../beauty-booking-web-main/beauty-booking-web-main/src/pages/Customer/CustomerBenefits.jsx); [beauty-booking-web-main/beauty-booking-web-main/src/App.jsx:293 — path="/customer/*"](../../beauty-booking-web-main/beauty-booking-web-main/src/App.jsx).

<a id="gap-22"></a>

## GAP-22 — Hai quyết định duyệt business có thể cùng thành công

1. **ID và scenario:** [CAT-004](EXCEPTION-MATRIX.md#cat-004). Root cause được tính1 lần.
2. **Severity: MEDIUM.** Hồ sơ và kết luận thay đổi bởi quyết định stale; không suy ra business tự public khi chỉ APPROVED.
3. **Flow/role/resource:** Catalog / Branch / business review concurrency. Hai admin đều đọc business PENDING_REVIEW rồi quyết định APPROVE/REJECT khác nhau.
4. **Tiên quyết:** Hai admin đều đọc business PENDING_REVIEW rồi quyết định APPROVE/REJECT khác nhau. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. 
6. **Lịch A/B hoặc partial failure:** A/B đọc pending → A tx approve commit → B tx reject theo id commit.
7. **Mong đợi:** Một quyết định thắng; request còn lại 409 và reload, history phản ánh chuỗi transition thực.
8. **Hiện tại:** review kiểm tra status trước transaction; tx.business.update where id và document updates không CAS/version. Cả hai ghi review events fromStatus cũ, trạng thái cuối last-write-wins.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/business/business-onboarding.service.ts:495 — async review(](../../beauty-booking-api-main/src/business/business-onboarding.service.ts). [business/business-onboarding.service.spec.ts](../../beauty-booking-api-main/src/business/business-onboarding.service.spec.ts) — ĐÃ CHẠY; suite/file có PASS. Reject nonpending/require reason/approve success trong mock; không hai reviewer thật. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-business-business-onboarding-service-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Role/admin permission, reason cho reject, transaction business+documents+events có; không có row lock/recheck sau khi tx bắt đầu. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Hồ sơ và kết luận thay đổi bởi quyết định stale; không suy ra business tự public khi chỉ APPROVED.
12. **Hướng sửa — chưa triển khai:** CAS status/revision hoặc lock+re-read; áp dụng cùng contract cho submit/updateDraft.
13. **Test cần có trong task sửa sau:** Hai reviewer và submit/edit/review xen kẽ; assertion chỉ một decision/consistent events.
14. **Chưa xác minh:** Chưa chạy PostgreSQL race. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js:52 — async function request](../../beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js).

<a id="gap-23"></a>

## GAP-23 — Nhắc lịch dùng cửa sổ 5 phút không có catch-up/dedupe nguyên tử

1. **ID và scenario:** [BG-004](EXCEPTION-MATRIX.md#bg-004). Root cause được tính1 lần.
2. **Severity: MEDIUM.** Khách bỏ lỡ nhắc lịch hoặc nhận trùng, không làm mất booking. Không khẳng định email/push đã được gửi vì cron chỉ ghi in-app.
3. **Flow/role/resource:** Workers / Recurring / policy reminder cron. PolicyNotificationCron được đăng ký trong SchedulerModule; timer dừng/chậm quá cửa sổ5phút hoặc hai process cùng tick.
4. **Tiên quyết:** PolicyNotificationCron được đăng ký trong SchedulerModule; timer dừng/chậm quá cửa sổ5phút hoặc hai process cùng tick. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. 
6. **Lịch A/B hoặc partial failure:** A/B cùng đọc notifications rỗng → A createMany → B createMany. Miss: timer ngừng qua cửa sổ → lần tick sau start <reminderTarget nên không còn selected.
7. **Mong đợi:** Sau restart/chậm tick vẫn nhắc lịch chưa gửi đúng policy; một logical reminder không bị nhân đôi.
8. **Hiện tại:** Lọc start trong [now+lead, now+lead+5m); không có persisted watermark/catch-up. Read notifications rồi createMany tách rời; Notification không có unique booking/type/recipient.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/scheduler/policy-notification.cron.ts:17 — async tick](../../beauty-booking-api-main/src/scheduler/policy-notification.cron.ts); [beauty-booking-api-main/src/notifications/notification-outbox.worker.ts:9 — export class](../../beauty-booking-api-main/src/notifications/notification-outbox.worker.ts); [beauty-booking-api-main/src/app.module.ts:79 — { provide: APP_GUARD](../../beauty-booking-api-main/src/app.module.ts). Không tìm thấy test trực tiếp cho trigger này; source audit, chưa runtime.
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Có check notifications.length và giới hạn2000row nhưng không CAS; outbox có dedupe song cron này ghi Notification trực tiếp. Global HTTP idempotency không áp cho timer. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Khách bỏ lỡ nhắc lịch hoặc nhận trùng, không làm mất booking. Không khẳng định email/push đã được gửi vì cron chỉ ghi in-app.
12. **Hướng sửa — chưa triển khai:** Dùng durable reminder key/outbox, watermark/catch-up bounded theo policy; điều phối nhiều instance; phân trang ổn định.
13. **Test cần có trong task sửa sau:** Clock fake bỏ qua10phút/restart; hai worker barrier cùng booking; assert một reminder và không bỏ sót.
14. **Chưa xác minh:** Chưa chạy timer thật; topology/runtime load chưa biết. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js:52 — async function request](../../beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js).

<a id="gap-24"></a>

## GAP-24 — Cập nhật staff trực tiếp bỏ qua luồng xử lý lịch tương lai

1. **ID và scenario:** [STAFF-002](EXCEPTION-MATRIX.md#staff-002). Root cause được tính1 lần.
2. **Severity: MEDIUM.** Staff inactive vẫn được gắn các lịch đang chờ, trong khi API chuyên biệt yêu cầu giải quyết impact; trạng thái UI và khả năng phục vụ thiếu nhất quán.
3. **Flow/role/resource:** Staff / Mail / PATCH staff status. Owner đúng business PATCH staff/:id với status INACTIVE/LOCKED hoặc isBookable=false trong khi còn lịch được phân công.
4. **Tiên quyết:** Owner đúng business PATCH staff/:id với status INACTIVE/LOCKED hoặc isBookable=false trong khi còn lịch được phân công. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. Có thể xác nhận nhánh tuần tự trước khi dựng concurrency.
6. **Lịch A/B hoặc partial failure:** Không cần race: cùng staff có future booking, PATCH status INACTIVE thay vì gọi deactivate. Race mới với create là kiểm tra bổ sung.
7. **Mong đợi:** Phải tách rõ pause nhận lịch mới và offboard/khóa nhân sự; thao tác làm nhân sự không thể phục vụ cần xử lý lịch đã nhận theo cùng invariant.
8. **Hiện tại:** StaffService.update ghi các field status/bookable trực tiếp sau assertExists. Không offboardingImpact/reassignment; endpoint deactivate riêng mới chạy workflow và thu hồi role/session.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/staff/staff.service.ts:369 — async update(](../../beauty-booking-api-main/src/staff/staff.service.ts); [beauty-booking-api-main/src/staff/staff.service.ts:469 — async offboardingImpact](../../beauty-booking-api-main/src/staff/staff.service.ts); [beauty-booking-api-main/src/bookings/bookings.validation.ts:134 — export async function validateStaffForService](../../beauty-booking-api-main/src/bookings/bookings.validation.ts). Không tìm thấy test trực tiếp cho trigger này; source audit, chưa runtime.
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Owner scope và whitelist fields còn đúng; booking lịch sử không bị xóa; tạo lịch mới sẽ reject inactive staff. Không suy ra tài khoản bị khóa chỉ từ staff.status. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Staff inactive vẫn được gắn các lịch đang chờ, trong khi API chuyên biệt yêu cầu giải quyết impact; trạng thái UI và khả năng phục vụ thiếu nhất quán.
12. **Hướng sửa — chưa triển khai:** Một transition service chung; nếu pause chủ ý vẫn phục vụ lịch cũ, đặt tên/state và UI policy rõ, không cho PATCH dùng state offboard thay thế workflow.
13. **Test cần có trong task sửa sau:** Cùng future booking đi qua PATCH và deactivate; verify quy tắc thống nhất, không mất lịch/thu hồi sai quyền.
14. **Chưa xác minh:** Chưa xác nhận business semantics mong muốn của LOCKED/INACTIVE trên UI; đường bypass workflow được xác định bằng source. Consumer evidence: [beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js:52 — async function request](../../beauty-booking-web-main/beauty-booking-web-main/src/api/apiClient.js).

<a id="gap-20"></a>

## GAP-20 — OpenAPI lệch scope của route đọc booking theo branch

1. **ID và scenario:** [DOC-001](EXCEPTION-MATRIX.md#doc-001). Root cause được tính1 lần.
2. **Severity: LOW.** Client/reviewer hiểu sai contract, CI fail.
3. **Flow/role/resource:** Documentation contract / OpenAPI route scope. Chạy test contract với worktree hiện tại.
4. **Tiên quyết:** Chạy test contract với worktree hiện tại. Cần môi trường riêng có thể bỏ đi hoặc mocks có kiểm soát; không dùng demo/live.
5. **Repro an toàn (chưa thực hiện):** dựng fixture theo tiên quyết; gọi đúng controller/operation của inventory với tài khoản test đúng role; chèn barrier hoặc dependency fault ở điểm nêu tại mục6/8; đọc response và trạng thái trước/sau; đối chiếu mục7. Không gửi SMTP, không chuyển khoản thật; mọi khóa/token chỉ là fixture cục bộ. 
6. **Lịch A/B hoặc partial failure:** N/A: lỗi tĩnh deterministic.
7. **Mong đợi:** Tài liệu phản ánh runtime metadata và service-bound scope thật.
8. **Hiện tại:** GET /bookings/by-branch/{branchId} có x-scope-requirement trong JSON generated nhưng metadata controller hiện không có RequireScope. Test assertion line 19 fail.
9. **Bằng chứng source/schema/test:** [beauty-booking-api-main/src/common/permissions/openapi-contract.spec.ts:19 — expect(operation['x-scope-requirement'])](../../beauty-booking-api-main/src/common/permissions/openapi-contract.spec.ts); [beauty-booking-api-main/src/bookings/bookings-access.service.ts:38 — export class](../../beauty-booking-api-main/src/bookings/bookings-access.service.ts). [common/permissions/openapi-contract.spec.ts](../../beauty-booking-api-main/src/common/permissions/openapi-contract.spec.ts) — FAIL assertion nêu dưới (suite còn2 pass). FAILED x-scope-requirement tại GET /bookings/by-branch/{branchId}; 2 test khác của suite pass. [Chỉ mục tên test](TEST-COVERAGE.md#test-beauty-booking-api-main-src-common-permissions-openapi-contract-spec-ts).
10. **Bảo vệ còn hiệu lực, đã đối chiếu:** Role/permission và BookingsAccessService vẫn hiện hữu; khác biệt docs không tự chứng minh route bỏ tenant guard. Đã xét guard/interceptor/filter toàn cục; chúng không bổ sung điều kiện ghi còn thiếu tại điểm này.
11. **Hậu quả/phạm vi:** Client/reviewer hiểu sai contract, CI fail.
12. **Hướng sửa — chưa triển khai:** Sau khi quyết định metadata mong muốn, cập nhật generator output trong task sửa riêng và rerun contract.
13. **Test cần có trong task sửa sau:** Test hiện có đã fail đúng mismatch; không cần bịa test mới.
14. **Chưa xác minh:** Chưa gán nguyên nhân cho commit nào; audit không sửa ứng dụng/OpenAPI. UI riêng chưa trace; không báo đã thử demo.

## Đối chiếu để loại false positive

- Không khẳng định overpayment đã xảy ra: unique settled-payment index trong migration chặn payment PAID thứ hai nếu đã áp dụng. GAP-03 ghi nhận xung đột với split-payment UI; thiếu aggregate check ở verify chỉ trở thành rủi ro khác nếu runtime schema khác.
- Change request creation ghi notification trong cùng transaction và có test lỗi notification; không gộp vào post-commit GAP-07.
- Recurring create vẫn dùng overlap guards; GAP-16 là preview/skip UX, không chứng minh double booking.
- Package session có unique redeemedBookingServiceId; không báo một item tiêu nhiều lượt cùng lúc. GAP-19 nói về terminal/branch lifecycle.
- Audit helper nuốt lỗi có chủ ý: không suy audit failure sau media commit sẽ tự unlink file.
- ReviewsContext mobile cũ không có consumer mutation hiện hành; AppointmentDetail dùng reviewsApi. Không coi local context là luồng review đang mất đồng bộ.
- Admin passwordHash exposure giới hạn ở admin có permission; không ghi thành anonymous account takeover.
- Đây là phân tích source/constraints và unit tests; mọi kết luận về race thật cần môi trường PostgreSQL/Redis riêng.
