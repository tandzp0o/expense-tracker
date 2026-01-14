/**
 * Định dạng tiền tệ Việt Nam
 * @param amount Số tiền cần định dạng
 * @returns Chuỗi đã được định dạng (ví dụ: 1.000.000 ₫)
 */
export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount == null) {
    return "Không có giá";
  }
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Rút gọn số tiền lớn (ví dụ: 1.5k, 1.2M)
 * @param num Số cần rút gọn
 * @param digits Số chữ số thập phân (mặc định: 1)
 * @returns Chuỗi đã được rút gọn
 */
export const formatCompactNumber = (
  num: number,
  digits: number = 1
): string => {
  const lookup = [
    { value: 1, symbol: "" },
    { value: 1e3, symbol: "k" },
    { value: 1e6, symbol: "M" },
    { value: 1e9, symbol: "B" },
    { value: 1e12, symbol: "T" },
  ];

  const rx = /\.0+$|(\.\d*[1-9])0+$/;
  const item = [...lookup].reverse().find((item) => num >= item.value);

  return item
    ? (num / item.value).toFixed(digits).replace(rx, "$1") + item.symbol
    : "0";
};

/**
 * Định dạng ngày tháng theo định dạng Việt Nam
 * @param date Ngày cần định dạng (có thể là chuỗi, số hoặc đối tượng Date)
 * @returns Chuỗi ngày tháng đã được định dạng (ví dụ: 14/11/2023)
 */
export const formatDate = (date: string | number | Date): string => {
  return new Date(date).toLocaleDateString("vi-VN");
};

/**
 * Định dạng thời gian đầy đủ
 * @param date Ngày giờ cần định dạng
 * @returns Chuỗi thời gian đã được định dạng (ví dụ: 14:30 14/11/2023)
 */
export const formatDateTime = (date: string | number | Date): string => {
  const d = new Date(date);
  return `${d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  })} ${formatDate(d)}`;
};
