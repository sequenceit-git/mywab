import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: "#eefcf4",
          100: "#d7f7e4",
          200: "#b2eecb",
          300: "#7ddeaa",
          400: "#43c483",
          500: "#25D366", // WhatsApp Green
          600: "#189d49",
          700: "#167c3c",
          800: "#166233",
          900: "#14512b",
          950: "#052d16",
        },
        telegram: {
          50: "#f0f8ff",
          500: "#229ED9", // Telegram Blue
          600: "#1b85b8",
        },
        dark: {
          800: "#1e293b",
          850: "#172033",
          900: "#0f172a",
          950: "#020617",
        }
      },
    },
  },
  plugins: [],
};
export default config;
