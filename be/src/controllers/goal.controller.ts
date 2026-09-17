import { Request, Response } from "express";
import { ClientSession } from "mongoose";
import Goal from "../models/Goal";
import Transaction, {
    TransactionStatus,
    TransactionType,
} from "../models/Transaction";
import Wallet from "../models/Wallet";
import { GOAL_REFUND_CATEGORY } from "../constants/categories";
import { touchTransactionCacheState } from "../utils/transaction-cache";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

export const createGoal = [
    upload.single("image"), // Allow single image upload
    async (req: any, res: Response) => {
        try {
            const { title, description, targetAmount, category, deadline } =
                req.body;
            const userId = req.user.uid;

            let imageUrl: string | undefined;
            if (req.file) {
                const result = await new Promise<any>((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { folder: "goals" },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        },
                    );
                    stream.end(req.file.buffer);
                });
                imageUrl = result.secure_url;
            }

            const goal = new Goal({
                userId,
                title,
                description,
                targetAmount: parseFloat(targetAmount),
                // Saved amounts only move through GOAL_DEPOSIT/GOAL_WITHDRAW
                // transactions, so a goal always starts empty.
                currentAmount: 0,
                category,
                deadline: deadline ? new Date(deadline) : undefined,
                status: "active",
                imageUrl,
            });

            await goal.save();
            res.status(201).json(goal);
        } catch (error) {
            console.error("Error creating goal:", error);
            res.status(500).json({ message: "Lỗi tạo mục tiêu" });
        }
    },
];

export const getGoals = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const { category, status } = req.query;

        let filter: any = { userId };
        if (category) {
            filter.category = category;
        }
        if (status) {
            filter.status = status;
        }

        const goals = await Goal.find(filter).sort({ createdAt: -1 });

        // Disable caching for API responses
        res.set({
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
        });

        res.json(goals);
    } catch (error) {
        console.error("Error fetching goals:", error);
        res.status(500).json({ message: "Lỗi lấy danh sách mục tiêu" });
    }
};

export const getGoalById = async (req: any, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user.uid;

        const goal = await Goal.findOne({ _id: id, userId });
        if (!goal) {
            return res.status(404).json({ message: "Không tìm thấy mục tiêu" });
        }

        // Disable caching for API responses
        res.set({
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
        });

        res.json(goal);
    } catch (error) {
        console.error("Error fetching goal:", error);
        res.status(500).json({ message: "Lỗi lấy mục tiêu" });
    }
};

export const updateGoal = [
    upload.single("image"), // Allow single image upload
    async (req: any, res: Response) => {
        try {
            const { id } = req.params;
            const {
                title,
                description,
                targetAmount,
                category,
                deadline,
                status,
            } = req.body;
            const userId = req.user.uid;

            const goal = await Goal.findOne({ _id: id, userId });
            if (!goal) {
                return res
                    .status(404)
                    .json({ message: "Không tìm thấy mục tiêu" });
            }

            // Handle image upload
            if (req.file) {
                const result = await new Promise<any>((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { folder: "goals" },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        },
                    );
                    stream.end(req.file.buffer);
                });
                goal.imageUrl = result.secure_url;
            }

            // Update fields
            if (title !== undefined) goal.title = title;
            if (description !== undefined) goal.description = description;
            if (targetAmount !== undefined)
                goal.targetAmount = parseFloat(targetAmount);
            // currentAmount is deliberately not editable here: it is the sum
            // of the goal's deposits and withdrawals, which move real money in
            // and out of a wallet. Editing it directly would let a goal claim
            // savings that never left the wallet.
            if (category !== undefined) goal.category = category;
            if (deadline !== undefined)
                goal.deadline = deadline ? new Date(deadline) : undefined;
            // Status is derived from progress and deadline below, so a client
            // supplied value is ignored on purpose.

            // Reaching the target wins over the deadline: a goal you funded in
            // time stays completed once its deadline rolls past, instead of
            // flipping to expired. The deadline itself is a whole day, so it
            // only expires after that day has ended.
            const deadlineEnd = goal.deadline
                ? new Date(new Date(goal.deadline).setHours(23, 59, 59, 999))
                : null;

            if (goal.currentAmount >= goal.targetAmount) {
                goal.status = "completed";
            } else if (deadlineEnd && new Date() > deadlineEnd) {
                goal.status = "expired";
            } else {
                goal.status = "active";
            }

            await goal.save();
            res.json(goal);
        } catch (error) {
            console.error("Error updating goal:", error);
            res.status(500).json({ message: "Lỗi cập nhật mục tiêu" });
        }
    },
];

/**
 * Ví nhận lại tiền khi xoá một mục tiêu đang có số dư: ưu tiên chính ví đã nạp
 * vào mục tiêu gần nhất, vì đó là nơi người dùng mong tiền quay về.
 */
const findWalletForGoalRefund = async (
    goalId: unknown,
    userId: string,
    session: ClientSession,
) => {
    const lastDeposit = await Transaction.findOne({
        userId,
        goalId,
        type: TransactionType.GOAL_DEPOSIT,
    })
        .sort({ date: -1, createdAt: -1 })
        .session(session);

    if (lastDeposit) {
        const depositWallet = await Wallet.findOne({
            _id: lastDeposit.walletId,
            userId,
        }).session(session);

        if (depositWallet) {
            return depositWallet;
        }
    }

    return Wallet.findOne({ userId, isArchived: { $ne: true } }).session(
        session,
    );
};

export const deleteGoal = async (req: any, res: Response) => {
    const session = await Goal.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const userId = req.user.uid;

        const goal = await Goal.findOne({ _id: id, userId }).session(session);
        if (!goal) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Không tìm thấy mục tiêu" });
        }

        const savedAmount = Math.max(Number(goal.currentAmount || 0), 0);
        let refundWallet: any = null;

        if (savedAmount > 0) {
            // The money sitting in a goal was really taken out of a wallet. The
            // old delete removed the goal and left that money in no wallet, no
            // goal and no total: it simply disappeared from the user's books.
            const requestedWalletId = String(
                req.body?.refundWalletId || "",
            ).trim();

            refundWallet = requestedWalletId
                ? await Wallet.findOne({
                      _id: requestedWalletId,
                      userId,
                  }).session(session)
                : await findWalletForGoalRefund(goal._id, userId, session);

            if (!refundWallet) {
                await session.abortTransaction();
                return res.status(400).json({
                    message:
                        "Hãy chọn ví để nhận lại số tiền đã tích luỹ trong mục tiêu này.",
                    requiresRefundWallet: true,
                    savedAmount,
                });
            }

            const refund = new Transaction({
                userId,
                walletId: refundWallet._id,
                type: TransactionType.GOAL_WITHDRAW,
                status: TransactionStatus.COMPLETED,
                amount: savedAmount,
                category: GOAL_REFUND_CATEGORY,
                date: new Date(),
                note: `Hoàn tiền khi xoá mục tiêu "${goal.title}"`,
                isSystemGenerated: true,
                isDeletable: true,
            });

            refundWallet.balance =
                Number(refundWallet.balance || 0) + savedAmount;
            refundWallet.hasTransactions = true;

            await refund.save({ session });
            await refundWallet.save({ session });
        }

        // Both writes share the session: unlinking without deleting, or the
        // reverse, would leave transactions pointing at a goal that is gone.
        await Transaction.updateMany(
            { goalId: goal._id, userId },
            { goalId: null },
        ).session(session);
        await Goal.deleteOne({ _id: goal._id, userId }).session(session);
        await touchTransactionCacheState(userId, req.user, session);
        await session.commitTransaction();

        return res.json({
            message:
                savedAmount > 0
                    ? `Đã xoá mục tiêu và hoàn ${savedAmount.toLocaleString(
                          "vi-VN",
                      )} ₫ về ví "${refundWallet.name}"`
                    : "Xóa mục tiêu thành công",
            data: {
                refundedAmount: savedAmount,
                refundWalletId: refundWallet ? refundWallet._id : null,
            },
        });
    } catch (error) {
        await session.abortTransaction();
        console.error("Error deleting goal:", error);
        return res.status(500).json({ message: "Lỗi xóa mục tiêu" });
    } finally {
        session.endSession();
    }
};

export const getGoalStats = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;

        const stats = await Goal.aggregate([
            { $match: { userId } },
            {
                $group: {
                    _id: null,
                    totalGoals: { $sum: 1 },
                    completedGoals: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
                        },
                    },
                    activeGoals: {
                        $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
                    },
                    totalTargetAmount: { $sum: "$targetAmount" },
                    totalCurrentAmount: { $sum: "$currentAmount" },
                },
            },
        ]);

        const result = stats[0] || {
            totalGoals: 0,
            completedGoals: 0,
            activeGoals: 0,
            totalTargetAmount: 0,
            totalCurrentAmount: 0,
        };

        // Disable caching for API responses
        res.set({
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
        });

        res.json(result);
    } catch (error) {
        console.error("Error getting goal stats:", error);
        res.status(500).json({ message: "Lỗi lấy thống kê mục tiêu" });
    }
};
