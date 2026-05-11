import React from "react";
import { cn } from "../../lib/utils";

export const PageHeader: React.FC<{
    title: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string;
    hideTitleOnMobile?: boolean;
    hideDescriptionOnMobile?: boolean;
    hideActionsOnMobile?: boolean;
}> = ({
    title,
    description,
    actions,
    className,
    hideTitleOnMobile = true,
    hideDescriptionOnMobile = true,
    hideActionsOnMobile = false,
}) => (
    <div
        className={cn(
            "hidden md:flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between",
            className,
        )}
    >
        <div className="min-w-0">
            <h1
                className={cn(
                    "text-[1.35rem] font-semibold tracking-tight text-foreground sm:text-[1.75rem]",
                    hideTitleOnMobile ? "hidden lg:block" : "",
                )}
            >
                {title}
            </h1>
            {description ? (
                <p
                    className={cn(
                        "mt-1 max-w-3xl text-[13px] leading-5 text-muted-foreground sm:text-sm sm:leading-6",
                        hideDescriptionOnMobile ? "hidden lg:block" : "",
                    )}
                >
                    {description}
                </p>
            ) : null}
        </div>
        {actions ? (
            <div
                className={cn(
                    "flex w-full flex-wrap gap-2.5 sm:gap-3 lg:w-auto lg:justify-end [&>*]:w-full sm:[&>*]:w-auto",
                    hideActionsOnMobile ? "hidden lg:flex" : "",
                )}
            >
                {actions}
            </div>
        ) : null}
    </div>
);
