import { Request, Response } from "express";
import Wallet, { IWallet } from "../models/Wallet";
import Transaction, { TransactionType } from "../models/Transaction";
import User from "../models/User";
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
        const wallets = await Wallet.find({
            userId: req.user.uid,
            isArchived: { $ne: true },
        });
        const totalBalance = wallets.reduce(
            (sum, wallet) => sum + wallet.balance,
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

            // Handle image upload
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

            // RULE 1: Display fields - luôn cho phép
            if (name) wallet.name = name;
            if (accountNumber !== undefined)
                wallet.accountNumber = accountNumber;
            if (description !== undefined) wallet.description = description;
            if (icon !== undefined) wallet.icon = icon;
            if (color !== undefined) wallet.color = color;

            // RULE 2: initialBalance
            if (
                initialBalance !== undefined &&
                initialBalance !== wallet.initialBalance
            ) {
                if (wallet.hasTransactions) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Số dư ban đầu không thể chỉnh sửa khi đã có giao dịch.",
                        requiresAdjustment: true,
                        walletId: wallet._id,
                        currentBalance: wallet.balance,
                        targetBalance: Number(initialBalance),
                    });
                }
                const diff = Number(initialBalance) - wallet.initialBalance;
                wallet.balance += diff;
                wallet.initialBalance = Number(initialBalance);
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
            if (balance !== undefined) {
                wallet.balance = Number(balance);
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
 * Xóa hoặc lưu trữ một ví (RULE 5)
 */
export const deleteWallet = async (req: any, res: Response) => {
    try {
        const { id } = req.params;

        // Kiểm tra xem ví có tồn tại và thuộc về người dùng không
        const wallet = await Wallet.findOne({
            _id: id,
            userId: req.user.uid,
        });

        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy ví để xóa",
            });
        }

        // RULE 5: Nếu có giao dịch, chỉ archive, không hard delete
        if (wallet.hasTransactions) {
            wallet.isArchived = true;
            await wallet.save();
            await touchTransactionCacheState(req.user.uid, req.user);
            return res.json({
                success: true,
                message: "Ví đã được lưu trữ (đã có giao dịch)",
                data: { id: wallet._id, archived: true },
            });
        }

        // Nếu không có giao dịch, hard delete
        await Wallet.findOneAndDelete({
            _id: id,
            userId: req.user.uid,
        });

        res.json({
            success: true,
            message: "Xóa ví thành công",
            data: { id: wallet._id },
        });
    } catch (error) {
        const errorMessage =
            error instanceof Error
                ? error.message
                : "Đã xảy ra lỗi không xác định";
        res.status(500).json({
            success: false,
            message: "Lỗi khi xóa ví",
            error: errorMessage,
        });
    }
};
