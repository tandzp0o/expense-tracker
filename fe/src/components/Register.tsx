import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { hexToRgba } from "../lib/utils";
import { Spinner } from "./ui/spinner";
import AuthShell from "./auth/AuthShell";

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/;

const Register: React.FC = () => {
    const navigate = useNavigate();
    const { loading, registerWithEmail, signInWithGoogle } = useAuth();
    const { isVietnamese } = useLocale();
    const { appearance } = useTheme();
    const { toast } = useToast();
    const [formValues, setFormValues] = useState({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const copy = useMemo(
        () =>
            isVietnamese
                ? {
                      tagline: "Digital Atelier of Wealth",
                      title: "Tạo tài khoản mới",
                      description:
                          "Chọn username để đăng nhập như tandzp0o, sau đó bạn có thể bổ sung tên hiển thị và thông tin cá nhân trong hồ sơ.",
                      username: "Username",
                      usernamePlaceholder: "ví dụ: tandzp0o",
                      usernameHint:
                          "Dùng 3-30 ký tự gồm chữ cái, số, dấu chấm, gạch dưới hoặc gạch ngang.",
                      email: "Email",
                      emailPlaceholder: "you@example.com",
                      password: "Mật khẩu",
                      passwordPlaceholder: "Tối thiểu 6 ký tự",
                      confirmPassword: "Nhập lại mật khẩu",
                      confirmPasswordPlaceholder: "Nhập lại mật khẩu",
                      register: "Đăng ký",
                      registering: "Đang tạo tài khoản...",
                      divider: "Hoặc",
                      continueWithGoogle: "Đăng ký với Google",
                      googleHelper:
                          "Nếu bạn muốn, bạn vẫn có thể bắt đầu nhanh bằng Google.",
                      bottomNote: "Đã có tài khoản?",
                      bottomAction: "Đăng nhập",
                      footerRights: `© ${new Date().getFullYear()} FinTrack Digital Atelier. All rights reserved.`,
                      footerLinks: [
                          "Chính sách",
                          "Điều khoản",
                          "Bảo mật",
                          "Liên hệ",
                      ],
                      registerErrorTitle: "Đăng ký thất bại",
                      registerSuccessTitle: "Tạo tài khoản thành công",
                      registerSuccessDescription:
                          "Tài khoản đã sẵn sàng. Bạn sẽ được chuyển vào ứng dụng.",
                      googleError: "Không thể xác thực với Google. Vui lòng thử lại.",
                      infoTitle: "Thông tin đang cập nhật",
                      infoDescription:
                          "Mục này chưa có hành động riêng trong giao diện hiện tại.",
                  }
                : {
                      tagline: "Digital Atelier of Wealth",
                      title: "Create a new account",
                      description:
                          "Choose a username such as tandzp0o for sign-in, then complete your display name and profile details later.",
                      username: "Username",
                      usernamePlaceholder: "for example: tandzp0o",
                      usernameHint:
                          "Use 3-30 characters with letters, numbers, dot, underscore, or hyphen.",
                      email: "Email",
                      emailPlaceholder: "you@example.com",
                      password: "Password",
                      passwordPlaceholder: "At least 6 characters",
                      confirmPassword: "Confirm password",
                      confirmPasswordPlaceholder: "Enter password again",
                      register: "Register",
                      registering: "Creating account...",
                      divider: "Or",
                      continueWithGoogle: "Register with Google",
                      googleHelper:
                          "You can still start with Google if that is easier for you.",
                      bottomNote: "Already have an account?",
                      bottomAction: "Login",
                      footerRights: `© ${new Date().getFullYear()} FinTrack Digital Atelier. All rights reserved.`,
                      footerLinks: [
                          "Privacy",
                          "Terms",
                          "Security",
                          "Contact",
                      ],
                      registerErrorTitle: "Registration failed",
                      registerSuccessTitle: "Account created",
                      registerSuccessDescription:
                          "Your account is ready. We will take you into the app.",
                      googleError:
                          "Could not authenticate with Google. Please try again.",
                      infoTitle: "Information pending",
                      infoDescription:
                          "This action does not have a dedicated screen yet.",
                  },
        [isVietnamese],
    );

    const primaryBorder = hexToRgba(appearance.primaryColor, 0.28);
    const buttonGradient = `linear-gradient(135deg, ${appearance.primaryColor} 0%, rgba(5, 12, 28, 0.96) 100%)`;
    const isBusy = submitting || googleLoading || loading;

    const validateForm = () => {
        const username = formValues.username.trim().toLowerCase();
        const email = formValues.email.trim();

        if (!username || !email || !formValues.password || !formValues.confirmPassword) {
            return isVietnamese
                ? "Vui lòng nhập đầy đủ username, email và mật khẩu."
                : "Please fill in your username, email, and password.";
        }

        if (!USERNAME_PATTERN.test(username)) {
            return copy.usernameHint;
        }

        if (formValues.password.length < 6) {
            return isVietnamese
                ? "Mật khẩu phải có ít nhất 6 ký tự."
                : "Password must contain at least 6 characters.";
        }

        if (formValues.password !== formValues.confirmPassword) {
            return isVietnamese
                ? "Mật khẩu nhập lại không khớp."
                : "Password confirmation does not match.";
        }

        return null;
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const validationError = validateForm();
        if (validationError) {
            toast({
                title: copy.registerErrorTitle,
                description: validationError,
                variant: "destructive",
            });
            return;
        }

        setSubmitting(true);
        try {
            await registerWithEmail({
                email: formValues.email.trim(),
                password: formValues.password,
                username: formValues.username.trim().toLowerCase(),
            });

            toast({
                title: copy.registerSuccessTitle,
                description: copy.registerSuccessDescription,
                variant: "success",
            });
            navigate("/wallets", { replace: true });
        } catch (error: any) {
            toast({
                title: copy.registerErrorTitle,
                description:
                    error.message ||
                    (isVietnamese
                        ? "Không thể tạo tài khoản. Vui lòng thử lại."
                        : "Could not create your account. Please try again."),
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        try {
            await signInWithGoogle();
        } catch (error) {
            console.error("Google sign-up failed:", error);
            toast({
                title: copy.registerErrorTitle,
                description: copy.googleError,
                variant: "destructive",
            });
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleFooterAction = () => {
        toast({
            title: copy.infoTitle,
            description: copy.infoDescription,
        });
    };

    return (
        <AuthShell
            bottomActionLabel={copy.bottomAction}
            bottomNote={copy.bottomNote}
            description={copy.description}
            footerLinks={copy.footerLinks}
            footerRights={copy.footerRights}
            onBottomAction={() => navigate("/login")}
            onFooterAction={handleFooterAction}
            tagline={copy.tagline}
            title={copy.title}
        >
            <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-2">
                    <label className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-300/85">
                        {copy.username}
                    </label>
                    <div className="group relative">
                        <input
                            autoCapitalize="none"
                            autoComplete="username"
                            className="w-full rounded-t-xl border-b border-white/10 bg-white/[0.045] px-4 py-4 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                            onChange={(event) =>
                                setFormValues((current) => ({
                                    ...current,
                                    username: event.target.value.toLowerCase(),
                                }))
                            }
                            placeholder={copy.usernamePlaceholder}
                            type="text"
                            value={formValues.username}
                        />
                        <div
                            className="absolute bottom-0 left-0 h-[2px] w-0 transition-all duration-700 ease-in-out group-focus-within:w-full"
                            style={{ backgroundColor: appearance.primaryColor }}
                        />
                    </div>
                    <p className="px-1 text-xs text-slate-400">{copy.usernameHint}</p>
                </div>

                <div className="space-y-2">
                    <label className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-300/85">
                        {copy.email}
                    </label>
                    <div className="group relative">
                        <input
                            autoComplete="email"
                            className="w-full rounded-t-xl border-b border-white/10 bg-white/[0.045] px-4 py-4 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                            onChange={(event) =>
                                setFormValues((current) => ({
                                    ...current,
                                    email: event.target.value,
                                }))
                            }
                            placeholder={copy.emailPlaceholder}
                            type="email"
                            value={formValues.email}
                        />
                        <div
                            className="absolute bottom-0 left-0 h-[2px] w-0 transition-all duration-700 ease-in-out group-focus-within:w-full"
                            style={{ backgroundColor: appearance.primaryColor }}
                        />
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <label className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-300/85">
                            {copy.password}
                        </label>
                        <div className="group relative">
                            <input
                                autoComplete="new-password"
                                className="w-full rounded-t-xl border-b border-white/10 bg-white/[0.045] px-4 py-4 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                                onChange={(event) =>
                                    setFormValues((current) => ({
                                        ...current,
                                        password: event.target.value,
                                    }))
                                }
                                placeholder={copy.passwordPlaceholder}
                                type="password"
                                value={formValues.password}
                            />
                            <div
                                className="absolute bottom-0 left-0 h-[2px] w-0 transition-all duration-700 ease-in-out group-focus-within:w-full"
                                style={{ backgroundColor: appearance.primaryColor }}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-300/85">
                            {copy.confirmPassword}
                        </label>
                        <div className="group relative">
                            <input
                                autoComplete="new-password"
                                className="w-full rounded-t-xl border-b border-white/10 bg-white/[0.045] px-4 py-4 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                                onChange={(event) =>
                                    setFormValues((current) => ({
                                        ...current,
                                        confirmPassword: event.target.value,
                                    }))
                                }
                                placeholder={copy.confirmPasswordPlaceholder}
                                type="password"
                                value={formValues.confirmPassword}
                            />
                            <div
                                className="absolute bottom-0 left-0 h-[2px] w-0 transition-all duration-700 ease-in-out group-focus-within:w-full"
                                style={{ backgroundColor: appearance.primaryColor }}
                            />
                        </div>
                    </div>
                </div>

                <button
                    className="w-full rounded-[18px] px-4 py-4 text-sm font-semibold tracking-wide text-white transition-all duration-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isBusy}
                    style={{
                        background: buttonGradient,
                        boxShadow: `0 20px 38px ${hexToRgba(
                            appearance.primaryColor,
                            0.22,
                        )}`,
                    }}
                    type="submit"
                >
                    {submitting ? copy.registering : copy.register}
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
                {googleLoading || loading ? (
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
                <span>
                    {googleLoading || loading
                        ? copy.registering
                        : copy.continueWithGoogle}
                </span>
            </button>

            <p className="mt-3 text-center text-xs text-slate-400">
                {copy.googleHelper}
            </p>
        </AuthShell>
    );
};

export default Register;
