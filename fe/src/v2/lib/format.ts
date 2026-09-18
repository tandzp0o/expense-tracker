import { formatCurrency, toDateInputValue } from "utils/formatters";

const MINUS = "−";

const isCompactMode = () =>
  typeof document !== "undefined" &&
  document.documentElement.dataset.moneyDisplay === "compact";

/**
 * Money the way Ledger prints it: "1.250.000 ₫". VND is the only currency the
 * app is really built around, so it gets the typographic treatment; anything
 * else, and the compact display mode chosen in Settings, go through the shared
 * formatter so a user's preference still holds.
 */
export const formatMoney = (
  amount: number,
  currency = "VND",
  options: { signed?: boolean; displayMode?: "full" | "compact" } = {},
) => {
  const value = Number(amount) || 0;
  const sign =
    options.signed && value > 0 ? "+" : value < 0 ? MINUS : "";
  const compact = options.displayMode
    ? options.displayMode === "compact"
    : isCompactMode();

  if (currency !== "VND" || compact) {
    const formatted = formatCurrency(Math.abs(value), currency, {
      displayMode: compact ? "compact" : "full",
    });
    return `${sign}${formatted}`;
  }

  const digits = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(Math.abs(value));

  return `${sign}${digits} ₫`;
};

/** Digits grouped with dots for an amount input, without the currency sign. */
export const formatAmountInput = (amount: number) =>
  amount > 0
    ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(
        amount,
      )
    : "";

/** Only the digits the user typed, capped so the value stays a safe integer. */
export const parseAmountInput = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? Math.min(Number(digits), Number.MAX_SAFE_INTEGER) : 0;
};

/** yyyy-mm-dd of an instant, as seen in the user's configured timezone. */
export const calendarDay = (
  value: string | number | Date,
  timezoneOffsetMinutes: number,
) => toDateInputValue(value, timezoneOffsetMinutes);

export const todayKey = (timezoneOffsetMinutes: number) =>
  calendarDay(new Date(), timezoneOffsetMinutes);

export const monthOfDay = (dayKey: string) => ({
  year: Number(dayKey.slice(0, 4)),
  month: Number(dayKey.slice(5, 7)),
});

export const currentMonth = (timezoneOffsetMinutes: number) =>
  monthOfDay(todayKey(timezoneOffsetMinutes));

/**
 * The instant a transaction is stored at: midday of the picked day in the
 * user's timezone. It keeps the calendar day intact wherever the server or the
 * next reader happens to be, exactly as the v1 form does.
 */
export const middayIso = (dayKey: string, timezoneOffsetMinutes: number) =>
  new Date(
    Date.UTC(
      Number(dayKey.slice(0, 4)),
      Number(dayKey.slice(5, 7)) - 1,
      Number(dayKey.slice(8, 10)),
      12,
    ) +
      timezoneOffsetMinutes * 60 * 1000,
  ).toISOString();

const WEEKDAYS_VI = [
  "Chủ nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];
const WEEKDAYS_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const weekdayOf = (dayKey: string) =>
  new Date(`${dayKey}T12:00:00Z`).getUTCDay();

const shortDate = (dayKey: string) =>
  `${dayKey.slice(8, 10)}/${dayKey.slice(5, 7)}`;

const addDays = (dayKey: string, days: number) => {
  const date = new Date(`${dayKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** "Hôm nay · 18/09", "Hôm qua · 17/09", otherwise "Thứ Tư · 16/09". */
export const dayGroupLabel = (
  dayKey: string,
  timezoneOffsetMinutes: number,
  isVietnamese: boolean,
) => {
  const today = todayKey(timezoneOffsetMinutes);
  const prefix =
    dayKey === today
      ? isVietnamese
        ? "Hôm nay"
        : "Today"
      : dayKey === addDays(today, -1)
        ? isVietnamese
          ? "Hôm qua"
          : "Yesterday"
        : (isVietnamese ? WEEKDAYS_VI : WEEKDAYS_EN)[weekdayOf(dayKey)];

  return `${prefix} · ${shortDate(dayKey)}`;
};

/** "Thứ Sáu, 18/09/2026" for today in the user's timezone. */
export const longToday = (
  timezoneOffsetMinutes: number,
  isVietnamese: boolean,
) => {
  const today = todayKey(timezoneOffsetMinutes);
  const weekday = (isVietnamese ? WEEKDAYS_VI : WEEKDAYS_EN)[weekdayOf(today)];
  return `${weekday}, ${shortDate(today)}/${today.slice(0, 4)}`;
};

export const daysInMonth = (month: number, year: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Days left in the current month, today included. */
export const daysLeftInMonth = (timezoneOffsetMinutes: number) => {
  const today = todayKey(timezoneOffsetMinutes);
  const { month, year } = monthOfDay(today);
  return daysInMonth(month, year) - Number(today.slice(8, 10)) + 1;
};

export const monthLabel = (
  month: number,
  year: number,
  isVietnamese: boolean,
) => (isVietnamese ? `Tháng ${month}/${year}` : `${month}/${year}`);
