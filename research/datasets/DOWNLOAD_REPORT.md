# Dataset Download Report

Ngày thực hiện: 2026-06-07

## Kết quả theo ưu tiên

| Priority | Dataset | Folder | Trạng thái |
| ---: | --- | --- | --- |
| 1 | Sparkov Credit Card Transactions | `01-sparkov-credit-card` | Đã tải qua Hugging Face mirror |
| 2 | BankSim | `02-banksim` | Đã tải qua GitHub raw mirror |
| 3 | BLS Consumer Expenditure Survey / LABSTAT | `03-bls-consumer-expenditure` | Chưa tải được tự động do BLS chặn bot từ shell |
| 4 | US Bank Transaction Categories v2 | `04-us-bank-transaction-categories-v2` | Đã tải từ Hugging Face |

## File đã tải

### Priority 1 - Sparkov Credit Card

- `research/datasets/01-sparkov-credit-card/raw/fraudTrain.csv`
- Size: khoảng 266.5 MB.
- Rows: 1,048,575.
- Category: 14 nhóm đời sống.
- Phù hợp nhất để thay Complete Journey trong thực nghiệm transaction-level.

### Priority 2 - BankSim

- `research/datasets/02-banksim/raw/bs140513_032310.csv`
- Size: khoảng 49.0 MB.
- Rows: 594,643.
- Category: 15 nhóm merchant/payment.
- Phù hợp để so sánh với Sparkov và làm dataset thứ hai có nền tảng học thuật.

### Priority 3 - BLS Consumer Expenditure

- Chưa có raw data trong workspace do BLS trả `403 Access Denied` cho automated shell download.
- Đã tạo script tải lại: `research/datasets/03-bls-consumer-expenditure/scripts/download_bls_core.ps1`.
- Vai trò vẫn là benchmark/taxonomy, không phải transaction-level training data.

### Priority 4 - US Bank Transaction Categories v2

- `research/datasets/04-us-bank-transaction-categories-v2/raw/transactions-synthetic.csv`
- `research/datasets/04-us-bank-transaction-categories-v2/raw/train.parquet`
- Size CSV: khoảng 3.46 MB.
- Rows: 68,000.
- Category: 17 nhóm, mỗi nhóm 4,000 mẫu.
- Phù hợp cho bài toán phân loại description -> category.

## Ghi chú

- Kaggle CLI/token chưa có trong môi trường hiện tại, nên các dataset Kaggle được tải từ mirror công khai khi có mirror hợp lệ.
- Các file raw/processed lớn được ignore bởi `research/datasets/.gitignore`.
- Mỗi folder có `SOURCE.md` riêng và `MANIFEST.sha256` nếu đã tải được raw file.
