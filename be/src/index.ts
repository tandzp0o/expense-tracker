// import express from 'express';
// import cors from 'cors';
// import morgan from 'morgan';
// import dotenv from 'dotenv';
// import connectDB from './config/db';
// import authRoutes from './routers/auth.routes';
// import walletRoutes from './routers/wallet.routes';
// import transactionRoutes from './routers/transaction.routes';
// dotenv.config();

// const app = express();
// const PORT = process.env.PORT || 5000;

// //
// app.listen(PORT, '0.0.0.0', () => { ... });

// // Middleware
// // app.use(cors());
// // Thêm sau dòng import
// app.use(cors({
//   origin: 'http://localhost:3000',
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
//   credentials: true,
//   preflightContinue: false,
//   optionsSuccessStatus: 204
// }));

// // Xử lý preflight request
// // app.options('*', cors());
// app.use(express.json());
// app.use(morgan('dev'));

// // Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/wallets', walletRoutes);
// app.use('/api/transactions', transactionRoutes);

// // Health check
// app.get('/health', (req, res) => {
//   res.status(200).json({ status: 'OK' });
// });

// // Kết nối MongoDB và khởi động server
// connectDB().then(() => {
//   app.listen(PORT, () => {
//     console.log(`Server đang chạy trên cổng ${PORT}`);
//   });
// });

// export default app;




import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import connectDB from './config/db';
import authRoutes from './routers/auth.routes';
import walletRoutes from './routers/wallet.routes';
import transactionRoutes from './routers/transaction.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Cấu hình CORS động
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL // URL của FE sau khi deploy trên Railway/Vercel
];

app.use(cors({
  origin: function (origin, callback) {
    // Cho phép các request không có origin (như Postman hoặc thiết bị di động) 
    // hoặc các origin nằm trong danh sách cho phép
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 204
}));

app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/transactions', transactionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Kết nối MongoDB và khởi động server
connectDB().then(() => {
  // Quan trọng: Phải có '0.0.0.0' để Docker bên ngoài truy cập được vào trong
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
    console.log(`Cho phép CORS từ: ${allowedOrigins.filter(Boolean).join(', ')}`);
  });
}).catch(err => {
  console.error('Không thể kết nối Database:', err);
  process.exit(1);
});

export default app;