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
            "flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between",
            className,
        )}
    >
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {title}
            </h1>
            {description ? (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
);
