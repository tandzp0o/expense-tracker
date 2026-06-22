import mongoose from "mongoose";
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

type ExpenseCategory =
    | "Ăn uống"
    | "Di chuyển"
    | "Mua sắm"
    | "Giải trí"
    | "Sức khỏe"
    | "Giáo dục"
    | "Hóa đơn"
    | "Khác";

type Persona = {
    uid: string;
    email: string;
    username: string;
    displayName: string;
    bio: string;
    address: string;
    monthlySalary: number;
    sideIncome?: number;
    hasGirlfriend: boolean;
    studyingMaster: boolean;
    goalTitle: string;
    goalAmount: number;
    expenseWeights: Array<{ category: ExpenseCategory; weight: number }>;
};

const PROFILES: Persona[] = [
    {
        uid: "it-grad-basic-001",
        email: "it.grad.basic.001@example.com",
        username: "it-grad-basic-001",
        displayName: "Trần Minh Khang",
        bio: "Sinh viên IT mới ra trường, đi làm văn phòng và chi tiêu cơ bản.",
        address: "Bình Thạnh, TP.HCM",
        monthlySalary: 8_000_000,
        hasGirlfriend: false,
        studyingMaster: false,
        goalTitle: "Quỹ dự phòng 6 tháng",
        goalAmount: 48_000_000,
        expenseWeights: [
            { category: "Ăn uống", weight: 30 },
            { category: "Di chuyển", weight: 16 },
            { category: "Hóa đơn", weight: 20 },
            { category: "Giải trí", weight: 8 },
            { category: "Mua sắm", weight: 10 },
            { category: "Sức khỏe", weight: 6 },
            { category: "Giáo dục", weight: 5 },
            { category: "Khác", weight: 5 },
        ],
    },
    {
        uid: "it-grad-master-gf-001",
        email: "it.grad.master.gf.001@example.com",
        username: "it-grad-master-gf-001",
        displayName: "Lê Quốc Huy",
        bio: "Sinh viên IT mới ra trường, đang học thạc sỹ và có bạn gái.",
        address: "Gò Vấp, TP.HCM",
        monthlySalary: 8_000_000,
        sideIncome: 1_200_000,
        hasGirlfriend: true,
        studyingMaster: true,
        goalTitle: "Quỹ học thạc sỹ + chứng chỉ",
        goalAmount: 80_000_000,
        expenseWeights: [
            { category: "Ăn uống", weight: 26 },
            { category: "Di chuyển", weight: 14 },
            { category: "Hóa đơn", weight: 16 },
            { category: "Giải trí", weight: 12 },
            { category: "Mua sắm", weight: 10 },
            { category: "Sức khỏe", weight: 5 },
            { category: "Giáo dục", weight: 14 },
            { category: "Khác", weight: 3 },
        ],
    },
];

const parseArg = (key: string, fallback: string) => {
    const raw = process.argv.find((item) => item.startsWith(`--${key}=`));
    if (!raw) return fallback;
    const value = raw.split("=")[1];
    return value || fallback;
};

const randomInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

const roundToThousand = (value: number) =>
    Math.max(1_000, Math.round(value / 1_000) * 1_000);

const amountNoise = (base: number, ratio: number) => {
    const delta = base * ratio;
    return roundToThousand(base + (Math.random() * 2 - 1) * delta);
};

const pickWeighted = (weights: Array<{ category: ExpenseCategory; weight: number }>) => {
    const total = weights.reduce((acc, it) => acc + it.weight, 0);
    let cursor = Math.random() * total;
    for (const item of weights) {
        cursor -= item.weight;
        if (cursor <= 0) return item.category;
    }
    return "Ăn uống";
};

const getMonthKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

async function clearUser(uid: string) {
    await Promise.all([
        User.deleteMany({ uid }),
        Wallet.deleteMany({ userId: uid }),
        Budget.deleteMany({ userId: uid }),
        Goal.deleteMany({ userId: uid }),
        Transaction.deleteMany({ userId: uid }),
    ]);
}

async function seedPersona(persona: Persona, months: number) {
    await User.create({
        uid: persona.uid,
        email: persona.email,
        username: persona.username,
        displayName: persona.displayName,
        hasPassword: true,
        authProviders: ["password"],
        newUser: false,
        bio: persona.bio,
        address: persona.address,
        totalBalance: 0,
        totalIncome: 0,
        totalExpense: 0,
        goalsCompleted: 0,
        goalsActive: 1,
    });

    const [bankWallet, cashWallet] = await Wallet.insertMany([
        {
            userId: persona.uid,
            type: "bank",
            currency: "VND",
            name: "Tài khoản lương",
            balance: 0,
            initialBalance: 0,
            icon: "bank",
            color: "#1565C0",
            isArchived: false,
            hasTransactions: true,
        },
        {
            userId: persona.uid,
            type: "cash",
            currency: "VND",
            name: "Ví tiền mặt",
            balance: 0,
            initialBalance: 0,
            icon: "wallet",
            color: "#2E7D32",
            isArchived: false,
            hasTransactions: true,
        },
    ]);

    const goal = await Goal.create({
        userId: persona.uid,
        title: persona.goalTitle,
        description: "Mục tiêu tiết kiệm ưu tiên trong giai đoạn đầu sự nghiệp.",
        targetAmount: persona.goalAmount,
        currentAmount: 0,
        category: "education",
        status: "active",
        deadline: new Date(new Date().getFullYear() + 3, 11, 31),
    });

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const budgetMap = new Map<string, string>();

    for (let i = 0; i < months; i += 1) {
        const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const month = monthDate.getMonth() + 1;
        const year = monthDate.getFullYear();
        for (const item of persona.expenseWeights) {
            const monthlyExpenseBase = persona.studyingMaster ? 5_800_000 : 5_200_000;
            const amount = amountNoise(
                Math.round((monthlyExpenseBase * item.weight) / 100),
                0.18,
            );
            const budget = await Budget.create({
                userId: persona.uid,
                walletId: bankWallet._id,
                category: item.category,
                amount,
                month,
                year,
                note: `Ngân sách ${item.category} tháng ${month}/${year}`,
            });
            budgetMap.set(`${year}-${String(month).padStart(2, "0")}-${item.category}`, String(budget._id));
        }
    }

    const transactions: Array<Record<string, unknown>> = [];
    let bankBalance = 0;
    let cashBalance = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    let goalSaved = 0;

    for (
        let d = new Date(startDate);
        d <= now;
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    ) {
        const day = d.getDate();
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

        if (day === 5) {
            transactions.push({
                userId: persona.uid,
                walletId: bankWallet._id,
                type: TransactionType.INCOME,
                status: TransactionStatus.COMPLETED,
                amount: persona.monthlySalary,
                category: "Salary",
                date: new Date(d),
                note: "Lương tháng từ công việc IT.",
            });
            bankBalance += persona.monthlySalary;
            totalIncome += persona.monthlySalary;
        }

        if (persona.sideIncome && day === 18) {
            const side = amountNoise(persona.sideIncome, 0.25);
            transactions.push({
                userId: persona.uid,
                walletId: bankWallet._id,
                type: TransactionType.INCOME,
                status: TransactionStatus.COMPLETED,
                amount: side,
                category: "Side income",
                date: new Date(d),
                note: "Thu nhập thêm từ freelance/mentor.",
            });
            bankBalance += side;
            totalIncome += side;
        }

        if (day === 7) {
            const transferAmount = amountNoise(1_500_000, 0.3);
            transactions.push({
                userId: persona.uid,
                walletId: bankWallet._id,
                transferPeerWalletId: cashWallet._id,
                transferGroupId: `transfer-${persona.uid}-${getMonthKey(d)}`,
                type: TransactionType.EXPENSE,
                status: TransactionStatus.COMPLETED,
                amount: transferAmount,
                category: "Transfer",
                date: new Date(d),
                note: "Rút tiền mặt chi tiêu trong tháng.",
                isSystemGenerated: true,
                isDeletable: false,
            });
            transactions.push({
                userId: persona.uid,
                walletId: cashWallet._id,
                transferPeerWalletId: bankWallet._id,
                transferGroupId: `transfer-${persona.uid}-${getMonthKey(d)}`,
                type: TransactionType.INCOME,
                status: TransactionStatus.COMPLETED,
                amount: transferAmount,
                category: "Transfer",
                date: new Date(d),
                note: "Nhận tiền mặt từ tài khoản lương.",
                isSystemGenerated: true,
                isDeletable: false,
            });
            bankBalance -= transferAmount;
            cashBalance += transferAmount;
        }

        const expenseCount = isWeekend ? randomInt(1, 3) : randomInt(1, 2);
        for (let i = 0; i < expenseCount; i += 1) {
            const category = pickWeighted(persona.expenseWeights);
            const baseByCategory: Record<ExpenseCategory, number> = {
                "Ăn uống": 85_000,
                "Di chuyển": 55_000,
                "Mua sắm": 120_000,
                "Giải trí": persona.hasGirlfriend ? 140_000 : 80_000,
                "Sức khỏe": 70_000,
                "Giáo dục": persona.studyingMaster ? 180_000 : 60_000,
                "Hóa đơn": 95_000,
                "Khác": 50_000,
            };
            const amount = amountNoise(baseByCategory[category], 0.5);
            const useCash = Math.random() < 0.45;
            const walletId = useCash ? cashWallet._id : bankWallet._id;
            const budgetId = budgetMap.get(`${getMonthKey(d)}-${category}`);

            transactions.push({
                userId: persona.uid,
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
                    randomInt(7, 21),
                    randomInt(0, 59),
                ),
                note:
                    category === "Giáo dục"
                        ? "Học phí/khóa học/chứng chỉ."
                        : category === "Giải trí" && persona.hasGirlfriend
                          ? "Đi chơi, xem phim, cà phê cùng bạn gái."
                          : category === "Ăn uống"
                            ? "Ăn trưa văn phòng và bữa tối."
                            : undefined,
            });

            totalExpense += amount;
            if (String(walletId) === String(bankWallet._id)) bankBalance -= amount;
            else cashBalance -= amount;
        }

        if (day === 23) {
            const saveAmount = persona.studyingMaster
                ? amountNoise(750_000, 0.25)
                : amountNoise(1_200_000, 0.3);
            transactions.push({
                userId: persona.uid,
                walletId: bankWallet._id,
                goalId: goal._id,
                type: TransactionType.GOAL_DEPOSIT,
                status: TransactionStatus.COMPLETED,
                amount: saveAmount,
                category: "Tiết kiệm mục tiêu",
                date: new Date(d),
                note: `Nạp tiết kiệm cho mục tiêu: ${persona.goalTitle}.`,
            });
            bankBalance -= saveAmount;
            goalSaved += saveAmount;
        }
    }

    goal.currentAmount = Math.min(goalSaved, goal.targetAmount);
    goal.status = goal.currentAmount >= goal.targetAmount ? "completed" : "active";
    await goal.save();

    bankWallet.balance = bankBalance;
    cashWallet.balance = cashBalance;
    await Promise.all([bankWallet.save(), cashWallet.save()]);

    await Transaction.insertMany(transactions);

    await User.updateOne(
        { uid: persona.uid },
        {
            $set: {
                totalIncome,
                totalExpense,
                totalBalance: bankBalance + cashBalance,
                goalsCompleted: goal.status === "completed" ? 1 : 0,
                goalsActive: goal.status === "completed" ? 0 : 1,
                transactionCacheVersion: 1,
                transactionsUpdatedAt: new Date(),
            },
        },
    );

    return {
        uid: persona.uid,
        totalIncome,
        totalExpense,
        totalBalance: bankBalance + cashBalance,
        transactions: transactions.length,
        goalSaved,
    };
}

async function run() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error("Missing MONGO_URI");

    const months = Math.max(3, Number(parseArg("months", "12")));
    const reset = parseArg("reset", "true") === "true";

    await mongoose.connect(mongoUri);

    if (reset) {
        for (const profile of PROFILES) {
            await clearUser(profile.uid);
        }
    }

    const summaries = [];
    for (const profile of PROFILES) {
        const summary = await seedPersona(profile, months);
        summaries.push(summary);
    }

    console.log(JSON.stringify({ months, summaries }, null, 2));
    await mongoose.disconnect();
}

run().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});
