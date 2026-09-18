import React from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "lib/utils";
import { formatMoney } from "../lib/format";
import { AccountMenu } from "./AccountMenu";
import type { CategoryMeta } from "../lib/categories";

/* ------------------------------------------------------------------ Money */

type MoneyTone = "auto" | "in" | "out" | "neutral" | "muted";

/**
 * A money figure. `auto` colours by sign (green in, rose out); the other tones
 * force a colour for figures whose sign is not the point, like a balance.
 */
export const Money: React.FC<{
  amount: number;
  currency?: string;
  signed?: boolean;
  tone?: MoneyTone;
  className?: string;
}> = ({ amount, currency, signed, tone = "neutral", className }) => {
  const resolved =
    tone === "auto" ? (amount > 0 ? "in" : amount < 0 ? "out" : "neutral") : tone;

  return (
    <span
      className={cn(
        "ledger-num",
        resolved === "in" && "text-ledger-in",
        resolved === "out" && "text-ledger-out",
        resolved === "neutral" && "text-ledger-ink",
        resolved === "muted" && "text-ledger-muted",
        className,
      )}
    >
      {formatMoney(amount, currency, { signed })}
    </span>
  );
};

/* ----------------------------------------------------------------- Labels */

export const Eyebrow: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <span
    className={cn(
      "text-[11.5px] font-semibold uppercase tracking-[0.07em] text-ledger-muted",
      className,
    )}
  >
    {children}
  </span>
);

/* ---------------------------------------------------------------- Buttons */

type ButtonVariant = "primary" | "outline" | "ghost" | "danger" | "soft";
type ButtonSize = "sm" | "md" | "lg";

const buttonClasses = (
  variant: ButtonVariant,
  size: ButtonSize,
  block?: boolean,
) =>
  cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" && "h-8 px-3 text-[13px]",
    size === "md" && "h-10 px-4 text-sm",
    size === "lg" && "h-12 px-5 text-[15px]",
    variant === "primary" &&
      "bg-ledger-accent text-ledger-accent-ink hover:brightness-110",
    variant === "outline" &&
      "border border-ledger-line-strong bg-ledger-paper text-ledger-ink hover:bg-ledger-canvas",
    variant === "ghost" &&
      "text-ledger-ink-2 hover:bg-ledger-canvas hover:text-ledger-ink",
    variant === "soft" &&
      "bg-ledger-accent-wash text-ledger-accent hover:brightness-95",
    // A fixed rose: the dark theme lightens --l-out for text, which would
    // leave white button text on a pale pink.
    variant === "danger" && "bg-[#e11d48] text-white hover:brightness-110",
    block && "w-full",
  );

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    block?: boolean;
    icon?: LucideIcon;
  }
>(
  (
    {
      variant = "primary",
      size = "md",
      block,
      icon: Icon,
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(buttonClasses(variant, size, block), className)}
      type={type}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  ),
);
Button.displayName = "LedgerButton";

/** A button-styled router link, for navigation that looks like an action. */
export const ButtonLink: React.FC<{
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  className?: string;
  children: React.ReactNode;
}> = ({ to, variant = "outline", size = "sm", icon: Icon, className, children }) => (
  <Link className={cn(buttonClasses(variant, size), className)} to={to}>
    {Icon ? <Icon className="h-4 w-4" /> : null}
    {children}
  </Link>
);

/** Plain accent text link, the "Xem tất cả" of every section header. */
export const TextLink: React.FC<{
  to?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}> = ({ to, onClick, children, className }) => {
  const classes = cn(
    "text-[13px] font-medium text-ledger-accent hover:underline underline-offset-4",
    className,
  );

  return to ? (
    <Link className={classes} to={to}>
      {children}
    </Link>
  ) : (
    <button className={classes} onClick={onClick} type="button">
      {children}
    </button>
  );
};

/* ------------------------------------------------------------ Page header */

export const PageHeader: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => (
  // Phone: title | avatar, actions on their own row below.
  // Tablet: title | actions | avatar on one row.
  // Desktop: title | actions; the account lives in the side rail instead.
  <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-4 pb-5 pt-6 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end lg:grid-cols-[minmax(0,1fr)_auto] lg:pb-6 lg:pt-8">
    <div className="col-start-1 row-start-1 min-w-0">
      <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ledger-ink lg:text-[30px]">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1 text-[14px] text-ledger-ink-2">{subtitle}</p>
      ) : null}
    </div>
    {actions ? (
      <div className="col-span-2 row-start-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
        {actions}
      </div>
    ) : null}
    <AccountMenu className="col-start-2 row-start-1 sm:col-start-3 lg:hidden" />
  </header>
);

/* ------------------------------------------------------------------- Card */

export type Tone = "accent" | "in" | "out" | "spend" | "neutral";

const TONE_BADGE: Record<Tone, string> = {
  accent: "bg-ledger-accent-wash text-ledger-accent",
  in: "bg-ledger-in-wash text-ledger-in",
  out: "bg-ledger-out-wash text-ledger-out",
  spend: "bg-ledger-spend-wash text-ledger-spend",
  neutral: "bg-ledger-canvas text-ledger-ink-2",
};

/** A small tinted square holding an icon; it tells sections apart at a glance. */
export const IconBadge: React.FC<{
  icon: LucideIcon;
  tone?: Tone;
  size?: "sm" | "md";
  className?: string;
}> = ({ icon: Icon, tone = "accent", size = "sm", className }) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center justify-center",
      size === "sm" ? "h-8 w-8 rounded-[10px]" : "h-10 w-10 rounded-[12px]",
      TONE_BADGE[tone],
      className,
    )}
  >
    <Icon className={size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]"} />
  </span>
);

/**
 * The surface every group of content sits on. The page behind is grey, so a
 * card's edge is what tells one group from the next, not a hairline on a white
 * sheet where everything runs together.
 */
export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  /** Drop the inner padding, for content that runs to the card's edges. */
  flush?: boolean;
  as?: "section" | "div" | "aside";
}> = ({ children, className, flush, as: Tag = "section" }) => (
  <Tag
    className={cn(
      "min-w-0 rounded-[18px] border border-ledger-line bg-ledger-paper shadow-card",
      !flush && "p-4 sm:p-5 xl:p-6",
      className,
    )}
  >
    {children}
  </Tag>
);

/**
 * A card's title row: a bold title with its description underneath, an
 * optional count, and one action. No icon: next to the rows' own, larger
 * icons it read as a smaller duplicate and added nothing the title did not.
 * `icon` and `tone` are still accepted so existing callers need no change.
 */
export const CardHeader: React.FC<{
  title: string;
  icon?: LucideIcon;
  tone?: Tone;
  meta?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, meta, subtitle, action, className }) => (
  <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
    <div className="flex min-w-0 items-center gap-3">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-[17px] font-bold tracking-[-0.01em] text-ledger-ink">
            {title}
          </h2>
          {meta ? (
            <span className="shrink-0 rounded-full border border-ledger-line bg-ledger-paper px-2 py-0.5 text-[12px] font-semibold text-ledger-ink-2">
              {meta}
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <p className="text-[12.5px] leading-snug text-ledger-muted">{subtitle}</p>
        ) : null}
      </div>
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

/* -------------------------------------------------------------- Hero strip */

export interface HeroStat {
  label: string;
  value: React.ReactNode;
  /** A short line under the figure: a comparison, a count, a date. */
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
}

const STAT_COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 2xl:grid-cols-4",
};

/**
 * The page's one big number on its own card, with the supporting figures as
 * tiles beside it on a wide screen. On a phone the tiles fold into one card of
 * label/value rows, since three full VND figures do not fit side by side.
 */
export const HeroStrip: React.FC<{
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  icon?: LucideIcon;
  stats?: HeroStat[];
  children?: React.ReactNode;
}> = ({ label, value, caption, icon, stats = [], children }) => (
  <section className="grid gap-3 sm:gap-4 xl:grid-cols-12 xl:gap-5">
    <Card
      className={cn(
        "flex flex-col justify-center",
        stats.length ? "xl:col-span-5" : "xl:col-span-12",
      )}
    >
      <div className="flex items-center gap-2.5">
        {icon ? <IconBadge icon={icon} /> : null}
        <p className="text-[14px] font-medium text-ledger-ink-2">{label}</p>
      </div>
      <div className="mt-3 text-[36px] font-semibold leading-none tracking-[-0.03em] text-ledger-ink sm:text-[42px] 2xl:text-[48px]">
        {value}
      </div>
      {caption ? (
        <div className="mt-3 text-[13.5px] leading-relaxed text-ledger-ink-2">{caption}</div>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </Card>
    {stats.length ? (
      <dl
        className={cn(
          "min-w-0 divide-y divide-ledger-line overflow-hidden rounded-[18px] border border-ledger-line bg-ledger-paper shadow-card",
          "sm:grid sm:gap-4 sm:divide-y-0 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none xl:col-span-7 xl:gap-5",
          STAT_COLUMNS[Math.min(stats.length, 4)],
        )}
      >
        {stats.map((stat) => (
          <div
            className="flex min-w-0 items-center justify-between gap-3 px-4 py-3.5 sm:flex-col sm:items-start sm:justify-center sm:rounded-[18px] sm:border sm:border-ledger-line sm:bg-ledger-paper sm:p-5 sm:shadow-card xl:p-6"
            key={stat.label}
          >
            <dt className="flex min-w-0 max-w-full items-center gap-2.5">
              {stat.icon ? (
                <IconBadge
                  className="hidden sm:inline-flex"
                  icon={stat.icon}
                  tone={stat.tone || "neutral"}
                />
              ) : null}
              <span className="truncate text-[13.5px] font-medium text-ledger-ink-2">
                {stat.label}
              </span>
            </dt>
            <dd className="min-w-0 max-w-full text-right sm:mt-3 sm:text-left">
              <div className="text-[15px] font-semibold sm:text-[20px] 2xl:text-[22px]">
                {stat.value}
              </div>
              {stat.hint ? (
                <div className="mt-0.5 hidden text-[12.5px] text-ledger-muted sm:block">
                  {stat.hint}
                </div>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    ) : null}
  </section>
);

/* ---------------------------------------------------------------- Section */

/**
 * A titled group of content. By default it is a card; `bare` renders the
 * same title row without a card, for a group that already sits inside one.
 */
export const Section: React.FC<{
  title: string;
  meta?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  bare?: boolean;
}> = ({ title, meta, subtitle, action, icon, tone, children, className, bare }) => {
  const header = (
    <CardHeader
      action={action}
      icon={icon}
      meta={meta}
      subtitle={subtitle}
      title={title}
      tone={tone}
    />
  );

  return bare ? (
    <section className={cn("min-w-0", className)}>
      {header}
      {children}
    </section>
  ) : (
    <Card className={className}>
      {header}
      {children}
    </Card>
  );
};

/* ------------------------------------------------------------------ Track */

/**
 * An 8px progress track. `budget` (the default) colours by state: the accent
 * while there is room, amber from 85%, rose once the limit is passed. Past
 * 100% it fills instead of being clamped quietly.
 */
export const Track: React.FC<{
  percent: number;
  tone?: "budget" | "spend" | "accent" | "in";
  className?: string;
}> = ({ percent, tone = "budget", className }) => {
  const safe = Number.isFinite(percent) ? percent : 0;
  const over = safe > 100;
  const fill = over
    ? "bg-ledger-out"
    : tone === "budget"
      ? safe >= 85
        ? "bg-ledger-spend"
        : "bg-ledger-accent"
      : tone === "accent"
        ? "bg-ledger-accent"
        : tone === "in"
          ? "bg-ledger-in"
          : "bg-ledger-spend";

  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(safe)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-ledger-canvas", className)}
      role="progressbar"
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", fill)}
        style={{ width: `${Math.max(0, Math.min(safe, 100))}%` }}
      />
    </div>
  );
};

/* ------------------------------------------------------------------- Ring */

export const Ring: React.FC<{
  percent: number;
  size?: number;
  complete?: boolean;
  label?: React.ReactNode;
}> = ({ percent, size = 48, complete, label }) => {
  const stroke = size >= 48 ? 5 : 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(Number(percent) || 0, 100));

  return (
    <div className="relative shrink-0" style={{ height: size, width: size }}>
      <svg className="-rotate-90" height={size} width={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke="var(--l-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={complete ? "var(--l-in)" : "var(--l-accent)"}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          strokeLinecap="round"
          strokeWidth={stroke}
        />
      </svg>
      <span className="ledger-num absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-ledger-ink">
        {label ?? `${Math.round(clamped)}%`}
      </span>
    </div>
  );
};

/* ----------------------------------------------------------------- Notice */

type NoticeTone = "amber" | "rose" | "blue" | "muted";

/**
 * A calm inline strip under whatever caused it. It never blocks: amber is a
 * heads-up, rose says a limit was passed, blue explains what will happen.
 */
export const Notice: React.FC<{
  tone: NoticeTone;
  icon?: LucideIcon;
  children: React.ReactNode;
  detail?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ tone, icon: Icon, children, detail, action, className }) => (
  <div
    className={cn(
      "flex items-start gap-2.5 rounded-[12px] px-3.5 py-2.5 text-[13px] leading-snug",
      tone === "amber" && "bg-ledger-spend-wash text-[color:var(--l-ink)]",
      tone === "rose" && "bg-ledger-out-wash text-[color:var(--l-ink)]",
      tone === "blue" && "bg-ledger-accent-wash text-[color:var(--l-ink)]",
      tone === "muted" && "bg-ledger-canvas text-ledger-ink-2",
      className,
    )}
    role={tone === "rose" ? "alert" : "status"}
  >
    {Icon ? (
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          tone === "amber" && "text-ledger-spend",
          tone === "rose" && "text-ledger-out",
          tone === "blue" && "text-ledger-accent",
          tone === "muted" && "text-ledger-muted",
        )}
      />
    ) : null}
    {/* The action sits beside the text when there is room and drops below it
        on a narrow screen, instead of squeezing the text into a column. */}
    <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-2">
      <div className="min-w-[min(100%,190px)] flex-1">
        <p>{children}</p>
        {detail ? <p className="mt-0.5 text-ledger-ink-2">{detail}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  </div>
);

/* ------------------------------------------------------- Category / chips */

export const CategoryIcon: React.FC<{
  meta: Pick<CategoryMeta, "icon" | "color">;
  size?: number;
}> = ({ meta, size = 36 }) => {
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        backgroundColor: `${meta.color}1f`,
        color: meta.color,
        height: size,
        width: size,
      }}
    >
      <Icon className="h-[46%] w-[46%]" />
    </span>
  );
};

export const Chip: React.FC<{
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
}> = ({ selected, onClick, children, icon: Icon, disabled, className }) => (
  <button
    aria-pressed={selected}
    className={cn(
      "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors disabled:opacity-45",
      selected
        ? "border-ledger-accent bg-ledger-accent-wash text-ledger-accent"
        : "border-ledger-line bg-ledger-paper text-ledger-ink-2 hover:border-ledger-line-strong hover:text-ledger-ink",
      className,
    )}
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
    {children}
  </button>
);

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("flex rounded-[12px] bg-ledger-canvas p-1", className)}
      role="tablist"
    >
      {options.map((option) => (
        <button
          aria-selected={option.value === value}
          className={cn(
            "h-9 flex-1 rounded-[9px] px-3 text-[13.5px] font-medium transition-colors",
            option.value === value
              ? "bg-ledger-paper text-ledger-ink shadow-sm"
              : "text-ledger-ink-2 hover:text-ledger-ink",
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
          role="tab"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Fields */

export const FieldLabel: React.FC<{
  htmlFor?: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}> = ({ htmlFor, children, hint }) => (
  <div className="mb-2 flex items-baseline justify-between gap-3">
    <label htmlFor={htmlFor}>
      <Eyebrow>{children}</Eyebrow>
    </label>
    {hint ? <span className="text-[12px] text-ledger-muted">{hint}</span> : null}
  </div>
);

export const TextInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      // cn only joins classes, so a caller's own height replaces the default
      // here rather than losing to it in the stylesheet.
      !/(^|\s)h-/.test(className || "") && "h-11",
      "w-full rounded-[10px] border border-ledger-line bg-ledger-paper px-3.5 text-[14px] text-ledger-ink outline-none transition-colors placeholder:text-ledger-muted focus:border-ledger-accent",
      className,
    )}
    {...props}
  />
));
TextInput.displayName = "LedgerTextInput";

/* ------------------------------------------------------------ Empty state */

export const EmptyState: React.FC<{
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center px-6 py-14 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ledger-canvas text-ledger-muted">
      <Icon className="h-5 w-5" />
    </span>
    <p className="mt-4 text-[15px] font-semibold text-ledger-ink">{title}</p>
    {description ? (
      <p className="mt-1 max-w-sm text-[13.5px] text-ledger-ink-2">{description}</p>
    ) : null}
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

/* ---------------------------------------------------------------- Loading */

export const SkeletonRows: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div aria-hidden className="divide-y divide-ledger-line">
    {Array.from({ length: rows }).map((_, index) => (
      <div className="flex items-center gap-3 py-4" key={index}>
        <span className="h-9 w-9 animate-pulse rounded-full bg-ledger-canvas" />
        <span className="h-3 flex-1 animate-pulse rounded bg-ledger-canvas" />
        <span className="h-3 w-20 animate-pulse rounded bg-ledger-canvas" />
      </div>
    ))}
  </div>
);
