# Thành phần `AlertNotification`

## Mô tả

Thành phần `AlertNotification` dùng để hiển thị thông báo xác nhận khi người dùng muốn cập nhật hoặc xóa các thực thể quan trọng như ví, giao dịch, ngân sách và mục tiêu.

## Thuộc tính

- `visible`: boolean - Hiển thị hoặc ẩn modal
- `onConfirm`: () => void - Hàm gọi lại khi người dùng xác nhận
- `onCancel`: () => void - Hàm gọi lại khi người dùng hủy
- `title`: string - Tiêu đề thông báo
- `content`: string - Nội dung chi tiết
- `confirmText`: string - Nhãn nút xác nhận, mặc định là `"Xác nhận"`
- `cancelText`: string - Nhãn nút hủy, mặc định là `"Hủy"`
- `type`: "warning" | "error" - Loại thông báo, mặc định là `"warning"`

## Cách sử dụng

```tsx
import AlertNotification from "../components/AlertNotification";

// Trong component
const [alertVisible, setAlertVisible] = useState(false);
const [itemToDelete, setItemToDelete] = useState<string | null>(null);

const handleDelete = (item: any) => {
    setItemToDelete(item._id);
    setAlertVisible(true);
};

const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
        // Logic xóa ở đây
        await api.deleteItem(itemToDelete, token);
        message.success("Đã xóa thành công");
        setAlertVisible(false);
        setItemToDelete(null);
    } catch (e: any) {
        message.error(e?.message || "Không thể xóa");
    } finally {
        setAlertVisible(false);
        setItemToDelete(null);
    }
};

// Trong JSX
<AlertNotification
    visible={alertVisible}
    onConfirm={confirmDelete}
    onCancel={() => {
        setAlertVisible(false);
        setItemToDelete(null);
    }}
    title="Xác nhận xóa"
    content={`Bạn có chắc muốn xóa "${item.name}" không? Hành động này sẽ xóa toàn bộ dữ liệu liên quan và không thể hoàn tác.`}
    confirmText="Xóa"
    cancelText="Hủy"
    type="error"
/>;
```

## Đã tích hợp vào các trang

- ✅ `Wallets_new.tsx` - Xác nhận xóa ví
- ✅ `Budgets_new.tsx` - Xác nhận xóa ngân sách
- ✅ `Transactions_new.tsx` - Cần cập nhật để dùng thành phần mới
- ⏸ `Goals_new.tsx` - Cần cập nhật thêm do khác biệt state

## Lợi ích

- UI thống nhất cho mọi thông báo xác nhận
- Có thể tùy chỉnh màu sắc theo mức độ cảnh báo
- Nội dung tiếng Việt đầy đủ
- Dễ điều chỉnh lại nội dung theo từng ngữ cảnh
