const getActiveLanguage = () => {
    if (typeof document === "undefined") {
        return "vi";
    }

    return document.documentElement.lang === "en" ? "en" : "vi";
};

const getLocale = () => (getActiveLanguage() === "en" ? "en-US" : "vi-VN");

/**
 * Định dạng tiền tệ theo ngôn ngữ giao diện hiện tại.
 */
export const formatCurrency = (amount: number | null | undefined): string => {
    if (amount == null) {
        return getActiveLanguage() === "en" ? "N/A" : "Không có giá";
    }

    return new Intl.NumberFormat(getLocale(), {
        style: "currency",
        currency: "VND",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

/**
 * Rút gọn số tiền lớn (ví dụ: 1.5k, 1.2M)
 */
export const formatCompactNumber = (
    num: number,
    digits: number = 1,
): string => {
    const lookup = [
        { value: 1, symbol: "" },
        { value: 1e3, symbol: "k" },
        { value: 1e6, symbol: "M" },
        { value: 1e9, symbol: "B" },
        { value: 1e12, symbol: "T" },
    ];

    const rx = /\.0+$|(\.\d*[1-9])0+$/;
    const item = [...lookup].reverse().find((entry) => num >= entry.value);

    return item
        ? (num / item.value).toFixed(digits).replace(rx, "$1") + item.symbol
        : "0";
};

/**
 * Định dạng ngày tháng theo ngôn ngữ giao diện hiện tại.
 */
export const formatDate = (date: string | number | Date): string => {
    return new Date(date).toLocaleDateString(getLocale());
};

/**
 * Định dạng thời gian đầy đủ theo ngôn ngữ giao diện hiện tại.
 */
export const formatDateTime = (date: string | number | Date): string => {
    const d = new Date(date);
    return `${d.toLocaleTimeString(getLocale(), {
        hour: "2-digit",
        minute: "2-digit",
    })} ${formatDate(d)}`;
};
