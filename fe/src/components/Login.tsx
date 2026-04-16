import React, { useState } from "react";
import { App } from "antd";
import { useAuth } from "../contexts/AuthContext";

const Login: React.FC = () => {
    const { message } = App.useApp();
    const { signInWithGoogle, loading } = useAuth();
    const [signingIn, setSigningIn] = useState(false);

    const handleGoogleSignIn = async () => {
        setSigningIn(true);
        try {
            await signInWithGoogle();
        } catch (error) {
            console.error("Lỗi chi tiết khi đăng nhập:", error);
            message.error("Đăng nhập thất bại. Vui lòng thử lại.");
        } finally {
            setSigningIn(false);
        }
    };

    return (
        <div className="bg-surface font-body text-on-surface selection:bg-primary selection:text-on-primary min-h-screen flex flex-col overflow-hidden">

            {/* Artistic Background Layers */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-surface"></div>
                <div className="absolute inset-0 ledger-texture"></div>
                <div className="absolute inset-0 silk-texture"></div>

                {/* Decorative Silk Path */}
                <svg
                    className="absolute top-0 right-0 w-full h-full opacity-20"
                    preserveAspectRatio="none"
                    viewBox="0 0 1000 1000"
                >
                    <defs>
                        <linearGradient id="silk-gradient-svg" x1="0%" x2="100%" y1="0%" y2="100%">
                            <stop offset="0%"   style={{ stopColor: "#4137cd", stopOpacity: 0.2 }} />
                            <stop offset="100%" style={{ stopColor: "#c0c1ff", stopOpacity: 0 }} />
                        </linearGradient>
                    </defs>
                    <path
                        d="M0,500 C200,400 300,600 500,500 C700,400 800,600 1000,500 L1000,1000 L0,1000 Z"
                        fill="url(#silk-gradient-svg)"
                    />
                </svg>
            </div>

            {/* Main Content Container */}
            <main className="relative z-10 flex-grow flex items-center justify-center p-6">

                {/* Login Card */}
                <div className="w-full max-w-[480px] glass-panel border border-outline-variant/15 rounded-card p-10 shadow-2xl relative">

                    {/* Branding */}
                    <div className="mb-12 text-center">
                        <h1 className="text-3xl font-bold tracking-tighter text-primary font-headline">
                            FinTrack
                        </h1>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/60 mt-2 font-medium">
                            Digital Atelier of Wealth
                        </p>
                    </div>

                    {/* Login Header */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-semibold text-on-surface tracking-tight">
                            Welcome to the Ledger
                        </h2>
                        <p className="text-on-surface-variant text-sm mt-1">
                            Authenticate to access your private vault.
                        </p>
                    </div>

                    {/* Form */}
                    <form className="space-y-6">
                        {/* Vault ID */}
                        <div className="space-y-2">
                            <label className="text-[11px] uppercase tracking-wider text-on-surface-variant/80 font-semibold px-1">
                                Vault ID
                            </label>
                            <div className="relative group">
                                <input
                                    className="w-full bg-surface-container-highest/40 border-b border-outline-variant/30 text-on-surface placeholder:text-on-surface-variant/40 px-4 py-4 rounded-t-lg focus:outline-none focus:border-primary transition-colors duration-500 text-sm"
                                    placeholder="Enter your unique identifier"
                                    type="text"
                                />
                                <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-primary group-focus-within:w-full transition-all duration-700 ease-in-out" />
                            </div>
                        </div>

                        {/* Access Key */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[11px] uppercase tracking-wider text-on-surface-variant/80 font-semibold">
                                    Access Key
                                </label>
                                <a className="text-[11px] uppercase tracking-wider text-primary hover:text-white transition-colors" href="#">
                                    Forgot Key?
                                </a>
                            </div>
                            <div className="relative group">
                                <input
                                    className="w-full bg-surface-container-highest/40 border-b border-outline-variant/30 text-on-surface placeholder:text-on-surface-variant/40 px-4 py-4 rounded-t-lg focus:outline-none focus:border-primary transition-colors duration-500 text-sm"
                                    placeholder="••••••••••••"
                                    type="password"
                                />
                                <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-primary group-focus-within:w-full transition-all duration-700 ease-in-out" />
                            </div>
                        </div>

                        {/* Unlock Button */}
                        <button
                            className="w-full silk-gradient py-4 rounded-button text-white font-semibold text-sm tracking-wide shadow-lg transition-all duration-500 active:scale-[0.98]"
                            type="submit"
                        >
                            Unlock Vault
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-10 flex items-center">
                        <div className="flex-grow border-t border-outline-variant/10" />
                        <span className="px-4 text-[10px] uppercase tracking-widest text-on-surface-variant/40 font-medium">
                            Internal Gateway
                        </span>
                        <div className="flex-grow border-t border-outline-variant/10" />
                    </div>

                    {/* Google Sign In */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={signingIn || loading}
                        className="w-full flex items-center justify-center gap-3 bg-surface-container-low border border-outline-variant/15 py-4 rounded-button text-on-surface text-sm font-medium hover:bg-surface-container-high transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="mr-1" height="18" viewBox="0 0 24 24" width="18">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 5.38-4.53z" fill="#EA4335" />
                        </svg>
                        {signingIn || loading ? "Signing in..." : "Continue with Google"}
                    </button>

                    {/* Bottom Note */}
                    <div className="mt-10 text-center">
                        <p className="text-xs text-on-surface-variant">
                            New collector?{" "}
                            <a className="text-primary font-semibold ml-1" href="#">
                                Request Invitation
                            </a>
                        </p>
                    </div>
                </div>

                {/* Decorative 001 — outside card */}
                <div className="absolute bottom-12 right-12 hidden xl:block pointer-events-none">
                    <div className="text-[120px] font-bold text-outline-variant/5 leading-none select-none">
                        001
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 w-full py-12 flex flex-col md:flex-row justify-between items-center px-12 space-y-4 md:space-y-0 border-t border-outline-variant/15">
                <div className="text-[10px] uppercase tracking-[0.05em] font-medium text-on-surface-variant/60">
                    © 2024 FinTrack Digital Atelier. All rights reserved.
                </div>
                <div className="flex space-x-8">
                    {["Privacy Policy", "Terms of Service", "Security", "Contact"].map((item) => (
                        <a
                            key={item}
                            className="text-[10px] uppercase tracking-[0.05em] font-medium text-on-surface-variant/60 hover:text-primary transition-all duration-500"
                            href="#"
                        >
                            {item}
                        </a>
                    ))}
                </div>
            </footer>
        </div>
    );
};

export default Login;
