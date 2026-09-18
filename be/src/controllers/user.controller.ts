import { Request, Response } from "express";
import User from "../models/User";
import Goal from "../models/Goal";
import Wallet from "../models/Wallet";
import Transaction, { TransactionStatus } from "../models/Transaction";
import Budget from "../models/Budget";
import { v2 as cloudinary } from "cloudinary";
import { syncUserIdentity } from "../utils/user-identity";
import { TRANSFER_CATEGORY } from "../utils/transaction-rules";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const getProfile = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;

        const existingUser = await User.findOne({ uid: userId });
        const user =
            existingUser ||
            (await syncUserIdentity({
                uid: userId,
                email: req.user.email,
                displayName: req.user.name,
                picture: req.user.picture,
                signInProvider: req.user.signInProvider,
            }));

        // Get real statistics
        const goalsStats = await Goal.aggregate([
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
                },
            },
        ]);

        const goalsData = goalsStats[0] || {
            totalGoals: 0,
            completedGoals: 0,
            activeGoals: 0,
        };

        // Get wallet balance
        const wallets = await Wallet.find({ userId, isArchived: { $ne: true } });
        const totalBalance = wallets.reduce(
            (sum, wallet) => sum + wallet.balance,
            0,
        );

        // Get transaction statistics
        const transactions = await Transaction.find({ userId });
        const isCompletedLedgerTransaction = (transaction: any) =>
            (!transaction.status ||
                transaction.status === TransactionStatus.COMPLETED) &&
            transaction.category !== TRANSFER_CATEGORY;

        const totalIncome = transactions
            .filter(
                (t) =>
                    t.type === "INCOME" &&
                    isCompletedLedgerTransaction(t),
            )
            .reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = transactions
            .filter(
                (t) =>
                    t.type === "EXPENSE" &&
                    isCompletedLedgerTransaction(t),
            )
            .reduce((sum, t) => sum + t.amount, 0);

        const profile = {
            ...user.toObject(),
            totalBalance,
            totalIncome,
            totalExpense,
            goalsCompleted: goalsData.completedGoals,
            goalsActive: goalsData.activeGoals,
        };

        // Disable caching for API responses
        res.set({
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
        });

        res.json(profile);
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({ message: "Lỗi lấy thông tin hồ sơ" });
    }
};

export const updateProfile = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const { displayName, phone, bio, avatar, address } = req.body;

        const user = await User.findOne({ uid: userId });
        if (!user) {
            return res
                .status(404)
                .json({ message: "Không tìm thấy người dùng" });
        }

        // Update fields
        if (displayName !== undefined) user.displayName = displayName;
        if (phone !== undefined) user.phone = phone;
        if (bio !== undefined) user.bio = bio;
        if (avatar !== undefined) user.avatar = avatar;
        if (address !== undefined) user.address = address;

        await user.save();
        res.json(user);
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Lỗi cập nhật hồ sơ" });
    }
};

export const uploadAvatar = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;

        // req.file sẽ được cung cấp bởi middleware (ví dụ: multer)
        if (!req.file) {
            return res
                .status(400)
                .json({ message: "Vui lòng chọn ảnh để tải lên" });
        }

        const user = await User.findOne({ uid: userId });
        if (!user) {
            return res
                .status(404)
                .json({ message: "Không tìm thấy người dùng" });
        }

        // Giả sử file được lưu trong thư mục uploads và có thể truy cập qua URL
        const result = await new Promise<any>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: "avatars" },
                (error, uploadResult) => {
                    if (error) reject(error);
                    else resolve(uploadResult);
                },
            );
            stream.end(req.file.buffer);
        });

        const avatarUrl = result.secure_url;

        user.avatar = avatarUrl;
        await user.save();

        res.json({
            message: "Cập nhật ảnh đại diện thành công",
            avatarUrl: user.avatar,
        });
    } catch (error) {
        console.error("Error uploading avatar:", error);
        res.status(500).json({ message: "Lỗi tải lên ảnh đại diện" });
    }
};

export const getProfileStats = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const completedStatusQuery = {
            $or: [
                { status: TransactionStatus.COMPLETED },
                { status: { $exists: false } },
            ],
        };

        // The six calendar months shown in the chart, oldest first, as
        // [start, next month's start) in the server's local time, the same
        // boundaries the month-by-month queries this replaces used.
        const now = new Date();
        const monthStarts = Array.from(
            { length: 7 },
            (_, index) =>
                new Date(now.getFullYear(), now.getMonth() - 5 + index, 1),
        );

        // One round trip instead of twelve. The database sits in another
        // region from the API, so every sequential query here used to cost a
        // trans-Pacific hop; running them together and summing inside MongoDB
        // (rather than loading eight months of documents to add them up in
        // JavaScript) is what makes the overview load in about a second.
        const [
            wallets,
            totalTransactions,
            totalBudgets,
            monthlyTotals,
            goalsStats,
        ] = await Promise.all([
            Wallet.find({ userId, isArchived: { $ne: true } })
                .select("balance")
                .lean(),
            Transaction.countDocuments({ userId }),
            Budget.countDocuments({ userId }),
            Transaction.aggregate([
                {
                    $match: {
                        userId,
                        ...completedStatusQuery,
                        type: { $in: ["INCOME", "EXPENSE"] },
                        category: { $ne: TRANSFER_CATEGORY },
                        date: {
                            $gte: monthStarts[0],
                            $lt: monthStarts[6],
                        },
                    },
                },
                {
                    $bucket: {
                        groupBy: "$date",
                        boundaries: monthStarts,
                        output: {
                            income: {
                                $sum: {
                                    $cond: [
                                        { $eq: ["$type", "INCOME"] },
                                        "$amount",
                                        0,
                                    ],
                                },
                            },
                            expense: {
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
                },
            ]),
            Goal.aggregate([
                { $match: { userId } },
                {
                    $group: {
                        _id: null,
                        totalGoals: { $sum: 1 },
                        completedGoals: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$status", "completed"] },
                                    1,
                                    0,
                                ],
                            },
                        },
                        activeGoals: {
                            $sum: {
                                $cond: [{ $eq: ["$status", "active"] }, 1, 0],
                            },
                        },
                    },
                },
            ]),
        ]);

        const totalWallets = wallets.length;
        const totalBalance = wallets.reduce(
            (sum, wallet) => sum + Number(wallet.balance || 0),
            0,
        );

        // $bucket only returns months that had something; the chart needs all
        // six, so empty months are filled with zeros.
        const history = monthStarts.slice(0, 6).map((start) => {
            const bucket = monthlyTotals.find(
                (row: any) => new Date(row._id).getTime() === start.getTime(),
            );
            const income = Number(bucket?.income || 0);
            const expense = Number(bucket?.expense || 0);

            return {
                month: `Th${start.getMonth() + 1}`,
                balance: income - expense,
                income,
                expense,
            };
        });

        const currentMonth = history[5];
        const lastMonth = history[4];
        const monthlyIncome = currentMonth.income;
        const monthlyExpense = currentMonth.expense;
        const lastMonthIncome = lastMonth.income;
        const lastMonthExpense = lastMonth.expense;

        const incomeGrowth =
            lastMonthIncome !== 0
                ? ((monthlyIncome - lastMonthIncome) / lastMonthIncome) * 100
                : monthlyIncome > 0
                  ? 100
                  : 0;
        const expenseGrowth =
            lastMonthExpense !== 0
                ? ((monthlyExpense - lastMonthExpense) / lastMonthExpense) * 100
                : monthlyExpense > 0
                  ? 100
                  : 0;

        // Asset growth: how much the total balance increased this month
        // compared to the total before it.
        const currentMonthBalance = monthlyIncome - monthlyExpense;
        const previousTotalBalance = totalBalance - currentMonthBalance;
        const growth =
            previousTotalBalance > 0
                ? (currentMonthBalance / previousTotalBalance) * 100
                : totalBalance > 0
                  ? 100
                  : 0;

        const goalsData = goalsStats[0] || {
            totalGoals: 0,
            completedGoals: 0,
            activeGoals: 0,
        };

        const stats = {
            totalBalance,
            monthlyIncome,
            monthlyExpense,
            growth: parseFloat(growth.toFixed(1)),
            incomeGrowth: parseFloat(incomeGrowth.toFixed(1)),
            expenseGrowth: parseFloat(expenseGrowth.toFixed(1)),
            history,
            totalGoals: goalsData.totalGoals,
            completedGoals: goalsData.completedGoals,
            activeGoals: goalsData.activeGoals,
            totalTransactions,
            totalWallets,
            totalBudgets,
        };

        // Disable caching for API responses
        res.set({
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
        });

        res.json(stats);
    } catch (error) {
        console.error("Error fetching profile stats:", error);
        res.status(500).json({ message: "Lỗi lấy thống kê hồ sơ" });
    }
};
