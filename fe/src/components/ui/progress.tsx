import React from "react";
import { cn } from "../../lib/utils";

export const Progress: React.FC<{
    value: number;
    className?: string;
    indicatorClassName?: string;
}> = ({ value, className, indicatorClassName }) => (
    <div
        className={cn(
            "h-2 w-full overflow-hidden rounded-[var(--app-radius-md)] bg-muted",
            className,
        )}
    >
        <div
            className={cn(
                "h-full rounded-[var(--app-radius-md)] bg-primary transition-all",
                indicatorClassName,
            )}
            style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
        />
    </div>
);
