import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0B0F14",
        backgroundalt: "#050505",
        foreground: "#f5f5f4",
        primary: {
          DEFAULT: "hsl(47, 100%, 47%)",
          foreground: "#0A0A0A",
          hover: "hsl(47, 100%, 55%)",
        },
        secondary: {
          DEFAULT: "#1b1b1d",
          foreground: "#e7e5e4",
        },
        muted: {
          DEFAULT: "#151515",
          foreground: "#a8a29e",
        },
        accent: {
          DEFAULT: "rgba(231, 229, 228, 0.12)",
          foreground: "#cfc9c2",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#f5f5f4",
        },
        border: "rgba(245, 245, 244, 0.1)",
        line: "rgba(245, 245, 244, 0.18)",
        input: "rgba(245, 245, 244, 0.1)",
        ring: "hsl(47, 100%, 47%)",
        card: {
          DEFAULT: "rgba(255, 255, 255, 0.02)",
          foreground: "#f5f5f4",
        },
        popover: {
          DEFAULT: "#0B0F14",
          foreground: "#f5f5f4",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        display: ["var(--font-manrope)", "Manrope", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(250, 204, 21, 0.22)",
        "glow-lg": "0 0 40px rgba(250, 204, 21, 0.3)",
        "glow-white": "0 0 30px rgba(255, 255, 255, 0.05)",
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.3)",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "calc(0.75rem - 2px)",
        sm: "calc(0.75rem - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
