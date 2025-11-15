import express from 'express';
import { verifyFirebaseToken } from '../middleware/auth';
import { 
  createWallet, 
  getWallets, 
  getWalletById, 
  updateWallet, 
  deleteWallet 
} from '../controllers/wallet.controller';

const router = express.Router();

/**
 * @route   GET /api/wallets
 * @desc    Lấy danh sách tất cả ví của người dùng
 * @access  Private
 */
router.get('/', verifyFirebaseToken, getWallets);

/**
 * @route   POST /api/wallets
 * @desc    Tạo mới một ví
 * @access  Private
 */
router.post('/', verifyFirebaseToken, createWallet);

/**
 * @route   GET /api/wallets/:id
 * @desc    Lấy thông tin chi tiết một ví
 * @access  Private
 */
router.get('/:id', verifyFirebaseToken, getWalletById);

/**
 * @route   PUT /api/wallets/:id
 * @desc    Cập nhật thông tin ví
 * @access  Private
 */
router.put('/:id', verifyFirebaseToken, updateWallet);

/**
 * @route   DELETE /api/wallets/:id
 * @desc    Xóa một ví
 * @access  Private
 */
router.delete('/:id', verifyFirebaseToken, deleteWallet);

export default router;