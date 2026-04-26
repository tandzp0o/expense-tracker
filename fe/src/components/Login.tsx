import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { getAppearanceGradientColors, useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { hexToRgba } from "../lib/utils";
import { Spinner } from "./ui/spinner";
import AuthShell from "./auth/AuthShell";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
    ) {
        return (error as { message: string }).message;
    }

    return "";
};

const getErrorCode = (error: unknown) => {
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
    ) {
        return (error as { code: string }).code;
    }

    return "";
};

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { signInWithCredentials, signInWithGoogle, loading } = useAuth();
    const { isVietnamese } = useLocale();
    const { appearance } = useTheme();
    const { toast } = useToast();
    const [formValues, setFormValues] = useState({
        email: "",
        password: "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const copy = useMemo(
        () =>
            isVietnamese
                ? {
                      tagline: "Digital Atelier of Wealth",
                      title: "Dang nhap vao FinTrack",
                      description:
                          "Dang nhap bang email va mat khau, hoac tiep tuc voi Google neu ban da quen thuoc.",
                      email: "Email dang nhap",
                      emailPlaceholder: "you@example.com",
                      emailHint:
                          "Ten hien thi trong ho so khong duoc dung de dang nhap.",
                      password: "Mat khau",
                      passwordPlaceholder: "Nhap mat khau cua ban",
                      forgotPassword: "Quen mat khau?",
                      login: "Dang nhap",
                      divider: "Hoac",
                      continueWithGoogle: "Tiep tuc voi Google",
                      signingIn: "Dang dang nhap...",
                      googleHelper:
                          "Tai khoan Google van duoc ho tro song song trong phien ban nay.",
                      bottomNote: "Chua co tai khoan?",
                      bottomAction: "Dang ky",
                      footerRights: `© ${new Date().getFullYear()} FinTrack Digital Atelier. All rights reserved.`,
                      footerLinks: [
                          "Chinh sach",
                          "Dieu khoan",
                          "Bao mat",
                          "Lien he",
                      ],
                      forgotTitle: "Dat lai mat khau",
                      forgotDescription:
                          "Neu day la tai khoan Google, hay dung nut Google. Neu la tai khoan mat khau, hien tai ban can dat lai mat khau trong Firebase Console hoac luong quan tri.",
                      loginErrorTitle: "Dang nhap that bai",
                      missingCredentials:
                          "Vui long nhap day du email va mat khau.",
                      invalidEmail: "Vui long nhap email hop le.",
                      accountNotRegistered:
                          "Tai khoan nay chua duoc dang ky. Vui long dang ky truoc.",
                      invalidCredentials:
                          "Email hoac mat khau khong dung.",
                      googleOnlyAccount:
                          "Tai khoan nay dang dung Google. Hay chon dang nhap voi Google.",
                      tooManyRequests:
                          "Ban thu sai qua nhieu lan. Vui long thu lai sau it phut.",
                      genericLoginError:
                          "Khong the dang nhap. Vui long kiem tra thong tin va thu lai.",
                      googleError:
                          "Khong the xac thuc voi Google. Vui long thu lai.",
                      infoTitle: "Thong tin dang cap nhat",
                      infoDescription:
                          "Muc nay chua co hanh dong rieng trong giao dien hien tai.",
                  }
                : {
                      tagline: "Digital Atelier of Wealth",
                      title: "Sign in to FinTrack",
                      description:
                          "Sign in with your email and password, or continue with Google if you already use it.",
                      email: "Sign-in email",
                      emailPlaceholder: "you@example.com",
                      emailHint:
                          "Your profile display name is not used for sign-in.",
                      password: "Password",
                      passwordPlaceholder: "Enter your password",
                      forgotPassword: "Forgot password?",
                      login: "Login",
                      divider: "Or",
                      continueWithGoogle: "Continue with Google",
                      signingIn: "Signing in...",
                      googleHelper:
                          "Google accounts still work alongside password-based accounts.",
                      bottomNote: "Need an account?",
                      bottomAction: "Register",
                      footerRights: `© ${new Date().getFullYear()} FinTrack Digital Atelier. All rights reserved.`,
                      footerLinks: [
                          "Privacy",
                          "Terms",
                          "Security",
                          "Contact",
                      ],
                      forgotTitle: "Reset password",
                      forgotDescription:
                          "If this is a Google account, use Google sign-in. For password accounts, reset currently needs to be handled in Firebase Console or your admin flow.",
                      loginErrorTitle: "Sign in failed",
                      missingCredentials:
                          "Please enter both your email and your password.",
                      invalidEmail: "Please enter a valid email address.",
                      accountNotRegistered:
                          "This account is not registered yet. Please sign up first.",
                      invalidCredentials:
                          "Your email or password is incorrect.",
                      googleOnlyAccount:
                          "This account uses Google sign-in. Please continue with Google.",
                      tooManyRequests:
                          "Too many failed attempts. Please try again in a few minutes.",
                      genericLoginError:
                          "Could not sign in. Please check your credentials and try again.",
                      googleError:
                          "Could not authenticate with Google. Please try again.",
                      infoTitle: "Information pending",
                      infoDescription:
                          "This action does not have a dedicated screen yet.",
                  },
        [isVietnamese],
    );

    const themeColors = getAppearanceGradientColors(appearance);
    const primaryBorder = hexToRgba(themeColors.primary, 0.28);
    const buttonGradient = `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 52%, rgba(5, 12, 28, 0.96) 100%)`;
    const isBusy = submitting || googleLoading || loading;

    const getLoginErrorDescription = (error: unknown) => {
        const code = getErrorCode(error);
        const message = getErrorMessage(error);
        const normalizedMessage = message.toLowerCase();

        if (
            normalizedMessage.includes("account not found") ||
            code === "auth/user-not-found"
        ) {
            return copy.accountNotRegistered;
        }

        if (
            normalizedMessage.includes("uses google sign-in") ||
            normalizedMessage.includes("continue with google")
        ) {
            return copy.googleOnlyAccount;
        }

        if (code === "auth/too-many-requests") {
            return copy.tooManyRequests;
        }

        if (
            code === "auth/wrong-password" ||
            code === "auth/invalid-credential" ||
            code === "auth/invalid-login-credentials"
        ) {
            return copy.invalidCredentials;
        }

        return message || copy.genericLoginError;
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const email = formValues.email.trim().toLowerCase();

        if (!email || !formValues.password) {
            toast({
                title: copy.loginErrorTitle,
                description: copy.missingCredentials,
                variant: "destructive",
            });
            return;
        }

        if (!EMAIL_PATTERN.test(email)) {
            toast({
                title: copy.loginErrorTitle,
                description: copy.invalidEmail,
                variant: "destructive",
            });
            return;
        }

        setSubmitting(true);
        try {
            await signInWithCredentials(email, formValues.password);
        } catch (error) {
            toast({
                title: copy.loginErrorTitle,
                description: getLoginErrorDescription(error),
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
            console.error("Google sign-in failed:", error);
            toast({
                title: copy.loginErrorTitle,
                description: copy.googleError,
                variant: "destructive",
            });
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleForgotPassword = () => {
        toast({
            title: copy.forgotTitle,
            description: copy.forgotDescription,
        });
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
            onBottomAction={() => navigate("/register")}
            onFooterAction={handleFooterAction}
            tagline={copy.tagline}
            title={copy.title}
        >
            <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-2">
                    <label className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-300/85">
                        {copy.email}
                    </label>
                    <div className="group relative">
                        <input
                            autoCapitalize="none"
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
                    <p className="px-1 text-xs text-slate-400">{copy.emailHint}</p>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 px-1">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-300/85">
                            {copy.password}
                        </label>
                        <button
                            className="text-[11px] uppercase tracking-wider transition-colors"
                            onClick={handleForgotPassword}
                            style={{ color: appearance.primaryColor }}
                            type="button"
                        >
                            {copy.forgotPassword}
                        </button>
                    </div>
                    <div className="group relative">
                        <input
                            autoComplete="current-password"
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
                    {submitting ? copy.signingIn : copy.login}
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
                        ? copy.signingIn
                        : copy.continueWithGoogle}
                </span>
            </button>

            <p className="mt-3 text-center text-xs text-slate-400">
                {copy.googleHelper}
            </p>
        </AuthShell>
    );
};

export default Login;
