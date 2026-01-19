1. Tổng quan hệ thống
Hệ thống hoạt động dựa trên nguyên tắc: Ví là nguồn tiền thực, Ngân sách là kế hoạch chi, và Mục tiêu là quỹ tích lũy. Mọi sự biến động tiền tệ đều phải thông qua Giao dịch.

2. Đặc tả các Model (Sơ đồ quan hệ)
A. Wallet (Ví) - "Tiền thực"
Vai trò: Lưu trữ số dư thực tế của người dùng.

Trạng thái: Tổng số dư các ví = Tổng tài sản.

B. Transaction (Giao dịch) - "Cầu nối"
Cập nhật quan trọng: Cần thêm các trường budgetId và goalId (Optional) để liên kết logic.

Logic:

INCOME (Thu nhập): Cộng vào Wallet.balance.

EXPENSE (Chi tiêu): Trừ vào Wallet.balance.

C. Budget (Ngân sách) - "Hạn mức chi"
Vai trò: Thiết lập giới hạn chi tiêu theo danh mục (Category) trong một tháng.

Logic: Không giữ tiền. Khi có Transaction (EXPENSE) liên kết với BudgetId, hệ thống sẽ tính toán số tiền đã chi để cảnh báo người dùng.

D. Goal (Mục tiêu) - "Quỹ ảo"
Vai trò: Tích lũy tiền cho mục đích cụ thể.

Logic: Khi tiền được chuyển vào Goal, nó vẫn nằm trong Wallet thực tế nhưng được đánh dấu là "đã dùng cho mục tiêu".

Công thức hiển thị: Số tiền có thể chi tiêu = Tổng ví - Tổng tiền trong các Mục tiêu.

3. Logic luồng Giao dịch (Dành cho Agent cập nhật Controller)
Kịch bản 1: Chi tiêu thông thường (Expense)
Input: walletId, amount, category, budgetId (nếu có).

Xử lý:

Trừ amount vào Wallet.balance.

Nếu có budgetId: Kiểm tra nếu Budget.amount < (Số tiền đã chi + amount) -> Trả về cảnh báo/thông báo "Vượt ngân sách" (nhưng vẫn cho phép tạo nếu người dùng xác nhận).

Kịch bản 2: Tiết kiệm cho Mục tiêu (Saving to Goal)
Input: walletId, goalId, amount.

Xử lý:

Trừ amount vào Wallet.balance (Đây là logic "khóa" tiền).

Cộng amount vào Goal.currentAmount.

Tạo một Transaction loại đặc biệt (Ví dụ: TYPE: GOAL_DEPOSIT) để lưu vết.

Kịch bản 3: Rút tiền từ Mục tiêu để chi tiêu (Withdraw from Goal)
Input: walletId, goalId, amount.

Xử lý:

Cộng amount vào Wallet.balance.

Trừ amount vào Goal.currentAmount.

Tạo Transaction loại GOAL_WITHDRAW.

4. Ghi chú cập nhật Giao diện (Dành cho Agent cập nhật FE)
A. Form Tạo Giao dịch (Transaction Form)
Dropdown "Loại giao dịch": Thu nhập, Chi tiêu, Tiết kiệm (Goal).

Logic hiển thị động:

Nếu chọn Chi tiêu: Hiện thêm dropdown "Gắn vào Ngân sách nào?" (Lấy danh sách Budget của tháng hiện tại).

Nếu chọn Tiết kiệm: Hiện thêm dropdown "Dành cho Mục tiêu nào?" (Lấy danh sách Goal đang Active). Ẩn dropdown Category vì Goal đã có Category riêng.

B. Hiển thị Dashboard
Cần hiển thị rõ 2 chỉ số:

Tổng tài sản: Sum của tất cả Wallet.balance.

Số dư khả dụng: Tổng tài sản - Sum(Goal.currentAmount). (Đây là số tiền thực sự người dùng có thể tiêu mà không ảnh hưởng đến mục tiêu tiết kiệm).

5. Yêu cầu về mã nguồn (Code Update)
Model Transaction.ts:
TypeScript
// Thêm vào schema hiện tại
budgetId: { type: Schema.Types.ObjectId, ref: 'Budget' },
goalId: { type: Schema.Types.ObjectId, ref: 'Goal' },
Controller createTransaction:
Sử dụng Mongoose Session (Transaction) để đảm bảo tính toàn vẹn dữ liệu (Trừ tiền ví thành công thì mới cộng tiền mục tiêu thành công).

Validation: Khi chọn budgetId, phải kiểm tra Budget đó có thuộc userId của người dùng hay không để tránh lỗi bảo mật.
