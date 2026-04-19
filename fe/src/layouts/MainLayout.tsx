import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import Header from "./Header";
import Sidenav from "./Sidenav";
import Footer from "./Footer";
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
    const { language, isVietnamese } = useLocale();
    const mobileNavigationItems = buildMobileNavigationItems(language);

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
            <div className="mx-auto flex min-h-screen w-full max-w-[1940px] gap-4 px-3 py-3 md:px-4">
                <aside className="hidden w-[280px] shrink-0 lg:block">
                    <div className="glass-panel sticky top-3 h-[calc(100vh-1.5rem)] overflow-hidden rounded-[var(--app-radius-xl)] border border-border shadow-soft">
                        <Sidenav />
                    </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="glass-panel overflow-hidden rounded-[var(--app-radius-xl)] border border-border shadow-soft">
                        <Header onMenuClick={() => setMenuOpen(true)} />
                        <main
                            className={cn(
                                "min-h-[calc(100vh-120px)] px-4 py-5 md:px-6 md:py-6",
                                isMobile ? "pb-24" : "pb-6",
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
                <nav className="fixed bottom-3 left-3 right-3 z-30 rounded-[var(--app-radius-xl)] border border-border bg-card/96 px-3 py-2 shadow-soft backdrop-blur-xl lg:hidden">
                    <div className="grid grid-cols-5 gap-1">
                        {mobileNavigationItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) =>
                                        cn(
                                            "flex flex-col items-center justify-center gap-1 rounded-[var(--app-radius-md)] px-2 py-2 text-[11px] font-medium transition-all",
                                            "isPrimary" in item && item.isPrimary
                                                ? "bg-primary text-primary-foreground shadow-sm"
                                                : isActive
                                                  ? "bg-primary-soft text-primary"
                                                  : "text-muted-foreground",
                                        )
                                    }
                                >
                                    <Icon className="h-4 w-4" />
                                    <span>{item.label}</span>
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
