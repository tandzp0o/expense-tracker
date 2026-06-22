# Research Workspace

Thư mục này dùng để quản lý phần nghiên cứu, dataset và ghi chú thực nghiệm cho đề án hệ gợi ý tài chính cá nhân.

## Cấu trúc

- `datasets/`: nơi lưu dataset raw, dữ liệu đã xử lý và metadata nguồn.
- `notes/`: ghi chú paper, hướng thực nghiệm, mapping dữ liệu vào mô hình.
- `scripts/`: script tải, kiểm tra và chuẩn bị dữ liệu nghiên cứu.

## Dataset hiện có

- `datasets/complete-journey/`: 84.51° / dunnhumby Complete Journey, dùng làm dataset thực nghiệm chính cho phân cụm hành vi hộ gia đình và baseline gợi ý.

Các file raw/processed lớn được ignore khỏi Git. Metadata nhỏ như `SOURCE.md`, `MANIFEST.sha256` và script tái tải vẫn được giữ trong repo.
