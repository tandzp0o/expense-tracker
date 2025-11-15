import mongoose, { Schema, Document } from 'mongoose';

export interface IWallet extends Document {
  userId: string;
  name: string;
  accountNumber?: string;
  description?: string;
  balance: number;
  initialBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  accountNumber: { type: String },
  description: { type: String },
  balance: { type: Number, required: true, default: 0 },
  initialBalance: { type: Number, required: true, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model<IWallet>('Wallet', WalletSchema);