import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, Moon, Settings, Sun, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "contexts/AuthContext";
import { useNavigationLock } from "contexts/NavigationLockContext";
import { useTheme } from "contexts/ThemeContext";
import { useToast } from "contexts/ToastContext";
import { cn } from "lib/utils";
import { useT } from "../lib/i18n";
import { Avatar } from "./Avatar";

const MenuItem: React.FC<{
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
  locked?: boolean;
}> = ({ icon: Icon, label, onClick, tone = "default", locked }) => (
  <button
    className={cn(
      "flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[14px] font-medium transition-colors",
      tone === "danger"
        ? "text-ledger-out hover:bg-ledger-out-wash"
        : "text-ledger-ink hover:bg-ledger-hover",
      locked && "opacity-50",
    )}
    onClick={onClick}
    role="menuitem"
    type="button"
  >
    <Icon className="h-[18px] w-[18px] shrink-0" />
    {label}
  </button>
);

/**
 * The avatar in the page header on phones and tablets, where there is no side
 * rail to hold the account. Tapping it opens a small menu: who is signed in,
 * profile, settings, a light/dark switch and sign out.
 */
export const AccountMenu: React.FC<{ className?: string }> = ({ className }) => {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const { isItemLocked, notifyNavigationLocked } = useNavigationLock();
  const { appearance, updateAppearance } = useTheme();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const name = currentUser?.displayName || currentUser?.username || "";
  const avatarSrc = currentUser?.avatar || currentUser?.photoURL;
  const isDark = appearance.mode === "dark";

  // Close on a tap outside, on Escape (returning focus to the avatar), and
  // whenever the route changes.
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const go = (path: string) => {
    // The new-user lock (create a wallet first) applies here as in the rail.
    if (isItemLocked(path)) {
      setOpen(false);
      notifyNavigationLocked();
      return;
    }
    setOpen(false);
    navigate(path);
  };

  const signOut = async () => {
    setOpen(false);
    try {
      await logout();
    } catch (error: any) {
      toast({
        title: t("Chưa đăng xuất được", "Could not sign out"),
        description: error?.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className={cn("relative", className)} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("Tài khoản", "Account")}
        className="flex rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-[color:var(--l-page)] transition hover:ring-ledger-line-strong"
        onClick={() => setOpen((value) => !value)}
        ref={buttonRef}
        type="button"
      >
        <Avatar name={name} size={40} src={avatarSrc} />
      </button>

      {open ? (
        <div
          className="ledger-backdrop absolute right-0 top-[calc(100%+10px)] z-40 w-[min(288px,calc(100vw-32px))] rounded-[16px] border border-ledger-line bg-ledger-paper p-2 shadow-float"
          role="menu"
        >
          <div className="flex items-center gap-3 px-3 pb-3 pt-2">
            <Avatar name={name} size={44} src={avatarSrc} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ledger-ink">
                {name || t("Tài khoản của bạn", "Your account")}
              </p>
              {currentUser?.email ? (
                <p className="truncate text-[12.5px] text-ledger-muted">{currentUser.email}</p>
              ) : null}
            </div>
          </div>

          <div className="border-t border-ledger-line pt-1.5">
            <MenuItem
              icon={UserRound}
              label={t("Hồ sơ", "Profile")}
              locked={isItemLocked("/profile")}
              onClick={() => go("/profile")}
            />
            <MenuItem
              icon={Settings}
              label={t("Cài đặt", "Settings")}
              locked={isItemLocked("/settings")}
              onClick={() => go("/settings")}
            />
            <MenuItem
              icon={isDark ? Sun : Moon}
              label={isDark ? t("Giao diện sáng", "Light mode") : t("Giao diện tối", "Dark mode")}
              onClick={() => updateAppearance({ mode: isDark ? "light" : "dark" })}
            />
          </div>

          <div className="mt-1.5 border-t border-ledger-line pt-1.5">
            <MenuItem icon={LogOut} label={t("Đăng xuất", "Sign out")} onClick={signOut} tone="danger" />
          </div>
        </div>
      ) : null}
    </div>
  );
};
