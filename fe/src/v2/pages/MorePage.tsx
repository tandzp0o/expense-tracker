import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, IdCard, LayoutGrid, LogOut, Settings, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "contexts/AuthContext";
import { useLocale } from "contexts/LocaleContext";
import { useNavigationLock } from "contexts/NavigationLockContext";
import { cn } from "lib/utils";
import { Card, CardHeader, IconBadge, PageHeader, type Tone } from "../components/primitives";
import { Avatar } from "../components/Avatar";
import { LEDGER_NAV } from "../layout/nav";
import { useT } from "../lib/i18n";

/**
 * What each page is for, in a few words, so the list reads as a menu of jobs
 * rather than a column of nouns. A page added to the nav later without an
 * entry here falls back to its group's name.
 */
const PAGE_INFO: Record<string, { vi: string; en: string; tone: Tone }> = {
  "/goals": { vi: "Tiết kiệm cho điều bạn muốn", en: "Save up for what you want", tone: "in" },
  "/wallets": { vi: "Số dư, chuyển ví, đối chiếu", en: "Balances, transfers, reconciling", tone: "accent" },
  "/analytics": { vi: "Tiền đi đâu, so với tháng trước", en: "Where money goes, month on month", tone: "accent" },
  "/dishes": { vi: "Quán quen, ghi chi một chạm", en: "Favourite places, one-tap expenses", tone: "spend" },
};

const Row: React.FC<{
  to?: string;
  onClick?: () => void;
  icon: LucideIcon;
  tone?: Tone;
  label: string;
  description?: string;
  danger?: boolean;
  locked?: boolean;
  onLocked?: () => void;
}> = ({ to, onClick, icon, tone = "neutral", label, description, danger, locked, onLocked }) => {
  const classes = cn(
    "-mx-2 flex w-[calc(100%+1rem)] items-center gap-3.5 rounded-[12px] px-2 py-3 text-left transition-colors hover:bg-ledger-hover",
    locked && "opacity-45",
  );
  const content = (
    <>
      <IconBadge icon={icon} size="md" tone={danger ? "out" : tone} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[15px] font-semibold leading-snug",
            danger ? "text-ledger-out" : "text-ledger-ink",
          )}
        >
          {label}
        </span>
        {description ? (
          <span className="block text-[13px] leading-snug text-ledger-muted">{description}</span>
        ) : null}
      </span>
      {!danger ? <ChevronRight className="h-4 w-4 shrink-0 text-ledger-muted" /> : null}
    </>
  );

  if (locked) {
    return (
      <button aria-disabled="true" className={classes} onClick={onLocked} type="button">
        {content}
      </button>
    );
  }

  return to ? (
    <Link className={classes} to={to}>
      {content}
    </Link>
  ) : (
    <button className={classes} onClick={onClick} type="button">
      {content}
    </button>
  );
};

/**
 * The same page as a tile, for a screen wide enough to lay the pages out as a
 * grid: the icon, then the name and what it is for.
 */
const PageTile: React.FC<{
  to: string;
  icon: LucideIcon;
  tone: Tone;
  label: string;
  description: string;
  locked?: boolean;
  onLocked?: () => void;
}> = ({ to, icon, tone, label, description, locked, onLocked }) => {
  const classes = cn(
    "group flex min-h-[136px] w-full flex-col justify-between rounded-[14px] border border-ledger-line p-4 text-left transition-colors hover:border-ledger-line-strong hover:bg-ledger-hover xl:p-5",
    locked && "opacity-45",
  );
  const content = (
    <>
      <span className="flex items-start justify-between gap-3">
        <IconBadge icon={icon} size="md" tone={tone} />
        <ChevronRight className="h-4 w-4 text-ledger-muted transition-colors group-hover:text-ledger-accent" />
      </span>
      <span className="mt-4 block">
        <span className="block text-[15px] font-semibold leading-snug text-ledger-ink">{label}</span>
        <span className="block text-[13px] leading-snug text-ledger-muted">{description}</span>
      </span>
    </>
  );

  return locked ? (
    <button aria-disabled="true" className={classes} onClick={onLocked} type="button">
      {content}
    </button>
  ) : (
    <Link className={classes} to={to}>
      {content}
    </Link>
  );
};

/**
 * The phone's fifth tab. Screens that do not earn a tab of their own live here
 * so the bottom bar stays at five targets a thumb can hit without looking.
 */
const MorePage: React.FC = () => {
  const t = useT();
  const { isVietnamese } = useLocale();
  const { currentUser, logout } = useAuth();
  const { isItemLocked, notifyNavigationLocked } = useNavigationLock();
  const name = currentUser?.displayName || currentUser?.username || "";
  // Overview, transactions and budgets already have tabs.
  const tabbed = new Set(["/dashboard", "/transactions", "/budgets"]);
  const pages = LEDGER_NAV.flatMap((group) =>
    group.items
      .filter((item) => !tabbed.has(item.to))
      .map((item) => ({ ...item, group })),
  );
  const profileLocked = isItemLocked("/profile");
  const describe = (item: (typeof pages)[number]) => {
    const info = PAGE_INFO[item.to];
    if (info) {
      return isVietnamese ? info.vi : info.en;
    }
    return isVietnamese ? item.group.vi : item.group.en;
  };

  const identity = (
    <>
      {currentUser?.avatar || currentUser?.photoURL ? (
        <Avatar name={name} size={56} src={currentUser?.avatar || currentUser?.photoURL} />
      ) : (
        // The shared avatar keeps a 13px initial, lost in a 56px circle.
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ledger-accent-wash text-[21px] font-semibold text-ledger-accent"
        >
          {(name || "?").trim().charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="break-words text-[17px] font-semibold leading-snug text-ledger-ink">
          {name || t("Chưa đặt tên", "No name yet")}
        </p>
        {currentUser?.email ? (
          <p className="break-all text-[13.5px] text-ledger-ink-2">{currentUser.email}</p>
        ) : null}
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-ledger-accent">
        {t("Hồ sơ", "Profile")}
        <ChevronRight className="h-4 w-4" />
      </span>
    </>
  );
  const identityClasses = cn(
    "flex w-full items-center gap-3.5 rounded-[18px] border border-ledger-line bg-ledger-paper p-4 text-left shadow-card transition-colors hover:bg-ledger-hover sm:p-5 xl:p-6",
    profileLocked && "opacity-45",
  );

  return (
    <div>
      <PageHeader
        subtitle={t("Các trang khác, hồ sơ và cài đặt", "Other pages, your profile and settings")}
        title={t("Thêm", "More")}
      />

      {/* Phone: you, then the pages, then the account. Wide screen: the pages
          take the main column and you sit beside them. */}
      <div className="grid gap-3 sm:gap-4 xl:grid-cols-12 xl:grid-rows-[auto_1fr] xl:items-start xl:gap-5">
        {profileLocked ? (
          <button
            aria-disabled="true"
            className={cn(identityClasses, "xl:col-span-4 xl:col-start-9 xl:row-start-1")}
            onClick={notifyNavigationLocked}
            type="button"
          >
            {identity}
          </button>
        ) : (
          <Link className={cn(identityClasses, "xl:col-span-4 xl:col-start-9 xl:row-start-1")} to="/profile">
            {identity}
          </Link>
        )}

        <Card className="flex flex-col xl:col-span-8 xl:col-start-1 xl:row-span-2 xl:row-start-1 xl:self-stretch">
          <CardHeader
            icon={LayoutGrid}
            meta={String(pages.length)}
            subtitle={t("Những trang không có trên thanh dưới", "Pages that are not on the bottom bar")}
            title={t("Trang khác", "Other pages")}
          />
          {/* A list of rows on a phone; a grid of tiles once there is room. */}
          <div className="grid gap-y-1 md:hidden">
            {pages.map((item) => (
              <Row
                description={describe(item)}
                icon={item.icon}
                key={item.to}
                label={isVietnamese ? item.vi : item.en}
                locked={isItemLocked(item.to)}
                onLocked={notifyNavigationLocked}
                to={item.to}
                tone={PAGE_INFO[item.to]?.tone || "accent"}
              />
            ))}
          </div>
          <div className="hidden flex-1 gap-3 md:grid md:grid-cols-2 xl:gap-4">
            {pages.map((item) => (
              <PageTile
                description={describe(item)}
                icon={item.icon}
                key={item.to}
                label={isVietnamese ? item.vi : item.en}
                locked={isItemLocked(item.to)}
                onLocked={notifyNavigationLocked}
                to={item.to}
                tone={PAGE_INFO[item.to]?.tone || "accent"}
              />
            ))}
          </div>
        </Card>

        <Card className="xl:col-span-4 xl:col-start-9 xl:row-start-2">
          <CardHeader icon={IdCard} title={t("Tài khoản", "Account")} tone="neutral" />
          <div className="grid gap-y-1">
            <Row
              description={t("Tên, ảnh, số điện thoại", "Name, photo, phone")}
              icon={UserRound}
              label={t("Hồ sơ", "Profile")}
              locked={profileLocked}
              onLocked={notifyNavigationLocked}
              to="/profile"
            />
            <Row
              description={t("Giao diện, tiền tệ, nhắc nhở", "Appearance, currency, reminders")}
              icon={Settings}
              label={t("Cài đặt", "Settings")}
              locked={isItemLocked("/settings")}
              onLocked={notifyNavigationLocked}
              to="/settings"
            />
            <Row
              danger
              description={t("Thoát trên thiết bị này", "Leave on this device")}
              icon={LogOut}
              label={t("Đăng xuất", "Sign out")}
              onClick={() => void logout()}
            />
          </div>
        </Card>
      </div>

      <p className="pt-8 text-center text-[12px] text-ledger-muted">TonFin · v2</p>
    </div>
  );
};

export default MorePage;
