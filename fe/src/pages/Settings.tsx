import React from "react";
import { Globe2, Languages, SlidersHorizontal } from "lucide-react";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { PageHeader } from "../components/app/page-header";
import { MetricCard } from "../components/app/metric-card";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
import { Select } from "../components/ui/select";
import { useLocale } from "../contexts/LocaleContext";

const Settings: React.FC = () => {
    const {
        language,
        setLanguage,
        moneyDisplayMode,
        setMoneyDisplayMode,
        isVietnamese,
    } = useLocale();

    const pageTitle = isVietnamese ? "Cài đặt" : "Settings";
    const pageDescription = isVietnamese
        ? "Tùy chỉnh ngôn ngữ, kiểu hiển thị tiền và giao diện theo cách bạn muốn."
        : "Adjust language, money display, and appearance settings the way you prefer.";

    return (
        <div className="space-y-4 sm:space-y-6">
            <PageHeader description={pageDescription} title={pageTitle} />

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
                            ? "Chuyển giữa dạng tiền đầy đủ và rút gọn để tối ưu mobile."
                            : "Switch between full and compact money display for mobile."
                    }
                    title={isVietnamese ? "Hiển thị tiền" : "Money display"}
                    value={
                        moneyDisplayMode === "compact"
                            ? isVietnamese
                                ? "Rút gọn"
                                : "Compact"
                            : isVietnamese
                              ? "Đầy đủ"
                              : "Full"
                    }
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

            <Card>
                <CardHeader>
                    <CardTitle>
                        {isVietnamese
                            ? "Kiểu hiển thị số tiền"
                            : "Money display style"}
                    </CardTitle>
                    <CardDescription>
                        {isVietnamese
                            ? "Chọn dạng đầy đủ hoặc rút gọn. Ví dụ: `1.000.000đ` hoặc `1tr`."
                            : "Choose full or compact money labels. Example: `10,000,000 VND` or `10M VND`."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="max-w-md">
                    <Select
                        onChange={(event) =>
                            setMoneyDisplayMode(
                                event.target.value as "full" | "compact",
                            )
                        }
                        value={moneyDisplayMode}
                    >
                        <option value="full">
                            {isVietnamese ? "Đầy đủ" : "Full"}
                        </option>
                        <option value="compact">
                            {isVietnamese ? "Rút gọn" : "Compact"}
                        </option>
                    </Select>
                </CardContent>
            </Card>

            <ThemeSwitcher embedded />
        </div>
    );
};

export default Settings;
