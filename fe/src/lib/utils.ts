export const cn = (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(" ");

export const toDateInputValue = (value?: string | null) => {
    if (!value) {
        return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    return date.toISOString().slice(0, 10);
};

export const fromDateInputValue = (value: string) =>
    value ? new Date(`${value}T12:00:00`).toISOString() : "";

export const hexToRgba = (value: string, alpha: number) => {
    const normalized = value.replace("#", "").trim();
    const hex =
        normalized.length === 3
            ? normalized
                  .split("")
                  .map((part) => `${part}${part}`)
                  .join("")
            : normalized;
    if (!/^[0-9a-f]{6}$/i.test(hex)) {
        return `rgba(37, 99, 235, ${alpha})`;
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
