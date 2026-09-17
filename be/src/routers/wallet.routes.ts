import express from 'express';
import { verifyFirebaseToken } from '../middleware/auth';
import {
  createWallet,
  getWallets,
  getWalletById,
  updateWallet,
  reconcileWallet,
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
 * @route   POST /api/wallets/:id/reconcile
 * @desc    Cân đối số dư ví về đúng số tiền thực tế, ghi lại phần chênh lệch
 * @access  Private
 */
router.post('/:id/reconcile', verifyFirebaseToken, reconcileWallet);

/**
 * @route   DELETE /api/wallets/:id
 * @desc    Xóa một ví
 * @access  Private
 */
router.delete('/:id', verifyFirebaseToken, deleteWallet);

export default router;