# FinTrack UI Design Guidelines (ui_agent_skill.md) - Detailed Specs

Dựa trên hệ thống thiết kế FinTrack v2 đồng bộ, đây là các thông số kỹ thuật chi tiết để triển khai giao diện chính xác.

## 1. Hệ thống Màu sắc (Color Palette)
- **Primary Indigo:** `#4137cd` (Sidebar active, Primary Buttons, Progress bars)
- **Primary Light:** `#eef2ff` (Background cho item đang chọn)
- **Success Green:** `#10b981` (Thu nhập, Hoàn tất)
- **Danger Red:** `#ef4444` (Chi tiêu, Cảnh báo, Quá hạn)
- **Neutral Background:** `#f8fafc` (Nền trang chính)
- **White:** `#ffffff` (Sidebar, Cards, Table Background)
- **Text Primary:** `#1e293b` (Tiêu đề, Số dư chính)
- **Text Secondary:** `#64748b` (Nội dung phụ, nhãn, ngày tháng)
- **Border Color:** `#e2e8f0` (Dùng cho table và card border)

## 2. Typography (Font Family: 'Inter', sans-serif)
- **Tiêu đề trang:** Size: `24px`, Weight: `600`, Color: `#1e293b`
- **Số dư lớn (Dashboard/Cards):** Size: `32px`, Weight: `500`, Letter-spacing: `-0.02em`
- **Tiêu đề Section/Card:** Size: `18px`, Weight: `500`, Color: `#1e293b`
- **Body Text:** Size: `14px` hoặc `16px`, Weight: `400`, Color: `#1e293b`
- **Caption/Small Text:** Size: `12px`, Weight: `400`, Color: `#64748b`

## 3. Style Cards & Layout
- **Bo góc (Border Radius):** `16px` cho card chính, `12px` cho component nhỏ.
- **Shadow:** `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`
- **Padding Card:** `24px` đồng nhất ở tất cả các phía.
- **Margin giữa các Card:** `24px`.
- **Desktop Sidebar Width:** `260px`.
- **Main Content Padding:** `32px`.

## 4. Style Table (Giao dịch)
- **Header Table:** Background: `#f8fafc`, Text Color: `#64748b`, Weight: `600`, Size: `12px`, Uppercase, Padding: `12px 24px`.
- **Row Table:** Border-bottom: `1px solid #e2e8f0`, Hover background: `#f1f5f9`.
- **Cell Padding:** `16px 24px`.
- **Badge/Status Style:** Border-radius: `9999px`, Padding: `4px 12px`, Font-size: `12px`, Weight: `600`.

## 5. Components & Icons
- **Button Primary:** Height: `44px`, Padding: `0 24px`, Border-radius: `12px`, Background: `#4137cd`, Text: White.
- **Icon Style:** Sử dụng bộ icon outline (như Lucide hoặc Heroicons), Size: `20px` cho menu, `24px` cho action chính.
- **Progress Bar:** Height: `8px`, Background: `#e2e8f0`, Fill: `#4137cd` (hoặc màu trạng thái).

## 6. Responsive (Mobile)
- **Horizontal Padding:** `16px`.
- **Font Size Adjustment:** Giảm tiêu đề trang xuống `20px`.
- **Component Transformation:** Chuyển Table sang dạng Card List với padding `16px`.
- **Bottom Navigation Height:** `64px`.

---
*Ghi chú: Tài liệu này là căn cứ để UI Agent duy trì tính đồng nhất khi tạo mới hoặc chỉnh sửa màn hình.*