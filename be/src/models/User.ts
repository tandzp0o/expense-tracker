import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
    uid: string;
    email: string;
    displayName?: string;
    createdAt: Date;
}

const UserSchema = new Schema<IUser>({
    uid: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    displayName: String,
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IUser>("User", UserSchema);
