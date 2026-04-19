import React from "react";
import { cn } from "../../lib/utils";

export const Avatar: React.FC<{
    src?: string;
    alt?: string;
    fallback?: string;
    className?: string;
}> = ({ src, alt, fallback = "FT", className }) => (
    <div
        className={cn(
            "flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-muted-foreground",
            className,
        )}
    >
        {src ? (
            <img alt={alt || fallback} className="h-full w-full object-cover" src={src} />
        ) : (
            <span>{fallback.slice(0, 2).toUpperCase()}</span>
        )}
    </div>
);
