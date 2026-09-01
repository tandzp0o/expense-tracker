import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useLocation } from "react-router-dom";
import {
    Coins,
    Flag,
    LucideIcon,
    PiggyBank,
    Receipt,
    Target,
    Trophy,
    WalletCards,
} from "lucide-react";
import { auth } from "../lib/firebase/config";
import { userApi } from "../services/api";
import { useAuth } from "./AuthContext";

export interface QuestStats {
    totalWallets: number;
    totalBudgets: number;
    totalTransactions: number;
    totalGoals: number;
    completedGoals: number;
    /** Current calendar month, already excluding transfers on the server. */
    monthlyIncome: number;
    monthlyExpense: number;
}

export interface Quest {
    id: string;
    icon: LucideIcon;
    title: string;
    description: string;
    /** Where the user goes to complete it. */
    to: string;
    done: boolean;
    /** Progress toward the quest, used for the "3/10" style hint. */
    current: number;
    target: number;
}

interface QuestValue {
    quests: Quest[];
    stats: QuestStats;
    points: number;
    totalPoints: number;
    percent: number;
    level: number;
    loading: boolean;
    refresh: () => Promise<void>;
}

const EMPTY_STATS: QuestStats = {
    totalWallets: 0,
    totalBudgets: 0,
    totalTransactions: 0,
    totalGoals: 0,
    completedGoals: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
};

/** Refetching on every navigation would hammer the stats endpoint. */
const REFRESH_THROTTLE_MS = 20000;

const QuestContext = createContext<QuestValue>({
    quests: [],
    stats: EMPTY_STATS,
    points: 0,
    totalPoints: 0,
    percent: 0,
    level: 1,
    loading: true,
    refresh: async () => undefined,
});

export const useQuests = () => useContext(QuestContext);

const buildQuests = (stats: QuestStats, isVietnamese: boolean): Quest[] => {
    const definitions: {
        id: string;
        icon: LucideIcon;
        vi: [string, string];
        en: [string, string];
        to: string;
        current: number;
        target: number;
    }[] = [
        {
            id: "first-wallet",
            icon: WalletCards,
            vi: ["Tạo ví đầu tiên", "Thêm nơi tiền của bạn đang nằm: tiền mặt, ngân hàng hoặc ví điện tử."],
            en: ["Create your first wallet", "Add where your money lives: cash, a bank account or an e-wallet."],
            to: "/wallets",
            current: stats.totalWallets,
            target: 1,
        },
        {
            id: "first-transaction",
            icon: Receipt,
            vi: ["Ghi giao dịch đầu tiên", "Ghi lại một khoản thu hoặc chi để dòng tiền bắt đầu có dữ liệu."],
            en: ["Record your first transaction", "Log one income or expense so your cashflow has data."],
            to: "/transactions",
            current: stats.totalTransactions,
            target: 1,
        },
        {
            id: "first-budget",
            icon: PiggyBank,
            vi: ["Lập ngân sách đầu tiên", "Đặt hạn mức cho một nhóm chi mà bạn hay tiêu quá tay."],
            en: ["Create your first budget", "Set a limit for a category you tend to overspend on."],
            to: "/budgets",
            current: stats.totalBudgets,
            target: 1,
        },
        {
            id: "first-goal",
            icon: Target,
            vi: ["Đặt mục tiêu tiết kiệm", "Chọn một thứ bạn đang muốn để dành và đặt số tiền cần đạt."],
            en: ["Set a savings goal", "Pick something you are saving for and set the target amount."],
            to: "/goals",
            current: stats.totalGoals,
            target: 1,
        },
        {
            id: "multi-wallet",
            icon: Coins,
            vi: ["Quản lý từ 2 ví trở lên", "Tách tiền mặt và tài khoản ngân hàng để số dư sát thực tế hơn."],
            en: ["Manage two or more wallets", "Separate cash from your bank account for a more accurate balance."],
            to: "/wallets",
            current: stats.totalWallets,
            target: 2,
        },
        {
            id: "ten-transactions",
            icon: Flag,
            vi: ["Ghi đủ 10 giao dịch", "Đủ dữ liệu để phần phân tích bắt đầu nói cho bạn điều gì đó."],
            en: ["Record ten transactions", "Enough data for analytics to start telling you something."],
            to: "/transactions",
            current: stats.totalTransactions,
            target: 10,
        },
        {
            id: "goal-completed",
            icon: Trophy,
            vi: ["Hoàn thành một mục tiêu", "Đạt đủ số tiền cho một mục tiêu bạn đã đặt ra."],
            en: ["Complete a goal", "Reach the target amount on a goal you set."],
            to: "/goals",
            current: stats.completedGoals,
            target: 1,
        },
    ];

    return definitions.map((definition) => {
        const [title, description] = isVietnamese
            ? definition.vi
            : definition.en;

        return {
            id: definition.id,
            icon: definition.icon,
            title,
            description,
            to: definition.to,
            current: Math.min(definition.current, definition.target),
            target: definition.target,
            done: definition.current >= definition.target,
        };
    });
};

export const QuestProvider: React.FC<{
    children: React.ReactNode;
    isVietnamese: boolean;
}> = ({ children, isVietnamese }) => {
    const location = useLocation();
    const { currentUser } = useAuth();
    const [stats, setStats] = useState<QuestStats>(EMPTY_STATS);
    const [loading, setLoading] = useState(true);
    const lastFetchedAtRef = useRef(0);

    const refresh = useCallback(async () => {
        if (!currentUser) {
            return;
        }

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                return;
            }

            const response = await userApi.getProfileStats(token);
            const payload = response?.data || response || {};

            lastFetchedAtRef.current = Date.now();
            setStats({
                totalWallets: Number(payload.totalWallets || 0),
                totalBudgets: Number(payload.totalBudgets || 0),
                totalTransactions: Number(payload.totalTransactions || 0),
                totalGoals: Number(payload.totalGoals || 0),
                completedGoals: Number(payload.completedGoals || 0),
                monthlyIncome: Number(payload.monthlyIncome || 0),
                monthlyExpense: Number(payload.monthlyExpense || 0),
            });
        } catch {
            // Quests are a progress hint, never a blocking flow: a failed stats
            // call should stay silent and simply keep the previous numbers.
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) {
            setStats(EMPTY_STATS);
            setLoading(false);
            return;
        }

        if (Date.now() - lastFetchedAtRef.current < REFRESH_THROTTLE_MS) {
            return;
        }

        void refresh();
    }, [currentUser, location.pathname, refresh]);

    const quests = useMemo(
        () => buildQuests(stats, isVietnamese),
        [isVietnamese, stats],
    );
    const points = quests.filter((quest) => quest.done).length;
    const totalPoints = quests.length;
    const percent = totalPoints > 0 ? (points / totalPoints) * 100 : 0;

    const value = useMemo(
        () => ({
            quests,
            stats,
            points,
            totalPoints,
            percent,
            // One level per two completed quests keeps the number small and
            // readable next to the avatar.
            level: Math.floor(points / 2) + 1,
            loading,
            refresh,
        }),
        [loading, percent, points, quests, refresh, stats, totalPoints],
    );

    return (
        <QuestContext.Provider value={value}>{children}</QuestContext.Provider>
    );
};

export default QuestContext;
