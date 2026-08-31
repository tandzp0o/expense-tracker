import {
    AlertTriangle,
    BarChart3,
    Calendar,
    Check,
    Coins,
    LineChart,
    PiggyBank,
    Receipt,
    Sparkles,
    Target,
    TrendingUp,
    Wallet,
} from "lucide-react";
import type { FeatureGuideCopy } from "./feature-guide";

export type GuideFeature =
    | "budgets"
    | "transactions"
    | "goals"
    | "analytics";

const content: Record<GuideFeature, (isVietnamese: boolean) => FeatureGuideCopy> =
    {
        budgets: (isVietnamese) =>
            isVietnamese
                ? {
                      eyebrow: "Ngân sách",
                      title: "Ngân sách dùng để làm gì?",
                      description: "Hướng dẫn nhanh cho lần đầu vào mục này",
                      actionLabel: "Lập ngân sách",
                      slides: [
                          {
                              icon: PiggyBank,
                              title: "Ngân sách là hạn mức bạn tự đặt",
                              description:
                                  "Ví dụ: tháng này chỉ tiêu tối đa 3 triệu cho ăn uống. Ứng dụng sẽ trừ dần và báo khi bạn sắp chạm hạn mức.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "Không bắt buộc, bạn có thể bỏ qua hoàn toàn",
                                  },
                                  {
                                      icon: Calendar,
                                      label: "Mỗi ngân sách gắn với một ví và một tháng",
                                  },
                              ],
                          },
                          {
                              icon: AlertTriangle,
                              title: "Khi nào bạn nên lập ngân sách?",
                              description:
                                  "Chỉ khi bạn muốn kiểm soát chặt một nhóm chi. Còn lại, cứ ghi giao dịch bình thường là đủ.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "Khi một nhóm chi hay vượt dự tính (ăn ngoài, mua sắm)",
                                  },
                                  {
                                      icon: Check,
                                      label: "Khi bạn muốn để dành phần còn lại cho mục tiêu",
                                  },
                                  {
                                      icon: Check,
                                      label: "Khi cần biết còn bao nhiêu được tiêu trong tháng",
                                  },
                              ],
                          },
                          {
                              icon: Coins,
                              title: "Không lập ngân sách thì sao?",
                              description:
                                  "Hoàn toàn không sao. Khoản chi không chọn ngân sách sẽ được ghi vào mục Chi tiêu tự do và vẫn hiện đầy đủ trong báo cáo.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "Số dư ví vẫn trừ đúng như thường",
                                  },
                                  {
                                      icon: Check,
                                      label: "Bạn có thể lập ngân sách bất cứ lúc nào sau này",
                                  },
                              ],
                          },
                      ],
                  }
                : {
                      eyebrow: "Budgets",
                      title: "What are budgets for?",
                      description: "A quick tour for your first visit",
                      actionLabel: "Create a budget",
                      slides: [
                          {
                              icon: PiggyBank,
                              title: "A budget is a limit you set yourself",
                              description:
                                  "For example: spend at most 3M on food this month. The app counts down and warns you as you approach the limit.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "Optional — you can skip budgets entirely",
                                  },
                                  {
                                      icon: Calendar,
                                      label: "Each budget belongs to one wallet and one month",
                                  },
                              ],
                          },
                          {
                              icon: AlertTriangle,
                              title: "When should you create one?",
                              description:
                                  "Only when you want tight control over a category. Otherwise, just recording transactions is enough.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "When a category keeps going over plan (eating out, shopping)",
                                  },
                                  {
                                      icon: Check,
                                      label: "When you want to save whatever is left for a goal",
                                  },
                                  {
                                      icon: Check,
                                      label: "When you need to know how much is left this month",
                                  },
                              ],
                          },
                          {
                              icon: Coins,
                              title: "What if you skip budgets?",
                              description:
                                  "That is perfectly fine. Expenses without a budget are recorded under Free spending and still show up in every report.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "Wallet balances are deducted exactly the same way",
                                  },
                                  {
                                      icon: Check,
                                      label: "You can start budgeting later at any time",
                                  },
                              ],
                          },
                      ],
                  },

        transactions: (isVietnamese) =>
            isVietnamese
                ? {
                      eyebrow: "Giao dịch",
                      title: "Ghi lại dòng tiền của bạn",
                      description: "Hướng dẫn nhanh cho lần đầu vào mục này",
                      actionLabel: "Thêm giao dịch",
                      slides: [
                          {
                              icon: Receipt,
                              title: "Mỗi giao dịch là một lần tiền vào hoặc ra",
                              description:
                                  "Chọn ví, nhập số tiền, chọn khoản thu hay khoản chi. Số dư ví sẽ tự cập nhật theo.",
                              bullets: [
                                  {
                                      icon: Wallet,
                                      label: "Khoản chi làm giảm số dư ví đã chọn",
                                  },
                                  {
                                      icon: TrendingUp,
                                      label: "Khoản thu làm tăng số dư ví",
                                  },
                              ],
                          },
                          {
                              icon: Sparkles,
                              title: "Ngân sách là tuỳ chọn",
                              description:
                                  "Bạn không cần lập ngân sách trước mới ghi được khoản chi. Bỏ trống ô ngân sách thì khoản chi vào mục Chi tiêu tự do.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "Chọn ngân sách khi muốn khoản chi trừ vào hạn mức",
                                  },
                                  {
                                      icon: Check,
                                      label: "Bỏ trống khi chỉ muốn ghi lại cho nhớ",
                                  },
                              ],
                          },
                          {
                              icon: Calendar,
                              title: "Khoản chưa xảy ra thì lên lịch",
                              description:
                                  "Nếu ngày lớn hơn hôm nay, hãy để trạng thái Đã lên lịch. Khoản đó chưa trừ tiền cho tới khi bạn xác nhận.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "Đã ghi nhận: tiền đã thực sự vào hoặc ra",
                                  },
                                  {
                                      icon: Check,
                                      label: "Đã lên lịch: dự kiến, chưa ảnh hưởng số dư",
                                  },
                              ],
                          },
                      ],
                  }
                : {
                      eyebrow: "Transactions",
                      title: "Record your cashflow",
                      description: "A quick tour for your first visit",
                      actionLabel: "Add a transaction",
                      slides: [
                          {
                              icon: Receipt,
                              title: "Each transaction is money in or out",
                              description:
                                  "Pick a wallet, enter the amount, choose income or expense. The wallet balance updates automatically.",
                              bullets: [
                                  {
                                      icon: Wallet,
                                      label: "An expense lowers the selected wallet balance",
                                  },
                                  {
                                      icon: TrendingUp,
                                      label: "Income raises the wallet balance",
                                  },
                              ],
                          },
                          {
                              icon: Sparkles,
                              title: "Budgets are optional",
                              description:
                                  "You do not need a budget before recording an expense. Leave the budget field empty and it goes to Free spending.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "Pick a budget when the expense should count against a limit",
                                  },
                                  {
                                      icon: Check,
                                      label: "Leave it empty when you only want a record",
                                  },
                              ],
                          },
                          {
                              icon: Calendar,
                              title: "Schedule what has not happened yet",
                              description:
                                  "If the date is in the future, keep the status Scheduled. It will not move money until you confirm it.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "Completed: the money really moved",
                                  },
                                  {
                                      icon: Check,
                                      label: "Scheduled: planned, balance untouched",
                                  },
                              ],
                          },
                      ],
                  },

        goals: (isVietnamese) =>
            isVietnamese
                ? {
                      eyebrow: "Mục tiêu",
                      title: "Để dành cho một thứ cụ thể",
                      description: "Hướng dẫn nhanh cho lần đầu vào mục này",
                      actionLabel: "Tạo mục tiêu",
                      slides: [
                          {
                              icon: Target,
                              title: "Mục tiêu là một khoản để dành có tên",
                              description:
                                  "Ví dụ: laptop mới 25 triệu, chuyến đi Đà Lạt 8 triệu. Bạn đặt số tiền cần đạt và nạp dần vào.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "Không bắt buộc, chỉ dùng khi bạn muốn tiết kiệm có đích",
                                  },
                                  {
                                      icon: Check,
                                      label: "Có thể đặt hạn hoàn thành để theo dõi tiến độ",
                                  },
                              ],
                          },
                          {
                              icon: PiggyBank,
                              title: "Tiền nạp vào mục tiêu lấy từ ví",
                              description:
                                  "Mỗi lần nạp là một giao dịch chuyển từ ví sang mục tiêu, nên số dư ví luôn phản ánh đúng số tiền bạn còn được tiêu.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "Nạp bao nhiêu, bấy nhiêu tiền tạm khoá lại",
                                  },
                                  {
                                      icon: Check,
                                      label: "Cần gấp thì vẫn rút ngược về ví được",
                                  },
                              ],
                          },
                      ],
                  }
                : {
                      eyebrow: "Goals",
                      title: "Save for something specific",
                      description: "A quick tour for your first visit",
                      actionLabel: "Create a goal",
                      slides: [
                          {
                              icon: Target,
                              title: "A goal is savings with a name",
                              description:
                                  "For example: a new laptop, or a trip. You set the target amount and top it up over time.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "Optional — only for saving toward something",
                                  },
                                  {
                                      icon: Check,
                                      label: "Add a deadline to track your pace",
                                  },
                              ],
                          },
                          {
                              icon: PiggyBank,
                              title: "Deposits come out of a wallet",
                              description:
                                  "Each deposit moves money from a wallet into the goal, so your wallet balance always shows what is still spendable.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "Whatever you deposit is set aside",
                                  },
                                  {
                                      icon: Check,
                                      label: "You can withdraw back to the wallet if needed",
                                  },
                              ],
                          },
                      ],
                  },

        analytics: (isVietnamese) =>
            isVietnamese
                ? {
                      eyebrow: "Phân tích",
                      title: "Đọc lại thói quen chi tiêu",
                      description: "Hướng dẫn nhanh cho lần đầu vào mục này",
                      actionLabel: "Bắt đầu xem",
                      slides: [
                          {
                              icon: BarChart3,
                              title: "Phân tích dựa trên giao dịch bạn đã ghi",
                              description:
                                  "Càng ghi đều thì biểu đồ càng nói đúng. Với vài giao dịch đầu tiên, các con số ở đây còn ít ý nghĩa.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "Nên có ít nhất 10 giao dịch để thấy xu hướng",
                                  },
                                  {
                                      icon: Check,
                                      label: "Khoản đã lên lịch chưa được tính vào báo cáo",
                                  },
                              ],
                          },
                          {
                              icon: LineChart,
                              title: "Ba câu hỏi trang này trả lời",
                              description:
                                  "Tiền đi đâu nhiều nhất, tháng này so với tháng trước ra sao, và nhóm chi nào đang phình lên.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "Cơ cấu chi theo danh mục",
                                  },
                                  {
                                      icon: Check,
                                      label: "Thu chi theo từng tháng",
                                  },
                                  {
                                      icon: Check,
                                      label: "So sánh với kỳ trước",
                                  },
                              ],
                          },
                      ],
                  }
                : {
                      eyebrow: "Analytics",
                      title: "Read back your spending habits",
                      description: "A quick tour for your first visit",
                      actionLabel: "Start exploring",
                      slides: [
                          {
                              icon: BarChart3,
                              title: "Analytics is built from what you record",
                              description:
                                  "The more consistently you log, the more the charts mean. With only a few transactions the numbers here say little.",
                              bullets: [
                                  {
                                      icon: Check,
                                      label: "Around ten transactions before trends appear",
                                  },
                                  {
                                      icon: Check,
                                      label: "Scheduled entries are not counted yet",
                                  },
                              ],
                          },
                          {
                              icon: LineChart,
                              title: "Three questions this page answers",
                              description:
                                  "Where most of the money goes, how this month compares to the last, and which category is growing.",
                              bullets: [
                                  { icon: Check, label: "Spending split by category" },
                                  { icon: Check, label: "Income and expense per month" },
                                  { icon: Check, label: "Comparison with the previous period" },
                              ],
                          },
                      ],
                  },
    };

export const getFeatureGuideCopy = (
    feature: GuideFeature,
    isVietnamese: boolean,
) => content[feature](isVietnamese);
