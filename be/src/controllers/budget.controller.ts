import { Response } from "express";
import Budget, { IBudget } from "../models/Budget";
import Transaction, { TransactionType } from "../models/Transaction";

const toNumber = (v: any, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

export const createBudget = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const { category, amount, month, year, note } = req.body;

        const monthNum = toNumber(month, new Date().getMonth() + 1);
        const yearNum = toNumber(year, new Date().getFullYear());
        const amountNum = toNumber(amount, 0);

        if (!category || typeof category !== "string") {
            return res.status(400).json({ message: "Thiếu danh mục" });
        }
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
            return res
                .status(400)
                .json({ message: "Số tiền ngân sách không hợp lệ" });
        }
        if (monthNum < 1 || monthNum > 12) {
            return res.status(400).json({ message: "Tháng không hợp lệ" });
        }

        const exists = await Budget.findOne({
            userId,
            category,
            month: monthNum,
            year: yearNum,
        });
        if (exists) {
            return res.status(409).json({
                message: "Ngân sách cho danh mục này trong tháng đã tồn tại",
            });
        }

        const budget = await Budget.create({
            userId,
            category,
            amount: amountNum,
            month: monthNum,
            year: yearNum,
            note,
        });

        return res.status(201).json(budget);
    } catch (error) {
        console.error("Error creating budget:", error);
        return res.status(500).json({ message: "Lỗi tạo ngân sách" });
    }
};

export const getBudgets = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const { month, year, category } = req.query;

        const filter: any = { userId };
        if (month !== undefined)
            filter.month = toNumber(month, undefined as any);
        if (year !== undefined) filter.year = toNumber(year, undefined as any);
        if (category) filter.category = category;

        const budgets = await Budget.find(filter).sort({
            year: -1,
            month: -1,
            createdAt: -1,
        });

        res.set({
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
        });

        return res.json(budgets);
    } catch (error) {
        console.error("Error fetching budgets:", error);
        return res.status(500).json({ message: "Lỗi lấy danh sách ngân sách" });
    }
};

export const getBudgetById = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const { id } = req.params;

        const budget = await Budget.findOne({ _id: id, userId });
        if (!budget) {
            return res
                .status(404)
                .json({ message: "Không tìm thấy ngân sách" });
        }

        res.set({
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
        });

        return res.json(budget);
    } catch (error) {
        console.error("Error fetching budget:", error);
        return res.status(500).json({ message: "Lỗi lấy ngân sách" });
    }
};

export const updateBudget = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const { id } = req.params;
        const { category, amount, month, year, note } = req.body;

        const budget = await Budget.findOne({ _id: id, userId });
        if (!budget) {
            return res
                .status(404)
                .json({ message: "Không tìm thấy ngân sách" });
        }

        if (category !== undefined) budget.category = category;
        if (amount !== undefined)
            budget.amount = toNumber(amount, budget.amount);
        if (month !== undefined) budget.month = toNumber(month, budget.month);
        if (year !== undefined) budget.year = toNumber(year, budget.year);
        if (note !== undefined) budget.note = note;

        if (budget.month < 1 || budget.month > 12) {
            return res.status(400).json({ message: "Tháng không hợp lệ" });
        }
        if (!Number.isFinite(budget.amount) || budget.amount <= 0) {
            return res
                .status(400)
                .json({ message: "Số tiền ngân sách không hợp lệ" });
        }

        const conflict = await Budget.findOne({
            _id: { $ne: budget._id },
            userId,
            category: budget.category,
            month: budget.month,
            year: budget.year,
        });
        if (conflict) {
            return res.status(409).json({
                message: "Ngân sách cho danh mục này trong tháng đã tồn tại",
            });
        }

        await budget.save();
        return res.json(budget);
    } catch (error) {
        console.error("Error updating budget:", error);
        return res.status(500).json({ message: "Lỗi cập nhật ngân sách" });
    }
};

export const deleteBudget = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const { id } = req.params;

        const budget = await Budget.findOneAndDelete({ _id: id, userId });
        if (!budget) {
            return res
                .status(404)
                .json({ message: "Không tìm thấy ngân sách" });
        }

        return res.json({ message: "Xóa ngân sách thành công" });
    } catch (error) {
        console.error("Error deleting budget:", error);
        return res.status(500).json({ message: "Lỗi xóa ngân sách" });
    }
};

export const getBudgetSummary = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const month = toNumber(req.query.month, new Date().getMonth() + 1);
        const year = toNumber(req.query.year, new Date().getFullYear());

        const budgets = await Budget.find({ userId, month, year }).sort({
            createdAt: -1,
        });

        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);

        const spentByBudgetAgg = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    type: TransactionType.EXPENSE,
                    date: { $gte: start, $lte: end },
                    budgetId: { $exists: true, $ne: null },
                },
            },
            {
                $group: {
                    _id: "$budgetId",
                    spent: { $sum: "$amount" },
                },
            },
        ]);

        const spentByBudget: Record<string, number> = {};
        spentByBudgetAgg.forEach((x: any) => {
            spentByBudget[x._id.toString()] = x.spent;
        });

        const items = (budgets as IBudget[]).map((b: IBudget) => {
            const spent = spentByBudget[(b._id as any).toString()] || 0;
            const percent =
                b.amount > 0 ? Math.min((spent / b.amount) * 100, 999) : 0;
            return {
                _id: b._id,
                category: b.category,
                amount: b.amount,
                spent,
                percent,
                month: b.month,
                year: b.year,
                note: b.note,
                createdAt: b.createdAt,
                updatedAt: b.updatedAt,
            };
        });

        const totalBudget = items.reduce(
            (s: number, i: { amount: number }) => s + (i.amount || 0),
            0,
        );
        const totalSpent = items.reduce(
            (s: number, i: { spent: number }) => s + (i.spent || 0),
            0,
        );

        res.set({
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
        });

        return res.json({
            month,
            year,
            totalBudget,
            totalSpent,
            items,
        });
    } catch (error) {
        console.error("Error getting budget summary:", error);
        return res.status(500).json({ message: "Lỗi lấy tổng quan ngân sách" });
    }
};
