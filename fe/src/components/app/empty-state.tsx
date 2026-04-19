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
        <CardContent className="flex min-h-[240px] flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {description}
            </p>
            {actionLabel && onAction ? (
                <Button className="mt-5" onClick={onAction}>
                    {actionLabel}
                </Button>
            ) : null}
        </CardContent>
    </Card>
);
