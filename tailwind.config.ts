import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#7131d6",
        "primary-container": "#8b50f1",
        secondary: "#0058bf",
        surface: "#f9f9f9",
        "surface-low": "#f3f3f3",
        "surface-lowest": "#ffffff",
        "on-surface": "#1a1c1c",
        "on-surface-variant": "#48484a",
        "outline-variant": "rgba(204,195,215,0.15)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        ambient: "0 8px 40px 0 rgba(26,28,28,0.06)",
        "ambient-lg": "0 16px 60px 0 rgba(26,28,28,0.08)",
        float: "0 4px 30px 0 rgba(26,28,28,0.04)",
      },
      letterSpacing: {
        tight: "-0.02em",
        wide: "0.05em",
      },
    },
  },
  plugins: [],
};

export default config;
