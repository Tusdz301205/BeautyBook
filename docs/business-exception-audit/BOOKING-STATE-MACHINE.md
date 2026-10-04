# Booking và item state machine

`Booking.status` lưu `BookingStatus` (`schema.prisma:3208–3219`). `BookingLifecycleStatus` (`:3023–3031`) là enum hẹp hơn; chưa chứng minh là cột persisted của Booking. `BookingService.status` lưu enum riêng (`:3160–3166`). `bookings.service.ts:421–437` chuẩn hóa nhãn tiếng Việt cũ cho API status update; điều đó không tự chuyển các row cũ. REJECTED/EXPIRED là trạng thái có trong persisted enum và writer (`bookings.service.ts:1604–1805` cho expiry/rejection); không gọi chúng là CANCELLED dù item chưa xong được đóng cùng helper.

| From | To | Actor/operation | Expected allowed? | Conditions | Currently accepted / enforcement | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| PENDING | CONFIRMED | owner/receptionist | Có | booking còn hợp lệ; payment policy khi complete là riêng | whitelist actor + CAS | `bookings.validation.ts:10–77`, `bookings.service.ts:629–669` |
| PENDING | CANCELLED | customer/salon | Có điều kiện | customer còn ≥4h, salon policy; đúng owner/resource | whitelist, policy và CAS, item unfinished đóng | `customer-cancellation-policy.ts:4–30`, `bookings.service.ts:531–676` |
| PENDING | REJECTED | owner/receptionist | Có | quyền branch, lý do theo route | whitelist + CAS | `bookings.validation.ts:10–66` |
| PENDING | EXPIRED | system worker | Có | pending expiry thực sự đến hạn | transaction riêng + history | `bookings.service.ts:1604–1630` |
| CONFIRMED | CHECKED_IN | receptionist/owner | Có | khách đến, time guard | actor/time guard + CAS | `bookings.validation.ts:10–66`, `bookings.service.ts:547–669` |
| CONFIRMED | NO_SHOW | receptionist/owner | Có điều kiện | sau grace 15 phút, xác nhận chưa báo/đến | row lock, check request/history/item, violation và audit cùng transaction | `bookings.service.ts:555–611` |
| CONFIRMED | CANCELLED | customer/salon | Có điều kiện | như trên | policy + CAS | `bookings.service.ts:531–676` |
| CHECKED_IN | IN_PROGRESS | staff/owner hoặc item START | Có | item bắt đầu sau check-in | actor whitelist; item START riêng | `bookings.validation.ts:35–47`, `booking-items.service.ts:155–160` |
| CHECKED_IN | CANCELLED | owner | Có điều kiện | xử lý cancellation; ảnh hưởng payment tách riêng | actor whitelist + CAS | `bookings.validation.ts:35–47`, `bookings.service.ts:560–676` |
| IN_PROGRESS | COMPLETED | staff/owner | Có điều kiện | mọi item terminal và số dư đủ theo rule hiện hành | kiểm tra item/payment trước transaction, CAS status; race item/payment cần DB test | `bookings.service.ts:457–510,629–676` |
| IN_PROGRESS | CANCELLED | owner | Có điều kiện | xử lý item đang làm và payment | CAS; chỉ item unfinished chuyển CANCELLED | `bookings.service.ts:629–667`, `booking-item-lifecycle.ts:8–20` |
| terminal | active hoặc terminal khác | mọi actor qua `updateStatus` | Không theo whitelist hiện tại | không có | bị từ chối trong helper trước write | `bookings.validation.ts:10–86` |
| same | same | mọi actor qua `updateStatus` | Không | thao tác lặp | helper từ chối | `bookings.validation.ts:72–86` |

`PLATFORM_ADMIN` đi qua actor guard đặc biệt nhưng **không** vượt global whitelist (`bookings.validation.ts:57–86`); NO_SHOW vẫn cấm admin. Các operation khác (`moveBooking`, `resizeBooking`, `assignStaff`, recurring, change request, impact) cần kiểm tra writer riêng; bảng trên là `updateStatus` và item START, không chứng minh mọi writer đều gọi helper. Source `booking-items.service.ts:105–210` khóa item, kiểm tra revision và booking active; SCHEDULED→IN_PROGRESS cần booking CHECKED_IN/IN_PROGRESS; IN_PROGRESS→COMPLETED; SCHEDULED→CANCELLED/SKIPPED, IN_PROGRESS→SKIPPED theo action. Booking cancellation giữ item COMPLETED/SKIPPED/CANCELLED làm sự kiện lịch sử (`booking-item-lifecycle.ts:8–20`). Booking completion yêu cầu mọi item terminal; item all-terminal chưa tự chứng minh booking đã COMPLETED. `BookingStatusHistory` viết trong transaction status (`bookings.service.ts:669`) nhưng kiểm tra mọi writer ngoài status còn thiếu.

Các gap liên quan: [BEX-03](BUSINESS-EXCEPTIONS.md#bex-03) replay/duplicate create, [BEX-05](BUSINESS-EXCEPTIONS.md#bex-05) stale/race completion, [BEX-10](BUSINESS-EXCEPTIONS.md#bex-10) impact partial mutation, [BEX-17](BUSINESS-EXCEPTIONS.md#bex-17) payment consistency. BEX-05 là PARTIALLY HANDLED vì guard item/payment đọc trước CAS rồi không re-read dưới cùng lock; chưa khẳng định race đã tái hiện. Nếu business muốn SKIPPED tính là đủ để complete mọi trường hợp, đó là policy cần xác nhận (AMB-06), không tự xem là bug.
