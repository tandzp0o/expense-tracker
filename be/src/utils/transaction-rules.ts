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

export const normalizeToCalendarDate = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate());

export const parseTransactionDateInput = (value: unknown) => {
    if (value === undefined || value === null || value === "") {
        return new Date();
    }

    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isFutureCalendarDate = (value: Date) =>
    normalizeToCalendarDate(value).getTime() >
    normalizeToCalendarDate(new Date()).getTime();

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
}: {
    date: Date;
    status: TransactionStatus;
    isSystemGenerated?: boolean;
}) => {
    if (isFutureCalendarDate(date)) {
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
) => {
    if (!value) {
        throw new TransactionRuleError(400, "Invalid transaction date");
    }

    ensureTransactionStatusAllowed({
        date: value,
        status,
        isSystemGenerated,
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
