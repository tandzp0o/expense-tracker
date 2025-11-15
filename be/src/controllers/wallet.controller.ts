import { Request, Response } from 'express';
import Wallet, { IWallet } from '../models/Wallet';
import Transaction, { TransactionType } from '../models/Transaction';

export const createWallet = async (req: any, res: Response) => {
  try {
    const { name, accountNumber, description, initialBalance = 0 } = req.body;
    const userId = req.user.uid;

    const wallet = new Wallet({
      userId,
      name,
      accountNumber,
      description,
      balance: initialBalance,
      initialBalance
    });

    await wallet.save();
    res.status(201).json(wallet);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định';
    res.status(500).json({ message: 'Lỗi khi tạo ví', error: errorMessage });
  }
};

export const getWallets = async (req: any, res: Response) => {
  try {
    const wallets = await Wallet.find({ userId: req.user.uid });
    const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
    
    res.json({
      wallets,
      totalBalance
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định';
    res.status(500).json({ message: 'Lỗi khi lấy danh sách ví', error: errorMessage });
  }
};

export const getWalletById = async (req: any, res: Response) => {
  try {
    const wallet = await Wallet.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!wallet) {
      return res.status(404).json({ message: 'Không tìm thấy ví' });
    }
    res.json(wallet);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định';
    res.status(500).json({ message: 'Lỗi khi lấy thông tin ví', error: errorMessage });
  }
};

/**
 * Cập nhật thông tin ví
 */
export const updateWallet = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { name, accountNumber, description, initialBalance } = req.body;

    const wallet = await Wallet.findOneAndUpdate(
      { _id: id, userId: req.user.uid },
      { name, accountNumber, description, initialBalance, balance: initialBalance },
      { new: true, runValidators: true }
    );

    if (!wallet) {
      return res.status(404).json({ message: 'Không tìm thấy ví để cập nhật' });
    }

    res.json({
      success: true,
      data: wallet,
      message: 'Cập nhật ví thành công'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định';
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi cập nhật ví', 
      error: errorMessage 
    });
  }
};

/**
 * Xóa một ví
 */
export const deleteWallet = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    
    // Kiểm tra xem ví có tồn tại và thuộc về người dùng không
    const wallet = await Wallet.findOneAndDelete({ 
      _id: id, 
      userId: req.user.uid 
    });

    if (!wallet) {
      return res.status(404).json({ 
        success: false,
        message: 'Không tìm thấy ví để xóa' 
      });
    }

    res.json({
      success: true,
      message: 'Xóa ví thành công',
      data: { id: wallet._id }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định';
    res.status(500).json({ 
      success: false,
      message: 'Lỗi khi xóa ví', 
      error: errorMessage 
    });
  }
};