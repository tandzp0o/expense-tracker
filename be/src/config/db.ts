import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error('Lỗi: MONGO_URI không được định nghĩa trong biến môi trường!');
      process.exit(1);
    }
    
    const conn = await mongoose.connect(mongoUri);
    
    // Log ra host để biết mình đang kết nối đến Mongo nội bộ hay Mongo Atlas
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Lỗi kết nối MongoDB: ${(error as Error).message}`);
    // Trong môi trường production, đôi khi bạn muốn retry thay vì exit ngay lập tức
    process.exit(1);
  }
};

export default connectDB;