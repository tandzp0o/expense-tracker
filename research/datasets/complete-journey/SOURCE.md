# Complete Journey Dataset

Mô tả đầy đủ nhất của bộ dữ liệu trong workspace này nằm ở `DATASET_DESCRIPTION.md`.

## Nguồn

- Tên dataset: 84.51° / dunnhumby Complete Journey.
- Package tham chiếu: `completejourney` by Brad Boehmke and Steven M. Mortimer.
- Repo nguồn: https://github.com/bradleyboehmke/completejourney
- Tài liệu user guide: https://bradleyboehmke.github.io/completejourney/articles/completejourney.html
- Tài liệu bảng `transactions`: https://bradleyboehmke.github.io/completejourney/reference/transactions.html
- Tài liệu bảng `demographics`: https://rdrr.io/cran/completejourney/src/R/demographics.R
- License package: `CC0` theo file `DESCRIPTION` của repo nguồn.
- Ngày tải về workspace: 2026-06-06.

## Lý do chọn

Dataset này phù hợp với đề tài vì có giao dịch theo hộ gia đình, thời gian giao dịch, giá trị chi tiêu, sản phẩm, metadata sản phẩm và demographic gồm nhóm thu nhập. Có thể ánh xạ sang pipeline hiện tại:

- `household_id` -> `userId`
- `transaction_timestamp` hoặc `week` -> kỳ thời gian
- `sales_value` -> chi tiêu
- `product_category` / `product_type` -> danh mục chi tiêu
- `income` trong demographic -> đặc trưng năng lực tài chính

## File raw đã tải

Các file nằm trong `raw/`:

- `transactions.rds`
- `transactions_sample.rda`
- `products.rda`
- `demographics.rda`
- `campaigns.rda`
- `campaign_descriptions.rda`
- `coupons.rda`
- `coupon_redemptions.rda`
- `promotions.rds`
- `promotions_sample.rda`

Checksum SHA-256 nằm trong `MANIFEST.sha256`.
