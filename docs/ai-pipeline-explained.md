# Giải Thích Pipeline AI Recommender

Tài liệu này mô tả ý nghĩa từng bước từ dữ liệu giao dịch đến kết quả cuối cùng:

- File kết quả mẫu: `ai-recommender/artifacts/recommendation_YWpffaf3vzVDhD9KmAfktc8NsUr2.json`

## 1) Mục tiêu của pipeline

Pipeline AI được xây để:

1. Chuẩn hóa dữ liệu người dùng theo đơn vị `user-tháng`.
2. Phân nhóm người dùng theo năng lực tài chính và hành vi chi tiêu.
3. Dự báo rủi ro chi tiêu vượt mức trong tháng hiện tại.
4. Tạo context có cấu trúc để LLM đưa ra gợi ý, không bịa số.

---

## 2) Bước train (`run_training.py`)

Lệnh:

```bash
python run_training.py --mongo-uri "<MONGO_URI_THAT>"
```

### 2.1 Đọc dữ liệu MongoDB
Nguồn dữ liệu:

- `users`
- `transactions`
- `goals`
- `budgets`
- `wallets` (dùng bổ trợ)

Thực hiện ở: `ai-recommender/mongo_io.py`.

### 2.2 Tạo feature theo `user-tháng`
Thực hiện ở: `ai-recommender/feature_pipeline.py`.

Các feature chính:

- `income`: tổng giao dịch `INCOME` theo tháng.
- `expense`: tổng giao dịch `EXPENSE` theo tháng.
- `expense_to_income_ratio`: mức tiêu dùng so với thu nhập.
- `cat_share_*`: tỷ trọng chi tiêu theo từng danh mục.
- `anomaly_count`: số giao dịch bất thường (Isolation Forest).
- `target_saving_ratio`: tổng mục tiêu tiết kiệm / thu nhập.
- `goal_completion_rate`: mức hoàn thành mục tiêu.

Kết quả trung gian lưu tại:

- `ai-recommender/artifacts/monthly_features.csv`

### 2.3 Phân cụm hai tầng
Thực hiện ở: `ai-recommender/clustering.py`.

1. `macro_cluster`: phân cụm theo năng lực tài chính.
2. `micro_cluster`: phân cụm hành vi trong từng macro.

Mục tiêu: tránh so sánh user thu nhập thấp với nhóm thu nhập rất cao.

### 2.4 Chọn user hình mẫu (leader)
Thực hiện ở: `ai-recommender/leaderboard.py`.

Trong từng cụm nhỏ, hệ thống chọn các user có:

- hoàn thành mục tiêu tốt hơn,
- anomaly thấp hơn,
- tỷ lệ chi tiêu hợp lý hơn.

Lưu tại:

- `ai-recommender/artifacts/leaders.json`

### 2.5 Lưu artifacts model

- `model.pkl`: object model clustering.
- `cluster_report.json`: thống kê cụm.

---

## 3) Bước suy luận gợi ý (`run_recommendation.py`)

Lệnh:

```bash
python run_recommendation.py --mongo-uri "<MONGO_URI_THAT>" --user-id "YWpffaf3vzVDhD9KmAfktc8NsUr2"
```

Thực hiện ở: `ai-recommender/recommender.py`.

### 3.1 Lấy bản ghi tháng mới nhất của user
Từ `monthly_features.csv`, chọn dòng mới nhất theo `ym`.

### 3.2 Xác định cụm của user
Lấy `macro_cluster`, `micro_cluster` để biết user thuộc nhóm hành vi nào.

### 3.3 Dự báo chi tiêu cuối tháng
Thực hiện ở: `ai-recommender/forecast.py`.

- Ưu tiên `Linear Regression` theo chuỗi chi tiêu tích lũy theo ngày.
- Fallback `moving average` nếu dữ liệu quá ít.

Kết quả chính:

- `predicted_expense_end_month`
- `predicted_overrun_vs_income`

### 3.4 Lấy baseline trong cụm
Lấy `leader_baseline` từ `leaders.json` để tạo chuẩn tham chiếu.

### 3.5 Tạo JSON context cuối cùng
Output:

- `ai-recommender/artifacts/recommendation_<userId>.json`

JSON gồm:

- `cluster`: nhãn cụm.
- `metrics`: số liệu chi tiết + dự báo.
- `leader_baseline`: mẫu tham chiếu.
- `system_guidance`: nguyên tắc để LLM sinh khuyến nghị an toàn.
- `forecast_debug`: thông tin debug mô hình dự báo.

---

## 4) Diễn giải file kết quả mẫu

Với file:

- `recommendation_YWpffaf3vzVDhD9KmAfktc8NsUr2.json`

Ý nghĩa:

- User đang ở cụm `macro=2`, `micro=0`.
- Thu nhập tháng: `8,000,000`.
- Đã chi: `4,001,000` (tại thời điểm tính).
- Dự báo cuối tháng: ~`9,361,321`.
- Có nguy cơ vượt thu nhập: ~`1,361,321`.
- Danh mục chiếm tỷ trọng lớn nhất: `Ăn uống`.

Đây chính là dữ kiện đầu vào để LLM tạo lời khuyên hành động cụ thể.

---

## 5) Gợi ý mở rộng

1. Thêm bước chia `train/validation/test` theo tỉ lệ `70/15/15`.
2. Lưu lịch sử dự báo để đo sai số thực tế theo tháng.
3. Nâng cấp `forecast.py` sang LSTM/TFT khi dữ liệu đủ lớn.
4. Thêm guardrail business-rule trước khi gửi context cho LLM.
