import React, { ReactNode, useId } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { hexToRgba } from "../../lib/utils";

type AuthShellProps = {
    tagline: string;
    title: string;
    description: string;
    footerRights: string;
    footerLinks: string[];
    bottomNote: string;
    bottomActionLabel: string;
    onBottomAction: () => void;
    onFooterAction: () => void;
    children: ReactNode;
};

const AuthShell: React.FC<AuthShellProps> = ({
    tagline,
    title,
    description,
    footerRights,
    footerLinks,
    bottomNote,
    bottomActionLabel,
    onBottomAction,
    onFooterAction,
    children,
}) => {
    const gradientId = useId().replace(/:/g, "-");
    const { appearance } = useTheme();
    const primaryGlow = hexToRgba(appearance.primaryColor, 0.18);
    const primaryGlowStrong = hexToRgba(appearance.primaryColor, 0.34);

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
                                    {tagline}
                                </p>
                            </div>

                            <div className="mb-8">
                                <h2 className="text-2xl font-semibold tracking-tight text-white">
                                    {title}
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-slate-300">
                                    {description}
                                </p>
                            </div>

                            {children}

                            <div className="mt-8 text-center sm:mt-10">
                                <p className="text-xs text-slate-400">
                                    {bottomNote}
                                    <button
                                        className="ml-1 font-semibold"
                                        onClick={onBottomAction}
                                        style={{ color: appearance.primaryColor }}
                                        type="button"
                                    >
                                        {bottomActionLabel}
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
                        {footerRights}
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                        {footerLinks.map((item) => (
                            <button
                                key={item}
                                className="text-[10px] font-medium uppercase tracking-[0.05em] text-slate-500 transition-colors"
                                onClick={onFooterAction}
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

export default AuthShell;
