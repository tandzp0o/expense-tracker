import { Request, Response } from "express";
import Transaction, {
    TransactionType,
    ITransaction,
} from "../models/Transaction";
import Wallet from "../models/Wallet";
import { Types } from "mongoose";

export const createTransaction = async (req: any, res: Response) => {
    const session = await Transaction.startSession();
    session.startTransaction();

    try {
        const { walletId, type, amount, category, date, note } = req.body;
        const userId = req.user.uid;

        // Kiểm tra ví có tồn tại và thuộc về người dùng không
        const wallet = await Wallet.findOne({ _id: walletId, userId }).session(
            session
        );
        if (!wallet) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Không tìm thấy ví" });
        }

        // Kiểm tra số dư nếu là giao dịch chi tiêu
        if (type === TransactionType.EXPENSE && wallet.balance < amount) {
            await session.abortTransaction();
            return res.status(400).json({ message: "Số dư không đủ" });
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
        });

        // Cập nhật số dư ví
        wallet.balance =
            type === TransactionType.INCOME
                ? wallet.balance + amount
                : wallet.balance - amount;

        await Promise.all([
            transaction.save({ session }),
            wallet.save({ session }),
        ]);

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
            { totalIncome: 0, totalExpense: 0 }
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
        // 1. Thêm 'note' vào đây để lấy nó ra từ query
        const { startDate, endDate, type, category, walletId, note } =
            req.query;
        const userId = req.user.uid;

        const query: any = { userId };

        if (walletId) query.walletId = walletId;
        if (type) query.type = type;
        if (category) query.category = category;

        // 2. Thêm khối xử lý cho 'note'
        if (note) {
            // Sử dụng $regex để tìm kiếm 'note' có chứa chuỗi được gửi lên
            // $options: 'i' để không phân biệt chữ hoa/thường
            query.note = { $regex: note, $options: "i" };
        }

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate as string);
            if (endDate) query.date.$lte = new Date(endDate as string);
        }

        const transactions = await Transaction.find(query)
            .sort({ date: -1, createdAt: -1 })
            .populate("walletId", "name");

        // ... phần còn lại của code không thay đổi
        const summary = transactions.reduce(
            (acc, t) => {
                if (t.type === TransactionType.INCOME) {
                    acc.income += t.amount;
                } else {
                    acc.expense += t.amount;
                }
                return acc;
            },
            { income: 0, expense: 0, profit: 0 }
        );

        summary.profit = summary.income - summary.expense;

        res.json({
            success: true,
            data: {
                transactions,
                summary,
                total: transactions.length,
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
            .populate("walletId", "name");

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

        // Tìm giao dịch hiện tại
        const currentTransaction = await Transaction.findById(id).session(
            session
        );
        if (!currentTransaction) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy giao dịch để cập nhật",
            });
        }

        // Kiểm tra ví cũ
        const oldWallet = await Wallet.findById(
            currentTransaction.walletId
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
            { new: true, session }
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

        await session.commitTransaction();

        res.json({
            success: true,
            data: updatedTransaction,
            message: "Cập nhật giao dịch thành công",
        });
    } catch (error) {
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
            _id: id,
            userId,
        }).session(session);
        if (!transaction) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy giao dịch để xóa",
            });
        }

        // Tìm và cập nhật số dư ví
        const wallet = await Wallet.findById(transaction.walletId).session(
            session
        );
        if (!wallet) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy ví liên quan",
            });
        }

        // Hoàn tác số dư
        if (transaction.type === TransactionType.INCOME) {
            wallet.balance =
                Number(wallet.balance) - Number(transaction.amount);
        } else {
            wallet.balance =
                Number(wallet.balance) + Number(transaction.amount);
        }

        // Xóa giao dịch và cập nhật số dư
        await Promise.all([
            Transaction.deleteOne({ _id: id }).session(session),
            wallet.save({ session }),
        ]);

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
