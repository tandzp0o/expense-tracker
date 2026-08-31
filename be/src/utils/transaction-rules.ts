import { TransactionStatus, TransactionType } from "../models/Transaction";

export const TRANSFER_CATEGORY = "Transfer";
export const MAX_WHOLE_MONEY_AMOUNT = Number.MAX_SAFE_INTEGER;

export class TransactionRuleError extends Error {
    status: number;
    details?: Record<string, unknown>;

    constructor(
        status: number,
        message: string,
        details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = "TransactionRuleError";
        this.status = status;
        this.details = details;
    }
}

/** Widest real offset is UTC+14 / UTC-12, in getTimezoneOffset() minutes. */
const MAX_TIMEZONE_OFFSET_MINUTES = 840;

/**
 * Business timezone of the app. Requests that do not state a timezone are
 * recorded on the Vietnamese calendar day rather than the server's, so a
 * container running in UTC no longer shifts dates by seven hours.
 * Override with APP_TIMEZONE_OFFSET_MINUTES (getTimezoneOffset convention).
 */
export const DEFAULT_TIMEZONE_OFFSET_MINUTES = (() => {
    const configured = Number(process.env.APP_TIMEZONE_OFFSET_MINUTES);

    if (
        Number.isFinite(configured) &&
        Math.abs(configured) <= MAX_TIMEZONE_OFFSET_MINUTES
    ) {
        return Math.trunc(configured);
    }

    // Asia/Ho_Chi_Minh is UTC+7, which getTimezoneOffset() reports as -420.
    return -420;
})();

/**
 * Minutes as reported by the client's Date.prototype.getTimezoneOffset(), i.e.
 * the value to add to local time to reach UTC (UTC+7 sends -420). Requests
 * without it fall back to UTC so older clients keep the previous behaviour.
 */
export const parseTimezoneOffset = (value: unknown) => {
    if (value === undefined || value === null || value === "") {
        return DEFAULT_TIMEZONE_OFFSET_MINUTES;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return DEFAULT_TIMEZONE_OFFSET_MINUTES;
    }

    const rounded = Math.trunc(parsed);

    if (Math.abs(rounded) > MAX_TIMEZONE_OFFSET_MINUTES) {
        return DEFAULT_TIMEZONE_OFFSET_MINUTES;
    }

    return rounded;
};

/**
 * Calendar day of an instant as seen by the client, not by the server. Using
 * the server's local getters made "today" in UTC+7 look like tomorrow to a UTC
 * server for the first seven hours of every day.
 */
export const normalizeToCalendarDate = (
    value: Date,
    timezoneOffsetMinutes = DEFAULT_TIMEZONE_OFFSET_MINUTES,
) => {
    const shifted = new Date(
        value.getTime() - timezoneOffsetMinutes * 60 * 1000,
    );

    return new Date(
        Date.UTC(
            shifted.getUTCFullYear(),
            shifted.getUTCMonth(),
            shifted.getUTCDate(),
        ),
    );
};

export const parseTransactionDateInput = (value: unknown) => {
    if (value === undefined || value === null || value === "") {
        return new Date();
    }

    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isFutureCalendarDate = (
    value: Date,
    timezoneOffsetMinutes = DEFAULT_TIMEZONE_OFFSET_MINUTES,
) =>
    normalizeToCalendarDate(value, timezoneOffsetMinutes).getTime() >
    normalizeToCalendarDate(new Date(), timezoneOffsetMinutes).getTime();

export const normalizeTransactionType = (value: unknown) => {
    const normalized = String(value || "").trim().toUpperCase();

    if (!Object.values(TransactionType).includes(normalized as TransactionType)) {
        throw new TransactionRuleError(400, "Unsupported transaction type");
    }

    return normalized as TransactionType;
};

export const normalizeTransactionStatus = (value: unknown) => {
    const normalized = String(value || "").trim().toUpperCase();

    if (
        !Object.values(TransactionStatus).includes(
            normalized as TransactionStatus,
        )
    ) {
        throw new TransactionRuleError(400, "Unsupported transaction status");
    }

    return normalized as TransactionStatus;
};

type WholeMoneyOptions = {
    allowZero?: boolean;
    fieldName?: string;
};

export const parseWholeMoneyAmount = (
    value: unknown,
    options: WholeMoneyOptions = {},
) => {
    const { allowZero = false, fieldName = "Amount" } = options;
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        throw new TransactionRuleError(
            400,
            `${fieldName} must be a whole number`,
        );
    }

    const minimumValue = allowZero ? 0 : 1;
    if (parsed < minimumValue) {
        throw new TransactionRuleError(
            400,
            `${fieldName} must be ${allowZero ? "zero or greater" : "greater than zero"}`,
        );
    }

    if (parsed > MAX_WHOLE_MONEY_AMOUNT) {
        throw new TransactionRuleError(
            400,
            `${fieldName} exceeds the supported limit`,
        );
    }

    return parsed;
};

export const assertNonNegativeLedgerValue = (
    value: number,
    message: string,
) => {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
        throw new TransactionRuleError(400, "Ledger value exceeds safe range");
    }

    if (value < 0) {
        throw new TransactionRuleError(400, message);
    }
};

export const isTransferCategory = (value: unknown) =>
    String(value || "").trim().toLowerCase() ===
    TRANSFER_CATEGORY.toLowerCase();

export const isTransferTransaction = (transaction: {
    category?: string | null;
    transferGroupId?: string | null;
}) => Boolean(transaction.transferGroupId) || isTransferCategory(transaction.category);

export const isLedgerAffectingStatus = (
    status?: TransactionStatus | null,
) => !status || status === TransactionStatus.COMPLETED;

export const getWalletDeltaForTransaction = (
    type: TransactionType,
    amount: number,
) => {
    switch (type) {
        case TransactionType.INCOME:
        case TransactionType.GOAL_WITHDRAW:
            return amount;
        case TransactionType.EXPENSE:
        case TransactionType.GOAL_DEPOSIT:
            return -amount;
        default:
            throw new TransactionRuleError(
                400,
                "Adjustment transactions require dedicated metadata",
        );
    }
};

export const getGoalDeltaForTransaction = (
    type: TransactionType,
    amount: number,
) => {
    switch (type) {
        case TransactionType.GOAL_DEPOSIT:
            return amount;
        case TransactionType.GOAL_WITHDRAW:
            return -amount;
        default:
            return 0;
    }
};

export const ensureTransactionStatusAllowed = ({
    date,
    status,
    isSystemGenerated = false,
    timezoneOffsetMinutes = DEFAULT_TIMEZONE_OFFSET_MINUTES,
}: {
    date: Date;
    status: TransactionStatus;
    isSystemGenerated?: boolean;
    timezoneOffsetMinutes?: number;
}) => {
    if (isFutureCalendarDate(date, timezoneOffsetMinutes)) {
        if (
            status !== TransactionStatus.SCHEDULED &&
            status !== TransactionStatus.PENDING
        ) {
            throw new TransactionRuleError(
                400,
                "Future transactions must use SCHEDULED or PENDING status",
            );
        }

        return status;
    }

    if (
        !isSystemGenerated &&
        (status === TransactionStatus.FAILED ||
            status === TransactionStatus.CANCELLED)
    ) {
        throw new TransactionRuleError(
            400,
            "FAILED and CANCELLED statuses are reserved for system-managed flows",
        );
    }

    return status;
};

export const ensureTransactionDateAllowed = (
    value: Date | null,
    status: TransactionStatus = TransactionStatus.COMPLETED,
    isSystemGenerated = false,
    timezoneOffsetMinutes = DEFAULT_TIMEZONE_OFFSET_MINUTES,
) => {
    if (!value) {
        throw new TransactionRuleError(400, "Invalid transaction date");
    }

    ensureTransactionStatusAllowed({
        date: value,
        status,
        isSystemGenerated,
        timezoneOffsetMinutes,
    });

    return value;
};

export const ensureTransferCategoryNotUsed = (category: unknown) => {
    if (isTransferCategory(category)) {
        throw new TransactionRuleError(
            400,
            "Use the transfer endpoint for internal wallet transfers",
        );
    }
};

export const supportsManualTransactionEditing = (type: TransactionType) =>
    type === TransactionType.INCOME || type === TransactionType.EXPENSE;
