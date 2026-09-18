import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BellRing,
  Check,
  ChevronDown,
  Clock,
  Coins,
  Globe2,
  LogOut,
  Monitor,
  Moon,
  Palette,
  PenLine,
  Pipette,
  Plus,
  RefreshCw,
  Send,
  Smartphone,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  isPushSupported,
  listenForForegroundMessages,
  requestPushToken,
  type PushPermissionResult,
} from "lib/firebase/messaging";
import { cn } from "lib/utils";
import { configApi, userApi } from "services/api";
import { useAuth } from "contexts/AuthContext";
import {
  DEFAULT_TIMEZONE,
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIMEZONES,
  getTimezoneOffsetMinutes,
  useLocale,
  type CurrencyPreference,
  type MoneyDisplayMode,
} from "contexts/LocaleContext";
import {
  useTheme,
  type FontScale,
  type ThemeMode,
  type UiVersion,
} from "contexts/ThemeContext";
import { useToast } from "contexts/ToastContext";
import { formatMoney } from "../lib/format";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { Avatar } from "../layout/LedgerLayout";
import {
  Button,
  ButtonLink,
  Chip,
  EmptyState,
  Notice,
  PageHeader,
  Section,
  Segmented,
  SkeletonRows,
} from "../components/primitives";
import { useT } from "../lib/i18n";
import { getIdToken } from "../lib/session";

/* ------------------------------------------------------------------- Tabs */

type TabId = "appearance" | "display" | "reminders" | "account";

const TABS: Array<{ id: TabId; vi: string; en: string; icon: LucideIcon }> = [
  { id: "appearance", vi: "Giao diện", en: "Appearance", icon: Palette },
  { id: "display", vi: "Hiển thị & tiền tệ", en: "Display & currency", icon: Coins },
  { id: "reminders", vi: "Nhắc ghi chép", en: "Reminders", icon: Bell },
  { id: "account", vi: "Tài khoản", en: "Account", icon: UserRound },
];

const isTabId = (value: string | null): value is TabId =>
  TABS.some((tab) => tab.id === value);

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "";

/* ----------------------------------------------------------- Local pieces */

/** A settings block: what it is on the left, the control under or beside it. */
const SettingRow: React.FC<{
  title: string;
  description?: React.ReactNode;
  control: React.ReactNode;
  /** Switches sit beside their label; wider controls go underneath. */
  inline?: boolean;
  hint?: React.ReactNode;
  children?: React.ReactNode;
  last?: boolean;
}> = ({ title, description, control, inline, hint, children, last }) => (
  <div className={cn("py-6", !last && "border-b border-ledger-line")}>
    <div className={cn(inline && "flex items-start justify-between gap-6")}>
      <div className="min-w-0">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ledger-ink">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-[560px] text-[13.5px] text-ledger-ink-2">{description}</p>
        ) : null}
      </div>
      {inline ? <div className="shrink-0 pt-0.5">{control}</div> : null}
    </div>
    {!inline ? <div className="mt-4">{control}</div> : null}
    {hint ? <p className="mt-2 text-[12.5px] text-ledger-muted">{hint}</p> : null}
    {children}
  </div>
);

const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, disabled }) => (
  <button
    aria-checked={checked}
    aria-label={label}
    className={cn(
      "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
      checked ? "bg-ledger-accent" : "bg-ledger-line-strong",
    )}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    role="switch"
    type="button"
  >
    <span
      className={cn(
        "inline-block h-5 w-5 rounded-full bg-ledger-accent-ink shadow-sm transition-transform",
        checked ? "translate-x-6" : "translate-x-1",
      )}
    />
  </button>
);

const SelectField: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }
> = ({ wrapperClassName, className, children, ...props }) => (
  <div className={cn("relative", wrapperClassName)}>
    <select
      className={cn(
        "h-11 w-full cursor-pointer appearance-none rounded-[10px] border border-ledger-line bg-ledger-paper pl-3.5 pr-10 text-[14px] text-ledger-ink outline-none transition-colors hover:border-ledger-line-strong focus:border-ledger-accent disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ledger-muted" />
  </div>
);

/** The round tick every selectable tile on this page ends with. */
const SelectMark: React.FC<{ selected: boolean }> = ({ selected }) => (
  <span
    aria-hidden
    className={cn(
      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
      selected
        ? "border-ledger-accent bg-ledger-accent text-ledger-accent-ink"
        : "border-ledger-line-strong",
    )}
  >
    {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
  </span>
);

const tileClasses = (selected: boolean) =>
  cn(
    "rounded-[14px] border text-left transition-colors",
    selected
      ? "border-ledger-accent bg-ledger-accent-wash ring-1 ring-ledger-accent"
      : "border-ledger-line bg-ledger-paper hover:border-ledger-line-strong",
  );

/* -------------------------------------------------------------- Appearance */

/** v1 in miniature: a tinted page, a coloured hero card, raised tiles. */
const V1Wireframe: React.FC = () => (
  <div
    aria-hidden
    className="flex h-full w-full flex-col gap-[6%] overflow-hidden rounded-[10px] border border-ledger-line bg-ledger-accent-wash p-[6%]"
  >
    <div className="flex h-[38%] flex-col justify-center gap-[10%] rounded-[7px] bg-ledger-accent px-[7%]">
      <span className="h-[3px] w-[30%] rounded-full bg-ledger-accent-ink opacity-70" />
      <span className="h-[6px] w-[48%] rounded-full bg-ledger-accent-ink" />
    </div>
    <div className="flex flex-1 gap-[5%]">
      {[0, 1, 2].map((index) => (
        <div
          className="flex flex-1 flex-col justify-center gap-[14%] rounded-[6px] bg-ledger-paper px-[10%] shadow-md"
          key={index}
        >
          <span className="h-[3px] w-[60%] rounded-full bg-ledger-line-strong" />
          <span className="h-[5px] w-[85%] rounded-full bg-ledger-ink-2" />
        </div>
      ))}
    </div>
  </div>
);

/** v2 in miniature: a rail, one big number, and rows split by hairlines. */
const V2Wireframe: React.FC = () => (
  <div
    aria-hidden
    className="flex h-full w-full overflow-hidden rounded-[10px] border border-ledger-line bg-ledger-paper"
  >
    <div className="flex w-[24%] shrink-0 flex-col gap-1.5 border-r border-ledger-line px-[5%] py-2">
      <span className="h-[6px] w-full shrink-0 rounded-full bg-ledger-accent" />
      <span className="h-[3px] w-[80%] shrink-0 rounded-full bg-ledger-line-strong" />
      <span className="h-[3px] w-[65%] shrink-0 rounded-full bg-ledger-line-strong" />
      <span className="h-[3px] w-[75%] shrink-0 rounded-full bg-ledger-line-strong" />
    </div>
    {/* Fixed heights with shrink-0: the tile is short on a phone, and empty
        flex items would otherwise shrink to nothing. */}
    <div className="flex min-w-0 flex-1 flex-col px-[7%] py-2">
      <span className="h-[3px] w-[28%] shrink-0 rounded-full bg-ledger-line-strong" />
      <span className="mt-1.5 h-[9px] w-[46%] shrink-0 rounded-[3px] bg-ledger-ink" />
      <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-ledger-line">
        {[0, 1, 2].map((index) => (
          <div
            className="flex flex-1 items-center justify-between border-b border-ledger-line last:border-b-0"
            key={index}
          >
            <span className="h-[3px] w-[40%] rounded-full bg-ledger-line-strong" />
            <span className="h-[4px] w-[20%] rounded-full bg-ledger-ink" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const VersionTile: React.FC<{
  version: UiVersion;
  selected: boolean;
  onSelect: () => void;
}> = ({ version, selected, onSelect }) => {
  const t = useT();
  const title =
    version === "v1" ? t("Bản hiện tại (v1)", "Current (v1)") : t("Bản mới (v2)", "New (v2)");
  const description =
    version === "v1"
      ? t(
          "Giao diện quen thuộc với thẻ nổi, nền màu và bóng đổ.",
          "The familiar look: raised cards, coloured panels and shadows.",
        )
      : t(
          "Ledger: đường kẻ mảnh thay cho thẻ, một con số chính mỗi trang, Ghi nhanh luôn sẵn.",
          "Ledger: hairlines instead of cards, one headline number per page, Quick add always at hand.",
        );

  return (
    <button
      aria-pressed={selected}
      className={cn(
        tileClasses(selected),
        "flex w-full items-center gap-4 p-3 sm:flex-col sm:items-stretch sm:p-4",
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="h-[80px] w-[112px] shrink-0 sm:h-[132px] sm:w-full">
        {version === "v1" ? <V1Wireframe /> : <V2Wireframe />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "min-w-0 text-[14.5px] font-semibold",
              selected ? "text-ledger-accent" : "text-ledger-ink",
            )}
          >
            {title}
          </span>
          {selected ? (
            <span className="shrink-0 rounded-full bg-ledger-accent px-2 py-0.5 text-[11px] font-semibold text-ledger-accent-ink">
              {t("Đang dùng", "In use")}
            </span>
          ) : null}
          <span className="ml-auto hidden sm:block">
            <SelectMark selected={selected} />
          </span>
        </div>
        <p className="mt-1 text-[12.5px] leading-snug text-ledger-ink-2">{description}</p>
      </div>
    </button>
  );
};

/** The same presets the v1 appearance panel offers, so a choice carries over. */
const COLOR_PRESETS = [
  { value: "#2563eb", vi: "Xanh dương", en: "Blue" },
  { value: "#0f766e", vi: "Xanh ngọc", en: "Teal" },
  { value: "#7c3aed", vi: "Tím", en: "Violet" },
  { value: "#dc2626", vi: "Đỏ", en: "Red" },
  { value: "#ea580c", vi: "Cam", en: "Orange" },
  { value: "#0891b2", vi: "Xanh lơ", en: "Cyan" },
];

const FONT_SCALES: Array<{ value: FontScale; vi: string; en: string }> = [
  { value: "sm", vi: "Nhỏ · S", en: "Small · S" },
  { value: "md", vi: "Vừa · M", en: "Medium · M" },
  { value: "lg", vi: "Lớn · L", en: "Large · L" },
];

const AppearanceTab: React.FC = () => {
  const t = useT();
  const { appearance, updateAppearance } = useTheme();
  const primary = appearance.primaryColor.toLowerCase();
  const isCustomColor = !COLOR_PRESETS.some((preset) => preset.value === primary);

  return (
    <>
      <Section title={t("Phiên bản giao diện", "Interface version")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["v1", "v2"] as UiVersion[]).map((version) => (
            <VersionTile
              key={version}
              // Switching to v1 swaps the whole shell on the next render; there
              // is nothing to save or reload, the data is the same.
              onSelect={() => updateAppearance({ uiVersion: version })}
              selected={appearance.uiVersion === version}
              version={version}
            />
          ))}
        </div>
        <p className="mt-3 text-[12.5px] text-ledger-muted">
          {t(
            "Đổi lại bất cứ lúc nào, dữ liệu không thay đổi.",
            "Switch back any time; your data stays the same.",
          )}
        </p>
      </Section>

      <Section title={t("Chế độ", "Mode")}>
        <div className="grid grid-cols-2 gap-3 sm:max-w-[520px]">
          {(["light", "dark"] as ThemeMode[]).map((mode) => {
            const selected = appearance.mode === mode;
            const Icon = mode === "light" ? Sun : Moon;
            return (
              <button
                aria-pressed={selected}
                className={cn(tileClasses(selected), "flex h-14 items-center gap-3 px-3.5")}
                key={mode}
                onClick={() => updateAppearance({ mode })}
                type="button"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    mode === "light"
                      ? "bg-ledger-spend-wash text-ledger-spend"
                      : "bg-ledger-ink text-ledger-paper",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 text-[14px] font-medium text-ledger-ink">
                  {mode === "light" ? t("Sáng", "Light") : t("Tối", "Dark")}
                </span>
                <SelectMark selected={selected} />
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={t("Màu chủ đạo", "Accent colour")}>
        <div className="flex flex-wrap items-center gap-3.5">
          {COLOR_PRESETS.map((preset) => {
            const selected = primary === preset.value;
            return (
              <button
                aria-label={t(preset.vi, preset.en)}
                aria-pressed={selected}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-105"
                key={preset.value}
                onClick={() => updateAppearance({ primaryColor: preset.value })}
                style={{
                  backgroundColor: preset.value,
                  boxShadow: selected
                    ? `0 0 0 2px var(--l-paper), 0 0 0 4px ${preset.value}`
                    : undefined,
                }}
                title={t(preset.vi, preset.en)}
                type="button"
              >
                {/* Only the active dot shows a tick, and the active dot is the
                    accent itself, so the accent's own contrast ink fits it. */}
                {selected ? <Check className="h-4 w-4 text-ledger-accent-ink" strokeWidth={3} /> : null}
              </button>
            );
          })}
          <label
            className={cn(
              "relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-105",
              !isCustomColor && "border border-dashed border-ledger-line-strong text-ledger-ink-2",
            )}
            style={
              isCustomColor
                ? {
                    backgroundColor: appearance.primaryColor,
                    boxShadow: `0 0 0 2px var(--l-paper), 0 0 0 4px ${appearance.primaryColor}`,
                  }
                : undefined
            }
            title={t("Màu khác", "Custom colour")}
          >
            {isCustomColor ? (
              <Check className="h-4 w-4 text-ledger-accent-ink" strokeWidth={3} />
            ) : (
              <Pipette className="h-4 w-4" />
            )}
            <input
              aria-label={t("Chọn màu khác", "Pick a custom colour")}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              onChange={(event) => updateAppearance({ primaryColor: event.target.value })}
              type="color"
              value={appearance.primaryColor}
            />
          </label>
        </div>
        <p className="mt-4 text-[12.5px] text-ledger-muted">
          {t(
            "Dùng cho nút bấm, liên kết và mục đang chọn trên toàn ứng dụng.",
            "Used for buttons, links and the selected item across the app.",
          )}
        </p>
      </Section>

      <Section bare title={t("Cỡ chữ", "Text size")}>
        <Segmented
          className="max-w-[420px]"
          onChange={(fontScale) => updateAppearance({ fontScale })}
          options={FONT_SCALES.map((scale) => ({
            value: scale.value,
            label: t(scale.vi, scale.en),
          }))}
          value={appearance.fontScale}
        />
        <p className="mt-6 text-[12.5px] text-ledger-muted">
          {t(
            "Các lựa chọn giao diện được lưu trên trình duyệt này.",
            "Appearance choices are saved in this browser.",
          )}
        </p>
      </Section>
    </>
  );
};

/* ----------------------------------------------------------------- Display */

/** getTimezoneOffset() is inverted: UTC+7 arrives as -420. */
const formatOffset = (minutes: number) => {
  const total = -minutes;
  const sign = total >= 0 ? "+" : "-";
  const absolute = Math.abs(total);
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  return `GMT${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
};

const zoneLabel = (zone: string, isVietnamese: boolean) => {
  const known = SUPPORTED_TIMEZONES.find((entry) => entry.value === zone);
  return known
    ? isVietnamese
      ? known.vi
      : known.en
    : `${zone} (${formatOffset(getTimezoneOffsetMinutes(zone))})`;
};

const DisplayTab: React.FC = () => {
  const t = useT();
  const {
    language,
    setLanguage,
    moneyDisplayMode,
    setMoneyDisplayMode,
    currencyPreference,
    setCurrencyPreference,
    defaultCurrency,
    timezone,
    setTimezone,
    timezoneOffsetMinutes,
    isVietnamese,
  } = useLocale();

  return (
    <>
      <SettingRow
        control={
          <Segmented
            className="max-w-[360px]"
            onChange={setLanguage}
            options={[
              { value: "vi", label: "Tiếng Việt" },
              { value: "en", label: "English" },
            ]}
            value={language}
          />
        }
        description={t(
          "Chọn ngôn ngữ cho các nhãn và nội dung chính giữa tiếng Việt và tiếng Anh.",
          "Choose the language for the main labels and content.",
        )}
        title={t("Ngôn ngữ hiển thị", "Display language")}
      />

      <SettingRow
        control={
          <div className="grid grid-cols-2 gap-3 sm:max-w-[520px]">
            {(["full", "compact"] as MoneyDisplayMode[]).map((mode) => {
              const selected = moneyDisplayMode === mode;
              return (
                <button
                  aria-pressed={selected}
                  className={cn(tileClasses(selected), "flex items-start gap-3 px-3.5 py-3")}
                  key={mode}
                  onClick={() => setMoneyDisplayMode(mode)}
                  type="button"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-ledger-ink">
                      {mode === "full" ? t("Đầy đủ", "Full") : t("Rút gọn", "Compact")}
                    </span>
                    {/* Each tile shows its own mode, whatever is active now. */}
                    <span className="ledger-num mt-1 block text-[17px] font-semibold text-ledger-ink">
                      {formatMoney(1500000, defaultCurrency, { displayMode: mode })}
                    </span>
                  </span>
                  <SelectMark selected={selected} />
                </button>
              );
            })}
          </div>
        }
        description={t(
          "Chọn dạng đầy đủ hoặc rút gọn. Rút gọn giúp số lớn vừa màn hình điện thoại.",
          "Choose full or compact money labels. Compact keeps large figures on one line on a phone.",
        )}
        title={t("Kiểu hiển thị số tiền", "Money display style")}
      />

      <SettingRow
        control={
          <SelectField
            aria-label={t("Tiền tệ mặc định", "Default currency")}
            onChange={(event) =>
              setCurrencyPreference(event.target.value as CurrencyPreference)
            }
            value={currencyPreference}
            wrapperClassName="max-w-[360px]"
          >
            <option value="auto">
              {t(`Theo ngôn ngữ (${defaultCurrency})`, `Follow language (${defaultCurrency})`)}
            </option>
            {SUPPORTED_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </SelectField>
        }
        description={t(
          "Dùng cho ví mới tạo và các số tổng không gắn với ví cụ thể. Ví đã tạo vẫn giữ nguyên tiền tệ của nó.",
          "Used for newly created wallets and totals with no specific wallet. Existing wallets keep their own currency.",
        )}
        hint={t(
          "Ở chế độ theo ngôn ngữ: tiếng Việt dùng VND, tiếng Anh dùng USD.",
          "In follow-language mode: Vietnamese uses VND, English uses USD.",
        )}
        title={t("Tiền tệ mặc định", "Default currency")}
      />

      <SettingRow
        control={
          <SelectField
            aria-label={t("Múi giờ", "Timezone")}
            onChange={(event) => setTimezone(event.target.value)}
            value={timezone}
            wrapperClassName="max-w-[360px]"
          >
            {SUPPORTED_TIMEZONES.map((zone) => (
              <option key={zone.value} value={zone.value}>
                {isVietnamese ? zone.vi : zone.en}
              </option>
            ))}
          </SelectField>
        }
        description={t(
          "Ứng dụng dùng múi giờ này để xác định một giao dịch thuộc ngày nào, kể cả khi máy chủ đặt ở múi giờ khác.",
          "The app uses this timezone to decide which day a transaction belongs to, even when the server runs elsewhere.",
        )}
        hint={
          <span className="ledger-num">
            {t("Hiện tại: ", "Currently: ")}
            {formatOffset(timezoneOffsetMinutes)}
          </span>
        }
        last
        title={t("Múi giờ", "Timezone")}
      >
        <p className="mt-6 text-[12.5px] text-ledger-muted">
          {t(
            "Các lựa chọn hiển thị được lưu trên trình duyệt này.",
            "Display choices are saved in this browser.",
          )}
        </p>
      </SettingRow>
    </>
  );
};

/* --------------------------------------------------------------- Reminders */

interface ReminderConfig {
  remindersEnabled: boolean;
  reminderTimes: string[];
  timezone: string;
  skipWhenAlreadyLogged: boolean;
  maxRemindersPerDay: number;
  deviceCount: number;
}

/**
 * Reads what the server sent, keeping the previous value for anything it left
 * out: device endpoints answer with only `deviceCount`, and a partial answer
 * must not blank the rest of the form.
 */
const readConfig = (data: unknown, fallback?: ReminderConfig): ReminderConfig => {
  const raw = (data || {}) as Partial<Record<keyof ReminderConfig, unknown>>;
  const count = Number(raw.deviceCount);
  const limit = Number(raw.maxRemindersPerDay);

  return {
    remindersEnabled:
      typeof raw.remindersEnabled === "boolean"
        ? raw.remindersEnabled
        : (fallback?.remindersEnabled ?? true),
    reminderTimes: Array.isArray(raw.reminderTimes)
      ? raw.reminderTimes.filter((time): time is string => typeof time === "string")
      : (fallback?.reminderTimes ?? []),
    timezone:
      typeof raw.timezone === "string" && raw.timezone
        ? raw.timezone
        : (fallback?.timezone ?? DEFAULT_TIMEZONE),
    // The server model defaults this to on, so a config saved before the
    // field existed behaves as "skip".
    skipWhenAlreadyLogged:
      typeof raw.skipWhenAlreadyLogged === "boolean"
        ? raw.skipWhenAlreadyLogged
        : (fallback?.skipWhenAlreadyLogged ?? true),
    maxRemindersPerDay:
      Number.isFinite(limit) && limit > 0 ? limit : (fallback?.maxRemindersPerDay ?? 1),
    deviceCount:
      raw.deviceCount != null && Number.isFinite(count)
        ? count
        : (fallback?.deviceCount ?? 0),
  };
};

/** Reminder times live on a 30 minute grid, matching the backend. */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

/**
 * The first free slot from 20:00 onwards, wrapping past midnight. Starting at
 * the top of the list would offer 00:00, a reminder nobody wants.
 */
const nextFreeTime = (used: string[]) => {
  const start = TIME_OPTIONS.indexOf("20:00");
  const ordered = [...TIME_OPTIONS.slice(start), ...TIME_OPTIONS.slice(0, start)];
  return ordered.find((option) => !used.includes(option)) || "20:00";
};

type PermissionState = NotificationPermission | "unsupported";

const readPermission = (): PermissionState =>
  typeof window !== "undefined" && "Notification" in window
    ? Notification.permission
    : "unsupported";

const RemindersTab: React.FC = () => {
  const t = useT();
  const { isVietnamese, timezone } = useLocale();
  const { toast } = useToast();
  const isDesktop = useIsDesktop();
  const [config, setConfig] = useState<ReminderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [pushSupported, setPushSupported] = useState(true);
  const [permission, setPermission] = useState<PermissionState>(readPermission);

  useEffect(() => {
    let active = true;
    void isPushSupported().then((supported) => {
      if (active) {
        setPushSupported(supported);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");

    (async () => {
      try {
        const token = await getIdToken();
        const data = await configApi.getConfig(token);
        if (active) {
          setConfig(readConfig(data));
        }
      } catch (error) {
        if (active) {
          const message = errorMessage(error);
          setLoadError(message);
          toast({
            title: isVietnamese
              ? "Không tải được cấu hình nhắc nhở"
              : "Could not load the reminder settings",
            description: message,
            variant: "destructive",
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
    // The language only changes the toast wording; refetching for it would
    // throw away an edit in flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, toast]);

  const persist = useCallback(
    async (next: Partial<ReminderConfig>) => {
      if (!config) {
        return;
      }

      const previous = config;
      setConfig({ ...previous, ...next });
      setSaving(true);

      try {
        const token = await getIdToken();
        const data = await configApi.updateConfig(
          {
            ...next,
            // Reminder times only mean something together with the zone they
            // were chosen in, so every save carries the one set in Settings.
            timezone: next.timezone || timezone,
          },
          token,
        );
        setConfig((current) => readConfig(data, current || previous));
        toast({
          title: isVietnamese ? "Đã lưu cấu hình nhắc nhở" : "Reminder settings saved",
          variant: "success",
        });
      } catch (error) {
        setConfig(previous);
        toast({
          title: isVietnamese ? "Không lưu được cấu hình" : "Could not save the settings",
          description: errorMessage(error),
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    },
    [config, isVietnamese, timezone, toast],
  );

  /** Turns a push permission result into the toast that explains it, if any. */
  const explainPushFailure = (result: PushPermissionResult) => {
    if (result.status === "unsupported") {
      toast({
        title: t("Trình duyệt không hỗ trợ", "Not supported"),
        description: t(
          "Trình duyệt hoặc thiết bị này không hỗ trợ thông báo đẩy.",
          "This browser or device does not support push notifications.",
        ),
        variant: "destructive",
      });
    } else if (result.status === "misconfigured") {
      toast({
        title: t("Thiếu cấu hình VAPID key", "Missing VAPID key"),
        description: t(
          "Cần đặt REACT_APP_FIREBASE_VAPID_KEY trước khi bật thông báo.",
          "REACT_APP_FIREBASE_VAPID_KEY must be set before enabling push.",
        ),
        variant: "destructive",
      });
    } else if (result.status === "denied") {
      toast({
        title: t("Bạn đã chặn thông báo", "Notifications are blocked"),
        description: t(
          "Hãy mở phần cài đặt thông báo của trình duyệt và cho phép trang này.",
          "Open your browser notification settings and allow this site.",
        ),
        variant: "destructive",
      });
    } else if (result.status === "failed") {
      toast({
        title: t("Không bật được thông báo", "Could not enable notifications"),
        description: errorMessage(result.error),
        variant: "destructive",
      });
    }
  };

  const handleEnableDevice = async () => {
    setDeviceBusy(true);
    try {
      const result = await requestPushToken();
      setPermission(readPermission());

      if (result.status !== "granted") {
        explainPushFailure(result);
        return;
      }

      const token = await getIdToken();
      const data = await configApi.registerDevice(
        { token: result.token, platform: "web" },
        token,
      );
      setConfig((current) => (current ? readConfig(data, current) : current));
      toast({
        title: t("Thiết bị đã sẵn sàng nhận thông báo", "This device is ready to receive reminders"),
        variant: "success",
      });
    } catch (error) {
      toast({
        title: t("Không bật được thông báo", "Could not enable notifications"),
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setDeviceBusy(false);
    }
  };

  // The server only keeps tokens, not which browser they came from, so "this
  // device" is identified by asking Firebase for its token again. Permission
  // is already granted here, so the browser does not prompt.
  const handleRemoveDevice = async () => {
    if (!config) {
      return;
    }

    setDeviceBusy(true);
    try {
      const result = await requestPushToken();
      if (result.status !== "granted") {
        explainPushFailure(result);
        return;
      }

      const before = config.deviceCount;
      const token = await getIdToken();
      const data = await configApi.removeDevice(result.token, token);
      const next = readConfig(data, config);
      setConfig((current) => (current ? { ...current, deviceCount: next.deviceCount } : current));
      toast(
        next.deviceCount < before
          ? {
              title: t("Đã gỡ thiết bị này", "This device was removed"),
              description: t(
                "Trình duyệt này sẽ không nhận nhắc nhở nữa.",
                "This browser will no longer receive reminders.",
              ),
              variant: "success",
            }
          : {
              title: t("Thiết bị này chưa được đăng ký", "This device was not registered"),
              description: t(
                "Không có gì để gỡ trên trình duyệt này.",
                "There was nothing to remove for this browser.",
              ),
              variant: "default",
            },
      );
    } catch (error) {
      toast({
        title: t("Không gỡ được thiết bị", "Could not remove the device"),
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setDeviceBusy(false);
    }
  };

  const handleSendTest = async () => {
    setSaving(true);
    try {
      const token = await getIdToken();
      const result = (await configApi.testNotification(token)) as {
        sent?: number;
        failed?: number;
        errors?: string[];
      };
      const sent = Number(result?.sent) || 0;
      const failed = Number(result?.failed) || 0;
      const counts = t(`(đã gửi: ${sent}, lỗi: ${failed})`, `(sent: ${sent}, failed: ${failed})`);
      const firstError = result?.errors?.[0];

      toast(
        sent > 0
          ? {
              title: t("Đã gửi thông báo thử", "Test notification sent"),
              description: `${t(
                "Nếu vài giây nữa vẫn chưa thấy gì, kiểm tra lại quyền thông báo của trình duyệt và hệ điều hành.",
                "If nothing shows up in a few seconds, check the notification permission in your browser and OS.",
              )} ${counts}`,
              variant: "success",
            }
          : {
              title: t("Chưa gửi tới được thiết bị nào", "No device received the test"),
              description: [counts, firstError].filter(Boolean).join(" "),
              variant: "destructive",
            },
      );
    } catch (error) {
      toast({
        title: t("Không gửi được thông báo thử", "Could not send the test notification"),
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-6">
        <SkeletonRows rows={4} />
      </div>
    );
  }

  if (!config) {
    return (
      <EmptyState
        action={
          <Button icon={RefreshCw} onClick={() => setReloadKey((key) => key + 1)} variant="outline">
            {t("Thử lại", "Try again")}
          </Button>
        }
        description={loadError || undefined}
        icon={Bell}
        title={t("Không tải được cấu hình nhắc nhở", "Could not load the reminder settings")}
      />
    );
  }

  const atLimit = config.reminderTimes.length >= config.maxRemindersPerDay;
  const zoneMismatch = config.timezone !== timezone;
  const DeviceIcon = isDesktop ? Monitor : Smartphone;
  const thisDeviceStatus = !pushSupported
    ? t("Không hỗ trợ thông báo đẩy", "Push notifications are not supported")
    : permission === "granted"
      ? t("Đã cho phép thông báo", "Notifications allowed")
      : permission === "denied"
        ? t("Đã chặn thông báo", "Notifications blocked")
        : t("Chưa cho phép thông báo", "Notifications not allowed yet");

  return (
    <>
      <SettingRow
        control={
          <Toggle
            checked={config.remindersEnabled}
            disabled={saving}
            label={t("Bật nhắc nhở", "Enable reminders")}
            onChange={(checked) => void persist({ remindersEnabled: checked })}
          />
        }
        description={t(
          "Ứng dụng sẽ nhắc bạn ghi lại thu chi để số liệu không bị bỏ trống ngày nào.",
          "The app nudges you to record income and expenses so no day is left empty.",
        )}
        hint={t(
          "Tắt đi thì các mốc giờ vẫn được giữ lại cho lần bật sau.",
          "Turning this off keeps your times for the next time you enable it.",
        )}
        inline
        title={t("Nhắc ghi chép", "Logging reminders")}
      />

      <Section
        meta={
          <span className="ledger-num">
            {config.reminderTimes.length}/{config.maxRemindersPerDay}
          </span>
        }
        title={t("Các mốc nhắc trong ngày", "Times of day")}
      >
        <p className="-mt-1 mb-3 flex items-center gap-1.5 text-[12.5px] text-ledger-muted">
          <Globe2 className="h-3.5 w-3.5 shrink-0" />
          {t(
            `Giờ nhắc tính theo múi giờ ${zoneLabel(config.timezone, true)}.`,
            `Reminder times follow the ${zoneLabel(config.timezone, false)} timezone.`,
          )}
        </p>

        {zoneMismatch ? (
          <Notice
            action={
              <button
                className="text-[13px] font-medium text-ledger-accent hover:underline disabled:opacity-50"
                disabled={saving}
                onClick={() => void persist({ timezone })}
                type="button"
              >
                {t("Dùng múi giờ này", "Use this timezone")}
              </button>
            }
            className="mb-3"
            icon={Globe2}
            tone="blue"
          >
            {t(
              `Múi giờ bạn chọn ở Hiển thị & tiền tệ là ${zoneLabel(timezone, true)}. Lần lưu tiếp theo sẽ chuyển giờ nhắc sang múi giờ này.`,
              `The timezone chosen under Display & currency is ${zoneLabel(timezone, false)}. The next save moves the reminders to it.`,
            )}
          </Notice>
        ) : null}

        <div
          className={cn(
            "divide-y divide-ledger-line border-y border-ledger-line transition-opacity",
            // Still editable while off; the fade only says they will not fire.
            !config.remindersEnabled && "opacity-60",
          )}
        >
          {config.reminderTimes.length ? (
            config.reminderTimes.map((time, index) => (
              <div className="flex items-center gap-3 py-3" key={`${time}-${index}`}>
                <Clock className="h-[18px] w-[18px] shrink-0 text-ledger-ink-2" />
                <SelectField
                  aria-label={t(`Mốc giờ ${index + 1}`, `Time ${index + 1}`)}
                  className="ledger-num h-10 text-[16px] font-semibold"
                  disabled={saving}
                  onChange={(event) => {
                    const next = [...config.reminderTimes];
                    next[index] = event.target.value;
                    void persist({ reminderTimes: next });
                  }}
                  value={time}
                  wrapperClassName="w-[128px]"
                >
                  {TIME_OPTIONS.map((option) => (
                    // The server merges duplicates silently, which would look
                    // like a row vanishing; better not to offer them at all.
                    <option
                      disabled={option !== time && config.reminderTimes.includes(option)}
                      key={option}
                      value={option}
                    >
                      {option}
                    </option>
                  ))}
                </SelectField>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ledger-muted">
                  {t("Mỗi ngày", "Every day")}
                </span>
                <button
                  aria-label={t(`Xoá mốc ${time}`, `Remove ${time}`)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ledger-muted transition-colors hover:bg-ledger-out-wash hover:text-ledger-out disabled:opacity-50"
                  disabled={saving}
                  onClick={() =>
                    void persist({
                      reminderTimes: config.reminderTimes.filter(
                        (_, position) => position !== index,
                      ),
                    })
                  }
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="py-4 text-[13.5px] text-ledger-ink-2">
              {t("Chưa có mốc giờ nào.", "No times yet.")}
            </p>
          )}
        </div>

        <button
          className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ledger-accent hover:underline disabled:cursor-not-allowed disabled:text-ledger-muted disabled:no-underline"
          disabled={saving || atLimit}
          onClick={() =>
            void persist({
              reminderTimes: [...config.reminderTimes, nextFreeTime(config.reminderTimes)],
            })
          }
          type="button"
        >
          <Plus className="h-4 w-4" />
          {t("Thêm mốc giờ", "Add a time")}
        </button>
        <p className="mt-1.5 text-[12.5px] text-ledger-muted">
          {t(
            `Tài khoản của bạn được đặt tối đa ${config.maxRemindersPerDay} mốc nhắc mỗi ngày.`,
            `Your account can schedule up to ${config.maxRemindersPerDay} reminders per day.`,
          )}
        </p>
      </Section>

      <SettingRow
        control={
          <Toggle
            checked={config.skipWhenAlreadyLogged}
            disabled={saving}
            label={t("Bỏ qua nếu đã ghi hôm nay", "Skip when already logged")}
            onChange={(checked) => void persist({ skipWhenAlreadyLogged: checked })}
          />
        }
        description={t(
          "Hôm nào bạn đã nhập giao dịch rồi thì không nhắc nữa cho đỡ phiền.",
          "No nudge on days where you already recorded a transaction.",
        )}
        inline
        title={t("Bỏ qua nếu đã ghi hôm nay", "Skip when already logged")}
      />

      <Section
        bare
        meta={
          config.deviceCount > 0 ? (
            <span className="ledger-num">
              {t(`${config.deviceCount} thiết bị`, `${config.deviceCount} device(s)`)}
            </span>
          ) : undefined
        }
        title={t("Thiết bị nhận thông báo", "Devices receiving notifications")}
      >
        <p className="-mt-1 text-[13.5px] text-ledger-ink-2">
          {config.deviceCount > 0
            ? t(
                `Đang có ${config.deviceCount} thiết bị nhận thông báo. Bật lại trên thiết bị mới để thêm.`,
                `${config.deviceCount} device(s) are set up. Enable again on a new device to add it.`,
              )
            : t(
                "Chưa có thiết bị nào. Bấm nút bên dưới để cho phép thông báo trên trình duyệt này.",
                "No device yet. Use the button below to allow notifications in this browser.",
              )}
        </p>

        <div className="mt-4 flex items-center gap-3 border-y border-ledger-line py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ledger-canvas text-ledger-ink-2">
            <DeviceIcon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-ledger-ink">
              {t("Trình duyệt này", "This browser")}
            </p>
            <p
              className={cn(
                "text-[12.5px]",
                !pushSupported || permission === "denied"
                  ? "text-ledger-out"
                  : permission === "granted"
                    ? "text-ledger-in"
                    : "text-ledger-muted",
              )}
            >
              {thisDeviceStatus}
            </p>
          </div>
          {pushSupported && permission === "granted" && config.deviceCount > 0 ? (
            <Button
              disabled={deviceBusy}
              onClick={() => void handleRemoveDevice()}
              size="sm"
              variant="ghost"
            >
              {t("Gỡ", "Remove")}
            </Button>
          ) : null}
        </div>

        {!pushSupported ? (
          <Notice className="mt-3" icon={BellRing} tone="amber">
            {t(
              "Trình duyệt hoặc thiết bị này không hỗ trợ thông báo đẩy.",
              "This browser or device does not support push notifications.",
            )}
          </Notice>
        ) : permission === "denied" ? (
          <Notice className="mt-3" icon={BellRing} tone="amber">
            {t(
              "Hãy mở phần cài đặt thông báo của trình duyệt và cho phép trang này.",
              "Open your browser notification settings and allow this site.",
            )}
          </Notice>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button
            disabled={!pushSupported || deviceBusy}
            icon={BellRing}
            onClick={() => void handleEnableDevice()}
            size="sm"
            variant="outline"
          >
            {t("Cho phép thông báo trên thiết bị này", "Allow notifications on this device")}
          </Button>
          <button
            className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ledger-accent hover:underline disabled:cursor-not-allowed disabled:text-ledger-muted disabled:no-underline"
            disabled={saving || config.deviceCount === 0}
            onClick={() => void handleSendTest()}
            type="button"
          >
            <Send className="h-4 w-4" />
            {t("Gửi thử ngay", "Send a test now")}
          </button>
        </div>
      </Section>
    </>
  );
};

/* ----------------------------------------------------------------- Account */

interface ProfileSnapshot {
  displayName?: string;
  username?: string;
  email?: string | null;
  avatar?: string | null;
}

const AccountTab: React.FC = () => {
  const t = useT();
  const { toast } = useToast();
  const { currentUser, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    // The session copy is enough to render; the profile call only picks up a
    // name changed on another device since sign-in.
    (async () => {
      try {
        const token = await getIdToken();
        const data = await userApi.getProfile(token);
        if (active) {
          setProfile(data);
        }
      } catch {
        // Keep showing the session copy.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const name = profile?.displayName || currentUser?.displayName || currentUser?.username || "";
  const email = profile?.email || currentUser?.email || "";
  const avatar = profile?.avatar || currentUser?.avatar || currentUser?.photoURL;

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch (error) {
      setSigningOut(false);
      toast({
        title: t("Không đăng xuất được", "Could not sign out"),
        description: errorMessage(error),
        variant: "destructive",
      });
    }
  };

  const fields = [
    { label: t("Tên hiển thị", "Display name"), value: name },
    { label: "Email", value: email },
  ];

  return (
    <>
      <Section
        action={
          <ButtonLink icon={PenLine} to="/profile">
            {t("Sửa hồ sơ", "Edit profile")}
          </ButtonLink>
        }
        title={t("Tài khoản", "Account")}
      >
        <div className="flex items-center gap-3.5 py-2">
          <Avatar name={name} size={48} src={avatar} />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold text-ledger-ink">{name || "—"}</p>
            <p className="truncate text-[13px] text-ledger-ink-2">{email || "—"}</p>
          </div>
        </div>
        <dl className="mt-3 divide-y divide-ledger-line border-t border-ledger-line">
          {fields.map((field) => (
            <div
              className="flex flex-col gap-0.5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              key={field.label}
            >
              <dt className="text-[13px] text-ledger-muted">{field.label}</dt>
              <dd className="min-w-0 truncate text-[14px] text-ledger-ink">{field.value || "—"}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-1 text-[12.5px] text-ledger-muted">
          {t(
            "Đổi tên, ảnh đại diện hoặc mật khẩu trong trang hồ sơ.",
            "Change your name, photo or password on the profile page.",
          )}
        </p>
      </Section>

      <SettingRow
        control={
          <Button
            disabled={signingOut}
            icon={LogOut}
            onClick={() => void handleLogout()}
            variant="danger"
          >
            {signingOut ? t("Đang đăng xuất…", "Signing out…") : t("Đăng xuất", "Sign out")}
          </Button>
        }
        description={t(
          "Thoát khỏi TonFin trên trình duyệt này. Dữ liệu của bạn vẫn được giữ nguyên.",
          "Leave TonFin on this browser. Your data stays as it is.",
        )}
        last
        title={t("Đăng xuất", "Sign out")}
      />
    </>
  );
};

/* -------------------------------------------------------------------- Page */

const SettingsPage: React.FC = () => {
  const t = useT();
  const { isVietnamese } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const tab: TabId = isTabId(requested) ? requested : "appearance";
  const chipRowRef = useRef<HTMLDivElement>(null);

  // A deep link such as ?tab=reminders lands on a chip that starts off-screen
  // on a phone; bring it into the row so the user sees where they are.
  // Scrolling the row itself, not scrollIntoView, keeps the page still.
  useEffect(() => {
    const row = chipRowRef.current;
    const active = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !active) {
      return;
    }
    const rowBox = row.getBoundingClientRect();
    const chipBox = active.getBoundingClientRect();
    if (chipBox.left < rowBox.left || chipBox.right > rowBox.right) {
      row.scrollLeft += chipBox.left - rowBox.left - 16;
    }
  }, [tab]);

  // Unlike the one-shot links elsewhere (?create=1, ?reconcile=), the tab is
  // state worth keeping: it survives a refresh and can be linked to.
  const selectTab = (next: TabId) =>
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.set("tab", next);
        return params;
      },
      { replace: true },
    );

  // Browsers do not show a push while the page has focus, so a test sent from
  // here would otherwise vanish. v1 listened for as long as Settings was open;
  // the same scope is kept, whichever tab is showing.
  useEffect(() => {
    let active = true;
    let stop: (() => void) | undefined;

    void listenForForegroundMessages().then((unsubscribe) => {
      if (active) {
        stop = unsubscribe;
      } else {
        unsubscribe();
      }
    });

    return () => {
      active = false;
      stop?.();
    };
  }, []);

  return (
    <div>
      <PageHeader
        subtitle={t(
          "Giao diện, hiển thị, nhắc nhở và tài khoản. Mọi thay đổi được áp dụng ngay.",
          "Appearance, display, reminders and your account. Changes apply immediately.",
        )}
        title={t("Cài đặt", "Settings")}
      />

      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
        {/* Phone: the tabs become a chip row that scrolls sideways. */}
        <div
          className="ledger-scroll-x -mx-4 flex gap-2 border-b border-ledger-line px-4 py-3 sm:-mx-6 sm:px-6 lg:hidden"
          ref={chipRowRef}
        >
          {TABS.map((item) => (
            <Chip
              icon={item.icon}
              key={item.id}
              onClick={() => selectTab(item.id)}
              selected={tab === item.id}
            >
              {isVietnamese ? item.vi : item.en}
            </Chip>
          ))}
        </div>

        <nav
          aria-label={t("Mục cài đặt", "Settings sections")}
          aria-orientation="vertical"
          className="hidden flex-col gap-1 border-r border-ledger-line py-6 pr-4 lg:flex"
          role="tablist"
        >
          {TABS.map((item) => {
            const Icon = item.icon;
            const selected = tab === item.id;
            return (
              <button
                aria-controls="settings-panel"
                aria-selected={selected}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-[10px] px-3 text-left text-[14px] transition-colors",
                  selected
                    ? "bg-ledger-accent-wash font-semibold text-ledger-accent"
                    : "text-ledger-ink-2 hover:bg-ledger-canvas hover:text-ledger-ink",
                )}
                key={item.id}
                onClick={() => selectTab(item.id)}
                role="tab"
                type="button"
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{isVietnamese ? item.vi : item.en}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 lg:pl-10" id="settings-panel" role="tabpanel">
          {tab === "appearance" ? <AppearanceTab /> : null}
          {tab === "display" ? <DisplayTab /> : null}
          {tab === "reminders" ? <RemindersTab /> : null}
          {tab === "account" ? <AccountTab /> : null}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
