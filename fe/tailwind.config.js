/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    important: true,
    darkMode: ["class", '[data-theme="dark"]'],
    theme: {
        extend: {
            colors: {
                background: "var(--app-background)",
                foreground: "var(--app-foreground)",
                card: "var(--app-card)",
                "card-foreground": "var(--app-card-foreground)",
                muted: "var(--app-muted)",
                "muted-foreground": "var(--app-muted-foreground)",
                border: "var(--app-border)",
                input: "var(--app-input)",
                primary: "var(--app-primary)",
                "primary-foreground": "var(--app-primary-foreground)",
                "primary-soft": "var(--app-primary-soft)",
                // Ledger (v2) tokens. They only resolve inside .ledger, which is
                // the only place v2 components render.
                ledger: {
                    page: "var(--l-page)",
                    paper: "var(--l-paper)",
                    hover: "var(--l-hover)",
                    canvas: "var(--l-canvas)",
                    line: "var(--l-line)",
                    "line-strong": "var(--l-line-strong)",
                    ink: "var(--l-ink)",
                    "ink-2": "var(--l-ink-2)",
                    muted: "var(--l-muted)",
                    accent: "var(--l-accent)",
                    "accent-ink": "var(--l-accent-ink)",
                    "accent-wash": "var(--l-accent-wash)",
                    in: "var(--l-in)",
                    out: "var(--l-out)",
                    spend: "var(--l-spend)",
                    "in-wash": "var(--l-in-wash)",
                    "out-wash": "var(--l-out-wash)",
                    "spend-wash": "var(--l-spend-wash)",
                },
            },
            boxShadow: {
                soft: "0 18px 45px rgba(15, 23, 42, 0.08)",
                float: "var(--l-shadow-float)",
                card: "var(--l-shadow-card)",
            },
            borderRadius: {
                xl: "1rem",
                "2xl": "1.5rem",
                "3xl": "1.75rem",
            },
        },
    },
    plugins: [],
};
