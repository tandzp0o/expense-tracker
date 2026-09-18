import React, { useEffect, useRef, useState } from "react";
import { useLocale } from "contexts/LocaleContext";
import { formatMoney } from "../lib/format";

/**
 * The chart is drawn at the container's real pixel width instead of scaling a
 * fixed viewBox, so axis labels stay 11px on a phone and on a wide monitor
 * alike rather than shrinking to 6px or growing to 19px.
 */
const useContainerWidth = (fallback: number) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const update = () => setWidth(Math.max(280, Math.round(element.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
};

export interface BarPoint {
  label: string;
  income: number;
  expense: number;
}

const niceCeiling = (value: number) => {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
};

const shortMoney = (value: number, isVietnamese: boolean) => {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}${isVietnamese ? "tr" : "M"}`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return String(Math.round(value));
};

/**
 * Income against expense, month by month, drawn straight onto the page. Both
 * series share one scale so a taller bar always means more money.
 */
export const IncomeExpenseBars: React.FC<{
  data: BarPoint[];
  height?: number;
}> = ({ data, height = 190 }) => {
  const { isVietnamese } = useLocale();
  const [containerRef, width] = useContainerWidth(640);
  const top = 12;
  const bottom = 26;
  const left = 40;
  const plotHeight = height - top - bottom;
  const plotWidth = width - left;
  const maxValue = niceCeiling(
    Math.max(0, ...data.flatMap((point) => [point.income, point.expense])),
  );
  const ticks = [0, maxValue / 2, maxValue];
  const groupWidth = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.min(18, groupWidth / 4);
  const y = (value: number) => top + plotHeight - (value / maxValue) * plotHeight;

  return (
    <div className="w-full" ref={containerRef}>
      <svg
        aria-label={isVietnamese ? "Biểu đồ thu chi theo tháng" : "Income and expense by month"}
        height={height}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              stroke="var(--l-line)"
              strokeDasharray={tick === 0 ? undefined : "3 4"}
              x1={left}
              x2={width}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text
              fill="var(--l-muted)"
              fontSize="11"
              textAnchor="end"
              x={left - 8}
              y={y(tick) + 4}
            >
              {shortMoney(tick, isVietnamese)}
            </text>
          </g>
        ))}
        {data.map((point, index) => {
          const center = left + groupWidth * index + groupWidth / 2;
          const isLast = index === data.length - 1;
          return (
            <g key={`${point.label}-${index}`}>
              <title>
                {`${point.label}: ${isVietnamese ? "thu" : "in"} ${formatMoney(point.income)}, ${isVietnamese ? "chi" : "out"} ${formatMoney(point.expense)}`}
              </title>
              <rect
                fill="var(--l-accent)"
                height={Math.max(top + plotHeight - y(point.income), point.income > 0 ? 2 : 0)}
                opacity={isLast ? 1 : 0.75}
                rx={4}
                width={barWidth}
                x={center - barWidth - 2}
                y={y(point.income)}
              />
              <rect
                fill="var(--l-spend)"
                height={Math.max(top + plotHeight - y(point.expense), point.expense > 0 ? 2 : 0)}
                opacity={isLast ? 1 : 0.75}
                rx={4}
                width={barWidth}
                x={center + 2}
                y={y(point.expense)}
              />
              <text
                fill={isLast ? "var(--l-ink)" : "var(--l-muted)"}
                fontSize="11.5"
                fontWeight={isLast ? 600 : 400}
                textAnchor="middle"
                x={center}
                y={height - 6}
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const ChartLegend: React.FC = () => {
  const { isVietnamese } = useLocale();
  return (
    <div className="flex items-center gap-3 text-[12px] text-ledger-ink-2">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-ledger-accent" />
        {isVietnamese ? "Thu" : "In"}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-ledger-spend" />
        {isVietnamese ? "Chi" : "Out"}
      </span>
    </div>
  );
};
