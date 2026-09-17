import { Request, Response } from "express";
import Wallet, { IWallet } from "../models/Wallet";
import Transaction, {
    TransactionStatus,
    TransactionType,
} from "../models/Transaction";
import { BALANCE_ADJUSTMENT_CATEGORY } from "../constants/categories";
import User from "../models/User";
import Budget from "../models/Budget";
import { ensureUserConfig } from "./config.controller";
import { Types } from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { touchTransactionCacheState } from "../utils/transaction-cache";

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

export const createWallet = [
    upload.single("image"), // Allow single image upload
    async (req: any, res: Response) => {
        try {
            const {
                name,
                accountNumber,
                description,
                initialBalance = 0,
                balance,
                type = "cash",
                currency = "VND",
                icon,
                color,
            } = req.body;
            // Sử dụng balance nếu được cung cấp, ngược lại dùng initialBalance
            const finalInitialBalance =
                balance !== undefined
                    ? Number(balance)
                    : Number(initialBalance);
            const userId = req.user.uid;

            let imageUrl: string | undefined;
            if (req.file) {
                const result = await new Promise<any>((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { folder: "wallets" },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        },
                    );
                    stream.end(req.file.buffer);
                });
                imageUrl = result.secure_url;
            }

            const wallet = new Wallet({
                userId,
                name,
                accountNumber,
                description,
                balance: finalInitialBalance,
                initialBalance: finalInitialBalance,
                imageUrl,
                type,
                currency,
                icon,
                color,
            });

            await wallet.save();

            // Cập nhật trạng thái newUser của user sau khi tạo ví thành công
            await User.findOneAndUpdate(
                { uid: userId },
                { $set: { newUser: false } },
            );

            // Nhắc nhở chỉ có ý nghĩa khi đã có ví, nên mốc 20h mặc định được
            // bật ngay sau ví đầu tiên. Lỗi ở đây không được làm hỏng việc tạo ví.
            try {
                await ensureUserConfig(userId, {
                    withDefaultReminder: true,
                    timezone: req.body.timezone,
                });
            } catch (configError) {
                console.error(
                    "Could not seed the default reminder config:",
                    configError,
                );
            }

            res.status(201).json({
                ...wallet.toObject(),
                isNewUser: false, // Thêm trường này để frontend biết rằng user đã tạo ví
            });
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Đã xảy ra lỗi không xác định";
            res.status(500).json({
                message: "Lỗi khi tạo ví",
                error: errorMessage,
            });
        }
    },
];

export const getWallets = async (req: any, res: Response) => {
    try {
        // Archived wallets stay hidden by default but have to be reachable:
        // without any way to list them, archiving a wallet put it and its
        // balance permanently out of reach. They never count towards the total.
        const includeArchived =
            String(req.query?.includeArchived || "").toLowerCase() === "true";
        const wallets = await Wallet.find({
            userId: req.user.uid,
            ...(includeArchived ? {} : { isArchived: { $ne: true } }),
        });
        const totalBalance = wallets.reduce(
            (sum, wallet) => sum + (wallet.isArchived ? 0 : wallet.balance),
            0,
        );

        res.json({
            wallets,
            totalBalance,
        });
    } catch (error) {
        const errorMessage =
            error instanceof Error
                ? error.message
                : "Đã xảy ra lỗi không xác định";
        res.status(500).json({
            message: "Lỗi khi lấy danh sách ví",
            error: errorMessage,
        });
    }
};

export const getWalletById = async (req: any, res: Response) => {
    try {
        const wallet = await Wallet.findOne({
            _id: req.params.id,
            userId: req.user.uid,
        });
        if (!wallet) {
            return res.status(404).json({ message: "Không tìm thấy ví" });
        }
        res.json(wallet);
    } catch (error) {
        const errorMessage =
            error instanceof Error
                ? error.message
                : "Đã xảy ra lỗi không xác định";
        res.status(500).json({
            message: "Lỗi khi lấy thông tin ví",
            error: errorMessage,
        });
    }
};

/**
 * Cập nhật thông tin ví
 */
export const updateWallet = [
    upload.single("image"), // Allow single image upload
    async (req: any, res: Response) => {
        try {
            const { id } = req.params;
            const {
                name,
                accountNumber,
                description,
                initialBalance,
                balance,
                type,
                currency,
                icon,
                color,
                confirmTypeChange,
                isArchived,
            } = req.body;

            const wallet = await Wallet.findOne({
                _id: id,
                userId: req.user.uid,
            });
            if (!wallet) {
                return res
                    .status(404)
                    .json({ message: "Không tìm thấy ví để cập nhật" });
            }

            // RULE 1: Display fields - luôn cho phép
            if (name) wallet.name = name;
            if (accountNumber !== undefined)
                wallet.accountNumber = accountNumber;
            if (description !== undefined) wallet.description = description;
            if (icon !== undefined) wallet.icon = icon;
            if (color !== undefined) wallet.color = color;
            // Archiving used to be one-way: nothing in the codebase ever set this
            // back to false, so one misclick on delete hid a wallet for good.
            // The form is multipart, so the flag arrives as a string.
            if (isArchived !== undefined) {
                wallet.isArchived =
                    String(isArchived).toLowerCase() === "true";
            }

            // RULE 2: initialBalance
            // The form is multipart, so every field arrives as a string: "500000"
            // never strictly equals the stored 500000. Comparing them raw made any
            // edit to a wallet with transactions (even just a new image) look like
            // a balance change and get rejected.
            const hasInitialBalance =
                initialBalance !== undefined && initialBalance !== "";
            const nextInitialBalance = Number(initialBalance);
            if (hasInitialBalance && !Number.isFinite(nextInitialBalance)) {
                return res.status(400).json({
                    success: false,
                    message: "Số dư ban đầu không hợp lệ.",
                });
            }
            if (
                hasInitialBalance &&
                nextInitialBalance !== Number(wallet.initialBalance ?? 0)
            ) {
                if (wallet.hasTransactions) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Số dư ban đầu không thể chỉnh sửa khi đã có giao dịch.",
                        requiresAdjustment: true,
                        walletId: wallet._id,
                        currentBalance: wallet.balance,
                        targetBalance: nextInitialBalance,
                    });
                }
                const diff = nextInitialBalance - Number(wallet.initialBalance ?? 0);
                wallet.balance += diff;
                wallet.initialBalance = nextInitialBalance;
            }

            // RULE 3: type
            if (type !== undefined && type !== wallet.type) {
                if (wallet.hasTransactions && confirmTypeChange !== "true") {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Thay đổi loại ví sẽ ảnh hưởng đến phân loại báo cáo trong lịch sử. Bạn có chắc chắn muốn tiếp tục?",
                        requiresConfirmation: true,
                        field: "type",
                    });
                }
                wallet.type = type;
            }

            // RULE 4: currency
            if (currency !== undefined && currency !== wallet.currency) {
                if (wallet.hasTransactions) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Không thể đổi tiền tệ khi ví đã có giao dịch. Vui lòng tạo ví mới với tiền tệ mong muốn.",
                        field: "currency",
                    });
                }
                wallet.currency = currency;
            }

            // Balance update (không qua initialBalance logic)
            if (
                balance !== undefined &&
                Number(balance) !== Number(wallet.balance)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Current wallet balance cannot be edited directly. Create a transaction or adjustment instead.",
                    requiresAdjustment: true,
                    walletId: wallet._id,
                    currentBalance: wallet.balance,
                    targetBalance: Number(balance),
                });
            }

            // Upload only once every rule has passed. Uploading first left an
            // orphaned image on Cloudinary for each rejected request, and the
            // type-change confirmation round trip uploaded the same file twice.
            if (req.file) {
                const result = await new Promise<any>((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { folder: "wallets" },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        },
                    );
                    stream.end(req.file.buffer);
                });
                wallet.imageUrl = result.secure_url;
            }

            await wallet.save();
            if (wallet.hasTransactions) {
                await touchTransactionCacheState(req.user.uid, req.user);
            }

            if (!wallet) {
                return res
                    .status(404)
                    .json({ message: "Không tìm thấy ví để cập nhật" });
            }

            res.json({
                success: true,
                data: wallet,
                message: "Cập nhật ví thành công",
            });
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Đã xảy ra lỗi không xác định";
            res.status(500).json({
                success: false,
                message: "Lỗi khi cập nhật ví",
                error: errorMessage,
            });
        }
    },
];

/**
 * Đặt số dư ví về đúng số tiền người dùng đang thực có.
 *
 * Cash gets spent without being written down, so a wallet drifts away from
 * reality and nothing in the app could fix it: the balance was read-only and the
 * "create an adjustment transaction" the error message suggested did not exist.
 * The difference is recorded as an ordinary transaction rather than silently
 * overwriting the balance, so the history still explains every number.
 */
export const reconcileWallet = async (req: any, res: Response) => {
    const session = await Wallet.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const userId = req.user.uid;
        const wallet = await Wallet.findOne({ _id: id, userId }).session(
            session,
        );

        if (!wallet) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy ví để cân đối",
            });
        }

        const actualBalance = Number(req.body?.actualBalance);
        if (!Number.isFinite(actualBalance) || !Number.isSafeInteger(actualBalance)) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Số dư thực tế không hợp lệ",
            });
        }

        const difference = actualBalance - Number(wallet.balance || 0);
        if (difference === 0) {
            await session.abortTransaction();
            return res.json({
                success: true,
                data: { wallet, difference: 0 },
                message: "Số dư đã khớp, không cần điều chỉnh",
            });
        }

        const transaction = new Transaction({
            userId,
            walletId: wallet._id,
            type:
                difference > 0
                    ? TransactionType.INCOME
                    : TransactionType.EXPENSE,
            status: TransactionStatus.COMPLETED,
            amount: Math.abs(difference),
            category: BALANCE_ADJUSTMENT_CATEGORY,
            date: new Date(),
            note:
                String(req.body?.note || "").trim() ||
                "Cân đối lại số dư ví theo số tiền thực tế",
            isSystemGenerated: true,
            isDeletable: true,
        });

        wallet.balance = actualBalance;
        wallet.hasTransactions = true;

        await transaction.save({ session });
        await wallet.save({ session });
        await touchTransactionCacheState(userId, req.user, session);
        await session.commitTransaction();

        return res.json({
            success: true,
            data: { wallet, transaction, difference },
            message:
                difference > 0
                    ? "Đã ghi thêm một khoản thu để khớp với số dư thực tế"
                    : "Đã ghi thêm một khoản chi để khớp với số dư thực tế",
        });
    } catch (error) {
        await session.abortTransaction();
        const errorMessage =
            error instanceof Error
                ? error.message
                : "Đã xảy ra lỗi không xác định";
        return res.status(500).json({
            success: false,
            message: "Lỗi khi cân đối số dư ví",
            error: errorMessage,
        });
    } finally {
        session.endSession();
    }
};

/**
 * Xóa hoặc lưu trữ một ví (RULE 5)
 */
export const deleteWallet = async (req: any, res: Response) => {
    const session = await Wallet.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const userId = req.user.uid;

        const wallet = await Wallet.findOne({ _id: id, userId }).session(
            session,
        );

        if (!wallet) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy ví để xóa",
            });
        }

        // Counted now instead of trusting the cached hasTransactions flag. A
        // stale flag meant the wallet was hard-deleted while its transactions
        // survived: those rows could then never be deleted (every attempt
        // answered "wallet not found") yet still counted in every total.
        const transactionCount = await Transaction.countDocuments({
            userId,
            walletId: wallet._id,
        }).session(session);

        // RULE 5: giữ lịch sử thì chỉ lưu trữ, không xoá cứng.
        if (transactionCount > 0) {
            // Budgets keep pointing at the wallet here: it still exists and can
            // be restored, so dropping the pin would quietly widen those budgets
            // to every wallet and never give it back.
            wallet.isArchived = true;
            wallet.hasTransactions = true;
            await wallet.save({ session });
            await touchTransactionCacheState(userId, req.user, session);
            await session.commitTransaction();

            return res.json({
                success: true,
                message:
                    "Ví đã được lưu trữ vì còn giao dịch. Bạn có thể khôi phục lại bất cứ lúc nào.",
                data: { id: wallet._id, archived: true },
            });
        }

        // Only a wallet that is really going away releases its budgets, which
        // would otherwise point at something that no longer exists.
        const unlinkedBudgets = await Budget.updateMany(
            { userId, walletId: wallet._id },
            { walletId: null },
        ).session(session);

        await Wallet.deleteOne({ _id: wallet._id, userId }).session(session);
        await touchTransactionCacheState(userId, req.user, session);
        await session.commitTransaction();

        return res.json({
            success: true,
            message: "Xóa ví thành công",
            data: {
                id: wallet._id,
                unlinkedBudgets: unlinkedBudgets.modifiedCount || 0,
            },
        });
    } catch (error) {
        await session.abortTransaction();
        const errorMessage =
            error instanceof Error
                ? error.message
                : "Đã xảy ra lỗi không xác định";
        return res.status(500).json({
            success: false,
            message: "Lỗi khi xóa ví",
            error: errorMessage,
        });
    } finally {
        session.endSession();
    }
};
