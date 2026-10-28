const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: v("canvas"), panel: v("panel"), raised: v("raised"), line: v("line"),
        ink: v("ink"), muted: v("muted"), faint: v("faint"),
        accent: v("accent"), "accent-ink": v("accent-ink"),
        warn: v("warn"), pos: v("pos"), neu: v("neu"), neg: v("neg"),
      },
      fontFamily: {
        sans: ['"Manrope Variable"', "Manrope", "system-ui", "Segoe UI", "sans-serif"],
        display: ['"Sora Variable"', "Sora", '"Manrope Variable"', "system-ui", "sans-serif"],
      },
      boxShadow: { panel: "var(--shadow)" },
    },
  },
  plugins: [],
};
