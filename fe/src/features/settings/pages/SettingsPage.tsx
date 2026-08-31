import React from "react";
import {
    Clock,
    Coins,
    Globe2,
    Languages,
    SlidersHorizontal,
} from "lucide-react";
import ThemeSwitcher from "components/ThemeSwitcher";
import { PageHeader } from "components/app/page-header";
import { MetricCard } from "components/app/metric-card";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "components/ui/card";
import { Select } from "components/ui/select";
import {
    SUPPORTED_CURRENCIES,
    SUPPORTED_TIMEZONES,
    useLocale,
} from "contexts/LocaleContext";

const Settings: React.FC = () => {
    const {
        language,
        setLanguage,
        moneyDisplayMode,
        setMoneyDisplayMode,
        currencyPreference,
        setCurrencyPreference,
        defaultCurrency,
        timezone,
        setTimezone,
        timezoneOffsetMinutes,
        isVietnamese,
    } = useLocale();

    const formatOffset = (minutes: number) => {
        // getTimezoneOffset() is inverted: UTC+7 arrives as -420.
        const totalMinutes = -minutes;
        const sign = totalMinutes >= 0 ? "+" : "-";
        const absolute = Math.abs(totalMinutes);
        const hours = Math.floor(absolute / 60);
        const rest = absolute % 60;

        return `GMT${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
    };

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
                <MetricCard
                    icon={Coins}
                    subtitle={
                        isVietnamese
                            ? "Tiền tệ mặc định cho ví mới và các tổng chung."
                            : "Default currency for new wallets and shared totals."
                    }
                    title={isVietnamese ? "Tiền tệ" : "Currency"}
                    value={defaultCurrency}
                />
                <MetricCard
                    icon={Clock}
                    subtitle={
                        isVietnamese
                            ? "Quyết định ngày của giao dịch khi ghi nhận và hiển thị."
                            : "Decides which day a transaction is recorded and shown on."
                    }
                    title={isVietnamese ? "Múi giờ" : "Timezone"}
                    value={formatOffset(timezoneOffsetMinutes)}
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

            <Card>
                <CardHeader>
                    <CardTitle>
                        {isVietnamese ? "Tiền tệ mặc định" : "Default currency"}
                    </CardTitle>
                    <CardDescription>
                        {isVietnamese
                            ? "Dùng cho ví mới tạo và các số tổng không gắn với ví cụ thể. Ví đã tạo vẫn giữ nguyên tiền tệ của nó."
                            : "Used for newly created wallets and totals with no specific wallet. Existing wallets keep their own currency."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="max-w-md">
                    <Select
                        onChange={(event) =>
                            setCurrencyPreference(
                                event.target.value as typeof currencyPreference,
                            )
                        }
                        value={currencyPreference}
                    >
                        <option value="auto">
                            {isVietnamese
                                ? `Theo ngôn ngữ (${defaultCurrency})`
                                : `Follow language (${defaultCurrency})`}
                        </option>
                        {SUPPORTED_CURRENCIES.map((currency) => (
                            <option key={currency} value={currency}>
                                {currency}
                            </option>
                        ))}
                    </Select>
                    <p className="mt-2 text-xs text-muted-foreground">
                        {isVietnamese
                            ? "Ở chế độ theo ngôn ngữ: tiếng Việt dùng VND, tiếng Anh dùng USD."
                            : "In follow-language mode: Vietnamese uses VND, English uses USD."}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{isVietnamese ? "Múi giờ" : "Timezone"}</CardTitle>
                    <CardDescription>
                        {isVietnamese
                            ? "Ứng dụng dùng múi giờ này để xác định một giao dịch thuộc ngày nào, kể cả khi máy chủ đặt ở múi giờ khác."
                            : "The app uses this timezone to decide which day a transaction belongs to, even when the server runs elsewhere."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="max-w-md">
                    <Select
                        onChange={(event) => setTimezone(event.target.value)}
                        value={timezone}
                    >
                        {SUPPORTED_TIMEZONES.map((zone) => (
                            <option key={zone.value} value={zone.value}>
                                {isVietnamese ? zone.vi : zone.en}
                            </option>
                        ))}
                    </Select>
                    <p className="mt-2 text-xs text-muted-foreground">
                        {isVietnamese
                            ? `Hiện tại: ${formatOffset(timezoneOffsetMinutes)}`
                            : `Currently: ${formatOffset(timezoneOffsetMinutes)}`}
                    </p>
                </CardContent>
            </Card>

            <ThemeSwitcher embedded />
        </div>
    );
};

export default Settings;
