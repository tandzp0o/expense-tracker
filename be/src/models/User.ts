import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  uid: string;
  email: string;
  displayName?: string;
  phone?: string;
  bio?: string;
  avatar?: string;
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  goalsCompleted: number;
  goalsActive: number;
  createdAt: Date;
  updatedAt: Date;
  newUser: boolean;
}

const UserSchema = new Schema<IUser>({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  displayName: String,
  phone: String,
  bio: String,
  avatar: String,
  totalBalance: { type: Number, default: 0 },
  totalIncome: { type: Number, default: 0 },
  totalExpense: { type: Number, default: 0 },
  goalsCompleted: { type: Number, default: 0 },
  goalsActive: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  newUser: { type: Boolean, default: true },
});

// Update the updatedAt field before saving
UserSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IUser>("User", UserSchema);
