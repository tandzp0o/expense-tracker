import React from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { cn } from "../../lib/utils";

const twoLineClampStyle: React.CSSProperties = {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
};

const oneLineClampStyle: React.CSSProperties = {
    display: "-webkit-box",
    WebkitLineClamp: 1,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
};

export const MetricCard: React.FC<{
    title: string;
    value: string;
    subtitle?: string;
    icon: LucideIcon;
    className?: string;
}> = ({ title, value, subtitle, icon: Icon, className }) => (
    <Card className={cn("h-full overflow-hidden border-border/80", className)}>
        <CardContent className="flex h-full flex-col gap-3 p-4 sm:gap-3.5 sm:p-5">
            <div className="flex items-start gap-3">
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[calc(var(--app-radius-md)-4px)] bg-primary-soft text-primary sm:h-10 sm:w-10">
                    <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                    <p
                        className="text-[13px] font-semibold leading-4 text-foreground sm:text-sm sm:leading-5"
                        style={twoLineClampStyle}
                        title={title}
                    >
                        {title}
                    </p>
                    {subtitle ? (
                        <p
                            className="text-[11px] leading-4 text-muted-foreground sm:text-xs sm:leading-5"
                            style={oneLineClampStyle}
                            title={subtitle}
                        >
                            {subtitle}
                        </p>
                    ) : null}
                </div>
            </div>

            <p
                className="break-words text-[1.35rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[1.55rem] xl:text-[1.7rem]"
                title={value}
            >
                {value}
            </p>
        </CardContent>
    </Card>
);
