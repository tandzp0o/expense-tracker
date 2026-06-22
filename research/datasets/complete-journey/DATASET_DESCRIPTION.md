# Complete Journey Dataset Description

File này là mô tả đầy đủ nhất cho bộ dữ liệu Complete Journey trong workspace này. `SOURCE.md` chỉ mô tả nguồn tải về; file này mô tả phạm vi dữ liệu, bảng, cột, quan hệ khóa, thống kê đã profile, các biến đổi đã thực hiện và cách dùng trong đề tài hệ thống gợi ý theo dẫn dắt bầy đàn.

## 1. Nguồn Và Bản Dữ Liệu

- Tên dataset: 84.51° / dunnhumby Complete Journey.
- Package tham chiếu: R package `completejourney`, phát triển bởi Brad Boehmke và Steven M. Mortimer.
- Nguồn package: <https://github.com/bradleyboehmke/completejourney>
- User guide chính thức: <https://bradleyboehmke.github.io/completejourney/articles/completejourney.html>
- Reference chính thức: <https://bradleyboehmke.github.io/completejourney/reference/index.html>
- License package: CC0 theo metadata của package nguồn.
- Ngày tải về workspace: 2026-06-06.

Theo user guide của package, Complete Journey mô tả giao dịch cấp hộ gia đình trong khoảng một năm của 2,469 household mua sắm thường xuyên tại grocery retailer. Một phần household có demographic; các bảng khác mô tả sản phẩm, coupon, campaign và promotion.

## 2. Mục Đích Sử Dụng Trong Dự Án

Dataset này được dùng làm dữ liệu thực nghiệm chính cho hướng nghiên cứu:

- Phân cụm hai tầng:
  - Tầng macro: năng lực tài chính, chủ yếu từ income band và income ước lượng.
  - Tầng micro: hành vi chi tiêu theo tỷ lệ chi tiêu/thu nhập, danh mục chi tiêu, anomaly và trạng thái goal.
- Tìm household-month đóng vai trò leader trong từng cụm.
- Sinh baseline gợi ý cho user cùng cụm dựa trên hành vi của leader.
- Kiểm tra pipeline recommendation hiện tại: feature engineering, clustering, leader selection, forecast và recommendation context.

Dataset gốc là retail/grocery transaction, không phải dữ liệu tài chính cá nhân đầy đủ. Vì vậy khi dùng cho luận văn cần ghi rõ đây là dữ liệu thay thế có mapping sang miền chi tiêu cá nhân.

## 3. Vị Trí File Trong Workspace

Raw data:

```text
research/datasets/complete-journey/raw/
```

CSV đã export, có header row:

```text
research/datasets/complete-journey/processed/csv/
```

Các manifest và report liên quan:

- `MANIFEST.sha256`: checksum SHA-256 của raw files.
- `processed/csv/CSV_MANIFEST.json`: danh sách CSV đã export, số dòng, số cột.
- `processed/csv/DATA_PROFILE.json`: profile thống kê local đã sinh từ CSV.
- `processed/mongo_seed_report.json`: report seed MongoDB.
- `research/notes/complete-journey-mongo-seed-report.md`: báo cáo seed, training và provision login.

Script tái tạo:

- `research/scripts/download_complete_journey.ps1`: tải raw data.
- `research/scripts/export_complete_journey_csv.py`: export `.rds/.rda` sang CSV có header.
- `research/scripts/seed_complete_journey_to_mongo.py`: seed dataset sang MongoDB research DB.
- `be/src/scripts/provisionCompleteJourneyLoginAccounts.ts`: copy dữ liệu sang DB app chính và tạo Firebase Auth users để test web.

## 4. Tổng Quan Các Bảng

| Bảng CSV | Raw source | Dòng | Cột | Vai trò |
| --- | --- | ---: | ---: | --- |
| `transactions.csv` | `transactions.rds` | 1,469,307 | 11 | Line-item giao dịch mua hàng, bảng quan trọng nhất cho hành vi chi tiêu |
| `transactions_sample.csv` | `transactions_sample.rda` | 75,000 | 11 | Bản sample nhỏ của transactions |
| `products.csv` | `products.rda` | 92,331 | 7 | Metadata sản phẩm, dùng để map danh mục |
| `demographics.csv` | `demographics.rda` | 801 | 8 | Metadata hộ gia đình, gồm age, income, household size |
| `campaigns.csv` | `campaigns.rda` | 6,589 | 2 | Household tham gia campaign nào |
| `campaign_descriptions.csv` | `campaign_descriptions.rda` | 27 | 4 | Metadata campaign, gồm loại campaign và thời gian chạy |
| `coupons.csv` | `coupons.rda` | 116,204 | 3 | Coupon, product và campaign liên quan |
| `coupon_redemptions.csv` | `coupon_redemptions.rda` | 2,102 | 4 | Coupon redemption theo household |
| `promotions.csv` | `promotions.rds` | 20,940,529 | 5 | Product placement trong store/mailer theo tuần |
| `promotions_sample.csv` | `promotions_sample.rda` | 360,535 | 5 | Bản sample nhỏ của promotions |

## 5. Quan Hệ Khóa Giữa Các Bảng

| Khóa | Xuất hiện trong | Ý nghĩa |
| --- | --- | --- |
| `household_id` | `transactions`, `demographics`, `campaigns`, `coupon_redemptions` | Định danh hộ gia đình; được map sang `userId`/`uid` trong app |
| `basket_id` | `transactions` | Một lần mua hàng; một basket có thể có nhiều dòng sản phẩm |
| `product_id` | `transactions`, `products`, `coupons`, `promotions` | Định danh sản phẩm |
| `campaign_id` | `campaigns`, `campaign_descriptions`, `coupons`, `coupon_redemptions` | Định danh campaign marketing |
| `coupon_upc` | `coupons`, `coupon_redemptions` | Định danh coupon |
| `store_id` | `transactions`, `promotions` | Định danh cửa hàng |
| `week` | `transactions`, `promotions` | Tuần trong giai đoạn nghiên cứu, giá trị 1 đến 53 |

Quan hệ chính phục vụ mô hình hiện tại:

```text
demographics.household_id
  -> transactions.household_id
  -> products.product_id
```

Các bảng campaign/coupon/promotion có thể dùng cho mở rộng về tác động marketing, nhưng pipeline hiện tại chủ yếu dùng `transactions`, `products` và `demographics`.

## 6. Data Dictionary

### 6.1. `transactions.csv`

Line-item giao dịch mua hàng. Mỗi dòng thường tương ứng một sản phẩm trong một basket.

| Cột | Kiểu quan sát | Mô tả | Dùng trong dự án |
| --- | --- | --- | --- |
| `household_id` | string/id | Định danh household | Map sang `userId`, ví dụ `cj_hh_1848` |
| `store_id` | string/id | Định danh cửa hàng | Chưa dùng trong model hiện tại |
| `basket_id` | string/id | Định danh một lần mua hàng | Có thể dùng để group receipt/session |
| `product_id` | string/id | Định danh sản phẩm | Join sang `products` để lấy category |
| `quantity` | number | Số lượng sản phẩm mua trong dòng đó | Có thể dùng cho basket/item features |
| `sales_value` | number/USD | Giá trị retailer nhận được sau một số điều chỉnh discount/coupon | Map sang amount chi tiêu; hiện quy đổi `* 25,000` sang VND khi seed |
| `retail_disc` | number/USD | Discount từ loyalty card/retailer | Chưa dùng trong model hiện tại |
| `coupon_disc` | number/USD | Discount từ manufacturer coupon | Chưa dùng trong model hiện tại |
| `coupon_match_disc` | number/USD | Discount retailer match coupon | Chưa dùng trong model hiện tại |
| `week` | integer | Tuần giao dịch, 1 đến 53 | Có thể dùng làm time index |
| `transaction_timestamp` | datetime | Thời điểm giao dịch | Dùng để tạo user-month features |

Lưu ý về `sales_value`: theo tài liệu package, đây là số tiền retailer nhận trên dòng bán hàng, không nhất thiết bằng số tiền cuối cùng customer trả nếu có coupon manufacturer reimbursement. Trong seed hiện tại, `sales_value` được dùng làm proxy cho chi tiêu.

Profile local:

- Dòng: 1,469,307.
- Unique households: 2,469.
- Unique stores: 457.
- Unique baskets: 155,848.
- Unique products trong transactions: 68,509.
- Thời gian: từ `2017-01-01 11:53:26` đến `2018-01-01 04:01:20`.
- Week: 1 đến 53.
- Tổng `sales_value`: 4,596,039.58 USD.
- Trung bình `sales_value` mỗi line-item: 3.128 USD.

### 6.2. `demographics.csv`

Metadata household. Bảng này chỉ có cho một phần household.

| Cột | Kiểu quan sát | Mô tả | Dùng trong dự án |
| --- | --- | --- | --- |
| `household_id` | string/id | Định danh household | Join với transactions; map sang user |
| `age` | category | Nhóm tuổi ước lượng | Có thể dùng phân tích mô tả |
| `income` | category | Nhóm thu nhập household | Dùng để ước lượng income tháng cho macro cluster |
| `home_ownership` | category | Tình trạng sở hữu nhà | Chưa dùng trong model hiện tại |
| `marital_status` | category | Tình trạng hôn nhân | Chưa dùng trong model hiện tại |
| `household_size` | category | Số người trong household, có nhóm `5+` | Có thể dùng phân tích mô tả |
| `household_comp` | category | Thành phần household | Có thể dùng phân tích mô tả |
| `kids_count` | category | Số trẻ em, có nhóm `3+` | Có thể dùng phân tích mô tả |

Profile local:

- Dòng/unique households: 801.
- Income phổ biến nhất:
  - `50-74K`: 192 household.
  - `35-49K`: 172 household.
  - `75-99K`: 96 household.
  - `25-34K`: 77 household.
  - `15-24K`: 74 household.
- Age phổ biến nhất:
  - `45-54`: 288 household.
  - `35-44`: 194 household.
  - `25-34`: 142 household.
- Household size phổ biến nhất:
  - `2`: 318 household.
  - `1`: 255 household.
  - `3`: 109 household.

### 6.3. `products.csv`

Metadata sản phẩm để diễn giải hành vi chi tiêu theo nhóm hàng.

| Cột | Kiểu quan sát | Mô tả | Dùng trong dự án |
| --- | --- | --- | --- |
| `product_id` | string/id | Định danh sản phẩm | Join với transactions |
| `manufacturer_id` | string/id | Định danh nhà sản xuất | Chưa dùng |
| `department` | category | Nhóm sản phẩm cấp cao | Dùng map sang category chi tiêu |
| `brand` | category | `Private` hoặc `National` | Có thể dùng phân tích thương hiệu |
| `product_category` | category | Nhóm sản phẩm cấp thấp hơn department | Dùng map sang category chi tiêu |
| `product_type` | category | Nhóm sản phẩm chi tiết nhất | Dùng map sang category chi tiêu |
| `package_size` | string | Kích cỡ gói, có missing | Chưa dùng |

Profile local:

- Dòng/unique products: 92,331.
- Unique departments: 32.
- Brand:
  - `National`: 78,516.
  - `Private`: 13,815.
- Top departments:
  - `GROCERY`: 39,023.
  - `DRUG GM`: 31,540.
  - `PRODUCE`: 3,117.
  - `COSMETICS`: 3,011.
  - `NUTRITION`: 2,914.
  - `MEAT`: 2,542.
  - `MEAT-PCKGD`: 2,427.
  - `DELI`: 2,359.
  - `PASTRY`: 2,149.

### 6.4. `campaigns.csv`

Household tham gia campaign.

| Cột | Mô tả |
| --- | --- |
| `campaign_id` | Định danh campaign, join với `campaign_descriptions`, `coupons`, `coupon_redemptions` |
| `household_id` | Định danh household tham gia campaign |

Profile local:

- Dòng: 6,589.
- Unique campaigns: 27.
- Unique households có campaign: 1,559.

### 6.5. `campaign_descriptions.csv`

Metadata campaign.

| Cột | Mô tả |
| --- | --- |
| `campaign_id` | Định danh campaign |
| `campaign_type` | Loại campaign: Type A, Type B, Type C |
| `start_date` | Ngày bắt đầu |
| `end_date` | Ngày kết thúc |

Profile local:

- Dòng: 27.
- Thời gian campaign: từ `2016-11-14` đến `2018-02-28`.
- Type counts:
  - `Type B`: 17.
  - `Type C`: 6.
  - `Type A`: 4.

### 6.6. `coupons.csv`

Coupon metadata.

| Cột | Mô tả |
| --- | --- |
| `coupon_upc` | Định danh coupon |
| `product_id` | Sản phẩm có thể redeem coupon |
| `campaign_id` | Campaign chứa coupon |

Profile local:

- Dòng: 116,204.
- Unique coupons: 981.
- Unique products liên quan coupon: 41,857.
- Unique campaigns: 27.

### 6.7. `coupon_redemptions.csv`

Coupon redemption theo household.

| Cột | Mô tả |
| --- | --- |
| `household_id` | Household redeem coupon |
| `coupon_upc` | Coupon được redeem |
| `campaign_id` | Campaign liên quan |
| `redemption_date` | Ngày redeem coupon |

Profile local:

- Dòng: 2,102.
- Unique households redeem coupon: 410.
- Unique coupons được redeem: 491.
- Unique campaigns có redemption: 26.

### 6.8. `promotions.csv`

Thông tin product placement trong store/mailer theo tuần. Đây là bảng rất lớn, chủ yếu dùng cho nghiên cứu tác động marketing/promotion.

| Cột | Mô tả |
| --- | --- |
| `product_id` | Sản phẩm được promotion |
| `store_id` | Cửa hàng áp dụng promotion |
| `display_location` | Vị trí display trong cửa hàng |
| `mailer_location` | Vị trí xuất hiện trong mailer/ad |
| `week` | Tuần áp dụng promotion |

Profile local:

- Dòng: 20,940,529.
- Unique products: 59,800.
- Unique stores: 112.
- Week: 1 đến 53.
- Display location phổ biến nhất: `0`, `9`, `5`, `7`, `3`.
- Mailer location phổ biến nhất: `A`, `0`, `D`, `H`, `F`.

### 6.9. Sample Tables

`transactions_sample.csv` và `promotions_sample.csv` là bản sample nhỏ hơn để thử nghiệm nhanh hoặc demo notebook.

| Bảng | Dòng | Cột |
| --- | ---: | ---: |
| `transactions_sample.csv` | 75,000 | 11 |
| `promotions_sample.csv` | 360,535 | 5 |

## 7. Các Biến Đổi Đã Thực Hiện Trong Project

### 7.1. Export CSV

Raw files `.rds/.rda` đã được export sang CSV bằng:

```powershell
python research\scripts\export_complete_journey_csv.py
```

CSV được ghi với:

- `header=True`: có hàng tiêu đề.
- `index=False`: không ghi index pandas.
- `encoding="utf-8-sig"`: Excel trên Windows nhận đúng encoding.

### 7.2. Seed MongoDB Research DB

Database nghiên cứu:

```text
expense-tracker-complete-journey
```

Do Atlas free tier có quota 512 MB, bản seed MongoDB hiện tại dùng toàn bộ 801 household có demographic nhưng giới hạn tối đa 200 expense transaction mỗi household, lấy mẫu trải đều theo thời gian.

Kết quả seed:

| Collection | Count |
| --- | ---: |
| `users` | 801 |
| `wallets` | 801 |
| `goals` | 1,066 |
| `budgets` | 20,041 |
| `transactions` | 169,260 |
| `research_seed_metadata` | 1 |

Trong đó:

- Expense transactions: 159,890.
- Income transactions: 9,370.
- User-month records cho AI: 9,370.

### 7.3. Mapping Sang Schema App

| Complete Journey | App field | Ghi chú |
| --- | --- | --- |
| `household_id` | `User.uid`, `Wallet.userId`, `Transaction.userId` | Format `cj_hh_<household_id>` |
| `sales_value` | `Transaction.amount` | Quy đổi USD sang VND theo tỷ giá seed `25,000` |
| `transaction_timestamp` | `Transaction.date` | Dùng để group theo tháng |
| `department/product_category/product_type` | `Transaction.category` | Map sang nhóm chi tiêu của app |
| `income` | `User.totalIncome` và monthly income transactions | Income band được chuyển sang midpoint ước lượng |
| Không có budget gốc | `Budget` | Budget được sinh theo chi tiêu quan sát |
| Không có goal gốc | `Goal` | Goal được sinh để tạo tín hiệu cho leader score |

### 7.4. Provision Đăng Nhập Web

Đã copy nhóm Complete Journey sang DB app chính:

```text
expense-tracker
```

Đã tạo Firebase Auth users:

- Email format: `cj_hh_<household_id>@completejourney.local`
- UID Firebase: trùng Mongo UID.
- Password mặc định: `123123`.
- Ví dụ đã kiểm tra: `cj_hh_1848@completejourney.local`.

Lý do cần bước này: web login dùng Firebase Auth, sau đó backend dùng Firebase UID để đọc MongoDB. Nếu chỉ có Mongo user trong research DB thì web không đăng nhập được.

## 8. Cách Dùng Cho Mô Hình Hiện Tại

Pipeline hiện tại dùng các collection MongoDB đã seed, không đọc trực tiếp CSV khi training web demo.

Luồng chính:

1. Load `users`, `transactions`, `goals`.
2. Group transaction theo `userId` và tháng (`ym`).
3. Tạo features:
   - `income`
   - `expense`
   - `expense_to_income_ratio`
   - category share theo nhóm chi tiêu
   - `anomaly_count`
   - `target_saving_ratio`
   - `goal_completion_rate`
4. Phân cụm macro bằng:
   - `month_income_feature`
   - `target_saving_ratio`
5. Phân cụm micro trong từng macro bằng:
   - `expense_to_income_ratio`
   - `anomaly_count`
   - `goal_completion_rate`
   - category share
6. Chọn leader trong từng macro/micro cluster bằng `leader_score`.
7. Sinh recommendation context cho user.

Kết quả training đã kiểm tra:

- Monthly feature records: 9,370.
- Macro clusters: 3.
- Leader groups: 9.
- Recommendation mẫu `cj_hh_1`: có leader baseline và forecast bằng `linear_regression`.

## 9. Giới Hạn Và Lưu Ý Khi Viết Luận

Các điểm cần ghi rõ trong luận văn/báo cáo:

- Đây là dữ liệu retail/grocery, không phải dữ liệu tài chính cá nhân đầy đủ như ngân hàng hoặc ví điện tử.
- Chỉ 801/2,469 household có demographic.
- Income là band, không phải số thu nhập chính xác.
- Budget và goal là dữ liệu sinh theo quy tắc seed, không có trong dataset gốc.
- `sales_value` là proxy chi tiêu; theo tài liệu gốc, đây là giá trị retailer nhận được trên line-item.
- Dữ liệu có bias theo frequent grocery shoppers.
- Campaign/coupon/promotion là nguồn mở rộng tốt nhưng chưa phải phần lõi của pipeline hiện tại.
- Seed hiện tại bị giới hạn vì Atlas free tier; full raw CSV vẫn có trong workspace để chạy local hoặc trên cluster lớn hơn.

## 10. Câu Truy Vấn Và Join Hữu Ích

Join transaction với product:

```python
tx = transactions.merge(products, on="product_id", how="left")
```

Join transaction với demographic:

```python
tx_demo = transactions.merge(demographics, on="household_id", how="left")
```

Basket-level aggregation:

```python
baskets = transactions.groupby(["household_id", "basket_id"], as_index=False).agg(
    basket_value=("sales_value", "sum"),
    item_lines=("product_id", "count"),
    unique_products=("product_id", "nunique"),
)
```

User-month aggregation:

```python
transactions["transaction_timestamp"] = pandas.to_datetime(transactions["transaction_timestamp"])
transactions["ym"] = transactions["transaction_timestamp"].dt.to_period("M").astype(str)
monthly = transactions.groupby(["household_id", "ym"], as_index=False).agg(
    expense_usd=("sales_value", "sum"),
    baskets=("basket_id", "nunique"),
    products=("product_id", "nunique"),
)
```

## 11. File Nên Dẫn Trong Báo Cáo

Khi mô tả nguồn dữ liệu:

- Dẫn `SOURCE.md` cho nguồn tải, license và checksum.
- Dẫn file này cho data dictionary và cách dùng trong project.
- Dẫn `complete-journey-mongo-seed-report.md` cho seed MongoDB, training và provision login.

Khi cần mô tả tái lập:

1. Tải raw data bằng `download_complete_journey.ps1`.
2. Kiểm tra checksum bằng `MANIFEST.sha256`.
3. Export CSV bằng `export_complete_journey_csv.py`.
4. Seed MongoDB bằng `seed_complete_journey_to_mongo.py`.
5. Train AI bằng `ai_recommender_all_in_one.py train`.
6. Provision login web bằng `provisionCompleteJourneyLoginAccounts.ts` nếu cần demo qua UI.
