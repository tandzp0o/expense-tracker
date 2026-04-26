import { Response } from "express";
import { Types } from "mongoose";
import Budget, { IBudget } from "../models/Budget";
import Transaction, {
    TransactionStatus,
    TransactionType,
} from "../models/Transaction";
import Wallet from "../models/Wallet";

const toNumber = (value: any, fallback: number) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
};

const normalizeCategory = (value: unknown) => String(value || "").trim();

const buildCompletedStatusQuery = () => ({
    $or: [
        { status: TransactionStatus.COMPLETED },
        { status: { $exists: false } },
    ],
});

type BudgetSummaryItem = {
    _id: unknown;
    walletId: unknown;
    walletName: string;
    walletCurrency: string;
    category: string;
    amount: number;
    spent: number;
    remaining: number;
    overspent: number;
    percent: number;
    note?: string;
    color?: string;
    month: number;
    year: number;
    createdAt: Date;
    updatedAt: Date;
};

type WalletBudgetSummary = {
    walletId: string;
    walletName: string;
    walletCurrency: string;
    totalBudget: number;
    totalSpent: number;
    totalRemaining: number;
    overspent: number;
    items: BudgetSummaryItem[];
};

const loadWalletForBudget = async (walletId: string, userId: string) => {
    const wallet = await Wallet.findOne({ _id: walletId, userId });
    if (!wallet) {
        return null;
    }

    return wallet;
};

const buildBudgetFilter = ({
    userId,
    month,
    year,
    category,
    walletId,
}: {
    userId: string;
    month?: unknown;
    year?: unknown;
    category?: unknown;
    walletId?: unknown;
}) => {
    const filter: any = { userId };

    if (month !== undefined) {
        filter.month = toNumber(month, undefined as any);
    }

    if (year !== undefined) {
        filter.year = toNumber(year, undefined as any);
    }

    const normalizedCategory = normalizeCategory(category);
    if (normalizedCategory) {
        filter.category = normalizedCategory;
    }

    if (walletId) {
        filter.walletId = walletId;
    }

    return filter;
};

const buildBudgetSummaryPayload = async ({
    userId,
    month,
    year,
    walletId,
}: {
    userId: string;
    month: number;
    year: number;
    walletId?: string;
}) => {
    const budgets = await Budget.find(
        buildBudgetFilter({ userId, month, year, walletId }),
    )
        .populate("walletId", "name currency color")
        .sort({ createdAt: -1 });

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const spentByBudgetAgg = await Transaction.aggregate([
        {
            $match: {
                userId,
                type: TransactionType.EXPENSE,
                ...buildCompletedStatusQuery(),
                date: { $gte: start, $lte: end },
                budgetId: { $exists: true, $ne: null },
                ...(walletId
                    ? { walletId: new Types.ObjectId(String(walletId)) }
                    : {}),
            },
        },
        {
            $group: {
                _id: "$budgetId",
                spent: { $sum: "$amount" },
            },
        },
    ]);

    const spentByBudget = new Map<string, number>();
    spentByBudgetAgg.forEach((entry: any) => {
        spentByBudget.set(String(entry._id), Number(entry.spent || 0));
    });

    const items: BudgetSummaryItem[] = (budgets as IBudget[]).map(
        (budget: IBudget) => {
        const spent = spentByBudget.get(String(budget._id)) || 0;
        const remaining = Math.max(Number(budget.amount) - spent, 0);
        const overspent = Math.max(spent - Number(budget.amount), 0);
        const percent =
            budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 999) : 0;
        const walletData =
            typeof budget.walletId === "object" && budget.walletId !== null
                ? (budget.walletId as any)
                : null;

        return {
            _id: budget._id,
            walletId: walletData?._id || budget.walletId,
            walletName: walletData?.name || "",
            walletCurrency: walletData?.currency || "VND",
            category: budget.category,
            amount: budget.amount,
            spent,
            remaining,
            overspent,
            percent,
            note: budget.note,
            color: budget.color,
            month: budget.month,
            year: budget.year,
            createdAt: budget.createdAt,
            updatedAt: budget.updatedAt,
        };
    },
    );

    const totalBudget = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalSpent = items.reduce((sum, item) => sum + (item.spent || 0), 0);
    const totalRemaining = items.reduce(
        (sum, item) => sum + (item.remaining || 0),
        0,
    );

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevBudgets = await Budget.find(
        buildBudgetFilter({
            userId,
            month: prevMonth,
            year: prevYear,
            walletId,
        }),
    );
    const prevTotalBudget = prevBudgets.reduce(
        (sum, budget) => sum + Number(budget.amount || 0),
        0,
    );
    const growth =
        prevTotalBudget > 0
            ? parseFloat(
                  (((totalBudget - prevTotalBudget) / prevTotalBudget) * 100).toFixed(
                      1,
                  ),
              )
            : 0;

    const walletSummariesMap = new Map<string, WalletBudgetSummary>();

    items.forEach((item) => {
        const walletKey = String(item.walletId || "");
        const existing =
            walletSummariesMap.get(walletKey) ||
            {
                walletId: walletKey,
                walletName: item.walletName,
                walletCurrency: item.walletCurrency,
                totalBudget: 0,
                totalSpent: 0,
                totalRemaining: 0,
                overspent: 0,
                items: [],
            };

        existing.totalBudget += Number(item.amount || 0);
        existing.totalSpent += Number(item.spent || 0);
        existing.totalRemaining += Number(item.remaining || 0);
        existing.overspent += Number(item.overspent || 0);
        existing.items.push(item);
        walletSummariesMap.set(walletKey, existing);
    });

    return {
        month,
        year,
        totalBudget,
        totalSpent,
        totalRemaining,
        growth,
        items,
        walletSummaries: Array.from(walletSummariesMap.values()).sort((left, right) =>
            left.walletName.localeCompare(right.walletName),
        ),
    };
};

export const createBudget = async (req: any, res: Response) => {
    try {
        const userId = req.user.uid;
        const { walletId, category, amount, month, year, note, color } = req.body;

        const normalizedCategory = normalizeCategory(category);
        const monthNum = toNumber(month, new Date().getMonth() + 1);
        const yearNum = toNumber(year, new Date().getFullYear());
        const amountNum = toNumber(amount, 0);

        if (!walletId) {
            return res.status(400).json({ message: "Thiếu ví áp dụng ngân sách" });
        }
        if (!normalizedCategory) {
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

        const wallet = await loadWalletForBudget(String(walletId), userId);
        if (!wallet) {
            return res.status(404).json({ message: "Không tìm thấy ví áp dụng ngân sách" });
        }

        const exists = await Budget.findOne({
            userId,
            walletId: wallet._id,
            category: normalizedCategory,
            month: monthNum,
            year: yearNum,
        });
        if (exists) {
            return res.status(409).json({
                message:
                    "Ngân sách cho danh mục này trong ví và tháng đã tồn tại",
            });
        }

        const budget = await Budget.create({
            userId,
            walletId: wallet._id,
            category: normalizedCategory,
            amount: amountNum,
            month: monthNum,
            year: yearNum,
            note,
            color,
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
        const { month, year, category, walletId } = req.query;

        const budgets = await Budget.find(
            buildBudgetFilter({ userId, month, year, category, walletId }),
        )
            .populate("walletId", "name currency color")
            .sort({
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

        const budget = await Budget.findOne({ _id: id, userId }).populate(
            "walletId",
            "name currency color",
        );
        if (!budget) {
            return res.status(404).json({ message: "Không tìm thấy ngân sách" });
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
        const { walletId, category, amount, month, year, note, color } = req.body;

        const budget = await Budget.findOne({ _id: id, userId });
        if (!budget) {
            return res.status(404).json({ message: "Không tìm thấy ngân sách" });
        }

        const nextWalletId =
            walletId !== undefined ? String(walletId) : String(budget.walletId);
        const nextCategory =
            category !== undefined ? normalizeCategory(category) : budget.category;
        const nextAmount =
            amount !== undefined ? toNumber(amount, budget.amount) : budget.amount;
        const nextMonth =
            month !== undefined ? toNumber(month, budget.month) : budget.month;
        const nextYear =
            year !== undefined ? toNumber(year, budget.year) : budget.year;

        if (!nextCategory) {
            return res.status(400).json({ message: "Thiếu danh mục" });
        }
        if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
            return res
                .status(400)
                .json({ message: "Số tiền ngân sách không hợp lệ" });
        }
        if (nextMonth < 1 || nextMonth > 12) {
            return res.status(400).json({ message: "Tháng không hợp lệ" });
        }

        const wallet = await loadWalletForBudget(nextWalletId, userId);
        if (!wallet) {
            return res.status(404).json({ message: "Không tìm thấy ví áp dụng ngân sách" });
        }

        const hasLinkedTransactions = await Transaction.countDocuments({
            userId,
            budgetId: budget._id,
        });

        if (
            hasLinkedTransactions > 0 &&
            String(budget.walletId) !== nextWalletId
        ) {
            return res.status(400).json({
                message:
                    "Không thể đổi ví của ngân sách đã có giao dịch liên kết.",
            });
        }

        const conflict = await Budget.findOne({
            _id: { $ne: budget._id },
            userId,
            walletId: nextWalletId,
            category: nextCategory,
            month: nextMonth,
            year: nextYear,
        });
        if (conflict) {
            return res.status(409).json({
                message:
                    "Ngân sách cho danh mục này trong ví và tháng đã tồn tại",
            });
        }

        budget.walletId = nextWalletId as any;
        budget.category = nextCategory;
        budget.amount = nextAmount;
        budget.month = nextMonth;
        budget.year = nextYear;
        if (note !== undefined) {
            budget.note = note;
        }
        if (color !== undefined) {
            budget.color = color;
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
            return res.status(404).json({ message: "Không tìm thấy ngân sách" });
        }

        await Transaction.updateMany(
            { budgetId: new Types.ObjectId(id as string), userId },
            { budgetId: null },
        );

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
        const walletId = req.query.walletId
            ? String(req.query.walletId)
            : undefined;

        const summary = await buildBudgetSummaryPayload({
            userId,
            month,
            year,
            walletId,
        });

        res.set({
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
        });

        return res.json(summary);
    } catch (error) {
        console.error("Error getting budget summary:", error);
        return res.status(500).json({ message: "Lỗi lấy tổng quan ngân sách" });
    }
};
