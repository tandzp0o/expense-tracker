import React from "react";
import { cn } from "../../lib/utils";

export const Card = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        className={cn(
            "rounded-[var(--app-radius-lg)] border border-border bg-card text-card-foreground shadow-sm",
            className,
        )}
        ref={ref}
        {...props}
    />
));

Card.displayName = "Card";

export const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div className={cn("flex flex-col gap-1.5 p-6", className)} ref={ref} {...props} />
));

CardHeader.displayName = "CardHeader";

export const CardTitle = ({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className={cn("text-lg font-semibold tracking-tight", className)} {...props}>
        {children}
    </h3>
);

export const CardDescription = ({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className={cn("text-sm text-muted-foreground", className)} {...props}>
        {children}
    </p>
);

export const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div className={cn("p-6", className)} ref={ref} {...props} />
));

CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div className={cn("flex items-center p-6", className)} ref={ref} {...props} />
));

CardFooter.displayName = "CardFooter";
