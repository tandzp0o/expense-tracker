import React from "react";
import { Globe2, Languages, SlidersHorizontal } from "lucide-react";
import { useLocale } from "../contexts/LocaleContext";
import { PageHeader } from "../components/app/page-header";
import { MetricCard } from "../components/app/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Select } from "../components/ui/select";
import ThemeSwitcher from "../components/ThemeSwitcher";

const Settings: React.FC = () => {
    const { language, setLanguage, isVietnamese } = useLocale();

    return (
        <div className="space-y-6">
            <PageHeader
                description={
                    isVietnamese
                        ? "Quản lý ngôn ngữ hiển thị và các tùy chỉnh giao diện của toàn bộ frontend."
                        : "Manage interface language and appearance settings for the whole frontend."
                }
                title={isVietnamese ? "Cài đặt" : "Settings"}
            />

            <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                    icon={Languages}
                    subtitle={
                        isVietnamese
                            ? "Đổi ngôn ngữ cho các nhãn chính trong ứng dụng"
                            : "Switch the main interface language"
                    }
                    title={isVietnamese ? "Ngôn ngữ" : "Language"}
                    value={language === "vi" ? "Tiếng Việt" : "English"}
                />
                <MetricCard
                    icon={SlidersHorizontal}
                    subtitle={
                        isVietnamese
                            ? "Tùy chỉnh màu chủ đạo, font, cỡ chữ và bo góc"
                            : "Customize primary color, font, base size and radius"
                    }
                    title={isVietnamese ? "Giao diện" : "Appearance"}
                    value={isVietnamese ? "Cá nhân hóa" : "Personalized"}
                />
                <MetricCard
                    icon={Globe2}
                    subtitle={
                        isVietnamese
                            ? "Thiết lập được lưu tại local storage trên trình duyệt hiện tại"
                            : "Settings are persisted in local storage for this browser"
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
                            ? "Chọn ngôn ngữ để đổi các nhãn giao diện chính giữa tiếng Việt và tiếng Anh."
                            : "Choose the language for the main interface labels."}
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
