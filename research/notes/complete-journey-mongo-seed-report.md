# Complete Journey Mongo Seed Report

Ngày thực hiện: 2026-06-06

## Kết quả seed

- MongoDB source: đọc `MONGO_URI` từ `be/.env`, không ghi URI ra log hoặc tài liệu.
- Database nghiên cứu mới: `expense-tracker-complete-journey`.
- Dataset gốc: 84.51° / dunnhumby Complete Journey trong `research/datasets/complete-journey/raw`.
- Seed thực nghiệm: dùng toàn bộ 801 household có demographic, giới hạn tối đa 200 expense transaction mỗi household và lấy mẫu trải đều theo thời gian.

Số lượng document đã có trong MongoDB:

| Collection | Count |
| --- | ---: |
| `users` | 801 |
| `wallets` | 801 |
| `goals` | 1,066 |
| `budgets` | 20,041 |
| `transactions` | 169,260 |
| `research_seed_metadata` | 1 |

Trong `transactions` có 9,370 giao dịch `INCOME` ước lượng theo demographic income band và 159,890 giao dịch `EXPENSE` quy đổi từ `sales_value * 25,000`.

Dung lượng MongoDB sau seed: `dataSize` khoảng 74.25 MB, `storageSize` khoảng 12.77 MB theo `dbstats`.

Ghi chú quota: lần thử seed toàn bộ transaction vào Atlas free tier bị chặn ở quota 512 MB sau khoảng 720,000 expense transaction. Phần DB research bị partial đã được xóa, sau đó seed lại bản capped ở trên. Raw dataset vẫn nằm local nên có thể chạy full-scale trên MongoDB local hoặc Atlas tier lớn hơn.

## Kết quả kiểm tra AI pipeline

Đã chạy training trên database `expense-tracker-complete-journey`:

```powershell
python ai-recommender\ai_recommender_all_in_one.py train --mongo-uri "<from be/.env>" --database expense-tracker-complete-journey --export-viz
```

Kết quả:

- Monthly feature records: 9,370 user-month.
- Macro clusters: 3.
- Micro leader groups: 9.
- Artifacts đã được ghi vào `ai-recommender/artifacts`.
- Visualization đã được ghi vào `ai-recommender/artifacts/viz`.

Đã chạy recommendation mẫu:

```powershell
python ai-recommender\ai_recommender_all_in_one.py recommend --mongo-uri "<from be/.env>" --database expense-tracker-complete-journey --user-id cj_hh_1
```

Kết quả mẫu:

- User: `cj_hh_1`.
- Period: `2017-12`.
- Cluster: macro `0`, micro `0`.
- Leader baseline: 3 household dẫn dắt trong cùng cụm.
- Forecast method: `linear_regression`.
- Output: `ai-recommender/artifacts/recommendation_cj_hh_1.json`.

## Kết luận readiness

DB này đã đủ để thực nghiệm mô hình hiện tại: feature theo user-month, phân cụm 2 tầng, chọn leader theo `leader_score`, forecast chi tiêu cuối tháng và sinh context recommendation.

## Provision đăng nhập web

Ngày 2026-06-07 đã copy nhóm dữ liệu Complete Journey từ DB research `expense-tracker-complete-journey` sang DB app chính `expense-tracker` để web backend hiện tại có thể resolve login và đọc dữ liệu ví/giao dịch.

Đã tạo/cập nhật 801 Firebase Auth users:

- Email format: `cj_hh_<household_id>@completejourney.local`
- Firebase UID: trùng Mongo UID, ví dụ `cj_hh_1848`
- Password mặc định: `123123`
- Tài khoản mẫu đã kiểm tra Firebase sign-in thành công: `cj_hh_1848@completejourney.local`

Lý do cần bước này: login web dùng Firebase Auth trước, sau đó backend dùng Firebase UID để đọc Mongo. Vì vậy chỉ có document trong Mongo research DB là chưa đủ để đăng nhập.

Khi viết luận hoặc báo cáo thực nghiệm cần nêu rõ ba giả định chuyển đổi:

- Complete Journey là dữ liệu retail/grocery, không phải dữ liệu tài chính cá nhân đầy đủ.
- Thu nhập được ước lượng từ demographic income band.
- Budget và goal được dựng theo quy tắc seed để phù hợp schema app và tạo tín hiệu cho mô hình dẫn dắt bầy đàn.

Nếu cần đánh giá quy mô lớn trên toàn bộ 1.46 triệu transaction raw, nên chạy MongoDB local hoặc nâng Atlas tier trước.
