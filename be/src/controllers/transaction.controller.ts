import { Request, Response } from "express";
import Transaction, { TransactionType } from "../models/Transaction";
import Wallet from "../models/Wallet";
import Budget from "../models/Budget";
import Goal from "../models/Goal";
import { Types } from "mongoose";
import {
    buildTransactionCacheTag,
    getTransactionCacheState,
    touchTransactionCacheState,
} from "../utils/transaction-cache";

const TRANSACTION_LIST_CACHE_CONTROL =
    "private, max-age=60, stale-while-revalidate=300";

const parsePositiveInt = (value: unknown, fallback: number) => {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const escapeRegex = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildTransactionQuery = (userId: string, reqQuery: any) => {
    const {
        startDate,
        endDate,
        type,
        category,
        walletId,
        note,
    } = reqQuery;
    const query: any = { userId };

    if (walletId) query.walletId = walletId;
    if (type) query.type = type;
    if (category) query.category = category;

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

const buildTransactionQueryKey = (query: Record<string, unknown>) => {
    const pairs = Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .sort(([left], [right]) => left.localeCompare(right));

    return new URLSearchParams(
        pairs.map(([key, value]) => [key, String(value)]),
    ).toString();
};

export const createTransaction = async (req: any, res: Response) => {
    const session = await Transaction.startSession();
    session.startTransaction();

    try {
        const {
            walletId,
            type,
            amount,
            category,
            date,
            note,
            budgetId,
            goalId,
            isSystemGenerated,
            isDeletable,
        } = req.body;
        const userId = req.user.uid;

        // Kiểm tra ví có tồn tại và thuộc về người dùng không
        const wallet = await Wallet.findOne({ _id: walletId, userId }).session(
            session,
        );
        if (!wallet) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Không tìm thấy ví" });
        }

        // Validate budgetId if provided
        if (budgetId) {
            const budget = await Budget.findOne({
                _id: budgetId,
                userId,
            }).session(session);
            if (!budget) {
                await session.abortTransaction();
                return res
                    .status(404)
                    .json({ message: "Không tìm thấy ngân sách" });
            }
        }

        // Validate goalId if provided
        if (goalId) {
            const goal = await Goal.findOne({ _id: goalId, userId }).session(
                session,
            );
            if (!goal) {
                await session.abortTransaction();
                return res
                    .status(404)
                    .json({ message: "Không tìm thấy mục tiêu" });
            }
        }

        // Handle different transaction types
        if (type === TransactionType.ADJUSTMENT) {
            // Adjustment transactions không kiểm tra số dư
            // Cập nhật số dư theo direction (INCOME/EXPENSE)
            const direction = req.body.direction || "income";
            if (direction === "income") {
                wallet.balance += amount;
            } else {
                wallet.balance = Math.max(wallet.balance - amount, 0);
            }
        } else if (type === TransactionType.GOAL_DEPOSIT) {
            // Kiểm tra số dư ví
            if (wallet.balance < amount) {
                await session.abortTransaction();
                return res
                    .status(400)
                    .json({ message: "Số dư không đủ để tiết kiệm" });
            }
            // Trừ tiền ví
            wallet.balance -= amount;
            // Cộng tiền vào mục tiêu
            const goal = await Goal.findById(goalId).session(session);
            if (goal) {
                goal.currentAmount = (goal.currentAmount || 0) + amount;
                await goal.save({ session });
            }
        } else if (type === TransactionType.GOAL_WITHDRAW) {
            // Cộng tiền vào ví
            wallet.balance += amount;
            // Trừ tiền từ mục tiêu
            const goal = await Goal.findById(goalId).session(session);
            if (goal) {
                goal.currentAmount = Math.max(
                    (goal.currentAmount || 0) - amount,
                    0,
                );
                await goal.save({ session });
            }
        } else {
            // Kiểm tra số dư nếu là giao dịch chi tiêu
            if (type === TransactionType.EXPENSE && wallet.balance < amount) {
                await session.abortTransaction();
                return res.status(400).json({ message: "Số dư không đủ" });
            }

            // Kiểm tra ngân sách nếu có budgetId
            if (budgetId && type === TransactionType.EXPENSE) {
                const budget = await Budget.findById(budgetId).session(session);
                if (budget) {
                    // Tính tổng đã chi trong tháng cho ngân sách này
                    const month = new Date(date || new Date()).getMonth() + 1;
                    const year = new Date(date || new Date()).getFullYear();
                    const spent = await Transaction.aggregate([
                        {
                            $match: {
                                userId,
                                budgetId: new Types.ObjectId(
                                    budgetId as string,
                                ),
                                type: TransactionType.EXPENSE,
                                date: {
                                    $gte: new Date(year, month - 1, 1),
                                    $lt: new Date(year, month, 1),
                                },
                            },
                        },
                        { $group: { _id: null, total: { $sum: "$amount" } } },
                    ]);
                    const totalSpent = spent[0]?.total || 0;
                    if (totalSpent + amount > budget.amount) {
                        await session.abortTransaction();
                        return res.status(400).json({
                            message:
                                "Vượt ngân sách. Ngân sách: " +
                                budget.amount +
                                ", Đã chi: " +
                                totalSpent +
                                ", Giao dịch: " +
                                amount,
                        });
                    }
                }
            }

            // Cập nhật số dư ví cho INCOME/EXPENSE
            wallet.balance =
                type === TransactionType.INCOME
                    ? wallet.balance + amount
                    : wallet.balance - amount;
        }

        // Tạo giao dịch
        const transaction = new Transaction({
            userId,
            walletId,
            type,
            amount,
            category,
            date: date || new Date(),
            note,
            budgetId: budgetId || undefined,
            goalId: goalId || undefined,
            isSystemGenerated: isSystemGenerated || false,
            isDeletable: isDeletable !== undefined ? isDeletable : true,
        });

        await Promise.all([
            transaction.save({ session }),
            wallet.save({ session }),
        ]);

        // Set hasTransactions = true cho wallet nếu đây là giao dịch đầu tiên (không phải adjustment)
        if (!wallet.hasTransactions && type !== TransactionType.ADJUSTMENT) {
            wallet.hasTransactions = true;
            await wallet.save({ session });
        }

        await touchTransactionCacheState(userId, req.user, session);
        await session.commitTransaction();
        res.status(201).json(transaction);
    } catch (error) {
        await session.abortTransaction();
        const errorMessage =
            error instanceof Error
                ? error.message
                : "Đã xảy ra lỗi không xác định";
        res.status(500).json({
            message: "Lỗi khi tạo giao dịch",
            error: errorMessage,
        });
    } finally {
        session.endSession();
    }
};

export const getStatementReport = async (req: Request, res: Response) => {
    try {
        const { walletId, startDate, endDate } = req.query;

        // 1. Lấy thông tin ví để lấy số dư ban đầu
        const wallet = await Wallet.findById(walletId);
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy ví",
            });
        }

        // 2. Lấy tổng thu/chi từ lúc tạo ví đến trước ngày bắt đầu
        const periodBeforeStart = await Transaction.aggregate([
            {
                $match: {
                    walletId: new Types.ObjectId(walletId as string),
                    date: { $lt: new Date(startDate as string) },
                },
            },
            {
                $group: {
                    _id: null,
                    totalIncome: {
                        $sum: {
                            $cond: [{ $eq: ["$type", "INCOME"] }, "$amount", 0],
                        },
                    },
                    totalExpense: {
                        $sum: {
                            $cond: [
                                { $eq: ["$type", "EXPENSE"] },
                                "$amount",
                                0,
                            ],
                        },
                    },
                },
            },
        ]);

        // 3. Lấy giao dịch trong kỳ
        const transactions = await Transaction.find({
            walletId,
            date: {
                $gte: new Date(startDate as string),
                $lte: new Date(endDate as string),
            },
        }).sort({ date: 1 });

        // 4. Tính toán tổng thu/chi trong kỳ
        const periodTotals = transactions.reduce(
            (acc, t) => {
                if (t.type === "INCOME") {
                    acc.totalIncome += t.amount;
                } else {
                    acc.totalExpense += t.amount;
                }
                return acc;
            },
            { totalIncome: 0, totalExpense: 0 },
        );

        // 5. Tính số dư
        const startBalance =
            wallet.initialBalance +
            (periodBeforeStart[0]?.totalIncome || 0) -
            (periodBeforeStart[0]?.totalExpense || 0);

        const endBalance =
            startBalance + periodTotals.totalIncome - periodTotals.totalExpense;

        res.json({
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
        console.error("Lỗi khi lấy báo cáo sao kê:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy báo cáo sao kê",
            error:
                error instanceof Error ? error.message : "Lỗi không xác định",
        });
    }
};

export const getTransactions = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const pageNumber = parsePositiveInt(req.query.page, 1);
        const pageSize = parsePositiveInt(req.query.limit, 10);
        const query = buildTransactionQuery(userId, req.query);
        const queryKey = buildTransactionQueryKey({
            ...req.query,
            page: pageNumber,
            limit: pageSize,
        });
        const cacheState = await getTransactionCacheState(userId);

        res.vary("Authorization");
        res.set("Cache-Control", TRANSACTION_LIST_CACHE_CONTROL);
        res.set(
            "ETag",
            buildTransactionCacheTag(cacheState.version, queryKey),
        );
        if (cacheState.updatedAt) {
            res.set("Last-Modified", cacheState.updatedAt.toUTCString());
        }

        if (req.fresh) {
            return res.status(304).end();
        }

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
                                    { $eq: ["$type", TransactionType.INCOME] },
                                    "$amount",
                                    0,
                                ],
                            },
                        },
                        expense: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$type", TransactionType.EXPENSE] },
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
                .select("_id walletId type amount category date note createdAt")
                .populate("walletId", "name")
                .lean(),
        ]);

        const aggregateRow = summaryData[0] || {
            total: 0,
            income: 0,
            expense: 0,
        };
        const total = aggregateRow.total;
        const summary = {
            income: aggregateRow.income,
            expense: aggregateRow.expense,
            profit: aggregateRow.income - aggregateRow.expense,
        };

        res.json({
            success: true,
            data: {
                transactions,
                summary,
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
        console.error("Lỗi khi lấy danh sách giao dịch:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách giao dịch",
            error:
                error instanceof Error ? error.message : "Lỗi không xác định",
        });
    }
};
/**
 * Lấy danh sách giao dịch theo ví
 */
export const getTransactionsByWallet = async (req: any, res: Response) => {
    try {
        const { walletId } = req.params;
        const userId = req.user.uid;

        // Kiểm tra ví có tồn tại và thuộc về người dùng không
        const wallet = await Wallet.findOne({ _id: walletId, userId });
        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy ví",
            });
        }

        const transactions = await Transaction.find({ walletId, userId })
            .sort({ date: -1, createdAt: -1 })
            .select("_id walletId type amount category date note createdAt")
            .populate("walletId", "name")
            .lean();

        res.json({
            success: true,
            data: transactions,
        });
    } catch (error) {
        console.error("Lỗi khi lấy danh sách giao dịch theo ví:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách giao dịch",
            error:
                error instanceof Error ? error.message : "Lỗi không xác định",
        });
    }
};

/**
 * Lấy thông tin chi tiết một giao dịch
 */
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
                message: "Không tìm thấy giao dịch",
            });
        }

        res.json({
            success: true,
            data: transaction,
        });
    } catch (error) {
        console.error("Lỗi khi lấy thông tin giao dịch:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi khi lấy thông tin giao dịch",
            error:
                error instanceof Error ? error.message : "Lỗi không xác định",
        });
    }
};

/**
 * Cập nhật thông tin giao dịch
 */
export const updateTransaction = async (req: any, res: Response) => {
    const session = await Transaction.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const { walletId, type, amount, category, date, note } = req.body;
        const userId = req.user.uid;

        // Tìm giao dịch hiện tại và kiểm tra quyền sở hữu
        const currentTransaction = await Transaction.findOne({
            _id: id,
            userId,
        }).session(session);

        if (!currentTransaction) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message:
                    "Không tìm thấy giao dịch hoặc bạn không có quyền chỉnh sửa",
            });
        }

        // Kiểm tra ví cũ
        const oldWallet = await Wallet.findById(
            currentTransaction.walletId,
        ).session(session);
        if (!oldWallet) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy ví cũ",
            });
        }

        // Kiểm tra ví mới (nếu có thay đổi)
        let newWallet = oldWallet;
        if (walletId && walletId !== currentTransaction.walletId.toString()) {
            const foundWallet = await Wallet.findOne({
                _id: walletId,
                userId,
            }).session(session);
            if (!foundWallet) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy ví mới",
                });
            }
            newWallet = foundWallet as any; // Type assertion since we've already checked it's not null
        }

        // Hoàn tác số dư từ ví cũ
        if (currentTransaction.type === TransactionType.INCOME) {
            oldWallet.balance =
                Number(oldWallet.balance) - Number(currentTransaction.amount);
        } else {
            oldWallet.balance =
                Number(oldWallet.balance) + Number(currentTransaction.amount);
        }

        // Cập nhật số dư cho ví mới
        if (type === TransactionType.INCOME) {
            newWallet.balance = Number(newWallet.balance) + Number(amount);
        } else {
            // Kiểm tra số dư nếu là giao dịch chi tiêu
            if (newWallet.balance < amount) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: "Số dư không đủ",
                });
            }
            newWallet.balance = Number(newWallet.balance) - Number(amount);
        }

        // Cập nhật giao dịch
        const updatedTransaction = await Transaction.findByIdAndUpdate(
            id,
            {
                walletId: walletId || currentTransaction.walletId,
                type: type || currentTransaction.type,
                amount: amount || currentTransaction.amount,
                category: category || currentTransaction.category,
                date: date || currentTransaction.date,
                note: note !== undefined ? note : currentTransaction.note,
            },
            { new: true, session },
        );

        if (!updatedTransaction) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Không thể cập nhật giao dịch",
            });
        }

        // Lưu các thay đổi
        const savePromises: Promise<any>[] = [oldWallet.save({ session })];

        if (walletId !== currentTransaction.walletId.toString()) {
            savePromises.push(newWallet.save({ session }));
        }

        savePromises.push(updatedTransaction.save({ session }));
        await Promise.all(savePromises);

        await touchTransactionCacheState(userId, req.user, session);
        await session.commitTransaction();

        res.json({
            success: true,
            data: updatedTransaction,
            message: "Cập nhật giao dịch thành công",
        });
    } catch (error) {
        await session.abortTransaction();
        const errorMessage =
            error instanceof Error
                ? error.message
                : "Đã xảy ra lỗi không xác định";
        res.status(500).json({
            message: "Lỗi khi cập nhật giao dịch",
            error: errorMessage,
        });
    } finally {
        session.endSession();
    }
};

/**
 * Xóa một giao dịch
 */
export const deleteTransaction = async (req: any, res: Response) => {
    const session = await Transaction.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const userId = req.user.uid;

        // Tìm giao dịch cần xóa
        const transaction = await Transaction.findOne({
            _id: new Types.ObjectId(id),
            userId,
        }).session(session);

        if (!transaction) {
            console.error(
                `[DeleteTransaction] 404 Not Found: TransactionID=${id}, UserUID=${userId}`,
            );
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message:
                    "Không tìm thấy giao dịch để xóa hoặc bạn không có quyền",
                debug: { id, userId }, // Giúp debug cho user trong lúc phát triển
            });
        }

        // Tìm và cập nhật số dư ví
        const wallet = await Wallet.findById(transaction.walletId).session(
            session,
        );

        if (wallet) {
            // Hoàn tác số dư nếu ví tồn tại
            if (transaction.type === TransactionType.INCOME) {
                wallet.balance =
                    Number(wallet.balance) - Number(transaction.amount);
            } else {
                wallet.balance =
                    Number(wallet.balance) + Number(transaction.amount);
            }
            await wallet.save({ session });
        }

        // Xóa giao dịch
        await Transaction.deleteOne({ _id: id }).session(session);

        await touchTransactionCacheState(userId, req.user, session);
        await session.commitTransaction();

        res.json({
            success: true,
            message: "Xóa giao dịch thành công",
            data: { id: transaction._id },
        });
    } catch (error) {
        await session.abortTransaction();
        const errorMessage =
            error instanceof Error
                ? error.message
                : "Đã xảy ra lỗi không xác định";
        res.status(500).json({
            success: false,
            message: "Lỗi khi xóa giao dịch",
            error: errorMessage,
        });
    } finally {
        session.endSession();
    }
};
