# FinTrack UI Design Guidelines (ui_agent_skill.md) - Comprehensive Specs v3

Tài liệu này định nghĩa chi tiết các quy chuẩn thiết kế cho hệ thống FinTrack v2, phục vụ việc duy trì tính nhất quán trên cả Desktop và Mobile.

## 1. Hệ thống Màu sắc (Color System)
- **Primary Indigo (Main):** `#4137cd` (Dùng cho Sidebar active, Nút chính, Progress bars, Primary icons)
- **Primary Light (Selected/Hover):** `#eef2ff` (Background cho menu item đang chọn hoặc hover)
- **Success Green (Income/Completed):** `#10b981` (Dùng cho số tiền thu nhập, trạng thái Hoàn tất)
- **Danger Red (Expense/Warning):** `#ef4444` (Dùng cho số tiền chi tiêu, Cảnh báo ngân sách, trạng thái Thất bại)
- **Warning Amber (Budget Limit):** `#f59e0b` (Dùng cho trạng thái ngân sách sắp hết)
- **Neutral Background (Main):** `#f8fafc` (Nền trang chính phía dưới sidebar/header)
- **Pure White:** `#ffffff` (Sidebar background, Card background, Table background)
- **Text Primary (Strong):** `#1e293b` (Tiêu đề trang, Số dư lớn, Tên mục chính)
- **Text Secondary (Medium):** `#64748b` (Nội dung phụ, nhãn lọc, ngày tháng, caption)
- **Border Color:** `#e2e8f0` (Dùng cho đường kẻ bảng và border của card)

## 2. Typography (Font Family: 'Inter', sans-serif)
- **Page Title:** Size: `24px`, Weight: `700` (Bold), Color: `#1e293b`
- **Hero Balance (Dashboard):** Size: `32px`, Weight: `700` (Bold), Letter-spacing: `-0.02em`
- **Section/Card Title:** Size: `18px`, Weight: `600` (Semi-bold), Color: `#1e293b`
- **Body Text (Regular):** Size: `14px`, Weight: `400`, Color: `#1e293b`
- **Body Text (Medium):** Size: `14px`, Weight: `500`, Color: `#1e293b`
- **Small Caption:** Size: `12px`, Weight: `500`, Color: `#64748b`
- **Table Header:** Size: `12px`, Weight: `600`, Color: `#64748b`, Transform: `Uppercase`

## 3. Layout & Spacing (Desktop)
- **Sidebar Width:** `260px` (Fixed left)
- **Header Height:** `72px`
- **Main Content Padding:** `32px` (All sides)
- **Grid Gap:** `24px` (Khoảng cách giữa các cards)
- **Card Padding:** `24px` (Đồng nhất cho tất cả các card chính)
- **Border Radius (Main):** `16px` (Cho cards và các container lớn)
- **Border Radius (Small):** `12px` (Cho buttons, input, items nhỏ)
- **Shadow (Soft):** `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`

## 4. Component Styles
### 4.1 Cards
- **Background:** `#ffffff`
- **Border:** `1px solid #e2e8f0` (Hoặc không border nếu dùng shadow)
- **Hover State:** `Shadow` sâu hơn một chút hoặc background chuyển sang màu cực nhạt.

### 4.2 Tables (Transactions)
- **Header Cell:** Background: `#f8fafc`, Padding: `12px 24px`
- **Data Cell:** Padding: `16px 24px`, Border-bottom: `1px solid #e2e8f0`
- **Status Badge:** Border-radius: `9999px`, Padding: `4px 12px`, Size: `12px`, Weight: `600`.
- **Amount Styling:** Thu nhập hiển thị `+` (Green), Chi tiêu hiển thị `-` (Red).

### 4.3 Buttons (Primary)
- **Height:** `44px`
- **Padding:** `0 24px`
- **Background:** `#4137cd`
- **Text:** White, Weight: `600`
- **Border Radius:** `12px`

### 4.4 Sidebar & Navigation
- **Logo Area:** Height: `80px`, Padding: `24px`
- **Menu Item:** Height: `48px`, Margin-bottom: `4px`, Padding: `0 16px`, Border-radius: `12px`
- **Active State:** Background `#4137cd`, Text White, Icon White.
- **Normal State:** Background Transparent, Text `#64748b`, Icon `#64748b`.

### 4.5 Icons
- **Style:** Outline / Stroke (2px weight)
- **Size:** `20px` cho menu sidebar, `24px` cho action chính, `18px` cho nội dung card.

## 5. Responsive (Mobile)
- **Screen Padding:** `16px` (Left/Right)
- **Bottom Navigation:** Height `64px`, Background `#ffffff`, Border-top `1px solid #e2e8f0`.
- **Card Transformation:** Table trên Desktop chuyển thành List Card trên Mobile.
- **Font Size Adjustment:** Tiêu đề trang giảm xuống `20px`, Body text giữ nguyên `14px`.

## 6. Đặc trưng từng màn hình (Key UI Features)
- **Dashboard:** Biểu đồ đường mượt mà (smooth area chart) với gradient fill phía dưới. Thẻ ví dạng Credit Card UI.
- **Giao dịch:** Phân trang (Pagination) ở dưới cùng bảng. Lọc nhanh theo Thu nhập/Chi tiêu ở trên đầu.
- **Ví:** Form chuyển tiền nội bộ nằm bên phải màn hình (Desktop) với các input clear và nút action lớn.
- **Ngân sách:** Progress bar có độ cao `8px`, bo tròn cực đại. Có nhãn trạng thái (Đang trong tầm kiểm soát/Vượt mức).
- **Mục tiêu:** Grid card 3 cột (Desktop). Hình ảnh minh họa (House, Car, Travel) chiếm 1/3 chiều cao card. Progress bar hiển thị % tiến độ.
- **Cá nhân:** Header dạng Banner với Gradient Indigo (`linear-gradient(135deg, #4137cd, #6366f1)`). Avatar có border trắng nổi bật.

---
*Tài liệu này được biên soạn bởi Stitch UI Design Agent.*