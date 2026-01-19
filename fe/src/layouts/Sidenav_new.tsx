import React from "react";
import { NavLink, useLocation } from "react-router-dom";

const Sidenav_new: React.FC = () => {
    const { pathname } = useLocation();
    const isActive = (path: string) => pathname === path;

    const Item = ({
        to,
        title,
        subtitle,
        color,
    }: {
        to: string;
        title: string;
        subtitle?: string;
        color: string;
    }) => (
        <NavLink
            to={to}
            className={`ekash_nav_item ${isActive(to) ? "is_active" : ""}`}
        >
            <span
                className="ekash_nav_icon"
                style={{ backgroundColor: color }}
            />
            <span className="ekash_nav_text">
                <span className="ekash_nav_title">{title}</span>
                {subtitle ? (
                    <span className="ekash_nav_subtitle">{subtitle}</span>
                ) : null}
            </span>
        </NavLink>
    );

    return (
        <div className="ekash_sidenav">
            <div className="ekash_brand">
                <div className="ekash_brand_dot" />
                <span className="ekash_brand_text">Expense Tracker</span>
            </div>

            <div className="ekash_nav">
                <div className="ekash_nav_group">
                    <Item
                        to="/new/dashboard"
                        title="Dashboard"
                        subtitle="Tổng quan"
                        color="#4f46e5"
                    />
                    <Item
                        to="/new/transactions"
                        title="Giao dịch"
                        subtitle="Thu/chi"
                        color="#f43f5e"
                    />
                    <Item
                        to="/new/wallets"
                        title="Ví"
                        subtitle="Tài khoản"
                        color="#2563eb"
                    />
                    <Item
                        to="/new/budgets"
                        title="Ngân sách"
                        subtitle="Theo dõi"
                        color="#0ea5e9"
                    />
                    <Item
                        to="/new/goals"
                        title="Mục tiêu"
                        subtitle="Tiết kiệm"
                        color="#14b8a6"
                    />
                </div>

                <div className="ekash_nav_footer">
                    <NavLink to="/" className="ekash_back_old">
                        Về giao diện cũ
                    </NavLink>
                </div>
            </div>
        </div>
    );
};

export default Sidenav_new;
