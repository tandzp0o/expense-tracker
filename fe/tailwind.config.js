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
            },
            boxShadow: {
                soft: "0 18px 45px rgba(15, 23, 42, 0.08)",
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
