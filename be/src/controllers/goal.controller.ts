import { Request, Response } from "express";
import Goal from "../models/Goal";

export const createGoal = async (req: any, res: Response) => {
  try {
    const {
      title,
      description,
      targetAmount,
      currentAmount,
      category,
      deadline,
    } = req.body;
    const userId = req.user.uid;

    const goal = new Goal({
      userId,
      title,
      description,
      targetAmount: parseFloat(targetAmount),
      currentAmount: currentAmount ? parseFloat(currentAmount) : 0,
      category,
      deadline: deadline ? new Date(deadline) : undefined,
      status: "active",
    });

    await goal.save();
    res.status(201).json(goal);
  } catch (error) {
    console.error("Error creating goal:", error);
    res.status(500).json({ message: "Lỗi tạo mục tiêu" });
  }
};

export const getGoals = async (req: any, res: Response) => {
  try {
    const userId = req.user.uid;
    const { category, status } = req.query;

    let filter: any = { userId };
    if (category) {
      filter.category = category;
    }
    if (status) {
      filter.status = status;
    }

    const goals = await Goal.find(filter).sort({ createdAt: -1 });

    // Disable caching for API responses
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    res.json(goals);
  } catch (error) {
    console.error("Error fetching goals:", error);
    res.status(500).json({ message: "Lỗi lấy danh sách mục tiêu" });
  }
};

export const getGoalById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    const goal = await Goal.findOne({ _id: id, userId });
    if (!goal) {
      return res.status(404).json({ message: "Không tìm thấy mục tiêu" });
    }

    // Disable caching for API responses
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    res.json(goal);
  } catch (error) {
    console.error("Error fetching goal:", error);
    res.status(500).json({ message: "Lỗi lấy mục tiêu" });
  }
};

export const updateGoal = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      targetAmount,
      currentAmount,
      category,
      deadline,
      status,
    } = req.body;
    const userId = req.user.uid;

    const goal = await Goal.findOne({ _id: id, userId });
    if (!goal) {
      return res.status(404).json({ message: "Không tìm thấy mục tiêu" });
    }

    // Update fields
    if (title !== undefined) goal.title = title;
    if (description !== undefined) goal.description = description;
    if (targetAmount !== undefined)
      goal.targetAmount = parseFloat(targetAmount);
    if (currentAmount !== undefined)
      goal.currentAmount = parseFloat(currentAmount);
    if (category !== undefined) goal.category = category;
    if (deadline !== undefined)
      goal.deadline = deadline ? new Date(deadline) : undefined;
    if (status !== undefined) goal.status = status;

    // Auto-update status based on progress
    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = "completed";
    } else if (goal.deadline && new Date() > goal.deadline) {
      goal.status = "expired";
    }

    await goal.save();
    res.json(goal);
  } catch (error) {
    console.error("Error updating goal:", error);
    res.status(500).json({ message: "Lỗi cập nhật mục tiêu" });
  }
};

export const deleteGoal = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    const goal = await Goal.findOneAndDelete({ _id: id, userId });
    if (!goal) {
      return res.status(404).json({ message: "Không tìm thấy mục tiêu" });
    }

    res.json({ message: "Xóa mục tiêu thành công" });
  } catch (error) {
    console.error("Error deleting goal:", error);
    res.status(500).json({ message: "Lỗi xóa mục tiêu" });
  }
};

export const getGoalStats = async (req: any, res: Response) => {
  try {
    const userId = req.user.uid;

    const stats = await Goal.aggregate([
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
          totalTargetAmount: { $sum: "$targetAmount" },
          totalCurrentAmount: { $sum: "$currentAmount" },
        },
      },
    ]);

    const result = stats[0] || {
      totalGoals: 0,
      completedGoals: 0,
      activeGoals: 0,
      totalTargetAmount: 0,
      totalCurrentAmount: 0,
    };

    // Disable caching for API responses
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    res.json(result);
  } catch (error) {
    console.error("Error getting goal stats:", error);
    res.status(500).json({ message: "Lỗi lấy thống kê mục tiêu" });
  }
};
