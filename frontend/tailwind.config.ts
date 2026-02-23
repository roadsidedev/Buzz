import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

/**
 * CLAW-OS RETRO Design System
 *
 * Blends Neo-Brutalism with Classic Macintosh System 7
 * - High contrast, hard shadows
 * - Window-based navigation
 * - Dithered textures, pixel-perfect UI
 */

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        /* CLAW-OS Core */
        mac: {
          gray: "#E0E0E0",
          charcoal: "#1A1A1A",
          white: "#FFFFFF",
        },

        /* CLAW-OS Accents */
        accent: {
          purple: "#6C5CE7",
          teal: "#4ECDC4",
          yellow: "#FFE66D",
          crimson: "#FF6B6B",
          red: "#F87171", // Lite red for richness
        },

        /* Legacy support */
        base: {
          black: "#000000",
          white: "#FFFFFF",
          gray: {
            50: "#F9F9F9",
            100: "#F3F3F3",
            200: "#E8E8E8",
            300: "#D4D4D4",
            400: "#A1A1A1",
            500: "#6B6B6B",
            600: "#3D3D3D",
            700: "#262626",
            800: "#1A1A1A",
            900: "#0F0F0F",
          },
        },

        /* Primary Accent: Electric Cyan */
        primary: {
          50: "#F0F9FF",
          100: "#E1F3FF",
          200: "#BAE6FF",
          300: "#7DD3FC",
          400: "#38BDF8",
          500: "#0EA5E9", // Primary accent
          600: "#0284C7",
          700: "#0369A1",
          800: "#075985",
          900: "#0C3A66",
        },

        /* Secondary Accent: Electric Magenta */
        secondary: {
          50: "#FDF2F8",
          100: "#FCE7F3",
          200: "#FBCFE8",
          300: "#F8B4DD",
          400: "#F472B6",
          500: "#EC4899", // Secondary accent
          600: "#DB2777",
          700: "#BE185D",
          800: "#9D174D",
          900: "#831843",
        },

        /* Tertiary Accent: Electric Yellow */
        tertiary: {
          50: "#FFFAED",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#F59E0B", // Tertiary accent
          600: "#D97706",
          700: "#B45309",
          800: "#92400E",
          900: "#78350F",
        },

        /* Utility Colors */
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6",
      },

      fontFamily: {
        /* CLAW-OS Typography Stack */
        sans: [
          "Inter",
          "Public Sans",
          "Helvetica Neue",
          "Arial",
          ...defaultTheme.fontFamily.sans,
        ],
        mono: [
          "JetBrains Mono",
          "Roboto Mono",
          "Courier New",
          ...defaultTheme.fontFamily.mono,
        ],
        /* Heavy display font */
        display: [
          "Inter",
          "Helvetica Neue",
          "Arial",
          ...defaultTheme.fontFamily.sans,
        ],
      },

      fontSize: {
        /* Aggressive hierarchy */
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
        "5xl": ["3rem", { lineHeight: "1" }],
        "6xl": ["3.75rem", { lineHeight: "1" }],
        "7xl": ["4.5rem", { lineHeight: "1" }],
        "8xl": ["6rem", { lineHeight: "1" }],
      },

      fontWeight: {
        thin: "100",
        extralight: "200",
        light: "300",
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
        extrabold: "800",
        black: "900",
      },

      spacing: {
        /* Geometric spacing scale */
        0: "0px",
        1: "0.25rem",
        2: "0.5rem",
        3: "0.75rem",
        4: "1rem",
        6: "1.5rem",
        8: "2rem",
        12: "3rem",
        16: "4rem",
        20: "5rem",
        24: "6rem",
        32: "8rem",
        48: "12rem",
        64: "16rem",
      },

      borderRadius: {
        /* Neobrutalism: minimal or sharp corners */
        none: "0px",
        sm: "0.125rem",
        DEFAULT: "0px",
        md: "0.25rem",
        lg: "0.5rem",
        full: "9999px",
      },

      borderWidth: {
        DEFAULT: "2px",
        0: "0px",
        1: "1px",
        2: "2px",
        3: "3px",
        4: "4px",
        6: "6px",
        8: "8px",
      },

      boxShadow: {
        /* CLAW-OS Hard Shadows */
        "retro-sm": "2px 2px 0px 0px rgba(0,0,0,1)",
        "retro-md": "4px 4px 0px 0px rgba(0,0,0,1)",
        "retro-lg": "6px 6px 0px 0px rgba(0,0,0,1)",
        "retro-xl": "8px 8px 0px 0px rgba(0,0,0,1)",
        "retro-purple": "6px 6px 0px 0px #6C5CE7",
        "retro-teal": "6px 6px 0px 0px #4ECDC4",
        "retro-yellow": "6px 6px 0px 0px #FFE66D",
        "retro-crimson": "6px 6px 0px 0px #FF6B6B",

        /* Legacy shadows */
        none: "none",
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        DEFAULT: "none",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
        xl: "none",
        "2xl": "none",
        inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
        "glow-primary": "0 0 20px rgba(14, 165, 233, 0.5)",
        "glow-secondary": "0 0 20px rgba(236, 72, 153, 0.5)",
      },

      backgroundImage: {
        /* Patterns for brutal aesthetic */
        "stripe-diagonal":
          "repeating-linear-gradient(45deg, var(--tw-gradient-stops))",
        "stripe-horizontal":
          "repeating-linear-gradient(90deg, var(--tw-gradient-stops))",
        "stripe-vertical":
          "repeating-linear-gradient(0deg, var(--tw-gradient-stops))",
      },

      animation: {
        /* CLAW-OS Step Animations */
        blink: "blink 1s steps(2, start) infinite",
        "cursor-blink": "cursor-blink 1s step-end infinite",

        /* Standard animations */
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        bounce: "bounce 1s infinite",
        "spin-slow": "spin 3s linear infinite",
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "scale-up": "scaleUp 0.3s ease-out",
        glitch: "glitch 0.15s ease-in-out",
      },

      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "cursor-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleUp: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        glitch: {
          "0%": { transform: "translate(0)" },
          "20%": { transform: "translate(-2px, 2px)" },
          "40%": { transform: "translate(-2px, -2px)" },
          "60%": { transform: "translate(2px, 2px)" },
          "80%": { transform: "translate(2px, -2px)" },
          "100%": { transform: "translate(0)" },
        },
      },

      opacity: {
        0: "0",
        5: "0.05",
        10: "0.1",
        20: "0.2",
        25: "0.25",
        30: "0.3",
        40: "0.4",
        50: "0.5",
        60: "0.6",
        70: "0.7",
        75: "0.75",
        80: "0.8",
        90: "0.9",
        95: "0.95",
        100: "1",
      },
    },
  },

  plugins: [
    /* Utility class helpers */
    function ({
      addComponents,
      addUtilities,
    }: {
      addComponents: (arg0: any) => void;
      addUtilities: (arg0: any) => void;
    }) {
      addComponents({
        /* CLAW-OS Component Classes */
        ".retro-window": {
          "@apply bg-mac-gray border-4 border-mac-charcoal shadow-retro-lg": "",
        },
        ".retro-titlebar": {
          "@apply bg-mac-charcoal px-2 py-1 flex items-center justify-between":
            "",
        },
        ".btn-retro": {
          "@apply px-6 py-3 bg-mac-charcoal text-mac-white border-4 border-mac-charcoal font-bold tracking-wide transition-all duration-100 hover:bg-accent-purple hover:shadow-retro-purple cursor-pointer active:translate-x-1 active:translate-y-1 active:shadow-none":
            "",
        },
        ".btn-retro-secondary": {
          "@apply px-6 py-3 bg-mac-white text-mac-charcoal border-4 border-mac-charcoal font-bold tracking-wide transition-all duration-100 hover:bg-accent-yellow hover:shadow-retro-yellow cursor-pointer active:translate-x-1 active:translate-y-1 active:shadow-none":
            "",
        },
        ".btn-retro-accent": {
          "@apply px-6 py-3 bg-accent-purple text-mac-white border-4 border-mac-charcoal font-bold tracking-wide transition-all duration-100 hover:bg-accent-teal hover:shadow-retro-teal cursor-pointer active:translate-x-1 active:translate-y-1 active:shadow-none":
            "",
        },

        /* Legacy component classes */
        ".btn-primary": {
          "@apply px-6 py-3 bg-base-black text-base-white border-2 border-base-black font-bold tracking-wide transition-all duration-200 hover:bg-base-white hover:text-base-black hover:border-base-black cursor-pointer active:scale-95":
            "",
        },
        ".btn-secondary": {
          "@apply px-6 py-3 bg-base-white text-base-black border-2 border-base-black font-bold tracking-wide transition-all duration-200 hover:bg-base-black hover:text-base-white cursor-pointer active:scale-95":
            "",
        },
        ".btn-accent": {
          "@apply px-6 py-3 bg-primary-500 text-base-white border-2 border-base-black font-bold tracking-wide transition-all duration-200 hover:bg-primary-600 cursor-pointer active:scale-95":
            "",
        },
        ".card": {
          "@apply bg-base-white border-2 border-base-black p-6": "",
        },
        ".input-field": {
          "@apply w-full px-4 py-3 bg-base-white border-2 border-base-black text-base-black placeholder-base-gray-400 focus:outline-none focus:border-primary-500 transition-colors":
            "",
        },
      });

      addUtilities({
        /* CLAW-OS Utility Classes */
        ".border-retro": {
          borderColor: "#000000",
          borderWidth: "4px",
        },
        ".border-retro-dashed": {
          borderStyle: "dashed",
          borderColor: "#000000",
        },
        ".text-shadow-retro": {
          textShadow: "2px 2px 0px rgba(0, 0, 0, 1)",
        },

        /* Legacy utilities */
        ".border-black": {
          borderColor: "#000000",
        },
        ".border-dashed-black": {
          borderStyle: "dashed",
          borderColor: "#000000",
        },
        ".text-shadow-sm": {
          textShadow: "2px 2px 0px rgba(0, 0, 0, 0.1)",
        },
        ".text-shadow-md": {
          textShadow: "3px 3px 0px rgba(0, 0, 0, 0.2)",
        },
        ".text-shadow-lg": {
          textShadow: "4px 4px 0px rgba(0, 0, 0, 0.3)",
        },
        ".bg-stripe": {
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0, 0, 0, 0.03) 10px, rgba(0, 0, 0, 0.03) 20px)",
        },
        ".transform-gpu": {
          transform: "translateZ(0)",
        },
      });
    },
  ],
};

export default config;
