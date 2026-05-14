import React, { useMemo } from "react";
import { useLocale } from "../../contexts/LocaleContext";
import { Input } from "./input";
import { cn } from "../../lib/utils";
import {
  formatWholeNumberInput,
  parseWholeNumberInput,
} from "../../utils/formatters";

interface AmountInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange"
> {
  value: string;
  onChange: (value: string, numericValue: number) => void;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  className,
  type = "desktop",
  ...props
}) => {
  const { isVietnamese } = useLocale();
  const locale = isVietnamese ? "vi-VN" : "en-US";

  const numericValue = parseWholeNumberInput(value);

  const quickAmounts = useMemo(() => {
    if (numericValue === 0) {
      return isVietnamese ? [10000, 50000, 100000] : [10, 50, 100];
    }

    const base = numericValue;
    if (isVietnamese) {
      if (base < 1000) {
        return [base * 1000, base * 10000, base * 100000];
      }
      return [base * 10, base * 100, base * 1000];
    }

    return [base * 10, base * 100, base * 1000];
  }, [numericValue, isVietnamese]);

  const formatAmount = (num: number): string => {
    return formatWholeNumberInput(num) || num.toLocaleString(locale);
  };

  const handleQuickAmount = (amount: number) => {
    onChange(formatAmount(amount), amount);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseWholeNumberInput(event.target.value);
    const formatted = num > 0 ? formatWholeNumberInput(num) : "";
    onChange(formatted, num);
  };

  return (
    <div className="space-y-2 w-full">
      <Input
        className={cn("font-mono", className)}
        inputMode="numeric"
        onChange={handleChange}
        value={value}
        {...props}
      />
      <div className="flex flex-wrap gap-2 w-full">
        {quickAmounts.map((amount) => (
          <button
            key={amount}
            className={cn(
              "min-w-[5.5rem] flex-1 rounded-md border border-border/70 bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/80 hover:border-border",
            )}
            onClick={() => handleQuickAmount(amount)}
            type="button"
          >
            {formatAmount(amount)}
          </button>
        ))}
      </div>
    </div>
  );
};
