# Nhật ký rà soát logic nghiệp vụ

## 2026-04-24 00:00 Bản ghi rà soát ban đầu

### Phạm vi

- Rà soát logic nghiệp vụ trên các phần auth, ví, giao dịch, ngân sách, mục tiêu và chuyển tiền nội bộ.
- Đối chiếu các bất biến ở backend với trạng thái dữ liệu thật qua Mongo MCP.
- Bổ sung kiểm thử tự động cho các quy tắc sổ cái có rủi ro cao và hành vi rollback giao dịch.

### Phát hiện ban đầu từ việc đọc mã nguồn

- Backend hiện chưa có bộ kiểm thử tự động đủ ý nghĩa cho nghiệp vụ ví và giao dịch.
- `be/src/controllers/transaction.controller.ts` đang trộn validate, thay đổi sổ cái và trả response trong cùng một controller, khiến các bất biến khó kiểm thử và dễ hồi quy.
- `be/src/controllers/wallet.controller.ts` vẫn cho phép cập nhật trực tiếp số dư ví, có thể bỏ qua sổ cái giao dịch và làm sai lịch sử số dư.
- Chuyển tiền nội bộ hiện được tạo ở client dưới dạng hai giao dịch thường tách rời, nên luồng này không có tính nguyên tử và có thể để lại dữ liệu lệch một phía nếu một request lỗi hoặc một vế bị xóa sau đó.
- Các phần tổng hợp hiện vẫn tính các vế chuyển tiền như thu/chi bình thường, làm méo các chỉ số kiểu cashflow.
- Số tiền của mục tiêu có thể bị sửa trực tiếp trong khi transaction controller cũng hỗ trợ giao dịch gắn với mục tiêu, tạo ra hai nguồn sự thật cạnh tranh cho `goal.currentAmount`.

### Phát hiện ban đầu từ Mongo MCP

- Có các bản ghi giao dịch mang ngày trong tương lai so với ngày rà soát hiện tại.
- Có ít nhất một ví có `hasTransactions` là `false` dù thực tế vẫn có giao dịch liên quan.
- Có ít nhất một ví có `balance` lưu trong DB không khớp với số dư suy ra từ `initialBalance` cộng lịch sử giao dịch.
- Có các giá trị số tiền giao dịch và số dư ví lớn bất thường, cho thấy backend đang thiếu validate giới hạn amount.
- Các bản ghi chuyển tiền hiện hữu đang được lưu như các dòng `INCOME` và `EXPENSE` thường với category `Transfer`, xác nhận rằng nghiệp vụ chuyển tiền chưa được mô hình hóa như một thao tác nguyên tử bậc một.

### Tham chiếu nghiệp vụ thực tế cần áp dụng

- Các ứng dụng quản lý tài chính cá nhân thường xem chuyển tiền là luồng dịch chuyển số dư trung tính giữa các tài khoản, không phải sự kiện thu/chi trong báo cáo.
- Các hoạt động mang ngày tương lai thường được mô hình hóa thành giao dịch lên lịch hoặc định kỳ, không phải bút toán đã ghi sổ.
- Các luồng MongoDB transaction nhiều document nên thay đổi mọi document liên quan trong cùng một transaction boundary và chỉ commit sau khi tất cả thao tác ghi thành công.

### Hướng xử lý tiếp theo

- Tạo các helper dùng chung ở backend cho validate amount và quy tắc sổ cái.
- Thêm luồng chuyển tiền nội bộ riêng ở backend để commit cả hai vế một cách nguyên tử.
- Làm lại logic xóa và cập nhật đối với giao dịch gắn cặp chuyển tiền.
- Thêm test backend cho các trường hợp commit/rollback và đối soát trạng thái ví.
- Tiếp tục bổ sung các bản ghi mới bên dưới sau mỗi đợt triển khai và kiểm thử.

## 2026-04-24 01:00 Bản ghi triển khai

### Những gì đã thay đổi

- Thêm `be/src/utils/transaction-rules.ts` để gom chung kiểm tra ngày giao dịch, giới hạn tiền nguyên, nhận diện chuyển tiền và validate số dư an toàn cho sổ cái.
- Làm lại `be/src/controllers/transaction.controller.ts` để các luồng tạo, sửa, xóa, sao kê, tổng hợp và chuyển tiền đều đi theo cùng một bộ quy tắc nghiệp vụ.
- Thêm `POST /api/transactions/transfer` làm endpoint chuyển tiền nội bộ chuyên biệt để cả hai vế được tạo trong một transaction DB thay vì hai request từ client.
- Thêm metadata cho chuyển tiền trong `be/src/models/Transaction.ts` để các cặp chuyển tiền mới có thể được liên kết và xóa theo tính nguyên tử.
- Cập nhật `be/src/controllers/wallet.controller.ts` để từ chối chỉnh sửa trực tiếp số dư ví từ form ví.
- Cập nhật `be/src/controllers/user.controller.ts` và phần tính cashflow ở frontend để các dòng `Transfer` không còn làm phồng số thu/chi.
- Cập nhật luồng chuyển ví ở frontend để gọi endpoint chuyển tiền nguyên tử mới.
- Thêm guard ở frontend để các dòng chuyển tiền và các loại giao dịch không chuẩn không bị sửa bằng modal giao dịch chung.
- Giới hạn việc parse số ở client về `Number.MAX_SAFE_INTEGER` để giảm rủi ro nhập nhầm giá trị quá lớn.

### Kiểm thử tự động đã thêm

- Thêm `be/tests/transaction-controller.test.js`.
- Bao phủ các tình huống sau:
- Giao dịch có ngày tương lai bị từ chối và rollback sạch.
- Amount quá lớn bị từ chối.
- Chuyển tiền nội bộ tạo hai dòng liên kết một cách nguyên tử và không đi vào phần tổng hợp cashflow.
- Xóa một vế chuyển tiền sẽ xóa cả cặp và hoàn lại đúng số dư cho hai ví.
- Xóa giao dịch thường cuối cùng sẽ đặt lại `wallet.hasTransactions`.
- Cập nhật giao dịch sẽ hủy sạch nếu ví đích không còn đủ điều kiện cho amount mới.
- Cập nhật ví từ chối sửa trực tiếp số dư.

### Xác minh

- `be`: `npm run build` đã chạy thành công.
- `be`: `npm test` đã chạy thành công với `7/7` test xanh.
- `fe`: `npm run build` đã chạy thành công.

### Phát hiện trên dữ liệu thật vẫn còn hiệu lực

- Mongo MCP vẫn cho thấy các bản ghi cũ có ngày trong tương lai.
- Mongo MCP vẫn cho thấy ít nhất một ví có cờ `hasTransactions` bị cũ.
- Mongo MCP vẫn cho thấy ít nhất một ví có số dư lưu trữ không khớp với sổ cái tái dựng.
- Đây là các vấn đề dữ liệu có sẵn từ trước; mã mới chỉ chặn việc tạo thêm các kiểu lỗi tương tự, chưa có migration hay job đối soát để sửa dữ liệu production cũ.

### Rủi ro còn lại / việc tiếp theo

- Các dòng chuyển tiền cũ sinh ra trước khi có `transferGroupId` vẫn phải dựa vào heuristic khi xóa, nên vẫn đáng làm thêm một script đối soát chuyên biệt.
- Mục tiêu vẫn còn hai nguồn sự thật trong sản phẩm: chỉnh trực tiếp `currentAmount` và giao dịch gắn mục tiêu. Phần này cần một quyết định follow-up và kế hoạch test riêng.
- Tên category của ngân sách vẫn là free-text, nên sai khác chuẩn hóa tên vẫn có thể làm giảm độ chính xác của báo cáo khi tên ngân sách và tên category giao dịch lệch nhau.

## 2026-04-24 01:20 Bản ghi bổ sung cho luồng thực thi transaction

### Thay đổi bổ sung

- Loại bỏ các batch ghi dùng `Promise.all()` bên trong Mongo transaction session tại `be/src/controllers/transaction.controller.ts`.
- Chuyển các thao tác ghi đó sang `await` tuần tự để luồng xử lý bám sát hơn với hướng dẫn transaction của MongoDB và tránh lỗi do chạy song song trong cùng session.

### Lý do bổ sung thay đổi này

- Một lần chạy tích hợp trên replica set đã lộ ra lỗi transaction do hành vi collection/catalog trong luồng chuyển tiền.
- Điều này khớp với cảnh báo trong tài liệu MongoDB rằng các thao tác song song bên trong một transaction không được hỗ trợ.

### Xác minh

- Đã chạy lại `be`: `npm test` sau khi đổi sang ghi tuần tự.
- Kết quả vẫn xanh: `7/7` test thành công.

## 2026-04-24 08:40 Bản ghi tài liệu quy tắc nghiệp vụ

### Những gì đã thay đổi

- Hoàn tất tài liệu quy tắc nghiệp vụ theo yêu cầu trong `taskforagent.md`.
- Thêm file riêng `transaction-business-rules.md` để ghi lại bộ quy tắc giao dịch sát với tình huống thực tế của ứng dụng tài chính.
- Cấu trúc tài liệu theo hướng một rulebook có thể triển khai ngay, thay vì chỉ là ghi chú sản phẩm ở mức cao.

### Phạm vi đã bao phủ

- Hoàn thiện các mục `1` đến `7` theo đúng yêu cầu, đồng thời bổ sung:
- Vòng đời trạng thái: `SCHEDULED -> PENDING -> COMPLETED / FAILED / CANCELLED`.
- Ràng buộc thực tế cho giao dịch tương lai và các ngoại lệ được phép cho giao dịch định kỳ, trả góp, nhắc nhở và chuyển tiền đã lên lịch.
- Bộ quy tắc `TXN-001` đến `TXN-046` với điều kiện, hành động, thông báo lỗi, ví dụ và nguồn tham chiếu.
- Phụ lục ngữ nghĩa MongoDB transaction `SYS-001` đến `SYS-008` cho commit boundary, idempotency, retry và việc ghi tuần tự trong session.

### Vì sao điều này quan trọng

- Tạo ra một nguồn tham chiếu duy nhất có thể review trước khi tiếp tục chỉnh sửa code nghiệp vụ.
- Đồng bộ validate backend, hành vi scheduler, quy tắc báo cáo và tính toàn vẹn sổ cái quanh cùng một bộ định nghĩa.
- Giúp việc audit và mở rộng test hồi quy về sau dễ hơn vì mỗi quy tắc đều có mã nhận diện ổn định.

## 2026-04-24 09:05 Bản ghi làm rõ phạm vi tài liệu

### Những gì đã thay đổi

- Cập nhật `transaction-business-rules.md` để nêu rõ dự án này là ứng dụng theo dõi và lập kế hoạch tài chính cá nhân, không phải sản phẩm tích hợp ngân hàng trực tiếp.
- Viết lại một số quy tắc từng mang sắc thái giống sản phẩm ngân hàng, nhất là ở các phần `PENDING`, giao dịch import, thực thi định kỳ, chống trùng và cập nhật vòng đời.
- Giữ các liên kết từ sản phẩm ngân hàng chỉ như tham chiếu hành vi ngoài phạm vi trực tiếp của app, kèm chú thích rõ trong phần nguồn.

### Lý do bổ sung thay đổi này

- Phạm vi sản phẩm là theo dõi chủ động, lập kế hoạch và hỗ trợ ra quyết định cho người dùng.
- Nếu giữ ngôn ngữ mang tính ngân hàng trong các quy tắc lõi, tài liệu có thể vô tình thổi phồng phạm vi triển khai và làm lệch hướng quyết định phát triển sau này.

## 2026-04-24 10:35 Bản ghi triển khai vòng đời giao dịch có kế hoạch

### Những gì đã thay đổi

- Bổ sung hỗ trợ trạng thái giao dịch ở backend và lớp validate: `SCHEDULED`, `PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`.
- Cập nhật logic tạo và sửa giao dịch để chỉ các bản ghi `COMPLETED` mới ảnh hưởng đến số dư ví, mức chi ngân sách, tiến độ mục tiêu và các phần tổng hợp kiểu cashflow.
- Chặn giao dịch thủ công có ngày trong tương lai nếu không được tạo dưới trạng thái `SCHEDULED` hoặc `PENDING`.
- Luồng chuyển tiền nội bộ vẫn là loại thực hiện ngay và tiếp tục được commit dưới trạng thái `COMPLETED`, phù hợp với phạm vi sản phẩm hiện tại.
- Cập nhật UI danh sách giao dịch để người dùng có thể tạo và lọc giao dịch đã lên kế hoạch, nhìn thấy trạng thái giao dịch, và không nhầm chúng là bút toán đã ghi sổ.
- Cập nhật phần tính toán ở dashboard, profile và budgets để bỏ qua các giao dịch chưa hoàn tất khỏi báo cáo thu/chi thực tế.

### Xử lý tương thích ngược

- Các giao dịch lịch sử được tạo trước khi có field `status` sẽ được xem là `COMPLETED` trong các truy vấn liên quan đến báo cáo và sổ cái.
- Cách này tránh làm hỏng số liệu sau khi triển khai ngay cả khi chưa chạy migration dữ liệu rõ ràng.

### Xác minh tự động

- `be`: `npm run build` đã chạy thành công.
- `be`: `npm test` đã chạy thành công với `9/9` test xanh.
- Đã thêm test cho:
- Giao dịch chi tiêu được lên lịch trong tương lai không làm thay đổi số dư ví hay phần tổng hợp cashflow.
- Khi chuyển một giao dịch chi tiêu từ `SCHEDULED` sang `COMPLETED`, phần delta số dư chỉ được áp dụng tại thời điểm hoàn tất.
- `fe`: `npm run build` đã chạy thành công.

### Phần follow-up còn nên làm

- Tiến độ mục tiêu vẫn cần một UI nạp/rút riêng để `goal.currentAmount` có thể được dẫn hoàn toàn từ giao dịch thay vì chỉnh tay.
- Lưu trữ và thực thi recurring template vẫn chưa là một tính năng bậc một hoàn chỉnh; đợt này mới bao phủ giao dịch có kế hoạch an toàn cho sổ cái, chưa phải toàn bộ tự động hóa recurring.

## 2026-04-24 14:20 Bản ghi triển khai liên kết ví - ngân sách

### Những gì đã thay đổi

- Hoàn thiện mô hình `budget -> wallet -> transaction` để ngân sách không còn là lớp độc lập với ví.
- Budget summary ở backend hiện trả thêm `walletName`, `walletCurrency`, `remaining`, `overspent` và `walletSummaries` để frontend có thể render phần tiền reserve trong từng ví.
- Luồng giao dịch ở backend bổ sung kiểm tra `budget` phải thuộc đúng ví và đúng kỳ tháng của giao dịch, kể cả khi giao dịch đang ở trạng thái `SCHEDULED`.
- Màn `Budgets` đã có chọn ví trực tiếp trong form tạo/sửa và mỗi budget card hiển thị ví áp dụng cùng phần đã chi/còn lại gọn hơn trên mobile.
- Màn `Transactions` bỏ luồng chọn category expense cố định; với `EXPENSE` giờ lấy option động từ budget của ví theo đúng tháng giao dịch, còn `INCOME` giữ category nhập tự do.
- Màn `Wallets` hiển thị rõ phần tiền tự do và phần còn reserve cho từng ngân sách bằng thanh phân bổ cùng chip category ngay trong card ví.

### Vì sao điều này quan trọng

- Khi người dùng chọn ví và ngân sách lúc tạo chi tiêu, app có thể trừ tiền đúng nguồn và theo dõi chính xác ngân sách nào đang dùng vào số dư của ví đó.
- Wallet card giờ phản ánh đúng bản chất quan trọng của app tài chính cá nhân: tổng số dư chưa chắc là phần có thể chi tự do, vì một phần đang được giữ cho kế hoạch đã đặt.
- Validate ở backend giúp chặn trường hợp chọn budget sai tháng rồi làm lệch reserve và spent giữa các kỳ.

### Xác minh tự động

- `be`: `npm run build` đã chạy thành công.
- `be`: `npm test` đã chạy thành công với `12/12` test xanh.
- `fe`: `npx tsc --noEmit` đã chạy thành công.
- `fe`: `npm run build` đã chạy thành công.

### Phạm vi test đã thêm / mở rộng

- Thêm test reject khi giao dịch dùng budget không đúng tháng giao dịch dù đang ở trạng thái `SCHEDULED`.
- Giữ nguyên các test trước đó cho tính nguyên tử của transfer, hoàn tiền khi xóa, rollback khi update lỗi và hành vi sổ cái của giao dịch có kế hoạch.

### Phần follow-up còn đáng theo dõi

- Nếu muốn siết nghiệp vụ mạnh hơn nữa, có thể cân nhắc buộc mọi `EXPENSE` thủ công phải gắn `budgetId` thay vì chỉ để frontend dẫn luồng chọn budget.
- Nếu sau này thêm recurring expenses thực sự, phần reserve hiển thị ở ví có thể cần tách thêm lớp `planned reserve` và `actual remaining budget` để người dùng thấy rõ dự báo so với thực chi.

## 2026-04-24 11:02 Bản ghi danh mục thu nhập và rà soát text UI

### Những gì đã thay đổi

- Màn `Transactions` đã đổi luồng `INCOME` từ nhập category tự do sang nhóm mặc định: `Lương`, `Thưởng`, `Thu nhập phụ`, `Khác`.
- Khi sửa giao dịch cũ có category thu nhập tùy chỉnh, form vẫn giữ và hiển thị lại option cũ để không làm mất dữ liệu lịch sử.
- Nếu người dùng chọn `Khác`, ô `Ghi chú` sẽ được làm nổi bật bằng màu cảnh báo nhẹ, placeholder cụ thể hơn và có helper text nhắc mô tả rõ nguồn tiền để tránh mơ hồ dòng tiền.
- Đã rà lại phần text mới thêm ở `Transactions` và `Wallets`; các nhãn ngân sách và thu nhập được giữ ở dạng UTF-8 an toàn, không còn mojibake thật trong `fe/src`.

### Vì sao điều này quan trọng

- Thu nhập giờ có cấu trúc rõ hơn để báo cáo và lọc dễ dùng hơn trên mobile, nhưng vẫn không khóa cứng dữ liệu cũ.
- Nhóm `Khác` vẫn đủ linh hoạt cho app theo dõi cá nhân, đồng thời nhắc người dùng ghi rõ nguồn thu để khi xem lại không bị mất ngữ cảnh.
- Việc kiểm tra encoding giúp tránh tình trạng chữ lỗi sau các đợt cập nhật UI gần đây.

### Xác minh tự động

- `fe`: `npx tsc --noEmit` đã chạy thành công.
- `fe`: `npm run build` đã chạy thành công.

## 2026-04-26 20:27 Bản ghi về điểm vào AI trên mobile và chế độ hiển thị tiền

### Những gì đã thay đổi

- Bổ sung chế độ hiển thị tiền `full / compact` tại `LocaleContext`, `formatters` và màn `Settings`.
- Thanh điều hướng mobile trong `MainLayout` đổi nút giữa thành hành động quick-add thay vì điều hướng trang.
- Thêm composer thêm nhanh cho `Nói / Quét / Hỏi AI / Nhập tay`, đồng thời nối sang `Transactions` bằng query mode để về sau dễ cắm AI OCR hoặc voice.
- `Dashboard` và `Analytics` có thêm phần hero mobile-first với nền linear, các số quan trọng được đẩy lên đầu, còn `PageHeader` dài và nút phụ sẽ bị ẩn trên mobile.
- Thêm tài liệu `docs/ai-rollout-plan.md` để chốt rõ phạm vi AI cho app theo dõi cá nhân, không liên kết với ngân hàng thật.

### Vì sao điều này quan trọng

- Người dùng mobile nhìn thấy thông tin quan trọng sớm hơn mà không phải cuộn quá nhiều.
- Luồng thêm giao dịch trên thanh dưới giờ đúng với kỳ vọng của một app tài chính mobile-first.
- Chế độ tiền rút gọn giúp dashboard, ví và phân tích gọn hơn trên màn hình nhỏ.
- Luồng AI đã được chuẩn bị đúng cấu trúc để backend nối tiếp về sau mà không phá UX hiện tại.

### Xác minh tự động

- `fe`: `npx tsc --noEmit` đã chạy thành công.
- `fe`: `npm run build` đã chạy thành công.

## 2026-04-24 15:05 Bản ghi ổn định import `ConfirmDialog`

### Những gì đã thay đổi

- Export `ConfirmDialog` trực tiếp từ `fe/src/components/ui/dialog.tsx`.
- Giữ `fe/src/components/ui/confirm-dialog.tsx` như một wrapper re-export để tương thích ngược.
- Chuyển các màn đang dùng `ConfirmDialog` sang import từ module `dialog` để tránh phụ thuộc vào một file path riêng có thể bị watcher cache sai.

### Vì sao điều này quan trọng

- Loại bỏ nguyên nhân lỗi `TS2307` nếu dev server hoặc watcher còn giữ trạng thái cũ sau lúc file `confirm-dialog.tsx` từng bị thay thế.
- Ổn định hơn cho cả compile khi phát triển lẫn build production vì `Dialog` và `ConfirmDialog` giờ cùng nằm trong một module gốc.

### Xác minh tự động

- `fe`: `npx tsc --noEmit` đã chạy thành công.
- `fe`: `npm run build` đã chạy thành công.

## 2026-04-24 13:25 Bản ghi nâng cấp UX cho modal form

### Những gì đã thay đổi

- Nâng cấp `Dialog` dùng chung với header có tone nhận diện theo ngữ cảnh, icon riêng, badge trạng thái ngắn và footer bám cuối để nút thao tác dễ chạm hơn trên điện thoại.
- Thêm các block `DialogSection` để form không còn là một cột input dài; các modal chính giờ được chia theo từng nhóm thông tin rõ ràng hơn.
- Áp dụng giao diện mới cho các form ở `Transactions`, `Budgets`, `Goals`, `Wallets`, `DishSuggestions`.
- `ConfirmDialog` cũng được làm lại để popup cảnh báo nhìn khác hẳn modal nhập liệu thường, giảm nhầm thao tác.
- Trong form `Transactions`, dòng hiển thị option ngân sách đổi separator sang `-` để tránh rủi ro lỗi ký tự hiển thị.

### Vì sao điều này quan trọng

- Trên mobile, người dùng dễ quét và hiểu form nhanh hơn vì mỗi nhóm trường có mục đích rõ ràng.
- Header nhận diện theo từng nghiệp vụ giúp giảm cảm giác "modal nào cũng giống nhau", nhất là khi chuyển nhanh giữa ví, giao dịch, ngân sách và mục tiêu.
- Footer bám cuối giúp thao tác lưu hoặc hủy thuận tay hơn với các form dài.

### Xác minh tự động

- `fe`: `npx tsc --noEmit` đã chạy thành công.
- `fe`: `npm run build` đã chạy thành công.
