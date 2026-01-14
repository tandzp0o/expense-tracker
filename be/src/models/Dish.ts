import mongoose, { Document, Schema } from "mongoose";

export interface IDish extends Document {
  userId: string;
  name: string;
  price?: number | null;
  description?: string;
  imageUrls: string[]; // Changed from imageUrl to imageUrls array
  preferences: string[]; // e.g., ["ngọt", "chua"]
  address?: string;
  createdAt: Date;
}

const DishSchema = new Schema<IDish>({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: false },
  description: String,
  imageUrls: [{ type: String }], // Changed to array
  preferences: [{ type: String }],
  address: String,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IDish>("Dish", DishSchema);
