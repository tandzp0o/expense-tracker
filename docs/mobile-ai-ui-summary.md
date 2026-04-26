# Tóm tắt cập nhật UI AI và Mobile

## Ngày cập nhật

- 2026-04-26

## Xác minh build

- `fe`: `npx tsc --noEmit` đã chạy thành công
- `fe`: `npm run build` đã chạy thành công

## Các thay đổi chính đã hoàn tất

### 1. Chế độ hiển thị tiền

- Bổ sung tùy chọn để người dùng chuyển đổi cách hiển thị tiền giữa:
- `full`
- `compact`
- Áp dụng tại:
- `fe/src/contexts/LocaleContext.tsx`
- `fe/src/utils/formatters.ts`
- `fe/src/pages/Settings.tsx`
- Ví dụ hiển thị:
- Tiếng Việt: `1.000.000đ` hoặc `1tr`
- Tiếng Anh: `10,000,000 VND` hoặc `10M VND`

### 2. Hành vi điều hướng trên mobile

- Cập nhật thanh điều hướng mobile thực tế trong:
- `fe/src/layouts/MainLayout.tsx`
- Giữ nút giữa ở thanh mobile là hành động thêm nhanh thay vì chuyển trang.
- Cập nhật nhãn điều hướng mobile tại:
- `fe/src/layouts/navigation.tsx`

### 3. Luồng thêm nhanh giao dịch

- Bổ sung bộ chọn thêm nhanh trên mobile với các chế độ:
- `Nói`
- `Quét`
- `Hỏi AI`
- `Nhập tay`
- Nối luồng để các hành động thêm nhanh trên mobile chuyển tiếp sang màn giao dịch bằng query `composer`.
- Thêm nội dung hướng dẫn riêng theo từng chế độ trong:
- `fe/src/pages/Transactions.tsx`

### 4. Cải thiện dashboard theo hướng mobile-first

- Thêm thẻ tổng quan chính ở đầu dashboard trên mobile.
- Đưa các chỉ số tài chính quan trọng lên cao hơn để người dùng không phải cuộn nhiều.
- Bổ sung thẻ gợi ý phong cách AI gần đầu trang trên mobile.
- Ẩn các nút phụ và phần mô tả kiểu desktop khi ở mobile.
- File chính:
- `fe/src/pages/Dashboard.tsx`

### 5. Cải thiện phân tích theo hướng mobile-first

- Thêm khối tóm tắt AI trên đầu trang phân tích.
- Đưa các chỉ số insight quan trọng lên sớm hơn trên mobile.
- Chuyển bộ lọc kỳ thời gian vào một khối gọn hơn cho mobile.
- Ẩn mô tả dài của header và các điều khiển kiểu desktop khi ở mobile.
- File chính:
- `fe/src/pages/Analytics.tsx`

### 6. Cải thiện UI dùng chung

- Mở rộng `page-header` dùng chung để có thể ẩn tiêu đề, mô tả và hành động trên mobile khi cần:
- `fe/src/components/app/page-header.tsx`
- Tối ưu phần phụ đề của `metric-card` để nội dung phụ không làm tốn diện tích trên mobile:
- `fe/src/components/app/metric-card.tsx`

### 7. Định hướng hình ảnh giao diện

- Tăng sử dụng nền chuyển sắc tuyến tính và xuyên tâm mềm hơn trong toàn app.
- Giữ bảng màu theo cảm giác tài chính:
- vàng
- hồng
- xanh dương
- các màu nhấn mang cảm giác tiền tệ
- File style chính:
- `fe/src/index.css`

### 8. Tài liệu kế hoạch AI

- Thêm tài liệu riêng để lập kế hoạch triển khai các tính năng có AI hỗ trợ:
- `docs/ai-rollout-plan.md`
- Phạm vi gồm:
- tạo nháp giao dịch từ hóa đơn/ảnh
- gợi ý vật thể và danh mục từ hình ảnh
- luồng chuyển giọng nói thành giao dịch
- nhắc nhở và gợi ý trong trang phân tích
- luôn yêu cầu xác nhận trước khi lưu

## Các file đã được cập nhật trong đợt này

- `fe/src/contexts/LocaleContext.tsx`
- `fe/src/utils/formatters.ts`
- `fe/src/pages/Settings.tsx`
- `fe/src/components/app/page-header.tsx`
- `fe/src/components/app/metric-card.tsx`
- `fe/src/layouts/navigation.tsx`
- `fe/src/layouts/MainLayout.tsx`
- `fe/src/pages/Transactions.tsx`
- `fe/src/pages/Dashboard.tsx`
- `fe/src/pages/Analytics.tsx`
- `fe/src/index.css`
- `docs/ai-rollout-plan.md`

## Kết quả hiện tại

- Frontend biên dịch thành công.
- Trải nghiệm mobile đã gần hơn với định hướng giao diện tham chiếu:
- nút giữa giờ ưu tiên thêm giao dịch
- thông tin quan trọng được đưa lên sớm hơn
- nhãn tiền có thể rút gọn
- các điểm vào AI đã có nền tảng UI rõ ràng để nối backend ở giai đoạn tiếp theo

## Cập nhật 2026-04-26: cấu hình giao diện 2 màu

### Mục tiêu

- Cho phép người dùng chọn thêm màu phụ cho các nền linear thay vì chỉ có một màu chủ đạo.
- Nếu người dùng không chọn màu phụ, toàn bộ app tự dùng lại màu chủ đạo như logic cũ để không phá dữ liệu giao diện đã lưu trong `localStorage`.
- Các khu vực quan trọng như navigation mobile, quick add, dashboard hero, analytics hero, auth button và card ví fallback sẽ dùng cặp màu mới để giao diện đồng nhất hơn.

### Thay đổi đã thực hiện

- Mở rộng `AppearanceSettings` với `secondaryColor` dạng tùy chọn trong `fe/src/contexts/ThemeContext.tsx`.
- Thêm helper `getAppearanceGradientColors` để mọi màn hình lấy được `{ primary, secondary }` với fallback an toàn.
- Bổ sung CSS variables mới trong `fe/src/index.css`: `--app-secondary`, `--app-secondary-soft`, `--app-secondary-soft-strong`, `--app-gradient`, `--app-gradient-soft`.
- Cập nhật `ThemeSwitcher` để có ô chọn màu phụ, nút tắt màu phụ và các bộ màu nhanh theo cảm giác tài chính.
- Cập nhật gradient tại `MainLayout`, `Dashboard`, `Analytics`, `Wallets`, `Login`, `Register` và `AuthShell`.

### Xác minh

- `fe`: `npx tsc --noEmit` đã chạy thành công.
- `fe`: `npm run build` đã chạy thành công và không còn warning.

### Bổ sung nền toàn trang

- Cập nhật thêm `--app-page-background` để nền cấp `body` và `.app-shell` cũng lấy màu từ cặp `primaryColor` + `secondaryColor`.
- Bỏ việc `.app-shell` phủ lại bằng `bg-background` đơn sắc, tránh làm mất hiệu ứng linear/radial của theme.
- Nền sáng và tối đều có lớp radial theo 2 màu người dùng chọn; nếu không chọn màu phụ thì vẫn fallback về một màu như trước.
- Xác minh lại `npx tsc --noEmit` và `npm run build`: đều thành công.

### Bổ sung làm rõ nền, header và navigation mobile

- Thêm `app-content-panel` để panel bao nội dung không còn phủ trắng quá mạnh lên nền toàn trang; mobile dùng nền kính trong hơn, desktop giữ độ đọc tốt hơn.
- Thêm `mobile-bottom-nav` và `mobile-bottom-nav-sheen` để bottom navigation có blur mạnh hơn, nền trong hơn, shadow rõ hơn và vẫn giữ hiệu ứng bong bóng mềm.
- Cập nhật header glass shell để bong bóng màu mờ hơn, bớt đục và có shadow giúp tách khỏi nội dung khi cuộn.
- Làm rõ item active trong navigation mobile bằng nền trắng trong, ring nhẹ và shadow.
- Shadow của nút thêm giao dịch ở giữa navigation mobile đã lấy theo màu theme thay vì màu hồng cố định.
- Xác minh lại `npx tsc --noEmit` và `npm run build`: đều thành công.

### Bổ sung giảm mảng trắng và ẩn header mobile toàn cục

- Giảm lớp nền trắng của `app-content-panel`, đặc biệt ở desktop từ lớp kính đục mạnh xuống lớp kính mỏng hơn để vùng `main` không còn thành một mảng trắng lớn.
- Giữ card nội dung riêng vẫn có nền để đọc tốt, nhưng vùng khoảng trống giữa các card sẽ thấy nền linear/radial của theme rõ hơn.
- Đổi mặc định `PageHeader` để title và mô tả tự ẩn trên mobile ở các page chưa cấu hình riêng, tránh lặp thông tin với header sticky.
- Xác minh lại `npx tsc --noEmit` và `npm run build`: đều thành công.

### Bổ sung nền tint riêng cho vùng nội dung

- Thay đổi hướng xử lý từ giảm độ đục sang đặt màu nền riêng cho vùng chứa nội dung.
- Thêm biến `--app-content-panel-background` và `--app-main-surface-background` sinh từ `primaryColor` + `secondaryColor`.
- Gắn class `app-main-surface` trực tiếp vào thẻ `main` để vùng `min-h-[calc(100vh-120px)]` không còn trắng, mà dùng nền tint dịu theo theme.
- Mục tiêu là để các section/card trắng bên trong nổi bật và tách rời rõ hơn so với nền cha.
- Xác minh lại `npx tsc --noEmit` và `npm run build`: đều thành công.

### Bổ sung đổi nền main từ linear sang màu solid pha từ theme

- Không dùng `linear-gradient` hoặc `radial-gradient` cho nền `app-main-surface` nữa vì nền bị loang và nhạt.
- Thêm helper pha màu trong `ThemeContext` để tạo màu `rgb(...)` solid từ `primaryColor`, `secondaryColor` và màu nền cơ sở.
- `app-content-panel` và `app-main-surface` giờ dùng màu solid đã pha, đậm hơn để các card trắng bên trong nổi bật và tách lớp rõ hơn.
- Xác minh lại `npx tsc --noEmit` và `npm run build`: đều thành công.

### Bổ sung trạng thái header trước và sau khi scroll

- Header shell mặc định đã bỏ nền, shadow và blur để không còn trông như trạng thái đã scroll ngay khi vừa mở trang.
- Chỉ khi cuộn quá 56px mới bật class `is-scrolled` để header có nền glass, shadow và viền nổi rõ.
- Xác minh lại `npx tsc --noEmit` và `npm run build`: đều thành công.

### Bổ sung tối ưu độ mượt khi scroll trên mobile

- Tăng ngưỡng bật header nổi lên `88px` để phần đầu trang không bị đổi trạng thái quá sớm.
- Header không còn đổi `padding-top` khi scroll, tránh reflow và cảm giác giật ở đoạn đầu.
- Scroll listener của header chỉ cập nhật state khi vượt/ngược ngưỡng và được gom qua `requestAnimationFrame`.
- Bỏ transition `transform` và `backdrop-filter` ở header; mobile dùng nền/shadow nhẹ hơn thay vì blur nặng trong lúc scroll.
- Tắt `background-attachment: fixed` trên mobile cho `body` và `.app-shell` để giảm repaint khi cuộn.
- Xác minh lại `npx tsc --noEmit` và `npm run build`: đều thành công.
