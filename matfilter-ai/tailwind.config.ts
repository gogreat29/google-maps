import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        coral: {
          50: "#fff7f2",
          100: "#ffe9dc",
          500: "#ff7a4a",
          600: "#e85f2f",
          700: "#bd4721"
        },
        ink: "#262322"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(180, 76, 41, 0.14)"
      }
    }
  },
  plugins: []
};

export default config;
