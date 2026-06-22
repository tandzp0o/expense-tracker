# 02 - BankSim

## Ưu tiên

Ưu tiên 2 cho thực nghiệm transaction-level đa category.

## Lý do chọn

BankSim là bộ dữ liệu synthetic bank payments, dựa trên simulator agent-based và được mô tả trong bài báo BankSim. Nó có customer, merchant, category, amount, thời gian mô phỏng và fraud label. So với Complete Journey, category merchant rộng hơn grocery/retail.

## Nguồn

- Kaggle dataset: <https://www.kaggle.com/datasets/ealaxi/banksim1>
- Paper/source: <https://www.researchgate.net/publication/265736405_BankSim_A_Bank_Payment_Simulation_for_Fraud_Detection_Research>
- Mirror raw đã tải trong workspace: <https://raw.githubusercontent.com/atavci/fraud-detection-on-banksim-data/master/Data/synthetic-data-from-a-financial-payment-system/bs140513_032310.csv>
- Dạng dữ liệu: synthetic bank payment transactions.

## Trạng thái tải dữ liệu

Đã tải file:

```text
raw/bs140513_032310.csv
```

Profile local:

- Dòng: 594,643.
- Cột: 10.
- Unique customers: 4,112.
- Unique merchants: 50.
- Step: 0 đến 179.
- Category: 15 nhóm.
- Fraud count: 7,200.

Checksum nằm ở `MANIFEST.sha256`.

## Ghi chú Kaggle

Nguồn Kaggle thường cần Kaggle API credentials:

```text
%USERPROFILE%\.kaggle\kaggle.json
```

Khi có credentials, chạy:

```powershell
python -m kaggle datasets download -d ealaxi/banksim1 -p research\datasets\02-banksim\raw --unzip
```

## Cột thường gặp

- `step`
- `customer`
- `age`
- `gender`
- `zipcodeOri`
- `merchant`
- `zipMerchant`
- `category`
- `amount`
- `fraud`
