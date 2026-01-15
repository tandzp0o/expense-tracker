import { Request, Response } from "express";
import User from "../models/User";
import Goal from "../models/Goal";
import Wallet from "../models/Wallet";
import Transaction from "../models/Transaction";

export const getProfile = async (req: any, res: Response) => {
  try {
    const userId = req.user.uid;

    let user = await User.findOne({ uid: userId });
    if (!user) {
      // Create user if not exists
      user = new User({
        uid: userId,
        email: req.user.email,
        displayName: req.user.name || req.user.email?.split("@")[0],
      });
      await user.save();
    }

    // Get real statistics
    const goalsStats = await Goal.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalGoals: { $sum: 1 },
          completedGoals: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          activeGoals: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
        },
      },
    ]);

    const goalsData = goalsStats[0] || {
      totalGoals: 0,
      completedGoals: 0,
      activeGoals: 0,
    };

    // Get wallet balance
    const wallets = await Wallet.find({ userId });
    const totalBalance = wallets.reduce(
      (sum, wallet) => sum + wallet.balance,
      0
    );

    // Get transaction statistics
    const transactions = await Transaction.find({ userId });
    const totalIncome = transactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + t.amount, 0);

    const profile = {
      ...user.toObject(),
      totalBalance,
      totalIncome,
      totalExpense,
      goalsCompleted: goalsData.completedGoals,
      goalsActive: goalsData.activeGoals,
    };

    // Disable caching for API responses
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    res.json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Lỗi lấy thông tin hồ sơ" });
  }
};

export const updateProfile = async (req: any, res: Response) => {
  try {
    const userId = req.user.uid;
    const { displayName, phone, bio, avatar } = req.body;

    const user = await User.findOne({ uid: userId });
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    // Update fields
    if (displayName !== undefined) user.displayName = displayName;
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();
    res.json(user);
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Lỗi cập nhật hồ sơ" });
  }
};

export const uploadAvatar = async (req: any, res: Response) => {
  try {
    const userId = req.user.uid;

    // req.file sẽ được cung cấp bởi middleware (ví dụ: multer)
    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng chọn ảnh để tải lên" });
    }

    const user = await User.findOne({ uid: userId });
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    // Giả sử file được lưu trong thư mục uploads và có thể truy cập qua URL
    const avatarUrl = `/uploads/${req.file.filename}`;

    user.avatar = avatarUrl;
    await user.save();

    res.json({
      message: "Cập nhật ảnh đại diện thành công",
      avatarUrl: user.avatar,
    });
  } catch (error) {
    console.error("Error uploading avatar:", error);
    res.status(500).json({ message: "Lỗi tải lên ảnh đại diện" });
  }
};

export const getProfileStats = async (req: any, res: Response) => {
  try {
    const userId = req.user.uid;

    // Get wallet statistics
    const wallets = await Wallet.find({ userId });
    const totalBalance = wallets.reduce(
      (sum, wallet) => sum + wallet.balance,
      0
    );

    // Get transaction statistics for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthlyTransactions = await Transaction.find({
      userId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });

    const monthlyIncome = monthlyTransactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + t.amount, 0);
    const monthlyExpense = monthlyTransactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + t.amount, 0);

    // Get goal statistics
    const goalsStats = await Goal.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalGoals: { $sum: 1 },
          completedGoals: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          activeGoals: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
        },
      },
    ]);

    const goalsData = goalsStats[0] || {
      totalGoals: 0,
      completedGoals: 0,
      activeGoals: 0,
    };

    const stats = {
      totalBalance,
      monthlyIncome,
      monthlyExpense,
      totalGoals: goalsData.totalGoals,
      completedGoals: goalsData.completedGoals,
      activeGoals: goalsData.activeGoals,
    };

    // Disable caching for API responses
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    res.json(stats);
  } catch (error) {
    console.error("Error fetching profile stats:", error);
    res.status(500).json({ message: "Lỗi lấy thống kê hồ sơ" });
  }
};
