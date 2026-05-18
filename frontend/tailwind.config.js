// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#2b7cee",
        "background-light": "#f6f7f8",
        "background-dark": "#101822",
        success: "#28A745",
        warning: "#FFC107",
        danger: "#DC3545",
        destructive: "#D32F2F",
        "card-light": "#ffffff",
        "card-dark": "#1a2431",
        "text-light-primary": "#111418",
        "text-dark-primary": "#f0f2f4",
        "text-light-secondary": "#617289",
        "text-dark-secondary": "#a1acbc",
        "border-light": "#f0f2f4",
        "border-dark": "#343a40",
        error: "#DC3545",
      },
      fontFamily: {
        display: ["Manrope", "sans-serif"],
        body: ["Lexend", "sans-serif"],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}