# AlertNotification Component

## Mô tả

Component `AlertNotification` dùng để hiển thị thông báo xác nhận khi người dùng muốn cập nhật hoặc xóa các entity quan trọng như ví, giao dịch, ngân sách và mục tiêu.

## Props

- `visible`: boolean - Hiển thị/ẩn modal
- `onConfirm`: () => void - Callback khi người dùng xác nhận
- `onCancel`: () => void - Callback khi người dùng hủy
- `title`: string - Tiêu đề thông báo
- `content`: string - Nội dung chi tiết
- `confirmText`: string - Text nút xác nhận (mặc định: "Xác nhận")
- `cancelText`: string - Text nút hủy (Mặc định: "Hủy")
- `type`: "warning" | "error" - Loại thông báo (Mặc định: "warning")

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
- ✅ `Transactions_new.tsx` - Cần cập nhật để sử dụng component mới
- ⏸ `Goals_new.tsx` - Cần cập nhật (có lỗi state khác biệt)

## Lợi ích

- UI đồng nhất cho tất cả thông báo xác nhận
- Tùy chỉnh màu sắc (warning/error)
- Tiếng Việt đầy đủ
- Dễ dàng tùy chỉnh nội dung
