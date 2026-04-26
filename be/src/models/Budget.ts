import mongoose, { Schema, Document } from "mongoose";

export interface IBudget extends Document {
    userId: string;
    walletId: string;
    category: string;
    amount: number;
    month: number;
    year: number;
    note?: string;
    color?: string;
    createdAt: Date;
    updatedAt: Date;
}

const BudgetSchema: Schema = new Schema({
    userId: { type: String, required: true, index: true },
    walletId: { type: Schema.Types.ObjectId, ref: "Wallet", required: true, index: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    month: { type: Number, required: true, min: 1, max: 12, index: true },
    year: { type: Number, required: true, index: true },
    note: { type: String },
    color: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

BudgetSchema.index(
    { userId: 1, walletId: 1, category: 1, month: 1, year: 1 },
    { unique: true },
);

BudgetSchema.pre("save", function (next) {
    (this as any).updatedAt = new Date();
    next();
});

export default mongoose.model<IBudget>("Budget", BudgetSchema);
