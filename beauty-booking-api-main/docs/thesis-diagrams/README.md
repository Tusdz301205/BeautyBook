# BeautyBook — Bộ sơ đồ phân tích và thiết kế

Mở [index.html](index.html) trực tiếp bằng Edge/Chrome. Không cần chạy ứng dụng hoặc kết nối DB. Mục lục chỉ liên kết bộ hiện hành trong manifest; mỗi hình có PlantUML, HTML tự chứa SVG, SVG riêng và PNG 3×.

## Thứ tự đọc

Phong cách hiện hành theo hai ảnh tham khảo của người dùng: nền trắng, Times New Roman (đã có trên máy), Use Case vàng kem `#fffde7` với viền/actor/association đỏ rượu vang `#773b4a`; lớp và ERD nền trắng, viền xám, tên in đậm. Actor chỉ ghi tên tiếng Việt; mã role được giải thích trong ma trận quyền. Nhãn lớp phân tích dùng tiếng Việt có dấu, alias giữ ổn định. Caption/mã hình nằm ngoài mô hình; không thêm khối trang trí vào SVG/PNG.

Bảy nội dung được tổ chức trong năm nhóm: hai nhóm Use Case đều có sơ đồ **và** đặc tả; ba nhóm còn lại là lớp phân tích, lớp thiết kế và ERD. Như vậy số nhóm thư mục không phải số phần nội dung luận văn.

1. [SYSTEM-AUDIT](SYSTEM-AUDIT.md): phạm vi, actor/scope, quy tắc, trạng thái và các gap.
2. [GLOSSARY](GLOSSARY.md), [BUC](01-business-use-cases/specifications.md), [SUC](02-system-use-cases/specifications.md), [ma trận quyền](02-system-use-cases/actor-permission-matrix.md).
3. [Lớp phân tích](03-analysis-classes/analysis-class-notes.md), [lớp thiết kế](04-design-classes/design-class-notes.md), [TRACEABILITY](TRACEABILITY.md).
4. [Coverage](05-data-model/model-coverage.md), [từ điển](05-data-model/data-dictionary.md), [FK](05-data-model/relationship-catalog.md), [SQL](05-data-model/sql-constraints.md).
5. [VALIDATION](VALIDATION.md): kiểm tra thực tế và giới hạn.

Nguồn là working tree, không phải tài liệu cũ. BUC/SUC cần người phụ trách nghiệp vụ duyệt thuật ngữ và ranh giới trước khi đưa vào luận văn. “Có triển khai” không đồng nghĩa đã kiểm thử runtime.

## Dựng lại

Chạy từ thư mục này bằng PowerShell, với Node, Java, PlantUML và thư viện cục bộ:

```powershell
$env:PLANTUML_JAR = 'C:\Users\Admin\.vscode\extensions\jebbs.plantuml-2.18.1\plantuml.jar'
$env:BEAUTYBOOK_NODE_MODULES = 'C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node scripts/extract-source.cjs
node scripts/build.cjs
node scripts/render.cjs
node scripts/publish.cjs
node scripts/validate.cjs
```

extract-source đọc Prisma và TypeScript AST, dùng typescript trong node_modules API. build kiểm tra model/class/method rồi tạo source và tài liệu dẫn xuất. render kiểm tra cú pháp toàn bộ PlantUML trước xuất. PlantUML/Graphviz render lớp và ERD; Use Case có lớp trình bày SVG riêng đọc trực tiếp actor/ellipse/association từ cùng source, kiểm tra ID/cạnh một–một. PlantUML vẫn render độc lập được. SVG được nhúng vào HTML rồi trích lại đúng nội dung để xuất PNG bằng Edge/Playwright. publish dùng marked cục bộ. validate kiểm tra hash, coverage, ngữ nghĩa, liên kết, output và skill checks; không chạy DB.

Khi chuyển máy, đổi hai biến môi trường; cần Java/Graphviz tương thích và Microsoft Edge cho channel msedge. Python cho skill checks có thể đặt qua BEAUTYBOOK_PYTHON. Không tự tải thư viện internet.

Entry point generate-thesis-diagrams.mjs chạy pipeline hiện hành. Hai script PNG chuyển tiếp renderer mới. Sơ đồ cũ đã được gỡ; [OLD-TO-NEW](OLD-TO-NEW.md) chỉ giải thích mapping phạm vi.

## Chỉnh sửa và dùng hình

- UC: sửa scripts/catalog.cjs; nhóm/phép chiếu lớp/ERD: sửa scripts/build.cjs. Nếu chỉnh .puml trực tiếp, chỉ render/publish/validate, tránh build ghi đè nguồn thủ công.
- Audit/glossary được biên soạn; inventory/dictionary/coverage/specification được sinh có đối chiếu. Sau đổi code, đọc lại kết luận trước cập nhật hash; hash mới không tự chứng minh ngữ nghĩa còn đúng.
- Ưu tiên chèn SVG giữ nét vector; PNG 3× khi phần mềm không hỗ trợ. Chọn A4 dọc/ngang theo render-report. Cỡ chữ in là ước lượng khi đặt hình vừa vùng in đã ghi.
- ERD chọn tối đa 7 cột và 6 FK mỗi hình. Bảng dưới HTML ghi FK được vẽ; manifest ghi FK nội miền bị lược; catalogue đầy đủ quan hệ xuyên miền. Không suy hình rút gọn chứa mọi constraint.

Lượt này chỉ sửa tài liệu/công cụ sơ đồ; không thay code nghiệp vụ, schema, migration, seed, cấu hình triển khai hoặc dữ liệu.
