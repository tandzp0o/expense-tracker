import React, { useCallback, useEffect, useState } from "react";
import { BellRing, Plus, Trash2 } from "lucide-react";
import { auth } from "lib/firebase/config";
import { isPushSupported, requestPushToken } from "lib/firebase/messaging";
import { configApi } from "services/api";
import { useLocale } from "contexts/LocaleContext";
import { useToast } from "contexts/ToastContext";
import { Button } from "components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "components/ui/card";
import { Select } from "components/ui/select";
import { Spinner } from "components/ui/spinner";
import { Switch } from "components/ui/switch";

interface ReminderConfig {
    remindersEnabled: boolean;
    reminderTimes: string[];
    timezone: string;
    skipWhenAlreadyLogged: boolean;
    maxRemindersPerDay: number;
    deviceCount: number;
}

/** Reminder times live on a 30 minute grid, matching the backend. */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
    const hours = String(Math.floor(index / 2)).padStart(2, "0");
    const minutes = index % 2 === 0 ? "00" : "30";
    return `${hours}:${minutes}`;
});

const nextFreeTime = (used: string[]) =>
    TIME_OPTIONS.find((option) => !used.includes(option)) || "20:00";

export const ReminderSettings: React.FC = () => {
    const { isVietnamese, timezone } = useLocale();
    const { toast } = useToast();
    const [config, setConfig] = useState<ReminderConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pushSupported, setPushSupported] = useState(true);

    const copy = isVietnamese
        ? {
              title: "Nhắc nhở nhập liệu",
              description:
                  "Ứng dụng sẽ nhắc bạn ghi lại thu chi để số liệu không bị bỏ trống ngày nào.",
              enable: "Bật nhắc nhở",
              enableHint:
                  "Tắt đi thì các mốc giờ vẫn được giữ lại cho lần bật sau.",
              times: "Các mốc nhắc trong ngày",
              addTime: "Thêm mốc giờ",
              limitReached: (max: number) =>
                  `Tài khoản của bạn được đặt tối đa ${max} mốc nhắc mỗi ngày.`,
              skipTitle: "Bỏ qua nếu đã ghi hôm nay",
              skipHint:
                  "Hôm nào bạn đã nhập giao dịch rồi thì không nhắc nữa cho đỡ phiền.",
              deviceTitle: "Thiết bị nhận thông báo",
              deviceHint: (count: number) =>
                  count > 0
                      ? `Đang có ${count} thiết bị nhận thông báo. Bật lại trên thiết bị mới để thêm.`
                      : "Chưa có thiết bị nào. Bấm nút bên dưới để cho phép thông báo trên trình duyệt này.",
              enableDevice: "Cho phép thông báo trên thiết bị này",
              timezoneHint: (zone: string) =>
                  `Giờ nhắc tính theo múi giờ ${zone}.`,
              saved: "Đã lưu cấu hình nhắc nhở",
              saveFailed: "Không lưu được cấu hình",
              deviceAdded: "Thiết bị đã sẵn sàng nhận thông báo",
              deviceDenied: "Bạn đã chặn thông báo",
              deviceDeniedDesc:
                  "Hãy mở phần cài đặt thông báo của trình duyệt và cho phép trang này.",
              deviceUnsupported: "Trình duyệt không hỗ trợ",
              deviceUnsupportedDesc:
                  "Trình duyệt hoặc thiết bị này không hỗ trợ thông báo đẩy.",
              deviceMisconfigured: "Thiếu cấu hình VAPID key",
              deviceMisconfiguredDesc:
                  "Cần đặt REACT_APP_FIREBASE_VAPID_KEY trước khi bật thông báo.",
              deviceFailed: "Không bật được thông báo",
              loadFailed: "Không tải được cấu hình nhắc nhở",
          }
        : {
              title: "Logging reminders",
              description:
                  "The app nudges you to record income and expenses so no day is left empty.",
              enable: "Enable reminders",
              enableHint:
                  "Turning this off keeps your times for the next time you enable it.",
              times: "Times of day",
              addTime: "Add a time",
              limitReached: (max: number) =>
                  `Your account can schedule up to ${max} reminders per day.`,
              skipTitle: "Skip when already logged",
              skipHint:
                  "No nudge on days where you already recorded a transaction.",
              deviceTitle: "Devices receiving notifications",
              deviceHint: (count: number) =>
                  count > 0
                      ? `${count} device(s) are set up. Enable again on a new device to add it.`
                      : "No device yet. Use the button below to allow notifications in this browser.",
              enableDevice: "Allow notifications on this device",
              timezoneHint: (zone: string) =>
                  `Reminder times follow the ${zone} timezone.`,
              saved: "Reminder settings saved",
              saveFailed: "Could not save the settings",
              deviceAdded: "This device is ready to receive reminders",
              deviceDenied: "Notifications are blocked",
              deviceDeniedDesc:
                  "Open your browser notification settings and allow this site.",
              deviceUnsupported: "Not supported",
              deviceUnsupportedDesc:
                  "This browser or device does not support push notifications.",
              deviceMisconfigured: "Missing VAPID key",
              deviceMisconfiguredDesc:
                  "REACT_APP_FIREBASE_VAPID_KEY must be set before enabling push.",
              deviceFailed: "Could not enable notifications",
              loadFailed: "Could not load the reminder settings",
          };

    useEffect(() => {
        void isPushSupported().then(setPushSupported);
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) {
                    return;
                }

                const data = await configApi.getConfig(token);
                setConfig(data);
            } catch (error: any) {
                toast({
                    title: copy.loadFailed,
                    description: error.message,
                    variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        };

        void load();
        // Copy is derived from the language and would re-trigger the fetch.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast]);

    const persist = useCallback(
        async (next: Partial<ReminderConfig>) => {
            const previous = config;
            setConfig((current) => (current ? { ...current, ...next } : current));
            setSaving(true);

            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) {
                    return;
                }

                const data = await configApi.updateConfig(
                    {
                        ...next,
                        // Reminder times only mean something together with the
                        // zone they were chosen in.
                        timezone: next.timezone || timezone,
                    },
                    token,
                );
                setConfig(data);
                toast({ title: copy.saved, variant: "success" });
            } catch (error: any) {
                setConfig(previous);
                toast({
                    title: copy.saveFailed,
                    description: error.message,
                    variant: "destructive",
                });
            } finally {
                setSaving(false);
            }
        },
        [config, copy.saveFailed, copy.saved, timezone, toast],
    );

    const handleEnableDevice = async () => {
        const result = await requestPushToken();

        if (result.status === "unsupported") {
            toast({
                title: copy.deviceUnsupported,
                description: copy.deviceUnsupportedDesc,
                variant: "destructive",
            });
            return;
        }

        if (result.status === "misconfigured") {
            toast({
                title: copy.deviceMisconfigured,
                description: copy.deviceMisconfiguredDesc,
                variant: "destructive",
            });
            return;
        }

        if (result.status === "denied") {
            toast({
                title: copy.deviceDenied,
                description: copy.deviceDeniedDesc,
                variant: "destructive",
            });
            return;
        }

        if (result.status === "failed") {
            toast({
                title: copy.deviceFailed,
                description:
                    result.error instanceof Error ? result.error.message : "",
                variant: "destructive",
            });
            return;
        }

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                return;
            }

            const data = await configApi.registerDevice(
                { token: result.token, platform: "web" },
                token,
            );
            setConfig((current) =>
                current
                    ? { ...current, deviceCount: data.deviceCount }
                    : current,
            );
            toast({ title: copy.deviceAdded, variant: "success" });
        } catch (error: any) {
            toast({
                title: copy.deviceFailed,
                description: error.message,
                variant: "destructive",
            });
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex min-h-[180px] items-center justify-center">
                    <Spinner className="h-6 w-6" />
                </CardContent>
            </Card>
        );
    }

    if (!config) {
        return null;
    }

    const atLimit = config.reminderTimes.length >= config.maxRemindersPerDay;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--app-radius-md)] bg-primary/10 text-primary">
                        <BellRing className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <CardTitle>{copy.title}</CardTitle>
                        <CardDescription>{copy.description}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-sm font-medium">{copy.enable}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {copy.enableHint}
                        </p>
                    </div>
                    <Switch
                        checked={config.remindersEnabled}
                        disabled={saving}
                        onCheckedChange={(checked) =>
                            void persist({ remindersEnabled: checked })
                        }
                    />
                </div>

                <div>
                    <p className="text-sm font-medium">{copy.times}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {copy.timezoneHint(config.timezone)}
                    </p>
                    <div className="mt-3 space-y-2">
                        {config.reminderTimes.map((time, index) => (
                            <div className="flex gap-2" key={`${time}-${index}`}>
                                <Select
                                    disabled={saving}
                                    onChange={(event) => {
                                        const next = [...config.reminderTimes];
                                        next[index] = event.target.value;
                                        void persist({ reminderTimes: next });
                                    }}
                                    value={time}
                                >
                                    {TIME_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </Select>
                                <Button
                                    aria-label={`Remove ${time}`}
                                    disabled={saving}
                                    onClick={() =>
                                        void persist({
                                            reminderTimes:
                                                config.reminderTimes.filter(
                                                    (_, position) =>
                                                        position !== index,
                                                ),
                                        })
                                    }
                                    size="icon"
                                    variant="outline"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <Button
                        className="mt-3"
                        disabled={saving || atLimit}
                        onClick={() =>
                            void persist({
                                reminderTimes: [
                                    ...config.reminderTimes,
                                    nextFreeTime(config.reminderTimes),
                                ],
                            })
                        }
                        size="sm"
                        variant="outline"
                    >
                        <Plus className="h-4 w-4" />
                        {copy.addTime}
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">
                        {copy.limitReached(config.maxRemindersPerDay)}
                    </p>
                </div>

                <div className="flex items-start justify-between gap-4 border-t border-border/70 pt-4">
                    <div className="min-w-0">
                        <p className="text-sm font-medium">{copy.skipTitle}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {copy.skipHint}
                        </p>
                    </div>
                    <Switch
                        checked={config.skipWhenAlreadyLogged}
                        disabled={saving}
                        onCheckedChange={(checked) =>
                            void persist({ skipWhenAlreadyLogged: checked })
                        }
                    />
                </div>

                <div className="border-t border-border/70 pt-4">
                    <p className="text-sm font-medium">{copy.deviceTitle}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {copy.deviceHint(config.deviceCount)}
                    </p>
                    <Button
                        className="mt-3"
                        disabled={!pushSupported}
                        onClick={() => void handleEnableDevice()}
                        size="sm"
                    >
                        <BellRing className="h-4 w-4" />
                        {copy.enableDevice}
                    </Button>
                    {!pushSupported ? (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                            {copy.deviceUnsupportedDesc}
                        </p>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
};

export default ReminderSettings;
