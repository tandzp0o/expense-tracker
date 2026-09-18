import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ChartPie,
  Ellipsis,
  LayoutDashboard,
  Plus,
  ReceiptText,
  Settings,
} from "lucide-react";
import { useAuth } from "contexts/AuthContext";
import { useLocale } from "contexts/LocaleContext";
import { useNavigationLock } from "contexts/NavigationLockContext";
import { cn } from "lib/utils";
import { LedgerProvider, useLedger } from "../LedgerContext";
import { useT } from "../lib/i18n";
import { LEDGER_NAV } from "./nav";
import { SkeletonRows } from "../components/primitives";

const Avatar: React.FC<{ src?: string | null; name: string; size?: number }> = ({
  src,
  name,
  size = 32,
}) =>
  src ? (
    <img
      alt=""
      className="shrink-0 rounded-full object-cover"
      src={src}
      style={{ height: size, width: size }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-ledger-accent-wash font-semibold text-ledger-accent"
      // The initial scales with the circle instead of staying 13px.
      style={{ fontSize: Math.round(size * 0.42), height: size, width: size }}
    >
      {(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );

const Rail: React.FC = () => {
  const t = useT();
  const { isVietnamese } = useLocale();
  const { currentUser } = useAuth();
  const { isItemLocked, notifyNavigationLocked } = useNavigationLock();
  const { openQuickAdd } = useLedger();
  const name = currentUser?.displayName || currentUser?.username || "";
  const settingsLocked = isItemLocked("/settings");

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-ledger-line bg-ledger-paper lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <img alt="" className="h-7 w-7 rounded-[8px] object-cover" src="/logo192.png" />
        <span className="text-[17px] font-semibold tracking-[-0.02em] text-ledger-ink">
          TonFin
        </span>
      </div>

      <div className="px-4 pb-2">
        <button
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-ledger-accent text-[14px] font-semibold text-ledger-accent-ink transition hover:brightness-110"
          onClick={() => openQuickAdd()}
          type="button"
        >
          <Plus className="h-4 w-4" />
          {t("Ghi nhanh", "Quick add")}
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {LEDGER_NAV.map((group) => (
          <div className="mt-4 first:mt-2" key={group.en}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-ledger-muted">
              {isVietnamese ? group.vi : group.en}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const label = isVietnamese ? item.vi : item.en;

              if (isItemLocked(item.to)) {
                return (
                  <button
                    aria-disabled="true"
                    className="flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-[14px] text-ledger-muted opacity-50"
                    key={item.to}
                    onClick={notifyNavigationLocked}
                    type="button"
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {label}
                  </button>
                );
              }

              return (
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      "flex h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] transition-colors",
                      isActive
                        ? "bg-ledger-accent-wash font-semibold text-ledger-accent"
                        : "text-ledger-ink-2 hover:bg-ledger-canvas hover:text-ledger-ink",
                    )
                  }
                  key={item.to}
                  to={item.to}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {label}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-3 border-t border-ledger-line px-4 py-3.5">
        <NavLink
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] p-1 hover:bg-ledger-canvas"
          to="/profile"
        >
          <Avatar name={name} src={currentUser?.avatar || currentUser?.photoURL} />
          <span className="truncate text-[14px] font-medium text-ledger-ink">{name}</span>
        </NavLink>
        {settingsLocked ? (
          <button
            aria-label={t("Cài đặt", "Settings")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ledger-muted opacity-50"
            onClick={notifyNavigationLocked}
            type="button"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
        ) : (
          <NavLink
            aria-label={t("Cài đặt", "Settings")}
            className={({ isActive }) =>
              cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                isActive
                  ? "bg-ledger-accent-wash text-ledger-accent"
                  : "text-ledger-ink-2 hover:bg-ledger-canvas hover:text-ledger-ink",
              )
            }
            to="/settings"
          >
            <Settings className="h-[18px] w-[18px]" />
          </NavLink>
        )}
      </div>
    </aside>
  );
};

/** Paths that live behind the "Thêm" tab rather than having a tab of their own. */
const MORE_PATHS = ["/more", "/goals", "/wallets", "/analytics", "/dishes", "/profile", "/settings"];

const TabBar: React.FC = () => {
  const t = useT();
  const location = useLocation();
  const { openQuickAdd } = useLedger();
  const { isItemLocked, notifyNavigationLocked } = useNavigationLock();

  const tabs = [
    { to: "/dashboard", label: t("Tổng quan", "Overview"), icon: LayoutDashboard },
    { to: "/transactions", label: t("Giao dịch", "Activity"), icon: ReceiptText },
    null,
    { to: "/budgets", label: t("Ngân sách", "Budgets"), icon: ChartPie },
    { to: "/more", label: t("Thêm", "More"), icon: Ellipsis },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ledger-line bg-ledger-paper pb-[env(safe-area-inset-bottom,0px)] lg:hidden">
      <div className="mx-auto grid h-[62px] max-w-[520px] grid-cols-5">
        {tabs.map((tab) => {
          if (!tab) {
            return (
              <div className="flex items-start justify-center" key="add">
                <button
                  aria-label={t("Ghi nhanh", "Quick add")}
                  className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-ledger-accent text-ledger-accent-ink shadow-float active:scale-95"
                  onClick={() => openQuickAdd()}
                  type="button"
                >
                  <Plus className="h-6 w-6" />
                </button>
              </div>
            );
          }

          const Icon = tab.icon;
          const active =
            tab.to === "/more"
              ? MORE_PATHS.some((path) => location.pathname.startsWith(path))
              : location.pathname.startsWith(tab.to);
          const classes = cn(
            "flex flex-col items-center justify-center gap-1 text-[11px] font-medium",
            active ? "text-ledger-accent" : "text-ledger-muted",
          );

          if (tab.to !== "/more" && isItemLocked(tab.to)) {
            return (
              <button
                aria-disabled="true"
                className={cn(classes, "opacity-40")}
                key={tab.to}
                onClick={notifyNavigationLocked}
                type="button"
              >
                <Icon className="h-[22px] w-[22px]" />
                {tab.label}
              </button>
            );
          }

          return (
            <NavLink className={classes} key={tab.to} to={tab.to}>
              <Icon className="h-[22px] w-[22px]" />
              {tab.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

/**
 * The v2 shell. No global header: every page opens with its own title row,
 * and "Ghi nhanh" is always one click (desktop) or one thumb (phone) away.
 */
export const LedgerLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="ledger">
    <LedgerProvider>
      <Rail />
      <main className="min-h-screen lg:pl-[232px]">
        <div className="ledger-page mx-auto w-full max-w-[1720px] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+96px)] sm:px-6 lg:px-8 lg:pb-16 2xl:px-10">
          {/* Pages load on first visit; the rail and tab bar stay put meanwhile. */}
          <React.Suspense
            fallback={
              <div className="pt-10">
                <SkeletonRows rows={6} />
              </div>
            }
          >
            {children}
          </React.Suspense>
        </div>
      </main>
      <TabBar />
    </LedgerProvider>
  </div>
);

export { Avatar };
