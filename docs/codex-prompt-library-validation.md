# Kiểm chứng tích hợp prompts.chat local

Ngày: 2026-10-06. Phạm vi: tích hợp workflow và ví dụ áp dụng chỉ đọc; không sửa ứng dụng.

## Cấu hình đã khảo sát

- Global: `C:/Users/Admin/.codex/AGENTS.md`, `config.toml`, `agents/*.toml`.
- Root và default subagent: `gpt-6.1-sol`, effort `medium`.
- Multi-agent bật; `multi_agent_v2 = false`, `max_depth = 2`.
- 12 vai trò giữ nguyên: Scout low; Researcher/Writer/Implementer/Tester medium; Analyst/Architect/Debugger/Visualizer/Reviewer high; Auditor xhigh; Deep Solver max. Sandbox và chỉ dẫn riêng của từng vai trò không sửa.
- Repository chưa có root AGENTS.md; có `mobile/AGENTS.md` với quy tắc riêng. Entry point mới chỉ bổ sung tra cứu tham khảo tùy nhu cầu.
- Không sửa global routing, config, role files, upstream checkout, hoặc các thay đổi ứng dụng đang có sẵn.

## Kết quả kiểm thử trực tiếp

| Kiểm tra | Kết quả |
| --- | --- |
| Import-Csv UTF-8 | Đọc được 2.169 bản ghi, đủ 5 cột |
| Tìm `quality assurance\|software test\|code review` trên title | 5 ứng viên đầu: 127, 133, 217, 333, 797 |
| Chọn theo mục đích | 127, Software Quality Assurance Tester, iuzn, TEXT |
| Đọc toàn bộ record đã chọn | Đúng title, contributor, nội dung QA; phát hiện yêu cầu mẫu về login cần bỏ |
| Truy vấn không khớp `beautybook-no-such-prompt-82cbae` | 0 kết quả; dùng phương án không có template |
| SHA256 global trước/sau và bản backup | Cả 14 file khớp, không thay đổi |
| Tra cứu trùng lặp | Root thực hiện toàn bộ; không tạo subagent cho nhiệm vụ nhỏ này |
| Dịch vụ ngoài | Không gọi MCP, mạng, cài package hay chạy website prompts.chat |

Snapshot checkout: `7d3f248962d1dca209d59e033524bcb86c2b26b8`.
SHA256 CSV: `C506BBF29106058A021E5CF85271BB97C9856C2B7FCC9F337421CDC8B00964C6`.
Backup: `tools/prompt-library-backups/20261006-192454/`, có manifest và hướng dẫn khôi phục.

## Ví dụ: từ prompt chung thành nhiệm vụ BeautyBook

Nhiệm vụ mẫu: lập ma trận kiểm thử đăng ký khách hàng mobile dựa trên mã nguồn hiện tại, không chạy thiết bị hoặc sửa code. Tra cứu được thực hiện vì người dùng yêu cầu chứng minh quy trình tích hợp; không có nghĩa mọi lần lập test đều cần tìm prompt.

Lý do chọn record 127: tập trung kiểm tra chức năng và báo cáo có bằng chứng. Các mẫu Code Reviewer ít phù hợp hơn với đầu ra ma trận kiểm thử.

Giữ: mô tả ca kiểm tra, kết quả mong đợi và bằng chứng; tách vấn đề quan sát được khỏi đề xuất.
Bỏ: persona thay thế vai trò hiện hành; yêu cầu bắt đầu với login; kiểm thử hiệu năng toàn ứng dụng không thuộc nhiệm vụ mẫu.

Brief đã điều chỉnh và áp dụng:

```text
Root đã hoàn tất tra cứu; không tìm lại prompts.chat.
Nguồn: CSV local record 127, Software Quality Assurance Tester, iuzn;
commit và SHA256 ghi phía trên.

Đọc RegisterScreen.tsx, AuthContext.tsx và api/auth.ts của BeautyBook mobile.
Lập ma trận kiểm thử đăng ký CUSTOMER theo các điều kiện thực sự có trong code:
tên, email, mật khẩu, xác nhận, chuẩn hóa dữ liệu và trạng thái đang gửi.
Mỗi dòng cần có ca kiểm tra, kỳ vọng và đường dẫn/điểm tham chiếu.
Không suy diễn đây là đăng ký chủ doanh nghiệp. Không mở rộng sang thanh toán.
Không chạy ADB, Metro, sửa code hoặc gọi API tạo tài khoản.
Phân biệt kiểm chứng tĩnh với kết quả chạy UI/API; không báo pass runtime.
Đầu ra bằng tiếng Việt. Giữ nguyên routing và vai trò được giao nếu có.
```

## Kết quả áp dụng vào nguồn thực tế

| Ca kiểm tra đề xuất | Kỳ vọng từ mã hiện tại | Bằng chứng |
| --- | --- | --- |
| Họ tên rỗng hoặc chỉ 1 ký tự sau trim | Chặn gửi; báo ít nhất 2 ký tự | `mobile/src/screens/RegisterScreen.tsx:28`, điều kiện submit |
| Email thiếu cấu trúc địa chỉ | Chặn gửi; lỗi tại trường email | `mobile/src/screens/RegisterScreen.tsx:13`, `:29` |
| Mật khẩu 7 ký tự, thiếu chữ hoa/chữ thường/số, hoặc dài 129 ký tự | Chặn gửi theo regex 8–128 và thành phần yêu cầu | `mobile/src/screens/RegisterScreen.tsx:14`, `:30` |
| Mật khẩu xác nhận khác | Chặn gửi; thông báo không khớp | `mobile/src/screens/RegisterScreen.tsx:33` |
| Tên/email có khoảng trắng đầu cuối | Trim trước khi gọi API; mật khẩu giữ nguyên | `mobile/src/context/AuthContext.tsx:151` |
| Form hợp lệ | Gọi POST /auth/register với accountType CUSTOMER | `mobile/src/api/auth.ts:10`, `:13` |
| isSubmitting đang true | Nút đăng ký disabled; cần kiểm thử runtime riêng cho các đường kích hoạt khác | `mobile/src/screens/RegisterScreen.tsx:128` |

Quan sát tĩnh cụ thể: regex giới hạn mật khẩu tối đa 128 ký tự nhưng thông báo lỗi tại dòng 31 chỉ nêu tối thiểu 8 ký tự và thành phần chữ/số. Ca 129 ký tự nên có trong lần kiểm thử UX tiếp theo. Không sửa vấn đề này vì nhiệm vụ hiện tại là tích hợp workflow.

Đây là kết quả áp dụng prompt để tạo đầu ra có căn cứ, không phải chứng nhận tính đúng đắn toàn bộ đăng ký. Chưa chạy UI/API/E2E hoặc kiểm chứng chống gửi trùng. Cơ chế tránh subagent tra cứu lại là quy ước trong instruction và handoff, không phải khóa kỹ thuật; chưa chạy phiên multi-agent mới để đo hành vi. Phiên Codex mới trong repository cần đọc root AGENTS.md; phiên đang mở có thể yêu cầu đọc lại file đó để sử dụng ngay.
