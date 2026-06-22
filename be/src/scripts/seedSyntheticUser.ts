import mongoose, { Types } from "mongoose";
import * as dotenv from "dotenv";
import User from "../models/User";
import Wallet from "../models/Wallet";
import Budget from "../models/Budget";
import Goal from "../models/Goal";
import Transaction, {
    TransactionStatus,
    TransactionType,
} from "../models/Transaction";

dotenv.config();

type BudgetCategory =
    | "Ăn uống"
    | "Di chuyển"
    | "Mua sắm"
    | "Giải trí"
    | "Sức khỏe"
    | "Giáo dục"
    | "Hóa đơn"
    | "Khác";

const CATEGORY_WEIGHTS: Array<{ category: BudgetCategory; weight: number }> = [
    { category: "Ăn uống", weight: 28 },
    { category: "Di chuyển", weight: 10 },
    { category: "Mua sắm", weight: 13 },
    { category: "Giải trí", weight: 7 },
    { category: "Sức khỏe", weight: 8 },
    { category: "Giáo dục", weight: 12 },
    { category: "Hóa đơn", weight: 17 },
    { category: "Khác", weight: 5 },
];

type GoalTemplate = {
    title: string;
    description: string;
    category: string;
    targetAmount: number;
    yearsToTarget: number;
};

const GOAL_TEMPLATES: GoalTemplate[] = [
    {
        title: "Mua nha",
        description: "Tích lũy để mua nhà cho gia đình.",
        category: "housing",
        targetAmount: 1_800_000_000,
        yearsToTarget: 7,
    },
    {
        title: "Mua xe gia dinh",
        description: "Mua xe 7 chỗ phục vụ gia đình và đi lại.",
        category: "vehicle",
        targetAmount: 620_000_000,
        yearsToTarget: 3,
    },
    {
        title: "Mo quan cafe",
        description: "Vốn đầu tư mặt bằng, máy móc, vận hành 6 tháng đầu.",
        category: "business",
        targetAmount: 950_000_000,
        yearsToTarget: 5,
    },
    {
        title: "Xay cua hang mini",
        description: "Chi phí cải tạo, kệ hàng và dự phòng vốn lưu động.",
        category: "business",
        targetAmount: 1_250_000_000,
        yearsToTarget: 6,
    },
    {
        title: "Lam trang trai nho",
        description: "Mua đất, hệ thống tưới, con giống và nhà kho.",
        category: "farm",
        targetAmount: 2_400_000_000,
        yearsToTarget: 8,
    },
    {
        title: "Ho boi gia dinh",
        description: "Xây hồ bơi nhỏ phục vụ gia đình và cho thuê giờ.",
        category: "lifestyle",
        targetAmount: 480_000_000,
        yearsToTarget: 4,
    },
];

const COLORS = [
    "#2E7D32",
    "#1565C0",
    "#6A1B9A",
    "#EF6C00",
    "#00838F",
    "#AD1457",
    "#5D4037",
    "#455A64",
];

const randomInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

const roundToThousand = (value: number) =>
    Math.max(1_000, Math.round(value / 1_000) * 1_000);

const pickWeightedCategory = (): BudgetCategory => {
    const total = CATEGORY_WEIGHTS.reduce((acc, item) => acc + item.weight, 0);
    let cursor = Math.random() * total;
    for (const item of CATEGORY_WEIGHTS) {
        cursor -= item.weight;
        if (cursor <= 0) return item.category;
    }
    return "Ăn uống";
};

const amountNoise = (base: number, ratio: number) => {
    const delta = base * ratio;
    return roundToThousand(base + (Math.random() * 2 - 1) * delta);
};

const getMonthKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const parseArg = (key: string, fallback: string) => {
    const raw = process.argv.find((item) => item.startsWith(`--${key}=`));
    if (!raw) return fallback;
    const value = raw.split("=")[1];
    return value || fallback;
};

async function run() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error("Missing MONGO_URI in environment.");
    }

    const uid = parseArg("uid", "train-user-family-001");
    const email = parseArg("email", "train.user.family.001@example.com");
    const months = Math.max(3, Number(parseArg("months", "24")));
    const resetExisting = parseArg("reset", "true") === "true";

    await mongoose.connect(mongoUri);
    console.log(`[seed] Connected MongoDB for uid=${uid}`);

    const existingUser = await User.findOne({ uid }).lean();
    if (existingUser && resetExisting) {
        await User.deleteOne({ uid });
        await Wallet.deleteMany({ userId: uid });
        await Budget.deleteMany({ userId: uid });
        await Goal.deleteMany({ userId: uid });
        await Transaction.deleteMany({ userId: uid });
        console.log("[seed] Cleared existing synthetic data.");
    } else if (existingUser && !resetExisting) {
        throw new Error(
            `User ${uid} already exists. Run with --reset=true to replace.`,
        );
    }

    const user = await User.create({
        uid,
        email,
        username: uid,
        displayName: "Nguyen Van An",
        phone: "0901234567",
        address: "Thủ Đức, TP.HCM",
        bio: "Gia đình 4 người, thu nhập chính từ lương và kinh doanh nhỏ.",
        hasPassword: true,
        authProviders: ["password"],
        newUser: false,
        totalBalance: 0,
        totalIncome: 0,
        totalExpense: 0,
        goalsActive: 0,
        goalsCompleted: 0,
    });

    const wallets = await Wallet.insertMany([
        {
            userId: uid,
            type: "bank",
            currency: "VND",
            icon: "bank",
            color: "#1565C0",
            name: "VCB lương chính",
            accountNumber: "001-99887766",
            balance: 0,
            initialBalance: 0,
            isArchived: false,
            hasTransactions: true,
        },
        {
            userId: uid,
            type: "cash",
            currency: "VND",
            icon: "wallet",
            color: "#2E7D32",
            name: "Tiền mặt gia đình",
            balance: 0,
            initialBalance: 0,
            isArchived: false,
            hasTransactions: true,
        },
        {
            userId: uid,
            type: "ewallet",
            currency: "VND",
            icon: "smartphone",
            color: "#6A1B9A",
            name: "Ví điện tử",
            balance: 0,
            initialBalance: 0,
            isArchived: false,
            hasTransactions: true,
        },
    ]);

    const primaryWallet = wallets[0];
    const cashWallet = wallets[1];
    const ewallet = wallets[2];

    const now = new Date();
    const startDate = new Date(
        now.getFullYear(),
        now.getMonth() - months + 1,
        1,
    );

    const budgetsByMonthCategory = new Map<string, Types.ObjectId>();
    const budgetsToInsert: Array<Record<string, unknown>> = [];

    for (let i = 0; i < months; i += 1) {
        const monthDate = new Date(
            startDate.getFullYear(),
            startDate.getMonth() + i,
            1,
        );
        const month = monthDate.getMonth() + 1;
        const year = monthDate.getFullYear();

        for (const [index, c] of CATEGORY_WEIGHTS.entries()) {
            const seasonalBoost =
                month === 1 || month === 2 ? 1.15 : month === 8 ? 1.1 : 1.0;
            const baseBudget = Math.round(
                14_000_000 * (c.weight / 100) * seasonalBoost,
            );
            const amount = amountNoise(baseBudget, 0.18);
            const budgetId = new Types.ObjectId();
            const budgetDoc = {
                _id: budgetId,
                userId: uid,
                walletId: primaryWallet._id,
                category: c.category,
                amount,
                month,
                year,
                note: `Ngân sách ${c.category} ${month}/${year}`,
                color: COLORS[index % COLORS.length],
            };
            budgetsToInsert.push(budgetDoc);
            budgetsByMonthCategory.set(
                `${year}-${String(month).padStart(2, "0")}-${c.category}`,
                budgetId,
            );
        }
    }

    await Budget.insertMany(budgetsToInsert);

    const goals = await Promise.all(
        GOAL_TEMPLATES.map((goal) =>
            Goal.create({
                userId: uid,
                title: goal.title,
                description: goal.description,
                targetAmount: goal.targetAmount,
                currentAmount: 0,
                category: goal.category,
                deadline: new Date(
                    now.getFullYear() + goal.yearsToTarget,
                    now.getMonth(),
                    now.getDate(),
                ),
                status: "active",
            }),
        ),
    );

    const transactions: Array<Record<string, unknown>> = [];
    let totalIncome = 0;
    let totalExpense = 0;
    let bankBalance = 0;
    let cashBalance = 0;
    let ewalletBalance = 0;
    const goalProgress = new Map<string, number>();

    for (
        let d = new Date(startDate);
        d <= now;
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    ) {
        const day = d.getDate();
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

        if (day === 5) {
            const amount = amountNoise(32_000_000, 0.08);
            transactions.push({
                userId: uid,
                walletId: primaryWallet._id,
                type: TransactionType.INCOME,
                status: TransactionStatus.COMPLETED,
                amount,
                category: "Salary",
                date: new Date(d),
                note: "Lương cơ bản hằng tháng",
                isSystemGenerated: false,
                isDeletable: true,
            });
            totalIncome += amount;
            bankBalance += amount;
        }

        if (day === 10 && [3, 6, 9, 12].includes(d.getMonth() + 1)) {
            const amount = amountNoise(22_000_000, 0.25);
            transactions.push({
                userId: uid,
                walletId: primaryWallet._id,
                type: TransactionType.INCOME,
                status: TransactionStatus.COMPLETED,
                amount,
                category: "Bonus",
                date: new Date(d),
                note: "Thưởng quý từ công việc chính",
                isSystemGenerated: false,
                isDeletable: true,
            });
            totalIncome += amount;
            bankBalance += amount;
        }

        if (day === 15 || day === 28) {
            const amount = amountNoise(9_500_000, 0.4);
            transactions.push({
                userId: uid,
                walletId: ewallet._id,
                type: TransactionType.INCOME,
                status: TransactionStatus.COMPLETED,
                amount,
                category: "Side income",
                date: new Date(d),
                note: "Thu từ kinh doanh online và freelance",
                isSystemGenerated: false,
                isDeletable: true,
            });
            totalIncome += amount;
            ewalletBalance += amount;
        }

        if (day === 6) {
            const transferAmount = amountNoise(5_500_000, 0.35);
            const transferGroupId = `seed-transfer-${d.getFullYear()}-${d.getMonth() + 1}-${day}`;

            transactions.push({
                userId: uid,
                walletId: primaryWallet._id,
                transferPeerWalletId: cashWallet._id,
                transferGroupId,
                type: TransactionType.EXPENSE,
                status: TransactionStatus.COMPLETED,
                amount: transferAmount,
                category: "Transfer",
                date: new Date(d),
                note: "Chuyển tiền mặt chi tiêu gia đình",
                isSystemGenerated: true,
                isDeletable: false,
            });
            transactions.push({
                userId: uid,
                walletId: cashWallet._id,
                transferPeerWalletId: primaryWallet._id,
                transferGroupId,
                type: TransactionType.INCOME,
                status: TransactionStatus.COMPLETED,
                amount: transferAmount,
                category: "Transfer",
                date: new Date(d),
                note: "Nhận tiền mặt từ tài khoản ngân hàng",
                isSystemGenerated: true,
                isDeletable: false,
            });

            bankBalance -= transferAmount;
            cashBalance += transferAmount;
        }

        const expenseCount = isWeekend ? randomInt(3, 6) : randomInt(2, 4);
        for (let i = 0; i < expenseCount; i += 1) {
            const category = pickWeightedCategory();
            const baseByCategory: Record<BudgetCategory, number> = {
                "Ăn uống": 190_000,
                "Di chuyển": 110_000,
                "Mua sắm": 280_000,
                "Giải trí": 230_000,
                "Sức khỏe": 180_000,
                "Giáo dục": 260_000,
                "Hóa đơn": 420_000,
                "Khác": 150_000,
            };
            const amount = amountNoise(baseByCategory[category], 0.65);
            const walletPick = Math.random();
            const walletId =
                walletPick < 0.62
                    ? primaryWallet._id
                    : walletPick < 0.9
                      ? ewallet._id
                      : cashWallet._id;
            const walletIdStr = String(walletId);
            const monthKey = getMonthKey(d);
            const budgetId = budgetsByMonthCategory.get(`${monthKey}-${category}`);

            transactions.push({
                userId: uid,
                walletId,
                budgetId,
                type: TransactionType.EXPENSE,
                status: TransactionStatus.COMPLETED,
                amount,
                category,
                date: new Date(
                    d.getFullYear(),
                    d.getMonth(),
                    d.getDate(),
                    randomInt(7, 22),
                    randomInt(0, 59),
                ),
                note:
                    category === "Giáo dục"
                        ? "Học phí, sách vở, lớp kỹ năng cho con"
                        : category === "Hóa đơn"
                          ? "Điện nước, internet, phí sinh hoạt"
                          : category === "Ăn uống"
                            ? "Bữa ăn gia đình và mua thực phẩm"
                            : undefined,
                isSystemGenerated: false,
                isDeletable: true,
            });

            totalExpense += amount;
            if (walletIdStr === String(primaryWallet._id)) bankBalance -= amount;
            else if (walletIdStr === String(ewallet._id)) ewalletBalance -= amount;
            else cashBalance -= amount;
        }

        if (day === 20) {
            const goal = goals[randomInt(0, goals.length - 1)];
            const amount = amountNoise(6_500_000, 0.55);
            const current = goalProgress.get(String(goal._id)) || 0;
            goalProgress.set(String(goal._id), current + amount);

            transactions.push({
                userId: uid,
                walletId: primaryWallet._id,
                goalId: goal._id,
                type: TransactionType.GOAL_DEPOSIT,
                status: TransactionStatus.COMPLETED,
                amount,
                category: "Tiết kiệm mục tiêu",
                date: new Date(d),
                note: `Nạp vào mục tiêu: ${goal.title}`,
                isSystemGenerated: false,
                isDeletable: true,
            });

            bankBalance -= amount;
        }

        if (day === 2 && d.getMonth() === 1) {
            const amount = amountNoise(18_000_000, 0.2);
            transactions.push({
                userId: uid,
                walletId: primaryWallet._id,
                type: TransactionType.INCOME,
                status: TransactionStatus.COMPLETED,
                amount,
                category: "Bonus",
                date: new Date(d),
                note: "Thưởng Tết",
                isSystemGenerated: false,
                isDeletable: true,
            });
            totalIncome += amount;
            bankBalance += amount;
        }
    }

    for (const goal of goals) {
        const saved = goalProgress.get(String(goal._id)) || 0;
        const bounded = Math.min(goal.targetAmount, Math.max(0, saved));
        goal.currentAmount = bounded;
        (goal as any).status = bounded >= goal.targetAmount ? "completed" : "active";
        await goal.save();
    }

    const totalBalance = bankBalance + cashBalance + ewalletBalance;
    user.totalIncome = totalIncome;
    user.totalExpense = totalExpense;
    user.totalBalance = totalBalance;
    user.goalsCompleted = goals.filter(
        (goal) => (goalProgress.get(String(goal._id)) || 0) >= goal.targetAmount,
    ).length;
    user.goalsActive = goals.length - user.goalsCompleted;
    user.transactionCacheVersion = randomInt(2, 20);
    user.transactionsUpdatedAt = new Date();
    await user.save();

    primaryWallet.balance = bankBalance;
    primaryWallet.initialBalance = 0;
    cashWallet.balance = cashBalance;
    cashWallet.initialBalance = 0;
    ewallet.balance = ewalletBalance;
    ewallet.initialBalance = 0;
    await Promise.all([primaryWallet.save(), cashWallet.save(), ewallet.save()]);

    await Transaction.insertMany(transactions);

    console.log("[seed] Done.");
    console.log(
        JSON.stringify(
            {
                uid,
                email,
                months,
                wallets: {
                    bankBalance,
                    cashBalance,
                    ewalletBalance,
                    totalBalance,
                },
                totals: {
                    income: totalIncome,
                    expense: totalExpense,
                    transactions: transactions.length,
                    budgets: budgetsToInsert.length,
                    goals: goals.length,
                },
            },
            null,
            2,
        ),
    );

    await mongoose.disconnect();
}

run().catch(async (error) => {
    console.error("[seed] Failed:", error);
    await mongoose.disconnect();
    process.exit(1);
});
