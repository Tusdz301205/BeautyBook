# Quy tắc và invariant

| Rule | Invariant/kỳ vọng | Nguồn policy và enforcement | Writers cần xét |
| --- | --- | --- | --- |
| BR-01 | Customer chỉ tạo/xem/sửa lịch của mình; counter đúng branch/business | `bookings.controller.ts:245-273,867-895`; `bookings-access.service.ts:44-55,62-114,126-230` | create, list/detail, change request, recurring |
| BR-02 | Branch, offering, business, variant phải đang nhận lịch và cùng scope | `bookings.service.ts:865-900,1183-1227`; `branch-state.service.ts:45-62` | create, archive, branch transition, offering update |
| BR-03 | Staff active/bookable, đúng branch/capability/giờ; lịch item không chồng provider | `bookings.validation.ts` hàm `validateStaffForService`/`assertNoOverlap`; `bookings.service.ts:1231-1355`; SQL trigger | create, move, assign, item, change request, deactivate |
| BR-04 | Customer không có hai booking blocking trùng khoảng | `bookings.service.ts:1323-1374`; migration customer slot guard | create, move, approve request, recurring |
| BR-05 | Slot/giá preview không là cam kết; final create kiểm lại trạng thái | `bookings.service.ts:1172-1374`; `getAvailableSlots:1917-2157` | create, catalog/price/schedule writers |
| BR-06 | Booking và item chỉ chuyển theo state machine; terminal không sửa | `bookings.validation.ts:15-86`; `booking-items.service.ts:33-35,120-162`; `bookings.service.ts:474-512,630-655` | status, add/update item, expiry, impact |
| BR-07 | `COMPLETED` chỉ khi tất cả item terminal và điều kiện thanh toán đủ | `bookings.service.ts:476-509` | complete, add/update item, payment posting (`DEFERRED_PAYMENT`) |
| BR-08 | Khách hủy trực tiếp theo cutoff; request hủy/đổi lịch có phê duyệt và cutoff | `bookings.service.ts:531-627`; `change-requests.service.ts:194-435` | cancel, approve, expiry, no-show |
| BR-09 | Lịch lịch sử giữ tên/giá/thời lượng tại thời điểm đặt | `bookings.service.ts` create item snapshot; `booking-items.service.ts:60-81` | create, reprice, catalog edits, UI detail |
| BR-10 | Mọi lịch tương lai bị tác động phải được xử lý trước offboard/archive/close/đóng ngày | `staff.service.ts:474-627`; `services.service.ts:755-783`; `branch-state.service.ts:73-129`; `branches.service.ts:916-930` | create song song, impact resolution, lifecycle, holiday/hours |
| BR-11 | Một recurring plan không để các kỳ tạo dở vô hình | `recurring.service.ts:39-147`; `recurring-plan-recovery.worker.ts:27-77` | create, compensation, recovery, cancel |
| BR-12 | Booking commit và notification intent đồng bộ; delivery có thể retry | `bookings.service.ts:1531`; `notification-outbox.worker.ts:68-132` | create, status, impact, worker |

Policy cần product owner làm rõ: (a) hồ sơ khách vãng lai thất bại booking được giữ lại làm CRM lead hay phải hoàn tác? (b) impact `APPROVED_EXCEPTION` có cho phép staff đã offboard tiếp tục phục vụ không? (c) booking `COMPLETED` có được thêm/reprice item hồi tố không? Code hiện không cho phép; (d) recurring recovery giữ các kỳ đã tạo khi process chết, trong khi lỗi bắt được thì compensation hủy — hai chính sách này cần được chấp nhận rõ. Không dùng các câu hỏi policy này làm bằng chứng lỗi tự động.
