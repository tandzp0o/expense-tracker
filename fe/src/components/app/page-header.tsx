import React from "react";
import { cn } from "../../lib/utils";

export const PageHeader: React.FC<{
    title: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string;
}> = ({ title, description, actions, className }) => (
    <div
        className={cn(
            "flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between",
            className,
        )}
    >
        <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
                {title}
            </h1>
            {description ? (
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {description}
                </p>
            ) : null}
        </div>
        {actions ? (
            <div className="flex w-full flex-wrap gap-3 lg:w-auto lg:justify-end [&>*]:w-full sm:[&>*]:w-auto">
                {actions}
            </div>
        ) : null}
    </div>
);
