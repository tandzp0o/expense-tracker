# Kế hoạch triển khai AI cho Expense Tracker

## 1. Phạm vi sản phẩm

Ứng dụng này là sản phẩm theo dõi tài chính cá nhân và hỗ trợ ra quyết định.

AI nên hỗ trợ người dùng:

- Tạo giao dịch nhanh hơn từ hóa đơn, ảnh chụp và giọng nói.
- Gợi ý các danh mục như `Ăn uống`, `Mua sắm`, `Y tế`, `Giải trí`, `Di chuyển`.
- Tạo nhắc nhở, cảnh báo bất thường và gợi ý chi tiêu trong màn hình phân tích.

AI không nên:

- Kết nối trực tiếp tới ngân hàng.
- Di chuyển tiền thật.
- Tự động lưu hồ sơ tài chính khi chưa có bước xác nhận của người dùng.

## 2. Các luồng người dùng cần xây dựng

### 2.1 Quét hóa đơn / ảnh chụp

Người dùng mở thêm nhanh từ thanh điều hướng mobile và chọn `Quét`.

Backend nên:

- Đọc chữ từ ảnh hóa đơn hoặc vé.
- Hiểu vật thể trong các ảnh không phải hóa đơn như đồ ăn, thuốc, túi mua sắm, vé xem phim hoặc ảnh chụp màn hình di chuyển.
- Trả về một payload gợi ý có cấu trúc.

UI nên:

- Hiển thị nháp người bán, số tiền, ngày, danh mục và ghi chú.
- Cho phép người dùng xác nhận ví, ngân sách và danh mục cuối cùng trước khi lưu.

### 2.2 Nhập bằng giọng nói

Người dùng chọn `Nói`.

Backend nên:

- Chuyển giọng nói thành văn bản.
- Chuyển nội dung đó thành một nháp giao dịch có cấu trúc.

Ví dụ:

`Trưa nay ăn phở 45 nghìn`  
=> số tiền `45000`, danh mục `Ăn uống`, ghi chú `Ăn phở buổi trưa`

### 2.3 Trợ lý AI cho phân tích

Người dùng mở trang phân tích hoặc dashboard và nhận được:

- các nhóm chi vượt nhiều nhất
- giao dịch bất thường
- nhắc nhở theo xu hướng
- cảnh báo cuối tháng
- gợi ý tiết kiệm đơn giản

Các gợi ý này phải dựa trên dữ liệu thật trong app, không chỉ là lời khuyên chung chung.

## 3. Hình dạng kỹ thuật đề xuất

### 3.1 Frontend

Thêm các điểm vào sau:

- Nút giữa trên mobile mở sheet thêm nhanh.
- `Nói`
- `Quét`
- `Hỏi AI`
- `Nhập tay`

Luôn giữ bước xác nhận của con người trước khi lưu bất kỳ giao dịch nào do AI tạo.

### 3.2 Cổng AI ở backend

Tạo một module backend riêng, ví dụ:

- `POST /api/ai/transactions/from-image`
- `POST /api/ai/transactions/from-audio`
- `POST /api/ai/insights/summary`
- `POST /api/ai/transactions/classify`

Backend nên:

- xác thực người dùng
- lấy danh sách ví / ngân sách / danh mục hợp lệ từ dữ liệu app
- gọi nhà cung cấp AI
- chuẩn hóa kết quả về JSON chặt chẽ
- trả về độ tin cậy và cảnh báo

### 3.3 Hợp đồng dữ liệu đầu ra có cấu trúc

Sử dụng một schema chuẩn hóa cho mọi nháp giao dịch do AI tạo.

```json
{
  "sourceType": "receipt | shopping_photo | food_photo | medicine_photo | ticket | voice_note",
  "transactionType": "EXPENSE | INCOME",
  "amount": 45000,
  "currency": "VND",
  "merchant": "Cong Ca Phe",
  "occurredAt": "2026-04-26T08:15:00+07:00",
  "suggestedCategory": "An uong",
  "suggestedBudgetLabel": "Ăn uống",
  "noteDraft": "Cà phê sữa đá size L",
  "lineItems": [
    {
      "name": "Cà phê sữa đá",
      "quantity": 1,
      "price": 45000
    }
  ],
  "confidence": 0.86,
  "warnings": []
}
```

## 4. Quy tắc ánh xạ danh mục

AI không được tự nghĩ ra danh mục cuối cùng ngoài tập danh mục mà app cho phép.

Lớp ánh xạ đề xuất:

- `food_photo`, hóa đơn nhà hàng, hóa đơn đồ uống => `An uong`
- quần áo, kiện hàng, đơn thương mại điện tử => `Mua sam`
- thuốc, hóa đơn nhà thuốc => `Suc khoe`
- vé xem phim, thẻ game, buổi hòa nhạc => `Giai tri`
- taxi, xe buýt, gửi xe, xăng => `Di chuyen`

Nếu độ tin cậy thấp:

- đặt `suggestedCategory`
- thêm cảnh báo
- bắt buộc người dùng xác nhận

## 5. Quy tắc sinh insight AI

Insight nên được tạo từ các chỉ số mà backend tính trước, sau đó mới diễn đạt bằng AI.

Gói dữ liệu đầu vào nên có:

- tổng thu / chi / chênh lệch của kỳ hiện tại
- cơ cấu theo danh mục
- thay đổi theo tuần và theo tháng
- danh sách giao dịch bất thường
- các ngân sách bị vượt
- các ví có phần tiền tự do thấp

Các phần đầu ra nên có:

- `summary`
- `warnings`
- `opportunities`
- `next_best_actions`

Không nên để model tự tính tổng tài chính thô từ đầu nếu backend đã có thể tính chính xác trước.

## 6. Rào chắn an toàn

- Không tự động lưu nháp AI nếu chưa xác nhận.
- Không thay đổi số dư ví trước khi người dùng xác nhận.
- Nên lưu tham chiếu ảnh/âm thanh gốc đi kèm nháp khi có thể.
- Ghi lại độ tin cậy của AI và danh mục cuối cùng do người dùng duyệt để đánh giá sau này.
- Với các trường hợp nhạy cảm và độ tin cậy thấp, nên hiển thị `AI gợi ý` thay vì thể hiện như kết luận chắc chắn.

## 7. Các giai đoạn triển khai đề xuất

### Giai đoạn 1

- Sheet thêm nhanh trên mobile
- chuyển tiếp sang form nhập tay
- UI thẻ AI trong trang phân tích
- chế độ hiển thị tiền `full / compact`

### Giai đoạn 2

- tải ảnh lên backend
- OCR hóa đơn và gợi ý danh mục theo vật thể
- chuyển giọng nói thành nháp giao dịch

### Giai đoạn 3

- insight trợ lý dựa trên dữ liệu thật của app
- phát hiện bất thường
- bộ máy gợi ý giao dịch lặp lại

### Giai đoạn 4

- dashboard đánh giá chất lượng
- vòng phản hồi từ người dùng
- bộ dữ liệu học từ các lần sửa danh mục

## 8. Các khối OpenAI nên dùng

Các tài liệu chính thức phù hợp nhất cho lộ trình trên:

- Hướng dẫn images and vision:
  https://developers.openai.com/api/docs/guides/images-vision
- Hướng dẫn speech to text:
  https://developers.openai.com/api/docs/guides/speech-to-text
- Hướng dẫn structured outputs:
  https://developers.openai.com/api/docs/guides/structured-outputs
- Tài liệu Responses API:
  https://platform.openai.com/docs/api-reference/responses

Cách áp dụng vào app:

- `images-vision`: gửi ảnh hóa đơn, ảnh món ăn, ảnh mua sắm, ảnh thuốc, vé.
- `speech-to-text`: chuyển giọng nói nhập nhanh thành văn bản.
- `structured-outputs`: ép đầu ra JSON ổn định cho nháp giao dịch.
- `responses`: thống nhất luồng prompt đa phương thức và khả năng điều phối tool sau này.

## 9. Lát cắt backend nên làm đầu tiên

Nếu bắt đầu triển khai ngay, lát cắt backend đầu tiên nên là:

1. `POST /api/ai/transactions/from-image`
2. kiểm tra loại ảnh và kích thước
3. gọi vision model
4. trả về JSON nháp có cấu trúc
5. render màn hình xác nhận trong form giao dịch
6. chỉ lưu sau khi người dùng phê duyệt

Lát cắt này tạo ra con đường ngắn nhất để đem lại giá trị nhìn thấy được cho người dùng mà vẫn giữ rủi ro ở mức thấp.
