import React from "react";
import { useLocale } from "../contexts/LocaleContext";

const Footer: React.FC = () => {
    const { isVietnamese } = useLocale();

    return (
        <footer className="mt-6 border-t border-border px-1 py-6 text-sm text-muted-foreground">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <p>
                    {isVietnamese
                        ? "FinTrack dùng để quản lý dòng tiền, ngân sách, mục tiêu, hồ sơ và cài đặt."
                        : "FinTrack manages cashflow, budgets, goals, profile and settings."}
                </p>
                <p>
                    {isVietnamese
                        ? "Giao diện được xây trên bộ primitive theo pattern shadcn."
                        : "Interface built on reusable shadcn-style primitives."}
                </p>
            </div>
        </footer>
    );
};

export default Footer;
