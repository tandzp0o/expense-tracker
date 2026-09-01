import React from "react";
import { cn } from "../../lib/utils";

interface QuestRingProps {
    /** 0 - 100. */
    percent: number;
    className?: string;
    children: React.ReactNode;
}

/**
 * Experience-style progress ring drawn around the avatar. The ring itself is a
 * conic gradient so it needs no SVG and animates with a single CSS transition.
 */
export const QuestRing: React.FC<QuestRingProps> = ({
    percent,
    className,
    children,
}) => {
    const safePercent = Math.max(0, Math.min(100, percent));
    const complete = safePercent >= 100;

    return (
        <div className={cn("relative shrink-0", className)}>
            <div
                className="rounded-full p-[3px] ring-1 ring-border transition-[background] duration-500"
                style={{
                    // This project themes with --app-* hex tokens; the shadcn
                    // style hsl(var(--primary)) resolves to nothing here, which
                    // made the whole gradient invalid and the ring invisible.
                    background: `conic-gradient(${
                        complete ? "#f59e0b" : "var(--app-primary)"
                    } ${safePercent * 3.6}deg, var(--app-border) 0deg)`,
                }}
            >
                <div className="rounded-full bg-background p-[2px]">
                    <div className="overflow-hidden rounded-full">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuestRing;
