# Seed Accounts

Cap nhat: 2026-05-23

## Co the dang nhap ngay (da tao Firebase Auth)

| UID | Email | Password |
|---|---|---|
| train-user-family-001 | train.user.family.001@example.com | 123123 |
| it-grad-basic-001 | it.grad.basic.001@example.com | 123123 |
| it-grad-master-gf-001 | it.grad.master.gf.001@example.com | 123123 |
| diverse-001-low-highspend | diverse.001@example.com | 123123 |
| diverse-002-mid-highspend | diverse.002@example.com | 123123 |
| diverse-003-many-goals | diverse.003@example.com | 123123 |
| diverse-004-sport-food | diverse.004@example.com | 123123 |
| diverse-005-beauty-shopping | diverse.005@example.com | 123123 |
| diverse-006-fresh-2m | diverse.006@example.com | 123123 |
| diverse-007-family-tight | diverse.007@example.com | 123123 |
| diverse-008-sidehustle | diverse.008@example.com | 123123 |
| diverse-009-student-worker | diverse.009@example.com | 123123 |
| diverse-010-minimalist |   | 123123 |
| diverse-011-newly-married | diverse.011@example.com | 123123 |
| diverse-012-gamer | diverse.012@example.com | 123123 |
| diverse-013-athlete-pro | diverse.013@example.com | 123123 |
| diverse-014-beauty-pro | diverse.014@example.com | 123123 |
| diverse-015-low-income-discipline | diverse.015@example.com | 123123 |
| diverse-016-mid-income-many-goals | diverse.016@example.com | 123123 |

## Complete Journey demo accounts

Đã provision 801 tài khoản Complete Journey vào Firebase Auth và copy dữ liệu sang DB app chính `expense-tracker`.

- Email format: `cj_hh_<household_id>@completejourney.local`
- UID Firebase/Mongo: `cj_hh_<household_id>`
- Password: `123123`
- Ví dụ có thể đăng nhập: `cj_hh_1@completejourney.local`, `cj_hh_1848@completejourney.local`

Lệnh provision lại nếu cần:

```bash
npm run provision:complete-journey-login -- --source-db expense-tracker-complete-journey --target-db expense-tracker --password 123123
```

## Chi seed Mongo (chua tao Firebase Auth nen chua dang nhap bang password duoc)

Khong con account nao trong danh sach seed o trang thai nay.

## Ghi chu

- Password `123` khong duoc Firebase chap nhan (yeu cau toi thieu 6 ky tu), nen cac account da provision dang dung `123123`.
- Neu can, co the tao Firebase Auth hang loat cho 16 account `diverse-*` voi cung password.
