import React, { useEffect, useState } from "react";
import { Mic, PencilLine, ScanLine, Sparkles } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import Header from "./Header";
import Sidenav from "./Sidenav";
import Footer from "./Footer";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { getAppearanceGradientColors, useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { buildMobileNavigationItems } from "./navigation";
import { Dialog } from "../components/ui/dialog";
import { Sheet } from "../components/ui/sheet";
import { cn, hexToRgba } from "../lib/utils";

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const { currentUser } = useAuth();
    const { language, isVietnamese } = useLocale();
    const { appearance } = useTheme();
    const { toast } = useToast();
    const themeColors = getAppearanceGradientColors(appearance);
    const mobileNavigationItems = buildMobileNavigationItems(language);
    const navigationLocked = !!currentUser?.newUser;
    const primaryGradient = `linear-gradient(135deg, ${hexToRgba(
        themeColors.primary,
        0.98,
    )} 0%, ${hexToRgba(themeColors.secondary, 0.82)} 52%, rgba(15, 23, 42, 0.9) 100%)`;
    const secondaryGradient = `linear-gradient(135deg, ${hexToRgba(
        themeColors.secondary,
        0.88,
    )} 0%, ${hexToRgba(themeColors.primary, 0.7)} 100%)`;
    const isItemLocked = (target: string) =>
        navigationLocked && target !== "/wallets";
    const handleQuickAction = (mode: "manual" | "voice" | "scan" | "assistant") => {
        setQuickAddOpen(false);

        if (mode === "assistant") {
            toast({
                title: isVietnamese ? "AI gợi ý đang chờ nối backend" : "AI assistant is waiting for backend wiring",
                description: isVietnamese
                    ? "Mình sẽ đưa bạn sang phân tích để xem nhanh các nhắc nhở và gợi ý trước."
                    : "Opening analytics first so you can review reminders and suggestions.",
            });
            navigate("/analytics?assistant=1");
            return;
        }

        if (mode === "voice" || mode === "scan") {
            toast({
                title: isVietnamese ? "Luồng AI đang được chuẩn bị" : "AI entry is being prepared",
                description: isVietnamese
                    ? "Tạm thời mình mở form giao dịch để bạn kiểm tra và bổ sung trước khi nối AI nhận diện."
                    : "Opening the transaction form for now while AI capture is being wired in.",
            });
        }

        navigate(`/transactions?composer=${mode}`);
    };

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
            if (window.innerWidth >= 1024) {
                setMenuOpen(false);
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <div className="app-shell">
            <div className="mx-auto flex min-h-screen w-full max-w-[1940px] gap-2 px-2 py-2 sm:gap-3 sm:px-3 sm:py-3 md:gap-4 md:px-4">
                <aside className="hidden w-[280px] shrink-0 lg:block">
                    <div className="glass-panel app-sidebar-panel sticky top-3 h-[calc(100vh-1.5rem)] overflow-hidden rounded-[var(--app-radius-xl)] border border-border shadow-soft">
                        <Sidenav />
                    </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="glass-panel app-content-panel rounded-[var(--app-radius-xl)] border border-border">
                        <Header onMenuClick={() => setMenuOpen(true)} />
                        <main
                            className={cn(
                                "app-main-surface min-h-[calc(100vh-120px)] px-3 py-3.5 sm:px-4 sm:py-5 md:px-5 md:py-6",
                                isMobile
                                    ? "pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]"
                                    : "pb-6",
                            )}
                        >
                            <div className="mx-auto w-full max-w-[1600px]">
                                {children}
                                <Footer />
                            </div>
                        </main>
                    </div>
                </div>
            </div>

            <Sheet
                description={
                    isVietnamese
                        ? "Điều hướng giữa các phân hệ tài chính."
                        : "Navigate between your finance modules."
                }
                onClose={() => setMenuOpen(false)}
                open={menuOpen}
                side="left"
                title={isVietnamese ? "Điều hướng" : "Navigation"}
            >
                <Sidenav onCloseMenu={() => setMenuOpen(false)} />
            </Sheet>

            {isMobile ? (
                <nav className="mobile-bottom-nav fixed bottom-[calc(env(safe-area-inset-bottom,0px)+0.65rem)] left-4 right-4 z-30 mx-auto max-w-[430px] overflow-visible rounded-[1.75rem] border px-2.5 py-2 lg:hidden">
                    <div className="mobile-bottom-nav-sheen pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem]" />
                    <div className="relative grid grid-cols-5 gap-1">
                        {mobileNavigationItems.map((item) => {
                            const Icon = item.icon;
                            const locked = isItemLocked(item.to);
                            const isPrimary = "isPrimary" in item && item.isPrimary;

                            if (locked) {
                                return (
                                    <button
                                        key={item.to}
                                        aria-disabled="true"
                                        className={cn(
                                            "flex min-w-0 cursor-not-allowed flex-col items-center justify-center text-center",
                                            isPrimary
                                                ? "-mt-7 gap-1 px-0 pb-0 pt-0"
                                                : "h-12 gap-1 rounded-[1.1rem] px-1 text-[9px] font-semibold text-muted-foreground/45 sm:text-[10px]",
                                        )}
                                        disabled
                                        type="button"
                                    >
                                        {isPrimary ? (
                                            <>
                                                <span className="flex h-14 w-14 items-center justify-center rounded-full border-[6px] border-white bg-muted text-muted-foreground/45 shadow-[0_14px_32px_-20px_rgba(15,23,42,0.7)] dark:border-slate-950">
                                                    <Icon className="h-5 w-5" />
                                                </span>
                                                <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-[9px] font-semibold leading-none text-muted-foreground/45 sm:text-[10px]">
                                                    {item.label}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap leading-none">
                                                    {item.label}
                                                </span>
                                            </>
                                        )}
                                    </button>
                                );
                            }

                            if (isPrimary) {
                                return (
                                    <button
                                        key={item.to}
                                        className={cn(
                                            "relative z-[1] flex min-w-0 -mt-7 flex-col items-center justify-center gap-1 px-0 pb-0 pt-0 text-center transition-all",
                                            "text-foreground",
                                        )}
                                        onClick={() => setQuickAddOpen(true)}
                                        type="button"
                                    >
                                        <span
                                            className="flex h-14 w-14 items-center justify-center rounded-full border-[6px] border-white text-white shadow-[0_18px_38px_-16px_rgba(236,72,153,0.9)] transition-transform duration-200 hover:-translate-y-0.5 dark:border-slate-950"
                                            style={{
                                                background: primaryGradient,
                                                boxShadow: `0 18px 38px -16px ${hexToRgba(
                                                    themeColors.primary,
                                                    0.9,
                                                )}`,
                                            }}
                                        >
                                            <Icon className="h-5 w-5" />
                                        </span>
                                        <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-[9px] font-semibold leading-none sm:text-[10px]">
                                            {item.label}
                                        </span>
                                    </button>
                                );
                            }

                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) =>
                                        cn(
                                            "relative z-[1] flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-[1.1rem] px-1 text-center text-[9px] font-semibold transition-all sm:text-[10px]",
                                            isActive
                                                ? "bg-white/58 text-foreground shadow-[0_12px_30px_-22px_rgba(15,23,42,0.9)] ring-1 ring-white/60 dark:bg-white/12 dark:text-white dark:ring-white/10"
                                                : "text-muted-foreground hover:text-foreground",
                                        )
                                    }
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap leading-none">
                                        {item.label}
                                    </span>
                                </NavLink>
                            );
                        })}
                    </div>
                </nav>
            ) : null}

            <Dialog
                className="max-w-md"
                description={
                    isVietnamese
                        ? "Chọn cách nhập, AI sẽ hỗ trợ phần còn lại."
                        : "Choose an entry mode and let AI assist with the rest."
                }
                eyebrow={isVietnamese ? "Thêm nhanh" : "Quick add"}
                icon={Sparkles}
                onClose={() => setQuickAddOpen(false)}
                open={quickAddOpen}
                title={isVietnamese ? "Thêm giao dịch" : "Add transaction"}
                tone="transaction"
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    <button
                        className="rounded-[var(--app-radius-lg)] p-4 text-left text-white shadow-sm transition-transform hover:-translate-y-0.5"
                        onClick={() => handleQuickAction("voice")}
                        style={{
                            background: secondaryGradient,
                        }}
                        type="button"
                    >
                        <Mic className="h-5 w-5" />
                        <p className="mt-6 text-lg font-semibold">
                            {isVietnamese ? "Nói" : "Voice"}
                        </p>
                        <p className="mt-1 text-xs text-white/80">
                            {isVietnamese
                                ? "Ghi nhanh bằng giọng nói"
                                : "Capture with voice"}
                        </p>
                    </button>
                    <button
                        className="rounded-[var(--app-radius-lg)] p-4 text-left text-white shadow-sm transition-transform hover:-translate-y-0.5"
                        onClick={() => handleQuickAction("scan")}
                        style={{
                            background: primaryGradient,
                        }}
                        type="button"
                    >
                        <ScanLine className="h-5 w-5" />
                        <p className="mt-6 text-lg font-semibold">
                            {isVietnamese ? "Quét" : "Scan"}
                        </p>
                        <p className="mt-1 text-xs text-white/80">
                            {isVietnamese
                                ? "Hoá đơn hoặc ảnh mua sắm"
                                : "Receipts or item photos"}
                        </p>
                    </button>
                    <button
                        className="rounded-[var(--app-radius-lg)] p-4 text-left text-white shadow-sm transition-transform hover:-translate-y-0.5"
                        onClick={() => handleQuickAction("assistant")}
                        style={{
                            background: `linear-gradient(135deg, ${hexToRgba(
                                themeColors.secondary,
                                0.78,
                            )} 0%, rgba(15, 23, 42, 0.86) 100%)`,
                        }}
                        type="button"
                    >
                        <Sparkles className="h-5 w-5" />
                        <p className="mt-6 text-lg font-semibold">
                            {isVietnamese ? "Hỏi AI" : "Ask AI"}
                        </p>
                        <p className="mt-1 text-xs text-white/80">
                            {isVietnamese
                                ? "Nhận gợi ý và nhắc nhở"
                                : "Get insights and nudges"}
                        </p>
                    </button>
                    <button
                        className="rounded-[var(--app-radius-lg)] p-4 text-left text-white shadow-sm transition-transform hover:-translate-y-0.5"
                        onClick={() => handleQuickAction("manual")}
                        style={{
                            background: `linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, ${hexToRgba(
                                themeColors.primary,
                                0.78,
                            )} 100%)`,
                        }}
                        type="button"
                    >
                        <PencilLine className="h-5 w-5" />
                        <p className="mt-6 text-lg font-semibold">
                            {isVietnamese ? "Nhập tay" : "Manual"}
                        </p>
                        <p className="mt-1 text-xs text-white/80">
                            {isVietnamese
                                ? "Nhập giao dịch theo cách cũ"
                                : "Use the classic form"}
                        </p>
                    </button>
                </div>

                <div className="mt-3 rounded-[var(--app-radius-lg)] border border-primary/15 bg-primary-soft/80 px-4 py-3 text-sm text-muted-foreground">
                    <span className="font-semibold text-primary">
                        {isVietnamese ? "Mẹo: " : "Tip: "}
                    </span>
                    {isVietnamese
                        ? "bạn có thể chụp món ăn, thuốc, vé xem phim hoặc đồ mua sắm để AI gợi ý danh mục trước khi lưu."
                        : "you can snap food, medicine, movie tickets, or shopping items so AI can suggest a category before saving."}
                </div>
            </Dialog>
        </div>
    );
};

export default MainLayout;
