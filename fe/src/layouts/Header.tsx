import React, { useState, useEffect } from "react";
import { Dropdown, Avatar } from "antd";
import { LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import ThemeSwitcher from "../components/ThemeSwitcher";

interface HeaderProps {
    onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, currentUser } = useAuth();
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 1024);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const getPageTitle = () => {
        const path = location.pathname.split("/")[1];
        const titles: Record<string, string> = {
            dashboard: "Tổng quan tài chính",
            wallets: "Quản lý nguồn tiền",
            transactions: "Dòng tiền giao dịch",
            goals: "Mục tiêu tích lũy",
            profile: "Tài khoản cá nhân",
            dishes: "Gợi ý ăn uống",
            analytics: "Báo cáo chuyên sâu",
            budgets: "Hạn mức chi tiêu",
        };
        return titles[path] || "FinTrack";
    };

    const getPageIcon = () => {
        const path = location.pathname.split("/")[1];
        const icons: Record<string, string> = {
            dashboard: "dashboard",
            wallets: "account_balance",
            transactions: "swap_horiz",
            goals: "track_changes",
            profile: "settings",
            dishes: "restaurant",
            analytics: "pie_chart",
            budgets: "payments",
        };
        return icons[path] || "dashboard";
    };

    const userMenuItems = [
        { key: "profile", icon: <UserOutlined />, label: <span className="font-bold">Hồ sơ cá nhân</span>, onClick: () => navigate("/profile") },
        { key: "logout", icon: <LogoutOutlined />, label: <span className="font-bold text-rose-500">Đăng xuất</span>, onClick: logout },
    ];

    return (
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-6 md:px-8 shrink-0 sticky top-0 z-50">
            <div className="flex items-center gap-4">
                {isMobile && (
                    <button onClick={onMenuClick} className="size-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-xl">menu</span>
                    </button>
                )}
                <div className="flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined text-xl">{getPageIcon()}</span>
                    <h2 className="text-lg font-bold">{getPageTitle()}</h2>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="hidden lg:block relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: '16px' }}>search</span>
                    <input className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary w-56 dark:text-white" placeholder="Tìm nhanh..." />
                </div>

                <div className="flex items-center gap-3">
                    <ThemeSwitcher />
                    <button className="relative text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <span className="material-symbols-outlined">notifications</span>
                        <span className="absolute top-0 right-0 size-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                    </button>

                    <Dropdown menu={{ items: userMenuItems }} trigger={["click"]} placement="bottomRight">
                        <div className="flex items-center gap-3 border-l border-slate-200 dark:border-slate-800 pl-3 cursor-pointer">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-semibold dark:text-white leading-tight">{currentUser?.displayName || "FinTracker"}</p>
                                <p className="text-xs text-slate-500">Gói Premium</p>
                            </div>
                            <div className="size-9 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                                {(currentUser as any)?.photoURL ? (
                                    <img src={(currentUser as any).photoURL} className="w-full h-full object-cover" alt="Avatar" />
                                ) : (
                                    <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '18px' }}>person</span>
                                )}
                            </div>
                        </div>
                    </Dropdown>
                </div>
            </div>
        </header>
    );
};

export default Header;
