export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#070B17", 900: "#0E1526", 800: "#16213A" },
        accent: {
          50: "#ECFDF9", 100: "#CFF8EF", 200: "#9FEFE0", 300: "#66DECB", 400: "#33C5B2",
          500: "#12A898", 600: "#0A7F73", 700: "#086961", 800: "#0C564F", 900: "#0B4540",
        },
      },
      fontFamily: {
        sans: ["Manrope", "system-ui", "Segoe UI", "sans-serif"],
        display: ["Sora", "Manrope", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
