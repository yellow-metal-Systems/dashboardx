import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
      colors: {
        // shadcn/ui semantic tokens, mapped onto the brand palette
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--on-primary)",
          container: "var(--primary-container)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--on-secondary)",
          container: "var(--secondary-container)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
          muted: "var(--sidebar-muted)",
        },

        // YellowMetal LeadDesk brand tokens (design spec — do not rename)
        surface: {
          DEFAULT: "var(--surface)",
          dim: "var(--surface-dim)",
          bright: "var(--surface-bright)",
        },
        "surface-container": {
          DEFAULT: "var(--surface-container)",
          lowest: "var(--surface-container-lowest)",
          low: "var(--surface-container-low)",
          high: "var(--surface-container-high)",
          highest: "var(--surface-container-highest)",
        },
        "on-surface": {
          DEFAULT: "var(--on-surface)",
          variant: "var(--on-surface-variant)",
        },
        outline: {
          DEFAULT: "var(--outline)",
          variant: "var(--outline-variant)",
        },
        "on-primary": {
          DEFAULT: "var(--on-primary)",
          container: "var(--on-primary-container)",
        },
        "on-secondary": {
          DEFAULT: "var(--on-secondary)",
          container: "var(--on-secondary-container)",
        },
        success: {
          DEFAULT: "var(--success)",
          container: "var(--success-container)",
        },
        "on-success": {
          DEFAULT: "var(--on-success)",
          container: "var(--on-success-container)",
        },
        error: {
          DEFAULT: "var(--error)",
          container: "var(--error-container)",
        },
        "on-error": {
          DEFAULT: "var(--on-error)",
          container: "var(--on-error-container)",
        },
        "on-background": "var(--on-background)",

        // LMS design-system roles with no MD3 slot to share (see globals.css)
        label: "var(--label)",
        "info-label": "var(--info-label)",
        disabled: "var(--disabled)",
        placeholder: "var(--placeholder)",
        link: {
          DEFAULT: "var(--link)",
          hover: "var(--link-hover)",
        },
        "success-solid": "var(--success-solid)",
        "error-solid": "var(--error-solid)",
        warning: "var(--warning)",
        "grey-solid": "var(--grey-solid)",
        "black-solid": "var(--black-solid)",
        count: "var(--count)",
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        full: "9999px",
      },
      fontSize: {
        // Yellow Metal LMS type scale (LMS-DESIGN-SYSTEM.md) — [size, {lineHeight, fontWeight}]
        "heading-xl": ["32px", { lineHeight: "44px", fontWeight: "800" }],
        "heading-lg": ["24px", { lineHeight: "36px", fontWeight: "800" }],
        "heading-md": ["20px", { lineHeight: "32px", fontWeight: "800" }],
        "heading-sm": ["16px", { lineHeight: "22px", fontWeight: "800" }],
        "label-lg": ["16px", { lineHeight: "22px", fontWeight: "800" }],
        "label-md": ["14px", { lineHeight: "20px", fontWeight: "800" }],
        "label-sm": ["12px", { lineHeight: "20px", fontWeight: "800" }],
        "paragraph-lg": ["16px", { lineHeight: "24px", fontWeight: "600" }],
        "paragraph-md": ["14px", { lineHeight: "22px", fontWeight: "600" }],
        "paragraph-sm": ["12px", { lineHeight: "16px", fontWeight: "400" }],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
