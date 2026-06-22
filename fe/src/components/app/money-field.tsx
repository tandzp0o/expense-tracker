import React from "react";
import { AmountInput } from "../ui/amount-input";
import { cn } from "../../lib/utils";

export interface MoneyFieldProps {
  label: string;
  value: string;
  onChange: (value: string, numericValue: number) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  type?: React.ComponentProps<typeof AmountInput>["type"];
  fieldRef?: React.Ref<HTMLDivElement>;
}

export const MoneyField: React.FC<MoneyFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  type = "desktop",
  fieldRef,
}) => (
  <div className={cn(className)} ref={fieldRef}>
    <label className="mb-2 block text-sm font-medium">{label}</label>
    <AmountInput
      className={cn("w-full", inputClassName)}
      onChange={onChange}
      placeholder={placeholder ?? label}
      type={type}
      value={value}
    />
  </div>
);
