import React from "react";
import { cn } from "../../lib/utils";

export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
    <div
        className={cn(
            "h-6 w-6 animate-spin rounded-full border-2 border-primary/25 border-t-primary",
            className,
        )}
    />
);
