# Kiểm tra bộ sơ đồ

Kết quả máy đọc nằm ở [render-report](rendered/render-report.json) và [validation-report](rendered/validation-report.json). Số lượng chỉ tính manifest hiện hành, không cộng ảnh archive.

## Kết quả đã thực hiện

| Hạng mục | Kết quả |
|---|---|
| Nguồn chỉnh sửa | 86 PlantUML; 5 BUC, 19 SUC, 11 lớp phân tích, 21 lớp thiết kế, 30 ERD |
| Export | 86 HTML hình +86 SVG +86 PNG 3×; đủ file, kích thước đúng |
| Cú pháp | PlantUML checkonly exit 0; render exit 0 |
| Phong cách bản ngày 26/09/2026 | 86 hình dùng Times New Roman; 24 Use Case nền kem/viền đỏ rượu vang; 62 hình lớp/ERD có tên lớp/bảng in đậm; không gradient, filter hoặc animation |
| Ngữ nghĩa Use Case | 24 hình: alias actor/ellipse và association khớp một–một với source |
| Nội dung | 12 BUC, 40 SUC; 47 định danh phân tích và 49 lớp/interface thiết kế được đưa lên hình |
| Schema | 121/121 model; 92 enum; 296 FK khai báo trong catalogue; tám model di sản được tách |
| Hình học cơ bản | Không text ra ngoài viewBox; cỡ chữ thấp nhất ước lượng 8,8pt theo vùng A4 đã chọn |
| Skill | self_check và verify-geometry exit 0 cho toàn bộ 86 HTML hình |
| Trình duyệt | Mục lục ở 1440px và 375px: mỗi lượt decode đủ 86 ảnh, không ảnh hỏng, không tràn ngang toàn trang, không pageerror |
| Liên kết | Kiểm tra toàn bộ liên kết file trong Markdown/HTML hiện hành; số lượng và lỗi ở validation-report |
| Bảo toàn phạm vi | Chỉ chỉnh trong thư mục bộ sơ đồ; giữ thay đổi ứng dụng có từ trước, không thực thi thao tác DB |

Đã xem 15 contact sheet bao phủ toàn bộ hình để kiểm tra bố cục, sau đó mở riêng BUC-overview, SUC-overview/payments, AC-overview/booking, DC-auth/providers/privacy và ERD-policy/staff/catalog để kiểm tra chữ, đầu nối, bội số và khóa. Các cạnh giao nhau trong hình nhiều actor không có dấu junction, không mang nghĩa hợp nhất luồng. Không coi sheet thu nhỏ là bản để chèn vào luận văn.

Ảnh kiểm chứng: [mục lục desktop](rendered/qa/index-1440.png), [mục lục mobile](rendered/qa/index-375.png), [trang Use Case thanh toán](rendered/qa/SUC-payments-browser.png). [Browser report](rendered/qa/browser-report.json), [contact sheet đầu](rendered/qa/sheet-01.png) và [cuối](rendered/qa/sheet-15.png). PNG của từng hình chính là ảnh chụp SVG bằng trình duyệt, không phải output từ renderer giản lược.

## Phạm vi kiểm tra

- Kiểm tra source model/method, hash schema và file TypeScript, truy vết 12 BUC/40 SUC, coverage 121 model.
- PlantUML checkonly và xuất SVG cục bộ; HTML chứa SVG giống byte với bản riêng; PNG xuất từ chính SVG trong HTML ở 3×.
- Use Case trình bày riêng: đối chiếu từng alias actor/ellipse và cặp association với source PlantUML. Không thêm include/extend/generalization không có căn cứ.
- Đối chiếu hình thức với hai ảnh tham khảo: giữ ranh giới nghiệp vụ riêng cho BUC, ranh giới “Hệ thống BeautyBook” cho SUC; nhãn phân tích tiếng Việt có dấu, tên lớp thiết kế giữ đúng source. Đã xem lại đủ 15 contact sheet sau lần đổi font, màu và tên lớp in đậm.
- Đo text ra ngoài viewBox, kích thước PNG, cỡ chữ ước lượng trên A4 dọc/ngang; kiểm tra liên kết nội bộ và tài liệu dẫn tới source.
- Skill self_check kiểm tra accessible SVG và tính tự chứa; geometry chỉ kiểm tra mask/rectangle heuristic. PASS của hai script không chứng minh mọi đường nối không giao nhau; còn cần xem hình.

## Giới hạn

Chỉ kiểm tra tài liệu/render và khảo sát code. Không chạy frontend/backend build hoặc test nghiệp vụ vì lượt này không thay ứng dụng. Không truy vấn DB, không áp dụng migration, không reset/seed, không thực hiện đặt lịch/thanh toán/chuyển chủ. Không xác nhận email/push/đồng bộ tài khoản hay trạng thái production.

ERD là phép chiếu rút gọn theo miền; catalogue FK, dictionary và SQL constraints là phần bắt buộc đọc cùng. Cỡ chữ A4 là tính toán theo vùng in, không thay thử in bằng máy in thực. Các hình cần đưa vào luận văn nên được chọn theo nội dung chương thay vì chèn toàn bộ 86 hình.

Công cụ Sharp tạo contact sheet có cảnh báo Fontconfig không ghi được cache; tiến trình vẫn exit 0 và đủ 15 sheet đã mở kiểm tra. PNG từng sơ đồ được chụp bằng Edge, không dùng bước ghép sheet này.

Các gap triển khai và điểm cần chủ nhiệm nghiệp vụ duyệt nằm trong [SYSTEM-AUDIT](SYSTEM-AUDIT.md). Không có hành động sửa ứng dụng ngầm trong lượt tài liệu.
