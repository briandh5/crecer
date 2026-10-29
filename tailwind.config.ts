import type { Config } from "tailwindcss";

/**
 * Sistema de diseño "Naturaleza & Crecimiento"
 *
 * - moss (verde botánico) y sage (salvia): identidad, acciones y progreso.
 * - straw (paja) y sand (arena): tonos tierra suaves para fondos y datos secundarios.
 * - terracotta: acento cálido para llamadas de atención amables (nunca alarmista).
 * - linen: lienzo crema/lino de la app.
 *
 * Los valores base (DEFAULT) son los de la paleta oficial; el resto de la escala
 * se deriva de ellos para tener fondos, bordes y textos accesibles.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        linen: {
          DEFAULT: "#FDFBF7",
          100: "#F8F3EA",
          200: "#EFE7D8",
        },
        moss: {
          50: "#F1F6EF",
          100: "#DDEAD8",
          200: "#BCD5B2",
          300: "#8DB57F",
          400: "#559048",
          500: "#3C7433",
          DEFAULT: "#2D5A27",
          700: "#244A1F",
          800: "#1B3817",
          900: "#122610",
        },
        sage: {
          50: "#F4F8F0",
          100: "#E6EFDC",
          200: "#CFDFBC",
          300: "#B1CB98",
          DEFAULT: "#87A96B",
          500: "#6C8F4F",
          600: "#55723D",
          700: "#425830",
        },
        straw: {
          50: "#FEFBEA",
          100: "#FBF3C4",
          200: "#F6EAA1",
          DEFAULT: "#EEDC82",
          400: "#DEC654",
          500: "#C4AA2E",
          700: "#7A6A17",
        },
        sand: {
          50: "#FAF5EE",
          100: "#F1E7D8",
          200: "#E5D3B8",
          DEFAULT: "#D2B48C",
          400: "#BC9A6C",
          500: "#A27F50",
          700: "#6E5532",
        },
        terracotta: {
          50: "#FDF1EE",
          100: "#FADFD8",
          200: "#F5C0B3",
          300: "#EE9E8C",
          DEFAULT: "#E2725B",
          500: "#CF5A41",
          600: "#B8503B",
          700: "#8F3D2D",
        },
        // Color de texto: verde casi negro, más cálido que el negro puro.
        ink: {
          DEFAULT: "#26301F",
          soft: "#4C5A43",
          muted: "#6F7B66",
        },
      },
      fontFamily: {
        sans: ["var(--font-nunito)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
        hand: ["var(--font-caveat)", "ui-serif", "cursive"],
      },
      borderRadius: {
        // Forma de hoja: esquinas opuestas más marcadas.
        leaf: "2rem 0.75rem 2rem 0.75rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(45, 90, 39, 0.05), 0 6px 20px -6px rgba(45, 90, 39, 0.14)",
        lift: "0 2px 4px rgba(45, 90, 39, 0.06), 0 16px 36px -10px rgba(45, 90, 39, 0.22)",
        inset: "inset 0 2px 6px rgba(45, 90, 39, 0.08)",
      },
      backgroundImage: {
        "dawn": "linear-gradient(160deg, #F1F6EF 0%, #FDFBF7 55%, #FBF3C4 140%)",
        "canopy": "linear-gradient(135deg, #2D5A27 0%, #3C7433 60%, #6C8F4F 130%)",
      },
      keyframes: {
        grow: {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        sway: {
          "0%, 100%": { transform: "rotate(-2deg)" },
          "50%": { transform: "rotate(2deg)" },
        },
      },
      animation: {
        grow: "grow 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        sway: "sway 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
