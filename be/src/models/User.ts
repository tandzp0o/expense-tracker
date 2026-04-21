import mongoose, { Document, Schema } from "mongoose";

export type UserAuthProvider = "google" | "password";

export interface IUser extends Document {
    uid: string;
    email: string;
    username: string;
    displayName?: string;
    phone?: string;
    bio?: string;
    avatar?: string;
    address?: string;
    hasPassword: boolean;
    authProviders: UserAuthProvider[];
    totalBalance: number;
    totalIncome: number;
    totalExpense: number;
    goalsCompleted: number;
    goalsActive: number;
    createdAt: Date;
    updatedAt: Date;
    newUser: boolean;
    transactionCacheVersion: number;
    transactionsUpdatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        uid: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true },
        username: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
            lowercase: true,
        },
        displayName: String,
        phone: String,
        bio: String,
        avatar: String,
        address: String,
        hasPassword: { type: Boolean, default: false },
        authProviders: {
            type: [String],
            enum: ["google", "password"],
            default: [],
        },
        totalBalance: { type: Number, default: 0 },
        totalIncome: { type: Number, default: 0 },
        totalExpense: { type: Number, default: 0 },
        goalsCompleted: { type: Number, default: 0 },
        goalsActive: { type: Number, default: 0 },
        newUser: { type: Boolean, default: true },
        transactionCacheVersion: { type: Number, default: 0 },
        transactionsUpdatedAt: { type: Date, default: Date.now },
    },
    { timestamps: true },
);

export default mongoose.model<IUser>("User", UserSchema);
