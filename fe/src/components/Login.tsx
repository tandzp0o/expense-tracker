import React, { useState } from "react";
import { ArrowRight, ChartColumnBig, ShieldCheck, WalletCards } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { useToast } from "../contexts/ToastContext";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Spinner } from "./ui/spinner";

const Login: React.FC = () => {
    const { signInWithGoogle, loading } = useAuth();
    const { isVietnamese } = useLocale();
    const { toast } = useToast();
    const [signingIn, setSigningIn] = useState(false);

    const handleGoogleSignIn = async () => {
        setSigningIn(true);
        try {
            await signInWithGoogle();
        } catch (error: any) {
            console.error("Google sign-in failed:", error);
            toast({
                title: isVietnamese ? "Đăng nhập thất bại" : "Sign in failed",
                description: isVietnamese
                    ? "Không thể xác thực với Google. Vui lòng thử lại."
                    : "Could not authenticate with Google. Please try again.",
                variant: "destructive",
            });
        } finally {
            setSigningIn(false);
        }
    };

    const featureItems = isVietnamese
        ? [
              {
                  title: "Quản lý ví",
                  description:
                      "Theo dõi số dư giữa tiền mặt, ngân hàng và ví điện tử.",
              },
              {
                  title: "Kiểm soát ngân sách",
                  description:
                      "Theo dõi hạn mức chi tiêu và cảnh báo khi vượt ngưỡng.",
              },
              {
                  title: "Phân tích tài chính",
                  description:
                      "Xem xu hướng thu chi, cơ cấu danh mục và biến động gần đây.",
              },
          ]
        : [
              {
                  title: "Wallet tracking",
                  description:
                      "Manage balances across cash, bank and e-wallet accounts.",
              },
              {
                  title: "Budget controls",
                  description:
                      "Watch spend limits and highlight overspending quickly.",
              },
              {
                  title: "Analytics",
                  description:
                      "Review trends, category mix and recent cashflow changes.",
              },
          ];

    return (
        <div className="relative min-h-screen overflow-hidden bg-background px-4 py-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--app-primary-soft-strong),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.12),transparent_22%)]" />
            <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr,0.9fr]">
                <div className="space-y-6">
                    <p className="inline-flex rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
                        {isVietnamese
                            ? "Không gian tài chính theo pattern shadcn"
                            : "Shadcn-style finance workspace"}
                    </p>
                    <div className="space-y-4">
                        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                            {isVietnamese
                                ? "FinTrack giữ giao diện bám sát dữ liệu thật và đúng các chức năng mà hệ thống đang hỗ trợ."
                                : "FinTrack keeps the interface aligned with the real data and actions your app supports."}
                        </h1>
                        <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
                            {isVietnamese
                                ? "Đăng nhập bằng Google để truy cập ví, giao dịch, ngân sách, mục tiêu, phân tích, món ăn và các thiết lập cá nhân."
                                : "Sign in with Google to access wallets, transactions, budgets, goals, analytics, dishes and personal settings."}
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                        {[WalletCards, ShieldCheck, ChartColumnBig].map((Icon, index) => {
                            const item = featureItems[index];
                            return (
                                <Card key={item.title} className="glass-panel">
                                    <CardContent className="p-5">
                                        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-[var(--app-radius-lg)] bg-primary-soft text-primary">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-base font-semibold">{item.title}</h3>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {item.description}
                                        </p>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                <Card className="glass-panel border-border/80 shadow-soft">
                    <CardContent className="p-8">
                        <div className="space-y-3">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
                                {isVietnamese ? "Xác thực" : "Authentication"}
                            </p>
                            <h2 className="text-2xl font-semibold">
                                {isVietnamese
                                    ? "Tiếp tục với Google"
                                    : "Continue with Google"}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {isVietnamese
                                    ? "Luồng xác thực hiện tại dùng Google. Ứng dụng không hiển thị tài khoản hoặc mật khẩu nội bộ vì backend không sử dụng chúng."
                                    : "The current auth flow is Google-based. No local username or password fields are shown because the backend does not use them."}
                            </p>
                        </div>

                        <Button
                            className="mt-8 h-12 w-full justify-between rounded-[var(--app-radius-lg)] px-5"
                            disabled={signingIn || loading}
                            onClick={handleGoogleSignIn}
                        >
                            <div className="flex items-center gap-3">
                                {signingIn || loading ? (
                                    <Spinner className="h-4 w-4 border-white/30 border-t-white" />
                                ) : (
                                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.03 5.03 0 0 1-2.18 3.3l3.54 2.75c2.06-1.9 3.28-4.7 3.28-8.06Z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.54-2.75c-.98.66-2.23 1.05-3.74 1.05-2.87 0-5.3-1.93-6.17-4.53l-3.65 2.82A10.99 10.99 0 0 0 12 23Z" fill="#34A853" />
                                        <path d="M5.83 14.12a6.6 6.6 0 0 1 0-4.24l-3.65-2.82a11.03 11.03 0 0 0 0 9.88l3.65-2.82Z" fill="#FBBC05" />
                                        <path d="M12 5.35c1.62 0 3.07.56 4.21 1.66l3.15-3.15A10.92 10.92 0 0 0 12 1a11 11 0 0 0-9.82 6.06l3.65 2.82C6.7 7.28 9.13 5.35 12 5.35Z" fill="#EA4335" />
                                    </svg>
                                )}
                                <span>
                                    {signingIn || loading
                                        ? isVietnamese
                                            ? "Đang đăng nhập..."
                                            : "Signing in..."
                                        : isVietnamese
                                          ? "Tiếp tục với Google"
                                          : "Continue with Google"}
                                </span>
                            </div>
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Login;
