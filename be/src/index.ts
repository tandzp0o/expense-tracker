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
import budgetRoutes from "./routers/budget.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 1810;

// Cấu hình CORS động
app.set("trust proxy", 1);
const allowedOrigins = [
    "http://localhost:916",
    "http://localhost:3001",
    "http://localhost:3000",
    "https://ton-tracker.netlify.app",
    process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
    cors({
        origin: function (origin, callback) {
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
    }),
);

app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    next();
});

app.use(express.json());
app.use(morgan("dev"));
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/dishes", dishRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/users", userRoutes);
app.use("/api/budgets", budgetRoutes);

// Health check — Back4App sẽ hit endpoint này
app.get("/health", (req, res) => {
    res.status(200).json({ status: "OK", message: "Server is running" });
});

// ✅ QUAN TRỌNG: Server listen TRƯỚC, connect DB SAU
app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`✅ Server đang chạy trên cổng ${PORT}`);
    console.log(`✅ Cho phép CORS từ: ${allowedOrigins.join(", ")}`);

    // Connect DB sau khi server đã sẵn sàng nhận request
    connectDB()
        .then(() => {
            console.log("✅ MongoDB connected successfully");
        })
        .catch((err) => {
            // Log lỗi nhưng KHÔNG exit — server vẫn chạy
            console.error("❌ MongoDB connection failed:", err.message);
        });
});

// Tránh crash khi có lỗi không được xử lý
process.on("unhandledRejection", (reason) => {
    console.error("⚠️ Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
    console.error("⚠️ Uncaught Exception:", err.message);
});

export default app;
