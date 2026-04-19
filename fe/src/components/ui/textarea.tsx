import React from "react";
import { cn } from "../../lib/utils";

export const Textarea = React.forwardRef<
    HTMLTextAreaElement,
    React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
    <textarea
        className={cn(
            "flex min-h-[96px] w-full rounded-[var(--app-radius-md)] border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-ring)] disabled:cursor-not-allowed disabled:opacity-50",
            className,
        )}
        ref={ref}
        {...props}
    />
));

Textarea.displayName = "Textarea";
