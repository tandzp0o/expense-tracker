import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    ChevronDown,
    LogOut,
    Menu,
    Settings,
    UserRound,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { Avatar } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { buildNavigationItems } from "./navigation";
import { cn } from "../lib/utils";

interface HeaderProps {
    onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout, currentUser } = useAuth();
    const { language, isVietnamese } = useLocale();
    const [menuOpen, setMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const navigationItems = useMemo(
        () => buildNavigationItems(language),
        [language],
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const syncScrollState = () => {
            setIsScrolled(window.scrollY > 16);
        };

        syncScrollState();
        window.addEventListener("scroll", syncScrollState, { passive: true });

        return () => window.removeEventListener("scroll", syncScrollState);
    }, []);

    const currentPage = useMemo(
        () =>
            navigationItems.find((item) => item.to === location.pathname) || {
                label: "FinTrack",
            },
        [location.pathname, navigationItems],
    );

    return (
        <header
            className={cn(
                "sticky top-0 z-40 px-3 transition-[padding] duration-200 md:px-4",
                isScrolled ? "pt-3" : "pt-1 md:pt-2",
            )}
        >
            <div
                className={cn(
                    "app-header-shell mx-auto flex h-[72px] w-full max-w-[1600px] items-center justify-between gap-4 px-4 md:px-6",
                    isScrolled && "is-scrolled",
                )}
            >
                <div className="flex items-center gap-3">
                    <Button
                        className="md:hidden"
                        onClick={onMenuClick}
                        size="icon"
                        variant="outline"
                    >
                        <Menu className="h-4 w-4" />
                    </Button>
                    <div>
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            {isVietnamese ? "Không gian làm việc" : "Workspace"}
                        </p>
                        <h1 className="text-base font-semibold text-foreground">
                            {currentPage.label}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <ThemeSwitcher />

                    <div className="relative" ref={menuRef}>
                        <button
                            className={cn(
                                "app-header-user-trigger flex items-center gap-3 rounded-[var(--app-radius-lg)] px-3 py-2 text-left transition-colors",
                                isScrolled && "is-scrolled",
                            )}
                            onClick={() => setMenuOpen((current) => !current)}
                            type="button"
                        >
                            <Avatar
                                alt={currentUser?.displayName}
                                fallback={currentUser?.displayName || "FT"}
                                src={currentUser?.avatar || currentUser?.photoURL || undefined}
                            />
                            <div className="hidden sm:block">
                                <p className="text-sm font-medium text-foreground">
                                    {currentUser?.displayName ||
                                        (isVietnamese
                                            ? "Người dùng FinTrack"
                                            : "FinTrack user")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {currentUser?.email ||
                                        (isVietnamese
                                            ? "Đã xác thực"
                                            : "Authenticated")}
                                </p>
                            </div>
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </button>

                        {menuOpen ? (
                            <div className="glass-panel absolute right-0 mt-3 w-56 rounded-[var(--app-radius-lg)] border border-border/80 bg-card/95 p-2 shadow-soft backdrop-blur-xl">
                                <Link
                                    className={cn(
                                        "flex items-center gap-3 rounded-[var(--app-radius-md)] px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                                    )}
                                    onClick={() => setMenuOpen(false)}
                                    to="/profile"
                                >
                                    <UserRound className="h-4 w-4" />
                                    <span>
                                        {isVietnamese
                                            ? "Hồ sơ cá nhân"
                                            : "Profile"}
                                    </span>
                                </Link>
                                <Link
                                    className={cn(
                                        "flex items-center gap-3 rounded-[var(--app-radius-md)] px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                                    )}
                                    onClick={() => setMenuOpen(false)}
                                    to="/settings"
                                >
                                    <Settings className="h-4 w-4" />
                                    <span>
                                        {isVietnamese
                                            ? "Cài đặt hệ thống"
                                            : "Settings"}
                                    </span>
                                </Link>
                                <button
                                    className="flex w-full items-center gap-3 rounded-[var(--app-radius-md)] px-3 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                    onClick={async () => {
                                        setMenuOpen(false);
                                        await logout();
                                        navigate("/login");
                                    }}
                                    type="button"
                                >
                                    <LogOut className="h-4 w-4" />
                                    <span>
                                        {isVietnamese
                                            ? "Đăng xuất"
                                            : "Sign out"}
                                    </span>
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
