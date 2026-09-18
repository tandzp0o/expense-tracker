import { Response } from "express";
import { Types } from "mongoose";
import Budget, { IBudget } from "../models/Budget";
import Transaction, {
    TransactionStatus,
    TransactionType,
} from "../models/Transaction";
import Wallet from "../models/Wallet";
import { normalizeStandardCategory } from "../constants/categories";
import { DEFAULT_TIMEZONE_OFFSET_MINUTES } from "../utils/transaction-rules";

/**
 * First instant of a month on the user's calendar. Built from the app timezone
 * rather than the server's, so a container running in UTC does not start
 * September at 07:00 Vietnam time and misfile everything logged before then.
 */
const getMonthStart = (month: number, year: number) =>
    new Date(
        Date.UTC(year, month - 1, 1) +
            DEFAULT_TIMEZONE_OFFSET_MINUTES * 60 * 1000,
    );

const toNumber = (value: unknown, fallback: number) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
};

const normalizeStringArray = (value: unknown) => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => String(item || "").trim())
        .filter((item) => Boolean(item));
};

const parseSubBudgets = (value: unknown) => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((item) => {
            const row = item as Record<string, unknown>;
            const name = String(row?.name || "").trim();
            const amount = toNumber(row?.amount, 0);
            if (!name || !Number.isFinite(amount) || amount < 0) {
                return null;
            }

            return {
                name,
                amount,
                spent: Math.max(0, toNumber(row?.spent, 0)),
                icon: String(row?.icon || "").trim() || undefined,
                color: String(row?.color || "").trim() || undefined,
                tags: normalizeStringArray(row?.tags),
            };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
};

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
    categoryType?: "standard" | "custom";
    customCategoryName?: string;
    subcategory?: string;
    icon?: string;
    tags?: string[];
    subBudgets?: Array<{
        name: string;
        amount: number;
        spent?: number;
        icon?: string;
        color?: string;
        tags?: string[];
    }>;
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
    return wallet || null;
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

    if (category !== undefined && category !== null && category !== "") {
        const normalized = normalizeStandardCategory(category) || String(category).trim();
        if (normalized) {
            filter.category = normalized;
        }
    }

    if (walletId) {
        // A budget with no wallet applies everywhere, so filtering by wallet
        // must still return those; otherwise a cash payment could not be
        // charged to the "Food" budget created without a wallet.
        // `null` also matches documents where the field is absent.
        filter.$or = [{ walletId }, { walletId: null }];
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
    const start = getMonthStart(month, year);
    const end = getMonthStart(
        month === 12 ? 1 : month + 1,
        month === 12 ? year + 1 : year,
    );
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    // Spending is matched by category, not by an explicit budgetId link. Someone
    // who records "Ăn uống 85.000" expects it to count against their food budget
    // whether or not they remembered to attach that budget while entering it —
    // and the old link-only rule left most budgets sitting at 0% while the money
    // was quietly going out.
    // The three reads are independent, so they go out together: the database
    // is in another region from the API, and one after another they cost a
    // cross-region round trip each.
    const [budgets, spentAgg, prevBudgets] = await Promise.all([
        Budget.find(buildBudgetFilter({ userId, month, year, walletId }))
            .populate("walletId", "name currency color")
            .sort({ createdAt: -1 }),
        Transaction.aggregate([
            {
                $match: {
                    userId,
                    type: TransactionType.EXPENSE,
                    ...buildCompletedStatusQuery(),
                    date: { $gte: start, $lt: end },
                },
            },
            {
                $group: {
                    _id: { category: "$category", walletId: "$walletId" },
                    spent: { $sum: "$amount" },
                },
            },
        ]),
        Budget.find(
            buildBudgetFilter({
                userId,
                month: prevMonth,
                year: prevYear,
                walletId,
            }),
        )
            .select("amount")
            .lean(),
    ]);

    const spentByCategoryAndWallet = new Map<string, number>();
    const spentByCategory = new Map<string, number>();
    spentAgg.forEach((entry: any) => {
        const category = String(entry._id?.category || "");
        const entryWalletId = String(entry._id?.walletId || "");
        const amount = Number(entry.spent || 0);

        const scopedKey = `${category}::${entryWalletId}`;
        spentByCategoryAndWallet.set(
            scopedKey,
            (spentByCategoryAndWallet.get(scopedKey) || 0) + amount,
        );
        spentByCategory.set(
            category,
            (spentByCategory.get(category) || 0) + amount,
        );
    });

    const items: BudgetSummaryItem[] = (budgets as IBudget[]).map(
        (budget: IBudget) => {
            const walletScope =
                typeof budget.walletId === "object" && budget.walletId !== null
                    ? String((budget.walletId as any)._id)
                    : budget.walletId
                      ? String(budget.walletId)
                      : "";
            // A budget pinned to one wallet only counts what that wallet paid;
            // an any-wallet budget counts the category wherever it was paid from.
            const spent = walletScope
                ? spentByCategoryAndWallet.get(
                      `${budget.category}::${walletScope}`,
                  ) || 0
                : spentByCategory.get(String(budget.category)) || 0;
            const remaining = Math.max(Number(budget.amount) - spent, 0);
            const overspent = Math.max(spent - Number(budget.amount), 0);
            const percent =
                budget.amount > 0
                    ? Math.min((spent / budget.amount) * 100, 999)
                    : 0;
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
                categoryType: budget.categoryType as any,
                customCategoryName: budget.customCategoryName,
                subcategory: budget.subcategory,
                icon: budget.icon,
                tags: budget.tags || [],
                subBudgets: budget.subBudgets || [],
                month: budget.month,
                year: budget.year,
                createdAt: budget.createdAt,
                updatedAt: budget.updatedAt,
            };
        },
    );

    const totalBudget = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalSpent = items.reduce((sum, item) => sum + (item.spent || 0), 0);
    // Deliberately not the sum of the per-item remainders: those are clamped at
    // zero for the progress bars, which made an overspent month still report
    // money left over.
    const totalRemaining = totalBudget - totalSpent;

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
        const {
            walletId,
            category,
            amount,
            month,
            year,
            note,
            color,
            categoryType,
            customCategoryName,
            subcategory,
            icon,
            tags,
            subBudgets,
        } = req.body;

        const normalizedCategory = normalizeStandardCategory(category);
        const monthNum = toNumber(month, new Date().getMonth() + 1);
        const yearNum = toNumber(year, new Date().getFullYear());
        const amountNum = toNumber(amount, 0);

        if (!normalizedCategory) {
            return res.status(400).json({
                message:
                    "Danh mục không hợp lệ. Vui lòng chọn một danh mục chuẩn.",
            });
        }
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
            return res.status(400).json({ message: "Số tiền ngân sách không hợp lệ" });
        }
        if (monthNum < 1 || monthNum > 12) {
            return res.status(400).json({ message: "Tháng không hợp lệ" });
        }

        const wallet = walletId
            ? await loadWalletForBudget(String(walletId), userId)
            : null;
        if (walletId && !wallet) {
            return res.status(404).json({ message: "Không tìm thấy ví áp dụng ngân sách" });
        }

        const exists = await Budget.findOne({
            userId,
            walletId: wallet ? wallet._id : null,
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
            walletId: wallet ? wallet._id : null,
            category: normalizedCategory,
            categoryType:
                String(categoryType || "standard").trim() === "custom"
                    ? "custom"
                    : "standard",
            customCategoryName: String(customCategoryName || "").trim() || undefined,
            subcategory: String(subcategory || "").trim() || undefined,
            icon: String(icon || "").trim() || undefined,
            tags: normalizeStringArray(tags),
            subBudgets: parseSubBudgets(subBudgets),
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
        const {
            walletId,
            category,
            amount,
            month,
            year,
            note,
            color,
            categoryType,
            customCategoryName,
            subcategory,
            icon,
            tags,
            subBudgets,
        } = req.body;

        const budget = await Budget.findOne({ _id: id, userId });
        if (!budget) {
            return res.status(404).json({ message: "Không tìm thấy ngân sách" });
        }

        // An empty string or null clears the wallet, turning the budget into an
        // any-wallet one; `undefined` leaves the current value alone.
        const nextWalletId =
            walletId !== undefined
                ? String(walletId || "").trim() || null
                : budget.walletId
                  ? String(budget.walletId)
                  : null;
        // Only the value the client actually sent is re-validated. Checking the
        // stored category locked every budget whose category is not one of the
        // eight standard strings out of editing entirely — even renaming it or
        // changing its amount came back as "danh mục không hợp lệ" — and a
        // category the budget already carries stays acceptable.
        const providedCategory =
            category !== undefined ? String(category || "").trim() : "";
        const nextCategory =
            category === undefined
                ? budget.category
                : normalizeStandardCategory(providedCategory) ||
                  (providedCategory === budget.category ? providedCategory : "");
        const nextAmount =
            amount !== undefined ? toNumber(amount, budget.amount) : budget.amount;
        const nextMonth =
            month !== undefined ? toNumber(month, budget.month) : budget.month;
        const nextYear =
            year !== undefined ? toNumber(year, budget.year) : budget.year;

        if (!nextCategory) {
            return res.status(400).json({
                message:
                    "Danh mục không hợp lệ. Vui lòng chọn một danh mục chuẩn.",
            });
        }
        if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
            return res.status(400).json({ message: "Số tiền ngân sách không hợp lệ" });
        }
        if (nextMonth < 1 || nextMonth > 12) {
            return res.status(400).json({ message: "Tháng không hợp lệ" });
        }

        const wallet = nextWalletId
            ? await loadWalletForBudget(nextWalletId, userId)
            : null;
        if (nextWalletId && !wallet) {
            return res.status(404).json({ message: "Không tìm thấy ví áp dụng ngân sách" });
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
        if (categoryType !== undefined) {
            budget.categoryType =
                String(categoryType || "").trim() === "custom"
                    ? "custom"
                    : "standard";
        }
        if (customCategoryName !== undefined) {
            budget.customCategoryName =
                String(customCategoryName || "").trim() || undefined;
        }
        if (subcategory !== undefined) {
            budget.subcategory = String(subcategory || "").trim() || undefined;
        }
        if (icon !== undefined) {
            budget.icon = String(icon || "").trim() || undefined;
        }
        if (tags !== undefined) {
            budget.tags = normalizeStringArray(tags);
        }
        if (subBudgets !== undefined) {
            budget.subBudgets = parseSubBudgets(subBudgets) as any;
        }

        await budget.save();

        // Moving a budget to another month or another wallet leaves transactions
        // pointing at a period they no longer belong to, which used to make the
        // budget report 0 spent while the money was still gone. Spending is
        // matched by category now, so dropping the stale pointer loses nothing.
        const periodStart = getMonthStart(budget.month, budget.year);
        const periodEnd = getMonthStart(
            budget.month === 12 ? 1 : budget.month + 1,
            budget.month === 12 ? budget.year + 1 : budget.year,
        );
        const staleConditions: Record<string, unknown>[] = [
            { date: { $lt: periodStart } },
            { date: { $gte: periodEnd } },
        ];
        if (budget.walletId) {
            staleConditions.push({ walletId: { $ne: budget.walletId } });
        }

        const unlinked = await Transaction.updateMany(
            { userId, budgetId: budget._id, $or: staleConditions },
            { budgetId: null },
        );

        return res.json({
            ...budget.toObject(),
            unlinkedTransactions: unlinked.modifiedCount || 0,
        });
    } catch (error) {
        console.error("Error updating budget:", error);
        return res.status(500).json({ message: "Lỗi cập nhật ngân sách" });
    }
};

export const deleteBudget = async (req: any, res: Response) => {
    // Delete and unlink share one session: if the process died between them,
    // transactions kept pointing at a budget that no longer existed and every
    // later edit of those rows failed with "không tìm thấy ngân sách".
    const session = await Budget.startSession();
    session.startTransaction();

    try {
        const userId = req.user.uid;
        const { id } = req.params;

        const budget = await Budget.findOne({ _id: id, userId }).session(
            session,
        );
        if (!budget) {
            await session.abortTransaction();
            return res.status(404).json({ message: "Không tìm thấy ngân sách" });
        }

        await Transaction.updateMany(
            { budgetId: new Types.ObjectId(id as string), userId },
            { budgetId: null },
        ).session(session);
        await Budget.deleteOne({ _id: budget._id, userId }).session(session);
        await session.commitTransaction();

        return res.json({ message: "Xóa ngân sách thành công" });
    } catch (error) {
        await session.abortTransaction();
        console.error("Error deleting budget:", error);
        return res.status(500).json({ message: "Lỗi xóa ngân sách" });
    } finally {
        session.endSession();
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

