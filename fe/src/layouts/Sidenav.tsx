import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { useLocale } from "../contexts/LocaleContext";
import { buildNavigationItems } from "./navigation";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";

interface SidenavProps {
    onCloseMenu?: () => void;
}

const Sidenav: React.FC<SidenavProps> = ({ onCloseMenu }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { language, isVietnamese } = useLocale();
    const navigationItems = buildNavigationItems(language);

    const handleNavigate = (target: string) => {
        navigate(target);
        onCloseMenu?.();
    };

    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-border px-5 py-5">
                <button
                    className="flex items-center gap-3"
                    onClick={() => handleNavigate("/dashboard")}
                    type="button"
                >
                    <div className="flex h-11 w-11 items-center justify-center rounded-[var(--app-radius-md)] bg-primary text-primary-foreground shadow-sm">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                        <p className="text-base font-semibold">FinTrack</p>
                        <p className="text-sm text-muted-foreground">
                            {isVietnamese
                                ? "Không gian quản lý tài chính"
                                : "Financial workspace"}
                        </p>
                    </div>
                </button>
            </div>

            <nav className="flex-1 space-y-1 px-4 py-5">
                {navigationItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.to}
                            onClick={onCloseMenu}
                            to={item.to}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 rounded-[var(--app-radius-lg)] px-4 py-3 text-sm font-medium transition-all",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                )
                            }
                        >
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                        </NavLink>
                    );
                })}
            </nav>

            <div className="px-4 pb-4">
                <div className="rounded-[var(--app-radius-lg)] border border-border bg-muted/50 p-4">
                    <div className="mb-4">
                        <p className="text-sm font-semibold">
                            {isVietnamese ? "Thao tác nhanh" : "Quick action"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {isVietnamese
                                ? "Mở nhanh màn hình tạo giao dịch để cập nhật dòng tiền."
                                : "Open the transaction form quickly to update cashflow."}
                        </p>
                    </div>
                    <Button className="w-full justify-between" onClick={() => handleNavigate("/transactions")}>
                        <span>
                            {isVietnamese ? "Tạo giao dịch" : "Create transaction"}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </div>

                <p className="mt-4 text-xs text-muted-foreground">
                    {isVietnamese ? "Đang xem:" : "Viewing:"}{" "}
                    <span className="font-medium text-foreground">
                        {navigationItems.find((item) => item.to === location.pathname)
                            ?.label || "FinTrack"}
                    </span>
                </p>
            </div>
        </div>
    );
};

export default Sidenav;
