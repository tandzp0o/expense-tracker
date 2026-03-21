import React, { useState, useEffect } from "react";
import { Drawer } from "antd";
import { useLocation, NavLink } from "react-router-dom";
import Sidenav from "./Sidenav";
import Header from "./Header";
import Footer from "./Footer";
import { useTheme } from "../contexts/ThemeContext";

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { theme } = useTheme();
    const [visible, setVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

    const location = useLocation();

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 1024);
            if (window.innerWidth > 1024) {
                setVisible(false);
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const openDrawer = () => setVisible(!visible);

    const bottomNavItems = [
        { to: "/dashboard", icon: "home", label: "Trang chủ" },
        { to: "/wallets", icon: "account_balance_wallet", label: "Ví" },
        { to: "/transactions", icon: "add", label: "Thêm", isMiddle: true },
        { to: "/analytics", icon: "pie_chart", label: "Thống kê" },
        { to: "/profile", icon: "settings", label: "Cài đặt" },
    ];

    return (
        <div className={`flex h-screen overflow-hidden ${theme === "dark" ? "dark" : ""}`}>
            {/* Sidebar Navigation - Desktop */}
            {!isMobile && (
                <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
                    <Sidenav />
                </aside>
            )}

            {/* Mobile Drawer */}
            {isMobile && (
                <Drawer
                    title={false}
                    placement="left"
                    closable={false}
                    onClose={() => setVisible(false)}
                    open={visible}
                    width={280}
                    styles={{ body: { padding: 0 } }}
                >
                    <Sidenav onCloseMenu={() => setVisible(false)} />
                </Drawer>
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden bg-background-light dark:bg-background-dark">
                <Header onMenuClick={openDrawer} />
                
                <div className={`flex-1 overflow-y-auto p-4 md:p-8 ${isMobile ? "pb-24" : "pb-8"}`}>
                    <div className="w-full">
                        {children}
                        <Footer />
                    </div>
                </div>

                {/* Mobile Bottom Navigation */}
                {isMobile && (
                    <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2 pb-6 pt-2 z-20">
                        <div className="flex justify-around items-center">
                            {bottomNavItems.map((item) => (
                                item.isMiddle ? (
                                    <div key={item.to} className="relative -top-8">
                                        <NavLink 
                                            to="/transactions"
                                            className="size-14 rounded-full bg-primary text-white shadow-lg shadow-primary/40 flex items-center justify-center transform active:scale-95 transition-transform"
                                        >
                                            <span className="material-symbols-outlined text-3xl font-bold">add</span>
                                        </NavLink>
                                    </div>
                                ) : (
                                    <NavLink 
                                        key={item.to}
                                        to={item.to}
                                        className={({ isActive }) => 
                                            `flex flex-col items-center gap-1 transition-colors ${isActive ? "text-primary" : "text-slate-400 dark:text-slate-500"}`
                                        }
                                    >
                                        <span className={`material-symbols-outlined ${location.pathname === item.to ? 'font-variation-fill' : ''}`}>
                                            {item.icon}
                                        </span>
                                        <span className="text-[10px] font-bold">{item.label}</span>
                                    </NavLink>
                                )
                            ))}
                        </div>
                    </nav>
                )}
            </main>
            <style>
                {`
                    .font-variation-fill {
                        font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
                    }
                `}
            </style>
        </div>
    );
};

export default MainLayout;
