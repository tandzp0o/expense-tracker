import React from "react";
import { NavLink } from "react-router-dom";

interface SidenavProps {
    onCloseMenu?: () => void;
}

const Sidenav: React.FC<SidenavProps> = ({ onCloseMenu }) => {
    const handleItemClick = () => { if (onCloseMenu) onCloseMenu(); };

    const navItems = [
        { to: "/dashboard", icon: "dashboard", label: "Tổng quan" },
        { to: "/transactions", icon: "swap_horiz", label: "Giao dịch" },
        { to: "/wallets", icon: "account_balance", label: "Ví của tôi" },
        { to: "/analytics", icon: "pie_chart", label: "Báo cáo" },
        { to: "/budgets", icon: "payments", label: "Ngân sách" },
        { to: "/goals", icon: "ads_click", label: "Mục tiêu" },
        { to: "/dishes", icon: "restaurant", label: "Gợi ý món ăn" },
        { to: "/profile", icon: "settings", label: "Cài đặt" },
    ];

    return (
        <div className="flex flex-col h-full">
            <div className="p-6 flex items-center gap-3">
                <div className="bg-primary size-10 rounded-lg flex items-center justify-center text-white">
                    <span className="material-symbols-outlined">account_balance_wallet</span>
                </div>
                <div>
                    <h1 className="font-bold text-lg leading-tight dark:text-white">FinTrack</h1>
                    <p className="text-xs text-slate-500">Quản lý Tài chính</p>
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-1 mt-4">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={handleItemClick}
                        className={({ isActive }) => 
                            `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                                isActive
                                    ? "bg-primary text-white font-medium"
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            }`
                        }
                    >
                        <span className="material-symbols-outlined">{item.icon}</span>
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4">
                <button className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined">add_circle</span>
                    <span>Thêm giao dịch</span>
                </button>
            </div>
        </div>
    );
};

export default Sidenav;
