import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, LogOut, Settings, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "contexts/AuthContext";
import { useLocale } from "contexts/LocaleContext";
import { useNavigationLock } from "contexts/NavigationLockContext";
import { cn } from "lib/utils";
import { Eyebrow, PageHeader } from "../components/primitives";
import { Avatar } from "../layout/LedgerLayout";
import { LEDGER_NAV } from "../layout/nav";
import { useT } from "../lib/i18n";

const Row: React.FC<{
  to?: string;
  onClick?: () => void;
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  locked?: boolean;
  onLocked?: () => void;
}> = ({ to, onClick, icon: Icon, label, danger, locked, onLocked }) => {
  const classes = cn(
    "flex h-14 w-full items-center gap-3.5 border-b border-ledger-line text-left last:border-b-0",
    danger ? "text-ledger-out" : "text-ledger-ink",
    locked && "opacity-45",
  );
  const content = (
    <>
      <Icon className={cn("h-5 w-5", danger ? "text-ledger-out" : "text-ledger-ink-2")} />
      <span className="flex-1 text-[15px]">{label}</span>
      {!danger ? <ChevronRight className="h-4 w-4 text-ledger-muted" /> : null}
    </>
  );

  if (locked) {
    return (
      <button className={classes} onClick={onLocked} type="button">
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

  return (
    <div>
      <PageHeader title={t("Thêm", "More")} />

      <Link
        className="flex items-center gap-3.5 border-b border-ledger-line py-5"
        to="/profile"
      >
        <Avatar name={name} size={52} src={currentUser?.avatar || currentUser?.photoURL} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold text-ledger-ink">{name}</p>
          <p className="truncate text-[13px] text-ledger-ink-2">{currentUser?.email}</p>
        </div>
        <span className="text-[13px] font-medium text-ledger-accent">
          {t("Sửa hồ sơ", "Edit profile")}
        </span>
      </Link>

      {LEDGER_NAV.map((group) => {
        const items = group.items.filter((item) => !tabbed.has(item.to));
        if (!items.length) {
          return null;
        }

        return (
          <section className="pt-6" key={group.en}>
            <Eyebrow>{isVietnamese ? group.vi : group.en}</Eyebrow>
            <div className="mt-1">
              {items.map((item) => (
                <Row
                  icon={item.icon}
                  key={item.to}
                  label={isVietnamese ? item.vi : item.en}
                  locked={isItemLocked(item.to)}
                  onLocked={notifyNavigationLocked}
                  to={item.to}
                />
              ))}
            </div>
          </section>
        );
      })}

      <section className="pt-6">
        <Eyebrow>{t("Tài khoản", "Account")}</Eyebrow>
        <div className="mt-1">
          <Row
            icon={UserRound}
            label={t("Hồ sơ", "Profile")}
            locked={isItemLocked("/profile")}
            onLocked={notifyNavigationLocked}
            to="/profile"
          />
          <Row
            icon={Settings}
            label={t("Cài đặt", "Settings")}
            locked={isItemLocked("/settings")}
            onLocked={notifyNavigationLocked}
            to="/settings"
          />
          <Row
            danger
            icon={LogOut}
            label={t("Đăng xuất", "Sign out")}
            onClick={() => void logout()}
          />
        </div>
      </section>

      <p className="pt-10 text-center text-[12px] text-ledger-muted">TonFin · v2</p>
    </div>
  );
};

export default MorePage;
