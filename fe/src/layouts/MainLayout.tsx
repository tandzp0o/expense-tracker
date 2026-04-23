import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import Header from "./Header";
import Sidenav from "./Sidenav";
import Footer from "./Footer";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { buildMobileNavigationItems } from "./navigation";
import { Sheet } from "../components/ui/sheet";
import { cn } from "../lib/utils";

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const { currentUser } = useAuth();
    const { language, isVietnamese } = useLocale();
    const mobileNavigationItems = buildMobileNavigationItems(language);
    const navigationLocked = !!currentUser?.newUser;
    const isItemLocked = (target: string) =>
        navigationLocked && target !== "/wallets";

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
                    <div className="glass-panel sticky top-3 h-[calc(100vh-1.5rem)] overflow-hidden rounded-[var(--app-radius-xl)] border border-border shadow-soft">
                        <Sidenav />
                    </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="glass-panel rounded-[var(--app-radius-xl)] border border-border shadow-soft">
                        <Header onMenuClick={() => setMenuOpen(true)} />
                        <main
                            className={cn(
                                "min-h-[calc(100vh-120px)] px-3 py-3.5 sm:px-4 sm:py-5 md:px-5 md:py-6",
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
                <nav className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] left-3 right-3 z-30 rounded-[var(--app-radius-xl)] border border-border bg-card/96 px-2.5 py-2.5 shadow-soft backdrop-blur-xl lg:hidden">
                    <div className="grid grid-cols-5 gap-1">
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
                                                ? "-mt-6 gap-1 px-0 pb-0 pt-0"
                                                : "gap-0.5 rounded-[var(--app-radius-md)] px-1 py-1.5 text-[9px] font-medium text-muted-foreground/45 sm:text-[10px]",
                                        )}
                                        disabled
                                        type="button"
                                    >
                                        {isPrimary ? (
                                            <>
                                                <span className="flex h-14 w-14 items-center justify-center rounded-full border-[5px] border-card bg-muted text-muted-foreground/45 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.55)]">
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

                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) =>
                                        isPrimary
                                            ? cn(
                                                  "flex min-w-0 -mt-6 flex-col items-center justify-center gap-1 px-0 pb-0 pt-0 text-center transition-all",
                                                  isActive ? "text-primary" : "text-muted-foreground",
                                              )
                                            : cn(
                                                  "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[var(--app-radius-md)] px-1 py-1.5 text-[9px] font-medium text-center transition-all sm:text-[10px]",
                                                  isActive
                                                      ? "bg-primary-soft text-primary"
                                                      : "text-muted-foreground",
                                              )
                                    }
                                >
                                    {isPrimary ? (
                                        <>
                                            <span className="flex h-14 w-14 items-center justify-center rounded-full border-[5px] border-card bg-primary text-primary-foreground shadow-[0_16px_34px_-18px_rgba(37,99,235,0.9)] transition-transform duration-200 hover:-translate-y-0.5">
                                                <Icon className="h-5 w-5" />
                                            </span>
                                            <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-[9px] font-semibold leading-none sm:text-[10px]">
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
                                </NavLink>
                            );
                        })}
                    </div>
                </nav>
            ) : null}
        </div>
    );
};

export default MainLayout;
