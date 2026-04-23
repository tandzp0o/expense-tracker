import React from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";

export const EmptyState: React.FC<{
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}> = ({ icon: Icon, title, description, actionLabel, onAction }) => (
    <Card className="border-dashed">
        <CardContent className="flex min-h-[200px] flex-col items-center justify-center px-4 py-8 text-center sm:min-h-[240px] sm:px-6 sm:py-10">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary sm:mb-4 sm:h-14 sm:w-14">
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <h3 className="text-base font-semibold sm:text-lg">{title}</h3>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground sm:mt-2 sm:max-w-md">
                {description}
            </p>
            {actionLabel && onAction ? (
                <Button className="mt-4 w-full sm:mt-5 sm:w-auto" onClick={onAction}>
                    {actionLabel}
                </Button>
            ) : null}
        </CardContent>
    </Card>
);
