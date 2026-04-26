# Quy tắc nghiệp vụ giao dịch — Ứng dụng tài chính cá nhân

Tài liệu này tổng hợp bộ quy tắc nghiệp vụ giao dịch cho ứng dụng quản lý tài chính cá nhân theo hướng có thể triển khai ngay ở backend, tham chiếu từ hành vi thực tế của các ứng dụng quản lý tài chính phổ biến và một số pattern lifecycle trong sản phẩm tài chính số: Money Lover, Spendee, YNAB, Mint, Wallet by BudgetBakers, MISA MoneyKeeper, Finhay.

## 0. Nguyên tắc nghiên cứu và diễn giải

- Tài liệu ưu tiên nguồn chính thức: Help Center, FAQ, trang tính năng, tài liệu API, bảng hạn mức, thông báo sản phẩm của chính nhà cung cấp.
- Một số ràng buộc được nội suy từ hành vi sản phẩm chứ không phải từ câu chữ pháp lý tuyệt đối. Những đoạn đó được ghi rõ là "đề xuất triển khai" nhưng vẫn bám theo logic thực tế của thị trường.
- Phạm vi tài liệu này dành cho app theo dõi, lập kế hoạch và hỗ trợ ra quyết định tài chính cá nhân. App không giả định có kết nối trực tiếp tới ngân hàng thật, tài khoản thanh toán thật, thẻ thật hoặc core banking.
- Nếu tài liệu có nhắc đến `pending`, `posted`, `import`, `statement`, `sync`, `API`, các cụm đó được hiểu là pattern tham chiếu hoặc nguồn dữ liệu do người dùng chủ động đưa vào như CSV/import thủ công, không mặc định là liên kết ngân hàng trực tiếp.
- Múi giờ nghiệp vụ mặc định trong tài liệu này: `Asia/Ho_Chi_Minh`.
- Tiền tệ ví dụ mặc định: `VND`.
- Trạng thái giao dịch đề xuất:

```text
[SCHEDULED] -> [PENDING] -> [COMPLETED] / [FAILED] / [CANCELLED]
```

- Định nghĩa nhanh:
  - `SCHEDULED`: đã có template/lịch, chưa đến kỳ xử lý.
  - `PENDING`: đã tới ngày hoặc đã tạo occurrence nháp, đang chờ xác nhận/xử lý nội bộ.
  - `COMPLETED`: đã ghi nhận vào sổ cái, ảnh hưởng số dư/budget/report.
  - `FAILED`: tới hạn nhưng xử lý không thành công, chưa được ghi nhận vào sổ cái.
  - `CANCELLED`: người dùng/hệ thống chủ động dừng trước khi hoàn tất.

## 1. Quy tắc tạo giao dịch

### 1.1 Giao dịch thủ công

#### TXN-001 — Giao dịch thủ công chỉ được tạo trên ví/tài khoản đang hoạt động
- Điều kiện:
  - Người dùng tạo giao dịch thủ công từ form nhập tay.
  - `walletId/accountId` phải tồn tại, thuộc đúng chủ tài khoản, không bị archive/lock.
- Hành động:
  - Cho phép tạo giao dịch nếu ví hợp lệ.
  - Từ chối nếu ví đã archive, soft-delete hoặc không thuộc user.
- Thông báo lỗi:
  - `Không thể tạo giao dịch trên ví không tồn tại hoặc đã ngừng hoạt động.`
- Ví dụ:
  - User A không được chọn ví của User B để nhập khoản chi `120.000 VND`.
- Nguồn cảm hứng:
  - Money Lover, Spendee, Mint, Wallet by BudgetBakers đều buộc giao dịch gắn với một wallet/account cụ thể.

#### TXN-002 — Giao dịch thủ công phải có bộ trường tối thiểu
- Điều kiện:
  - Khi submit giao dịch thủ công.
- Hành động:
  - Bắt buộc có tối thiểu: `type`, `amount`, `walletId`, `category`, `occurredAt`.
  - `note`, `location`, `labels`, `photo`, `payee` là tùy chọn.
- Thông báo lỗi:
  - `Thiếu thông tin bắt buộc để tạo giao dịch.`
- Ví dụ:
  - Không cho lưu khoản `500.000 VND` nếu chưa chọn danh mục `Tiền điện`.
- Nguồn cảm hứng:
  - Money Lover cho phép nhập số tiền, category, note, date, wallet, currency; Mint/Spendee đều gắn giao dịch với category và account.

#### TXN-003 — Imported/Pending transaction không được sửa như giao dịch đã hạch toán
- Điều kiện:
  - Giao dịch do CSV/import thủ công/sync dữ liệu vào hoặc được app tạo ở trạng thái `PENDING`.
- Hành động:
  - Không cho sửa amount/date/category lõi khi còn pending.
  - Chỉ cho phép thao tác nhẹ nếu sản phẩm hỗ trợ, ví dụ thêm internal note tạm.
  - Chỉ khi giao dịch chuyển sang `COMPLETED` mới cho phép recategorize theo policy.
- Thông báo lỗi:
  - `Giao dịch đang chờ xác nhận/hạch toán nội bộ, chưa thể chỉnh sửa như giao dịch hoàn tất.`
- Ví dụ:
  - Giao dịch import từ file sao kê thủ công đang ở `PENDING` chưa được đổi ngay từ `Ăn uống` sang `Mua sắm`.
- Nguồn cảm hứng:
  - Spendee: pending transactions được tách khỏi giao dịch đã hoàn tất.
  - YNAB: pending transactions xuất hiện riêng trước khi người dùng chấp nhận hoàn tất.

#### TXN-004 — Chuyển tiền nội bộ không đi qua form thu/chi thông thường
- Điều kiện:
  - Người dùng muốn chuyển tiền từ ví A sang ví B của chính họ.
- Hành động:
  - Bắt buộc sử dụng flow `Transfer`.
  - Không cho tạo bằng tay 1 dòng `EXPENSE` ở ví A và 1 dòng `INCOME` ở ví B từ generic form.
  - Hệ thống phải tạo cặp giao dịch liên kết hoặc một transaction group duy nhất.
- Thông báo lỗi:
  - `Hãy dùng chức năng chuyển tiền nội bộ thay vì tạo thu/chi thủ công.`
- Ví dụ:
  - Chuyển `2.000.000 VND` từ ví `Tài khoản chính` sang ví `Tiền mặt` phải dùng form transfer.
- Nguồn cảm hứng:
  - Money Lover có flow `Transfer money between wallets`, tự tạo 2 transaction nhưng loại khỏi report.

#### TXN-005 — Điều chỉnh số dư (adjust balance) là một flow riêng, không phải sửa trực tiếp balance
- Điều kiện:
  - Người dùng phát hiện số dư thực tế lệch so với app.
- Hành động:
  - Không cho sửa trực tiếp `wallet.balance`.
  - Hệ thống phải tạo adjustment transaction hoặc reconciliation record để đưa số dư về thực tế.
  - Adjustment mặc định bị loại khỏi report/budget tổng hợp nếu sản phẩm muốn giữ báo cáo sạch.
- Thông báo lỗi:
  - `Không thể sửa trực tiếp số dư ví. Hãy dùng chức năng điều chỉnh số dư.`
- Ví dụ:
  - Ví app đang `14.214.147 VND`, số dư thực tế `15.000.000 VND`, hệ thống sinh adjustment `+785.853 VND`.
- Nguồn cảm hứng:
  - Money Lover: Adjust Balance tự sinh income/expense transaction để khớp số dư.

### 1.2 Giao dịch tự động / định kỳ

#### TXN-006 — Recurring template phải lưu riêng với executed transaction
- Điều kiện:
  - User tạo giao dịch định kỳ/hoá đơn định kỳ.
- Hành động:
  - Lưu 2 lớp dữ liệu:
    - `schedule/template`
    - `occurrence/executed transaction`
  - Không dùng một document duy nhất vừa làm template vừa làm transaction đã hoàn tất.
- Thông báo lỗi:
  - `Không thể xử lý lịch định kỳ vì thiếu template hoặc occurrence hợp lệ.`
- Ví dụ:
  - Template `Tiền thuê nhà 8.000.000 VND mỗi tháng ngày 05` không đồng nghĩa đã có transaction completed trong tháng hiện tại.
- Nguồn cảm hứng:
  - Wallet by BudgetBakers Planned Payments.
  - Money Lover Bills/Recurring.
  - Spendee Scheduled Transactions.
  - YNAB Scheduled Transactions API.

#### TXN-007 — Auto/Recurring template phải có đủ metadata lịch
- Điều kiện:
  - Tạo mới template recurring/scheduled.
- Hành động:
  - Bắt buộc lưu:
    - `sourceWalletId`
    - `type`
    - `category`
    - `amount`
    - `frequencyUnit` (`DAY|WEEK|MONTH|QUARTER|YEAR|CUSTOM`)
    - `startDate`
    - `endDate` hoặc `occurrenceCount` hoặc `untilForever`
    - `confirmationMode` (`MANUAL_APPROVAL|AUTO_EXECUTE`)
    - `timezone`
- Thông báo lỗi:
  - `Thiếu thông tin lịch giao dịch định kỳ.`
- Ví dụ:
  - `Tiền điện 500.000 VND`, `MONTH`, `dayOfMonth=1`, `startDate=2026-05-01`, `manualApproval=true`.
- Nguồn cảm hứng:
  - Wallet by BudgetBakers hỗ trợ start date, repeat, manual/automatic confirmation.
  - Money Lover Bills/Recurring có metadata ngày bắt đầu, chu kỳ và điều kiện xác nhận.

#### TXN-008 — Auto-categorization chỉ là suggestion, không được override ý chí người dùng một cách im lặng
- Điều kiện:
  - Giao dịch import từ CSV/nguồn ngoài hoặc app dùng engine gán category tự động.
- Hành động:
  - Hệ thống có thể gợi ý category dựa trên merchant/note/history.
  - User override phải được ưu tiên.
  - Lưu learning profile nhưng không được silently rewrite giao dịch cũ đã khóa sổ.
- Thông báo lỗi:
  - Không cần hard error; nếu engine fail, fallback sang `Uncategorized`.
- Ví dụ:
  - Merchant `Circle K` được gợi ý `Ăn uống`, user đổi sang `Mua sắm nhỏ lẻ`, hệ thống ghi nhớ cho lần sau.
- Nguồn cảm hứng:
  - Spendee automatic categorization.
  - Mint tự nhận diện bill từ statement.

### 1.3 Giao dịch có ngày trong tương lai

#### TXN-009 — Cấm tạo thủ công giao dịch đã hoàn tất ở tương lai
- Điều kiện:
  - User nhập giao dịch `COMPLETED` với `occurredAt > today`.
- Hành động:
  - Từ chối.
  - Gợi ý chuyển sang `SCHEDULED` nếu đó là khoản đã lên kế hoạch.
- Thông báo lỗi:
  - `Không thể tạo giao dịch hoàn tất trong tương lai. Hãy dùng lịch giao dịch hoặc nhắc thanh toán.`
- Ví dụ:
  - Ngày hôm nay là `24/04/2026`, không cho tạo `Chi tiền điện 500.000 VND` vào `01/05/2026` với status `COMPLETED`.
- Nguồn cảm hứng:
  - Hành vi phổ biến ở app quản lý chi tiêu; giao dịch tương lai nên vào scheduled/planned.

#### TXN-010 — Chỉ cho phép giao dịch tương lai theo các nhóm ngoại lệ đã định nghĩa
- Điều kiện:
  - Giao dịch có ngày tương lai.
- Hành động:
  - Chỉ cho phép nếu thuộc một trong các nhóm:
    1. Budget-scheduled recurring transaction
    2. Installment/loan repayment schedule
    3. Savings goal transfer schedule
    4. Bill reminder/upcoming payment
    5. Future one-time planned transaction có status `SCHEDULED`
  - Nếu không thuộc nhóm nào, từ chối.
- Thông báo lỗi:
  - `Giao dịch tương lai chỉ được phép dưới dạng lịch định kỳ, nhắc thanh toán hoặc kế hoạch trả góp/tiết kiệm.`
- Ví dụ:
  - `Ngày 01 hằng tháng trích 1.200.000 VND tiền thuê nhà` là hợp lệ nếu lưu dưới dạng schedule.
- Nguồn cảm hứng:
  - Spendee có future non-recurring section.
  - Money Lover Bills/Recurring.
  - Wallet by BudgetBakers Planned Payments.

#### TXN-011 — Future transaction hợp lệ phải được lưu ở trạng thái chưa hạch toán
- Điều kiện:
  - Giao dịch tương lai được phép theo TXN-010.
- Hành động:
  - Tạo `SCHEDULED` hoặc `PENDING`, không tạo `COMPLETED`.
  - Chỉ khi tới ngày chạy job hoặc người dùng xác nhận thực hiện thì mới chuyển `COMPLETED`.
- Thông báo lỗi:
  - `Giao dịch tương lai phải ở trạng thái lịch chờ xử lý, không được ghi sổ ngay.`
- Ví dụ:
  - Lệnh `trích 500.000 VND tiền điện ngày 01/05/2026` hiển thị `SCHEDULED`, tới hạn mới thành `PENDING/COMPLETED`.
- Nguồn cảm hứng:
  - Wallet by BudgetBakers: Planned Payments với manual/automatic confirmation.
  - YNAB/Spendee: scheduled/future transaction tách khỏi giao dịch posted.

## 2. Ràng buộc ngày và thời gian

### 2.1 Giao dịch quá khứ

#### TXN-012 — Cho phép giao dịch quá khứ nhưng không trước ngày mở ví, trừ adjustment/migration
- Điều kiện:
  - User tạo giao dịch với ngày trong quá khứ.
- Hành động:
  - Cho phép nếu `occurredAt >= wallet.openedAt`.
  - Nếu nhỏ hơn `wallet.openedAt`, chỉ cho phép dưới cờ admin/import/migration.
- Thông báo lỗi:
  - `Ngày giao dịch không được trước ngày mở ví.`
- Ví dụ:
  - Ví mở ngày `01/04/2026`, không cho nhập tay giao dịch `25/03/2026`.
- Nguồn cảm hứng:
  - Đề xuất triển khai từ logic sổ cái thực tế để tránh âm dòng thời gian.

#### TXN-013 — Quá khứ xa phải đi qua kiểm soát khóa sổ (optional nhưng khuyến nghị)
- Điều kiện:
  - Giao dịch nằm trong kỳ đã chốt báo cáo tháng/quý/năm.
- Hành động:
  - Cho sửa/xóa nếu role đủ quyền hoặc tạo reversal transaction thay vì sửa trực tiếp.
- Thông báo lỗi:
  - `Kỳ này đã khóa sổ. Vui lòng tạo giao dịch điều chỉnh/đảo bút toán.`
- Ví dụ:
  - Báo cáo tháng 03 đã chốt, không cho sửa thẳng khoản `hóa đơn internet`.
- Nguồn cảm hứng:
  - Logic kế toán và reconciliation thực tế; phù hợp khi app phát triển lên mức audit tốt hơn.

### 2.2 Giao dịch trong ngày hiện tại

#### TXN-014 — Giao dịch hôm nay được ghi nhận theo business day địa phương
- Điều kiện:
  - User tạo giao dịch trong ngày hiện tại.
- Hành động:
  - So sánh ngày theo `Asia/Ho_Chi_Minh`.
  - Lưu timestamp chuẩn `UTC ISO8601`, nhưng validate theo local business date.
- Thông báo lỗi:
  - `Ngày giao dịch không hợp lệ theo múi giờ hệ thống.`
- Ví dụ:
  - 00:15 ngày `25/04/2026` giờ VN không được xem là `24/04` chỉ vì UTC còn ngày cũ.
- Nguồn cảm hứng:
  - Best practice dùng ISO8601 cho timestamp.
  - YNAB API trả ngày chuẩn hóa.

### 2.3 Giao dịch tương lai — các trường hợp được phép

#### TXN-015 — Schedule theo ngày không tồn tại phải có strategy rõ ràng
- Điều kiện:
  - Template chạy vào ngày `29/30/31` cho các tháng không có ngày đó.
- Hành động:
  - Backend phải cấu hình một trong hai strategy:
    - `SKIP_OCCURRENCE`
    - `ROLL_TO_LAST_DAY`
  - Không được để hành vi ngầm khó đoán.
  - Khuyến nghị mặc định:
    - Bill/loan: `ROLL_TO_LAST_DAY` nếu user chọn "cuối tháng"
    - Exact recurring: `SKIP_OCCURRENCE`
- Thông báo lỗi:
  - `Ngày lặp không tồn tại trong tháng đích. Vui lòng chọn quy tắc xử lý.`
- Ví dụ:
  - Khoản nhắc ngày `31` tháng 02:
    - Nếu `EXACT_DAY`: skip và log `SKIPPED_INVALID_DATE`
    - Nếu `LAST_DAY`: chạy ngày `28` hoặc `29`.
- Nguồn cảm hứng:
  - Wallet by BudgetBakers: nếu chọn ngày không tồn tại thì planned payment bị skip.

#### TXN-016 — Scheduled transfer/bill phải có cửa sổ hiệu lực
- Điều kiện:
  - Tạo recurring/scheduled item.
- Hành động:
  - Cho phép chọn:
    - `untilForever`
    - `untilDate`
    - `afterNTimes`
  - Không nên để recurring vô hạn mà không có cờ rõ ràng.
- Thông báo lỗi:
  - `Thiếu thông tin thời hạn áp dụng cho lịch giao dịch.`
- Ví dụ:
  - Thuê nhà `12 tháng`, mỗi tháng `8.000.000 VND`, hết hạn sau 12 lần.
- Nguồn cảm hứng:
  - Wallet planned payments có phạm vi lịch rõ ràng.
  - Money Lover bills/recurring có repeat until forever/until when/for how many times.

### 2.4 Giao dịch tương lai — các trường hợp bị cấm

#### TXN-017 — Không cho chỉnh sửa trực tiếp future occurrence "ảo" từ transaction list
- Điều kiện:
  - User mở một occurrence tương lai được render từ template, chưa materialize thành transaction thực.
- Hành động:
  - Chỉ cho sửa template hoặc skip occurrence.
  - Không cho edit như một transaction thực.
- Thông báo lỗi:
  - `Đây là giao dịch tương lai chưa được tạo thực tế. Hãy chỉnh sửa lịch gốc.`
- Ví dụ:
  - Trong tab Future, user thấy `Tiền điện tháng tới`; bấm vào chỉ được sửa schedule.
- Nguồn cảm hứng:
  - Money Lover recurring/bill article.
  - Spendee future scheduled items.

#### TXN-018 — Pending transaction không được coi là completed trước khi xác nhận xong
- Điều kiện:
  - Giao dịch đang ở trạng thái `PENDING` do import, schedule hoặc chờ người dùng xác nhận.
- Hành động:
  - Hiển thị `PENDING`.
  - Không cộng vào finalized report nếu chính sách app phân biệt completed vs pending.
  - Có thể tạm giữ trong forecast/cash-out expected.
- Thông báo lỗi:
  - `Giao dịch đang chờ xác nhận hoàn tất.`
- Ví dụ:
  - Lịch `tiền điện tháng tới` đã materialize thành occurrence `PENDING` nhưng người dùng chưa xác nhận thanh toán.
- Nguồn cảm hứng:
  - Spendee pending transaction.
  - YNAB pending transaction.

## 3. Giao dịch tự động được kích hoạt từ ngân sách

### 3.1 Cách quy tắc ngân sách kích hoạt giao dịch

#### TXN-019 — Budget là lớp kiểm soát chi tiêu; transaction mới là sổ cái gốc
- Điều kiện:
  - User tạo budget cho category/wallet/kỳ thời gian.
- Hành động:
  - Budget không tự sinh chi tiêu completed.
  - Budget chỉ:
    - theo dõi actual spend từ completed transactions
    - cảnh báo ngưỡng
    - tùy chọn tạo schedule template đi kèm
- Thông báo lỗi:
  - Không có hard error; đây là nguyên tắc mô hình dữ liệu.
- Ví dụ:
  - Budget `Ăn uống 3.000.000 VND/tháng` chỉ bị trừ khi có expense completed thuộc category này.
- Nguồn cảm hứng:
  - Money Lover, Spendee, Mint, Wallet by BudgetBakers.

#### TXN-020 — Budget có thể gắn recurring template cho chi phí cố định
- Điều kiện:
  - User bật chế độ `Budget with recurring bill`.
- Hành động:
  - Budget sinh template cho các khoản như:
    - điện
    - nước
    - tiền nhà
    - học phí
  - Template mang theo `budgetId`.
- Thông báo lỗi:
  - `Không thể tạo lịch chi định kỳ vì budget chưa có ví nguồn hoặc danh mục hợp lệ.`
- Ví dụ:
  - Budget `Hóa đơn sinh hoạt` sinh template `01 hàng tháng trừ 500.000 VND tiền điện`.
- Nguồn cảm hứng:
  - MISA dự thu/dự chi.
  - Mint Bill Reminders.
  - Wallet Planned Payments.

### 3.2 Mẫu chi tiêu định kỳ, ví dụ điện, nước, tiền thuê

#### TXN-021 — Template chi cố định phải chụp snapshot category/payee lúc tạo
- Điều kiện:
  - Tạo recurring expense template.
- Hành động:
  - Lưu snapshot:
    - `categoryId`
    - `categoryName`
    - `payeeName`
    - `budgetId`
    - `walletId`
  - Nếu category bị rename về sau, lịch cũ vẫn truy vết được.
- Thông báo lỗi:
  - `Thiếu thông tin danh mục hoặc đối tượng thanh toán cho lịch định kỳ.`
- Ví dụ:
  - `Bills & Utilities > Tiền điện EVN`.
- Nguồn cảm hứng:
  - Mint add bill name/amount/due date.
  - Wallet planned payment category/payee.

### 3.3 Cấu hình lịch chạy, theo tháng, theo tuần hoặc tùy chỉnh

#### TXN-022 — Hỗ trợ cadence chuẩn và cadence custom
- Điều kiện:
  - User tạo schedule.
- Hành động:
  - Tối thiểu hỗ trợ:
    - `DAY`
    - `WEEK`
    - `MONTH`
    - `QUARTER`
    - `YEAR`
    - `CUSTOM`
  - Với `CUSTOM`, phải lưu cron-like metadata hoặc rule object tường minh.
- Thông báo lỗi:
  - `Chu kỳ lặp không được hỗ trợ.`
- Ví dụ:
  - `Mỗi quý ngày 05 trả lãi vay`.
- Nguồn cảm hứng:
  - Wallet planned payments và recurring template thực tế.
  - YNAB weekly/monthly/yearly/custom targets.
  - Money Lover bills/recurring theo nhiều cadence.

### 3.4 Logic tự khấu trừ

#### TXN-023 — Đến hạn mới materialize transaction completed
- Điều kiện:
  - Cron/job thấy occurrence tới hạn.
- Hành động:
  - Tạo `PENDING`.
  - Nếu app nội bộ tự quyết toán được thì chuyển `COMPLETED` trong cùng flow.
  - Nếu cần xác nhận thủ công thì giữ `PENDING` cho tới khi user xác nhận.
- Thông báo lỗi:
  - `Không thể thực hiện giao dịch định kỳ tại thời điểm hiện tại.`
- Ví dụ:
  - `01/05 09:00` tới hạn, hệ thống sinh occurrence cho `Tiền điện`.
- Nguồn cảm hứng:
  - Wallet Planned Payments manual/automatic.
  - Money Lover recurring/bills.
  - Spendee scheduled transactions.

#### TXN-024 — Actual completed transaction mới tính vào budget
- Điều kiện:
  - Giao dịch thuộc budget.
- Hành động:
  - Chỉ `COMPLETED` mới cộng vào `spent`.
  - `SCHEDULED/PENDING/FAILED/CANCELLED` không trừ ngân sách thực tế.
- Thông báo lỗi:
  - Không cần hard error.
- Ví dụ:
  - Hóa đơn điện tháng sau đang `SCHEDULED` thì budget tháng này chưa bị trừ.
- Nguồn cảm hứng:
  - Money Lover budget hiển thị spent/left/overspent từ transaction thực.

## 4. Ràng buộc kiểm tra giao dịch

### 4.1 Ràng buộc số tiền

#### TXN-025 — Amount phải là số dương hợp lệ; với VND nên là số nguyên
- Điều kiện:
  - Tạo/sửa giao dịch.
- Hành động:
  - `amount > 0`
  - Nếu currency = `VND`, amount nên là integer.
  - Nếu multi-currency, cho decimal theo precision currency.
  - Chặn giá trị vượt `Number.MAX_SAFE_INTEGER` hoặc ngưỡng nghiệp vụ.
- Thông báo lỗi:
  - `Số tiền không hợp lệ.`
- Ví dụ:
  - `-500.000 VND`, `0 VND`, `1.2321312312312322e+23 VND` đều bị từ chối.
- Nguồn cảm hứng:
  - Yêu cầu triển khai an toàn backend; phù hợp app tài chính thực tế.

#### TXN-026 — Currency conversion phải tường minh
- Điều kiện:
  - User nhập giao dịch khác currency ví.
- Hành động:
  - Lưu:
    - `originalAmount`
    - `originalCurrency`
    - `exchangeRate`
    - `settledAmount`
  - Không chỉ overwrite amount sau khi convert mà mất dấu vết.
- Thông báo lỗi:
  - `Thiếu tỷ giá quy đổi cho giao dịch đa tiền tệ.`
- Ví dụ:
  - Ví VND ghi khoản `3 USD`, app lưu cả `3 USD` và số VND sau quy đổi.
- Nguồn cảm hứng:
  - Money Lover hỗ trợ currency conversion khi tạo transaction.

### 4.2 Ràng buộc danh mục

#### TXN-027 — Category phải tương thích với transaction type
- Điều kiện:
  - Tạo/sửa giao dịch.
- Hành động:
  - `EXPENSE` chỉ chọn expense category.
  - `INCOME` chỉ chọn income category.
  - `LOAN_REPAYMENT`/`DEBT_PAYMENT` ưu tiên debt/loan category.
  - `TRANSFER` không dùng category user tự nhập trong generic flow.
- Thông báo lỗi:
  - `Danh mục không phù hợp với loại giao dịch.`
- Ví dụ:
  - Không cho gán category `Lương` cho transaction `EXPENSE`.
- Nguồn cảm hứng:
  - Money Lover predefined income/expense groups.
  - Spendee custom category theo income/expense.

#### TXN-028 — Exclude from report là cờ nghiệp vụ, không phải xóa dữ liệu
- Điều kiện:
  - Adjustment, internal transfer fee/leg, migration, opening balance correction.
- Hành động:
  - Cho phép set `excludeFromReport=true`.
  - Giao dịch vẫn tồn tại trong ledger/audit.
  - Budget/report mặc định không tính các giao dịch excluded.
- Thông báo lỗi:
  - Không cần hard error.
- Ví dụ:
  - Balance adjustment, transfer leg, opening balance correction.
- Nguồn cảm hứng:
  - Money Lover transfer/adjust balance có exclude from report.

### 4.3 Ràng buộc số dư tài khoản

#### TXN-029 — Kiểm tra đủ số dư cho expense/transfer/loan/goal withdrawal theo policy ví
- Điều kiện:
  - Transaction làm giảm số dư ví.
- Hành động:
  - Nếu ví không cho âm:
    - chặn khi `availableBalance < requiredAmount`.
  - Nếu ví dạng credit/debt:
    - áp dụng credit limit riêng.
- Thông báo lỗi:
  - `Số dư không đủ để thực hiện giao dịch.`
- Ví dụ:
  - Ví tiền mặt `200.000 VND` không được chi `500.000 VND`.
- Nguồn cảm hứng:
  - Logic ví điện tử và app tài chính thực tế.

#### TXN-030 — Chuyển tiền nội bộ không được chuyển cho chính ví đó
- Điều kiện:
  - `fromWalletId == toWalletId`.
- Hành động:
  - Từ chối.
- Thông báo lỗi:
  - `Ví nguồn và ví đích phải khác nhau.`
- Ví dụ:
  - Không cho chuyển `100.000 VND` từ `Ví Momo` sang chính `Ví Momo`.
- Nguồn cảm hứng:
  - Ràng buộc transfer thực tế và bug phổ biến.

#### TXN-031 — Currency của wallet không nên đổi sau khi đã phát sinh transaction
- Điều kiện:
  - User đổi currency của ví đã có transaction.
- Hành động:
  - Từ chối.
  - Khuyến nghị tạo ví mới nếu muốn dùng tiền tệ khác.
- Thông báo lỗi:
  - `Không thể đổi tiền tệ của ví đã có giao dịch.`
- Ví dụ:
  - Ví đã có lịch sử VND không được đổi sang USD.
- Nguồn cảm hứng:
  - Spendee không cho đổi main wallet currency sau khi đã có transaction.

### 4.4 Chống trùng giao dịch

#### TXN-032 — Chống duplicate bằng fingerprint nghiệp vụ + idempotency key
- Điều kiện:
  - Tạo transaction từ UI/import/sync/cron.
- Hành động:
  - Tạo fingerprint tối thiểu từ:
    - `userId`
    - `walletId`
    - `type`
    - `amount`
    - `occurredAt`
    - `payee/merchant`
    - `sourceRef`
  - Với recurring/cron phải có `occurrenceId`.
  - Với import/sync phải có `sourceTransactionId` hoặc mã tham chiếu tương đương.
- Thông báo lỗi:
  - `Giao dịch có dấu hiệu trùng lặp.`
- Ví dụ:
  - Mobile offline sync 2 lần không được tạo hai hóa đơn điện giống hệt nhau.
- Nguồn cảm hứng:
  - Wallet by BudgetBakers cảnh báo duplicate planned payments khi nhiều thiết bị offline.

#### TXN-033 — Duplicate soft warning và hard block cần tách riêng
- Điều kiện:
  - Fingerprint gần giống nhưng không chắc chắn 100%.
- Hành động:
  - Nếu giống tuyệt đối + cùng sourceRef => hard block.
  - Nếu chỉ giống amount/date/category trong khoảng ngắn => soft warning để user xác nhận.
- Thông báo lỗi:
  - Soft warning: `Có thể đây là giao dịch đã tồn tại. Bạn có muốn tiếp tục không?`
  - Hard block: `Giao dịch trùng lặp đã bị từ chối.`
- Ví dụ:
  - Hai ly cà phê `45.000 VND` cùng ngày có thể chỉ warning, nhưng cùng `sourceTransactionId` thì block.
- Nguồn cảm hứng:
  - Thực tế import CSV + multi-device sync.

## 5. Quy tắc giao dịch định kỳ

### 5.1 Điều kiện kích hoạt

#### TXN-034 — Cron chỉ kích hoạt occurrence khi vượt qua checkpoint thời gian hợp lệ
- Điều kiện:
  - Job scheduler chạy.
- Hành động:
  - Một occurrence chỉ được materialize 1 lần cho mỗi `scheduleId + dueDate`.
  - Nếu tới giờ chạy nhưng chưa đủ điều kiện xác thực nội bộ/nguồn tiền/chế độ xác nhận, tạo `PENDING` hoặc defer theo policy.
- Thông báo lỗi:
  - `Không thể kích hoạt lịch định kỳ cho kỳ hiện tại.`
- Ví dụ:
  - Khoản `tuần` chỉ được sinh 1 occurrence cho tuần đó, dù cron chạy nhiều lần.
- Nguồn cảm hứng:
  - Money Lover recurring/bills.
  - Wallet planned payments.

#### TXN-035 — Nếu start date trùng ngày tạo, mặc định first occurrence là chu kỳ kế tiếp đối với recurring
- Điều kiện:
  - User tạo recurring monthly/yearly với start date = today.
- Hành động:
  - Với recurring template, first generated occurrence mặc định là chu kỳ kế tiếp.
  - Nếu user muốn ghi nhận kỳ hiện tại, phải tạo transaction hiện tại riêng hoặc chọn `Create first occurrence now`.
- Thông báo lỗi:
  - Không cần hard error; đây là rule khởi tạo.
- Ví dụ:
  - Tạo recurring bill ngày `12/08`, lặp hàng tháng => kỳ đầu là `12/09`.
- Nguồn cảm hứng:
  - Money Lover recurring transactions và bills đều theo next cycle.

### 5.2 Quy tắc sửa / hủy

#### TXN-036 — Sửa recurring template chỉ ảnh hưởng tương lai, không rewrite completed history
- Điều kiện:
  - User sửa amount/category/date của schedule.
- Hành động:
  - Completed occurrence giữ nguyên.
  - Chỉ occurrence tương lai chưa execute mới đổi theo template mới.
- Thông báo lỗi:
  - `Lịch đã phát sinh giao dịch hoàn tất; chỉ có thể áp dụng thay đổi cho các kỳ tương lai.`
- Ví dụ:
  - Tiền thuê nhà từ `8.000.000` tăng lên `8.500.000` từ tháng sau, không sửa các tháng trước.
- Nguồn cảm hứng:
  - Logic recurring/bill thực tế ở Spendee, Money Lover, Wallet.

#### TXN-037 — Hỗ trợ cancel toàn lịch hoặc skip một kỳ
- Điều kiện:
  - User không muốn charge kỳ tới hoặc muốn dừng hẳn.
- Hành động:
  - `skipOccurrence(occurrenceId)`
  - `cancelSchedule(scheduleId)`
  - Không xóa completed history.
- Thông báo lỗi:
  - `Không thể hủy lịch đã hoàn tất.`
- Ví dụ:
  - Tháng này được miễn tiền gửi xe => skip 1 kỳ, không cần xóa cả lịch.
- Nguồn cảm hứng:
  - Money Lover recurring/bills.
  - Wallet hỗ trợ edit/delete planned payment template.

### 5.3 Xử lý lỗi, ví dụ không đủ số dư

#### TXN-038 — Nếu auto-charge thất bại vì thiếu tiền, phải chuyển FAILED chứ không tự ghi âm
- Điều kiện:
  - Schedule tới hạn nhưng ví nguồn không đủ tiền.
- Hành động:
  - Tạo occurrence `FAILED`.
  - Ghi `failureReason=INSUFFICIENT_BALANCE`.
  - Không trừ budget thực tế, không sửa số dư.
  - Gửi notification và cho phép retry/reschedule.
- Thông báo lỗi:
  - `Thanh toán định kỳ thất bại do số dư không đủ.`
- Ví dụ:
  - Đến ngày trả góp `1.500.000 VND`, ví chỉ còn `900.000 VND`.
- Nguồn cảm hứng:
  - Logic recurring/autopay nội bộ thực tế.

#### TXN-039 — Execution result phải update đúng vòng đời
- Điều kiện:
  - Có kết quả xử lý từ scheduler, auto-execute job hoặc thao tác xác nhận của người dùng.
- Hành động:
  - `PROCESSING -> SUCCESS -> COMPLETED`
  - `PROCESSING -> FAIL -> FAILED`
  - Không được bỏ qua intermediate status nếu flow nội bộ có bước xử lý trung gian.
- Thông báo lỗi:
  - `Trạng thái xử lý không hợp lệ.`
- Ví dụ:
  - Job tạo kỳ thanh toán chạy xong trả `PROCESSING`, sau đó `SUCCESS` và occurrence được chốt `COMPLETED`.
- Nguồn cảm hứng:
  - Pattern xử lý bất đồng bộ phổ biến ở scheduler và background job.

## 6. Trường hợp biên và tình huống đặc biệt

### 6.1 Xử lý múi giờ

#### TXN-040 — So sánh ngày theo timezone business, lưu timestamp theo UTC
- Điều kiện:
  - Validate future/past/period boundary.
- Hành động:
  - Input user date xử lý theo `Asia/Ho_Chi_Minh`.
  - DB lưu `ISO8601 UTC`.
  - Report month/year cắt theo business timezone, không theo UTC raw.
- Thông báo lỗi:
  - `Không thể xác định ngày giao dịch theo múi giờ cấu hình.`
- Ví dụ:
  - 23:30 UTC ngày 30/04 thực chất là sáng 01/05 ở VN.
- Nguồn cảm hứng:
  - YNAB API dùng date chuẩn hóa.
  - Best practice lưu timestamp bằng ISO8601 UTC.

### 6.2 Giao dịch cuối tháng / cuối năm

#### TXN-041 — Month-end/year-end phải khóa period boundary rõ ràng
- Điều kiện:
  - Report/budget/recurring đi qua ranh giới tháng, quý, năm.
- Hành động:
  - Budget reset theo `periodStart/periodEnd`.
  - Scheduled yearly bill phải carry đúng year boundary.
  - Transfer/report cuối kỳ không được double count giữa 2 tháng.
- Thông báo lỗi:
  - `Không thể tính kỳ ngân sách do mốc thời gian không hợp lệ.`
- Ví dụ:
  - Budget tháng 04 kết thúc `30/04 23:59:59` giờ VN, không nuốt giao dịch `01/05 00:01`.
- Nguồn cảm hứng:
  - Money Lover, Spendee, YNAB đều dùng kỳ tuần/tháng/quý/năm rõ ràng.

### 6.3 Xử lý năm nhuận

#### TXN-042 — Lịch 29/02 phải có fallback rõ ràng ở năm không nhuận
- Điều kiện:
  - Schedule yearly đặt ngày `29/02`.
- Hành động:
  - Cho phép user chọn:
    - `run_on_28_feb`
    - `run_on_1_mar`
    - `skip_non_leap_year`
  - Nếu không có lựa chọn, mặc định `run_on_28_feb`.
- Thông báo lỗi:
  - `Lịch ngày 29/02 cần quy tắc xử lý cho năm không nhuận.`
- Ví dụ:
  - Mục tiêu bảo hiểm đến hạn `29/02/2028`; năm 2029 chạy `28/02/2029`.
- Nguồn cảm hứng:
  - Đề xuất triển khai dựa trên recurring logic thực tế.

### 6.4 Người dùng xóa ngân sách nhưng vẫn còn giao dịch định kỳ đang hoạt động

#### TXN-043 — Xóa budget không được làm mất recurring transaction history
- Điều kiện:
  - Budget bị xóa nhưng còn template recurring đang active.
- Hành động:
  - Không cascade-delete occurrence đã hoàn tất.
  - Với future schedule:
    - hoặc chuyển `budgetId = null` và giữ `categorySnapshot`
    - hoặc ép user chọn `relink`/`cancel schedule` trước khi xóa budget
  - Khuyến nghị triển khai an toàn:
    - block delete nếu còn active schedule linked, yêu cầu xử lý tường minh.
- Thông báo lỗi:
  - `Budget đang gắn với lịch giao dịch định kỳ. Hãy huỷ hoặc chuyển liên kết trước khi xóa.`
- Ví dụ:
  - Xóa budget `Tiền điện` nhưng lịch auto-charge tiền điện tháng sau vẫn còn.
- Nguồn cảm hứng:
  - Wallet/Money Lover/Spendee đều tách budget với transaction history; thực tế sản phẩm nên tránh cascade ngầm.

### 6.5 Trường hợp biên của chuyển tiền và đối soát

#### TXN-044 — Transfer phải mặc định loại khỏi income/expense report
- Điều kiện:
  - Transaction group là internal transfer.
- Hành động:
  - Không tính transfer vào `income`, `expense`, `budget spent`, `cashflow insight` trừ khi user bật explicitly.
- Thông báo lỗi:
  - Không cần hard error.
- Ví dụ:
  - Chuyển `10.000.000 VND` từ `VCB` sang `Tiền mặt` không được làm doanh thu tăng `10.000.000`.
- Nguồn cảm hứng:
  - Money Lover transfer transactions automatically excluded from report.

#### TXN-045 — Transfer fee được hạch toán riêng như expense thật
- Điều kiện:
  - Transfer có phí ATM/chuyển khoản.
- Hành động:
  - Sinh:
    - transfer out
    - transfer in
    - fee expense
  - Fee được tính vào expense/report/budget nếu không excluded.
- Thông báo lỗi:
  - `Không thể ghi nhận phí chuyển tiền do thiếu ví hoặc danh mục phí.`
- Ví dụ:
  - Rút `2.000.000 VND` từ ATM, phí `3.300 VND`.
- Nguồn cảm hứng:
  - Money Lover transfer fee tạo 3 transactions.

#### TXN-046 — Balance reconciliation không được tự ý xoá transaction cũ
- Điều kiện:
  - User dùng reconcile/adjust balance.
- Hành động:
  - Tạo adjustment transaction mới.
  - Không auto-delete transaction lịch sử.
- Thông báo lỗi:
  - `Điều chỉnh số dư chỉ được phép tạo bút toán điều chỉnh mới.`
- Ví dụ:
  - Chênh lệch cuối tháng xử lý bằng adjustment, không xóa ngầm 5 giao dịch cũ.
- Nguồn cảm hứng:
  - Money Lover Adjust Balance.

## 7. Bảng tóm tắt quy tắc nghiệp vụ

| Mã quy tắc | Mô tả quy tắc | Loại ràng buộc | Được phép / Bị cấm |
|------------|----------------|----------------|---------------------|
| TXN-001 | Chỉ tạo giao dịch trên ví đang hoạt động | Ownership / State | Allowed có điều kiện |
| TXN-002 | Giao dịch thủ công phải có đủ trường tối thiểu | Required field | Mandatory |
| TXN-003 | Pending/imported transaction không được sửa như giao dịch completed | Status immutability | Forbidden |
| TXN-004 | Transfer không đi qua form thu/chi chung | Flow control | Mandatory |
| TXN-005 | Không sửa trực tiếp balance, phải qua adjustment | Ledger integrity | Forbidden |
| TXN-006 | Tách recurring template khỏi executed transaction | Data model | Mandatory |
| TXN-007 | Template recurring phải có metadata lịch đầy đủ | Scheduling | Mandatory |
| TXN-008 | Auto-categorization chỉ là gợi ý | Categorization | Allowed có điều kiện |
| TXN-009 | Không tạo manual completed transaction ở tương lai | Date validation | Forbidden |
| TXN-010 | Chỉ một số nhóm ngoại lệ được tạo future item | Future exception | Allowed có điều kiện |
| TXN-011 | Future item phải ở SCHEDULED/PENDING | Status lifecycle | Mandatory |
| TXN-012 | Giao dịch quá khứ không trước ngày mở ví | Date boundary | Allowed có điều kiện |
| TXN-013 | Kỳ đã khóa sổ không được sửa thẳng | Period close | Forbidden / Controlled |
| TXN-014 | Hôm nay validate theo timezone nghiệp vụ | Timezone | Mandatory |
| TXN-015 | Ngày lặp không tồn tại phải có strategy rõ ràng | Recurrence edge case | Mandatory |
| TXN-016 | Recurring phải có until-date/count/forever rõ ràng | Scheduling scope | Mandatory |
| TXN-017 | Future occurrence ảo không sửa trực tiếp ở list | UX / State | Forbidden |
| TXN-018 | Pending chưa được tính như completed | Status control | Mandatory |
| TXN-019 | Budget là lớp theo dõi, không phải ledger | Modeling | Mandatory |
| TXN-020 | Budget có thể sinh recurring template cho fixed costs | Automation | Allowed có điều kiện |
| TXN-021 | Template chi cố định phải chụp snapshot category/payee | Auditability | Mandatory |
| TXN-022 | Hỗ trợ cadence chuẩn và custom | Scheduling | Mandatory |
| TXN-023 | Đến hạn mới materialize occurrence | Execution timing | Mandatory |
| TXN-024 | Chỉ completed transaction mới tính vào budget | Budget accounting | Mandatory |
| TXN-025 | Amount phải dương và trong ngưỡng an toàn | Amount validation | Mandatory |
| TXN-026 | Giao dịch đa tiền tệ phải lưu exchange metadata | FX audit | Mandatory |
| TXN-027 | Category phải đúng type giao dịch | Category validation | Mandatory |
| TXN-028 | Exclude-from-report là cờ nghiệp vụ, không phải xóa dữ liệu | Reporting | Allowed có điều kiện |
| TXN-029 | Expense/transfer/goal withdrawal phải qua check số dư | Balance validation | Mandatory |
| TXN-030 | Cấm chuyển tiền cho chính ví nguồn | Transfer validation | Forbidden |
| TXN-031 | Không đổi currency ví sau khi đã có transaction | Wallet integrity | Forbidden |
| TXN-032 | Dùng fingerprint/idempotency để chống duplicate | Duplicate prevention | Mandatory |
| TXN-033 | Tách soft warning và hard block cho duplicate | Duplicate handling | Mandatory |
| TXN-034 | Occurrence chỉ được trigger một lần cho mỗi kỳ | Scheduler idempotency | Mandatory |
| TXN-035 | Recurring start-date trùng hôm nay mặc định chạy từ kỳ sau | Recurrence semantics | Allowed có điều kiện |
| TXN-036 | Sửa template chỉ áp dụng cho tương lai | History immutability | Mandatory |
| TXN-037 | Hỗ trợ cancel toàn lịch hoặc skip một kỳ | Schedule management | Allowed |
| TXN-038 | Thiếu tiền thì FAILED, không ghi âm lặng lẽ | Failure handling | Mandatory |
| TXN-039 | Execution result phải map đúng lifecycle | Execution state | Mandatory |
| TXN-040 | Store UTC, validate/report theo local timezone | Timezone | Mandatory |
| TXN-041 | Kỳ tháng/quý/năm phải chốt biên rõ ràng | Period boundary | Mandatory |
| TXN-042 | 29/02 phải có fallback cho năm không nhuận | Leap year | Mandatory |
| TXN-043 | Xóa budget không cascade xóa recurring history | Referential integrity | Forbidden |
| TXN-044 | Transfer mặc định loại khỏi income/expense report | Reporting integrity | Mandatory |
| TXN-045 | Transfer fee hạch toán thành expense thật | Transfer accounting | Mandatory |
| TXN-046 | Reconcile chỉ tạo adjustment mới, không xóa lịch sử | Ledger integrity | Mandatory |

## 8. Phụ lục triển khai Backend / MongoDB Transaction Semantics

### SYS-001 — Các thao tác nhiều collection phải dùng MongoDB multi-document transaction
- Áp dụng cho:
  - internal transfer
  - delete transaction + refund wallet
  - goal deposit/withdraw + cập nhật goal balance
  - schedule execution + wallet ledger + execution log
- Lý do:
  - Đây là các thay đổi nhiều document và phải giữ ACID.
- Nguồn:
  - MongoDB Node Driver Transactions guide.
  - MongoDB Transactions / Production Considerations.

### SYS-002 — Dùng `withTransaction()` hoặc `startSession()` + `startTransaction()` nhất quán
- Khuyến nghị:
  - Dịch vụ nghiệp vụ nên gom vào service layer và bọc trong 1 transaction callback.
  - Chỉ `commit` sau khi tất cả write thành công.
  - Nếu có 1 bước fail, `abort` toàn bộ.
- Thông báo lỗi nghiệp vụ trả ra:
  - `Không thể hoàn tất giao dịch. Dữ liệu đã được hoàn tác an toàn.`

### SYS-003 — Không chạy parallel operations trong cùng một transaction session
- Hành động:
  - Không `Promise.all()` nhiều write dùng chung một session trong cùng transaction callback.
  - Chạy tuần tự hoặc dùng bulk operation được hỗ trợ rõ ràng.
- Lý do:
  - Giảm lỗi transaction/collision/catalog change và bám sát hướng dẫn MongoDB.
- Nguồn:
  - MongoDB docs: parallel operations trong transaction là vùng cần tránh/không được hỗ trợ ở nhiều driver guide và transaction operation considerations.

### SYS-004 — Transfer phải có `transferGroupId` hoặc `idempotencyKey`
- Hành động:
  - Một lần transfer sinh:
    - outflow leg
    - inflow leg
    - optional fee leg
  - Tất cả cùng `transferGroupId`.
  - Delete một leg phải lookup group và reverse cả nhóm.
- Thông báo lỗi:
  - `Không thể xác định nhóm chuyển tiền để hoàn tác.`

### SYS-005 — Recurring execution phải có `occurrenceId` duy nhất
- Hành động:
  - Mỗi kỳ sinh một `occurrenceId = scheduleId + dueDate`.
  - Tạo unique index để cron chạy lặp không sinh trùng.
- Thông báo lỗi:
  - `Kỳ giao dịch đã được xử lý trước đó.`

### SYS-006 — Trước khi transaction ghi vào collection mới, collection/index phải sẵn sàng
- Hành động:
  - Với môi trường test hoặc Mongo version cũ, nên pre-create collection/index trước khi chạy transaction phức tạp.
- Lý do:
  - Tránh lỗi tạo collection/index trong lúc transaction đang active.

### SYS-007 — Có retry policy cho transient commit error
- Hành động:
  - Retry toàn transaction khi gặp `TransientTransactionError`.
  - Retry commit khi gặp `UnknownTransactionCommitResult`.
  - Log correlation ID cho mỗi lần thử.
- Thông báo lỗi cuối cùng:
  - `Giao dịch chưa thể xác nhận hoàn tất. Vui lòng thử lại hoặc kiểm tra trạng thái sau.`

### SYS-008 — Ledger reconciliation job là bắt buộc khi hệ thống đã có dữ liệu cũ
- Hành động:
  - Job định kỳ so sánh:
    - `wallet.balance`
    - `wallet.initialBalance + sum(transaction deltas)`
  - So sánh:
    - `goal.currentAmount`
    - `sum(goal deposits) - sum(goal withdraws)`
  - So sánh:
    - `wallet.hasTransactions`
    - `count(transactions by wallet) > 0`
- Kết quả:
  - Flag anomaly, không auto-fix nếu chưa có policy.

## 9. Nguồn tham khảo chính thức

### Các ứng dụng theo dõi tài chính cá nhân
- Money Lover homepage: https://moneylover.me/
- Money Lover VI feature page: https://moneylover.me/vi/
- Money Lover linked wallet: https://linked-wallet.moneylover.me/
- Money Lover Support — Create/Edit/Delete Transactions: https://moneylover.zendesk.com/hc/en-us/articles/35483252404889-Create-edit-and-delete-transactions
- Money Lover Support — Transfer money between wallets: https://moneylover.zendesk.com/hc/en-us/articles/900000358523-Transfer-money-between-wallets
- Money Lover Support — Adjust wallet's balance: https://moneylover.zendesk.com/hc/en-us/articles/35569781199001-Adjust-wallet-s-balance
- Money Lover Support — Recurring transactions: https://moneylover.zendesk.com/hc/en-us/articles/36097569751833-Recurring-transactions-Definition-and-Usage
- Money Lover Support — Bills: https://moneylover.zendesk.com/hc/en-us/articles/36058137621145-Bills-Definition-and-usage
- Money Lover Support — Budgets: https://moneylover.zendesk.com/hc/en-us/articles/34300604750617-Budget-Definition-and-Usage
- Spendee Scheduled Transactions: https://help.spendee.com/article/229-scheduled-transactions
- Spendee Pending Transactions: https://help.spendee.com/article/180-pending-transactions
- Spendee Budgets: https://help.spendee.com/article/131-budget-my-money
- Spendee Automatic Categorization: https://help.spendee.com/article/179-automatic-categorization
- Spendee Currency Change: https://help.spendee.com/article/242-how-to-change-currency
- YNAB API: https://api.ynab.com/
- YNAB Targets article: https://www.ynab.com/blog/ynab-targets
- YNAB Pending Transactions article: https://www.ynab.com/blog/pending-transactions-have-arrived
- Mint feature page: https://mint.intuit.com/?lang=en
- Mint Bill Reminders press release: https://investors.intuit.com/news-events/press-releases/detail/827/avoid-late-and-overdraft-fees-with-mint-coms-new-bill-reminder-feature
- Wallet by BudgetBakers — Planned Payments: https://support.budgetbakers.com/hc/en-us/articles/7149523920786-Setup-Planned-Payments
- Wallet by BudgetBakers — Planned Payments feature page: https://new.budgetbakers.com/en/products/wallet/features/planned-payments/

### Các ứng dụng phổ biến tại thị trường Việt Nam
- MISA MoneyKeeper homepage: https://sothuchi.misa.vn/
- MISA MoneyKeeper dự thu/dự chi article: https://moneykeeper.misa.vn/mach-ban-5-cach-su-dung-so-thu-chi-misa-huu-ich-nhat/
- MISA MoneyKeeper terms: https://moneykeeper.misa.vn/term-of-use/
- Finhay product overview: https://www.finhay.com.vn/en/
- Finhay tích lũy tự động article: https://www.finhay.com.vn/tich-luy-2026-huong-dan-tiet-kiem-dau-tu-tu-dong
- Finhay app/investment overview: https://www.finhay.com.vn/ung-dung-finhay

### Tham chiếu hành vi ngoài phạm vi trực tiếp của ứng dụng
- Các nguồn dưới đây chỉ dùng để tham chiếu cách đặt lịch, trạng thái xử lý và lifecycle giao dịch trong sản phẩm tài chính số. Chúng không hàm ý dự án này sẽ tích hợp trực tiếp với ngân hàng thật.
- Techcombank scheduled transfer feature: https://techcombank.com/en/information/updates/launching-the-schedule-money-transfer-feature-on-techcombank-mobile
- Techcombank help center: https://techcombank.com/en/help-support
- VCB Digibank FAQ: https://digibankm5.vietcombank.com.vn/get_file/ibomni/html/faq_uiux/index.html?theme=theme-mass
- VCB Digibank transfer limits PDF: https://www.vietcombank.com.vn/-/media/Project/VCB-Sites/VCB/KHCN/Bieu-mau-Bieu-phi-KHCN/Bieu-mau/Ngan-hang-so/VCB-Digibank/TABLE-OF-STANDARD-TRANSACTION-LIMITS-ON-VCB-DIGIBANK-FOR-INDIVIDUAL-CUSTOMERS.pdf
- VCB suspicious recipient alert: https://www.vietcombank.com.vn/en/Personal/Truy-cap-nhanh/Tin-noi-bat/Articles/2025/06/30/updated-feature-VCB-digibank
- MBBank auto-debit API: https://integration-mini-app.mbbank.com.vn/docs/home/apispec/autodebit/auto-debit-get-info/

### Tài liệu triển khai MongoDB transaction
- MongoDB Node Driver Transactions guide: https://www.mongodb.com/docs/drivers/node/v6.x/crud/transactions/
- MongoDB Convenient Transaction API: https://www.mongodb.com/docs/drivers/node/current/crud/transactions/transaction-conv/
- MongoDB Transactions and Operations: https://www.mongodb.com/docs/manual/core/transactions-operations/
- MongoDB Production Considerations: https://www.mongodb.com/docs/current/core/transactions-production-consideration/
