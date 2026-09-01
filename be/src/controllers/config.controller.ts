import { Response } from "express";
import admin from "firebase-admin";
import User from "../models/User";
import UserConfig from "../models/UserConfig";
import {
    DEFAULT_REMINDER_TIME,
    DEFAULT_REMINDER_TIMEZONE,
    ReminderConfigError,
    getReminderLimit,
    normalizeReminderTimes,
    normalizeTimezone,
} from "../utils/reminder-rules";

const MAX_DEVICE_TOKENS = 10;

const isPremiumUser = async (userId: string) => {
    const user = await User.findOne({ uid: userId }).select("isPremium");
    return Boolean(user?.isPremium);
};

const serializeConfig = (config: any, limit: number) => ({
    remindersEnabled: config.remindersEnabled,
    reminderTimes: config.reminderTimes,
    timezone: config.timezone,
    skipWhenAlreadyLogged: config.skipWhenAlreadyLogged,
    maxRemindersPerDay: limit,
    deviceCount: config.deviceTokens?.length || 0,
    lastSentAt: config.lastSentAt || null,
});

/**
 * Creates the config the first time it is needed. `withDefaultReminder` is used
 * right after the first wallet is created, which is the moment the reminder
 * actually becomes useful.
 */
export const ensureUserConfig = async (
    userId: string,
    options: { withDefaultReminder?: boolean; timezone?: string } = {},
) => {
    const existing = await UserConfig.findOne({ userId });

    if (existing) {
        if (
            options.withDefaultReminder &&
            existing.reminderTimes.length === 0
        ) {
            existing.reminderTimes = [DEFAULT_REMINDER_TIME];
            existing.remindersEnabled = true;
            await existing.save();
        }

        return existing;
    }

    return UserConfig.create({
        userId,
        remindersEnabled: true,
        reminderTimes: options.withDefaultReminder
            ? [DEFAULT_REMINDER_TIME]
            : [],
        timezone: options.timezone || DEFAULT_REMINDER_TIMEZONE,
    });
};

export const getConfig = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const [config, premium] = await Promise.all([
            ensureUserConfig(userId),
            isPremiumUser(userId),
        ]);

        res.json(serializeConfig(config, getReminderLimit(premium)));
    } catch (error) {
        console.error("Error fetching user config:", error);
        res.status(500).json({ message: "Không thể tải cấu hình" });
    }
};

export const updateConfig = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const premium = await isPremiumUser(userId);
        const limit = getReminderLimit(premium);
        const config = await ensureUserConfig(userId);

        if (req.body.remindersEnabled !== undefined) {
            config.remindersEnabled = Boolean(req.body.remindersEnabled);
        }

        if (req.body.reminderTimes !== undefined) {
            config.reminderTimes = normalizeReminderTimes(
                req.body.reminderTimes,
                limit,
            );
        }

        if (req.body.timezone !== undefined) {
            config.timezone = normalizeTimezone(req.body.timezone);
        }

        if (req.body.skipWhenAlreadyLogged !== undefined) {
            config.skipWhenAlreadyLogged = Boolean(
                req.body.skipWhenAlreadyLogged,
            );
        }

        await config.save();
        res.json(serializeConfig(config, limit));
    } catch (error: any) {
        if (error instanceof ReminderConfigError) {
            return res.status(error.status).json({ message: error.message });
        }

        console.error("Error updating user config:", error);
        res.status(500).json({ message: "Không thể lưu cấu hình" });
    }
};

/** Registers (or refreshes) the FCM token of the calling device. */
export const registerDevice = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const token = String(req.body.token || "").trim();

        if (!token) {
            return res.status(400).json({ message: "Thiếu token thiết bị" });
        }

        const platform = String(req.body.platform || "web").trim();
        const config = await ensureUserConfig(userId);

        const others = config.deviceTokens.filter(
            (device) => device.token !== token,
        );

        // Keep the most recent devices only: browsers rotate tokens and stale
        // ones would slow every dispatch down.
        config.deviceTokens = [
            { token, platform, updatedAt: new Date() },
            ...others,
        ].slice(0, MAX_DEVICE_TOKENS);

        await config.save();
        res.json({ success: true, deviceCount: config.deviceTokens.length });
    } catch (error) {
        console.error("Error registering device token:", error);
        res.status(500).json({ message: "Không thể đăng ký thiết bị" });
    }
};

export const removeDevice = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const token = String(req.body.token || "").trim();
        const config = await ensureUserConfig(userId);

        config.deviceTokens = config.deviceTokens.filter(
            (device) => device.token !== token,
        );

        await config.save();
        res.json({ success: true, deviceCount: config.deviceTokens.length });
    } catch (error) {
        console.error("Error removing device token:", error);
        res.status(500).json({ message: "Không thể gỡ thiết bị" });
    }
};

/**
 * Sends a push to the caller's own devices right now. Exists so the delivery
 * path (permission, token, FCM credentials) can be verified without waiting
 * for a scheduled slot, which is what the cron endpoint is gated on.
 */
export const sendTestNotification = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const config = await ensureUserConfig(userId);
        const tokens = config.deviceTokens.map((device) => device.token);

        if (tokens.length === 0) {
            return res.status(400).json({
                message:
                    "Chưa có thiết bị nào đăng ký nhận thông báo trên tài khoản này",
            });
        }

        const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
                title: "FinTrack: thử thông báo",
                body: "Nếu bạn thấy thông báo này thì phần nhắc nhở đã hoạt động.",
            },
            webpush: { fcmOptions: { link: "/transactions" } },
        });

        const errors = response.responses
            .filter((entry) => !entry.success)
            .map((entry) => entry.error?.message || "unknown error");

        res.json({
            success: response.successCount > 0,
            sent: response.successCount,
            failed: response.failureCount,
            deviceCount: tokens.length,
            errors,
        });
    } catch (error: any) {
        console.error("Test notification failed:", error);
        res.status(500).json({
            message: "Không gửi được thông báo thử",
            detail: error?.message,
        });
    }
};
