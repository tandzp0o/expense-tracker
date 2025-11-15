import { useState, useEffect } from "react";

// Hook này nhận vào một giá trị và một khoảng thời gian trễ
export function useDebounce<T>(value: T, delay: number): T {
    // State để lưu trữ giá trị đã được debounce
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        // Thiết lập một timer để cập nhật giá trị debounce sau khoảng thời gian delay
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // Hủy timer nếu giá trị thay đổi (ví dụ người dùng gõ tiếp)
        // hoặc khi component unmount
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]); // Chỉ chạy lại effect nếu value hoặc delay thay đổi

    return debouncedValue;
}
