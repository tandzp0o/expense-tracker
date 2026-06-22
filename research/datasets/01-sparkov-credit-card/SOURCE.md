# 01 - Sparkov Credit Card Transactions

## Ưu tiên

Ưu tiên 1 cho thực nghiệm chính thay Complete Journey.

## Lý do chọn

Dataset này gần bài toán expense tracker hơn Complete Journey vì có giao dịch credit card theo customer, thời gian giao dịch, merchant, amount và category mua hàng đa dạng đời sống.

Các category thường gặp trong bản Kaggle `kartik2112/fraud-detection`:

- `food_dining`
- `grocery_pos`
- `grocery_net`
- `shopping_pos`
- `shopping_net`
- `entertainment`
- `gas_transport`
- `health_fitness`
- `home`
- `personal_care`
- `travel`
- `kids_pets`
- `misc_pos`
- `misc_net`

## Nguồn

- Kaggle dataset: <https://www.kaggle.com/datasets/kartik2112/fraud-detection>
- Simulator gốc: Sparkov Data Generation, <https://github.com/namebrandon/Sparkov_Data_Generation>
- Mirror đã tải trong workspace: <https://huggingface.co/datasets/dazzle-nu/CIS435-CreditCardFraudDetection>
- Dạng dữ liệu: synthetic credit card transactions.

## Trạng thái tải dữ liệu

Đã tải file:

```text
raw/fraudTrain.csv
```

Profile local:

- Dòng: 1,048,575.
- Cột: 25.
- Unique `cc_num`: 943.
- Thời gian: `1/1/19 0:00` đến `9/9/19 9:59`.
- Category: 14 nhóm.
- Fraud count: 6,006.

Checksum nằm ở `MANIFEST.sha256`.

## Ghi chú Kaggle

Nguồn Kaggle thường cần Kaggle API credentials:

```text
%USERPROFILE%\.kaggle\kaggle.json
```

Khi có credentials, chạy:

```powershell
python -m kaggle datasets download -d kartik2112/fraud-detection -p research\datasets\01-sparkov-credit-card\raw --unzip
```

## Mapping dự kiến sang app

| Sparkov category | App category |
| --- | --- |
| `food_dining`, `grocery_pos`, `grocery_net` | Ăn uống |
| `gas_transport`, `travel` | Di chuyển |
| `shopping_pos`, `shopping_net` | Mua sắm |
| `entertainment` | Giải trí |
| `health_fitness`, `personal_care` | Sức khỏe |
| `home` | Hóa đơn |
| `kids_pets`, `misc_pos`, `misc_net` | Khác |
