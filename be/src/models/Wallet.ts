import mongoose, { Schema, Document } from "mongoose";

export interface IWallet extends Document {
    userId: string;
    name: string;
    accountNumber?: string;
    description?: string;
    balance: number;
    initialBalance: number;
    imageUrl?: string; // Cloudinary URL for ATM card image
    type: "cash" | "bank" | "ewallet";
    currency: string;
    icon?: string;
    color?: string;
    isArchived: boolean;
    hasTransactions: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const WalletSchema: Schema = new Schema({
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ["cash", "bank", "ewallet"], default: "cash" },
    currency: { type: String, default: "VND" },
    icon: { type: String },
    color: { type: String },
    isArchived: { type: Boolean, default: false },
    hasTransactions: { type: Boolean, default: false },
    name: { type: String, required: true },
    accountNumber: { type: String },
    description: { type: String },
    balance: { type: Number, required: true, default: 0 },
    initialBalance: { type: Number, required: true, default: 0 },
    imageUrl: { type: String }, // Cloudinary URL for ATM card image
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model<IWallet>("Wallet", WalletSchema);
