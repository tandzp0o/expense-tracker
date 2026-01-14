import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import connectDB from "./config/db";
import authRoutes from "./routers/auth.routes";
import walletRoutes from "./routers/wallet.routes";
import transactionRoutes from "./routers/transaction.routes";
import dishRoutes from "./routers/dish.routes";
import goalRoutes from "./routers/goal.routes";
import userRoutes from "./routers/user.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Cấu hình CORS động
app.set('trust proxy', 1);
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: function (origin, callback) {
      // Cho phép các request không có origin (như Postman hoặc thiết bị di động)
      // hoặc các origin nằm trong danh sách cho phép
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

// GIẢI QUYẾT LỖI POPUP GOOGLE: Thêm Header COOP
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

app.use(express.json());
app.use(morgan("dev"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/dishes", dishRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/users", userRoutes);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running" });
});

// Kết nối MongoDB và khởi động server
connectDB()
  .then(() => {
    // Quan trọng: Phải có '0.0.0.0' để Docker bên ngoài truy cập được vào trong
    app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`✅ Server đang chạy trên cổng ${PORT}`);
      console.log(`✅ Cho phép CORS từ: ${allowedOrigins.join(", ")}`);
    });
  })
  .catch((err) => {
    console.error("Không thể kết nối Database:", err);
    process.exit(1);
  });

export default app;
