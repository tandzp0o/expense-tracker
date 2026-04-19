import React from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { cn } from "../../lib/utils";

export const MetricCard: React.FC<{
    title: string;
    value: string;
    subtitle?: string;
    icon: LucideIcon;
    className?: string;
}> = ({ title, value, subtitle, icon: Icon, className }) => (
    <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-6">
            <div className="mb-5 flex items-center justify-between">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--app-radius-md)] bg-primary-soft text-primary">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
            {subtitle ? (
                <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
        </CardContent>
    </Card>
);
