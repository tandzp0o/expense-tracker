**Xây dựng hệ gợi ý lai đa tầng, phân cụm tìm người dùng hình mẫu và đưa ra lời khuyên cá nhân hóa qua LLM không bị ảo giác**, dưới đây là tài liệu hướng dẫn kỹ thuật chi tiết **Step-by-Step** từ tiền xử lý dữ liệu cho đến khi mô hình đưa ra Output.

Bạn hãy lưu lại các bước này, đây chính là khung xương cốt lõi cho **Chương 3 (Thiết kế hệ thống)** và **Chương 4 (Thực nghiệm)**

---

### BƯỚC 1: TIỀN XỬ LÝ DỮ LIỆU VÀ KỸ NGHỆ ĐẶC TRƯNG (FEATURE ENGINEERING)

Mô hình không thể hiểu trực tiếp các bản ghi mang tính chất lưu trữ trong Database hiện tại của bạn. Chúng ta cần chuyển dịch dữ liệu từ các Collection (`User`, `Transaction`, `Budget`, `Goal`) thành một ma trận đặc trưng số (Feature Matrix).

#### 1. Định nghĩa chu kỳ thời gian (Time Window)

Tài chính cá nhân tính theo chu kỳ. Bạn cần gom dữ liệu giao dịch (`Transaction`) theo từng **Tháng** của từng **User**.

#### 2. Trích xuất đặc trưng (Feature Extraction)

Từ dữ liệu thô, bạn viết script (Python/Pandas) để tính toán các chỉ số sau cho từng `userId` theo từng tháng:

* **Đặc trưng năng lực (Dùng cho Phân cụm 1):**
* `Total_Income`: Thu nhập bình quân tháng (`User.totalIncome`).
* `Target_Saving_Ratio`: Tỷ lệ mục tiêu tiết kiệm = Tổng `Goal.targetAmount` / `Total_Income`.


* **Đặc trưng hành vi (Dùng cho Phân cụm 2):**
* `Expense_to_Income_Ratio`: Tỷ lệ tiêu dùng = Tổng `Transaction(type: expense)` / `Total_Income`.
* `Category_Distribution`: Vector tỷ trọng chi tiêu từng danh mục (Ví dụ: `[Ăn uống: 0.4, Giải trí: 0.3, Sức khỏe: 0.1, Khác: 0.2]`).
* `Anomaly_Count`: Số lượng giao dịch bị gắn cờ bất thường trong tháng (Tính bằng thuật toán *Isolation Forest* dựa trên độ lệch lớn so với trung bình các giao dịch cũ của chính họ).
* `Goal_Completion_Rate`: Tỷ lệ hoàn thành mục tiêu (`User.goalsCompleted` / (`User.goalsCompleted` + `User.goalsActive`)).



---

### BƯỚC 2: XÂY DỰNG MÔ HÌNH PHÂN CỤM ĐA CẤP (MULTI-LEVEL CLUSTERING)

Để tránh việc "gợi ý ảo" (như người thu nhập thấp nhận được lời khuyên của người thu nhập cao), bạn cần thực hiện phân cụm 2 lần (Phân cụm lồng nhau).

#### 1. Phân cụm 1: Phân cụm Vĩ mô (Macro-Clustering) - Phân loại theo Năng lực tài chính

* **Thuật toán:** K-Means Clustering.
* **Dữ liệu đầu vào:** Ma trận chỉ gồm 2 đặc trưng: `Total_Income` và `Target_Saving_Ratio`.
* **Số cụm ($K_1$):** Thường chọn $K_1 = 3$ (Tương ứng với: Nhóm thu nhập thấp, Nhóm thu nhập trung bình, Nhóm thu nhập cao).
* **Ý nghĩa:** Xác định "vùng an toàn" kinh tế của user. User ở cụm nào sẽ chỉ tương tác và học hỏi trong cụm đó.

#### 2. Phân cụm 2: Phân cụm Vi mô (Micro-Clustering) - Phân loại theo Hành vi chi tiêu

* **Thuật toán:** K-Means Clustering hoặc Gaussian Mixture Models (GMM).
* **Dữ liệu đầu vào:** Đối với *mỗi cụm vĩ mô* ở trên, bạn lấy toàn bộ dữ liệu thuộc cụm đó và chạy phân cụm lần 2 dựa trên các **Đặc trưng hành vi** (`Expense_to_Income_Ratio`, `Category_Distribution`, `Anomaly_Count`, `Goal_Completion_Rate`).
* **Số cụm ($K_2$):** Thường chọn $K_2 = 3$ cho mỗi cụm vĩ mô (Tương ứng với: Tiết kiệm/Kỷ luật, Cân bằng, Hoang phí/Bốc đồng).
* **Xác định "User hình mẫu" (Leader Node):** Trong mỗi tiểu cụm, hệ thống tìm ra những User có `Goal_Completion_Rate` $= 100\%$ và `Anomaly_Count` $\approx 0$. Thuật toán sẽ lưu lại cấu trúc phân bổ chi tiêu (`Category_Distribution`) của các User hình mẫu này để làm mục tiêu hướng tới (Target Baseline) cho các user khác cùng nhóm vĩ mô nhưng đang nằm ở tiểu cụm "Hoang phí".

---

### BƯỚC 3: CHIẾN LƯỢC CHIA TẬP DỮ LIỆU VÀ HUẤN LUYỆN (TRAIN - VALIDATION - TEST)

Vì chúng ta sử dụng dữ liệu mô phỏng (Synthetic Data) kết hợp Benchmark quốc tế, việc phân chia dữ liệu cần tuân thủ nghiêm ngặt quy chuẩn khoa học:

1. **Tỷ lệ phân chia:** Chia tập dữ liệu (gồm danh sách các bản ghi đặc trưng của người dùng qua các tháng) theo tỷ lệ **70% Train - 15% Validation - 15% Test**.
2. **Tập Train (Huấn luyện):** Dùng để thuật toán K-Means tìm ra các tâm cụm (Centroids) cố định và lưu lại mô hình.
3. **Tập Validation (Kiểm định):** Dùng để tinh chỉnh siêu tham số (Hyperparameter tuning) - ví dụ: Tìm số lượng cụm $K$ tối ưu bằng **Phương pháp khuỷu tay (Elbow Method)** hoặc chỉ số **Silhouette Score**. Bạn cần vẽ biểu đồ này đưa vào luận văn.
4. **Tập Test (Kiểm thử):** Đưa các góc dữ liệu hoàn toàn mới (User mới) vào để kiểm tra xem mô hình phân cụm có hoạt động ổn định và phân loại chính xác nhóm hành vi của họ hay không.

---

### BƯỚC 4: VẬN HÀNH VỚI DATA INPUT THỜI GIAN THỰC (REAL-TIME PIPELINE)

Khi hệ thống đã được train xong và đóng gói (Deploy), luồng chạy khi người dùng nhập giao dịch mới trên giao diện App sẽ diễn ra tự động theo mô hình ngầm:

1. **Đón nhận Input:** Người dùng nhập một giao dịch: `Số tiền: 2.000.000đ`, `Danh mục: Giải trí`.
2. **Định vị Node User:** Hệ thống quét ID của User, xác định User này đang thuộc Cụm vĩ mô nào (ví dụ: Thu nhập trung bình) và Tiểu cụm vi mô nào (ví dụ: Hoang phí).
3. **Dự báo chuỗi thời gian (LSTM layer):** Hệ thống cộng giao dịch 2.000.000đ này vào chuỗi dữ liệu chi tiêu từ đầu tháng đến nay của user. Mạng LSTM chạy ngầm dự báo: *Với đà này, tổng chi tiêu cuối tháng sẽ vượt Budget danh mục Giải trí 150% và khiến Mục tiêu tiết kiệm tháng này thất bại (hụt 1.500.000đ so với Target).*
4. **Trích xuất Tri thức Đồ thị (Graph/Collaborative Knowledge):** Hệ thống tìm kiếm cấu trúc chi tiêu của "User hình mẫu" trong cùng cụm vĩ mô. Nó nhận ra: Để đạt mục tiêu tiết kiệm, một người thu nhập trung bình chỉ nên dành tối đa 10% cho Giải trí, và hiện tại User này đã tiêu quá 25%. Để bù đắp, họ cần giảm 15% danh mục "Ăn uống ngoài tiệm" trong 2 tuần tới.

---

### BƯỚC 5: TẠO GỢI Ý CÁ NHÂN HÓA VỚI LLM (GENAI AGENT LAYER)

Để giải quyết bài toán "hội đồng bắt bẻ LLM nói năng ảo tưởng", bạn tuyệt đối không cho LLM tự ý bịa số liệu. Bạn phải áp dụng kỹ thuật **RAG (Retrieval-Augmented Generation)** dựa trên tri thức dạng số đã tính toán ở Bước 4.

Bạn sẽ thiết kế một cấu trúc **Prompt Framework** cố định gửi lên API của LLM (ví dụ: Gemini hoặc GPT) như sau:

```text
[SYSTEM PROMPT]
Bạn là một chuyên gia cố vấn tài chính cá nhân thân thiện được tích hợp trong ứng dụng FinTrack. 
Nhiệm vụ của bạn là dựa vào THÔNG TIN NGỮ CẢNH ĐƯỢC CUNG CẤP để đưa ra lời khuyên tài chính cá nhân hóa.
Nguyên tắc: 
- Không tự bịa ra số liệu nằm ngoài ngữ cảnh.
- Đưa ra giải pháp hành động cụ thể (Actionable Advice).
- Giọng văn động viên, không chỉ trích.

[CONTEXT DATA]
- Tên người dùng: Nguyễn Văn A
- Trạng thái: Thu nhập trung bình, thuộc nhóm chi tiêu bốc đồng.
- Sự cố: Vừa phát sinh giao dịch Giải trí lớn (2.000.000đ).
- Dự báo từ mô hình LSTM: Cuối tháng sẽ thâm hụt mục tiêu tiết kiệm 1.500.000đ.
- Giải pháp từ User hình mẫu: Cần cắt giảm 15% chi phí danh mục "Ăn uống" trong các tuần tới.
- Gợi ý từ hệ thống dữ liệu: Người dùng có sở thích ăn mì Ý và cơm tấm, trong DB đang có món "Cơm tấm sườn tự nấu tại nhà" (Collection Dish) với chi phí chỉ 30.000đ/phần.

[USER INPUT]
(Hệ thống tự động kích hoạt khi kết thúc tuần/tháng hoặc ngay khi có giao dịch bất thường)

[OUTPUT GENERATION]
(LLM dựa vào các dữ liệu thô trên để viết thành một đoạn văn hoàn chỉnh hiển thị lên Widget Trợ lý AI trên mobile của bạn)

```

**Kết quả hiển thị trên UI của bạn sẽ mượt mà như thế này:**

> *"Chào Văn A! FinTrack nhận thấy bạn vừa có một buổi thư giãn giải trí khá lớn. Điều này hoàn toàn chính đáng, tuy nhiên mô hình dự báo của mình thấy quỹ tiết kiệm cuối tháng của bạn có nguy cơ bị hụt mất 1.500.000đ đấy. Đừng lo lắng quá! Để cân bằng lại, từ nay đến cuối tháng bạn có thể thử giảm bớt việc đặt đồ ăn ngoài tiệm. FinTrack gợi ý bạn thực đơn [Cơm tấm sườn tự nấu tại nhà] có sẵn trong thực đơn yêu thích của bạn, chi phí chỉ khoảng 30.000đ thôi mà vẫn đảm bảo dinh dưỡng và giúp bạn đưa con tàu tài chính về đúng mục tiêu!"*

---

### Ghi chú quan trọng để viết Luận văn:

Khi làm theo 5 bước này, bạn đã có một **Mô hình kiến trúc dạng khối (Block Diagram)** cực đẹp cho luận văn. Bạn có thể tự tin khẳng định với hội đồng:

* **AI học máy truyền thống (K-Means, LSTM):** Đóng vai trò là bộ não phân tích định lượng (Xử lý các con số, phân cụm chính xác, dự báo logic).
* **AI tạo sinh (LLM):** Đóng vai trò là giao diện dịch thuật định tính (Biến các con số khô khan thành ngôn ngữ tự nhiên có tính thuyết phục cao).

Sự kết hợp này triệt tiêu hoàn toàn điểm yếu lớn nhất của LLM là "dốt toán và hay nói bừa", tạo nên tính khoa học chặt chẽ cho đề án của bạn.