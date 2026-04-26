import { Request, Response } from "express";
import { ClientSession, Types } from "mongoose";
import Budget from "../models/Budget";
import Goal from "../models/Goal";
import Transaction, {
    ITransaction,
    TransactionStatus,
    TransactionType,
} from "../models/Transaction";
import Wallet from "../models/Wallet";
import { touchTransactionCacheState } from "../utils/transaction-cache";
import {
    assertNonNegativeLedgerValue,
    ensureTransactionDateAllowed,
    ensureTransferCategoryNotUsed,
    getGoalDeltaForTransaction,
    getWalletDeltaForTransaction,
    isLedgerAffectingStatus,
    isTransferCategory,
    isTransferTransaction,
    normalizeTransactionStatus,
    normalizeTransactionType,
    parseTransactionDateInput,
    parseWholeMoneyAmount,
    supportsManualTransactionEditing,
    TransactionRuleError,
    TRANSFER_CATEGORY,
} from "../utils/transaction-rules";

const parsePositiveInt = (value: unknown, fallback: number) => {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const escapeRegex = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildCompletedStatusQuery = () => ({
    $or: [
        { status: TransactionStatus.COMPLETED },
        { status: { $exists: false } },
    ],
});

const completedStatusExpression = {
    $eq: [{ $ifNull: ["$status", TransactionStatus.COMPLETED] }, TransactionStatus.COMPLETED],
};

const buildTransactionQuery = (userId: string, reqQuery: any) => {
    const { startDate, endDate, type, category, walletId, note, status } =
        reqQuery;
    const query: any = { userId };

    if (walletId) query.walletId = walletId;
    if (type) query.type = type;
    if (category) query.category = category;
    if (status) query.status = status;

    const normalizedNote =
        typeof note === "string" ? note.trim() : String(note || "").trim();
    if (normalizedNote) {
        query.note = { $regex: escapeRegex(normalizedNote), $options: "i" };
    }

    if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate as string);
        if (endDate) query.date.$lte = new Date(endDate as string);
    }

    return query;
};

const handleControllerError = (
    res: Response,
    error: unknown,
    defaultMessage: string,
) => {
    if (error instanceof TransactionRuleError) {
        return res.status(error.status).json({
            success: false,
            message: error.message,
            ...(error.details ? { details: error.details } : {}),
        });
    }

    const errorMessage =
        error instanceof Error ? error.message : "Unknown server error";
    return res.status(500).json({
        success: false,
        message: defaultMessage,
        error: errorMessage,
    });
};

const parseCategory = (value: unknown) => {
    const category = String(value || "").trim();
    if (!category) {
        throw new TransactionRuleError(400, "Category is required");
    }

    return category;
};

const parseOptionalCategory = (value: unknown) => String(value || "").trim();

const normalizeOptionalNote = (value: unknown) => {
    const note = String(value || "").trim();
    return note || undefined;
};

const applyWalletDelta = (
    wallet: any,
    delta: number,
    insufficientMessage: string,
) => {
    const nextBalance = Number(wallet.balance) + delta;
    assertNonNegativeLedgerValue(nextBalance, insufficientMessage);
    wallet.balance = nextBalance;
};

const applyGoalDelta = (goal: any, delta: number) => {
    const nextAmount = Number(goal.currentAmount || 0) + delta;
    assertNonNegativeLedgerValue(
        nextAmount,
        "Goal balance cannot become negative",
    );
    goal.currentAmount = nextAmount;
    syncGoalStatus(goal);
};

const transactionTouchesLedger = (status: TransactionStatus) =>
    isLedgerAffectingStatus(status);

const applyTransactionLedgerEffects = ({
    transactionType,
    transactionStatus,
    amount,
    wallet,
    goal,
}: {
    transactionType: TransactionType;
    transactionStatus: TransactionStatus;
    amount: number;
    wallet: any;
    goal?: any;
}) => {
    if (!transactionTouchesLedger(transactionStatus)) {
        return;
    }

    applyWalletDelta(
        wallet,
        getWalletDeltaForTransaction(transactionType, amount),
        "Insufficient wallet balance",
    );

    const goalDelta = getGoalDeltaForTransaction(transactionType, amount);
    if (goal && goalDelta !== 0) {
        applyGoalDelta(goal, goalDelta);
    }
};

const revertTransactionLedgerEffects = ({
    transactionType,
    transactionStatus,
    amount,
    wallet,
    goal,
}: {
    transactionType: TransactionType;
    transactionStatus: TransactionStatus;
    amount: number;
    wallet: any;
    goal?: any;
}) => {
    if (!transactionTouchesLedger(transactionStatus)) {
        return;
    }

    applyWalletDelta(
        wallet,
        -getWalletDeltaForTransaction(transactionType, amount),
        "Wallet does not have enough balance to reverse this transaction",
    );

    const goalDelta = getGoalDeltaForTransaction(transactionType, amount);
    if (goal && goalDelta !== 0) {
        applyGoalDelta(goal, -goalDelta);
    }
};

const syncGoalStatus = (goal: any) => {
    const deadline = goal.deadline ? new Date(goal.deadline) : null;

    if (deadline && new Date() > deadline) {
        goal.status = "expired";
        return;
    }

    goal.status =
        Number(goal.currentAmount) >= Number(goal.targetAmount)
            ? "completed"
            : "active";
};

const loadWalletForUser = async (
    walletId: unknown,
    userId: string,
    session: ClientSession,
) => {
    const wallet = await Wallet.findOne({ _id: walletId, userId }).session(
        session,
    );
    if (!wallet) {
        throw new TransactionRuleError(404, "Wallet not found");
    }

    return wallet;
};

const loadGoalForUser = async (
    goalId: unknown,
    userId: string,
    session: ClientSession,
) => {
    const goal = await Goal.findOne({ _id: goalId, userId }).session(session);
    if (!goal) {
        throw new TransactionRuleError(404, "Goal not found");
    }

    return goal;
};

const loadBudgetForUser = async (
    budgetId: unknown,
    userId: string,
    session: ClientSession,
) => {
    const budget = await Budget.findOne({ _id: budgetId, userId }).session(
        session,
    );
    if (!budget) {
        throw new TransactionRuleError(404, "Budget not found");
    }

    return budget;
};

const resolveBudgetCategoryForWallet = ({
    budget,
    walletId,
    providedCategory,
}: {
    budget: any;
    walletId: unknown;
    providedCategory?: string;
}) => {
    if (String(budget.walletId) !== String(walletId)) {
        throw new TransactionRuleError(
            400,
            "Selected budget does not belong to the chosen wallet",
        );
    }

    const budgetCategory = String(budget.category || "").trim();
    if (!budgetCategory) {
        throw new TransactionRuleError(
            400,
            "Selected budget is missing a valid category",
        );
    }

    if (providedCategory && providedCategory !== budgetCategory) {
        throw new TransactionRuleError(
            400,
            "Selected category does not match the chosen budget",
        );
    }

    return budgetCategory;
};

const assertBudgetMatchesTransactionDate = ({
    budget,
    transactionDate,
}: {
    budget: any;
    transactionDate: Date;
}) => {
    const month = transactionDate.getMonth() + 1;
    const year = transactionDate.getFullYear();

    if (budget.month !== month || budget.year !== year) {
        throw new TransactionRuleError(
            400,
            "Budget does not belong to the selected transaction month",
        );
    }
};

const assertBudgetCapacity = async ({
    budgetId,
    userId,
    amount,
    transactionDate,
    excludedTransactionId,
    session,
}: {
    budgetId: unknown;
    userId: string;
    amount: number;
    transactionDate: Date;
    excludedTransactionId?: Types.ObjectId;
    session: ClientSession;
}) => {
    const budget = await loadBudgetForUser(budgetId, userId, session);
    const month = transactionDate.getMonth() + 1;
    const year = transactionDate.getFullYear();

    if (budget.month !== month || budget.year !== year) {
        throw new TransactionRuleError(
            400,
            "Budget does not belong to the selected transaction month",
        );
    }

    const spent = await Transaction.aggregate([
        {
            $match: {
                userId,
                budgetId: new Types.ObjectId(String(budgetId)),
                type: TransactionType.EXPENSE,
                ...buildCompletedStatusQuery(),
                ...(excludedTransactionId
                    ? { _id: { $ne: excludedTransactionId } }
                    : {}),
                date: {
                    $gte: new Date(year, month - 1, 1),
                    $lt: new Date(year, month, 1),
                },
            },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
    ]).session(session);

    const totalSpent = spent[0]?.total || 0;
    if (totalSpent + amount > budget.amount) {
        throw new TransactionRuleError(
            400,
            "Budget limit would be exceeded by this expense",
            {
                budgetAmount: budget.amount,
                currentSpent: totalSpent,
                requestedAmount: amount,
            },
        );
    }
};

const syncWalletTransactionFlag = async (
    wallet: any,
    userId: string,
    session: ClientSession,
) => {
    const remainingTransactions = await Transaction.countDocuments({
        userId,
        walletId: wallet._id,
    }).session(session);

    wallet.hasTransactions = remainingTransactions > 0;
    await wallet.save({ session });
};

const getTransferCandidates = async (
    transaction: ITransaction & { createdAt?: Date },
    session: ClientSession,
) => {
    if (transaction.transferGroupId) {
        return Transaction.find({
            userId: transaction.userId,
            transferGroupId: transaction.transferGroupId,
        }).session(session);
    }

    if (!isTransferCategory(transaction.category)) {
        return [transaction];
    }

    const createdAt = transaction.createdAt
        ? new Date(transaction.createdAt)
        : new Date(transaction.date);
    const counterpart = await Transaction.findOne({
        _id: { $ne: transaction._id },
        userId: transaction.userId,
        category: TRANSFER_CATEGORY,
        amount: transaction.amount,
        type:
            transaction.type === TransactionType.INCOME
                ? TransactionType.EXPENSE
                : TransactionType.INCOME,
        walletId: { $ne: transaction.walletId },
        createdAt: {
            $gte: new Date(createdAt.getTime() - 5 * 60 * 1000),
            $lte: new Date(createdAt.getTime() + 5 * 60 * 1000),
        },
    })
        .sort({ createdAt: 1 })
        .session(session);

    return counterpart ? [transaction, counterpart] : [transaction];
};

export const createTransaction = async (req: any, res: Response) => {
    const session = await Transaction.startSession();
    session.startTransaction();

    try {
        const userId = req.user.uid;
        const {
            walletId,
            type,
            status,
            amount,
            category,
            date,
            note,
            budgetId,
            goalId,
            isSystemGenerated,
            isDeletable,
        } = req.body;

        const normalizedType = normalizeTransactionType(type);
        const normalizedAmount = parseWholeMoneyAmount(amount);
        const normalizedStatus =
            status !== undefined
                ? normalizeTransactionStatus(status)
                : TransactionStatus.COMPLETED;
        const normalizedDate = ensureTransactionDateAllowed(
            parseTransactionDateInput(date),
            normalizedStatus,
            Boolean(isSystemGenerated),
        );
        const providedCategory = parseOptionalCategory(category);
        const normalizedNote = normalizeOptionalNote(note);

        if (normalizedType === TransactionType.ADJUSTMENT) {
            throw new TransactionRuleError(
                400,
                "Adjustment transactions require a dedicated flow",
            );
        }

        if (budgetId && normalizedType !== TransactionType.EXPENSE) {
            throw new TransactionRuleError(
                400,
                "Budgets can only be linked to expense transactions",
            );
        }

        if (
            goalId &&
            normalizedType !== TransactionType.GOAL_DEPOSIT &&
            normalizedType !== TransactionType.GOAL_WITHDRAW
        ) {
            throw new TransactionRuleError(
                400,
                "Goals can only be linked to goal deposit or withdrawal transactions",
            );
        }

        const wallet = await loadWalletForUser(walletId, userId, session);
        let normalizedCategory = providedCategory;
        let budget: any = null;
        let goal: any = null;

        if (budgetId) {
            budget = await loadBudgetForUser(budgetId, userId, session);
            normalizedCategory = resolveBudgetCategoryForWallet({
                budget,
                walletId: wallet._id,
                providedCategory,
            });
            assertBudgetMatchesTransactionDate({
                budget,
                transactionDate: normalizedDate,
            });
        } else {
            normalizedCategory = parseCategory(providedCategory);
        }

        ensureTransferCategoryNotUsed(normalizedCategory);

        if (
            normalizedType === TransactionType.EXPENSE &&
            budgetId &&
            transactionTouchesLedger(normalizedStatus)
        ) {
            await assertBudgetCapacity({
                budgetId,
                userId,
                amount: normalizedAmount,
                transactionDate: normalizedDate,
                session,
            });
        }

        if (
            normalizedType === TransactionType.GOAL_DEPOSIT ||
            normalizedType === TransactionType.GOAL_WITHDRAW
        ) {
            if (!goalId) {
                throw new TransactionRuleError(
                    400,
                    "A goal is required for goal transfers",
                );
            }

            goal = await loadGoalForUser(goalId, userId, session);
        }

        if (
            normalizedType === TransactionType.GOAL_WITHDRAW &&
            transactionTouchesLedger(normalizedStatus) &&
            Number(goal.currentAmount || 0) < normalizedAmount
        ) {
            throw new TransactionRuleError(
                400,
                "Goal balance is not sufficient for this withdrawal",
            );
        }

        applyTransactionLedgerEffects({
            transactionType: normalizedType,
            transactionStatus: normalizedStatus,
            amount: normalizedAmount,
            wallet,
            goal,
        });

        wallet.hasTransactions = true;

        const transaction = new Transaction({
            userId,
            walletId,
            type: normalizedType,
            status: normalizedStatus,
            amount: normalizedAmount,
            category: normalizedCategory,
            date: normalizedDate,
            note: normalizedNote,
            budgetId: budgetId || undefined,
            goalId: goalId || undefined,
            isSystemGenerated: Boolean(isSystemGenerated),
            isDeletable: isDeletable !== undefined ? Boolean(isDeletable) : true,
        });

        await transaction.save({ session });
        await wallet.save({ session });
        if (goal) {
            await goal.save({ session });
        }
        await touchTransactionCacheState(userId, req.user, session);
        await session.commitTransaction();

        return res.status(201).json(transaction);
    } catch (error) {
        await session.abortTransaction();
        return handleControllerError(res, error, "Failed to create transaction");
    } finally {
        session.endSession();
    }
};

export const createInternalTransfer = async (req: any, res: Response) => {
    const session = await Transaction.startSession();
    session.startTransaction();

    try {
        const userId = req.user.uid;
        const {
            fromWalletId,
            toWalletId,
            amount,
            date,
            sourceNote,
            destinationNote,
        } = req.body;

        if (!fromWalletId || !toWalletId) {
            throw new TransactionRuleError(
                400,
                "Both source and destination wallets are required",
            );
        }

        if (String(fromWalletId) === String(toWalletId)) {
            throw new TransactionRuleError(
                400,
                "Source and destination wallets must be different",
            );
        }

        const normalizedAmount = parseWholeMoneyAmount(amount);
        const normalizedDate = ensureTransactionDateAllowed(
            parseTransactionDateInput(date),
            TransactionStatus.COMPLETED,
        );
        const fromWallet = await loadWalletForUser(fromWalletId, userId, session);
        const toWallet = await loadWalletForUser(toWalletId, userId, session);

        if (String(fromWallet.currency || "VND") !== String(toWallet.currency || "VND")) {
            throw new TransactionRuleError(
                400,
                "Internal transfers require the same currency on both wallets",
            );
        }

        applyWalletDelta(
            fromWallet,
            -normalizedAmount,
            "Insufficient wallet balance",
        );
        applyWalletDelta(toWallet, normalizedAmount, "Wallet balance overflow");

        fromWallet.hasTransactions = true;
        toWallet.hasTransactions = true;

        const transferGroupId = new Types.ObjectId().toHexString();
        const expenseTransaction = new Transaction({
            userId,
            walletId: fromWallet._id,
            transferPeerWalletId: toWallet._id,
            transferGroupId,
            type: TransactionType.EXPENSE,
            status: TransactionStatus.COMPLETED,
            amount: normalizedAmount,
            category: TRANSFER_CATEGORY,
            date: normalizedDate,
            note: normalizeOptionalNote(sourceNote),
            isSystemGenerated: true,
            isDeletable: true,
        });
        const incomeTransaction = new Transaction({
            userId,
            walletId: toWallet._id,
            transferPeerWalletId: fromWallet._id,
            transferGroupId,
            type: TransactionType.INCOME,
            status: TransactionStatus.COMPLETED,
            amount: normalizedAmount,
            category: TRANSFER_CATEGORY,
            date: normalizedDate,
            note: normalizeOptionalNote(destinationNote),
            isSystemGenerated: true,
            isDeletable: true,
        });

        await expenseTransaction.save({ session });
        await incomeTransaction.save({ session });
        await fromWallet.save({ session });
        await toWallet.save({ session });

        await touchTransactionCacheState(userId, req.user, session);
        await session.commitTransaction();

        return res.status(201).json({
            success: true,
            data: {
                transferGroupId,
                transactions: [expenseTransaction, incomeTransaction],
            },
        });
    } catch (error) {
        await session.abortTransaction();
        return handleControllerError(
            res,
            error,
            "Failed to create internal transfer",
        );
    } finally {
        session.endSession();
    }
};

export const getStatementReport = async (req: any, res: Response) => {
    try {
        const { walletId, startDate, endDate } = req.query;
        const userId = req.user.uid;

        const wallet = await Wallet.findOne({ _id: walletId, userId });
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found",
            });
        }

        const periodBeforeStart = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    walletId: new Types.ObjectId(walletId as string),
                    ...buildCompletedStatusQuery(),
                    date: { $lt: new Date(startDate as string) },
                },
            },
            {
                $group: {
                    _id: null,
                    totalIncome: {
                        $sum: {
                            $cond: [{ $eq: ["$type", TransactionType.INCOME] }, "$amount", 0],
                        },
                    },
                    totalExpense: {
                        $sum: {
                            $cond: [{ $eq: ["$type", TransactionType.EXPENSE] }, "$amount", 0],
                        },
                    },
                },
            },
        ]);

        const transactions = await Transaction.find({
            userId,
            walletId,
            ...buildCompletedStatusQuery(),
            date: {
                $gte: new Date(startDate as string),
                $lte: new Date(endDate as string),
            },
        }).sort({ date: 1, createdAt: 1 });

        const periodTotals = transactions.reduce(
            (acc, transaction) => {
                if (transaction.type === TransactionType.INCOME) {
                    acc.totalIncome += transaction.amount;
                } else if (transaction.type === TransactionType.EXPENSE) {
                    acc.totalExpense += transaction.amount;
                }

                return acc;
            },
            { totalIncome: 0, totalExpense: 0 },
        );

        const startBalance =
            Number(wallet.initialBalance || 0) +
            Number(periodBeforeStart[0]?.totalIncome || 0) -
            Number(periodBeforeStart[0]?.totalExpense || 0);
        const endBalance =
            startBalance + periodTotals.totalIncome - periodTotals.totalExpense;

        return res.json({
            success: true,
            data: {
                initialBalance: wallet.initialBalance,
                startBalance,
                endBalance,
                totalIncome: periodTotals.totalIncome,
                totalExpense: periodTotals.totalExpense,
                transactions,
            },
        });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            "Failed to load statement report",
        );
    }
};

export const getTransactions = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const pageNumber = parsePositiveInt(req.query.page, 1);
        const pageSize = parsePositiveInt(req.query.limit, 10);
        const query = buildTransactionQuery(userId, req.query);

        res.vary("Authorization");
        res.set("Cache-Control", "private, no-store, max-age=0");

        const skip = (pageNumber - 1) * pageSize;
        const [summaryData, transactions] = await Promise.all([
            Transaction.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        income: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ["$type", TransactionType.INCOME] },
                                            completedStatusExpression,
                                            { $ne: ["$category", TRANSFER_CATEGORY] },
                                        ],
                                    },
                                    "$amount",
                                    0,
                                ],
                            },
                        },
                        expense: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ["$type", TransactionType.EXPENSE] },
                                            completedStatusExpression,
                                            { $ne: ["$category", TRANSFER_CATEGORY] },
                                        ],
                                    },
                                    "$amount",
                                    0,
                                ],
                            },
                        },
                    },
                },
            ]),
            Transaction.find(query)
                .sort({ date: -1, createdAt: -1 })
                .skip(skip)
                .limit(pageSize)
                .select(
                    "_id walletId budgetId type status amount category date note createdAt transferGroupId isSystemGenerated",
                )
                .populate("walletId", "name")
                .lean(),
        ]);

        const aggregateRow = summaryData[0] || {
            total: 0,
            income: 0,
            expense: 0,
        };
        const total = aggregateRow.total;

        return res.json({
            success: true,
            data: {
                transactions,
                summary: {
                    income: aggregateRow.income,
                    expense: aggregateRow.expense,
                    profit: aggregateRow.income - aggregateRow.expense,
                },
                total,
                pagination: {
                    total,
                    page: pageNumber,
                    limit: pageSize,
                    pages: Math.max(1, Math.ceil(total / pageSize)),
                },
            },
        });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            "Failed to load transactions",
        );
    }
};

export const getTransactionsByWallet = async (req: any, res: Response) => {
    try {
        const { walletId } = req.params;
        const userId = req.user.uid;

        const wallet = await Wallet.findOne({ _id: walletId, userId });
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found",
            });
        }

        const transactions = await Transaction.find({ walletId, userId })
            .sort({ date: -1, createdAt: -1 })
            .select(
                "_id walletId budgetId type status amount category date note createdAt transferGroupId isSystemGenerated",
            )
            .populate("walletId", "name")
            .lean();

        return res.json({
            success: true,
            data: transactions,
        });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            "Failed to load wallet transactions",
        );
    }
};

export const getTransactionById = async (req: any, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user.uid;

        const transaction = await Transaction.findOne({
            _id: id,
            userId,
        }).populate("walletId", "name");

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found",
            });
        }

        return res.json({
            success: true,
            data: transaction,
        });
    } catch (error) {
        return handleControllerError(
            res,
            error,
            "Failed to load transaction details",
        );
    }
};

export const updateTransaction = async (req: any, res: Response) => {
    const session = await Transaction.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const userId = req.user.uid;
        const currentTransaction = await Transaction.findOne({
            _id: id,
            userId,
        }).session(session);

        if (!currentTransaction) {
            throw new TransactionRuleError(404, "Transaction not found");
        }

        if (isTransferTransaction(currentTransaction)) {
            throw new TransactionRuleError(
                400,
                "Transfer transactions must be recreated from the wallet transfer flow",
            );
        }

        if (!supportsManualTransactionEditing(currentTransaction.type)) {
            throw new TransactionRuleError(
                400,
                "This transaction type cannot be edited from this screen",
            );
        }

        const currentStatus =
            currentTransaction.status || TransactionStatus.COMPLETED;

        const nextType =
            req.body.type !== undefined
                ? normalizeTransactionType(req.body.type)
                : currentTransaction.type;
        if (!supportsManualTransactionEditing(nextType)) {
            throw new TransactionRuleError(
                400,
                "This transaction type cannot be edited from this screen",
            );
        }

        const nextAmount =
            req.body.amount !== undefined
                ? parseWholeMoneyAmount(req.body.amount)
                : Number(currentTransaction.amount);
        const nextStatus =
            req.body.status !== undefined
                ? normalizeTransactionStatus(req.body.status)
                : currentStatus;
        const nextDate = ensureTransactionDateAllowed(
            req.body.date !== undefined
                ? parseTransactionDateInput(req.body.date)
                : new Date(currentTransaction.date),
            nextStatus,
            Boolean(currentTransaction.isSystemGenerated),
        );
        const providedNextCategory =
            req.body.category !== undefined
                ? parseOptionalCategory(req.body.category)
                : parseOptionalCategory(currentTransaction.category);
        const nextNote =
            req.body.note !== undefined
                ? normalizeOptionalNote(req.body.note)
                : currentTransaction.note;
        const nextBudgetId =
            req.body.budgetId !== undefined
                ? req.body.budgetId || undefined
                : currentTransaction.budgetId;

        if (nextBudgetId && nextType !== TransactionType.EXPENSE) {
            throw new TransactionRuleError(
                400,
                "Budgets can only be linked to expense transactions",
            );
        }

        const oldWallet = await loadWalletForUser(
            currentTransaction.walletId,
            userId,
            session,
        );
        const nextWallet =
            req.body.walletId &&
            String(req.body.walletId) !== String(currentTransaction.walletId)
                ? await loadWalletForUser(req.body.walletId, userId, session)
                : oldWallet;
        const walletChanged = String(oldWallet._id) !== String(nextWallet._id);
        let nextCategory = providedNextCategory;

        if (nextBudgetId) {
            const nextBudget = await loadBudgetForUser(
                nextBudgetId,
                userId,
                session,
            );
            nextCategory = resolveBudgetCategoryForWallet({
                budget: nextBudget,
                walletId: nextWallet._id,
                providedCategory: providedNextCategory,
            });
            assertBudgetMatchesTransactionDate({
                budget: nextBudget,
                transactionDate: nextDate,
            });
        } else {
            nextCategory = parseCategory(providedNextCategory);
        }

        ensureTransferCategoryNotUsed(nextCategory);

        revertTransactionLedgerEffects({
            transactionType: currentTransaction.type,
            transactionStatus: currentStatus,
            amount: Number(currentTransaction.amount),
            wallet: oldWallet,
        });

        if (
            nextType === TransactionType.EXPENSE &&
            nextBudgetId &&
            transactionTouchesLedger(nextStatus)
        ) {
            await assertBudgetCapacity({
                budgetId: nextBudgetId,
                userId,
                amount: nextAmount,
                transactionDate: nextDate,
                excludedTransactionId: new Types.ObjectId(String(currentTransaction._id)),
                session,
            });
        }

        applyTransactionLedgerEffects({
            transactionType: nextType,
            transactionStatus: nextStatus,
            amount: nextAmount,
            wallet: nextWallet,
        });

        currentTransaction.walletId = nextWallet._id as any;
        currentTransaction.type = nextType;
        currentTransaction.status = nextStatus;
        currentTransaction.amount = nextAmount;
        currentTransaction.category = nextCategory;
        currentTransaction.date = nextDate;
        currentTransaction.note = nextNote;
        currentTransaction.budgetId = nextBudgetId as any;

        nextWallet.hasTransactions = true;

        await currentTransaction.save({ session });
        await oldWallet.save({ session });
        if (walletChanged) {
            await nextWallet.save({ session });
        }

        if (walletChanged) {
            await syncWalletTransactionFlag(oldWallet, userId, session);
        }

        await touchTransactionCacheState(userId, req.user, session);
        await session.commitTransaction();

        return res.json({
            success: true,
            data: currentTransaction,
            message: "Transaction updated successfully",
        });
    } catch (error) {
        await session.abortTransaction();
        return handleControllerError(res, error, "Failed to update transaction");
    } finally {
        session.endSession();
    }
};

export const deleteTransaction = async (req: any, res: Response) => {
    const session = await Transaction.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const userId = req.user.uid;
        const transaction = await Transaction.findOne({
            _id: new Types.ObjectId(id),
            userId,
        }).session(session);

        if (!transaction) {
            throw new TransactionRuleError(404, "Transaction not found");
        }

        const linkedTransactions = await getTransferCandidates(
            transaction as any,
            session,
        );
        const uniqueTransactions = linkedTransactions.filter(
            (candidate, index, items) =>
                items.findIndex(
                    (item) => String(item._id) === String(candidate._id),
                ) === index,
        );

        const walletIds = [
            ...new Set(uniqueTransactions.map((entry) => String(entry.walletId))),
        ];
        const wallets = await Wallet.find({
            _id: { $in: walletIds.map((walletId) => new Types.ObjectId(walletId)) },
            userId,
        }).session(session);
        const walletMap = new Map(
            wallets.map((wallet) => [String(wallet._id), wallet]),
        );
        const goalMap = new Map<string, any>();

        for (const entry of uniqueTransactions) {
            if (entry.type === TransactionType.ADJUSTMENT) {
                throw new TransactionRuleError(
                    400,
                    "Adjustment transactions cannot be deleted safely",
                );
            }

            const wallet = walletMap.get(String(entry.walletId));
            if (!wallet) {
                throw new TransactionRuleError(404, "Wallet not found");
            }

            applyWalletDelta(
                wallet,
                -getWalletDeltaForTransaction(entry.type, Number(entry.amount)),
                "Wallet does not have enough balance to reverse this transaction",
            );

            if (
                entry.goalId &&
                (entry.type === TransactionType.GOAL_DEPOSIT ||
                    entry.type === TransactionType.GOAL_WITHDRAW)
            ) {
                const goalKey = String(entry.goalId);
                let goal = goalMap.get(goalKey);
                if (!goal) {
                    goal = await loadGoalForUser(goalKey, userId, session);
                    goalMap.set(goalKey, goal);
                }

                if (entry.type === TransactionType.GOAL_DEPOSIT) {
                    goal.currentAmount = Math.max(
                        Number(goal.currentAmount || 0) - Number(entry.amount),
                        0,
                    );
                } else {
                    goal.currentAmount =
                        Number(goal.currentAmount || 0) + Number(entry.amount);
                }

                syncGoalStatus(goal);
            }
        }

        for (const wallet of wallets) {
            await wallet.save({ session });
        }

        for (const goal of Array.from(goalMap.values())) {
            await goal.save({ session });
        }

        await Transaction.deleteMany({
            _id: {
                $in: uniqueTransactions.map(
                    (entry) => new Types.ObjectId(String(entry._id)),
                ),
            },
        }).session(session);

        for (const wallet of wallets) {
            await syncWalletTransactionFlag(wallet, userId, session);
        }

        await touchTransactionCacheState(userId, req.user, session);
        await session.commitTransaction();

        return res.json({
            success: true,
            message:
                uniqueTransactions.length > 1
                    ? "Transfer deleted successfully"
                    : "Transaction deleted successfully",
            data: {
                id: transaction._id,
                deletedCount: uniqueTransactions.length,
            },
        });
    } catch (error) {
        await session.abortTransaction();
        return handleControllerError(res, error, "Failed to delete transaction");
    } finally {
        session.endSession();
    }
};
