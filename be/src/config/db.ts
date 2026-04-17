import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        // ❌ Bỏ process.exit(1) — throw error để index.ts bắt
        throw new Error('MONGO_URI không được định nghĩa trong biến môi trường!');
    }

    const conn = await mongoose.connect(mongoUri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
};

export default connectDB;
