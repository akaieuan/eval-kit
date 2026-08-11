import type { Config } from "tailwindcss";

function rgb(varName: string): string {
  return `rgb(var(${varName}) / <alpha-value>)`;
}

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: rgb("--bg"),
          elev: rgb("--bg-elev"),
          "elev-2": rgb("--bg-elev-2"),
          "elev-3": rgb("--bg-elev-3"),
        },
        border: {
          DEFAULT: rgb("--border"),
          strong: rgb("--border-strong"),
        },
        fg: {
          DEFAULT: rgb("--fg"),
          strong: rgb("--fg-strong"),
          muted: rgb("--muted"),
          "muted-2": rgb("--muted-2"),
        },
        accent: {
          DEFAULT: rgb("--accent"),
          hover: rgb("--accent-hover"),
          pressed: rgb("--accent-pressed"),
        },
        secondary: rgb("--secondary"),
        // shadcn token contract — semantic SURFACES with paired foregrounds.
        // Without these there was no way to say "this is a card" vs "this is
        // a popover" vs "this is an inset well": everything was bg-bg-elev.
        card: { DEFAULT: rgb("--card"), foreground: rgb("--card-foreground") },
        popover: {
          DEFAULT: rgb("--popover"),
          foreground: rgb("--popover-foreground"),
        },
        primary: {
          DEFAULT: rgb("--primary"),
          foreground: rgb("--primary-foreground"),
        },
        destructive: {
          DEFAULT: rgb("--destructive"),
          foreground: rgb("--destructive-foreground"),
        },
        "muted-foreground": rgb("--muted-foreground"),
        input: rgb("--input"),
        ring: rgb("--ring"),
        good: rgb("--good"),
        warn: rgb("--warn"),
        danger: rgb("--danger"),
        info: rgb("--info"),
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      fontSize: {
        "2xs": ["10.5px", { lineHeight: "14px", letterSpacing: "0.01em" }],
      },
      // akaOSS caps weight at 500 and leans on LIGHT (300) for display type.
      // 450/500 stay as the medium/semibold slots; 300 is now reachable.
      fontWeight: {
        thin: "200",
        extralight: "250",
        light: "300",
        normal: "400",
        medium: "450",
        semibold: "500",
      },
      letterSpacing: {
        tightest: "-0.02em",
        tighter: "-0.015em",
        tight: "-0.01em",
      },
    },
  },
  plugins: [],
};

export default config;
