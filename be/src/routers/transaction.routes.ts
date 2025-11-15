import express from 'express';
import { verifyFirebaseToken } from '../middleware/auth';
import { 
  createTransaction, 
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getTransactionsByWallet
} from '../controllers/transaction.controller';

const router = express.Router();

/**
 * @route   GET /api/transactions
 * @desc    Lấy danh sách tất cả giao dịch của người dùng
 * @access  Private
 */
router.get('/', verifyFirebaseToken, getTransactions);

/**
 * @route   GET /api/transactions/wallet/:walletId
 * @desc    Lấy danh sách giao dịch theo ví
 * @access  Private
 */
router.get('/wallet/:walletId', verifyFirebaseToken, getTransactionsByWallet);

/**
 * @route   POST /api/transactions
 * @desc    Tạo mới một giao dịch
 * @access  Private
 */
router.post('/', verifyFirebaseToken, createTransaction);

/**
 * @route   GET /api/transactions/:id
 * @desc    Lấy thông tin chi tiết một giao dịch
 * @access  Private
 */
router.get('/:id', verifyFirebaseToken, getTransactionById);

/**
 * @route   PUT /api/transactions/:id
 * @desc    Cập nhật thông tin giao dịch
 * @access  Private
 */
router.put('/:id', verifyFirebaseToken, updateTransaction);

/**
 * @route   DELETE /api/transactions/:id
 * @desc    Xóa một giao dịch
 * @access  Private
 */
router.delete('/:id', verifyFirebaseToken, deleteTransaction);

export default router;