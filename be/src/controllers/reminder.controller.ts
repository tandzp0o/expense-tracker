import { Request, Response } from "express";
import admin from "firebase-admin";
import Transaction from "../models/Transaction";
import UserConfig from "../models/UserConfig";
import { getLocalDayStart, getLocalSlot } from "../utils/reminder-rules";

interface DispatchOutcome {
    scanned: number;
    due: number;
    skippedAlreadyLogged: number;
    skippedNoDevice: number;
    sent: number;
    failed: number;
}

const buildMessage = (isVietnamese: boolean) =>
    isVietnamese
        ? {
              title: "Ghi lại chi tiêu hôm nay nhé",
              body: "Chỉ mất một phút để cập nhật thu chi và giữ số liệu chính xác.",
          }
        : {
              title: "Log today's spending",
              body: "It takes a minute to update your cashflow and keep the numbers honest.",
          };

/**
 * Called by the cron provider on a fixed interval. Everything user specific
 * lives in the config collection, so the schedule itself never changes.
 */
export const dispatchReminders = async (_req: Request, res: Response) => {
    const now = new Date();
    const outcome: DispatchOutcome = {
        scanned: 0,
        due: 0,
        skippedAlreadyLogged: 0,
        skippedNoDevice: 0,
        sent: 0,
        failed: 0,
    };

    try {
        const configs = await UserConfig.find({
            remindersEnabled: true,
            "reminderTimes.0": { $exists: true },
            "deviceTokens.0": { $exists: true },
        });

        outcome.scanned = configs.length;

        for (const config of configs) {
            const slot = getLocalSlot(now, config.timezone);

            if (!config.reminderTimes.includes(slot.time)) {
                continue;
            }

            // Same slot already handled: the cron fired twice, or a retry.
            if (config.lastSentSlot === slot.key) {
                continue;
            }

            outcome.due += 1;

            if (config.skipWhenAlreadyLogged) {
                const dayStart = getLocalDayStart(now, config.timezone);
                const loggedToday = await Transaction.countDocuments({
                    userId: config.userId,
                    createdAt: { $gte: dayStart },
                });

                if (loggedToday > 0) {
                    outcome.skippedAlreadyLogged += 1;
                    // Still mark the slot so a retry does not re-check.
                    config.lastSentSlot = slot.key;
                    await config.save();
                    continue;
                }
            }

            const tokens = config.deviceTokens.map((device) => device.token);

            if (tokens.length === 0) {
                outcome.skippedNoDevice += 1;
                continue;
            }

            const content = buildMessage(
                config.timezone === "Asia/Ho_Chi_Minh",
            );

            try {
                const response = await admin
                    .messaging()
                    .sendEachForMulticast({
                        tokens,
                        notification: content,
                        webpush: {
                            fcmOptions: { link: "/transactions" },
                        },
                    });

                outcome.sent += response.successCount;
                outcome.failed += response.failureCount;

                // Drop tokens the device no longer owns, otherwise the list
                // grows forever and every dispatch pays for the dead entries.
                const staleTokens = new Set<string>();
                response.responses.forEach((entry, index) => {
                    const code = entry.error?.code || "";
                    if (
                        !entry.success &&
                        (code.includes("registration-token-not-registered") ||
                            code.includes("invalid-argument"))
                    ) {
                        staleTokens.add(tokens[index]);
                    }
                });

                if (staleTokens.size > 0) {
                    config.deviceTokens = config.deviceTokens.filter(
                        (device) => !staleTokens.has(device.token),
                    );
                }

                config.lastSentSlot = slot.key;
                config.lastSentAt = now;
                await config.save();
            } catch (error) {
                outcome.failed += 1;
                console.error(
                    `Reminder delivery failed for ${config.userId}:`,
                    error,
                );
            }
        }

        res.json({ success: true, at: now.toISOString(), ...outcome });
    } catch (error) {
        console.error("Reminder dispatch failed:", error);
        res.status(500).json({ success: false, message: "Dispatch failed" });
    }
};
