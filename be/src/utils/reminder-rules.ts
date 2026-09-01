/** Reminder times are stored on a 30 minute grid to keep the cron cheap. */
export const REMINDER_SLOT_MINUTES = 30;

export const DEFAULT_REMINDER_TIME = "20:00";
export const DEFAULT_REMINDER_TIMEZONE = "Asia/Ho_Chi_Minh";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const readTierLimit = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 1) {
        return fallback;
    }

    return Math.min(Math.trunc(parsed), 48);
};

export const getReminderLimit = (isPremium: boolean) =>
    isPremium
        ? readTierLimit(process.env.REMINDER_MAX_PER_DAY_PREMIUM, 10)
        : readTierLimit(process.env.REMINDER_MAX_PER_DAY_FREE, 2);

export class ReminderConfigError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = "ReminderConfigError";
        this.status = status;
    }
}

/**
 * Round "HH:mm" down onto the 30 minute grid, rejecting anything that is not a
 * valid time at all.
 */
export const normalizeReminderTime = (value: unknown) => {
    const raw = String(value || "").trim();
    const match = TIME_PATTERN.exec(raw);

    if (!match) {
        throw new ReminderConfigError(
            400,
            `Invalid reminder time: ${raw || "(empty)"}`,
        );
    }

    const hours = match[1];
    const minutes = Number(match[2]);
    const snapped =
        Math.floor(minutes / REMINDER_SLOT_MINUTES) * REMINDER_SLOT_MINUTES;

    return `${hours}:${String(snapped).padStart(2, "0")}`;
};

export const normalizeReminderTimes = (value: unknown, limit: number) => {
    if (!Array.isArray(value)) {
        throw new ReminderConfigError(400, "reminderTimes must be an array");
    }

    const unique = Array.from(
        new Set(value.map((entry) => normalizeReminderTime(entry))),
    ).sort();

    if (unique.length > limit) {
        throw new ReminderConfigError(
            400,
            `This account can schedule at most ${limit} reminders per day`,
        );
    }

    return unique;
};

export const isSupportedTimezone = (value: string) => {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: value });
        return true;
    } catch {
        return false;
    }
};

export const normalizeTimezone = (value: unknown) => {
    const raw = String(value || "").trim();

    if (!raw) {
        return DEFAULT_REMINDER_TIMEZONE;
    }

    if (!isSupportedTimezone(raw)) {
        throw new ReminderConfigError(400, `Unknown timezone: ${raw}`);
    }

    return raw;
};

/**
 * Wall clock of an instant in a timezone, as { date: "YYYY-MM-DD",
 * time: "HH:mm" } snapped down to the reminder grid.
 */
export const getLocalSlot = (at: Date, timeZone: string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).formatToParts(at);

    const read = (type: string) =>
        parts.find((part) => part.type === type)?.value || "00";

    const minutes = Number(read("minute"));
    const snapped =
        Math.floor(minutes / REMINDER_SLOT_MINUTES) * REMINDER_SLOT_MINUTES;
    const date = `${read("year")}-${read("month")}-${read("day")}`;
    const time = `${read("hour")}:${String(snapped).padStart(2, "0")}`;

    return { date, time, key: `${date} ${time}` };
};

/** Start of the local day, as a UTC instant, for "did they log today" checks. */
export const getLocalDayStart = (at: Date, timeZone: string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).formatToParts(at);

    const read = (type: string) =>
        Number(parts.find((part) => part.type === type)?.value || "0");

    const asUtc = Date.UTC(
        read("year"),
        read("month") - 1,
        read("day"),
        read("hour"),
        read("minute"),
        read("second"),
    );
    const offsetMs = asUtc - at.getTime();
    const localMidnightAsUtc = Date.UTC(
        read("year"),
        read("month") - 1,
        read("day"),
    );

    return new Date(localMidnightAsUtc - offsetMs);
};
