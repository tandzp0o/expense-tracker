import mongoose, { Document, Schema } from "mongoose";

export interface IGoal extends Document {
    userId: string;
    title: string;
    description?: string;
    targetAmount: number;
    currentAmount: number;
    category: string;
    deadline?: Date;
    status: "active" | "completed" | "expired";
    imageUrl?: string; // Cloudinary URL for goal illustration image
    createdAt: Date;
    updatedAt: Date;
}

const GoalSchema = new Schema<IGoal>({
    userId: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, default: 0 },
    category: { type: String, required: true },
    deadline: Date,
    status: {
        type: String,
        enum: ["active", "completed", "expired"],
        default: "active",
    },
    imageUrl: { type: String }, // Cloudinary URL for goal illustration image
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

// Update the updatedAt field before saving
GoalSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});

export default mongoose.model<IGoal>("Goal", GoalSchema);
