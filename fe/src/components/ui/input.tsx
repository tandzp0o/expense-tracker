import React from "react";
import { cn } from "../../lib/utils";

/** Native pickers we want to open from anywhere inside the field. */
const PICKER_TYPES = ["date", "time", "month", "week", "datetime-local"];

type PickerInput = HTMLInputElement & { showPicker?: () => void };

export const Input = React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", onClick, ...props }, ref) => {
    const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
        onClick?.(event);

        if (!PICKER_TYPES.includes(type)) {
            return;
        }

        const element = event.currentTarget as PickerInput;
        if (
            element.disabled ||
            element.readOnly ||
            typeof element.showPicker !== "function"
        ) {
            return;
        }

        try {
            // By default only the small calendar icon opens the picker, which
            // is an easy target to miss. Clicking anywhere in the field works.
            element.showPicker();
        } catch {
            // Safari and Firefox may refuse outside a user gesture they trust;
            // the field still behaves like a normal date input in that case.
        }
    };

    return (
        <input
            className={cn(
                "flex h-10 w-full rounded-[var(--app-radius-md)] border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-ring)] disabled:cursor-not-allowed disabled:opacity-50",
                PICKER_TYPES.includes(type) && "cursor-pointer",
                className,
            )}
            onClick={handleClick}
            ref={ref}
            type={type}
            {...props}
        />
    );
});

Input.displayName = "Input";
