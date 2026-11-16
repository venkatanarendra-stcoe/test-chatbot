import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    screens: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px" },
    extend: {
      fontFamily: { sans: ["Inter Variable", "Inter", "system-ui", "sans-serif"] },
      fontSize: {
        title: ["24px", { lineHeight: "32px", fontWeight: "600", letterSpacing: "-0.01em" }],
        section: ["16px", { lineHeight: "24px", fontWeight: "600" }],
        kpi: ["28px", { lineHeight: "36px", fontWeight: "600", letterSpacing: "-0.01em" }],
        display: ["32px", { lineHeight: "40px", fontWeight: "600", letterSpacing: "-0.015em" }],
        micro: ["11px", { lineHeight: "16px" }],
      },
      colors: {
        background: c("background"), surface: c("surface"), "surface-muted": c("surface-muted"),
        border: c("border"), input: c("border"), ring: c("ring"),
        text: { DEFAULT: c("text"), secondary: c("text-secondary"), muted: c("text-muted") },
        primary: { DEFAULT: c("primary"), hover: c("primary-hover"), soft: c("primary-soft"), foreground: c("primary-foreground") },
        success: { DEFAULT: c("success"), bg: c("success-bg") },
        warning: { DEFAULT: c("warning"), bg: c("warning-bg") },
        danger: { DEFAULT: c("danger"), bg: c("danger-bg") },
        neutral: { DEFAULT: c("neutral"), bg: c("neutral-bg") },
        info: { DEFAULT: c("info"), bg: c("info-bg") },
        overlay: c("overlay"),
        brand: { fg: c("brand-fg") },
        chart: { 1: c("chart-1"), 2: c("chart-2"), 3: c("chart-3"), 4: c("chart-4"), 5: c("chart-5"), 6: c("chart-6") },
        // shadcn aliases onto the tokens above
        foreground: c("text"), card: { DEFAULT: c("surface"), foreground: c("text") }, popover: { DEFAULT: c("surface"), foreground: c("text") },
        muted: { DEFAULT: c("surface-muted"), foreground: c("text-muted") },
        accent: { DEFAULT: c("surface-muted"), foreground: c("text") },
        secondary: { DEFAULT: c("surface-muted"), foreground: c("text") },
        destructive: { DEFAULT: c("danger"), foreground: c("surface") },
      },
      borderRadius: { sm: "4px", md: "6px", lg: "8px", xl: "12px", "2xl": "16px" },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(var(--shadow-color) / 0.05)",
        lg: "0 12px 32px -4px rgb(var(--shadow-color) / 0.14), 0 4px 8px -2px rgb(var(--shadow-color) / 0.06)",
      },
      transitionDuration: { DEFAULT: "150ms" },
      transitionTimingFunction: { DEFAULT: "ease-out" },
      keyframes: {
        "dot-bounce": { "0%, 80%, 100%": { opacity: "0.3", transform: "translateY(0)" }, "40%": { opacity: "1", transform: "translateY(-3px)" } },
        "panel-in": { from: { opacity: "0", transform: "scale(0.96) translateY(8px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { "dot-bounce": "dot-bounce 1.2s infinite ease-in-out", "panel-in": "panel-in 180ms ease-out" },
    },
  },
  plugins: [animate],
} satisfies Config;
