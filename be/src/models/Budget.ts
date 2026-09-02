import mongoose, { Schema, Document } from "mongoose";

export interface IBudget extends Document {
    userId: string;
    /** Empty means the budget applies to every wallet. */
    walletId?: string | null;
    category: string;
    categoryType?: "standard" | "custom";
    customCategoryName?: string;
    subcategory?: string;
    icon?: string;
    tags?: string[];
    subBudgets?: Array<{
        name: string;
        amount: number;
        spent?: number;
        icon?: string;
        color?: string;
        tags?: string[];
    }>;
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
    /**
     * A budget is a monthly cap for a spending category; which wallet paid is a
     * separate concern. Leaving this empty means "any wallet", which is the
     * common case. It stays optional rather than being removed so anyone who
     * genuinely wants a per-wallet cap can still set one.
     */
    walletId: {
        type: Schema.Types.ObjectId,
        ref: "Wallet",
        required: false,
        default: null,
        index: true,
    },
    category: { type: String, required: true },
    categoryType: {
        type: String,
        enum: ["standard", "custom"],
        default: "standard",
    },
    customCategoryName: { type: String },
    subcategory: { type: String },
    icon: { type: String },
    tags: { type: [String], default: [] },
    subBudgets: {
        type: [
            {
                name: { type: String, required: true, trim: true },
                amount: { type: Number, required: true, min: 0 },
                spent: { type: Number, default: 0, min: 0 },
                icon: { type: String },
                color: { type: String },
                tags: { type: [String], default: [] },
            },
        ],
        default: [],
    },
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
