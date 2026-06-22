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

type Profile = {
    uid: string;
    email: string;
    username: string;
    displayName: string;
    address: string;
    bio: string;
    monthlyIncomeBase: number;
    sideIncomeBase?: number;
    months: number;
    spendLevel: "low" | "medium" | "high";
    weights: Array<{ category: ExpenseCategory; weight: number }>;
    goals: Array<{ title: string; targetAmount: number; category: string }>;
};

const CATEGORIES: ExpenseCategory[] = [
    "Ăn uống",
    "Di chuyển",
    "Mua sắm",
    "Giải trí",
    "Sức khỏe",
    "Giáo dục",
    "Hóa đơn",
    "Khác",
];

const parseArg = (key: string, fallback: string) => {
    const raw = process.argv.find((item) => item.startsWith(`--${key}=`));
    if (!raw) return fallback;
    return raw.split("=")[1] || fallback;
};

const roundToThousand = (value: number) =>
    Math.max(1_000, Math.round(value / 1_000) * 1_000);

const randomInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

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

const profiles: Profile[] = [
    {
        uid: "diverse-001-low-highspend",
        email: "diverse.001@example.com",
        username: "diverse-001",
        displayName: "Ngô Đức Minh",
        address: "Thủ Đức, TP.HCM",
        bio: "Thu nhập thấp nhưng chi tiêu mạnh tay.",
        monthlyIncomeBase: 7_000_000,
        months: 6,
        spendLevel: "high",
        weights: [
            { category: "Ăn uống", weight: 30 },
            { category: "Giải trí", weight: 22 },
            { category: "Mua sắm", weight: 16 },
            { category: "Di chuyển", weight: 10 },
            { category: "Hóa đơn", weight: 10 },
            { category: "Sức khỏe", weight: 4 },
            { category: "Giáo dục", weight: 3 },
            { category: "Khác", weight: 5 },
        ],
        goals: [{ title: "Quỹ khẩn cấp", targetAmount: 25_000_000, category: "safety" }],
    },
    {
        uid: "diverse-002-mid-highspend",
        email: "diverse.002@example.com",
        username: "diverse-002",
        displayName: "Trương Anh Tài",
        address: "Quận 7, TP.HCM",
        bio: "Thu nhập vừa, chi tiêu cao cho trải nghiệm.",
        monthlyIncomeBase: 16_000_000,
        sideIncomeBase: 2_000_000,
        months: 8,
        spendLevel: "high",
        weights: [
            { category: "Ăn uống", weight: 24 },
            { category: "Giải trí", weight: 24 },
            { category: "Mua sắm", weight: 20 },
            { category: "Di chuyển", weight: 12 },
            { category: "Hóa đơn", weight: 10 },
            { category: "Sức khỏe", weight: 4 },
            { category: "Giáo dục", weight: 2 },
            { category: "Khác", weight: 4 },
        ],
        goals: [
            { title: "Du lịch Nhật Bản", targetAmount: 80_000_000, category: "travel" },
            { title: "Đổi laptop", targetAmount: 35_000_000, category: "device" },
        ],
    },
    {
        uid: "diverse-003-many-goals",
        email: "diverse.003@example.com",
        username: "diverse-003",
        displayName: "Lâm Gia Bảo",
        address: "Đà Nẵng",
        bio: "Có nhiều mục tiêu tài chính song song.",
        monthlyIncomeBase: 20_000_000,
        months: 10,
        spendLevel: "medium",
        weights: [
            { category: "Ăn uống", weight: 22 },
            { category: "Hóa đơn", weight: 18 },
            { category: "Di chuyển", weight: 15 },
            { category: "Giáo dục", weight: 12 },
            { category: "Mua sắm", weight: 12 },
            { category: "Giải trí", weight: 10 },
            { category: "Sức khỏe", weight: 6 },
            { category: "Khác", weight: 5 },
        ],
        goals: [
            { title: "Mua xe máy mới", targetAmount: 55_000_000, category: "vehicle" },
            { title: "Học chứng chỉ cloud", targetAmount: 20_000_000, category: "education" },
            { title: "Quỹ dự phòng", targetAmount: 60_000_000, category: "safety" },
            { title: "Tiền cưới", targetAmount: 90_000_000, category: "family" },
        ],
    },
    {
        uid: "diverse-004-sport-food",
        email: "diverse.004@example.com",
        username: "diverse-004",
        displayName: "Phạm Hoàng Vũ",
        address: "Biên Hòa, Đồng Nai",
        bio: "Thiên chi tiêu thể thao và ăn uống.",
        monthlyIncomeBase: 14_000_000,
        months: 6,
        spendLevel: "medium",
        weights: [
            { category: "Ăn uống", weight: 35 },
            { category: "Sức khỏe", weight: 20 },
            { category: "Giải trí", weight: 14 },
            { category: "Di chuyển", weight: 12 },
            { category: "Hóa đơn", weight: 10 },
            { category: "Mua sắm", weight: 6 },
            { category: "Giáo dục", weight: 1 },
            { category: "Khác", weight: 2 },
        ],
        goals: [{ title: "Gói gym 2 năm", targetAmount: 24_000_000, category: "health" }],
    },
    {
        uid: "diverse-005-beauty-shopping",
        email: "diverse.005@example.com",
        username: "diverse-005",
        displayName: "Bùi Ngọc Hân",
        address: "Tân Bình, TP.HCM",
        bio: "Chi tiêu thiên về làm đẹp và mua sắm.",
        monthlyIncomeBase: 15_000_000,
        sideIncomeBase: 1_500_000,
        months: 8,
        spendLevel: "high",
        weights: [
            { category: "Mua sắm", weight: 35 },
            { category: "Ăn uống", weight: 20 },
            { category: "Giải trí", weight: 14 },
            { category: "Hóa đơn", weight: 10 },
            { category: "Di chuyển", weight: 9 },
            { category: "Sức khỏe", weight: 6 },
            { category: "Giáo dục", weight: 2 },
            { category: "Khác", weight: 4 },
        ],
        goals: [
            { title: "Quỹ kinh doanh mỹ phẩm", targetAmount: 120_000_000, category: "business" },
            { title: "Du lịch Hàn Quốc", targetAmount: 70_000_000, category: "travel" },
        ],
    },
    {
        uid: "diverse-006-fresh-2m",
        email: "diverse.006@example.com",
        username: "diverse-006",
        displayName: "Đặng Minh Quân",
        address: "Nha Trang, Khánh Hòa",
        bio: "Người dùng mới, dữ liệu 2 tháng.",
        monthlyIncomeBase: 9_000_000,
        months: 2,
        spendLevel: "medium",
        weights: [
            { category: "Ăn uống", weight: 28 },
            { category: "Hóa đơn", weight: 18 },
            { category: "Di chuyển", weight: 16 },
            { category: "Giải trí", weight: 12 },
            { category: "Mua sắm", weight: 10 },
            { category: "Sức khỏe", weight: 6 },
            { category: "Giáo dục", weight: 5 },
            { category: "Khác", weight: 5 },
        ],
        goals: [{ title: "Tiền đặt cọc trọ", targetAmount: 12_000_000, category: "housing" }],
    },
    {
        uid: "diverse-007-family-tight",
        email: "diverse.007@example.com",
        username: "diverse-007",
        displayName: "Nguyễn Thị Thu",
        address: "Quảng Ngãi",
        bio: "Gia đình nhỏ, chi chặt nhưng áp lực hóa đơn.",
        monthlyIncomeBase: 12_000_000,
        months: 10,
        spendLevel: "medium",
        weights: [
            { category: "Hóa đơn", weight: 24 },
            { category: "Ăn uống", weight: 26 },
            { category: "Giáo dục", weight: 16 },
            { category: "Di chuyển", weight: 12 },
            { category: "Sức khỏe", weight: 9 },
            { category: "Mua sắm", weight: 6 },
            { category: "Giải trí", weight: 4 },
            { category: "Khác", weight: 3 },
        ],
        goals: [{ title: "Quỹ học cho con", targetAmount: 80_000_000, category: "education" }],
    },
    {
        uid: "diverse-008-sidehustle",
        email: "diverse.008@example.com",
        username: "diverse-008",
        displayName: "Võ Thanh Tùng",
        address: "Cần Thơ",
        bio: "Có nhiều nguồn thu, vẫn chi tiêu lớn.",
        monthlyIncomeBase: 13_000_000,
        sideIncomeBase: 4_000_000,
        months: 8,
        spendLevel: "high",
        weights: [
            { category: "Ăn uống", weight: 25 },
            { category: "Mua sắm", weight: 20 },
            { category: "Giải trí", weight: 18 },
            { category: "Di chuyển", weight: 13 },
            { category: "Hóa đơn", weight: 12 },
            { category: "Khác", weight: 6 },
            { category: "Sức khỏe", weight: 4 },
            { category: "Giáo dục", weight: 2 },
        ],
        goals: [{ title: "Quỹ mở quán nước", targetAmount: 95_000_000, category: "business" }],
    },
    {
        uid: "diverse-009-student-worker",
        email: "diverse.009@example.com",
        username: "diverse-009",
        displayName: "Lý Hải Yến",
        address: "Huế",
        bio: "Vừa đi làm vừa học thêm.",
        monthlyIncomeBase: 8_500_000,
        months: 4,
        spendLevel: "medium",
        weights: [
            { category: "Giáo dục", weight: 24 },
            { category: "Ăn uống", weight: 24 },
            { category: "Hóa đơn", weight: 18 },
            { category: "Di chuyển", weight: 12 },
            { category: "Giải trí", weight: 8 },
            { category: "Mua sắm", weight: 7 },
            { category: "Sức khỏe", weight: 4 },
            { category: "Khác", weight: 3 },
        ],
        goals: [
            { title: "Học phí chứng chỉ data", targetAmount: 18_000_000, category: "education" },
            { title: "Laptop học tập", targetAmount: 22_000_000, category: "device" },
        ],
    },
    {
        uid: "diverse-010-minimalist",
        email: "diverse.010@example.com",
        username: "diverse-010",
        displayName: "Trần Quốc Nam",
        address: "Phú Nhuận, TP.HCM",
        bio: "Chi tiêu tối giản, ưu tiên tiết kiệm.",
        monthlyIncomeBase: 18_000_000,
        months: 6,
        spendLevel: "low",
        weights: [
            { category: "Ăn uống", weight: 24 },
            { category: "Hóa đơn", weight: 20 },
            { category: "Di chuyển", weight: 16 },
            { category: "Giáo dục", weight: 12 },
            { category: "Sức khỏe", weight: 10 },
            { category: "Khác", weight: 8 },
            { category: "Mua sắm", weight: 6 },
            { category: "Giải trí", weight: 4 },
        ],
        goals: [
            { title: "Đầu tư chứng chỉ quỹ", targetAmount: 150_000_000, category: "investment" },
            { title: "Quỹ dự phòng", targetAmount: 90_000_000, category: "safety" },
        ],
    },
    {
        uid: "diverse-011-newly-married",
        email: "diverse.011@example.com",
        username: "diverse-011",
        displayName: "Phan Thành Đạt",
        address: "Bình Dương",
        bio: "Mới cưới, nhiều khoản chi phát sinh.",
        monthlyIncomeBase: 17_000_000,
        months: 10,
        spendLevel: "high",
        weights: [
            { category: "Hóa đơn", weight: 22 },
            { category: "Ăn uống", weight: 24 },
            { category: "Mua sắm", weight: 18 },
            { category: "Giải trí", weight: 12 },
            { category: "Di chuyển", weight: 12 },
            { category: "Khác", weight: 6 },
            { category: "Sức khỏe", weight: 4 },
            { category: "Giáo dục", weight: 2 },
        ],
        goals: [{ title: "Quỹ sinh em bé", targetAmount: 120_000_000, category: "family" }],
    },
    {
        uid: "diverse-012-gamer",
        email: "diverse.012@example.com",
        username: "diverse-012",
        displayName: "Hà Công Phúc",
        address: "Hà Nội",
        bio: "Chi nhiều cho game và giải trí.",
        monthlyIncomeBase: 11_000_000,
        sideIncomeBase: 1_000_000,
        months: 6,
        spendLevel: "high",
        weights: [
            { category: "Giải trí", weight: 33 },
            { category: "Ăn uống", weight: 23 },
            { category: "Mua sắm", weight: 15 },
            { category: "Hóa đơn", weight: 12 },
            { category: "Di chuyển", weight: 8 },
            { category: "Khác", weight: 5 },
            { category: "Sức khỏe", weight: 2 },
            { category: "Giáo dục", weight: 2 },
        ],
        goals: [{ title: "Nâng cấp PC", targetAmount: 45_000_000, category: "device" }],
    },
    {
        uid: "diverse-013-athlete-pro",
        email: "diverse.013@example.com",
        username: "diverse-013",
        displayName: "Đỗ Quang Huy",
        address: "Hải Phòng",
        bio: "Ưu tiên thể thao, chạy bộ, dinh dưỡng.",
        monthlyIncomeBase: 19_000_000,
        months: 8,
        spendLevel: "medium",
        weights: [
            { category: "Sức khỏe", weight: 26 },
            { category: "Ăn uống", weight: 28 },
            { category: "Di chuyển", weight: 14 },
            { category: "Hóa đơn", weight: 12 },
            { category: "Giải trí", weight: 8 },
            { category: "Mua sắm", weight: 6 },
            { category: "Khác", weight: 4 },
            { category: "Giáo dục", weight: 2 },
        ],
        goals: [
            { title: "Giày chạy chuyên nghiệp", targetAmount: 12_000_000, category: "health" },
            { title: "Race quốc tế", targetAmount: 35_000_000, category: "sport" },
        ],
    },
    {
        uid: "diverse-014-beauty-pro",
        email: "diverse.014@example.com",
        username: "diverse-014",
        displayName: "Lưu Diễm My",
        address: "Đà Lạt, Lâm Đồng",
        bio: "Yêu thích skincare, spa và shopping.",
        monthlyIncomeBase: 13_500_000,
        sideIncomeBase: 1_500_000,
        months: 10,
        spendLevel: "high",
        weights: [
            { category: "Mua sắm", weight: 32 },
            { category: "Sức khỏe", weight: 18 },
            { category: "Ăn uống", weight: 20 },
            { category: "Giải trí", weight: 10 },
            { category: "Hóa đơn", weight: 10 },
            { category: "Di chuyển", weight: 6 },
            { category: "Khác", weight: 3 },
            { category: "Giáo dục", weight: 1 },
        ],
        goals: [{ title: "Mở studio makeup", targetAmount: 140_000_000, category: "business" }],
    },
    {
        uid: "diverse-015-low-income-discipline",
        email: "diverse.015@example.com",
        username: "diverse-015",
        displayName: "Nguyễn Văn Lập",
        address: "Long An",
        bio: "Thu nhập thấp nhưng kỷ luật tài chính.",
        monthlyIncomeBase: 6_500_000,
        months: 8,
        spendLevel: "low",
        weights: [
            { category: "Ăn uống", weight: 30 },
            { category: "Hóa đơn", weight: 22 },
            { category: "Di chuyển", weight: 18 },
            { category: "Giáo dục", weight: 10 },
            { category: "Sức khỏe", weight: 8 },
            { category: "Khác", weight: 6 },
            { category: "Mua sắm", weight: 4 },
            { category: "Giải trí", weight: 2 },
        ],
        goals: [{ title: "Xe máy cũ đi làm", targetAmount: 25_000_000, category: "vehicle" }],
    },
    {
        uid: "diverse-016-mid-income-many-goals",
        email: "diverse.016@example.com",
        username: "diverse-016",
        displayName: "Mai Trung Hiếu",
        address: "Vũng Tàu",
        bio: "Thu nhập vừa, đặt nhiều mục tiêu cùng lúc.",
        monthlyIncomeBase: 18_000_000,
        sideIncomeBase: 2_500_000,
        months: 4,
        spendLevel: "medium",
        weights: [
            { category: "Ăn uống", weight: 24 },
            { category: "Hóa đơn", weight: 18 },
            { category: "Di chuyển", weight: 14 },
            { category: "Giáo dục", weight: 12 },
            { category: "Mua sắm", weight: 12 },
            { category: "Giải trí", weight: 10 },
            { category: "Sức khỏe", weight: 6 },
            { category: "Khác", weight: 4 },
        ],
        goals: [
            { title: "Quỹ đầu tư", targetAmount: 120_000_000, category: "investment" },
            { title: "Du lịch châu Âu", targetAmount: 160_000_000, category: "travel" },
            { title: "Khóa MBA mini", targetAmount: 40_000_000, category: "education" },
        ],
    },
];

async function clearUser(uid: string) {
    await Promise.all([
        User.deleteMany({ uid }),
        Wallet.deleteMany({ userId: uid }),
        Budget.deleteMany({ userId: uid }),
        Goal.deleteMany({ userId: uid }),
        Transaction.deleteMany({ userId: uid }),
    ]);
}

async function seedOne(profile: Profile) {
    await User.create({
        uid: profile.uid,
        email: profile.email,
        username: profile.username,
        displayName: profile.displayName,
        address: profile.address,
        bio: profile.bio,
        hasPassword: true,
        authProviders: ["password"],
        newUser: false,
        totalBalance: 0,
        totalIncome: 0,
        totalExpense: 0,
        goalsCompleted: 0,
        goalsActive: profile.goals.length,
    });

    const [bank, cash] = await Wallet.insertMany([
        {
            userId: profile.uid,
            type: "bank",
            currency: "VND",
            name: "Tài khoản chính",
            balance: 0,
            initialBalance: 0,
            hasTransactions: true,
            isArchived: false,
            icon: "bank",
            color: "#1565C0",
        },
        {
            userId: profile.uid,
            type: "cash",
            currency: "VND",
            name: "Ví tiền mặt",
            balance: 0,
            initialBalance: 0,
            hasTransactions: true,
            isArchived: false,
            icon: "wallet",
            color: "#2E7D32",
        },
    ]);

    const goals = await Promise.all(
        profile.goals.map((g) =>
            Goal.create({
                userId: profile.uid,
                title: g.title,
                description: "Mục tiêu tài chính cá nhân.",
                targetAmount: g.targetAmount,
                currentAmount: 0,
                category: g.category,
                status: "active",
                deadline: new Date(new Date().getFullYear() + 3, 11, 31),
            }),
        ),
    );

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - profile.months + 1, 1);
    const budgetMap = new Map<string, string>();

    for (let i = 0; i < profile.months; i += 1) {
        const md = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const month = md.getMonth() + 1;
        const year = md.getFullYear();
        const spendRatio =
            profile.spendLevel === "high" ? 0.82 : profile.spendLevel === "low" ? 0.58 : 0.7;
        const monthlyExpenseBase = roundToThousand(profile.monthlyIncomeBase * spendRatio);
        for (const c of CATEGORIES) {
            const w = profile.weights.find((x) => x.category === c)?.weight || 0;
            const budget = await Budget.create({
                userId: profile.uid,
                walletId: bank._id,
                category: c,
                amount: amountNoise((monthlyExpenseBase * w) / 100, 0.2),
                month,
                year,
                note: `Ngân sách ${c} tháng ${month}/${year}`,
            });
            budgetMap.set(`${year}-${String(month).padStart(2, "0")}-${c}`, String(budget._id));
        }
    }

    const transactions: Array<Record<string, unknown>> = [];
    let totalIncome = 0;
    let totalExpense = 0;
    let bankBalance = 0;
    let cashBalance = 0;
    const goalSaved = new Map<string, number>();

    for (
        let d = new Date(startDate);
        d <= now;
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    ) {
        const day = d.getDate();
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

        if (day === 5) {
            const salary = amountNoise(profile.monthlyIncomeBase, 0.08);
            transactions.push({
                userId: profile.uid,
                walletId: bank._id,
                type: TransactionType.INCOME,
                status: TransactionStatus.COMPLETED,
                amount: salary,
                category: "Salary",
                date: new Date(d),
                note: "Lương tháng.",
            });
            totalIncome += salary;
            bankBalance += salary;
        }

        if (profile.sideIncomeBase && day === 18) {
            const side = amountNoise(profile.sideIncomeBase, 0.3);
            transactions.push({
                userId: profile.uid,
                walletId: bank._id,
                type: TransactionType.INCOME,
                status: TransactionStatus.COMPLETED,
                amount: side,
                category: "Side income",
                date: new Date(d),
                note: "Thu nhập thêm.",
            });
            totalIncome += side;
            bankBalance += side;
        }

        if (day === 7) {
            const transferAmount = amountNoise(profile.monthlyIncomeBase * 0.18, 0.25);
            const gid = `transfer-${profile.uid}-${getMonthKey(d)}`;
            transactions.push({
                userId: profile.uid,
                walletId: bank._id,
                transferPeerWalletId: cash._id,
                transferGroupId: gid,
                type: TransactionType.EXPENSE,
                status: TransactionStatus.COMPLETED,
                amount: transferAmount,
                category: "Transfer",
                date: new Date(d),
                note: "Rút tiền mặt chi tiêu.",
                isSystemGenerated: true,
                isDeletable: false,
            });
            transactions.push({
                userId: profile.uid,
                walletId: cash._id,
                transferPeerWalletId: bank._id,
                transferGroupId: gid,
                type: TransactionType.INCOME,
                status: TransactionStatus.COMPLETED,
                amount: transferAmount,
                category: "Transfer",
                date: new Date(d),
                note: "Nhận tiền mặt.",
                isSystemGenerated: true,
                isDeletable: false,
            });
            bankBalance -= transferAmount;
            cashBalance += transferAmount;
        }

        const expenseCount = isWeekend ? randomInt(2, 4) : randomInt(1, 3);
        for (let i = 0; i < expenseCount; i += 1) {
            const category = pickWeighted(profile.weights);
            const baseAmount =
                profile.spendLevel === "high"
                    ? 170_000
                    : profile.spendLevel === "low"
                      ? 90_000
                      : 130_000;
            const multiplier =
                category === "Mua sắm" || category === "Giải trí"
                    ? 1.25
                    : category === "Hóa đơn"
                      ? 1.4
                      : category === "Sức khỏe"
                        ? 1.1
                        : 1;
            const amount = amountNoise(baseAmount * multiplier, 0.55);
            const walletId = Math.random() < 0.5 ? bank._id : cash._id;
            const budgetId = budgetMap.get(`${getMonthKey(d)}-${category}`);

            transactions.push({
                userId: profile.uid,
                walletId,
                budgetId,
                type: TransactionType.EXPENSE,
                status: TransactionStatus.COMPLETED,
                amount,
                category,
                date: new Date(d.getFullYear(), d.getMonth(), d.getDate(), randomInt(7, 22), randomInt(0, 59)),
                note:
                    category === "Sức khỏe"
                        ? "Chi phí thể thao/chăm sóc sức khỏe."
                        : category === "Mua sắm"
                          ? "Mua sắm đồ dùng cá nhân."
                          : category === "Ăn uống"
                            ? "Ăn uống hằng ngày."
                            : undefined,
            });

            totalExpense += amount;
            if (String(walletId) === String(bank._id)) bankBalance -= amount;
            else cashBalance -= amount;
        }

        if (day === 23 && goals.length > 0) {
            const g = goals[randomInt(0, goals.length - 1)];
            const saveBase =
                profile.spendLevel === "high" ? profile.monthlyIncomeBase * 0.05 : profile.monthlyIncomeBase * 0.1;
            const saveAmount = amountNoise(saveBase, 0.3);
            transactions.push({
                userId: profile.uid,
                walletId: bank._id,
                goalId: g._id,
                type: TransactionType.GOAL_DEPOSIT,
                status: TransactionStatus.COMPLETED,
                amount: saveAmount,
                category: "Tiết kiệm mục tiêu",
                date: new Date(d),
                note: `Nạp mục tiêu: ${g.title}.`,
            });
            bankBalance -= saveAmount;
            goalSaved.set(String(g._id), (goalSaved.get(String(g._id)) || 0) + saveAmount);
        }
    }

    for (const g of goals) {
        const current = Math.min(g.targetAmount, goalSaved.get(String(g._id)) || 0);
        g.currentAmount = current;
        g.status = current >= g.targetAmount ? "completed" : "active";
        await g.save();
    }

    bank.balance = bankBalance;
    cash.balance = cashBalance;
    await Promise.all([bank.save(), cash.save()]);
    await Transaction.insertMany(transactions);

    const completedGoals = goals.filter((g) => g.status === "completed").length;
    await User.updateOne(
        { uid: profile.uid },
        {
            $set: {
                totalIncome,
                totalExpense,
                totalBalance: bankBalance + cashBalance,
                goalsCompleted: completedGoals,
                goalsActive: goals.length - completedGoals,
                transactionCacheVersion: 1,
                transactionsUpdatedAt: new Date(),
            },
        },
    );

    return { uid: profile.uid, months: profile.months, transactions: transactions.length };
}

async function run() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error("Missing MONGO_URI");
    const reset = parseArg("reset", "true") === "true";

    await mongoose.connect(mongoUri);
    const summaries = [];
    for (const p of profiles) {
        if (reset) await clearUser(p.uid);
        summaries.push(await seedOne(p));
    }
    console.log(JSON.stringify({ seededUsers: profiles.length, summaries }, null, 2));
    await mongoose.disconnect();
}

run().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});

