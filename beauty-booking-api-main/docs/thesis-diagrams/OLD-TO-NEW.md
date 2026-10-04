# Mapping bộ trước → bộ hiện hành

Nguồn Mermaid trước sử dụng flowchart cho Use Case và có bản trình bày tự dựng. Các bản đó không được dùng làm UML cuối và đã được gỡ. Mục lục chỉ đọc manifest.json của bộ hiện hành.

| File/nhóm trước | Nguồn hiện hành |
|---|---|
| BUC-00-overview / BUC-01-customer-journey | BUC-overview, BUC-service, BUC-financial |
| BUC-02-salon-operations | BUC-operations |
| BUC-03-platform-governance | BUC-governance |
| SUC-00-overview | SUC-overview |
| SUC-01-customer | SUC-discovery/auth/customer-account/booking/change/relations |
| SUC-02-salon | SUC-counter/delivery/payments/onboarding/resources/continuity |
| SUC-03-platform-admin | SUC-admin-account/governance và các hình phân hệ liên quan |
| AC-01-booking-bce | AC-booking/change/delivery/finance |
| AC-02-salon-bce / AC-03-platform-bce | AC-onboarding/capacity/relations/governance/access/privacy |
| DC-01-booking / DC-02-salon-catalog / DC-03-payment-review | 21 hình DC theo module hiện hành |
| ERD-00-core và ERD-01…04 | ERD-overview và 29 miền chi tiết, gồm hai miền di sản |
| business-use-case-specifications.md | specifications.md cùng thư mục; tên cũ là trang chỉ dẫn |
| system-use-case-specifications.md | specifications.md cùng thư mục; tên cũ là trang chỉ dẫn |
| model-inventory.md | model-coverage.md và data-dictionary.md |
| traceability-matrix.md | TRACEABILITY.md ở gốc bộ |
| generate-thesis-diagrams.mjs | Entry point chuyển tiếp pipeline scripts/*.cjs |
| render-png*.ps1 / renderer C# | scripts/render.cjs dùng trình duyệt đầy đủ ký pháp SVG |

ID BUC/SUC trong đặc tả được xác lập lại theo mục tiêu nghiệp vụ hiện hành; mapping trên là theo phạm vi, không khẳng định từng ID cũ có ngữ nghĩa giống hệt.
