import React from "react";
import { cn } from "../../lib/utils";

interface QuestRingProps {
    /** 0 - 100. */
    percent: number;
    /** Shown in the small badge; hidden when omitted. */
    level?: number;
    className?: string;
    children: React.ReactNode;
}

/**
 * Experience-style progress ring drawn around the avatar. The ring itself is a
 * conic gradient so it needs no SVG and animates with a single CSS transition.
 */
export const QuestRing: React.FC<QuestRingProps> = ({
    percent,
    level,
    className,
    children,
}) => {
    const safePercent = Math.max(0, Math.min(100, percent));
    const complete = safePercent >= 100;

    return (
        <div className={cn("relative shrink-0", className)}>
            <div
                className="rounded-full p-[2.5px] transition-[background] duration-500"
                style={{
                    background: `conic-gradient(${
                        complete ? "#f59e0b" : "hsl(var(--primary))"
                    } ${safePercent * 3.6}deg, hsl(var(--muted)) 0deg)`,
                }}
            >
                <div className="rounded-full bg-background p-[2px]">
                    <div className="overflow-hidden rounded-full">
                        {children}
                    </div>
                </div>
            </div>
            {typeof level === "number" ? (
                <span
                    className={cn(
                        "pointer-events-none absolute -bottom-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background px-1 text-[10px] font-bold leading-none text-white shadow-sm",
                        complete ? "bg-amber-500" : "bg-primary",
                    )}
                >
                    {level}
                </span>
            ) : null}
        </div>
    );
};

export default QuestRing;
