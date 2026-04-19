import React from "react";
import { cn } from "../../lib/utils";

type ButtonVariant =
    | "default"
    | "secondary"
    | "outline"
    | "ghost"
    | "destructive";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClassNames: Record<ButtonVariant, string> = {
    default:
        "bg-primary text-primary-foreground shadow-sm hover:brightness-95",
    secondary:
        "bg-muted text-foreground shadow-sm hover:bg-muted/80",
    outline:
        "border border-border bg-background text-foreground hover:bg-muted/50",
    ghost: "bg-transparent text-foreground hover:bg-muted/60",
    destructive:
        "bg-rose-600 text-white shadow-sm hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-400",
};

const sizeClassNames: Record<ButtonSize, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-sm",
    icon: "h-10 w-10 p-0",
};

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        { className, variant = "default", size = "md", type = "button", ...props },
        ref,
    ) => (
        <button
            className={cn(
                "inline-flex items-center justify-center gap-2 rounded-[var(--app-radius-md)] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-ring)] disabled:pointer-events-none disabled:opacity-50",
                variantClassNames[variant],
                sizeClassNames[size],
                className,
            )}
            ref={ref}
            type={type}
            {...props}
        />
    ),
);

Button.displayName = "Button";
