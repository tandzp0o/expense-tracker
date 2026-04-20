import React, { useId, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { hexToRgba } from "../lib/utils";
import { Spinner } from "./ui/spinner";

const Login: React.FC = () => {
    const gradientId = useId().replace(/:/g, "-");
    const { signInWithGoogle, loading } = useAuth();
    const { isVietnamese } = useLocale();
    const { appearance } = useTheme();
    const { toast } = useToast();
    const [signingIn, setSigningIn] = useState(false);

    const copy = isVietnamese
        ? {
              tagline: "Digital Atelier of Wealth",
              title: "Chào mừng đến kho dữ liệu tài chính",
              description: "Xác thực để truy cập không gian quản lý ví và dòng tiền riêng của bạn.",
              vaultId: "Mã kho dữ liệu",
              vaultPlaceholder: "Nhập định danh của bạn",
              accessKey: "Khóa truy cập",
              accessKeyPlaceholder: "••••••••••••",
              forgotKey: "Quên khóa?",
              unlockVault: "Mở kho dữ liệu",
              divider: "Cổng nội bộ",
              continueWithGoogle: "Tiếp tục với Google",
              signingIn: "Đang đăng nhập...",
              bottomNote: "Người dùng mới?",
              requestInvitation: "Yêu cầu lời mời",
              footerRights: `© ${new Date().getFullYear()} FinTrack Digital Atelier. All rights reserved.`,
              footerLinks: [
                  "Chính sách riêng tư",
                  "Điều khoản dịch vụ",
                  "Bảo mật",
                  "Liên hệ",
              ],
              googleOnlyHintTitle: "Luồng hiện tại dùng Google",
              googleOnlyHintDescription:
                  "Bản build này vẫn xác thực bằng Google. Hãy dùng nút Google ở bên dưới để đăng nhập.",
              inviteHintTitle: "Lời mời sẽ được cập nhật",
              inviteHintDescription:
                  "Nếu cần cấp quyền truy cập mới, hãy dùng luồng quản trị hoặc liên hệ người phụ trách hệ thống.",
              forgotHintTitle: "Khóa truy cập nội bộ chưa bật",
              forgotHintDescription:
                  "Đăng nhập bằng tài khoản Google vẫn là cách truy cập chính của ứng dụng hiện tại.",
              googleHelper:
                  "Google vẫn là cổng đăng nhập hoạt động trong phiên bản này.",
          }
        : {
              tagline: "Digital Atelier of Wealth",
              title: "Welcome to the Ledger",
              description: "Authenticate to access your private vault and finance workspace.",
              vaultId: "Vault ID",
              vaultPlaceholder: "Enter your unique identifier",
              accessKey: "Access Key",
              accessKeyPlaceholder: "••••••••••••",
              forgotKey: "Forgot Key?",
              unlockVault: "Unlock Vault",
              divider: "Internal Gateway",
              continueWithGoogle: "Continue with Google",
              signingIn: "Signing in...",
              bottomNote: "New collector?",
              requestInvitation: "Request Invitation",
              footerRights: `© ${new Date().getFullYear()} FinTrack Digital Atelier. All rights reserved.`,
              footerLinks: [
                  "Privacy Policy",
                  "Terms of Service",
                  "Security",
                  "Contact",
              ],
              googleOnlyHintTitle: "Google remains the live gateway",
              googleOnlyHintDescription:
                  "This build still authenticates with Google. Use the Google button below to sign in.",
              inviteHintTitle: "Invitations are not self-service yet",
              inviteHintDescription:
                  "If you need a new account, please use your admin flow or contact the system owner.",
              forgotHintTitle: "Internal access keys are not enabled",
              forgotHintDescription:
                  "Google sign-in remains the active entry point for the current app.",
              googleHelper:
                  "Google is still the active sign-in gateway in this version.",
          };

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

    const handleLegacySubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        toast({
            title: copy.googleOnlyHintTitle,
            description: copy.googleOnlyHintDescription,
        });
    };

    const handleForgotKey = () => {
        toast({
            title: copy.forgotHintTitle,
            description: copy.forgotHintDescription,
        });
    };

    const handleRequestInvitation = () => {
        toast({
            title: copy.inviteHintTitle,
            description: copy.inviteHintDescription,
        });
    };

    const isBusy = signingIn || loading;
    const primaryGlow = hexToRgba(appearance.primaryColor, 0.18);
    const primaryGlowStrong = hexToRgba(appearance.primaryColor, 0.34);
    const primaryBorder = hexToRgba(appearance.primaryColor, 0.28);
    const buttonGradient = `linear-gradient(135deg, ${appearance.primaryColor} 0%, rgba(5, 12, 28, 0.96) 100%)`;

    return (
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#08101f] text-slate-100">
            <div className="pointer-events-none fixed inset-0 z-0">
                <div className="absolute inset-0 bg-[#08101f]" />
                <div
                    className="absolute inset-0 opacity-40"
                    style={{
                        backgroundImage: `
                            radial-gradient(circle at 16% 18%, rgba(255,255,255,0.07), transparent 20%),
                            repeating-linear-gradient(0deg, rgba(148,163,184,0.08) 0 1px, transparent 1px 34px),
                            repeating-linear-gradient(90deg, rgba(148,163,184,0.06) 0 1px, transparent 1px 86px)
                        `,
                        mixBlendMode: "screen",
                    }}
                />
                <div
                    className="absolute inset-0"
                    style={{
                        background: `
                            radial-gradient(circle at top left, ${primaryGlowStrong}, transparent 24%),
                            radial-gradient(circle at 82% 16%, rgba(192,193,255,0.08), transparent 20%),
                            linear-gradient(225deg, transparent 0%, ${primaryGlow} 48%, transparent 100%)
                        `,
                    }}
                />
                <svg
                    className="absolute right-0 top-0 h-full w-full opacity-25"
                    preserveAspectRatio="none"
                    viewBox="0 0 1000 1000"
                >
                    <defs>
                        <linearGradient
                            id={`${gradientId}-silk-gradient`}
                            x1="0%"
                            x2="100%"
                            y1="0%"
                            y2="100%"
                        >
                            <stop
                                offset="0%"
                                style={{
                                    stopColor: appearance.primaryColor,
                                    stopOpacity: 0.22,
                                }}
                            />
                            <stop
                                offset="100%"
                                style={{
                                    stopColor: "#c0c1ff",
                                    stopOpacity: 0,
                                }}
                            />
                        </linearGradient>
                    </defs>
                    <path
                        d="M0,500 C200,400 300,600 500,500 C700,400 800,600 1000,500 L1000,1000 L0,1000 Z"
                        fill={`url(#${gradientId}-silk-gradient)`}
                    />
                </svg>
            </div>

            <main className="relative z-10 flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-10">
                <div className="relative w-full max-w-[480px]">
                    <div
                        className="glass-panel relative overflow-hidden rounded-[28px] border px-6 py-8 shadow-[0_30px_80px_rgba(2,6,23,0.45)] sm:px-10 sm:py-10"
                        style={{
                            borderColor: "rgba(255,255,255,0.12)",
                            background:
                                "linear-gradient(180deg, rgba(15,23,42,0.78), rgba(8,16,31,0.9))",
                        }}
                    >
                        <div
                            className="pointer-events-none absolute inset-x-0 top-0 h-28"
                            style={{
                                background: `linear-gradient(180deg, ${hexToRgba(
                                    appearance.primaryColor,
                                    0.12,
                                )} 0%, transparent 100%)`,
                            }}
                        />

                        <div className="relative z-10">
                            <div className="mb-10 text-center sm:mb-12">
                                <h1
                                    className="text-3xl font-bold tracking-[-0.04em] sm:text-[2rem]"
                                    style={{ color: appearance.primaryColor }}
                                >
                                    FinTrack
                                </h1>
                                <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
                                    {copy.tagline}
                                </p>
                            </div>

                            <div className="mb-8">
                                <h2 className="text-2xl font-semibold tracking-tight text-white">
                                    {copy.title}
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-slate-300">
                                    {copy.description}
                                </p>
                            </div>

                            <form className="space-y-6" onSubmit={handleLegacySubmit}>
                                <div className="space-y-2">
                                    <label className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-300/85">
                                        {copy.vaultId}
                                    </label>
                                    <div className="group relative">
                                        <input
                                            className="w-full rounded-t-xl border-b border-white/10 bg-white/[0.045] px-4 py-4 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                                            placeholder={copy.vaultPlaceholder}
                                            type="text"
                                        />
                                        <div
                                            className="absolute bottom-0 left-0 h-[2px] w-0 transition-all duration-700 ease-in-out group-focus-within:w-full"
                                            style={{ backgroundColor: appearance.primaryColor }}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-3 px-1">
                                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-300/85">
                                            {copy.accessKey}
                                        </label>
                                        <button
                                            className="text-[11px] uppercase tracking-wider transition-colors"
                                            onClick={handleForgotKey}
                                            style={{ color: appearance.primaryColor }}
                                            type="button"
                                        >
                                            {copy.forgotKey}
                                        </button>
                                    </div>
                                    <div className="group relative">
                                        <input
                                            className="w-full rounded-t-xl border-b border-white/10 bg-white/[0.045] px-4 py-4 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                                            placeholder={copy.accessKeyPlaceholder}
                                            type="password"
                                        />
                                        <div
                                            className="absolute bottom-0 left-0 h-[2px] w-0 transition-all duration-700 ease-in-out group-focus-within:w-full"
                                            style={{ backgroundColor: appearance.primaryColor }}
                                        />
                                    </div>
                                </div>

                                <button
                                    className="w-full rounded-[18px] px-4 py-4 text-sm font-semibold tracking-wide text-white transition-all duration-500 active:scale-[0.98]"
                                    style={{
                                        background: buttonGradient,
                                        boxShadow: `0 20px 38px ${hexToRgba(
                                            appearance.primaryColor,
                                            0.22,
                                        )}`,
                                    }}
                                    type="submit"
                                >
                                    {copy.unlockVault}
                                </button>
                            </form>

                            <div className="relative my-8 flex items-center sm:my-10">
                                <div className="flex-grow border-t border-white/10" />
                                <span className="px-4 text-[10px] font-medium uppercase tracking-[0.24em] text-slate-500">
                                    {copy.divider}
                                </span>
                                <div className="flex-grow border-t border-white/10" />
                            </div>

                            <button
                                className="flex w-full items-center justify-center gap-3 rounded-[18px] border px-4 py-4 text-sm font-medium text-white transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-55"
                                disabled={isBusy}
                                onClick={handleGoogleSignIn}
                                style={{
                                    background: "rgba(255,255,255,0.05)",
                                    borderColor: primaryBorder,
                                }}
                                type="button"
                            >
                                {isBusy ? (
                                    <Spinner className="h-4 w-4 border-white/30 border-t-white" />
                                ) : (
                                    <svg className="mr-1" height="18" viewBox="0 0 24 24" width="18">
                                        <path
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            fill="#4285F4"
                                        />
                                        <path
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            fill="#34A853"
                                        />
                                        <path
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                                            fill="#FBBC05"
                                        />
                                        <path
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 5.38-4.53z"
                                            fill="#EA4335"
                                        />
                                    </svg>
                                )}
                                <span>{isBusy ? copy.signingIn : copy.continueWithGoogle}</span>
                            </button>

                            <p className="mt-3 text-center text-xs text-slate-400">
                                {copy.googleHelper}
                            </p>

                            <div className="mt-8 text-center sm:mt-10">
                                <p className="text-xs text-slate-400">
                                    {copy.bottomNote}
                                    <button
                                        className="ml-1 font-semibold"
                                        onClick={handleRequestInvitation}
                                        style={{ color: appearance.primaryColor }}
                                        type="button"
                                    >
                                        {copy.requestInvitation}
                                    </button>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="pointer-events-none absolute -bottom-8 -right-[300px] hidden xl:block">
                        <div className="select-none text-[120px] font-bold leading-none text-white/[0.04]">
                            001
                        </div>
                    </div>
                </div>
            </main>

            <footer className="relative z-10 border-t border-white/10 px-6 py-8 sm:px-10 sm:py-10">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
                    <div className="text-center text-[10px] font-medium uppercase tracking-[0.05em] text-slate-500 md:text-left">
                        {copy.footerRights}
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                        {copy.footerLinks.map((item) => (
                            <button
                                key={item}
                                className="text-[10px] font-medium uppercase tracking-[0.05em] text-slate-500 transition-colors"
                                onClick={handleRequestInvitation}
                                style={{
                                    color: item === copy.requestInvitation ? appearance.primaryColor : undefined,
                                }}
                                type="button"
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Login;
