# NHIỆM VỤ: Nghiên cứu và tạo tài liệu quy tắc nghiệp vụ cho ứng dụng tài chính

Bạn là một **Business Analyst Agent** chuyên về các ứng dụng quản lý tài chính cá nhân.

## BƯỚC 1 — Giai đoạn nghiên cứu (BẮT BUỘC trước khi viết)

Trước khi tạo bất kỳ tài liệu nào, bạn bắt buộc phải nghiên cứu và tham chiếu các nhóm ứng dụng tài chính sau để hiểu logic nghiệp vụ ngoài thực tế:

**Các ứng dụng mục tiêu cần phân tích:**

- Ứng dụng theo dõi tài chính cá nhân: **Money Lover**, **Spendee**, **YNAB (You Need A Budget)**, **Mint**, **Wallet by BudgetBakers**
- Ứng dụng phổ biến tại thị trường Việt Nam: **Money Lover**, **Misa Money**, **Finhay**
- Ứng dụng ngân hàng có logic giao dịch đáng tham khảo: **Techcombank**, **VCB Digibank**, **MBBank**

**Với mỗi nhóm ứng dụng, cần trích xuất:**

1. Cách giao dịch được tạo ra như thế nào: thủ công, tự động, định kỳ
2. Những ràng buộc ngày giờ nào đang áp dụng cho giao dịch
3. Ngân sách liên kết với giao dịch ra sao
4. Những quy tắc cho giao dịch định kỳ hoặc lên lịch là gì
5. Những ràng buộc kiểm tra dữ liệu hoặc nghiệp vụ cần có

---

## BƯỚC 2 — Tạo tài liệu quy tắc nghiệp vụ

Sau khi nghiên cứu, hãy tạo một file **Markdown** (`transaction-business-rules.md`) theo cấu trúc sau:

```markdown
# Quy tắc nghiệp vụ giao dịch — Ứng dụng tài chính cá nhân

## 1. Quy tắc tạo giao dịch
### 1.1 Giao dịch thủ công
### 1.2 Giao dịch tự động / định kỳ
### 1.3 Giao dịch có ngày trong tương lai

## 2. Ràng buộc ngày và thời gian
### 2.1 Giao dịch quá khứ
### 2.2 Giao dịch trong ngày hiện tại
### 2.3 Giao dịch tương lai — các trường hợp được phép
### 2.4 Giao dịch tương lai — các trường hợp bị cấm

## 3. Giao dịch tự động được kích hoạt từ ngân sách
### 3.1 Cách quy tắc ngân sách kích hoạt giao dịch
### 3.2 Mẫu chi tiêu định kỳ (ví dụ: điện, nước, tiền thuê)
### 3.3 Cấu hình lịch chạy (theo tháng, theo tuần, tùy chỉnh)
### 3.4 Logic tự khấu trừ

## 4. Ràng buộc kiểm tra giao dịch
### 4.1 Ràng buộc số tiền
### 4.2 Ràng buộc danh mục
### 4.3 Ràng buộc số dư tài khoản
### 4.4 Chống trùng giao dịch

## 5. Quy tắc giao dịch định kỳ
### 5.1 Điều kiện kích hoạt
### 5.2 Quy tắc sửa / hủy
### 5.3 Xử lý lỗi (ví dụ: không đủ số dư)

## 6. Trường hợp biên và tình huống đặc biệt
### 6.1 Xử lý múi giờ
### 6.2 Giao dịch cuối tháng / cuối năm
### 6.3 Xử lý năm nhuận
### 6.4 Người dùng xóa ngân sách nhưng vẫn còn giao dịch định kỳ đang hoạt động

## 7. Bảng tóm tắt quy tắc nghiệp vụ
| Mã quy tắc | Mô tả quy tắc | Loại ràng buộc | Được phép / Bị cấm |
|-----------|---------------|----------------|--------------------|
| ...       | ...           | ...            | ...                |
```

---

## CÁC RÀNG BUỘC QUAN TRỌNG BẮT BUỘC PHẢI CÓ

Đảm bảo tài liệu mô tả rõ các tình huống sau:

### BỊ CẤM — Giao dịch tương lai

- Người dùng KHÔNG được tự tạo thủ công giao dịch có ngày trong tương lai, **trừ khi** giao dịch đó thuộc một ngoại lệ đã được phê duyệt

### ĐƯỢC PHÉP — Ngoại lệ cho giao dịch tương lai

1. **Giao dịch định kỳ được lên lịch từ ngân sách**. Ví dụ người dùng tạo quy tắc:
   - "Mỗi ngày 1 hằng tháng -> tự trừ 500.000 VND tiền điện"
   - "Mỗi ngày 5 hằng tháng -> tự trừ 1.200.000 VND tiền thuê nhà"
   - Hệ thống tạo trước các bản ghi này dưới trạng thái **`Pending`**, và chỉ thực thi vào đúng ngày đã đặt lịch
2. **Lịch trả góp hoặc hoàn trả khoản vay** với các kỳ thanh toán được lên kế hoạch trước
3. **Mục tiêu tiết kiệm** với lịch chuyển tiền vào ví tiết kiệm
4. **Nhắc hóa đơn** được đánh dấu là `upcoming`, chưa phải `completed`

### VÒNG ĐỜI TRẠNG THÁI GIAO DỊCH

```text
[SCHEDULED] → [PENDING] → [COMPLETED] / [FAILED] / [CANCELLED]
```

---

## YÊU CẦU CHẤT LƯỢNG

- Mỗi quy tắc phải có **mã quy tắc** riêng, ví dụ `TXN-001`, `TXN-002`
- Mỗi ràng buộc phải nêu rõ: **điều kiện**, **hành động**, **thông báo lỗi** khi vi phạm
- Phải có **ví dụ thực tế** dùng tiền tệ Việt Nam (`VND`) và ngữ cảnh địa phương
- Cần ghi rõ ứng dụng nào truyền cảm hứng cho từng quy tắc, ví dụ `[Nguồn: YNAB, Money Lover]`
- Tài liệu phải **sẵn sàng cho developer triển khai**, đủ rõ để kỹ sư backend viết logic validate

---

## ĐỊNH DẠNG ĐẦU RA

- Ngôn ngữ: **Tiếng Việt** và chỉ giữ lại thuật ngữ tiếng Anh khi đó là chuẩn kỹ thuật
- Định dạng: **Markdown (.md)**
- Văn phong: tài liệu nghiệp vụ / kỹ thuật
- Độ dài: đầy đủ, không được cắt bớt hoặc chỉ tóm tắt
