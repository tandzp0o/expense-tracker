import React, { useEffect, useMemo, useState } from "react";
import { API_URL } from "../../config/api";
import { cn } from "../../lib/utils";

const ABSOLUTE_URL_PATTERN = /^(?:[a-z]+:)?\/\//i;
const LOCAL_SOURCE_PATTERN = /^(?:data:|blob:)/i;

const resolveAvatarSrc = (src?: string) => {
    const value = src?.trim();
    if (!value) {
        return "";
    }

    const normalizedValue = value.replace(/\\/g, "/");
    if (
        ABSOLUTE_URL_PATTERN.test(normalizedValue) ||
        LOCAL_SOURCE_PATTERN.test(normalizedValue)
    ) {
        return normalizedValue;
    }

    return `${API_URL}${normalizedValue.startsWith("/") ? normalizedValue : `/${normalizedValue}`}`;
};

export const Avatar: React.FC<{
    src?: string;
    alt?: string;
    fallback?: string;
    className?: string;
}> = ({ src, alt, fallback = "FT", className }) => {
    const resolvedSrc = useMemo(() => resolveAvatarSrc(src), [src]);
    const [hasImageError, setHasImageError] = useState(false);
    const fallbackLabel = fallback.trim().slice(0, 2).toUpperCase() || "FT";

    useEffect(() => {
        setHasImageError(false);
    }, [resolvedSrc]);

    return (
        <div
            className={cn(
                "flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-muted-foreground",
                className,
            )}
        >
            {resolvedSrc && !hasImageError ? (
                <img
                    alt={alt || fallback}
                    className="h-full w-full object-cover"
                    onError={() => setHasImageError(true)}
                    src={resolvedSrc}
                />
            ) : (
                <span>{fallbackLabel}</span>
            )}
        </div>
    );
};
