import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  uid: string;
  email: string;
  displayName?: string;
  phone?: string;
  bio?: string;
  avatar?: string;
  address?: string;
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

const UserSchema = new Schema<IUser>({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  displayName: String,
  phone: String,
  bio: String,
  avatar: String,
  address: String,
  totalBalance: { type: Number, default: 0 },
  totalIncome: { type: Number, default: 0 },
  totalExpense: { type: Number, default: 0 },
  goalsCompleted: { type: Number, default: 0 },
  goalsActive: { type: Number, default: 0 },
  newUser: { type: Boolean, default: true },
  transactionCacheVersion: { type: Number, default: 0 },
  transactionsUpdatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model<IUser>("User", UserSchema);
