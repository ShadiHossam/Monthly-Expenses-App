/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        // FinTrack light theme
        "ft-background":         "#f6fbf1",
        "ft-surface":            "#ffffff",
        "ft-surface-low":        "#f0f5eb",
        "ft-surface-container":  "#eaf0e6",
        "ft-primary":            "#005e26",
        "ft-primary-container":  "#007a33",
        "ft-secondary":          "#126a5b",
        "ft-on-surface":         "#171d17",
        "ft-on-surface-variant": "#3f4a3e",
        "ft-outline":            "#6f7a6d",
        "ft-outline-variant":    "#becabb",
        "ft-error":              "#ba1a1a",
        "ft-success":            "#005e26",
        // Veridian Elite dark theme
        "ve-background":         "#111412",
        "ve-surface":            "#1d201e",
        "ve-surface-high":       "#252926",
        "ve-surface-highest":    "#2e322f",
        "ve-primary":            "#95d4b3",
        "ve-primary-dim":        "#77dc88",
        "ve-on-surface":         "#e2e8e3",
        "ve-on-surface-variant": "#9aaa9e",
        "ve-outline":            "#444d46",
        "ve-outline-variant":    "#2e3730",
        "ve-error":              "#ffb3b3",
        "ve-success":            "#95d4b3",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg:      "0.5rem",
        xl:      "0.75rem",
        "2xl":   "1rem",
        "3xl":   "1.5rem",
      },
    },
  },
  plugins: [],
};
