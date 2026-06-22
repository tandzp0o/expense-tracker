# 03 - BLS Consumer Expenditure Survey / LABSTAT

## Ưu tiên

Ưu tiên 3, dùng làm benchmark taxonomy và dữ liệu tham chiếu, không phải nguồn transaction-level chính.

## Lý do chọn

BLS Consumer Expenditure Survey là nguồn chính phủ Mỹ, rất uy tín cho taxonomy chi tiêu đời sống: food, housing, utilities, transportation, healthcare, entertainment, education, personal care, insurance/pensions...

Dataset này không phải log giao dịch từng user theo thời gian, nên không phù hợp thay trực tiếp Sparkov/BankSim cho clustering leader. Nó phù hợp để:

- Biện minh taxonomy category trong luận văn.
- So sánh phân bổ chi tiêu aggregate.
- Làm benchmark mô tả.

## Nguồn

- Getting started guide: <https://www.bls.gov/cex/labstat/ce-labstat-getting-started-guide.htm>
- Time-series files: <https://download.bls.gov/pub/time.series/cx/>

## Ghi chú tải dữ liệu

Script trong thư mục này tải các file core:

- `cx.data.1.AllData`
- `cx.series`
- `cx.category`
- `cx.subcategory`
- `cx.item`
- `cx.demographics`
- `cx.characteristics`
- `cx.footnote`
- `cx.process`

File `cx.aspect` khoảng 739 MB nên để optional.

## Trạng thái tải dữ liệu

Chưa tải được tự động từ shell trong môi trường hiện tại. BLS trả `403 Access Denied` với thông báo anti-bot khi gọi `Invoke-WebRequest` hoặc `curl` tới `download.bls.gov`.

Script chính thức đã tạo:

```text
scripts/download_bls_core.ps1
```

Có thể chạy lại thủ công sau nếu môi trường mạng cho phép:

```powershell
powershell -ExecutionPolicy Bypass -File research\datasets\03-bls-consumer-expenditure\scripts\download_bls_core.ps1
```
