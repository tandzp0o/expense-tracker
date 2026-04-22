import React from "react";
import { Globe2, Languages, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "../components/app/page-header";
import { MetricCard } from "../components/app/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Select } from "../components/ui/select";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { useLocale } from "../contexts/LocaleContext";

const Settings: React.FC = () => {
    const { language, setLanguage, isVietnamese } = useLocale();
    const pageTitle = isVietnamese ? "Cài đặt" : "Settings";
    const pageDescription = isVietnamese
        ? "Tùy chỉnh ngôn ngữ hiển thị và giao diện theo cách bạn muốn."
        : "Adjust language and appearance settings the way you prefer.";

    return (
        <div className="space-y-6">
            <PageHeader
                description={pageDescription}
                title={pageTitle}
            />

            <div className="metric-card-grid">
                <MetricCard
                    icon={Languages}
                    subtitle={
                        isVietnamese
                            ? "Đổi ngôn ngữ cho các nhãn chính trong ứng dụng."
                            : "Switch the main interface language."
                    }
                    title={isVietnamese ? "Ngôn ngữ" : "Language"}
                    value={language === "vi" ? "Tiếng Việt" : "English"}
                />
                <MetricCard
                    icon={SlidersHorizontal}
                    subtitle={
                        isVietnamese
                            ? "Tùy chỉnh màu chủ đạo, phông chữ, cỡ chữ và bo góc."
                            : "Customize primary color, font, base size, and radius."
                    }
                    title={isVietnamese ? "Giao diện" : "Appearance"}
                    value={isVietnamese ? "Cá nhân hóa" : "Personalized"}
                />
                <MetricCard
                    icon={Globe2}
                    subtitle={
                        isVietnamese
                            ? "Thiết lập được lưu trên trình duyệt hiện tại để dùng lại nhanh hơn."
                            : "Settings are stored in this browser for quicker reuse."
                    }
                    title={isVietnamese ? "Lưu trữ" : "Persistence"}
                    value={isVietnamese ? "Tự động" : "Automatic"}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>
                        {isVietnamese ? "Ngôn ngữ hiển thị" : "Display language"}
                    </CardTitle>
                    <CardDescription>
                        {isVietnamese
                            ? "Chọn ngôn ngữ cho các nhãn và nội dung chính giữa tiếng Việt và tiếng Anh."
                            : "Choose the language for the main labels and content."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="max-w-md">
                    <Select
                        onChange={(event) =>
                            setLanguage(event.target.value as "vi" | "en")
                        }
                        value={language}
                    >
                        <option value="vi">Tiếng Việt</option>
                        <option value="en">English</option>
                    </Select>
                </CardContent>
            </Card>

            <ThemeSwitcher embedded />
        </div>
    );
};

export default Settings;
