import mongoose, { Schema, Document } from "mongoose";

export enum TransactionType {
    INCOME = "INCOME",
    EXPENSE = "EXPENSE",
    GOAL_DEPOSIT = "GOAL_DEPOSIT",
    GOAL_WITHDRAW = "GOAL_WITHDRAW",
    ADJUSTMENT = "ADJUSTMENT",
}

export interface ITransaction extends Document {
    userId: string;
    walletId: string;
    budgetId?: string;
    goalId?: string;
    type: TransactionType;
    amount: number;
    category: string;
    date: Date;
    isSystemGenerated?: boolean;
    isDeletable?: boolean;
    note?: string;
    createdAt: Date;
}

const TransactionSchema: Schema = new Schema({
    userId: { type: String, required: true, index: true },
    walletId: { type: Schema.Types.ObjectId, ref: "Wallet", required: true },
    budgetId: { type: Schema.Types.ObjectId, ref: "Budget" },
    goalId: { type: Schema.Types.ObjectId, ref: "Goal" },
    type: {
        type: String,
        enum: Object.values(TransactionType),
        required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    isSystemGenerated: { type: Boolean, default: false },
    isDeletable: { type: Boolean, default: true },
    category: { type: String, required: true },
    date: { type: Date, required: true, default: Date.now },
    note: { type: String },
    createdAt: { type: Date, default: Date.now },
});

TransactionSchema.index({ userId: 1, date: -1, createdAt: -1 });
TransactionSchema.index({ userId: 1, walletId: 1, date: -1, createdAt: -1 });
TransactionSchema.index({ userId: 1, type: 1, date: -1, createdAt: -1 });
TransactionSchema.index({ userId: 1, category: 1, date: -1, createdAt: -1 });

export default mongoose.model<ITransaction>("Transaction", TransactionSchema);
