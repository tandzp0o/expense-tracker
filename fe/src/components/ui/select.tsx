import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export const Select = React.forwardRef<
    HTMLSelectElement,
    React.SelectHTMLAttributes<HTMLSelectElement>
>(({ children, className, ...props }, ref) => (
    <div className="relative">
        <select
            className={cn(
                "flex h-10 w-full appearance-none rounded-[var(--app-radius-md)] border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-ring)] disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            ref={ref}
            {...props}
        >
            {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
));

Select.displayName = "Select";
