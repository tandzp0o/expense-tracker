import React from "react";
import { cn } from "../../lib/utils";

type BadgeVariant = "default" | "secondary" | "outline" | "success" | "danger";

const variants: Record<BadgeVariant, string> = {
    default: "bg-primary-soft text-primary border-transparent",
    secondary: "bg-muted text-muted-foreground border-transparent",
    outline: "bg-transparent text-foreground border-border",
    success:
        "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900",
    danger:
        "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-900",
};

export const Badge: React.FC<
    React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }
> = ({ className, variant = "default", ...props }) => (
    <span
        className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
            variants[variant],
            className,
        )}
        {...props}
    />
);
