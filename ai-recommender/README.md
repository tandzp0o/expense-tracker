# AI Recommender

Module này đóng gói pipeline gợi ý chi tiêu dựa trên `plan.md`.

## Luồng chính

1. Đọc dữ liệu từ MongoDB.
2. Tạo feature theo từng user-tháng.
3. Phân cụm 2 tầng:
   - Macro cluster: năng lực tài chính.
   - Micro cluster: hành vi chi tiêu.
4. Chọn user hình mẫu trong từng cụm.
5. Dự báo chi tiêu cuối tháng.
6. Xuất JSON context để FE/BE hiển thị hoặc đưa tiếp vào LLM.

## Chạy local bằng CLI

```bash
cd ai-recommender
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

python ai_recommender_all_in_one.py train --mongo-uri "mongodb+srv://..." --export-viz
python ai_recommender_all_in_one.py recommend --mongo-uri "mongodb+srv://..." --user-id "USER_UID"
```

## Chạy local dạng API service

```bash
cd ai-recommender
$env:MONGO_URI="mongodb+srv://..."
$env:AI_SERVICE_KEY="optional-secret"
uvicorn service:app --reload --host 0.0.0.0 --port 8000
```

Sau đó cấu hình backend:

```bash
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_KEY=optional-secret
```

Các endpoint của backend vẫn là:

- `GET /api/ai/status`
- `POST /api/ai/train`
- `GET /api/ai/users`
- `POST /api/ai/recommend`

FE chỉ gọi backend, không gọi trực tiếp service AI.

## Deploy

Vì backend đang deploy riêng, không nên để backend đọc thư mục `../ai-recommender` trong production. Cách đúng hơn là deploy thư mục `ai-recommender` như một service Python riêng bằng `Dockerfile` trong thư mục này.

Biến môi trường cần có ở AI service:

- `MONGO_URI`: connection string MongoDB.
- `AI_SERVICE_KEY`: khóa nội bộ tùy chọn để backend gọi service.
- `PORT`: port do nền tảng deploy cấp, mặc định `8000`.

Biến môi trường cần có ở backend:

- `AI_SERVICE_URL`: URL public/private của AI service.
- `AI_SERVICE_KEY`: cùng giá trị với AI service nếu có bật.

Khi không có `AI_SERVICE_URL`, backend sẽ fallback sang cách chạy script local để tiện phát triển trong repo đầy đủ.

## Artifacts

Service ghi output vào `artifacts/`:

- `monthly_features.csv`
- `model.pkl`
- `leaders.json`
- `cluster_report.json`
- `recommendation_{userId}.json`
- `viz/*.png` nếu bật `export_viz`
