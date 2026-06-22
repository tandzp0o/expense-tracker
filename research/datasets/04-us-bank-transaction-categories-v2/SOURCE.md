# 04 - US Bank Transaction Categories v2

## Ưu tiên

Ưu tiên 4, dùng cho transaction category classifier hoặc làm taxonomy phụ, không dùng trực tiếp cho clustering leader vì không có user/time/amount.

## Lý do chọn

Dataset này có mô tả giao dịch ngân hàng dạng statement và category đời sống rộng. Nó hữu ích để huấn luyện/kiểm thử model phân loại description -> category, hoặc chuẩn hóa merchant/category trước khi đưa vào pipeline expense tracker.

## Nguồn

- Hugging Face dataset: <https://huggingface.co/datasets/DoDataThings/us-bank-transaction-categories-v2>
- Dạng dữ liệu: synthetic transaction descriptions.
- License: MIT theo dataset card.

## Trạng thái tải dữ liệu

Đã tải:

```text
raw/transactions-synthetic.csv
raw/train.parquet
README.hf.md
```

Profile local:

- Dòng: 68,000.
- Cột: `description`, `category`.
- Category: 17 nhóm.
- Mỗi category có 4,000 mẫu.

Checksum nằm ở `MANIFEST.sha256`.

## Category

Dataset card mô tả 17 spending categories, ví dụ:

- Groceries
- Restaurants
- Shopping
- Entertainment
- Utilities
- Rent
- Transportation
- Education
- Personal Care
- Insurance
- Income
- Transfer

## Ghi chú sử dụng

Dataset này chỉ có description/category, không có transaction amount và không có chuỗi giao dịch theo user. Vì vậy nó bổ trợ cho bài toán category normalization, không thay thế được Sparkov/BankSim.
