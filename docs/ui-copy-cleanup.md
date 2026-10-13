# Rà soát nội dung hiển thị BeautyBook — 12/10/2026

Phạm vi: mã nguồn web, mobile và các thông báo backend có thể xuất hiện trên giao diện. Đã giữ bản mobile Berry Bloom đang ghép cùng toàn bộ thay đổi hợp lệ có sẵn; không reset/revert repository.

## Những nội dung đã dọn

- Gỡ mô tả dưới tiêu đề chỉ giải thích cách tải dữ liệu, kiểm tra quyền hoặc hoạt động của hệ thống: trang chủ/khám phá, các trang khách hàng, vận hành doanh nghiệp, quản lý nhân sự, lịch hẹn và quản trị.
- Gỡ các đoạn lặp lại điều đã thể hiện qua tiêu đề, bộ lọc hoặc nút thao tác. Màn lịch hẹn dùng chung không còn giải thích bộ lọc Staff bị khóa theo hồ sơ; chỉ giữ tên màn, nhánh đang xem, ngày và các bộ lọc thực tế.
- Rút gọn những lời như “máy chủ sẽ kiểm tra lại”, “tải trực tiếp từ API”, “dữ liệu hiện tại”, “đúng tenant”. Các từ case, item, snapshot, Platform và force-cancel được thay bằng cách gọi phù hợp người dùng ở vị trí hiển thị.
- Mobile: các màn Customer/Staff/Owner, thông báo, trạng thái tải/lỗi, hướng dẫn chuyển sang web và hiệu chỉnh giờ thực tế. Thông báo chỉ ghi số chưa đọc, không giải thích cơ chế lọc chi nhánh.
- Backend: thông báo quyền và validation dùng ngôn ngữ sản phẩm; bỏ scope/tenant/canonical khỏi thông báo người dùng, giữ nguyên HTTP status, mã lỗi, điều kiện kiểm tra và quyền.
- Web chỉ định dạng lỗi idempotency ở nơi trình bày sau khi đã phân loại. Chuỗi và dữ liệu lỗi gốc vẫn được giữ vì luồng gửi lại yêu cầu đang sử dụng chúng để tránh đặt lịch trùng.

Các thay đổi so với checkpoint của lượt này nằm trong 50 file web và 22 file nguồn mobile, cùng 12 file backend. Một assertion chuỗi của bộ test Owner mobile được cập nhật thêm; không giảm assertion nghiệp vụ. Có bản đối chiếu từng file tại `report-output/ui-copy-cleanup-20261012/changed-files.json`.

## Nội dung được giữ

Nhãn trường, hướng dẫn thực hiện thao tác, chính sách/đồng ý, hậu quả khi hủy/duyệt, thông báo lỗi và trạng thái rỗng có ích vẫn được giữ. Giờ dự kiến và giờ thực tế, thời gian chưa xác định, kết quả đặt lịch chưa rõ và nhãn ảnh minh họa không bị loại bỏ. Giao diện dữ liệu cá nhân đã gỡ, tài chính bị ẩn và backend audit vẫn giữ trạng thái sản phẩm hiện có.

Chú thích mã nguồn hữu ích không hiển thị cho người dùng, mã permission, field API, thông tin phục vụ kiểm tra quyền và dữ liệu do người dùng nhập được giữ. Không sửa nội dung dữ liệu lịch sử trong database.

## Kiểm tra thực tế

| Phần | Kết quả |
| --- | --- |
| Backend typecheck/build | Đạt |
| Backend Jest liên quan guard, lỗi, idempotency, giờ thực tế, ảnh, khuyến mãi, dịch vụ, người dùng và báo cáo | 10 suite, 131 test đạt |
| Web unit test đầy đủ | 171/171 đạt |
| Web production build cuối | Đạt |
| Mobile typecheck | Đạt |
| Mobile Node test đầy đủ | 205/205 đạt |
| Mobile Android/Hermes export | Đạt |
| Demo web với API QA thật | Trang công khai, khách hàng, Owner, lễ tân, Staff, admin đều tải được trang và dữ liệu |

Đã lưu ảnh ở 375 và 1440px cho các trang mẫu. Các kiểm tra DOM ghi nhận không tràn ngang ở những kích thước đã đo, tiêu đề đúng và không còn những đoạn chú thích cụ thể đã gỡ. Đây là kiểm tra các trang mẫu sau thay đổi copy, không phải nghiệm thu toàn bộ nút và luồng nghiệp vụ của mọi route.

Hai test web ban đầu còn kỳ vọng câu lỗi cũ; đã cập nhật chuỗi kỳ vọng theo copy mới, giữ kiểm tra lỗi không lộ thông tin kỹ thuật và kiểm tra hiệu chỉnh đã lưu nhưng chưa tải lại được chi tiết. Bộ test cuối đạt toàn bộ. Một lần chụp lại lễ tân điều hướng trước khi đăng nhập hoàn tất đã bị loại khỏi bằng chứng đạt; ảnh lỗi harness được giữ riêng, lượt chụp cuối đã chờ đúng tiêu đề lễ tân.

Lượt browser chỉ đăng nhập/đăng xuất tài khoản QA và đọc dữ liệu. Không tạo/sửa/hủy lịch, cập nhật hồ sơ, thanh toán hoặc hoàn tiền. API QA giữ các worker nền và email tắt. Chưa chạy kiểm tra native mobile, iOS hoặc thiết bị thật; các test Node/export không thay thế QA native. Không commit/push trong lượt này.

## Bằng chứng

- Thư mục: `report-output/ui-copy-cleanup-20261012/` (Git ignore).
- `source-before.zip`, `inventory.json`, `inventory-final.json`: checkpoint và bản quét mã nguồn; ứng viên từ khóa cũng bao gồm mã/thuộc tính không hiển thị nên không dùng số từ khóa làm số câu đã xóa.
- `backend-copy-edits.json`, `root-final-copy-edits.json`, `changed-files.json`: các thay đổi cụ thể.
- `browser-results.json`: sáu trang mẫu và kết quả kiểm tra.
- `public-home-375.jpg`, `public-home-1440.jpg`, `customer-*.jpg`, `owner-*.jpg`, `staff-*.jpg`, `receptionist-*.jpg`, `admin-*.jpg`: ảnh giao diện mẫu; các ảnh `receptionist-recheck-invalid-*` là lỗi harness, không tính đạt.
- Các log `*-tests*.log`, `*-typecheck*.log`, `*-build*.log`, `android-export.log`: kết quả chạy thực tế.

Demo web: `http://127.0.0.1:5176/`. Đây là dữ liệu kiểm thử, không phải môi trường production.


## Bổ sung13/10 — gỡ chuyển chủ và tab nhân sự

Theo yêu cầu mới, đã gỡ giao diện chuyển quyền sở hữu khỏi Staff/Lễ tân/Owner/Admin: menu, trang IncomingOwnership/AdminOwnership, tab vận hành, form/phần pháp nhân-payout chỉ dùng cho chuyển chủ, client ownershipApi và helper độc lập. Vận hành giữ xử lý lịch bị ảnh hưởng. Backend ownership/data/audit giữ nguyên; không tuyên bố endpoint server đã bị bỏ. Link cũ salon/incoming-ownership về account, admin/ownership về admin; customer benefits?tab=ownership về màn hợp lệ theo vai trò. Notification allowlist không mở hai route đã gỡ.

Chi tiết nhân sự còn Tổng quan/Tài khoản/Vai trò & chi nhánh/Dịch vụ; documents/audit/unknown query được replace về profile, giữ query khác. Không render raw auditTrail; nhân sự, tài khoản/mời nhân viên và dịch vụ độc lập giữ nguyên. Nhãn trạng thái/position mã role được trình bày tiếng Việt, tên vị trí tự nhập giữ nguyên.

Gỡ hai câu trong ảnh cùng9mô tả giới thiệu lặp ở web, metadata kỹ thuật trong lịch sử bảo mật; đổi KYC/private/public URL thành hướng dẫn ngắn về ảnh công khai và giấy tờ riêng. Mobile dọn8file copy, subtitle tùy chọn không còn element trống. Giữ validation/consent/hậu quả/quyền/actual timing/unknown/ảnh minh họa; không xóa comment mã nguồn hữu ích.

Web **265tests/build đạt**, mobile **222Node/typecheck đạt** qua agent (raw logs chỉ tool output), native không chạy cho revision này. Actual demo5173/databaseglowbook:12observations đạt ở5roles,4widths375/768/1024/1440 staff tabs/no horizontal overflow; Reviews/Vouchers375/1440 không còn hai câu. Old links/reload giữ phiên và về đúng màn. Không coi đây là mọi nút/E2E; timestamp artifact là evidence time, không đo latency.

Browser phát hiện empty ImpactPanel thiếu AlertTriangle sau dọn import; sửa +actual JSX regression, error baseline giữ. Đổi tài khoản nhanh lộ STALE_SESSION từ logout cũ; actual store/API regression baselineFAIL→PASS, giữ transport error thật, không clear/navigate sau phiên mới. Hai shell đi login ngay khi user yêu cầu logout; normal fast switch/reload cuối không console error. Các lần goto trước khi login hoàn tất, selector nhãn sai, chờ root/salon trong khi receptionist vềappointments và scrollbar15px gây falseFAIL được giữ như harness findings. Build preview thống nhất API127.0.0.1 để khớp host; initial login trace không dùng làm bằng chứng duy nhất của lỗi SameSite.

Evidence: report-output/ui-prune-20261013/ (validation.json/browser-cases.json/staff-widths.json/logout-browser-final.json +PNG/logs). Source659files SHA256 `c1bd2522356337d755b7d7d8d4fd53f8684788a554dbe3268aa385cdbd657d60`. Backend source không đổi; old gates/timestamps giữ lịch sử. Không chủ động tạo/sửa/hủy lịch, ghi tài chính, reset/seed/drop hoặc xóa lịch sử. **wholeProductComplete=false** cho goal hệ thống còn native/external/production/consent gaps.
