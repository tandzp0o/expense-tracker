import React from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { cn } from "../../lib/utils";

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
    <Card className={cn("overflow-hidden border-border/80 bg-card/95", className)}>
        <CardContent className="flex items-center gap-3 p-3 sm:p-3.5">
            <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[calc(var(--app-radius-md)-5px)] bg-primary-soft text-primary sm:h-9 sm:w-9">
                <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                    <p
                        className="text-[12px] font-semibold leading-4 text-foreground sm:text-[13px]"
                        style={oneLineClampStyle}
                        title={title}
                    >
                        {title}
                    </p>
                    {subtitle ? (
                        <p
                            className="text-[10px] leading-4 text-muted-foreground sm:text-[11px]"
                            style={oneLineClampStyle}
                            title={subtitle}
                        >
                            {subtitle}
                        </p>
                    ) : null}
                </div>

                <p
                    className="shrink-0 whitespace-nowrap text-right text-[1.05rem] font-semibold leading-none tracking-tight text-foreground sm:text-[1.15rem]"
                    title={value}
                >
                    {value}
                </p>
            </div>
        </CardContent>
    </Card>
);
